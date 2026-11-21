/* Bot brains for the prototype and the test script. Not a rule class.
   Same assumptions as Tests/sim_v2.py. */
import { CharacterType } from "./CharacterType.js";
import { Economy } from "./Economy.js";
import { Game } from "./Game.js";
import { Gift } from "./Gift.js";
import { MirrorData } from "./mirrorData.js";
import { Player } from "./Player.js";
import { Sabotage } from "./Sabotage.js";
import { Team } from "./Team.js";
import { Trial } from "./Trial.js";

const KEYS = () => Player.KEYS;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const SPLIT_CARD_WINDOW_MS = 30000;
const SPLIT_TWIST_WINDOW_MS = 10000;

/* Deterministic 32-bit FNV-1a + Murmur3 mix for bot note timing (no Math.random, no Rng draws). */
function hashInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function splitDealSignature(game, trial) {
  return game.teams
    .map(t => t.members.map(m => m.id + ":" + trial.cardsFor(m).map(c => c.id).join(",")).join(";"))
    .join("|");
}

function splitTrialStart(game, trial) {
  if (game.timer && game.timer.name === "splitBrief") {
    return game.timer.deadline - Trial.SplitBriefTrial.TRIAL_SECONDS * 1000;
  }
  if (trial.twistDeadline != null) {
    return trial.twistDeadline - Trial.SplitBriefTrial.TWIST_SECONDS * 1000;
  }
  return null;
}

const Bots = {
  SETTINGS: { sabotageRate: 0.5, victimAccuses: 0.9, otherAccuses: 0.25, idleAccuses: 0.05,
              pickSaboteur: 1 / 3, giftRate: { coop: 1, indep: 0.25, contra: 0.25 }, acceptGifts: 0.8 },

  /* Typical build: 5/4/3/2/1, bonus attributes first, penalty last. */
  typicalSpend(type) {
    const t = CharacterType.get(type);
    const others = KEYS().filter(k => !t.bonus.includes(k) && k !== t.penalty);
    const order = [...t.bonus, ...others, t.penalty];
    const spend = {};
    order.forEach((k, i) => { spend[k] = [5, 4, 3, 2, 1][i]; });
    return spend;
  },
  makePlayer(id, name, type) {
    return new Player({ id, name, type, spend: Bots.typicalSpend(type), isBot: true });
  },

  /* Solo prototype lobby: 16 players, 8 Cooperative, 5 Independent, 3 Contrarian. You take one slot of your type.
     me = { name, type, spend }. myTeam = { name, mates: [bot names] }. others = [{ name, players: [bot names] }].
     Returns { game, me, team }. */
  SOLO_MIX: { coop: 8, indep: 5, contra: 3 },
  soloGame({ me, myTeam, others, rng = Math.random, hooks = {} }) {
    const you = new Player({ id: 0, name: me.name, type: me.type, spend: me.spend });
    const pool = [];
    for (const [k, n] of Object.entries(Bots.SOLO_MIX)) for (let i = 0; i < n; i++) pool.push(k);
    pool.splice(pool.indexOf(you.type.key), 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let id = 1;
    const mk = n => Bots.makePlayer(id++, n, pool.pop());
    const team = new Team({ id: 0, name: myTeam.name, members: [you, ...myTeam.mates.map(mk)] });
    const rest = others.map((o, i) => new Team({ id: i + 1, name: o.name, members: o.players.map(mk) }));
    return { game: new Game({ teams: [team, ...rest], rng, hooks }), me: you, team };
  },

  /* Open Floor: Contrarian bots sabotage 50% of rounds, once, At risk teammates first. */
  openFloor(game, rng) {
    for (const team of game.teams) {
      for (const p of team.members) {
        if (!p.isBot || !p.type.canSabotage() || p.isStuck() || p.sabotageBlockedThisRound || p.wasCaughtBy(team.id)) continue;
        if (!p.hearts.has(Sabotage.cost(p))) continue;
        if (rng() >= Bots.SETTINGS.sabotageRate) continue;
        const targets = team.mates(p).filter(q => !q.isStuck());
        if (!targets.length) continue;
        const risky = targets.filter(q => q.isAtRisk());
        game.sabotage(p, pick(risky.length ? risky : targets, rng));
      }
    }
  },

  /* Trial: on judged levels bots submit "Bot answer" and vote, then the trial ranks the teams (top half win).
     Bot teams get a random SOP score on Level 1; Levels 2-4 are a random order. */
  trial(game, rng) {
    if (game.round.trial instanceof Trial.JudgedTrial) {
      game.startWriting();
      Bots.submit(game);
      game.closeWriting();
      Bots.vote(game, game.startVote(), rng);
    }
    return game.runTrial();
  },

  /* Levels 5-6: every active bot submits the text "Bot answer" so tests still run the vote. */
  submit(game) {
    const jt = game.round.trial;
    for (const p of game.players) {
      if (!p.isBot || p.isStuck() || jt.submissions.has(p) || jt.writing !== "open") continue;
      game.submit(p, Trial.JudgedTrial.BOT_ANSWER);
    }
  },

  /* Glitch Report: victim accuses 90%, other teammates 25%, no sabotage 5%. */
  accusations(game, rng) {
    const S = Bots.SETTINGS;
    for (const team of game.teams) {
      const actors = game.round.saboteurs().filter(a => team.has(a));
      for (const p of team.members) {
        if (!p.isBot || p.isStuck()) continue;
        const chance = actors.length ? (p.wasSabotagedThisRound ? S.victimAccuses : S.otherAccuses) : S.idleAccuses;
        if (rng() >= chance) continue;
        const mates = team.mates(p);
        const guilty = mates.filter(q => actors.includes(q));
        const innocent = mates.filter(q => !actors.includes(q));
        let target;
        if (guilty.length && rng() < S.pickSaboteur) target = pick(guilty, rng);
        else target = innocent.length ? pick(innocent, rng) : pick(guilty, rng);
        game.accuse(p, target);
      }
    }
  },

  /* Gift window: Cooperative bots always gift if they can; others 25%. 2 if affordable, else 1.
     Bots do not gift to Independents (it would be refused), or to a teammate who already has a
     gift waiting for an answer. A bot receiver answers at once. */
  gifts(game, rng) {
    for (const team of game.teams) {
      for (const r of team.members) {
        if (r.isStuck() || !r.isGlitchingAny() || !r.type.canAcceptGifts()) continue;
        for (const g of team.mates(r)) {
          if (!g.isBot || g.isStuck() || !r.isGlitchingAny()) continue;
          if (Gift.pending(game.round).some(x => x.receiver === r)) continue;
          const rate = Bots.SETTINGS.giftRate[g.type.key];   // Cooperative always, others 25%
          if (rate < 1 && rng() >= rate) continue;
          const pts = g.hearts.has(Gift.cost(g, 2)) ? 2 : g.hearts.has(Gift.cost(g, 1)) ? 1 : 0;
          if (!pts) continue;
          const res = game.gift(g, r, pts);
          if (res.ok && r.isBot) Bots.answer(game, res.gift, rng);
        }
      }
    }
  },

  /* Bots accept 80% of gifts. Pass a seeded rng in tests so results repeat. */
  answer(game, gift, rng) {
    if (gift.status !== "pending" || !gift.receiver.isBot) return null;
    return game.answerGift(gift, rng() < Bots.SETTINGS.acceptGifts);
  },
  answerAll(game, rng) {
    for (const g of Gift.pending(game.round)) Bots.answer(game, g, rng);
  },

  /* Stats Update: Independents Cash Out at the first chance, then place points. */
  statsUpdate(game) {
    for (const p of game.players) {
      if (!p.isBot || p.isStuck()) continue;
      if (p.canCashOut()) game.cashOut(p);
      p.earned = Math.min(p.earned, p.roomLeft());
      p.placePoints(Bots.allocate(p, p.earned, false));
    }
  },

  /* Round 7: raise any attribute below 2 first, then the usual way. */
  graduation(game) {
    for (const p of game.players) {
      if (!p.isBot || p.isStuck()) continue;
      p.placePoints(Bots.allocate(p, p.earned, true));
    }
  },

  /* Typical placement: every other point to the lowest bonus attribute, else the lowest open one. */
  allocate(p, n, final) { return Economy.allocate(p, n, final); },

  /* Level 2 (Split Brief): bots post accurate card notes in 0-30s and twist note within 10s of twist,
     keeping 1 note in reserve until the twist fires. After the twist fires, any bot (ghosted or not)
     may use its reserved note, still capped at MAX_NOTES (3) per player. Bots never edit the board or lock in. */
  splitBrief(game, now = game.now()) {
    if (game.step !== "trial" || game.didRun("runTrial")) return;
    const trial = game.round && game.round.trial;
    if (!(trial instanceof Trial.SplitBriefTrial) || !trial.dealt || trial.ranking) return;
    const startAt = splitTrialStart(game, trial);
    if (startAt == null) return;
    const sig = splitDealSignature(game, trial);
    const twistAt = trial.twistDeadline != null ? trial.twistDeadline : startAt + Trial.SplitBriefTrial.TWIST_SECONDS * 1000;
    const reserveCount = Trial.SplitBriefTrial.MAX_NOTES - 1;

    for (const team of game.teams) {
      const posted = new Set(trial.notesFor(team).map(n => n.posterId + "\n" + n.text));
      const events = [];

      team.members.forEach((p, memberIndex) => {
        if (!p.isBot || !p.isActive()) return;
        const twist = trial.twistFor(p);
        const twistAtNote = trial.twistFired && twist
          ? twistAt + (hashInt(sig + "|" + game.level + "|" + p.id + "|twist") % (SPLIT_TWIST_WINDOW_MS + 1))
          : null;

        if (twistAtNote != null && !posted.has(p.id + "\n" + twist.botNote)) {
          events.push({ p, memberIndex, at: twistAtNote, kindOrder: 0, cardIndex: -1, text: twist.botNote, isTwist: true });
        }

        const cards = trial.cardsFor(p).map((c, cardIndex) => ({
          card: c,
          cardIndex,
          at: startAt + (hashInt(sig + "|" + game.level + "|" + p.id + "|" + c.id) % (SPLIT_CARD_WINDOW_MS + 1)),
        })).sort((a, b) => a.at - b.at || a.cardIndex - b.cardIndex);

        cards.forEach((item, rank) => {
          if (posted.has(p.id + "\n" + item.card.botNote)) return;
          let postAt = item.at;
          if (rank >= reserveCount) {
            if (!trial.twistFired) return;
            postAt = Math.max(postAt, twistAtNote != null ? twistAtNote : twistAt);
          }
          events.push({ p, memberIndex, at: postAt, kindOrder: 1, cardIndex: item.cardIndex, text: item.card.botNote, isTwist: false });
        });
      });

      events.sort((a, b) => a.at - b.at || a.kindOrder - b.kindOrder || a.memberIndex - b.memberIndex || a.cardIndex - b.cardIndex);

      for (const ev of events) {
        if (now < ev.at) continue;
        if (posted.has(ev.p.id + "\n" + ev.text)) continue;
        if (trial.notesLeft(ev.p) <= 0) continue;
        if (!ev.isTwist) {
          const twist = trial.twistFor(ev.p);
          const needsTwistSlot = !trial.twistFired || (twist && !posted.has(ev.p.id + "\n" + twist.botNote));
          if (needsTwistSlot && trial.notesLeft(ev.p) <= 1) continue;
        }
        const res = trial.postNote(ev.p, ev.text);
        if (res.ok) posted.add(ev.p.id + "\n" + ev.text);
      }
    }
  },

  /* Level 3 (The Mirror: Presentation Day): bots connect at 3-15s in lobby, bot setup steps run
     on schedule with 30% hiccups (-3 attention) and auto wrap-up, bot dancers boost +1 every
     1.5-2.5s up to 45 with no misses, bot-only teams keep their seeded random 0-100 attention,
     and idle humans follow the same bot behavior as auto-pilot. Calls MirrorTrial and Game only. */
  mirror(game, now = game.now()) {
    if (game.step !== "trial" || game.didRun("runTrial")) return;
    const trial = game.round && game.round.trial;
    if (!(trial instanceof Trial.MirrorTrial) || trial.ranking) return;

    if (trial.phase === "lobby") {
      const elapsed = game.mirrorLobbyElapsed(now);
      if (elapsed === null) return;
      const dueBots = trial.botConnectTimes()
        .filter(e => e.seconds <= elapsed)
        .sort((a, b) => a.seconds - b.seconds || a.playerId - b.playerId);
      for (const entry of dueBots) {
        if (trial.phase !== "lobby" || game.didRun("runTrial")) return;
        const st = trial.lobbyPlayerState(entry.playerId);
        if (!st || st.connected) continue;
        game.mirrorConnect(entry.playerId);
      }
      for (const team of game.teams) {
        for (const p of team.members) {
          if (trial.phase !== "lobby" || game.didRun("runTrial")) return;
          if (p.isBot || p.isStuck() || !p.idle) continue;
          const st = trial.lobbyPlayerState(p.id);
          if (!st || st.connected) continue;
          game.mirrorConnect(p.id);
        }
      }
      return;
    }

    if (trial.phase !== "showtime") return;
    const elapsed = game.mirrorShowtimeElapsed(now);
    if (elapsed === null) return;

    const maxSec = Trial.MirrorTrial.SHOWTIME_SECONDS;
    const boostCap = MirrorData.dance.boostCap;
    const activeTeams = () => game.teams.filter(
      team => !trial.isBotOnlyTeam(team) && !trial.isTeamFailed(team) && trial.lockedAttentionFor(team) === null
    );
    const autoIdsFor = team => new Set(
      team.members.filter(p => !p.isBot && !p.isStuck() && p.idle).map(p => p.id)
    );

    // Prime newly idle human dancers so DanceCrew assigns their nextBotBoostAt via seeded Rng.
    for (const team of activeTeams()) {
      const autoIds = autoIdsFor(team);
      if (!autoIds.size) continue;
      const needsPrime = trial.dancersFor(team).some(
        d => !d.isBot && autoIds.has(d.playerId) && d.boost < boostCap && d.nextBotBoostAt === null
      );
      if (needsPrime) trial.advanceBotDance(team, 0, { autoPilotIds: autoIds });
    }

    // Advance all active teams in strict chronological order so Rng draws match regardless of tick size.
    const maxIter = Math.max(1000, game.players.length * 100);
    let guard = 0;
    while (trial.phase === "showtime" && !trial.ranking && !game.didRun("runTrial")) {
      if (++guard > maxIter) throw new Error("Mirror bot loop.");
      let nextAt = Infinity;
      const teams = activeTeams();
      const autoByTeam = new Map();

      for (const team of teams) {
        const autoIds = autoIdsFor(team);
        autoByTeam.set(team.id, autoIds);
        for (const d of trial.dancersFor(team)) {
          if ((!d.isBot && !autoIds.has(d.playerId)) || d.boost >= boostCap || d.nextBotBoostAt === null) continue;
          if (d.nextBotBoostAt <= elapsed && d.nextBotBoostAt < nextAt) nextAt = d.nextBotBoostAt;
        }
        const curPid = trial.setupCurrentPlayerId(team);
        const setupDue = trial.botSetupDueAt(team, { autoPilot: curPid !== null && autoIds.has(curPid) });
        if (setupDue !== null && setupDue <= elapsed && setupDue < nextAt) nextAt = setupDue;
      }

      if (!Number.isFinite(nextAt)) break;

      const secLeftAt = Math.max(0, maxSec - nextAt);
      for (const team of teams) {
        if (trial.isTeamFailed(team) || trial.lockedAttentionFor(team) !== null) continue;
        const autoIds = autoByTeam.get(team.id);
        const preAtt = trial.checkAttention(team, secLeftAt);
        if (preAtt.failed) continue;

        const hasDanceDue = trial.dancersFor(team).some(
          d => (d.isBot || autoIds.has(d.playerId)) && d.boost < boostCap && d.nextBotBoostAt !== null && d.nextBotBoostAt <= nextAt
        );
        if (hasDanceDue) trial.advanceBotDance(team, nextAt, { autoPilotIds: autoIds });

        const curPid = trial.setupCurrentPlayerId(team);
        const setupDue = trial.botSetupDueAt(team, { autoPilot: curPid !== null && autoIds.has(curPid) });
        if (setupDue !== null && setupDue <= nextAt) {
          trial.advanceBotSetup(team, nextAt, { autoPilotIds: autoIds });
          if (trial.lockedAttentionFor(team) === null && !trial.isTeamFailed(team)) {
            trial.checkAttention(team, secLeftAt);
          }
        }
      }
    }
  },

  /* Game hooks for the prototype (Part 13): bots act at the same moments the screen code used to call them.
     beforeClose: bot Contrarians sabotage as Open Floor ends; bots accuse as the Glitch Report ends;
       Split Brief bots post any due notes before the trial closes; Mirror bots finish any due connect/setup/dance.
     onStart: Split Brief and Mirror initialize/process bot actions; bots gift when the gift window opens;
       place points when Stats Update or Graduation opens.
     onTick: Split Brief and Mirror bots advance scheduled actions as time passes.
     Pass as new Game({ ..., hooks: Bots.hooks }) or Game.fromJSON(data, { hooks: Bots.hooks }). */
  hooks: {
    beforeClose(game, name) {
      if (name === "openFloor") Bots.openFloor(game, game.rng);
      else if (name === "glitchReport") Bots.accusations(game, game.rng);
      else if (name === "splitBrief") Bots.splitBrief(game, game.now());
      else if (name === "mirrorLobby" || name === "mirrorShowtime") Bots.mirror(game, game.now());
    },
    onStart(game, name) {
      if (name === "splitBrief") Bots.splitBrief(game, game.now());
      else if (name === "mirrorLobby" || name === "mirrorShowtime") Bots.mirror(game, game.now());
      else if (name === "giftWindow") Bots.gifts(game, game.rng);
      else if (name === "statsUpdate") Bots.statsUpdate(game);
      else if (name === "graduation") Bots.graduation(game);
    },
    onTick(game, now) {
      Bots.splitBrief(game, now);
      Bots.mirror(game, now);
    },
  },

  /* Bot votes: rank 3 players from other teams at random. */
  vote(game, vote, rng) {
    for (const p of game.players) {
      if (!p.isBot || p.isStuck()) continue;
      const pool = vote.choicesFor(p).slice();
      const ranking = [];
      while (ranking.length < 3 && pool.length) ranking.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      vote.cast(p, ranking);
    }
  }
};

export { Bots };
