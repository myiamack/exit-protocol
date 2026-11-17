/* Economy: points earned, trial cost payments, Cash Out, and point placement (Step 8).
   Works on passed-in players, teams, and round; never reaches into Game.
   Rule code only. No screen code. */
import { Player } from "./Player.js";

const POINTS = { win: 4, lose: 2, glitched: 1, correctAccusation: 1, final: 3 };

class Economy {
  /* Trial cost for every non-Stuck player. */
  payTrialCosts(players, round) {
    const out = new Map();
    for (const p of players) {
      const r = p.payTrial(round.attr, round.cost);
      if (r) out.set(p, r);
    }
    return out;
  }

  /* Work out points earned at Stats Update and store the summary lines on round.earnings. */
  computeEarnings(teams, round) {
    const out = new Map();
    for (const team of teams) {
      for (const p of team.members) {
        if (p.isStuck()) continue;
        const lines = [];
        let e;
        if (p.glitchedThisRound) { e = POINTS.glitched; lines.push("Glitched this round: 1"); }
        else if (team.won) { e = POINTS.win; lines.push("Points earned: 4"); }
        else { e = POINTS.lose; lines.push("Points earned: 2"); }
        if (p.correctAccusation) { e += POINTS.correctAccusation; lines.push("Correct accusation: +1"); }
        const skim = p.takeSkim();
        if (skim) { e += skim; lines.push("Skim: +1"); }
        p.earned = Math.min(e, p.roomLeft());
        out.set(p, lines);
      }
    }
    round.earnings = Object.fromEntries([...out].map(([p, lines]) => [p.id, lines]));   // saved; the screen reads it
    return out;
  }

  /* Reason placing is not allowed right now, or null if allowed. */
  placingWhy({ step, over, stepWhy, earningsReady }) {
    if (step === "graduation") return over ? "Results are locked." : null;
    return stepWhy || (!earningsReady ? "Earnings come first." : null);
  }

  /* One point picked (+1) or taken back (-1) in the player's draft. */
  draftPoint(p, k, delta) {
    const why = (p.isStuck() ? "You are Stuck." : null) ||
      (!Player.KEYS.includes(k) ? "No such attribute." : null) ||
      (delta === 1 ? (!p.canPlace(p.draft, k) ? "No point or no room left there." : null) :
       delta === -1 ? (!p.canUnplace(p.draft, k) ? "Nothing to take back there." : null) : "Pick +1 or -1.");
    if (why) return { ok: false, reason: why };
    p.draft[k] = (p.draft[k] || 0) + delta;
    if (!p.draft[k]) delete p.draft[k];
    return { ok: true, draft: { ...p.draft } };
  }

  /* Lock in the draft. It must use all the player's points. */
  lockPoints(p) {
    if (p.placeLeft(p.draft) !== 0) return { ok: false, reason: "Place all your points first." };
    p.placePoints(p.draft);
    return { ok: true };
  }

  /* Cash Out adds 1 to p.earned. */
  cashOut(p) {
    if (!p.canCashOut()) return { ok: false, reason: "Cash Out needs an Independent with full hearts, once per game." };
    p.cashOut();
    return { ok: true };
  }

  /* Typical placement: every other point to the lowest bonus attribute, else the lowest open one. */
  static allocate(p, n, final) {
    const KEYS = Player.KEYS;
    const a = { ...p.attrs }, alloc = {};
    const add = k => { a[k] += 1; alloc[k] = (alloc[k] || 0) + 1; n -= 1; };
    if (final) for (const k of KEYS) while (a[k] < 2 && n > 0 && a[k] < p.max(k)) add(k);
    let i = 0;
    while (n > 0) {
      const open = KEYS.filter(k => a[k] < p.max(k));
      if (!open.length) break;
      let pool = open;
      if (i % 2 === 0) { const b = p.type.bonus.filter(k => a[k] < p.max(k)); if (b.length) pool = b; }
      add(pool.reduce((m, k) => (a[k] < a[m] ? k : m), pool[0]));
      i += 1;
    }
    return alloc;
  }

  /* Keep the points already picked (partial), and place the rest by the bot placement rule. */
  autoPlacePoints(p, partial = p.draft, final = false) {
    const KEYS = Player.KEYS;
    p.earned = Math.min(p.earned, p.roomLeft());
    const mine = KEYS.reduce((n, k) => n + (partial[k] || 0), 0);
    for (const k of KEYS) p.addAttr(k, partial[k] || 0);        // place the rest on top of what was picked
    const rest = Economy.allocate(p, Math.max(0, p.earned - mine), final);
    for (const k of KEYS) p.addAttr(k, -(partial[k] || 0));
    const alloc = {};
    for (const k of KEYS) if ((partial[k] || 0) + (rest[k] || 0)) alloc[k] = (partial[k] || 0) + (rest[k] || 0);
    p.placePoints(alloc);
    return alloc;
  }

  /* Timer ran out at Stats Update or Graduation: place everyone's remaining points. */
  placeAllRemaining(players, final = false) {
    for (const p of players) if (!p.isStuck() && p.earned > 0) this.autoPlacePoints(p, p.draft, final);
  }
}

Economy.POINTS = POINTS;

export { Economy };
