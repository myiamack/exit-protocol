/* Trial: ranks the teams for one round. Top half win.
   Every trial takes the round and the teams and returns a ranked list (best first).
   Winners = half the teams, rounded up: 4 teams -> 2, 5 teams -> 3, 7 teams -> 4.
   Subclasses only decide the order:
     SopTrial        Level 1     SOP score (steps in the right place + 1 if the endless step is left out) + influence, ties random
     SplitBriefTrial Level 2     Split Brief score (0 to 5) + influence, ties by post-twist lock-in order then random
     MirrorTrial     Level 3     Presentation Day coordinator (lobby, setup crew, dance crew), attention score 0 to 7 + influence
     AutoTrial       Level 4     random whole number 0 to 7 + influence (placeholder until those mini-games exist)
   Light influence (Levels 1 to 4): 0.5 x (team's average in the tested attribute minus all teams' average).
     JudgedTrial     Levels 5-6  submissions to a prompt, then player Vote: points, then most first places, then random
   Rule code only. No screen code. Works in the browser and in Node. */
import { MirrorData } from "./mirrorData.js";
import { MirrorParts } from "./MirrorParts.js";
import { Rng } from "./Rng.js";
import { Scenarios } from "./scenarios.js";
import { Vote } from "./Vote.js";


class Trial {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.ranking = null;   // set by run(): [{ team, place, won, ...details }]
  }

  static winners(nTeams) { return Math.ceil(nTeams / 2); }

  /* Subclasses return [{ team, ...details }] best first. */
  rank(round, teams) { throw new Error("rank() is not written for this trial."); }

  /* Rank, mark the top half as winners (team.won), and return the ranked list. */
  run(round, teams) {
    if (this.ranking) throw new Error("This trial already ran.");
    const order = this.rank(round, teams);
    const w = Trial.winners(order.length);
    this.ranking = order.map((r, i) => {
      r.team.won = i < w;
      if (r.team.won) r.team.trialWins += 1;
      if (round && round.n) {
        if (!r.team.trialResults) r.team.trialResults = {};
        r.team.trialResults[round.n] = r.team.won;
      }
      return { ...r, place: i + 1, won: r.team.won };
    });
    return this.ranking;
  }

  /* Run the trial once for a round, recording completion on round.completed. */
  runTrial(round, teams) {
    if (round && round.completed) {
      if (round.completed.has("runTrial")) throw new Error("runTrial already ran this round.");
      round.completed.add("runTrial");
    }
    return this.run(round, teams);
  }

  /* Sort best first. keys: list of functions, higher is better. Full ties go by a random roll. */
  sortBy(entries, keys) {
    entries.forEach(e => { e.roll = this.rng(); });
    return entries.sort((a, b) => {
      for (const k of keys) { const d = k(b) - k(a); if (d) return d; }
      return a.roll - b.roll;
    });
  }

  /* Light influence (Levels 1 to 4): 0.5 x (team's average in the tested attribute,
     active players only, minus the average of all teams). Values count as 0 to 10.
     A team with no active players gets 0 and is left out of the all-teams average. */
  static influence(round, teams) {
    const avg = new Map();
    for (const t of teams) {
      const a = t.active();
      if (a.length) avg.set(t, a.reduce((s, p) => s + p.abilityValue(round.attr), 0) / a.length);
    }
    const vals = [...avg.values()];
    const all = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
    return new Map(teams.map(t => [t, avg.has(t) ? Trial.INFLUENCE * (avg.get(t) - all) : 0]));
  }

  /* Rank by base + influence. Ties random after any extraKeys. */
  rankWithInfluence(round, teams, baseOf, extraKeys = []) {
    const inf = Trial.influence(round, teams);
    const entries = teams.map(team => {
      const base = baseOf(team);
      return { team, base, influence: inf.get(team), score: base + inf.get(team) };
    });
    return this.sortBy(entries, [e => e.score, ...extraKeys]);
  }

  /* A random whole number from 0 to 7 (same range as the SOP score). */
  randomBase() { return Math.floor(this.rng() * (Trial.MAX_BASE + 1)); }

  /* The right trial for a round's level. */
  static forRound(round, rng) {
    if (round.trialKind === "sop") return new SopTrial(rng);
    if (round.trialKind === "splitBrief") return new SplitBriefTrial(rng);
    if (round.trialKind === "mirror") return new MirrorTrial(rng);
    if (round.trialKind === "judged") return new JudgedTrial(rng, round.n);
    return new AutoTrial(rng);
  }

  /* Save (Part 13): plain data, teams and players by id. */
  get kind() { return "auto"; }
  toJSON() {
    return { kind: this.kind, ranking: this.ranking ? this.ranking.map(r => ({ ...r, team: r.team.id })) : null };
  }
  /* Load. teams: the game's teams (the same array the game uses). byId: player id -> Player. */
  static fromJSON(data, { rng, teams, byId }) {
    const teamById = new Map(teams.map(t => [t.id, t]));
    let t;
    if (data.kind === "sop") {
      t = new SopTrial(rng);
      t.scores = new Map(data.scores.map(([id, s]) => [teamById.get(id), s]));
    } else if (data.kind === "splitBrief") {
      t = SplitBriefTrial.fromJSON(data, { rng, teams, byId });
    } else if (data.kind === "mirror") {
      t = MirrorTrial.fromJSON(data, { rng, teams, byId });
    } else if (data.kind === "judged") {
      t = new JudgedTrial(rng, data.level);
      t.prompt = data.prompt;
      t.writing = data.writing;
      t.submissions = new Map(data.submissions.map(([id, text]) => [byId.get(id), text]));
      if (data.vote) {
        const v = t.startVote(teams);
        v.ballots = new Map(data.vote.ballots.map(([id, ranking]) => [byId.get(id), ranking.map(r => byId.get(r))]));
      }
    } else {
      t = new AutoTrial(rng);
    }
    t.ranking = data.ranking ? data.ranking.map(r => ({ ...r, team: teamById.get(r.team) })) : null;
    return t;
  }
}

/* Level 1: the coffee SOP. */
class SopTrial extends Trial {
  constructor(rng) { super(rng); this.scores = new Map(); }

  static get MAX_SCORE() { return 7; }
  /* built: the team's steps in order. correct: the right order. endless: the step that should be left out.
     Placing nothing does not count as leaving the endless step out. */
  static score(built, correct, endless) {
    const right = correct.filter((t, i) => built[i] === t).length;
    const endlessOut = built.length > 0 && !built.includes(endless);
    return { right, endlessOut, score: right + (endlessOut ? 1 : 0) };
  }

  setScore(team, score) {
    if (this.ranking) throw new Error("The trial already ran.");
    this.scores.set(team, score);
  }
  setSopScore(team, score) { this.setScore(team, score); }

  /* Level 1 in one call: score the team's SOP board, then rank every team.
     built = the steps in board order. Returns { right, endlessOut, score, rank }. */
  scoreSop(team, built, steps, endless, round, teams) {
    const r = SopTrial.score(built, steps, endless);
    this.setSopScore(team, r.score);
    return { ...r, rank: this.runTrial(round, teams) };
  }

  /* The team's shared SOP board (Level 1): the steps in board order. Any active teammate can edit it. */
  static sopBoard(round, team) { return ((round && round.sopBoards) || {})[team.id] || []; }
  sopBoard(round, team) { return SopTrial.sopBoard(round, team); }

  setSopBoard(round, p, team, built) {
    const all = [...SopTrial.STEPS, SopTrial.ENDLESS];
    const closed = !!this.ranking || !!(round && round.completed && round.completed.has("runTrial"));
    const why = (closed ? "The SOP is closed." : null) ||
      (p.isStuck() ? "You are Stuck." : null) ||
      (!Array.isArray(built) || built.some(s => !all.includes(s)) || new Set(built).size !== built.length ? "Not a valid board." : null);
    if (why) return { ok: false, reason: why };
    round.sopBoards[team.id] = built.slice();
    return { ok: true };
  }

  /* The SOP timer ended (or the team submitted): every team with a player on it scores its board as it
     stands (placing nothing scores 0); bot-only teams get a random score. Then the trial ranks the teams.
     Results per team id: { right, endlessOut, score } in round.sopResults. */
  closeSop(round, teams) {
    round.sopResults = {};
    for (const t of teams) {
      if (!t.members.some(p => !p.isBot)) continue;
      const r = SopTrial.score(this.sopBoard(round, t), SopTrial.STEPS, SopTrial.ENDLESS);
      this.setSopScore(t, r.score);
      round.sopResults[t.id] = r;
    }
    return this.runTrial(round, teams);
  }

  /* Teams with no score yet (bot teams in the prototype) get a random score from 0 to 7. */
  rank(round, teams) {
    for (const t of teams) if (!this.scores.has(t)) this.scores.set(t, this.randomBase());
    return this.rankWithInfluence(round, teams, t => this.scores.get(t));
  }

  get kind() { return "sop"; }
  toJSON() { return { ...super.toJSON(), scores: [...this.scores].map(([team, s]) => [team.id, s]) }; }
}

/* The coffee SOP: the steps in the right order, and the endless step that should be left out. */
SopTrial.STEPS = ["Fill the reservoir with cold water", "Place a paper filter in the basket",
  "Add 2 tablespoons of ground coffee per cup", "Close the lid and press Start",
  "Wait until brewing finishes", "Pour into a mug and serve"];
SopTrial.ENDLESS = "Repeat step 1 until performance is satisfactory";

/* Levels 2-4 for now: random whole number 0 to 7 plus light influence. */
class AutoTrial extends Trial {
  rank(round, teams) { return this.rankWithInfluence(round, teams, () => this.randomBase()); }
}

function scenarioById(id) {
  return Object.values(Scenarios).find(s => s.id === id) || Scenarios.MEDLINE_SPRINT_1;
}

/* Level 2: Split Brief. Private cards dealt round-robin, team notes, shared 2-slot board,
   final Lock In, and Ghosted Teammate twist. */
class SplitBriefTrial extends Trial {
  #scenario;
  #teams = [];
  #dealt = false;
  #letterMap = {};           // original task id -> shuffled letter
  #cardOrder = [];           // card ids in shuffled deal order
  #deals = new Map();        // Player -> string[] card ids
  #notes = new Map();        // Team -> [{ posterId, posterName, text, order }]
  #notesUsed = new Map();    // Player -> number
  #boards = new Map();       // Team -> string[] task ids
  #lockOrder = new Map();    // Team -> number
  #lockCounter = 0;
  #lockedAfterTwist = new Set(); // Teams that locked in after the twist fired
  #twistHolders = new Map(); // Team -> Player
  #twistFired = false;
  #twistDeadline = null;

  constructor(rng, scenario = Scenarios.MEDLINE_SPRINT_1) {
    if (typeof rng !== "function") throw new Error("SplitBriefTrial requires a seeded rng.");
    super(rng);
    this.#scenario = scenario || Scenarios.MEDLINE_SPRINT_1;
    for (const t of this.#scenario.tasks) this.#letterMap[t.id] = t.id;
    this.#cardOrder = this.#scenario.cards.map(c => c.id);
    this.onAllLocked = null;
  }

  get kind() { return "splitBrief"; }
  get scenario() { return this.#scenario; }
  get dealt() { return this.#dealt; }
  get letterMap() { return { ...this.#letterMap }; }
  get cardOrder() { return this.#cardOrder.slice(); }
  get tasks() {
    return this.#scenario.tasks
      .map(t => ({ ...t, id: this.#mapLetter(t.id) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  get preTwistAnswer() { return this.#scenario.preTwistAnswer.map(id => this.#mapLetter(id)); }
  get postTwistAnswer() { return this.#scenario.postTwistAnswer.map(id => this.#mapLetter(id)); }
  get twistFired() { return this.#twistFired; }
  get twistDeadline() { return this.#twistDeadline; }
  setTwistDeadline(at) { this.#twistDeadline = at; }

  #shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  #teamOf(player) { return this.#teams.find(t => t.has(player)) || null; }
  #cardById(id) { return this.#scenario.cards.find(c => c.id === id) || null; }
  #mapLetter(id) { return this.#letterMap[id] || id; }
  #remapText(text) {
    if (typeof text !== "string") return text;
    return text.replace(/\(([A-Za-z0-9]+)\)/g, (m, id) => (this.#letterMap[id] ? "(" + this.#letterMap[id] + ")" : m));
  }
  #validTaskIds() { return new Set(this.tasks.map(t => t.id)); }

  #activeWhy(player, verb) {
    if (!player) return "Unknown player.";
    if (player.isStuck()) return "Stuck players cannot " + verb + ".";
    if (player.idle) return "Idle players cannot " + verb + ".";
    if (!player.isActive()) return "Only active players can " + verb + ".";
    return null;
  }

  #baseScore(team) {
    if (team.members.some(p => !p.isBot)) {
      return SplitBriefTrial.score(this.boardFor(team), this.postTwistAnswer);
    }
    return Math.floor(this.rng() * (SplitBriefTrial.MAX_SCORE + 1));
  }

  /* Shuffle task letters and card deal order, then deal round-robin to each team's active players. */
  deal(teams) {
    if (this.#dealt) throw new Error("Cards were already dealt.");
    this.#teams = teams.slice();
    this.#dealt = true;

    const origIds = this.#scenario.tasks.map(t => t.id);
    const shuffledLetters = this.#shuffle(origIds);
    this.#letterMap = {};
    origIds.forEach((orig, i) => { this.#letterMap[orig] = shuffledLetters[i]; });

    const cards = this.#shuffle(this.#scenario.cards);
    this.#cardOrder = cards.map(c => c.id);

    for (const team of this.#teams) {
      this.#boards.set(team, []);
      this.#notes.set(team, []);
      for (const p of team.members) {
        this.#deals.set(p, []);
        this.#notesUsed.set(p, 0);
      }
      const active = team.active();
      if (!active.length) continue;
      const seats = this.#shuffle(active);
      for (let i = 0; i < cards.length; i++) {
        this.#deals.get(seats[i % seats.length]).push(cards[i].id);
      }
    }
  }

  /* Private view: returns only the asking player's cards, with shuffled task letters applied. */
  cardsFor(player) {
    return (this.#deals.get(player) || []).map(id => {
      const c = this.#cardById(id);
      return { ...c, text: this.#remapText(c.text), botNote: this.#remapText(c.botNote) };
    });
  }

  /* Team notes: active players only, max 80 chars, non-empty, max 3 per player, allowed after Lock In. */
  postNote(player, text) {
    const team = this.#teamOf(player);
    const used = this.#notesUsed.get(player) || 0;
    const t = String(text == null ? "" : text).trim();
    const why = (this.ranking ? "The trial is closed." : null) ||
      (!team ? "Player is not in this trial." : null) ||
      this.#activeWhy(player, "post notes") ||
      (used >= SplitBriefTrial.MAX_NOTES ? "No notes left." : null) ||
      (!t ? "Write a note first." : null) ||
      (t.length > SplitBriefTrial.MAX_NOTE_CHARS
        ? "Note too long: " + t.length + " of " + SplitBriefTrial.MAX_NOTE_CHARS + " characters."
        : null);
    if (why) return { ok: false, reason: why };
    const list = this.#notes.get(team);
    const note = { posterId: player.id, posterName: player.name, text: t, order: list.length + 1 };
    list.push(note);
    this.#notesUsed.set(player, used + 1);
    return { ok: true, note: { ...note }, notesLeft: SplitBriefTrial.MAX_NOTES - (used + 1) };
  }

  notesLeft(player) {
    return Math.max(0, SplitBriefTrial.MAX_NOTES - (this.#notesUsed.get(player) || 0));
  }

  notesFor(team) {
    return (this.#notes.get(team) || []).map(n => ({ ...n }));
  }

  boardFor(team) {
    return (this.#boards.get(team) || []).slice();
  }

  /* Set team's ordered 0 to 2 task ids. Rejected after team Lock In. */
  setBoard(player, taskIds) {
    const team = this.#teamOf(player);
    const validIds = this.#validTaskIds();
    const why = (this.ranking ? "The trial is closed." : null) ||
      (!team ? "Player is not in this trial." : null) ||
      this.#activeWhy(player, "edit the board") ||
      (this.#lockOrder.has(team) ? "Your team already locked in." : null) ||
      (!Array.isArray(taskIds) ? "Not a valid board." : null) ||
      (taskIds.length > SplitBriefTrial.MAX_BOARD_TASKS
        ? "Pick at most " + SplitBriefTrial.MAX_BOARD_TASKS + " tasks."
        : null) ||
      (taskIds.some(id => !validIds.has(id)) ? "Not a valid task." : null) ||
      (new Set(taskIds).size !== taskIds.length ? "Duplicate tasks are not allowed." : null);
    if (why) return { ok: false, reason: why };
    this.#boards.set(team, taskIds.slice());
    return { ok: true, board: taskIds.slice() };
  }

  /* Any active teammate locks the team's board permanently, recording sequential lock order. */
  lockIn(player) {
    const team = this.#teamOf(player);
    const why = (this.ranking ? "The trial is closed." : null) ||
      (!team ? "Player is not in this trial." : null) ||
      this.#activeWhy(player, "lock in") ||
      (this.#lockOrder.has(team) ? "Your team already locked in." : null);
    if (why) return { ok: false, reason: why };
    this.#lockCounter += 1;
    this.#lockOrder.set(team, this.#lockCounter);
    const afterTwist = this.#twistFired;
    if (afterTwist) this.#lockedAfterTwist.add(team);
    const out = { ok: true, lockOrder: this.#lockCounter, afterTwist, board: this.boardFor(team) };
    if (this.allLocked() && this.onAllLocked) {
      this.onAllLocked();
      out.closed = true;
    }
    return out;
  }

  isLocked(team) { return this.#lockOrder.has(team); }
  lockOrderOf(team) { return this.#lockOrder.get(team) || null; }
  postTwistLockOrderOf(team) { return this.#lockedAfterTwist.has(team) ? this.#lockOrder.get(team) : null; }
  allLocked(teams = this.#teams) { return teams.length > 0 && teams.every(t => this.#lockOrder.has(t)); }

  /* Picks one random active player per team (including locked teams). Fires once only. */
  fireTwist(teams = this.#teams) {
    if (this.#twistFired || this.ranking) return false;
    this.#twistFired = true;
    for (const team of teams) {
      const active = team.active();
      if (!active.length) continue;
      const chosen = active[Math.floor(this.rng() * active.length)];
      this.#twistHolders.set(team, chosen);
    }
    return true;
  }

  #twistCard() {
    const t = this.#scenario.twist;
    return { ...t, text: this.#remapText(t.text), botNote: this.#remapText(t.botNote) };
  }

  /* Returns the twist card only for the chosen holder on each team, null for everyone else. */
  twistFor(player) {
    if (!this.#twistFired) return null;
    const team = this.#teamOf(player);
    if (team) return this.#twistHolders.get(team) === player ? this.#twistCard() : null;
    if (!this.#teams.length) {
      for (const holder of this.#twistHolders.values()) {
        if (holder === player) return this.#twistCard();
      }
    }
    return null;
  }

  /* Close the trial: fire the twist first if it has not fired yet, then run and rank. */
  closeSplitBrief(round, teams = this.#teams) {
    if (!this.#twistFired) this.fireTwist(teams);
    return this.runTrial(round, teams);
  }

  /* +2 per correct task picked, +1 if both tasks are correct and in exact order. Max 5; empty scores 0. */
  static score(board, answer = Scenarios.MEDLINE_SPRINT_1.postTwistAnswer) {
    if (!Array.isArray(board) || board.length === 0) return 0;
    const picked = [...new Set(board)].slice(0, SplitBriefTrial.MAX_BOARD_TASKS);
    const correct = picked.filter(id => answer.includes(id)).length;
    const exactOrder = picked.length === answer.length && answer.every((id, i) => picked[i] === id);
    return correct * 2 + (exactOrder ? 1 : 0);
  }

  /* Rank by score after influence, then earliest post-twist lock-in (pre-twist and unlocked teams
     have none and rank below), then random. */
  rank(round, teams) {
    const ranked = this.rankWithInfluence(
      round,
      teams,
      t => this.#baseScore(t),
      [
        e => (this.postTwistLockOrderOf(e.team) !== null ? 1 : 0),
        e => (this.postTwistLockOrderOf(e.team) !== null ? -this.postTwistLockOrderOf(e.team) : 0),
      ]
    );
    return ranked.map(e => ({
      ...e,
      lockOrder: this.#lockOrder.get(e.team) || null,
      postTwistLockOrder: this.postTwistLockOrderOf(e.team),
    }));
  }

  toJSON() {
    return {
      ...super.toJSON(),
      scenarioId: this.#scenario.id,
      dealt: this.#dealt,
      letterMap: { ...this.#letterMap },
      cardOrder: this.#cardOrder.slice(),
      teamIds: this.#teams.map(t => t.id),
      deals: [...this.#deals].map(([p, ids]) => [p.id, ids.slice()]),
      notes: [...this.#notes].map(([t, list]) => [t.id, list.map(n => ({ ...n }))]),
      notesUsed: [...this.#notesUsed].map(([p, n]) => [p.id, n]),
      boards: [...this.#boards].map(([t, ids]) => [t.id, ids.slice()]),
      lockOrder: [...this.#lockOrder].map(([t, n]) => [t.id, n]),
      lockCounter: this.#lockCounter,
      lockedAfterTwist: [...this.#lockedAfterTwist].map(t => t.id),
      twistHolders: [...this.#twistHolders].map(([t, p]) => [t.id, p.id]),
      twistFired: this.#twistFired,
      twistDeadline: this.#twistDeadline,
    };
  }

  static fromJSON(data, { rng, teams, byId, scenario } = {}) {
    const teamById = new Map(teams.map(t => [t.id, t]));
    const t = new SplitBriefTrial(rng, scenario || scenarioById(data.scenarioId));
    t.#dealt = !!data.dealt;
    if (data.letterMap) t.#letterMap = { ...data.letterMap };
    if (Array.isArray(data.cardOrder)) t.#cardOrder = data.cardOrder.slice();
    t.#teams = (data.teamIds || []).map(id => teamById.get(id)).filter(Boolean);
    t.#deals = new Map((data.deals || []).map(([id, cards]) => [byId.get(id), cards.slice()]));
    t.#notes = new Map((data.notes || []).map(([id, list]) => [teamById.get(id), list.map(n => ({ ...n }))]));
    t.#notesUsed = new Map((data.notesUsed || []).map(([id, n]) => [byId.get(id), n]));
    t.#boards = new Map((data.boards || []).map(([id, ids]) => [teamById.get(id), ids.slice()]));
    t.#lockOrder = new Map((data.lockOrder || []).map(([id, n]) => [teamById.get(id), n]));
    t.#lockCounter = data.lockCounter || 0;
    t.#lockedAfterTwist = new Set((data.lockedAfterTwist || []).map(id => teamById.get(id)).filter(Boolean));
    t.#twistHolders = new Map((data.twistHolders || []).map(([tId, pId]) => [teamById.get(tId), byId.get(pId)]));
    t.#twistFired = !!data.twistFired;
    t.#twistDeadline = data.twistDeadline ?? null;
    t.ranking = data.ranking ? data.ranking.map(r => ({ ...r, team: teamById.get(r.team) })) : null;
    return t;
  }
}

const mirrorIdOf = x => (x && typeof x === "object" ? x.id : x);
const MIRROR_SEED_MIX = 0x9E3779B9;

function deriveMirrorSeedRng(rng) {
  if (Rng.canSave(rng)) return Rng.seeded((rng.getState() ^ MIRROR_SEED_MIX) >>> 0);
  // Test-only 1-draw fallback for non-saveable RNGs; real games always use a saveable Rng.
  return Rng.seeded((Math.floor(rng() * 4294967296) ^ MIRROR_SEED_MIX) >>> 0);
}

/* Level 3: The Mirror: Presentation Day. Coordinates #lobby, #setup, and #dance.
   Outside code (Game, screens, bots) calls MirrorTrial only, never MirrorParts directly. */
class MirrorTrial extends Trial {
  #seedRng;
  #lobby;
  #setup;
  #dance;
  #teams = [];
  #teamIds = [];
  #phase = "idle";               // "idle" | "lobby" | "reveal" | "showtime" | "failed"
  #showtimeStartAt = null;
  #failedTeams = new Set();
  #failReasons = new Map();      // teamId -> "lobby" | "attention"
  #botOnlyTeams = new Set();
  #botAttention = new Map();     // teamId -> rolled 0..100 attention for bot-only teams
  #lockedAttention = new Map();  // teamId -> 0..100 attention frozen at wrap-up, attention 0, or close
  #crews = new Map();            // teamId -> { setupIds: [], danceIds: [] }

  constructor(rng, { seedRng = null } = {}) {
    if (typeof rng !== "function") throw new Error("MirrorTrial requires a seeded rng.");
    super(rng);
    this.#seedRng = typeof seedRng === "function" ? seedRng : deriveMirrorSeedRng(rng);
    this.#lobby = new MirrorParts.MirrorLobby(rng, null, { seedRng: this.#seedRng });
    this.#setup = new MirrorParts.SetupCrew(rng, null, { seedRng: this.#seedRng });
    this.#dance = new MirrorParts.DanceCrew(rng, null, { seedRng: this.#seedRng });
  }

  static get MAX_SCORE() { return MirrorData.scoring.maxScore; }

  /* Audience attention (0 to 100) -> whole score 0 to 7. */
  static score(attention) {
    const min = MirrorData.scoring.attentionMin;
    const max = MirrorData.scoring.attentionMax;
    const maxScore = MirrorData.scoring.maxScore;
    const raw = typeof attention === "number" && Number.isFinite(attention) ? attention : min;
    const clamped = Math.max(min, Math.min(max, raw));
    return Math.max(0, Math.min(maxScore, Math.round((clamped / max) * maxScore)));
  }

  get kind() { return "mirror"; }
  get phase() { return this.#phase; }
  get showtimeStartAt() { return this.#showtimeStartAt; }
  get lobbyStarted() { return this.#lobby.started; }
  get lobbyClosed() { return this.#lobby.closed; }
  get setupStarted() { return this.#setup.started; }
  get danceStarted() { return this.#dance.started; }

  /* Setup Crew gets half of connected active players rounded up, capped at 3. */
  static setupCrewSize(activeCount) {
    return MirrorParts.SetupCrew.crewSize(activeCount);
  }

  #shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  #showtimeWhy() {
    if (this.ranking) return "The trial is closed.";
    if (this.#phase !== "showtime") return "Showtime has not started.";
    return null;
  }

  #playerTeamId(playerOrId) {
    const ps = this.#lobby.playerState(playerOrId);
    return ps ? ps.teamId : null;
  }

  #teamShowtimeWhy(teamOrId) {
    const baseWhy = this.#showtimeWhy();
    if (baseWhy) return baseWhy;
    if (teamOrId !== null && teamOrId !== undefined) {
      const tid = mirrorIdOf(teamOrId);
      if (this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid)) {
        return "Team has already failed.";
      }
      if (this.#lockedAttention.has(tid)) {
        return "Team presentation has already finished.";
      }
    }
    return null;
  }

  #isBotOnly(team) {
    if (this.#botOnlyTeams.has(team.id)) return true;
    return !this.#lobby.started && Array.isArray(team.members) && team.members.length > 0 && team.members.every(p => p.isBot);
  }

  #ensureBotAttention(teamId) {
    if (!this.#botAttention.has(teamId)) {
      const min = MirrorData.scoring.attentionMin;
      const max = MirrorData.scoring.attentionMax;
      this.#botAttention.set(teamId, min + Math.floor(this.rng() * (max - min + 1)));
    }
    return this.#botAttention.get(teamId);
  }

  #lockTeamAttention(tid, showtimeSecondsLeft) {
    const min = MirrorData.scoring.attentionMin;
    if (this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid)) {
      const reason = this.#lobby.isTeamFailed(tid) ? "lobby" : (this.#failReasons.get(tid) || "attention");
      this.#failedTeams.add(tid);
      this.#failReasons.set(tid, reason);
      this.#lockedAttention.set(tid, min);
      return { teamId: tid, attention: min, score: 0, failed: true, failReason: reason };
    }
    if (this.#lockedAttention.has(tid)) {
      const att = this.#lockedAttention.get(tid);
      const failed = att <= min;
      return {
        teamId: tid,
        attention: att,
        score: MirrorTrial.score(att),
        failed,
        failReason: this.#failReasons.get(tid) || (failed ? "attention" : null),
      };
    }
    const att = this.attentionFor(tid, showtimeSecondsLeft);
    this.#lockedAttention.set(tid, att);
    const failed = att <= min;
    if (failed) {
      this.#failedTeams.add(tid);
      this.#failReasons.set(tid, "attention");
    }
    return {
      teamId: tid,
      attention: att,
      score: MirrorTrial.score(att),
      failed,
      failReason: failed ? "attention" : null,
    };
  }

  #resolveTeamResult(team) {
    const tid = team.id;
    const min = MirrorData.scoring.attentionMin;
    const botOnly = this.#isBotOnly(team);
    if (this.#lobby.isTeamFailed(tid)) {
      return { attention: min, base: 0, failed: true, failReason: "lobby", botOnly };
    }
    if (this.#failedTeams.has(tid)) {
      return {
        attention: min,
        base: 0,
        failed: true,
        failReason: this.#failReasons.get(tid) || "attention",
        botOnly,
      };
    }
    if (botOnly) {
      const att = this.#ensureBotAttention(tid);
      const failed = att <= min;
      return {
        attention: att,
        base: MirrorTrial.score(att),
        failed,
        failReason: failed ? "attention" : null,
        botOnly: true,
      };
    }
    let att;
    if (this.#lockedAttention.has(tid)) att = this.#lockedAttention.get(tid);
    else if (this.#phase === "showtime") att = this.attentionFor(tid, 0);
    else att = min;
    const failed = att <= min;
    return {
      attention: att,
      base: MirrorTrial.score(att),
      failed,
      failReason: failed ? "attention" : null,
      botOnly: false,
    };
  }

  startLobby(teams) {
    if (this.#lobby.started) throw new Error("Mirror lobby already started.");
    this.#teams = teams.slice();
    this.#teamIds = this.#teams.map(t => t.id);
    this.#botOnlyTeams = new Set(
      this.#teams.filter(t => t.members.length > 0 && t.members.every(p => p.isBot)).map(t => t.id)
    );
    this.#botAttention.clear();
    this.#lockedAttention.clear();
    this.#failReasons.clear();
    this.#phase = "lobby";
    return this.#lobby.start(this.#teams);
  }

  connect(playerId) { return this.#lobby.connect(playerId); }
  miss(playerId) { return this.#lobby.miss(playerId); }
  lobbyState() { return this.#lobby.state(); }
  lobbyTeamState(teamOrId) { return this.#lobby.teamState(teamOrId); }
  lobbyPlayerState(playerOrId) { return this.#lobby.playerState(playerOrId); }
  lobbyCursorStart(playerOrId) { return this.#lobby.cursorStartOf(playerOrId); }
  botConnectTimes(teamOrId = null) { return this.#lobby.botConnectTimes(teamOrId); }
  botConnectTimeOf(playerId) { return this.#lobby.botConnectTimeOf(playerId); }
  allConnected() { return this.#lobby.allConnected(); }

  /* Close lobby doors, fail incomplete teams, deal Setup vs Dance crews, and start SetupCrew + DanceCrew. */
  closeDoors() {
    const res = this.#lobby.closeDoors();
    if (res.alreadyClosed) return { ...res, phase: this.#phase, crews: this.allCrews() };
    for (const teamId of res.failedTeams) {
      this.#failedTeams.add(teamId);
      this.#failReasons.set(teamId, "lobby");
    }
    for (const teamId of res.passedTeams) {
      const pool = this.#shuffle(this.#lobby.connectedIds(teamId));
      const setupCount = MirrorTrial.setupCrewSize(pool.length);
      this.#crews.set(teamId, { setupIds: pool.slice(0, setupCount), danceIds: pool.slice(setupCount) });
    }
    if (res.passedTeams.length > 0) {
      const setupDeals = res.passedTeams.map(teamId => {
        const deal = this.#crews.get(teamId);
        return {
          teamId,
          players: deal.setupIds.map(pid => this.#lobby.playerState(pid)),
          danceIds: deal.danceIds.slice(),
        };
      });
      this.#setup.start(setupDeals, { shuffleSlots: false });
      this.#dance.start(this.#setup, {
        playerLookup: pid => this.#lobby.playerState(pid),
      });
    }
    this.#phase = res.passedTeams.length > 0 ? "reveal" : "failed";
    return { ...res, phase: this.#phase, crews: this.allCrews() };
  }

  startShowtime({ now = null } = {}) {
    if (this.#phase === "showtime") return { ok: false, alreadyStarted: true, phase: this.#phase };
    if (this.#phase !== "reveal") throw new Error("Showtime can only start after crew reveal.");
    const min = MirrorData.scoring.attentionMin;
    const max = MirrorData.scoring.attentionMax;
    for (const teamId of this.#teamIds) {
      if (!this.#failedTeams.has(teamId) && this.#botOnlyTeams.has(teamId)) {
        this.#botAttention.set(teamId, min + Math.floor(this.rng() * (max - min + 1)));
      }
    }
    this.#showtimeStartAt = typeof now === "number" && Number.isFinite(now) ? now : null;
    this.#setup.beginShowtime(this.#showtimeStartAt);
    this.#dance.beginShowtime(this.#showtimeStartAt);
    this.#phase = "showtime";
    return { ok: true, phase: this.#phase, setup: this.#setup.state(), dance: this.#dance.state() };
  }

  nextCable(teamOrId) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#setup.nextCable(teamOrId);
  }
  returnCable(teamOrId, port) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#setup.returnCable(teamOrId, port);
  }
  cableHit(playerId, port, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.cableHit(playerId, port, opts);
  }
  cableMiss(playerId, port, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.cableMiss(playerId, port, opts);
  }
  nextSoundSpike(teamOrId) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#setup.nextSoundSpike(teamOrId);
  }
  nextSoundJitter(teamOrId) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#setup.nextSoundJitter(teamOrId);
  }
  soundAdjust(playerId, delta, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.soundAdjust(playerId, delta, opts);
  }
  soundHeld(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.soundHeld(playerId, opts);
  }
  soundFeedback(playerId) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.soundFeedback(playerId);
  }
  micTap(playerId, micNumber, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.micTap(playerId, micNumber, opts);
  }
  pickFile(playerId, fileIndexOrName, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.pickFile(playerId, fileIndexOrName, opts);
  }
  reshuffleDeck(teamOrId, opts) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#setup.reshuffleDeck(teamOrId, opts);
  }
  nextSetupDeadline(teamOrId, opts = {}) {
    const tid = mirrorIdOf(teamOrId);
    if (this.#teamShowtimeWhy(tid) || this.#botOnlyTeams.has(tid)) return null;
    return this.#setup.nextDeadline(tid, opts);
  }
  tickSetup(teamOrId, now, opts = {}) {
    const tid = mirrorIdOf(teamOrId);
    const why = this.#teamShowtimeWhy(tid) || (this.#botOnlyTeams.has(tid) ? "Bot-only team." : null);
    return why ? { ok: false, reason: why } : this.#setup.tickDeadlines(tid, now, opts);
  }
  nextShowtimeEventAt(teamOrId, { showStart, activeHumanIds = null, autoPilotIds = null, now = null, includeBots = false } = {}) {
    const tid = mirrorIdOf(teamOrId);
    if (this.#teamShowtimeWhy(tid) || this.#botOnlyTeams.has(tid)) return null;
    let earliest = Infinity;
    const setupDue = this.nextSetupDeadline(tid, { activeHumanIds, now });
    if (setupDue !== null && setupDue < earliest) earliest = setupDue;
    const danceDue = this.nextDanceDeadline(tid, { activeHumanIds });
    if (danceDue !== null && danceDue < earliest) earliest = danceDue;
    if (includeBots && typeof showStart === "number" && Number.isFinite(showStart)) {
      const autoSet = autoPilotIds instanceof Set
        ? autoPilotIds
        : new Set(Array.isArray(autoPilotIds) ? autoPilotIds : []);
      const curPid = this.#setup.currentPlayerId(tid);
      const botSetupSec = this.#setup.botStepDueAt(tid, { autoPilot: curPid !== null && autoSet.has(curPid) });
      if (botSetupSec !== null) {
        const at = showStart + Math.round(botSetupSec * 1000);
        if (at < earliest) earliest = at;
      }
      const boostCap = MirrorData.dance.boostCap;
      for (const d of this.#dance.dancersFor(tid)) {
        if ((!d.isBot && !autoSet.has(d.playerId)) || d.boost >= boostCap || d.nextBotBoostAt === null) continue;
        const at = showStart + Math.round(d.nextBotBoostAt * 1000);
        if (at < earliest) earliest = at;
      }
    }
    return Number.isFinite(earliest) ? earliest : null;
  }
  setupViewFor(teamOrId, now = null) {
    return this.#setup.setupViewFor(teamOrId, now);
  }
  answerQa(playerId, answerIndex, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.answerQa(playerId, answerIndex, opts);
  }
  timeoutQa(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#setup.timeoutQa(playerId, opts);
  }
  wrapUp(playerId, opts = {}) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    if (why) return { ok: false, reason: why };
    const res = this.#setup.wrapUp(playerId);
    if (res.ok && !this.#botOnlyTeams.has(res.teamId)) {
      let sec = null;
      if (typeof opts.showtimeSecondsLeft === "number" && Number.isFinite(opts.showtimeSecondsLeft)) {
        sec = opts.showtimeSecondsLeft;
      } else if (typeof opts.elapsedSeconds === "number" && Number.isFinite(opts.elapsedSeconds)) {
        sec = MirrorData.timers.showtimeSeconds - opts.elapsedSeconds;
      }
      if (sec !== null) {
        const locked = this.#lockTeamAttention(res.teamId, sec);
        return {
          ...res,
          attention: locked.attention,
          score: locked.score,
          failed: locked.failed,
          failReason: locked.failReason,
        };
      }
    }
    return res;
  }
  completeBotSetupStep(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    if (why) return { ok: false, reason: why };
    const res = this.#setup.completeBotStep(playerId, opts);
    if (res.ok && res.wrappedUp && !this.#botOnlyTeams.has(res.teamId)) {
      const secLeft = MirrorData.timers.showtimeSeconds - res.finishedAt;
      const locked = this.#lockTeamAttention(res.teamId, secLeft);
      return {
        ...res,
        attention: locked.attention,
        score: locked.score,
        failed: locked.failed,
        failReason: locked.failReason,
      };
    }
    return res;
  }
  advanceBotSetup(teamOrId, elapsedSeconds, opts) {
    const why = this.#teamShowtimeWhy(teamOrId);
    if (why) return { ok: false, reason: why };
    const res = this.#setup.advanceBotSetup(teamOrId, elapsedSeconds, opts);
    if (res.ok && res.wrappedUp && !this.#botOnlyTeams.has(res.teamId) && !this.#lockedAttention.has(res.teamId)) {
      const wrapEv = res.events ? res.events.find(e => e.wrappedUp) : null;
      const finishedAt = wrapEv && typeof wrapEv.finishedAt === "number" ? wrapEv.finishedAt : elapsedSeconds;
      const secLeft = MirrorData.timers.showtimeSeconds - finishedAt;
      const locked = this.#lockTeamAttention(res.teamId, secLeft);
      return {
        ...res,
        attention: locked.attention,
        score: locked.score,
        failed: locked.failed,
        failReason: locked.failReason,
      };
    }
    return res;
  }

  dancePress(playerId, dir, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#dance.press(playerId, dir, opts);
  }
  nextDanceDeadline(teamOrId, opts = {}) {
    const tid = mirrorIdOf(teamOrId);
    if (this.#teamShowtimeWhy(tid) || this.#botOnlyTeams.has(tid)) return null;
    return this.#dance.nextDeadline(tid, opts);
  }
  tickDance(teamOrId, now, opts = {}) {
    const tid = mirrorIdOf(teamOrId);
    const why = this.#teamShowtimeWhy(tid) || (this.#botOnlyTeams.has(tid) ? "Bot-only team." : null);
    return why ? { ok: false, reason: why } : this.#dance.tickDeadlines(tid, now, opts);
  }
  danceViewFor(playerOrId, now = null) {
    return this.#dance.danceViewFor(playerOrId, now);
  }
  danceHit(playerId, quality, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#dance.noteHit(playerId, quality, opts);
  }
  danceMiss(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#dance.noteMiss(playerId, opts);
  }
  danceStray(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#dance.strayPress(playerId, opts);
  }
  applyBotDanceBoost(playerId, opts) {
    const why = this.#teamShowtimeWhy(this.#playerTeamId(playerId));
    return why ? { ok: false, reason: why } : this.#dance.applyBotBoost(playerId, opts);
  }
  advanceBotDance(teamOrId, elapsedSeconds, opts) {
    const why = this.#teamShowtimeWhy(teamOrId);
    return why ? { ok: false, reason: why } : this.#dance.advanceBotDance(teamOrId, elapsedSeconds, opts);
  }

  setupSlots(teamOrId) { return this.#setup.slotsFor(teamOrId); }
  setupSlotOf(playerOrId) { return this.#setup.slotOf(playerOrId); }
  setupStep(teamOrId) { return this.#setup.currentStep(teamOrId); }
  setupCurrentPlayerId(teamOrId) { return this.#setup.currentPlayerId(teamOrId); }
  isSetupTurn(playerOrId) { return this.#setup.isPlayersTurn(playerOrId); }
  isSetupWrappedUp(teamOrId) { return this.#setup.isWrappedUp(teamOrId); }
  setupPenalties(teamOrId) { return this.#setup.penaltiesFor(teamOrId); }
  micSequenceFor(teamOrId) { return this.#setup.micSequenceFor(teamOrId); }
  deckOrderFor(teamOrId) { return this.#setup.deckOrderFor(teamOrId); }
  qaOrderFor(teamOrId) { return this.#setup.qaOrderFor(teamOrId); }
  currentQaFor(teamOrId) { return this.#setup.currentQaFor(teamOrId); }
  botSetupDueAt(teamOrId, opts) { return this.#setup.botStepDueAt(teamOrId, opts); }
  setupTeamState(teamOrId) { return this.#setup.teamState(teamOrId); }
  setupState() { return this.#setup.state(); }

  dancersFor(teamOrId) { return this.#dance.dancersFor(teamOrId); }
  dancerIdsFor(teamOrId) { return this.#dance.dancerIdsFor(teamOrId); }
  dancerState(playerOrId) { return this.#dance.dancerState(playerOrId); }
  danceBoostFor(teamOrId) { return this.#dance.avgBoostFor(teamOrId); }
  dancePenaltiesFor(teamOrId) { return this.#dance.avgPenaltiesFor(teamOrId); }
  botDanceNextAt(playerOrId) { return this.#dance.botNextBoostAt(playerOrId); }
  botDanceNextsFor(teamOrId = null) { return this.#dance.botNextBoostsFor(teamOrId); }
  danceTeamState(teamOrId) { return this.#dance.teamState(teamOrId); }
  danceState() { return this.#dance.state(); }
  isBotOnlyTeam(teamOrId) { return this.#botOnlyTeams.has(mirrorIdOf(teamOrId)); }
  botAttentionFor(teamOrId) {
    const tid = mirrorIdOf(teamOrId);
    return this.#botAttention.has(tid) ? this.#botAttention.get(tid) : null;
  }

  /* Current team attention (0..100). Attention drains only during showtime, never in lobby/reveal. */
  attentionFor(teamOrId, showtimeSecondsLeft = MirrorData.timers.showtimeSeconds) {
    const tid = mirrorIdOf(teamOrId);
    if (this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid)) return MirrorData.scoring.attentionMin;
    if (this.#lockedAttention.has(tid)) return this.#lockedAttention.get(tid);
    if (this.#phase !== "showtime") return MirrorData.scoring.attentionMax;
    if (this.#botOnlyTeams.has(tid)) {
      return this.#botAttention.has(tid) ? this.#botAttention.get(tid) : MirrorData.scoring.attentionMin;
    }
    const maxSec = MirrorData.timers.showtimeSeconds;
    const sec = typeof showtimeSecondsLeft === "number" && Number.isFinite(showtimeSecondsLeft)
      ? Math.max(0, Math.min(maxSec, showtimeSecondsLeft))
      : maxSec;
    const base = (sec / maxSec) * MirrorData.scoring.attentionMax;
    const raw = base + this.#dance.avgBoostFor(tid) - this.#setup.penaltiesFor(tid) - this.#dance.avgPenaltiesFor(tid);
    return Math.max(MirrorData.scoring.attentionMin, Math.min(MirrorData.scoring.attentionMax, raw));
  }

  scoreFor(teamOrId, showtimeSecondsLeft = MirrorData.timers.showtimeSeconds) {
    return MirrorTrial.score(this.attentionFor(teamOrId, showtimeSecondsLeft));
  }

  lockedAttentionFor(teamOrId) {
    const tid = mirrorIdOf(teamOrId);
    return this.#lockedAttention.has(tid) ? this.#lockedAttention.get(tid) : null;
  }

  failReasonOf(teamOrId) {
    const tid = mirrorIdOf(teamOrId);
    return this.#lobby.isTeamFailed(tid) ? "lobby" : (this.#failReasons.get(tid) || null);
  }

  /* Check if showtime attention has hit 0 and lock the failure on that team. */
  checkAttention(teamOrId, showtimeSecondsLeft = MirrorData.timers.showtimeSeconds) {
    const tid = mirrorIdOf(teamOrId);
    if (this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid)) {
      const reason = this.#lobby.isTeamFailed(tid) ? "lobby" : (this.#failReasons.get(tid) || "attention");
      return {
        teamId: tid,
        attention: MirrorData.scoring.attentionMin,
        score: 0,
        failed: true,
        failReason: reason,
        locked: true,
      };
    }
    if (this.#lockedAttention.has(tid)) {
      const att = this.#lockedAttention.get(tid);
      const failed = att <= MirrorData.scoring.attentionMin;
      return {
        teamId: tid,
        attention: att,
        score: MirrorTrial.score(att),
        failed,
        failReason: this.#failReasons.get(tid) || (failed ? "attention" : null),
        locked: true,
      };
    }
    const att = this.attentionFor(tid, showtimeSecondsLeft);
    if (this.#phase === "showtime" && !this.#botOnlyTeams.has(tid) && att <= MirrorData.scoring.attentionMin) {
      const res = this.#lockTeamAttention(tid, showtimeSecondsLeft);
      return { ...res, locked: true };
    }
    return {
      teamId: tid,
      attention: att,
      score: MirrorTrial.score(att),
      failed: false,
      failReason: null,
      locked: false,
    };
  }

  /* Lock a team's final attention and 0..7 score during showtime. */
  finishTeam(teamOrId, showtimeSecondsLeft = 0) {
    if (this.ranking) return { ok: false, reason: "The trial is closed." };
    const tid = mirrorIdOf(teamOrId);
    if (this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid)) {
      return { ok: true, ...this.#lockTeamAttention(tid, 0) };
    }
    if (this.#phase !== "showtime") return { ok: false, reason: "Showtime has not started." };
    if (this.#botOnlyTeams.has(tid)) {
      const att = this.#ensureBotAttention(tid);
      const failed = att <= MirrorData.scoring.attentionMin;
      return {
        ok: true,
        teamId: tid,
        attention: att,
        score: MirrorTrial.score(att),
        failed,
        failReason: failed ? "attention" : null,
      };
    }
    return { ok: true, ...this.#lockTeamAttention(tid, showtimeSecondsLeft) };
  }

  /* Finalize all remaining teams and rank the round with Focus influence and exact-attention tiebreaks. */
  closeMirror(round, teams = this.#teams, { showtimeSecondsLeft = 0 } = {}) {
    if (this.#lobby.started && !this.#lobby.closed) this.closeDoors();
    if (this.#phase === "reveal") this.startShowtime();
    const list = teams && teams.length ? teams : this.#teams;
    for (const t of list) {
      if (this.#lobby.isTeamFailed(t.id) || this.#failedTeams.has(t.id)) {
        this.#lockTeamAttention(t.id, 0);
      } else if (this.#isBotOnly(t)) {
        this.#ensureBotAttention(t.id);
      } else if (!this.#lockedAttention.has(t.id) && this.#phase === "showtime") {
        this.#lockTeamAttention(t.id, showtimeSecondsLeft);
      }
    }
    const ranking = this.runTrial(round, list);
    if (round) {
      round.mirrorResults = {};
      for (const r of ranking) {
        round.mirrorResults[r.team.id] = {
          attention: r.attention,
          score: r.base,
          failed: r.failed,
          failReason: r.failReason,
          botOnly: r.botOnly,
        };
      }
    }
    return ranking;
  }

  /* Rank by 0..7 score + light Focus influence, then higher exact attention, then Rng. */
  rank(round, teams = this.#teams) {
    const list = teams && teams.length ? teams : this.#teams;
    const byTeam = new Map(list.map(t => [t, this.#resolveTeamResult(t)]));
    const ranked = this.rankWithInfluence(
      round,
      list,
      t => byTeam.get(t).base,
      [e => byTeam.get(e.team).attention]
    );
    return ranked.map(e => {
      const info = byTeam.get(e.team);
      return {
        ...e,
        attention: info.attention,
        failed: info.failed,
        failReason: info.failReason,
        botOnly: info.botOnly,
      };
    });
  }

  isTeamFailed(teamOrId) {
    const tid = mirrorIdOf(teamOrId);
    return this.#lobby.isTeamFailed(tid) || this.#failedTeams.has(tid);
  }
  failedTeamIds() {
    return [...new Set([...this.#lobby.failedTeamIds(), ...this.#failedTeams])];
  }

  crewFor(teamOrId) {
    const d = this.#crews.get(mirrorIdOf(teamOrId));
    return d ? { setupIds: d.setupIds.slice(), danceIds: d.danceIds.slice() } : null;
  }

  allCrews() {
    return [...this.#crews].map(([teamId, d]) => ({
      teamId,
      setupIds: d.setupIds.slice(),
      danceIds: d.danceIds.slice(),
    }));
  }

  roleOf(playerOrId) {
    const pid = mirrorIdOf(playerOrId);
    for (const deal of this.#crews.values()) {
      if (deal.setupIds.includes(pid)) return "setup";
      if (deal.danceIds.includes(pid)) return "dance";
    }
    return null;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      seedRngState: Rng.canSave(this.#seedRng) ? this.#seedRng.getState() : null,
      phase: this.#phase,
      showtimeStartAt: this.#showtimeStartAt,
      teamIds: this.#teamIds.slice(),
      lobby: this.#lobby.toJSON(),
      setup: this.#setup.toJSON(),
      dance: this.#dance.toJSON(),
      failedTeams: [...this.#failedTeams],
      failReasons: [...this.#failReasons],
      botOnlyTeams: [...this.#botOnlyTeams],
      botAttention: [...this.#botAttention],
      lockedAttention: [...this.#lockedAttention],
      crews: [...this.#crews].map(([teamId, deal]) => [
        teamId,
        { setupIds: deal.setupIds.slice(), danceIds: deal.danceIds.slice() },
      ]),
    };
  }

  static fromJSON(data, { rng, teams = [] } = {}) {
    if (typeof rng !== "function") throw new Error("MirrorTrial requires a seeded rng.");
    const teamById = new Map(teams.map(t => [t.id, t]));
    const savedSeedState = typeof data.seedRngState === "number"
      ? data.seedRngState
      : (data.setup && typeof data.setup.seedRngState === "number"
        ? data.setup.seedRngState
        : (data.lobby && typeof data.lobby.seedRngState === "number" ? data.lobby.seedRngState : null));
    let seedRng;
    if (savedSeedState !== null) {
      seedRng = Rng.seeded(0);
      seedRng.setState(savedSeedState);
    } else {
      seedRng = deriveMirrorSeedRng(rng);
    }
    const t = new MirrorTrial(rng, { seedRng });
    t.#phase = data.phase || "idle";
    t.#showtimeStartAt = typeof data.showtimeStartAt === "number" ? data.showtimeStartAt : null;
    t.#teamIds = (data.teamIds || []).slice();
    t.#teams = t.#teamIds.map(id => teamById.get(id)).filter(Boolean);
    if (data.lobby) t.#lobby = MirrorParts.MirrorLobby.fromJSON(data.lobby, { rng, seedRng });
    if (data.setup) {
      t.#setup = MirrorParts.SetupCrew.fromJSON(data.setup, { rng, seedRng });
      if (t.#setup.showtimeStartAt === null && t.#showtimeStartAt !== null) {
        t.#setup.beginShowtime(t.#showtimeStartAt);
      }
    }
    if (data.dance) {
      t.#dance = MirrorParts.DanceCrew.fromJSON(data.dance, { rng, seedRng });
      if (t.#dance.showtimeStartAt === null && t.#showtimeStartAt !== null) {
        t.#dance.beginShowtime(t.#showtimeStartAt);
      }
    }
    t.#failedTeams = new Set(data.failedTeams || []);
    t.#failReasons = new Map(data.failReasons || []);
    t.#botOnlyTeams = new Set(data.botOnlyTeams || []);
    t.#botAttention = new Map(data.botAttention || []);
    t.#lockedAttention = new Map(data.lockedAttention || []);
    t.#crews = new Map((data.crews || []).map(([teamId, deal]) => [
      teamId,
      {
        setupIds: (deal.setupIds || []).slice(),
        danceIds: (deal.danceIds || []).slice(),
      },
    ]));
    t.ranking = data.ranking ? data.ranking.map(r => ({ ...r, team: teamById.get(r.team) })) : null;
    return t;
  }
}

/* Levels 5-6 prompts. Fixed, reviewed list (placeholders; the team may change them). */
const PROMPTS = {
  5: [
    "Halfway through the sprint, you find a bug that breaks the main feature. Fix it now or finish the planned work first? Why?",
    "A teammate keeps missing standups and their tasks are falling behind. What do you do first?",
    "The client changed a requirement after you built it. How do you respond?",
    "Two teammates disagree on a fix and work has stopped. How do you get it moving?",
    "Your code passed testing, but a teammate says it is hard to read. Rewrite it or move on? Why?",
    "A task will take twice as long as planned. What do you tell the client?",
    "You find a mistake in work a teammate already marked done. How do you raise it?",
    "The backlog has more fixes than time. How do you decide what to drop?",
    "A fix you made broke something else. What is your next step?",
    "Your team hits the same problem every sprint. What one change would you make?",
  ],
  6: [
    "The deadline is tomorrow and one feature is not done. Cut it or ask for more time? Why?",
    "You have five minutes to demo to the client. What do you show first?",
    "The client asks for one more feature the day before delivery. What do you say?",
    "The product works but the documentation is thin. What is the minimum you write before handoff?",
    "A teammate wants to keep polishing. The rest want to ship. How do you decide?",
    "Final testing finds a small bug most users will never see. Ship or fix? Why?",
    "What one thing should the client know before using what you built?",
    "Your team finished a day early. How should you use the extra time?",
    "The client dislikes the final design, but it matches what they approved. How do you handle it?",
    "What would your team do differently on the next project?",
  ],
};

/* Levels 5-6: submissions, then a player vote.
   Order: prompt (host picks or writes one; no host = random) > startWriting > submit* > closeWriting
   (closes early when every active player has submitted) > startVote > cast* > run().
   A player with no submission cannot be ranked, but can still vote. */
class JudgedTrial extends Trial {
  constructor(rng, level = null) {
    super(rng);
    this.level = level;
    this.vote = null;
    this.prompt = null;          // { level, index, text, custom }
    this.writing = null;         // null (not started), "open", "closed"
    this.submissions = new Map();   // player -> text
  }

  static prompts(level) { return PROMPTS[level] || []; }

  /* Host picks from the list. */
  choosePrompt(index) {
    const list = JudgedTrial.prompts(this.level);
    const why = this.writing ? "Writing already started." :
      !(Number.isInteger(index) && index >= 0 && index < list.length) ? "Pick a prompt from the list." : null;
    if (why) return { ok: false, reason: why };
    this.prompt = { level: this.level, index, text: list[index], custom: false };
    return { ok: true, prompt: this.prompt };
  }
  /* Host types a custom prompt (1 to 200 characters). It is not added to the list. */
  customPrompt(text) {
    const t = String(text || "").trim();
    const why = this.writing ? "Writing already started." : !t ? "Type a prompt first." :
      t.length > JudgedTrial.MAX_PROMPT_CHARS ? "Prompt too long: " + t.length + " of " + JudgedTrial.MAX_PROMPT_CHARS + " characters." : null;
    if (why) return { ok: false, reason: why };
    this.prompt = { level: this.level, index: null, text: t, custom: true };
    return { ok: true, prompt: this.prompt };
  }
  /* No host: the engine picks one at random. */
  randomPrompt() {
    const list = JudgedTrial.prompts(this.level);
    const index = Math.floor(this.rng() * list.length);
    this.prompt = { level: this.level, index, text: list[index], custom: false };
    return this.prompt;
  }

  /* Levels 5-6, host only: a list number (0 to 9) or custom text. */
  setPrompt(choice, host = true) {
    if (!host) return { ok: false, reason: "No host. The engine picks the prompt." };
    return typeof choice === "number" ? this.choosePrompt(choice) : this.customPrompt(choice);
  }
  /* Opens writing. No host: the engine picks a prompt at random. */
  startWriting({ host = false, prompts = null } = {}) {
    if (this.writing) throw new Error("Writing already started.");
    if (!this.prompt) {
      if (host) throw new Error("The host picks a prompt first.");
      this.randomPrompt();
    }
    this.writing = "open";
    if (prompts) prompts.push({ ...this.prompt });
    return this.prompt;
  }
  /* Submission length check for the writing box. */
  static typeSubmission(pOrText, text) {
    const s = typeof pOrText === "object" && pOrText !== null ? text : pOrText;
    const n = String(s || "").trim().length, max = JudgedTrial.MAX_CHARS;
    return { length: n, left: max - n, tooLong: n > max };
  }
  typeSubmission(pOrText, text) { return JudgedTrial.typeSubmission(pOrText, text); }
  /* One submission per player, 1 to 300 characters. Stuck players do not write.
     Writing closes early when every active player has submitted. */
  submit(p, text, { players = null, submissions = null } = {}) {
    const t = String(text == null ? "" : text).trim();
    const why = this.writing !== "open" ? (this.writing ? "Writing is closed." : "Writing has not started.") :
      p.isStuck() ? "Stuck players do not write." :
      this.submissions.has(p) ? "You already submitted." :
      !t ? "Write something first." :
      t.length > JudgedTrial.MAX_CHARS ? "Too long: " + t.length + " of " + JudgedTrial.MAX_CHARS + " characters." : null;
    if (why) return { ok: false, reason: why };
    this.submissions.set(p, t);
    const r = { ok: true, text: t };
    if (players && this.allSubmitted(players)) {
      this.closeWriting(submissions);
      r.closed = true;
    }
    return r;
  }
  closeWriting(submissions = null) {
    if (this.writing !== "open") return false;
    this.writing = "closed";
    if (submissions) {
      for (const [p, text] of this.submissions) submissions.push({ level: this.level, name: p.name, text });
    }
    return true;
  }
  allSubmitted(players) { return players.filter(p => p.isActive()).every(p => this.submissions.has(p)); }   // idle players are not waited for

  /* With submissions in use, only players who submitted can be ranked. */
  startVote(teams) {
    if (this.writing === "open") throw new Error("Writing is still open. Close it first (closeWriting).");
    if (this.level !== null && !this.writing) throw new Error("Writing has not started (startWriting).");
    if (!this.vote) {
      const canBeRanked = this.writing ? (p => this.submissions.has(p)) : null;
      this.vote = new Vote(teams, this.rng, canBeRanked);
    }
    return this.vote;
  }
  rank(round, teams) {
    const vote = this.startVote(teams);
    return vote.tally().map(r => ({ team: r.team, total: r.total, active: r.active, voters: r.voters, score: r.score, firsts: r.firsts }));
  }

  get kind() { return "judged"; }
  toJSON() {
    return { ...super.toJSON(), level: this.level, prompt: this.prompt, writing: this.writing,
      submissions: [...this.submissions].map(([p, text]) => [p.id, text]),
      vote: this.vote ? { ballots: [...this.vote.ballots].map(([v, ranking]) => [v.id, ranking.map(p => p.id)]) } : null };
  }
}

Trial.INFLUENCE = 0.5;
Trial.MAX_BASE = 7;
SplitBriefTrial.MAX_NOTE_CHARS = 80;
SplitBriefTrial.MAX_NOTES = 3;
SplitBriefTrial.MAX_BOARD_TASKS = 2;
SplitBriefTrial.MAX_SCORE = 5;
SplitBriefTrial.TRIAL_SECONDS = 180;
SplitBriefTrial.TWIST_SECONDS = 90;
MirrorTrial.LOBBY_SECONDS = MirrorData.timers.lobbySeconds;
MirrorTrial.REVEAL_SECONDS = MirrorData.timers.revealSeconds;
MirrorTrial.SHOWTIME_SECONDS = MirrorData.timers.showtimeSeconds;
JudgedTrial.MAX_CHARS = 300;          // submission length
JudgedTrial.MAX_PROMPT_CHARS = 200;   // custom host prompt length
JudgedTrial.WRITING_SECONDS = 180;    // writing timer: 3 minutes
JudgedTrial.BOT_ANSWER = "Bot answer";
Trial.SopTrial = SopTrial;
Trial.AutoTrial = AutoTrial;
Trial.SplitBriefTrial = SplitBriefTrial;
Trial.MirrorTrial = MirrorTrial;
Trial.JudgedTrial = JudgedTrial;

export { Trial };
