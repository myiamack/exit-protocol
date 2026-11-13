/* Bot brains for the prototype and the test script. Not a rule class.
   Same assumptions as Tests/sim_v2.py. */
(function (root) {
  const EP = root.EP || (root.EP = {});
  const KEYS = () => EP.Player.KEYS;
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  const Bots = {
    SETTINGS: { sabotageRate: 0.5, victimAccuses: 0.9, otherAccuses: 0.25, idleAccuses: 0.05,
                pickSaboteur: 1 / 3, nonCoopGifts: 0.25, trialWinRate: 0.5 },

    /* Typical build: 5/4/3/2/1, bonus attributes first, penalty last. */
    typicalSpend(type) {
      const t = EP.Player.TYPES[type];
      const others = KEYS().filter(k => !t.bonus.includes(k) && k !== t.pen);
      const order = [...t.bonus, ...others, t.pen];
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
          if (!p.isBot || p.type !== "contra" || p.isStuck() || p.sabotageLocked) continue;
          if (p.backup < EP.Sabotage.cost(p)) continue;
          if (rng() >= Bots.SETTINGS.sabotageRate) continue;
          const targets = team.mates(p).filter(q => !q.isStuck());
          if (!targets.length) continue;
          const risky = targets.filter(q => q.isAtRisk());
          game.sabotage(p, pick(risky.length ? risky : targets, rng));
        }
      }
    },

    /* Trial: random result for any team that has none yet. */
    trial(game, rng) {
      for (const t of game.teams) if (t.won === null) game.setTrialResult(t, rng() < Bots.SETTINGS.trialWinRate);
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
      game.endGlitchReport();
    },

    /* Gift window: Cooperative bots always gift if they can; others 25%. 2 if affordable, else 1.
       Bots do not gift to Independents (it would be refused). */
    gifts(game, rng) {
      for (const team of game.teams) {
        for (const r of team.members) {
          if (r.isStuck() || !r.isGlitching() || r.type === "indep") continue;
          for (const g of team.mates(r)) {
            if (!g.isBot || g.isStuck() || !r.isGlitching()) continue;
            if (g.type !== "coop" && rng() >= Bots.SETTINGS.nonCoopGifts) continue;
            const pts = g.backup >= EP.Gift.cost(g, 2) ? 2 : g.backup >= EP.Gift.cost(g, 1) ? 1 : 0;
            if (pts) game.gift(g, r, pts);
          }
        }
      }
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
        if (i % 2 === 0) { const b = p.typeInfo.bonus.filter(k => a[k] < p.max(k)); if (b.length) pool = b; }
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
