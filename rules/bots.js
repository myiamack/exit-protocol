/* Bot brains for the prototype and the test script. Not a rule class.
   Same assumptions as Tests/sim_v2.py. */
(function (root) {
  const EP = root.EP || (root.EP = {});
  const KEYS = () => EP.Player.KEYS;
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  const Bots = {
    SETTINGS: { sabotageRate: 0.5, victimAccuses: 0.9, otherAccuses: 0.25, idleAccuses: 0.05,
                pickSaboteur: 1 / 3, giftRate: { coop: 1, indep: 0.25, contra: 0.25 }, acceptGifts: 0.8 },

    /* Typical build: 5/4/3/2/1, bonus attributes first, penalty last. */
    typicalSpend(type) {
      const t = EP.CharacterType.get(type);
      const others = KEYS().filter(k => !t.bonus.includes(k) && k !== t.penalty);
      const order = [...t.bonus, ...others, t.penalty];
      const spend = {};
      order.forEach((k, i) => { spend[k] = [5, 4, 3, 2, 1][i]; });
      return spend;
    },
    makePlayer(id, name, type) {
      return new EP.Player({ id, name, type, spend: Bots.typicalSpend(type), isBot: true });
    },

    /* Open Floor: Contrarian bots sabotage 50% of rounds, once, At risk teammates first. */
    openFloor(game, rng) {
      for (const team of game.teams) {
        for (const p of team.members) {
          if (!p.isBot || !p.type.canSabotage() || p.isStuck() || p.sabotageBlockedThisRound || p.wasCaughtBy(team.id)) continue;
          if (!p.hearts.has(EP.Sabotage.cost(p))) continue;
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
      if (game.round.trial instanceof EP.Trial.JudgedTrial) {
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
        game.submit(p, EP.Trial.JudgedTrial.BOT_ANSWER);
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
          if (r.isStuck() || !r.isGlitching() || !r.type.canAcceptGifts()) continue;
          for (const g of team.mates(r)) {
            if (!g.isBot || g.isStuck() || !r.isGlitching()) continue;
            if (EP.Gift.pending(game.round).some(x => x.receiver === r)) continue;
            const rate = Bots.SETTINGS.giftRate[g.type.key];   // Cooperative always, others 25%
            if (rate < 1 && rng() >= rate) continue;
            const pts = g.hearts.has(EP.Gift.cost(g, 2)) ? 2 : g.hearts.has(EP.Gift.cost(g, 1)) ? 1 : 0;
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
      for (const g of EP.Gift.pending(game.round)) Bots.answer(game, g, rng);
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
    allocate(p, n, final) {
      const a = { ...p.attrs }, alloc = {};
      const add = k => { a[k] += 1; alloc[k] = (alloc[k] || 0) + 1; n -= 1; };
      if (final) for (const k of KEYS()) while (a[k] < 2 && n > 0 && a[k] < p.max(k)) add(k);
      let i = 0;
      while (n > 0) {
        const open = KEYS().filter(k => a[k] < p.max(k));
        if (!open.length) break;
        let pool = open;
        if (i % 2 === 0) { const b = p.type.bonus.filter(k => a[k] < p.max(k)); if (b.length) pool = b; }
        add(pool.reduce((m, k) => (a[k] < a[m] ? k : m), pool[0]));
        i += 1;
      }
      return alloc;
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

  EP.Bots = Bots;
  if (typeof module !== "undefined" && module.exports) module.exports = Bots;
})(typeof globalThis !== "undefined" ? globalThis : this);
