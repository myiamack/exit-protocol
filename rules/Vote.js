/* Vote: judged trials with no host. Each player ranks top 3 players from other teams.
   1st = 3, 2nd = 2, 3rd = 1. Points go to the ranked players' teams. Top half of teams win.
   Ties at the cutoff: more first-place ranks wins. Still tied: random. */
(function (root) {
  const EP = root.EP || (root.EP = {});
  const POINTS = [3, 2, 1];

  class Vote {
    constructor(teams, rng = Math.random) {
      this.teams = teams;
      this.rng = rng;
      this.ballots = new Map();   // voter -> [p1, p2, p3]
    }

    teamOf(p) { return this.teams.find(t => t.has(p)); }

    /* Players this voter may rank: not themselves, not their own team. */
    choicesFor(voter) {
      return this.teams.filter(t => !t.has(voter)).flatMap(t => t.members);
    }

    check(voter, ranking) {
      if (voter.isStuck()) return "Stuck players do not vote.";
      if (ranking.length !== 3) return "Rank exactly 3 players.";
      if (new Set(ranking).size !== 3) return "Pick 3 different players.";
      for (const p of ranking) {
        if (p === voter) return "You cannot rank yourself.";
        if (this.teamOf(p) === this.teamOf(voter)) return "You cannot rank your own team.";
      }
      return null;
    }

    cast(voter, ranking) {
      const why = this.check(voter, ranking);
      if (why) return { ok: false, reason: why };
      this.ballots.set(voter, ranking);
      return { ok: true };
    }

    /* Returns teams in final order with totals, and sets team.won. */
    tally() {
      const score = new Map(this.teams.map(t => [t, { total: 0, firsts: 0, roll: this.rng() }]));
      for (const ranking of this.ballots.values()) {
        ranking.forEach((p, i) => {
          const s = score.get(this.teamOf(p));
          s.total += POINTS[i];
          if (i === 0) s.firsts += 1;
        });
      }
      const order = [...this.teams].sort((a, b) => {
        const A = score.get(a), B = score.get(b);
        return (B.total - A.total) || (B.firsts - A.firsts) || (A.roll - B.roll);
      });
      const winners = Math.floor(this.teams.length / 2);
      order.forEach((t, i) => { t.won = i < winners; });
      return order.map(t => ({ team: t, ...score.get(t), won: t.won }));
    }
  }

  EP.Vote = Vote;
  if (typeof module !== "undefined" && module.exports) module.exports = Vote;
})(typeof globalThis !== "undefined" ? globalThis : this);
