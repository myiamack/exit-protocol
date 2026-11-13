/* Game: runs the rounds in step order and applies every rule.
   The screen (or a test script) calls these methods in this order each level:
   startNextRound > sabotage* > setTrialResult / vote > payTrialCosts > accuse* > endGlitchReport
   > gift* > lockIn > computeEarnings > cashOut* > placePoints > finishRound.
   Level 7: startNextRound > placePoints > results. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  const POINTS = { win: 4, lose: 2, glitched: 1, correctAccusation: 1, final: 3 };

  class Game {
    constructor({ teams, rng = Math.random, host = false }) {
      this.teams = teams;
      this.players = teams.flatMap(t => t.members);
      this.rng = rng;
      this.host = host;          // host mode controls are parked; no-host is built first
      this.level = 0;
      this.round = null;
      this.log = [];
    }

    teamOf(p) { return this.teams.find(t => t.has(p)); }
    get over() { return this.level === 7 && this.round && this.round.done; }

    startNextRound() {
      this.level += 1;
      this.round = new EP.Round(this.level);
      this.players.forEach(p => p.resetRoundFlags());
      this.teams.forEach(t => t.resetRound());
      if (this.round.isFinal) {
        for (const p of this.players) if (!p.isStuck()) p.earned = Math.min(POINTS.final, p.roomLeft());
      }
      return this.round;
    }

    /* 1. Open Floor */
    sabotage(actor, target) { return EP.Sabotage.apply(this.round, actor, target, this.teamOf(actor)); }

    /* 2. Trial. Engine-scored trials: the screen or host sets each team's result.
       Judged trials with no host: use a Vote. */
    setTrialResult(team, won) { team.won = !!won; }
    startVote() { return new EP.Vote(this.teams, this.rng); }
    payTrialCosts() {
      const out = new Map();
      for (const p of this.players) {
        const r = p.payTrial(this.round.attr, this.round.cost);
        if (r) out.set(p, r);
      }
      return out;
    }

    /* 3. Glitch Report */
    accuse(accuser, target) { return EP.Accusation.apply(this.round, accuser, target, this.teamOf(accuser)); }
    endGlitchReport() {
      // Exploit: +1 for each Contrarian who sabotaged this round and was not caught.
      for (const p of this.round.saboteurs()) if (!p.caughtThisRound) p.addPathProgress();
    }

    /* 4. Gift window */
    gift(giver, receiver, pts) { return EP.Gift.apply(this.round, giver, receiver, this.teamOf(giver), pts); }

    /* 5. Lock-in: glitches count, reboot, Empathy. */
    lockIn() {
      const locked = [];
      for (const team of this.teams) {
        for (const p of team.members) {
          if (!p.lockIn()) continue;
          locked.push(p);
          for (const q of team.mates(p)) {
            if (q.type === "coop" && !q.isStuck()) q.backup = Math.max(0, q.backup - 1);   // Empathy
          }
        }
      }
      return locked;
    }

    /* 6. Stats Update */
    computeEarnings() {
      const out = new Map();
      for (const team of this.teams) {
        if (team.won === null) throw new Error("No trial result for " + team.name);
        for (const p of team.members) {
          if (p.isStuck()) continue;
          const lines = [];
          let e;
          if (p.glitchedThisRound) { e = POINTS.glitched; lines.push("Glitched this round: 1"); }
          else if (team.won) { e = POINTS.win; lines.push("Team won the trial: 4"); }
          else { e = POINTS.lose; lines.push("Team lost the trial: 2"); }
          if (p.correctAccusation) { e += POINTS.correctAccusation; lines.push("Correct accusation: +1"); }
          const skim = p.takeSkim();
          if (skim) { e += skim; lines.push("Skim: +1"); }
          p.earned = Math.min(e, p.roomLeft());
          out.set(p, lines);
        }
      }
      return out;
    }
    cashOut(p) { return p.cashOut(); }   // adds 1 to p.earned
    finishRound() {
      for (const p of this.players) if (!p.isStuck()) p.refillBackup();
    }

    /* Level 7 */
    results() {
      this.round.done = true;
      return this.players.map(p => ({ player: p, ending: p.ending(), wins: p.wins() }));
    }
  }

  Game.POINTS = POINTS;
  EP.Game = Game;
  if (typeof module !== "undefined" && module.exports) module.exports = Game;
})(typeof globalThis !== "undefined" ? globalThis : this);
