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
       Correct: +1 at Stats Update, Auditor credit, target is caught by this team
       (loses 0 points; no sabotage on any team next round; this round's sabotage does not count toward Exploit or Skim;
       no sabotage while on this team; Exploit is never lost).
       Wrong: accuser loses 1 from highest attribute (can cause a glitch),
       unless Focus saves it (Focus x 10% chance to cost nothing). */
    static apply(round, accuser, target, team, rng) {
      const why = Accusation.check(accuser, target, team);
      if (why) return { ok: false, reason: why };
      accuser.accusedThisRound = true;
      const correct = target.sabotagesThisRound > 0;
      if (correct) {
        accuser.correctAccusation = true;
        accuser.creditPath(EP.CharacterType.PATH_EVENTS.correctAccusation);   // Auditor
        target.markCaughtBy(team.id);
      }
      // Wrong: Focus x 10% chance it costs nothing (Part 4b).
      const safe = !correct && accuser.rollAbility("focus", rng);
      if (!correct && !safe) accuser.takeFromHighest(1);
      const rec = { accuser, target, correct, safe };
      round.accusations.push(rec);
      return { ok: true, ...rec };
    }
  }

  EP.Accusation = Accusation;
  if (typeof module !== "undefined" && module.exports) module.exports = Accusation;
})(typeof globalThis !== "undefined" ? globalThis : this);
