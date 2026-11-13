/* Gift: sent to any teammate during Open Floor or the gift window, whatever their status
   (Stuck players cannot give or receive). The receiver answers Accept or Decline.
   Accept: points go to the glitching attribute if the receiver is Glitching, else to their lowest
   attribute that still has room (ties: Focus, Collaboration, Initiative, Grit, Composure).
   Decline, or no answer by the end of the step: the giver gets the backup back.
   Independents refuse automatically. The receiver does not pick the attribute. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Gift {
    /* Backup cost. Independent: 1 point costs 2, 2 points cost 3. Others: 1 per point. */
    static cost(giver, pts) {
      if (giver.type === "indep") return pts === 1 ? 2 : 3;
      return pts;
    }
    /* Backup refunded per point that cannot land (overflow). */
    static refundPerPoint(giver) { return giver.type === "indep" ? 2 : 1; }

    static check(giver, receiver, team, pts) {
      if (pts !== 1 && pts !== 2) return "Gift 1 or 2 points.";
      if (giver.isStuck()) return "You are Stuck.";
      if (giver === receiver) return "You cannot gift yourself.";
      if (!team.has(receiver)) return "Teammates only.";
      if (receiver.isStuck()) return "Stuck players cannot receive gifts.";
      if (giver.backup < Gift.cost(giver, pts)) return "Not enough backup.";
      return null;
    }

    /* Send a gift. The giver pays now. The gift waits for the receiver's answer (status "pending").
       Independents refuse at once and nothing is spent (status "refused").
       The result's .gift is the record to pass to accept or decline. */
    static apply(round, giver, receiver, team, pts) {
      const why = Gift.check(giver, receiver, team, pts);
      if (why) return { ok: false, reason: why };
      const cost = Gift.cost(giver, pts);
      let rec;
      if (receiver.type === "indep") {
        rec = { giver, receiver, pts, cost: 0, status: "refused", refused: true, cancelled: false };
      } else {
        giver.backup -= cost;
        rec = { giver, receiver, pts, cost, status: "pending", refused: false, cancelled: false };
      }
      round.gifts.push(rec);
      return { ok: true, gift: rec, ...rec };
    }

    /* Accept: points land. Points with nowhere to go are refunded to the giver.
       Lifeline: only a gift that cancels a glitch counts. */
    static accept(round, rec) {
      if (rec.status !== "pending") return { ok: false, reason: "This gift was already answered." };
      const { giver, receiver, pts } = rec;
      const wasGlitching = receiver.isGlitching();
      rec.target = receiver.giftTarget();
      rec.overflow = receiver.receiveGift(pts);
      if (rec.overflow) {
        giver.backup = Math.min(EP.Player.BACKUP_CAP, giver.backup + rec.overflow * Gift.refundPerPoint(giver));
      }
      rec.cancelled = wasGlitching && !receiver.isGlitching();   // only a real rescue counts
      if (rec.cancelled && giver.type === "coop") giver.addPathProgress();   // Lifeline
      rec.status = "accepted";
      return { ok: true, gift: rec, ...rec };
    }

    /* Decline (or "expired" when no one answered): the giver gets the backup back. */
    static decline(round, rec, status = "declined") {
      if (rec.status !== "pending") return { ok: false, reason: "This gift was already answered." };
      rec.giver.backup = Math.min(EP.Player.BACKUP_CAP, rec.giver.backup + rec.cost);
      rec.status = status;
      return { ok: true, gift: rec, ...rec };
    }

    static pending(round) { return round.gifts.filter(g => g.status === "pending"); }

    /* End of Open Floor or the gift window: unanswered gifts are declined and refunded. */
    static expireAll(round) { return Gift.pending(round).map(g => Gift.decline(round, g, "expired")); }
  }

  EP.Gift = Gift;
  if (typeof module !== "undefined" && module.exports) module.exports = Gift;
})(typeof globalThis !== "undefined" ? globalThis : this);
