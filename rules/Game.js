/* Game: runs the rounds in step order and applies every rule.
   Game enforces the step order. A call in the wrong step is refused with a reason.
   Player actions (sabotage, accuse, gift, cashOut) return { ok: false, reason }.
   Engine calls (payTrialCosts, lockIn, ...) throw an Error with the reason.
   Order each level 1 to 6 (advance() moves to the next step):
     openFloor:    sabotage*, gift*, answerGift*, switchTeam*           > advance (unanswered gifts expire)
     trial:        setSopScore (Level 1) / startVote + cast (Levels 5-6), runTrial, payTrialCosts  > advance
     glitchReport: accuse*, endGlitchReport                   > advance
     giftWindow:   gift*, answerGift*                         > advance (unanswered gifts expire)
     lockIn:       lockIn                                     > advance
     statsUpdate:  computeEarnings, cashOut*, place points, finishRound
   Then startNextRound. Level 7: startNextRound > place points > results. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  const POINTS = { win: 4, lose: 2, glitched: 1, correctAccusation: 1, final: 3 };

  const STEP_NAME = { openFloor: "Open Floor", trial: "Trial", glitchReport: "Glitch Report",
                      giftWindow: "Gift window", lockIn: "Lock-in", statsUpdate: "Stats Update",
                      graduation: "Graduation" };

  // What must happen before advance() may leave each step.
  const REQUIRED = { trial: "payTrialCosts", glitchReport: "endGlitchReport", lockIn: "lockIn" };

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

    /* ----- step order ----- */
    get step() { return this.round ? this.round.step : null; }
    stepName() { return STEP_NAME[this.step] || "no round"; }
    didRun(action) { return !!this.round && this.round.completed.has(action); }

    /* null if this is the right step, else the reason. */
    wrongStep(step) {
      if (this.step === step) return null;
      return "Not allowed now. That happens in " + STEP_NAME[step] + "; the game is in " + this.stepName() + ".";
    }
    mustBe(step) { const why = this.wrongStep(step); if (why) throw new Error(why); }
    once(action) {
      if (this.didRun(action)) throw new Error(action + " already ran this round.");
      this.round.completed.add(action);
    }

    /* Move to the next step. Refused if the current step is not finished. */
    advance() {
      if (!this.round) throw new Error("No round yet. Call startNextRound.");
      if (this.round.isFinal) throw new Error("Graduation is the last step.");
      if (this.step === "statsUpdate") throw new Error("Stats Update is the last step. Call finishRound, then startNextRound.");
      const need = REQUIRED[this.step];
      if (need && !this.didRun(need)) throw new Error("Finish " + this.stepName() + " first (" + need + ").");
      if (this.step === "openFloor" || this.step === "giftWindow") EP.Gift.expireAll(this.round);   // no answer = declined
      return this.round.nextStep();
    }

    startNextRound() {
      if (this.level >= 7) throw new Error("The game is over.");
      if (this.round && !this.didRun("finishRound")) throw new Error("Finish this round first (finishRound).");
      this.level += 1;
      this.round = new EP.Round(this.level);
      if (!this.round.isFinal) this.round.trial = EP.Trial.forRound(this.round, this.rng);
      this.players.forEach(p => p.resetRoundFlags());
      this.teams.forEach(t => t.resetRound());
      if (this.round.isFinal) {
        for (const p of this.players) if (!p.isStuck()) p.earned = Math.min(POINTS.final, p.roomLeft());
      }
      return this.round;
    }

    /* 1. Open Floor */
    sabotage(actor, target) {
      const why = this.wrongStep("openFloor");
      if (why) return { ok: false, reason: why };
      return EP.Sabotage.apply(this.round, actor, target, this.teamOf(actor), this.rng);
    }

    /* Team switching (Open Floor only). Teams stay 3 to 5 members.
       A player who sabotaged this round cannot switch that round.
       Stuck players are spectators and cannot switch. */
    switchTeam(p, to) {
      const from = this.teamOf(p);
      const why = this.wrongStep("openFloor") ||
        (!this.teams.includes(to) ? "No such team." : null) ||
        (from === to ? "You are already on that team." : null) ||
        (p.isStuck() ? "You are Stuck." : null) ||
        (p.sabotagesThisRound > 0 ? "You sabotaged this round. You cannot switch teams this round." : null) ||
        (from.size() - 1 < EP.Team.MIN ? from.name + " would drop below " + EP.Team.MIN + " members." : null) ||
        (to.size() + 1 > EP.Team.MAX ? to.name + " is full (" + EP.Team.MAX + " members)." : null);
      if (why) return { ok: false, reason: why };
      from.remove(p);
      to.add(p);
      this.log.push({ level: this.level, event: "switchTeam", player: p.id, from: from.id, to: to.id });
      return { ok: true, from, to };
    }

    /* 2. Trial. The round's Trial ranks the teams; the top half win.
       Level 1: the screen sets a team's SOP score (teams with none get a random score).
       Levels 5-6: players cast votes on startVote(), then runTrial. */
    setSopScore(team, score) {
      this.mustBe("trial");
      if (!(this.round.trial instanceof EP.Trial.SopTrial)) throw new Error("This level has no SOP.");
      this.round.trial.setScore(team, score);
    }
    startVote() {
      this.mustBe("trial");
      if (!(this.round.trial instanceof EP.Trial.JudgedTrial)) throw new Error("This level is not judged.");
      return this.round.trial.startVote(this.teams);
    }
    /* Returns the ranked list: [{ team, place, won, ... }] best first. */
    runTrial() {
      this.mustBe("trial");
      this.once("runTrial");
      return this.round.trial.run(this.round, this.teams);
    }
    payTrialCosts() {
      this.mustBe("trial");
      if (!this.didRun("runTrial")) throw new Error("Run the trial first (runTrial).");
      this.once("payTrialCosts");
      const out = new Map();
      for (const p of this.players) {
        const r = p.payTrial(this.round.attr, this.round.cost);
        if (r) out.set(p, r);
      }
      return out;
    }

    /* 3. Glitch Report */
    accuse(accuser, target) {
      const why = this.wrongStep("glitchReport") || (this.didRun("endGlitchReport") ? "The Glitch Report is closed." : null);
      if (why) return { ok: false, reason: why };
      return EP.Accusation.apply(this.round, accuser, target, this.teamOf(accuser), this.rng);
    }
    endGlitchReport() {
      this.mustBe("glitchReport");
      this.once("endGlitchReport");
      // Exploit: +1 for each Contrarian who sabotaged this round and was not caught.
      for (const p of this.round.saboteurs()) if (!p.caughtThisRound) p.creditPath(EP.CharacterType.PATH_EVENTS.uncaughtSabotage);
    }

    /* Gifts: Open Floor or the gift window. */
    gift(giver, receiver, pts) {
      const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
        "Not allowed now. Gifts happen in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
      if (why) return { ok: false, reason: why };
      return EP.Gift.apply(this.round, giver, receiver, this.teamOf(giver), pts, this.rng);
    }
    /* The receiver answers a pending gift: accept (true) or decline (false). */
    answerGift(gift, accept) {
      const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
        "Not allowed now. Gifts are answered in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
      if (why) return { ok: false, reason: why };
      return accept ? EP.Gift.accept(this.round, gift) : EP.Gift.decline(this.round, gift);
    }

    /* 5. Lock-in: glitches count, reboot, Empathy. */
    lockIn() {
      this.mustBe("lockIn");
      this.once("lockIn");
      const locked = [];
      for (const team of this.teams) {
        for (const p of team.members) {
          if (!p.lockIn()) continue;
          locked.push(p);
          for (const q of team.mates(p)) {
            if (q.type.hasEmpathy() && !q.isStuck()) q.hearts.lose(1);   // Empathy
          }
        }
      }
      return locked;
    }

    /* 6. Stats Update */
    computeEarnings() {
      this.mustBe("statsUpdate");
      this.once("computeEarnings");
      const out = new Map();
      for (const team of this.teams) {
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
    /* Cash Out adds 1 to p.earned. Only after earnings, before the round ends. */
    cashOut(p) {
      const why = this.wrongStep("statsUpdate") ||
                  (!this.didRun("computeEarnings") ? "Earnings come first." : null) ||
                  (this.didRun("finishRound") ? "The round is over." : null) ||
                  (!p.canCashOut() ? "Cash Out needs an Independent with full hearts, once per game." : null);
      if (why) return { ok: false, reason: why };
      p.cashOut();
      return { ok: true };
    }
    finishRound() {
      this.mustBe("statsUpdate");
      if (!this.didRun("computeEarnings")) throw new Error("Compute earnings first.");
      const unplaced = this.players.find(p => !p.isStuck() && p.earned > 0);
      if (unplaced) throw new Error(unplaced.name + " has not placed their points.");
      this.once("finishRound");
      const gritBonus = [];
      for (const p of this.players) {
        if (p.isStuck()) continue;
        p.hearts.refill();
        // Grit: after the normal refill, Grit x 5% chance of +1 heart, capped (Part 4b).
        if (p.rollAbility("grit", this.rng)) { p.hearts.refill(); gritBonus.push(p); }
      }
      this.round.gritBonus = gritBonus;
      return gritBonus;
    }

    /* Level 7 */
    results() {
      this.mustBe("graduation");
      this.round.done = true;
      return this.players.map(p => ({ player: p, ending: p.ending(), wins: p.wins() }));
    }
  }

  Game.POINTS = POINTS;
  Game.STEP_NAME = STEP_NAME;
  EP.Game = Game;
  if (typeof module !== "undefined" && module.exports) module.exports = Game;
})(typeof globalThis !== "undefined" ? globalThis : this);
