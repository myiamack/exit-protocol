/* Trial: ranks the teams for one round. Top half win.
   Every trial takes the round and the teams and returns a ranked list (best first).
   Winners = half the teams, rounded up: 4 teams -> 2, 5 teams -> 3, 7 teams -> 4.
   Subclasses only decide the order:
     SopTrial    Level 1     SOP score (steps in the right place + 1 if the endless step is left out) + influence, ties random
     AutoTrial   Levels 2-4  random whole number 0 to 7 + influence (placeholder until those mini-games exist)
   Light influence (Levels 1 to 4): 0.5 x (team's average in the tested attribute minus all teams' average).
     JudgedTrial Levels 5-6  player Vote: points, then most first places, then random
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
      if (round.trialKind === "judged") return new JudgedTrial(rng);
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

  /* Levels 5-6: players vote. Cast ballots on .vote, then run(). */
  class JudgedTrial extends Trial {
    constructor(rng) { super(rng); this.vote = null; }
    startVote(teams) { if (!this.vote) this.vote = new EP.Vote(teams, this.rng); return this.vote; }
    rank(round, teams) {
      const vote = this.startVote(teams);
      return vote.tally().map(r => ({ team: r.team, total: r.total, active: r.active, score: r.score, firsts: r.firsts }));
    }
  }

  Trial.INFLUENCE = 0.5;
  Trial.MAX_BASE = 7;
  Trial.SopTrial = SopTrial;
  Trial.AutoTrial = AutoTrial;
  Trial.JudgedTrial = JudgedTrial;
  EP.Trial = Trial;
  if (typeof module !== "undefined" && module.exports) module.exports = Trial;
})(typeof globalThis !== "undefined" ? globalThis : this);
