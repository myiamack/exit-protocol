/* Gift: sent during the gift window to a Glitching teammate. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Gift {
    /* Backup cost. Independent: 1 point costs 2, 2 points cost 3. Others: 1 per point. */
    static cost(giver, pts) {
      if (giver.type === "indep") return pts === 1 ? 2 : 3;
      return pts;
    }
    /* Backup refunded per point that hits the receiver's max. */
    static refundPerPoint(giver) { return giver.type === "indep" ? 2 : 1; }

    static check(giver, receiver, team, pts) {
      if (pts !== 1 && pts !== 2) return "Gift 1 or 2 points.";
      if (giver.isStuck()) return "You are Stuck.";
      if (giver === receiver) return "You cannot gift yourself.";
      if (!team.has(receiver)) return "Teammates only.";
      if (receiver.isStuck()) return "Stuck players cannot receive gifts.";
      if (!receiver.isGlitching()) return "Gifts go only to Glitching teammates.";
      if (giver.backup < Gift.cost(giver, pts)) return "Not enough backup.";
      return null;
    }

    static apply(round, giver, receiver, team, pts) {
      const why = Gift.check(giver, receiver, team, pts);
      if (why) return { ok: false, reason: why };
      const cost = Gift.cost(giver, pts);

      // Independents cannot accept gifts: refused, nothing is spent.
      if (receiver.type === "indep") {
        const rec = { giver, receiver, pts, cost: 0, refused: true, cancelled: false };
        round.gifts.push(rec);
        return { ok: true, ...rec };
      }

      giver.backup -= cost;
      const overflow = receiver.receiveGift(pts);
      if (overflow) {
        giver.backup = Math.min(EP.Player.BACKUP_CAP, giver.backup + overflow * Gift.refundPerPoint(giver));
      }
      const cancelled = !receiver.isGlitching();
      if (cancelled && giver.type === "coop") giver.addPathProgress();   // Lifeline
      const rec = { giver, receiver, pts, cost, refused: false, cancelled, overflow };
      round.gifts.push(rec);
      return { ok: true, ...rec };
    }
  }

  EP.Gift = Gift;
  if (typeof module !== "undefined" && module.exports) module.exports = Gift;
})(typeof globalThis !== "undefined" ? globalThis : this);
