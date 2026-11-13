/* Sabotage: Contrarian only, teammates only, costs backup, drains the trial attribute. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Sabotage {
    /* 1 backup for the first in a round, 2 for each extra in the same round. */
    static cost(actor) { return actor.sabotagesThisRound === 0 ? 1 : 2; }

    /* 2 points, or 1 if the target's Composure is 6 or more. */
    static drain(target) { return target.attrs.composure >= 6 ? 1 : 2; }

    /* Returns null if allowed, or a reason string if not. */
    static check(actor, target, team) {
      if (actor.type !== "contra") return "Only Contrarians can sabotage.";
      if (actor.isStuck()) return "You are Stuck.";
      if (actor.sabotageLocked) return "You were caught. No more sabotage this game.";
      if (target === actor) return "You cannot sabotage yourself.";
      if (!team.has(target)) return "Teammates only.";
      if (target.isStuck()) return "Stuck players cannot be sabotaged.";
      if (actor.backup < Sabotage.cost(actor)) return "Not enough backup.";
      return null;
    }

    /* Apply it. The victim is told privately (victimNotice). */
    static apply(round, actor, target, team) {
      const why = Sabotage.check(actor, target, team);
      if (why) return { ok: false, reason: why };
      const cost = Sabotage.cost(actor);
      actor.backup -= cost;
      actor.sabotagesThisRound += 1;
      const drain = Sabotage.drain(target);
      target.lose(round.attr, drain);   // backup covers a drain below 0
      target.wasSabotagedThisRound = true;
      const rec = { actor, target, drain, cost };
      round.sabotages.push(rec);
      return { ok: true, ...rec, victimNotice: "Someone drained " + drain + " from your " + round.attr + "." };
    }
  }

  EP.Sabotage = Sabotage;
  if (typeof module !== "undefined" && module.exports) module.exports = Sabotage;
})(typeof globalThis !== "undefined" ? globalThis : this);
