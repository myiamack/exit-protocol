/* Accusation: one per player per round, against a teammate. Every type can accuse. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Accusation {
    static check(accuser, target, team) {
      if (accuser.isStuck()) return "You are Stuck.";
      if (accuser.accusedThisRound) return "One accusation per round.";
      if (target === accuser) return "You cannot accuse yourself.";
      if (!team.has(target)) return "Teammates only.";
      return null;
    }

    /* Correct = the target sabotaged this round.
       Correct: +1 at Stats Update, Auditor credit, target is caught.
       Wrong: accuser loses 1 from highest attribute (can cause a glitch). */
    static apply(round, accuser, target, team) {
      const why = Accusation.check(accuser, target, team);
      if (why) return { ok: false, reason: why };
      accuser.accusedThisRound = true;
      const correct = target.sabotagesThisRound > 0;
      if (correct) {
        accuser.correctAccusation = true;
        if (accuser.type === "indep") accuser.addPathProgress();   // Auditor
        Accusation.catchSaboteur(target);
      } else {
        accuser.takeFromHighest(1);
      }
      const rec = { accuser, target, correct };
      round.accusations.push(rec);
      return { ok: true, ...rec };
    }

    /* Caught: loses 0 points, no more sabotage this game, loses Exploit. */
    static catchSaboteur(p) {
      p.caughtThisRound = true;
      p.sabotageLocked = true;
      p.pathLost = true;   // a path already completed still counts
    }
  }

  EP.Accusation = Accusation;
  if (typeof module !== "undefined" && module.exports) module.exports = Accusation;
})(typeof globalThis !== "undefined" ? globalThis : this);
