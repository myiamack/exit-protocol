/* Wallet: a player's earned points, placement draft, Skim and Cash Out (Step 5).
   Changes the player's stats only through Player methods (attr, addAttr, max).
   Rule code only. No screen code. */

const KEYS = ["focus", "initiative", "collab", "composure", "grit"];
const SKIM_MAX = 2, CASHOUT_USES = 1, CASHOUT_COST = 2;

class Wallet {
  #player;
  #earned = 0;
  #draft = {};
  #placedThisRound = 0;
  #skimUsed = 0;
  #cashOutUsed = 0;
  #cashedOutThisRound = false;

  constructor(player) { this.#player = player; }

  get earned() { return this.#earned; }
  set earned(n) { this.#earned = n; }
  get draft() { return this.#draft; }
  get placedThisRound() { return this.#placedThisRound; }
  get skimUsed() { return this.#skimUsed; }
  get cashOutUsed() { return this.#cashOutUsed; }
  get cashedOutThisRound() { return this.#cashedOutThisRound; }

  resetRound() {
    this.#earned = 0;
    this.#cashedOutThisRound = false;
    this.#draft = {};
    this.#placedThisRound = 0;
  }

  /* Cash Out (Independent): once per game, needs full hearts, 2 hearts for 1 point. */
  canCashOut() {
    const p = this.#player;
    return p.type.hasCashOut() && !p.isStuck() && this.#cashOutUsed < CASHOUT_USES &&
           p.hearts.isFull() && p.hearts.has(CASHOUT_COST);
  }
  cashOut() {
    if (!this.canCashOut()) return false;
    this.#player.hearts.spend(CASHOUT_COST);
    this.#cashOutUsed += 1;
    this.#cashedOutThisRound = true;
    this.#earned += 1;
    return true;
  }

  /* Skim (Contrarian): +1 per uncaught sabotage round, max 2 per game. */
  takeSkim() {
    const p = this.#player;
    if (!p.type.hasSkim() || p.sabotagesThisRound === 0 || p.caughtThisRound) return 0;
    if (this.#skimUsed >= SKIM_MAX) return 0;
    this.#skimUsed += 1;
    return 1;
  }

  /* Place earned points. alloc = { focus: n, ... }. Must use all points and respect max. */
  placePoints(alloc) {
    const p = this.#player;
    const n = KEYS.reduce((s, k) => s + (alloc[k] || 0), 0);
    if (n !== this.#earned) throw new Error("Place exactly " + this.#earned + " points");
    for (const k of KEYS) {
      if ((alloc[k] || 0) < 0) throw new Error("No negative placement");
      if (p.attr(k) + (alloc[k] || 0) > p.max(k)) throw new Error(k + " would pass its max");
    }
    for (const k of KEYS) p.addAttr(k, alloc[k] || 0);
    this.#earned = 0;
    this.#draft = {};
    this.#placedThisRound = n;
  }
  placeLeft(place) { return this.#earned - KEYS.reduce((s, k) => s + (place[k] || 0), 0); }
  canPlace(place, k) { return this.placeLeft(place) > 0 && this.#player.attr(k) + (place[k] || 0) < this.#player.max(k); }
  canUnplace(place, k) { return (place[k] || 0) > 0; }
  coversFromPoints(k, cost) { return this.#player.attr(k) >= cost; }
  roomLeft() { return KEYS.reduce((s, k) => s + (this.#player.max(k) - this.#player.attr(k)), 0); }

  toJSON() {
    return {
      earned: this.#earned,
      draft: { ...this.#draft },
      placedThisRound: this.#placedThisRound,
      skimUsed: this.#skimUsed,
      cashOutUsed: this.#cashOutUsed,
      cashedOutThisRound: this.#cashedOutThisRound,
    };
  }
  static fromJSON(player, data) {
    const w = new Wallet(player);
    w.#earned = data.earned || 0;
    w.#draft = data.draft ? { ...data.draft } : {};
    w.#placedThisRound = data.placedThisRound || 0;
    w.#skimUsed = data.skimUsed || 0;
    w.#cashOutUsed = data.cashOutUsed || 0;
    w.#cashedOutThisRound = !!data.cashedOutThisRound;
    return w;
  }
}

Wallet.SKIM_MAX = SKIM_MAX;
Wallet.CASHOUT_COST = CASHOUT_COST;

export { Wallet };
