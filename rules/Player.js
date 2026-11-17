/* Player: one intern. Holds type, 5 attributes, hearts, glitches, flags, second path.
   Rule code only. No screen code. Works in the browser and in Node. */
import { CharacterType } from "./CharacterType.js";
import { Hearts } from "./Hearts.js";
import { Wallet } from "./Wallet.js";


const KEYS = ["focus", "initiative", "collab", "composure", "grit"];
const TIE_ORDER = ["focus", "collab", "initiative", "grit", "composure"];   // the usual tie order
const GIFT_TIE_ORDER = TIE_ORDER;

const START_EACH = 1;      // every attribute starts at 1
const SPEND = 15;          // points the player spends at creation
const BOOST = 2;           // type boost per bonus attribute
const AT_RISK_COST = 3;
const STUCK_AT = 2;        // locked glitches of any kind that make a player Stuck
const GRAD_TOTAL = 24, GRAD_MIN = 2;
const SKIM_MAX = Wallet.SKIM_MAX, CASHOUT_COST = Wallet.CASHOUT_COST;
const WALLET_KEYS = ["earned", "draft", "placedThisRound", "skimUsed", "cashOutUsed", "cashedOutThisRound"];

/* Stat abilities (Part 4b). per = chance per stat point. */
const ABILITY = {
  focus:      { name: "Focus",         per: 0.10, what: "safe accusation" },
  collab:     { name: "Collaboration", per: 0.10, what: "gift costs 1 heart less (min 1)" },
  initiative: { name: "Initiative",    per: 0,    what: "vote points (applies in Levels 5 and 6)" },
  grit:       { name: "Grit",          per: 0.05, what: "extra heart at round end" },
  composure:  { name: "Composure",     per: 0.10, what: "sabotage drains only 1" },
};

class Player {
  /* type: a key ("coop", "indep", "contra") or a CharacterType.
     spend: { focus: n, ... } adding up to 15. Boost is added here. */
  constructor({ id, name, type, spend, isBot = false }) {
    this.id = id;
    this.name = name;
    this.type = CharacterType.get(type);
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

    this.hearts = new Hearts();
    this.glitches = 0;
    this.idle = false;          // Part 8: set by any missed Attendance check; cleared by the next input
    this.lastActivity = null;   // time of the last key, click or touch (read by the Attendance check, Part 7)
    this.attendanceMissAt = null;   // time of the last missed Attendance check (restarts the timer)
    this.attendancePopupAt = null;  // time the "Still there?" popup opened; null when closed
    this.attendancePaused = false;  // true on screens with no input (intro, briefings, intermissions)
    this.attendanceResumeAt = null; // time the timer last resumed (starts a fresh clock)

    // second path
    this.pathProgress = 0;
    this.pathDone = false;
    this.locked = null;   // { ending, wins }, set once by Game.results()

    // Contrarian
    this.caughtBy = [];   // ids of teams that caught this player sabotaging
    this.wallet = new Wallet(this);

    this.resetRoundFlags();
  }

  static get KEYS() { return KEYS; }
  static get SPEND() { return SPEND; }
  static get START_EACH() { return START_EACH; }
  static get BOOST() { return BOOST; }

  /* Character creation draft, before the Player exists. spend = { focus: n, ... } points added (0 or more). */
  static spendLeft(spend) { return SPEND - KEYS.reduce((s, k) => s + (spend[k] || 0), 0); }
  /* Starting value with the type boost. */
  static startValue(type, spend, k) {
    return START_EACH + (spend[k] || 0) + (CharacterType.get(type).isBonus(k) ? BOOST : 0);
  }
  static canRaise(type, spend, k) {
    return Player.spendLeft(spend) > 0 && Player.startValue(type, spend, k) < CharacterType.get(type).max(k);
  }
  static canLower(spend, k) { return (spend[k] || 0) > 0; }

  isBonus(k) { return this.type.isBonus(k); }
  max(k) { return this.type.max(k); }
  rate(k) { return this.isBonus(k) ? 1 : 2; }   // hearts per point covered
  attr(k) { return this.attrs[k]; }
  addAttr(k, delta) { this.attrs[k] += delta; }

  total() { return KEYS.reduce((s, k) => s + this.attrs[k], 0); }
  lowest() { return Math.min(...KEYS.map(k => this.attrs[k])); }
  highestKey() { return KEYS.reduce((m, k) => (this.attrs[k] > this.attrs[m] ? k : m), KEYS[0]); }
  lowestKey() { return KEYS.reduce((m, k) => (this.attrs[k] < this.attrs[m] ? k : m), KEYS[0]); }

  isStuck() { return this.glitches >= STUCK_AT; }
  /* Active: not Stuck and not idle (Part 8). Used for team counts, the vote math and the light influence. */
  isActive() { return !this.isStuck() && !this.idle; }
  /* Any input (including typing a submission) counts as activity and resets the Attendance check. */
  markActive(now = Date.now()) { this.lastActivity = now; }
  isGlitching() { return KEYS.some(k => this.attrs[k] < 0); }   // an attribute below 0; exactly 0 is safe
  /* Glitching for any reason: an attribute below 0, or a missed check-in waiting to lock in.
     This is what the player and their teammates see. */
  isGlitchingAny() { return this.isGlitching() || this.attendancePending; }
  isAtRisk() {
    return KEYS.some(k => this.attrs[k] + Math.floor(this.hearts.count / this.rate(k)) < AT_RISK_COST);
  }
  /* What other players see. Never numbers. */
  flag() {
    if (this.isStuck()) return "Stuck";
    if (this.isGlitchingAny()) return "Glitching";
    if (this.isAtRisk()) return "At risk";
    return "OK";
  }
  /* Progress board status. First that applies: Stuck, Glitching, Idle, At risk, Active. Same At risk rule as flag(). */
  boardStatus() {
    if (this.isStuck()) return "Stuck";
    if (this.isGlitchingAny()) return "Glitching";
    if (this.idle) return "Idle";
    if (this.isAtRisk()) return "At risk";
    return "Active";
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
  /* Caught: costs no points. No sabotage on any team next round (see resetRoundFlags),
     then no sabotage while on a team that caught them. Exploit is never lost. */
  markCaughtBy(teamId) {
    this.caughtThisRound = true;
    if (!this.wasCaughtBy(teamId)) this.caughtBy.push(teamId);
  }
  /* Highest attribute; ties go to the first in the given order. */
  highestKeyIn(order) { return order.reduce((m, k) => (this.attrs[k] > this.attrs[m] ? k : m), order[0]); }

  resetRoundFlags() {
    // Caught last round: no sabotage on any team this round.
    this.sabotageBlockedThisRound = !!this.caughtThisRound;
    this.sabotagesThisRound = 0;
    this.caughtThisRound = false;
    this.wasSabotagedThisRound = false;
    this.accusedThisRound = false;
    this.correctAccusation = false;
    this.glitchedThisRound = false;
    this.attendanceMissesThisRound = 0;      // counted misses (max 1 per round); a miss saved by a gift still counts
    this.attendancePending = false;          // missed check-in, not yet locked: Glitching until a gift saves it or it locks in
    this.attendanceGlitchThisRound = false;  // this round's locked glitch came only from a missed check-in
    this.wallet.resetRound();
  }

  /* Save (Part 13): plain data only. type is saved as its key, hearts as the count. */
  toJSON() {
    const out = {};
    for (const [k, v] of Object.entries(this)) {
      if (k === "type") out.type = v.key;
      else if (k === "hearts") out.hearts = v.count;
      else if (k === "wallet") Object.assign(out, v.toJSON());
      else out[k] = v === undefined ? null : JSON.parse(JSON.stringify(v));
    }
    return out;
  }
  /* Load: rebuild a Player from toJSON() data, without re-running character creation. */
  static fromJSON(data) {
    const p = Object.create(Player.prototype);
    for (const [k, v] of Object.entries(data)) {
      if (WALLET_KEYS.includes(k)) {
        if (!p.wallet) p.wallet = Wallet.fromJSON(p, data);
        continue;
      }
      p[k] = v === null || typeof v !== "object" ? v : JSON.parse(JSON.stringify(v));
    }
    p.type = CharacterType.get(data.type);
    p.hearts = new Hearts(data.hearts);
    if (!p.wallet) p.wallet = Wallet.fromJSON(p, data);
    if (p.locked) p.locked = Object.freeze(p.locked);
    return p;
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

  /* Wrong accusation penalty. Ties: Focus, Collaboration, Initiative, Grit, Composure. */
  takeFromHighest(n) {
    for (let i = 0; i < n; i++) this.lose(this.highestKeyIn(TIE_ORDER), 1);
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

  /* Lock-in: if still below 0, or a missed check-in is still pending, the glitch counts. Reboot.
     An attribute glitch and an attendance glitch in the same round count as one glitch.
     Returns true if a glitch locked in. */
  lockIn() {
    if (this.isStuck() || !this.isGlitchingAny()) return false;
    if (this.glitchedThisRound && !this.isGlitching()) { this.attendancePending = false; return false; }   // counts as one
    if (!this.isGlitching()) this.attendanceGlitchThisRound = true;   // attendance only
    this.attendancePending = false;
    this.glitches += 1;
    this.glitchedThisRound = true;
    this.reboot();
    return true;
  }

  /* A missed check-in after the gift window closed locks in at once, with the same reboot
     (hearts to 0; no attribute refill, because no attribute is below 0).
     If a glitch already locked in this round, they count as one: nothing more happens.
     Returns true if a glitch locked in. */
  lockAttendanceGlitch() {
    if (this.isStuck() || this.glitchedThisRound) return false;
    this.attendancePending = true;
    return this.lockIn();
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

  get earned() { return this.wallet.earned; }
  set earned(n) { this.wallet.earned = n; }
  get draft() { return this.wallet.draft; }
  set draft(d) { this.wallet.draft = d; }
  get placedThisRound() { return this.wallet.placedThisRound; }
  set placedThisRound(n) { this.wallet.placedThisRound = n; }
  get skimUsed() { return this.wallet.skimUsed; }
  get cashOutUsed() { return this.wallet.cashOutUsed; }
  get cashedOutThisRound() { return this.wallet.cashedOutThisRound; }

  canCashOut() { return this.wallet.canCashOut(); }
  cashOut() { return this.wallet.cashOut(); }
  takeSkim() { return this.wallet.takeSkim(); }
  placePoints(alloc) { this.wallet.placePoints(alloc); }
  placeLeft(place) { return this.wallet.placeLeft(place); }
  canPlace(place, k) { return this.wallet.canPlace(place, k); }
  canUnplace(place, k) { return this.wallet.canUnplace(place, k); }
  coversFromPoints(k, cost) { return this.wallet.coversFromPoints(k, cost); }
  roomLeft() { return this.wallet.roomLeft(); }

  /* An event happened (rescue, correctAccusation, uncaughtSabotage). It counts only if it is
     this type's second-path event. Returns true if it counted. */
  creditPath(event) {
    if (!this.type.pathCounts(event) || this.pathDone) return false;
    this.pathProgress += 1;
    if (this.pathProgress >= this.type.goal) this.pathDone = true;
    return true;
  }

  /* The three graduation checks, for the Stats Update screen. */
  gradChecks() {
    const total = this.total(), lowest = this.lowest();
    return { total, totalOk: total >= GRAD_TOTAL, lowest, lowestOk: lowest >= GRAD_MIN,
             glitches: this.glitches, glitchesOk: !this.isStuck() };
  }
  graduates() {
    return !this.isStuck() && this.total() >= GRAD_TOTAL && this.lowest() >= GRAD_MIN;
  }
  /* After Game.results() the ending is locked: wins() and ending() return the locked values. */
  lockEnding() {
    if (this.locked) return;
    const ending = this.ending(), wins = this.wins();
    this.locked = Object.freeze({ ending, wins });
  }
  /* Idle at Graduation (when results() runs): Contract renewed, even if the stats would graduate.
     A second path already completed still wins. */
  wins() {
    if (this.locked) return this.locked.wins;
    return (this.graduates() && !this.idle) || this.pathDone;
  }
  ending() {
    if (this.locked) return this.locked.ending;
    if (this.graduates() && !this.idle) return "Graduated";
    if (this.pathDone) return this.type.pathName + " complete";
    return "Contract renewed";
  }
}

Player.ABILITY = ABILITY;
Player.TIE_ORDER = TIE_ORDER;
Player.AT_RISK_COST = AT_RISK_COST;
Player.STUCK_AT = STUCK_AT;
Player.GRAD_TOTAL = GRAD_TOTAL;
Player.GRAD_MIN = GRAD_MIN;
Player.SKIM_MAX = SKIM_MAX;
Player.CASHOUT_COST = CASHOUT_COST;

export { Player };
