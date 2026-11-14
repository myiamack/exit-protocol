/* Vote: judged trials with no host. Each non-Stuck player ranks top 3 non-Stuck players from other teams.
   1st = 3, 2nd = 2, 3rd = 1, times the voter's 1 + Initiative / 10. Points go to the ranked players' teams,
   then each team's total is divided by its active players and by the active players not on that team. Top half of teams win
   (rounded up: 5 teams -> 3 win, 7 teams -> 4).
   Ties at the cutoff: more first-place ranks wins. Still tied: random. */
(function (root) {
  const EP = root.EP || (root.EP = {});
  const POINTS = [3, 2, 1];

  class Vote {
    /* canBeRanked: optional check. Levels 5-6 pass "has a submission"; without it, anyone not Stuck. */
    constructor(teams, rng = Math.random, canBeRanked = null) {
      this.teams = teams;
      this.rng = rng;
      this.canBeRanked = canBeRanked || (() => true);
      this.ballots = new Map();   // voter -> [p1, p2, p3]
    }

    teamOf(p) { return this.teams.find(t => t.has(p)); }

    /* Players this voter may rank: not themselves, not their own team, not Stuck, and (Levels 5-6) submitted. */
    choicesFor(voter) {
      return this.teams.filter(t => !t.has(voter)).flatMap(t => t.members).filter(p => !p.isStuck() && this.canBeRanked(p));
    }

    /* Normally 3. Fewer only if fewer than 3 players can be ranked at all. */
    slotsFor(voter) { return Math.min(3, this.choicesFor(voter).length); }

    check(voter, ranking) {
      if (voter.isStuck()) return "Stuck players do not vote.";
      const n = this.slotsFor(voter);
      if (ranking.length !== n) return "Rank exactly " + n + " players.";
      if (new Set(ranking).size !== n) return "Pick " + n + " different players.";
      for (const p of ranking) {
        if (p === voter) return "You cannot rank yourself.";
        if (p.isStuck()) return "Stuck players cannot be ranked.";
        if (!this.canBeRanked(p)) return p.name + " has no submission and cannot be ranked.";
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

    /* Returns teams in final order, and sets team.won.
       total = the team's vote points (each voter's points already x Initiative weight).
       score = total / (team's active players x active players who could rank them, i.e. active players not on
       that team). Active = not Stuck (idle too once Part 8 exists). Teams rank by score, so team size does not
       matter: big teams have more players to rank, small teams have more possible voters. Either count 0 = score 0. */
    tally() {
      const allActive = this.teams.reduce((n, t) => n + t.active().length, 0);
      const score = new Map(this.teams.map(t => {
        const active = t.active().length;
        return [t, { total: 0, active, voters: allActive - active, score: 0, firsts: 0, roll: this.rng() }];
      }));
      for (const [voter, ranking] of this.ballots) {
        const w = voter.voteWeight();   // Initiative: points x (1 + Initiative / 10)
        ranking.forEach((p, i) => {
          const s = score.get(this.teamOf(p));
          s.total += POINTS[i] * w;
          if (i === 0) s.firsts += 1;
        });
      }
      for (const s of score.values()) s.score = s.active && s.voters ? s.total / (s.active * s.voters) : 0;
      const order = [...this.teams].sort((a, b) => {
        const A = score.get(a), B = score.get(b);
        return (B.score - A.score) || (B.firsts - A.firsts) || (A.roll - B.roll);
      });
      const winners = Math.ceil(this.teams.length / 2);
      order.forEach((t, i) => { t.won = i < winners; });
      return order.map(t => ({ team: t, ...score.get(t), won: t.won }));
    }
  }

  EP.Vote = Vote;
  if (typeof module !== "undefined" && module.exports) module.exports = Vote;
})(typeof globalThis !== "undefined" ? globalThis : this);
