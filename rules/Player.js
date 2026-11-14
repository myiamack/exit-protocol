/* Player: one intern. Holds type, 5 attributes, hearts, glitches, flags, second path.
   Rule code only. No screen code. Works in the browser and in Node. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  const KEYS = ["focus", "initiative", "collab", "composure", "grit"];
  const GIFT_TIE_ORDER = ["focus", "collab", "initiative", "grit", "composure"];

  const START_EACH = 1;      // every attribute starts at 1
  const SPEND = 15;          // points the player spends at creation
  const BOOST = 2;           // type boost per bonus attribute
  const AT_RISK_COST = 3;
  const GRAD_TOTAL = 24, GRAD_MIN = 2;
  const SKIM_MAX = 2, CASHOUT_USES = 1, CASHOUT_COST = 2;

  /* Stat abilities (Part 4b). per = chance per stat point. */
  const ABILITY = {
    focus:      { name: "Focus",         per: 0.10, what: "safe accusation" },
    collab:     { name: "Collaboration", per: 0.10, what: "free gift" },
    initiative: { name: "Initiative",    per: 0,    what: "vote points" },
    grit:       { name: "Grit",          per: 0.05, what: "extra heart at round end" },
    composure:  { name: "Composure",     per: 0.10, what: "sabotage drains only 1" },
  };

  class Player {
    /* type: a key ("coop", "indep", "contra") or a CharacterType.
       spend: { focus: n, ... } adding up to 15. Boost is added here. */
    constructor({ id, name, type, spend, isBot = false }) {
      this.id = id;
      this.name = name;
      this.type = EP.CharacterType.get(type);
      this.isBot = isBot;
      this.teamId = null;

      const t = this.type;
      this.attrs = {};
      let total = 0;
      for (const k of KEYS) {
        const s = spend[k] || 0;
        if (s < 0) throw new Error("Spend cannot be negative");
        total += s;
        this.attrs[k] = START_EACH + s + (t.bonus.includes(k) ? BOOST : 0);
        if (this.attrs[k] > this.max(k)) throw new Error(k + " is over its max");
      }
      if (total !== SPEND) throw new Error("Must spend exactly " + SPEND + " points");

      this.hearts = new EP.Hearts();
      this.glitches = 0;

      // second path
      this.pathProgress = 0;
      this.pathDone = false;

      // Contrarian
      this.caughtBy = [];   // ids of teams that caught this player sabotaging
      this.skimUsed = 0;
      // Independent
      this.cashOutUsed = 0;

      this.resetRoundFlags();
    }

    static get KEYS() { return KEYS; }
    static get SPEND() { return SPEND; }

    isBonus(k) { return this.type.isBonus(k); }
    max(k) { return this.type.max(k); }
    rate(k) { return this.isBonus(k) ? 1 : 2; }   // hearts per point covered

    total() { return KEYS.reduce((s, k) => s + this.attrs[k], 0); }
    lowest() { return Math.min(...KEYS.map(k => this.attrs[k])); }
    highestKey() { return KEYS.reduce((m, k) => (this.attrs[k] > this.attrs[m] ? k : m), KEYS[0]); }
    lowestKey() { return KEYS.reduce((m, k) => (this.attrs[k] < this.attrs[m] ? k : m), KEYS[0]); }

    isStuck() { return this.glitches >= 2; }
    isGlitching() { return KEYS.some(k => this.attrs[k] < 0); }   // exactly 0 is safe
    isAtRisk() {
      return KEYS.some(k => this.attrs[k] + Math.floor(this.hearts.count / this.rate(k)) < AT_RISK_COST);
    }
    /* What other players see. Never numbers. */
    flag() {
      if (this.isStuck()) return "Stuck";
      if (this.isGlitching()) return "Glitching";
      if (this.isAtRisk()) return "At risk";
      return "OK";
    }

    /* Stat abilities (Part 4b). The stat's value right now: negative counts as 0, max 10. */
    abilityValue(k) { return Math.max(0, Math.min(10, this.attrs[k])); }
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
    abilityLines() {
      return KEYS.map(k => {
        const v = this.abilityValue(k), a = ABILITY[k];
        const amount = k === "initiative" ? "x" + this.voteWeight().toFixed(1) : Math.round(v * a.per * 100) + "%";
        return { key: k, value: v, text: a.name + " " + v + ": " + amount + " " + a.what };
      });
    }

    /* Caught by this team: no sabotage while on it. Switching teams allows sabotage again. */
    wasCaughtBy(teamId) { return this.caughtBy.includes(teamId); }
    markCaughtBy(teamId) {
      this.caughtThisRound = true;
      if (!this.wasCaughtBy(teamId)) this.caughtBy.push(teamId);
    }

    resetRoundFlags() {
      this.sabotagesThisRound = 0;
      this.caughtThisRound = false;
      this.wasSabotagedThisRound = false;
      this.accusedThisRound = false;
      this.correctAccusation = false;
      this.glitchedThisRound = false;
      this.earned = 0;
    }

    /* Lose points from one attribute, from any cause. Hearts cover any shortfall below 0. */
    lose(k, n) {
      this.attrs[k] -= n;
      this.cover(k);
    }

    cover(k) {
      if (this.attrs[k] >= 0) return 0;
      const short = -this.attrs[k];
      const r = this.rate(k);
      const covered = Math.min(short, Math.floor(this.hearts.count / r));
      this.hearts.spend(covered * r);
      this.attrs[k] += covered;
      return covered * r;   // hearts used
    }

    /* Trial cost. Glitching players pay too. Stuck players do not. */
    payTrial(k, cost) {
      if (this.isStuck()) return null;
      const before = this.attrs[k], heartsBefore = this.hearts.count;
      this.lose(k, cost);
      return { attr: k, before, after: this.attrs[k], heartsUsed: heartsBefore - this.hearts.count };
    }

    /* Wrong accusation penalty. Ties go to the first attribute in KEYS order. */
    takeFromHighest(n) {
      for (let i = 0; i < n; i++) this.lose(this.highestKey(), 1);
    }

    /* Where a gift point goes. Glitching: the glitching attribute (lowest first if two are below 0).
       Not glitching: the lowest attribute that still has room below its max.
       Ties: Focus, Collaboration, Initiative, Grit, Composure. The receiver does not pick.
       Returns null if every attribute is at its max. */
    giftTarget() {
      const pool = this.isGlitching() ? KEYS.filter(k => this.attrs[k] < 0)
                                      : KEYS.filter(k => this.attrs[k] < this.max(k));
      const order = GIFT_TIE_ORDER.filter(k => pool.includes(k));
      if (!order.length) return null;
      return order.reduce((m, k) => (this.attrs[k] < this.attrs[m] ? k : m));
    }

    /* Points past 0 stay in that attribute. If it fills up, the next point goes to the
       lowest attribute that still has room. Returns points with nowhere to go (overflow, refunded). */
    receiveGift(pts) {
      let target = this.giftTarget();
      let overflow = 0;
      for (let i = 0; i < pts; i++) {
        if (this.isGlitching() || target === null || this.attrs[target] >= this.max(target)) target = this.giftTarget();
        if (target !== null && this.attrs[target] < this.max(target)) this.attrs[target] += 1;
        else overflow += 1;
      }
      return overflow;
    }

    /* Lock-in: if still below 0, the glitch counts. Reboot. Returns true if a glitch locked in. */
    lockIn() {
      if (this.isStuck() || !this.isGlitching()) return false;
      this.glitches += 1;
      this.glitchedThisRound = true;
      this.reboot();
      return true;
    }

    /* Take points evenly from the other attributes until the glitched one reaches 1.
       Any shortfall the others cannot cover is forgiven: it still ends at 1. Hearts set to 0. */
    reboot() {
      for (const k of KEYS) {
        if (this.attrs[k] >= 0) continue;
        const need = 1 - this.attrs[k];
        let got = 0;
        while (got < need) {
          const donors = KEYS.filter(d => d !== k && this.attrs[d] > 0)
                             .sort((a, b) => this.attrs[b] - this.attrs[a]);
          if (!donors.length) break;
          for (const d of donors) {
            if (got >= need) break;
            this.attrs[d] -= 1; got += 1;
          }
        }
        this.attrs[k] = 1;   // always reboots to 1, shortfall forgiven
      }
      this.hearts.empty();
    }

    /* Cash Out (Independent): once per game, needs full hearts, 2 hearts for 1 point. */
    canCashOut() {
      return this.type.hasCashOut() && !this.isStuck() && this.cashOutUsed < CASHOUT_USES &&
             this.hearts.isFull() && this.hearts.has(CASHOUT_COST);
    }
    cashOut() {
      if (!this.canCashOut()) return false;
      this.hearts.spend(CASHOUT_COST);
      this.cashOutUsed += 1;
      this.earned += 1;
      return true;
    }

    /* Skim (Contrarian): +1 per uncaught sabotage round, max 2 per game. */
    takeSkim() {
      if (!this.type.hasSkim() || this.sabotagesThisRound === 0 || this.caughtThisRound) return 0;
      if (this.skimUsed >= SKIM_MAX) return 0;
      this.skimUsed += 1;
      return 1;
    }

    /* Place earned points. alloc = { focus: n, ... }. Must use all points and respect max. */
    placePoints(alloc) {
      const n = KEYS.reduce((s, k) => s + (alloc[k] || 0), 0);
      if (n !== this.earned) throw new Error("Place exactly " + this.earned + " points");
      for (const k of KEYS) {
        if ((alloc[k] || 0) < 0) throw new Error("No negative placement");
        if (this.attrs[k] + (alloc[k] || 0) > this.max(k)) throw new Error(k + " would pass its max");
      }
      for (const k of KEYS) this.attrs[k] += alloc[k] || 0;
      this.earned = 0;
    }
    /* True if there is room left to place points at all. */
    roomLeft() { return KEYS.reduce((s, k) => s + (this.max(k) - this.attrs[k]), 0); }

    /* An event happened (rescue, correctAccusation, uncaughtSabotage). It counts only if it is
       this type's second-path event. Returns true if it counted. */
    creditPath(event) {
      if (!this.type.pathCounts(event) || this.pathDone) return false;
      this.pathProgress += 1;
      if (this.pathProgress >= this.type.goal) this.pathDone = true;
      return true;
    }

    graduates() {
      return !this.isStuck() && this.total() >= GRAD_TOTAL && this.lowest() >= GRAD_MIN;
    }
    wins() { return this.graduates() || this.pathDone; }
    ending() {
      if (this.graduates()) return "Graduated";
      if (this.pathDone) return this.type.pathName + " complete";
      return "Contract renewed";
    }
  }

  Player.ABILITY = ABILITY;
  Player.AT_RISK_COST = AT_RISK_COST;
  Player.GRAD_TOTAL = GRAD_TOTAL;
  Player.GRAD_MIN = GRAD_MIN;
  Player.SKIM_MAX = SKIM_MAX;
  Player.CASHOUT_COST = CASHOUT_COST;
  EP.Player = Player;
  if (typeof module !== "undefined" && module.exports) module.exports = Player;
})(typeof globalThis !== "undefined" ? globalThis : this);
