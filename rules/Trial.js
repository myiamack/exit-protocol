/* Trial: ranks the teams for one round. Top half win.
   Every trial takes the round and the teams and returns a ranked list (best first).
   Winners = half the teams, rounded up: 4 teams -> 2, 5 teams -> 3, 7 teams -> 4.
   Subclasses only decide the order:
     SopTrial    Level 1     SOP score (steps in the right place + 1 if the endless step is left out) + influence, ties random
     AutoTrial   Levels 2-4  random whole number 0 to 7 + influence (placeholder until those mini-games exist)
   Light influence (Levels 1 to 4): 0.5 x (team's average in the tested attribute minus all teams' average).
     JudgedTrial Levels 5-6  submissions to a prompt, then player Vote: points, then most first places, then random
   Rule code only. No screen code. Works in the browser and in Node. */
(function (root) {
  const EP = root.EP || (root.EP = {});

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
        return { ...r, place: i + 1, won: r.team.won };
      });
      return this.ranking;
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

    /* Rank by base + influence. Ties random. */
    rankWithInfluence(round, teams, baseOf) {
      const inf = Trial.influence(round, teams);
      const entries = teams.map(team => {
        const base = baseOf(team);
        return { team, base, influence: inf.get(team), score: base + inf.get(team) };
      });
      return this.sortBy(entries, [e => e.score]);
    }

    /* A random whole number from 0 to 7 (same range as the SOP score). */
    randomBase() { return Math.floor(this.rng() * (Trial.MAX_BASE + 1)); }

    /* The right trial for a round's level. */
    static forRound(round, rng) {
      if (round.trialKind === "sop") return new SopTrial(rng);
      if (round.trialKind === "judged") return new JudgedTrial(rng, round.n);
      return new AutoTrial(rng);
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

    /* Teams with no score yet (bot teams in the prototype) get a random score from 0 to 7. */
    rank(round, teams) {
      for (const t of teams) if (!this.scores.has(t)) this.scores.set(t, this.randomBase());
      return this.rankWithInfluence(round, teams, t => this.scores.get(t));
    }
  }

  /* Levels 2-4 for now: random whole number 0 to 7 plus light influence. */
  class AutoTrial extends Trial {
    rank(round, teams) { return this.rankWithInfluence(round, teams, () => this.randomBase()); }
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

    startWriting() {
      if (this.writing) throw new Error("Writing already started.");
      if (!this.prompt) throw new Error("No prompt yet.");
      this.writing = "open";
    }
    /* One submission per player, 1 to 300 characters. Stuck players do not write. */
    submit(p, text) {
      const t = String(text == null ? "" : text).trim();
      const why = this.writing !== "open" ? (this.writing ? "Writing is closed." : "Writing has not started.") :
        p.isStuck() ? "Stuck players do not write." :
        this.submissions.has(p) ? "You already submitted." :
        !t ? "Write something first." :
        t.length > JudgedTrial.MAX_CHARS ? "Too long: " + t.length + " of " + JudgedTrial.MAX_CHARS + " characters." : null;
      if (why) return { ok: false, reason: why };
      this.submissions.set(p, t);
      return { ok: true, text: t };
    }
    closeWriting() { if (this.writing === "open") this.writing = "closed"; }
    allSubmitted(players) { return players.filter(p => !p.isStuck()).every(p => this.submissions.has(p)); }

    /* With submissions in use, only players who submitted can be ranked. */
    startVote(teams) {
      if (!this.vote) {
        const canBeRanked = this.writing ? (p => this.submissions.has(p)) : null;
        this.vote = new EP.Vote(teams, this.rng, canBeRanked);
      }
      return this.vote;
    }
    rank(round, teams) {
      const vote = this.startVote(teams);
      return vote.tally().map(r => ({ team: r.team, total: r.total, active: r.active, voters: r.voters, score: r.score, firsts: r.firsts }));
    }
  }

  Trial.INFLUENCE = 0.5;
  Trial.MAX_BASE = 7;
  JudgedTrial.MAX_CHARS = 300;          // submission length
  JudgedTrial.MAX_PROMPT_CHARS = 200;   // custom host prompt length
  JudgedTrial.WRITING_SECONDS = 180;    // writing timer: 3 minutes
  JudgedTrial.BOT_ANSWER = "Bot answer";
  Trial.SopTrial = SopTrial;
  Trial.AutoTrial = AutoTrial;
  Trial.JudgedTrial = JudgedTrial;
  EP.Trial = Trial;
  if (typeof module !== "undefined" && module.exports) module.exports = Trial;
})(typeof globalThis !== "undefined" ? globalThis : this);
