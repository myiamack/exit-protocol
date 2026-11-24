/* Attributes: a player's 5 stats, ability rolls, trial costs, losses, gifts, and stat reboot (Step 10).
   Never touches hearts or type directly; reads/changes them only through Player.
   Rule code only. No screen code. */

const KEYS = ["focus", "initiative", "collab", "composure", "grit"];
const TIE_ORDER = ["focus", "collab", "initiative", "grit", "composure"];   // the usual tie order
const GIFT_TIE_ORDER = TIE_ORDER;

const START_EACH = 1;      // every attribute starts at 1
const SPEND = 15;          // points the player spends at creation
const BOOST = 2;           // type boost per bonus attribute

/* Stat abilities (Part 4b). per = chance per stat point. */
const ABILITY = {
  focus:      { name: "Focus",         per: 0.10, what: "safe accusation" },
  collab:     { name: "Collaboration", per: 0.10, what: "gift costs 1 heart less (min 1)" },
  initiative: { name: "Initiative",    per: 0,    what: "vote points (applies in Levels 5 and 6)" },
  grit:       { name: "Grit",          per: 0.05, what: "extra heart at round end" },
  composure:  { name: "Composure",     per: 0.10, what: "sabotage drains only 1" },
};

class Attributes {
  #player;
  #attrs = {};

  constructor(player, spend) {
    this.#player = player;
    if (spend === null) return;
    let total = 0;
    for (const k of KEYS) {
      const s = spend[k] || 0;
      if (s < 0) throw new Error("Spend cannot be negative");
      total += s;
      this.#attrs[k] = START_EACH + s + (player.isBonus(k) ? BOOST : 0);
      if (this.#attrs[k] > player.max(k)) throw new Error(k + " is over its max");
    }
    if (total !== SPEND) throw new Error("Must spend exactly " + SPEND + " points");
  }

  get attrs() { return { ...this.#attrs }; }
  setAttrsForTest(values) { this.#attrs = { ...this.#attrs, ...values }; }

  rate(k) { return this.#player.isBonus(k) ? 1 : 2; }   // hearts per point covered
  attr(k) { return this.#attrs[k]; }
  addAttr(k, delta) { this.#attrs[k] += delta; }

  total() { return KEYS.reduce((s, k) => s + this.#attrs[k], 0); }
  lowest() { return Math.min(...KEYS.map(k => this.#attrs[k])); }
  highestKey() { return KEYS.reduce((m, k) => (this.#attrs[k] > this.#attrs[m] ? k : m), KEYS[0]); }
  lowestKey() { return KEYS.reduce((m, k) => (this.#attrs[k] < this.#attrs[m] ? k : m), KEYS[0]); }
  /* Highest attribute; ties go to the first in the given order. */
  highestKeyIn(order) { return order.reduce((m, k) => (this.#attrs[k] > this.#attrs[m] ? k : m), order[0]); }

  /* Stat abilities (Part 4b). The stat's value right now: negative counts as 0, max 10. */
  abilityValue(k) { return Math.max(0, Math.min(10, this.#attrs[k])); }
  /* Chance (0 to 1) for the chance-based abilities. */
  abilityChance(k) { return this.abilityValue(k) * ABILITY[k].per; }
  /* Vote weight from Initiative: 1 + Initiative / 10. */
  voteWeight() { return 1 + this.abilityValue("initiative") / 10; }
  /* True if a chance ability fires. rng is the game's seeded rng. */
  rollAbility(k, rng) {
    if (typeof rng !== "function") throw new Error("rollAbility needs the game's seeded rng.");
    return rng() < this.abilityChance(k);
  }
  /* Lines for this player's own screen only. Never show them for other players. */
  abilityLines(draft = null) {
    return KEYS.map(k => {
      const add = draft && typeof draft === "object" ? (draft[k] || 0) : 0;
      const v = Math.max(0, Math.min(10, this.#attrs[k] + add));
      const a = ABILITY[k];
      const amount = k === "initiative" ? "x" + (1 + v / 10).toFixed(1) : Math.round(v * a.per * 100) + "%";
      return { key: k, value: v, text: a.name + " " + v + ": " + amount + " " + a.what };
    });
  }

  /* Lose points from one attribute, from any cause. Hearts cover any shortfall below 0. */
  lose(k, n) {
    this.#attrs[k] -= n;
    this.cover(k);
  }

  cover(k) {
    if (this.#attrs[k] >= 0) return 0;
    const short = -this.#attrs[k];
    const r = this.rate(k);
    const covered = Math.min(short, Math.floor(this.#player.heartCount() / r));
    this.#player.spendHearts(covered * r);
    this.#attrs[k] += covered;
    return covered * r;   // hearts used
  }

  /* Trial cost. Glitching players pay too. Stuck players do not. */
  payTrial(k, cost) {
    if (this.#player.isStuck()) return null;
    const before = this.#attrs[k], heartsBefore = this.#player.heartCount();
    this.lose(k, cost);
    return { attr: k, before, after: this.#attrs[k], heartsUsed: heartsBefore - this.#player.heartCount() };
  }

  /* Wrong accusation penalty. Ties: Focus, Collaboration, Initiative, Grit, Composure. */
  takeFromHighest(n) {
    for (let i = 0; i < n; i++) this.lose(this.highestKeyIn(TIE_ORDER), 1);
  }

  /* Where a gift point goes. Glitching: the glitching attribute (lowest first if two are below 0).
     Not glitching: the lowest attribute that still has room below its max.
     Ties: Focus, Collaboration, Initiative, Grit, Composure. The receiver does not pick.
     Returns null if every attribute is at its max. */
  giftTarget() {
    const p = this.#player;
    const pool = p.isGlitching() ? KEYS.filter(k => this.#attrs[k] < 0)
                                 : KEYS.filter(k => this.#attrs[k] < p.max(k));
    const order = GIFT_TIE_ORDER.filter(k => pool.includes(k));
    if (!order.length) return null;
    return order.reduce((m, k) => (this.#attrs[k] < this.#attrs[m] ? k : m));
  }

  /* Points past 0 stay in that attribute. If it fills up, the next point goes to the
     lowest attribute that still has room. Returns points with nowhere to go (overflow, refunded). */
  receiveGift(pts) {
    const p = this.#player;
    let target = this.giftTarget();
    let overflow = 0;
    for (let i = 0; i < pts; i++) {
      if (p.isGlitching() || target === null || this.#attrs[target] >= p.max(target)) target = this.giftTarget();
      if (target !== null && this.#attrs[target] < p.max(target)) this.#attrs[target] += 1;
      else overflow += 1;
    }
    return overflow;
  }

  /* Take points evenly from the other attributes until the glitched one reaches 1.
     Any shortfall the others cannot cover is forgiven: it still ends at 1.
     Hearts are emptied by Player.reboot(). */
  reboot() {
    for (const k of KEYS) {
      if (this.#attrs[k] >= 0) continue;
      const need = 1 - this.#attrs[k];
      let got = 0;
      while (got < need) {
        const donors = KEYS.filter(d => d !== k && this.#attrs[d] > 0)
                           .sort((a, b) => this.#attrs[b] - this.#attrs[a]);
        if (!donors.length) break;
        for (const d of donors) {
          if (got >= need) break;
          this.#attrs[d] -= 1; got += 1;
        }
      }
      this.#attrs[k] = 1;   // always reboots to 1, shortfall forgiven
    }
  }

  toJSON() { return { ...this.#attrs }; }
  static fromJSON(player, data) {
    const a = new Attributes(player, null);
    a.#attrs = data.attrs ? { ...data.attrs } : {};
    return a;
  }
}

Attributes.KEYS = KEYS;
Attributes.TIE_ORDER = TIE_ORDER;
Attributes.START_EACH = START_EACH;
Attributes.SPEND = SPEND;
Attributes.BOOST = BOOST;
Attributes.ABILITY = ABILITY;

export { Attributes };
