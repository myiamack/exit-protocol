/* Sabotage: Contrarian only, teammates only, costs hearts, drains the trial attribute. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Sabotage {
    /* 1 heart for the first in a round, 2 for each extra in the same round. */
    static cost(actor) { return actor.sabotagesThisRound === 0 ? 1 : 2; }

    /* 2 points. Composure x 10% chance it is only 1 (Part 4b). */
    static drain(target, rng) { return target.rollAbility("composure", rng) ? 1 : 2; }

    /* Returns null if allowed, or a reason string if not. */
    static check(actor, target, team) {
      if (!actor.type.canSabotage()) return "Only Contrarians can sabotage.";
      if (actor.isStuck()) return "You are Stuck.";
      if (actor.sabotageBlockedThisRound) return "You were caught last round. No sabotage on any team this round.";
      if (actor.wasCaughtBy(team.id)) return "This team caught you. No sabotage while you are on it.";
      if (target === actor) return "You cannot sabotage yourself.";
      if (!team.has(target)) return "Teammates only.";
      if (target.isStuck()) return "Stuck players cannot be sabotaged.";
      if (!actor.hearts.has(Sabotage.cost(actor))) return "Not enough hearts.";
      return null;
    }

    /* Apply it. The victim is told privately (victimNotice). */
    static apply(round, actor, target, team, rng) {
      const why = Sabotage.check(actor, target, team);
      if (why) return { ok: false, reason: why };
      const cost = Sabotage.cost(actor);
      actor.hearts.spend(cost);
      actor.sabotagesThisRound += 1;
      const drain = Sabotage.drain(target, rng);
      target.lose(round.attr, drain);   // hearts cover a drain below 0
      target.wasSabotagedThisRound = true;
      const rec = { actor, target, drain, cost };
      round.sabotages.push(rec);
      return { ok: true, ...rec, victimNotice: "Someone drained " + drain + " from your " + round.attr + "." };
    }
  }

  EP.Sabotage = Sabotage;
  if (typeof module !== "undefined" && module.exports) module.exports = Sabotage;
})(typeof globalThis !== "undefined" ? globalThis : this);
