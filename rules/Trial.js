/* Trial: ranks the teams for one round. Top half win.
   Every trial takes the round and the teams and returns a ranked list (best first).
   Winners = half the teams, rounded up: 4 teams -> 2, 5 teams -> 3, 7 teams -> 4.
   Subclasses only decide the order:
     SopTrial    Level 1     SOP score (steps in the right place + 1 if the endless step is left out), ties random
     AutoTrial   Levels 2-4  random order (placeholder until those mini-games exist)
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
      for (const t of teams) if (!this.scores.has(t)) this.scores.set(t, Math.floor(this.rng() * (SopTrial.MAX_SCORE + 1)));
      const entries = teams.map(team => ({ team, score: this.scores.get(team) }));
      return this.sortBy(entries, [e => e.score]);
    }
  }

  /* Levels 2-4 for now: random order. */
  class AutoTrial extends Trial {
    rank(round, teams) { return this.sortBy(teams.map(team => ({ team })), []); }
  }

  /* Levels 5-6: players vote. Cast ballots on .vote, then run(). */
  class JudgedTrial extends Trial {
    constructor(rng) { super(rng); this.vote = null; }
    startVote(teams) { if (!this.vote) this.vote = new EP.Vote(teams, this.rng); return this.vote; }
    rank(round, teams) {
      const vote = this.startVote(teams);
      return vote.tally().map(r => ({ team: r.team, total: r.total, firsts: r.firsts }));
    }
  }

  Trial.SopTrial = SopTrial;
  Trial.AutoTrial = AutoTrial;
  Trial.JudgedTrial = JudgedTrial;
  EP.Trial = Trial;
  if (typeof module !== "undefined" && module.exports) module.exports = Trial;
})(typeof globalThis !== "undefined" ? globalThis : this);
