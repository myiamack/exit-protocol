/* Bot brains for the prototype and the test script. Not a rule class.
   Same assumptions as Tests/sim_v2.py. */
import { CharacterType } from "./CharacterType.js";
import { Economy } from "./Economy.js";
import { Game } from "./Game.js";
import { Gift } from "./Gift.js";
import { Player } from "./Player.js";
import { Sabotage } from "./Sabotage.js";
import { Team } from "./Team.js";
import { Trial } from "./Trial.js";

const KEYS = () => Player.KEYS;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

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

  /* Game hooks for the prototype (Part 13): bots act at the same moments the screen code used to call them.
     beforeClose: bot Contrarians sabotage as Open Floor ends; bots accuse as the Glitch Report ends.
     onStart: bots gift when the gift window opens; place points when Stats Update or Graduation opens.
     Pass as new Game({ ..., hooks: Bots.hooks }) or Game.fromJSON(data, { hooks: Bots.hooks }). */
  hooks: {
    beforeClose(game, name) {
      if (name === "openFloor") Bots.openFloor(game, game.rng);
      else if (name === "glitchReport") Bots.accusations(game, game.rng);
    },
    onStart(game, name) {
      if (name === "giftWindow") Bots.gifts(game, game.rng);
      else if (name === "statsUpdate") Bots.statsUpdate(game);
      else if (name === "graduation") Bots.graduation(game);
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
