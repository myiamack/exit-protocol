/* Player: one intern. Coordinates type, hearts, attributes, status, second path, and wallet.
   Rule code only. No screen code. Works in the browser and in Node. */
import { Attributes } from "./Attributes.js";
import { CharacterType } from "./CharacterType.js";
import { Hearts } from "./Hearts.js";
import { PathTracker } from "./PathTracker.js";
import { PlayerStatus } from "./PlayerStatus.js";
import { Wallet } from "./Wallet.js";


const KEYS = Attributes.KEYS;
const TIE_ORDER = Attributes.TIE_ORDER;
const START_EACH = Attributes.START_EACH;
const SPEND = Attributes.SPEND;
const BOOST = Attributes.BOOST;
const ABILITY = Attributes.ABILITY;
const AT_RISK_COST = PlayerStatus.AT_RISK_COST;
const STUCK_AT = PlayerStatus.STUCK_AT;
const GRAD_TOTAL = PathTracker.GRAD_TOTAL;
const GRAD_MIN = PathTracker.GRAD_MIN;
const SKIM_MAX = Wallet.SKIM_MAX, CASHOUT_COST = Wallet.CASHOUT_COST;
const STATUS_KEYS = ["glitches", "idle", "attendancePending"];
const PATH_KEYS = ["pathProgress", "pathDone", "locked"];
const WALLET_KEYS = ["earned", "draft", "placedThisRound", "skimUsed", "cashOutUsed", "cashedOutThisRound"];
const PART_KEYS = ["attrs", ...STATUS_KEYS, ...PATH_KEYS, ...WALLET_KEYS];
const FROM_JSON = Symbol();

class Player {
  #attributes;
  #status;
  #pathTracker;
  #wallet;

  /* type: a key ("coop", "indep", "contra") or a CharacterType.
     spend: { focus: n, ... } adding up to 15. Boost is added here. */
  constructor(opts) {
    if (opts === FROM_JSON) return;
    const { id, name, type, spend, isBot = false } = opts;
    this.id = id;
    this.name = name;
    this.type = CharacterType.get(type);
    this.isBot = isBot;
    this.teamId = null;

    this.#attributes = new Attributes(this, spend);
    this.hearts = new Hearts();
    this.#status = new PlayerStatus(this);
    this.lastActivity = null;   // time of the last key, click or touch (read by the Attendance check, Part 7)
    this.attendanceMissAt = null;   // time of the last missed Attendance check (restarts the timer)
    this.attendancePopupAt = null;  // time the "Still there?" popup opened; null when closed
    this.attendancePaused = false;  // true on screens with no input (intro, briefings, intermissions)
    this.attendanceResumeAt = null; // time the timer last resumed (starts a fresh clock)

    this.#pathTracker = new PathTracker(this);

    // Contrarian
    this.caughtBy = [];   // ids of teams that caught this player sabotaging
    this.#wallet = new Wallet(this);

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
  heartCount() { return this.hearts.count; }
  spendHearts(n) { return this.hearts.spend(n); }

  get attrs() { return this.#attributes.attrs; }
  setAttrsForTest(values) { this.#attributes.setAttrsForTest(values); }
  rate(k) { return this.#attributes.rate(k); }
  attr(k) { return this.#attributes.attr(k); }
  addAttr(k, delta) { this.#attributes.addAttr(k, delta); }

  total() { return this.#attributes.total(); }
  lowest() { return this.#attributes.lowest(); }
  highestKey() { return this.#attributes.highestKey(); }
  lowestKey() { return this.#attributes.lowestKey(); }
  highestKeyIn(order) { return this.#attributes.highestKeyIn(order); }

  get glitches() { return this.#status.glitches; }
  set glitches(n) { this.#status.glitches = n; }
  get idle() { return this.#status.idle; }
  set idle(v) { this.#status.idle = v; }
  get attendancePending() { return this.#status.attendancePending; }
  set attendancePending(v) { this.#status.attendancePending = v; }

  isStuck() { return this.#status.isStuck(); }
  isActive() { return this.#status.isActive(); }
  /* Any input (including typing a submission) counts as activity and resets the Attendance check. */
  markActive(now = Date.now()) { this.lastActivity = now; }
  isGlitching() { return this.#status.isGlitching(); }
  isGlitchingAny() { return this.#status.isGlitchingAny(); }
  isAtRisk() { return this.#status.isAtRisk(); }
  flag() { return this.#status.flag(); }
  boardStatus() { return this.#status.boardStatus(); }

  abilityValue(k) { return this.#attributes.abilityValue(k); }
  abilityChance(k) { return this.#attributes.abilityChance(k); }
  voteWeight() { return this.#attributes.voteWeight(); }
  rollAbility(k, rng) { return this.#attributes.rollAbility(k, rng); }
  abilityLines() { return this.#attributes.abilityLines(); }

  /* Caught by this team: no sabotage while on it. Switching teams allows sabotage again. */
  wasCaughtBy(teamId) { return this.caughtBy.includes(teamId); }
  /* Caught: costs no points. No sabotage on any team next round (see resetRoundFlags),
     then no sabotage while on a team that caught them. Exploit is never lost. */
  markCaughtBy(teamId) {
    this.caughtThisRound = true;
    if (!this.wasCaughtBy(teamId)) this.caughtBy.push(teamId);
  }

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
    this.#status.attendancePending = false;  // missed check-in, not yet locked: Glitching until a gift saves it or it locks in
    this.attendanceGlitchThisRound = false;  // this round's locked glitch came only from a missed check-in
    this.#wallet.resetRound();
  }

  /* Save (Part 13): plain data only. type is saved as its key, hearts as the count. */
  toJSON() {
    const out = {};
    for (const [k, v] of Object.entries(this)) {
      if (k === "type") out.type = v.key;
      else if (k === "hearts") { out.hearts = v.count; out.glitches = this.#status.glitches; out.idle = this.#status.idle; }
      else {
        out[k] = v === undefined ? null : JSON.parse(JSON.stringify(v));
        if (k === "teamId") out.attrs = this.#attributes.toJSON();
        else if (k === "attendanceResumeAt") Object.assign(out, this.#pathTracker.toJSON());
        else if (k === "caughtBy") Object.assign(out, this.#wallet.toJSON());
        else if (k === "attendanceMissesThisRound") out.attendancePending = this.#status.attendancePending;
      }
    }
    return out;
  }
  /* Load: rebuild a Player from toJSON() data, without re-running character creation. */
  static fromJSON(data) {
    const p = new Player(FROM_JSON);
    for (const [k, v] of Object.entries(data)) {
      if (PART_KEYS.includes(k)) continue;
      p[k] = v === null || typeof v !== "object" ? v : JSON.parse(JSON.stringify(v));
    }
    p.type = CharacterType.get(data.type);
    p.hearts = new Hearts(data.hearts);
    p.#attributes = Attributes.fromJSON(p, data);
    p.#status = PlayerStatus.fromJSON(p, data);
    p.#pathTracker = PathTracker.fromJSON(p, data);
    p.#wallet = Wallet.fromJSON(p, data);
    return p;
  }

  lose(k, n) { this.#attributes.lose(k, n); }
  cover(k) { return this.#attributes.cover(k); }
  payTrial(k, cost) { return this.#attributes.payTrial(k, cost); }
  takeFromHighest(n) { this.#attributes.takeFromHighest(n); }
  giftTarget() { return this.#attributes.giftTarget(); }
  receiveGift(pts) { return this.#attributes.receiveGift(pts); }

  /* Lock-in: if still below 0, or a missed check-in is still pending, the glitch counts. Reboot.
     An attribute glitch and an attendance glitch in the same round count as one glitch.
     Returns true if a glitch locked in. */
  lockIn() {
    if (this.isStuck() || !this.isGlitchingAny()) return false;
    if (this.glitchedThisRound && !this.isGlitching()) { this.#status.attendancePending = false; return false; }   // counts as one
    if (!this.isGlitching()) this.attendanceGlitchThisRound = true;   // attendance only
    this.#status.attendancePending = false;
    this.#status.addGlitch();
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

  /* Reboot: reset any glitched attributes to 1 (donors cover evenly), then empty hearts. */
  reboot() {
    this.#attributes.reboot();
    this.hearts.empty();
  }

  get earned() { return this.#wallet.earned; }
  set earned(n) { this.#wallet.earned = n; }
  get draft() { return this.#wallet.draft; }
  get placedThisRound() { return this.#wallet.placedThisRound; }
  get skimUsed() { return this.#wallet.skimUsed; }
  get cashOutUsed() { return this.#wallet.cashOutUsed; }
  get cashedOutThisRound() { return this.#wallet.cashedOutThisRound; }

  canCashOut() { return this.#wallet.canCashOut(); }
  cashOut() { return this.#wallet.cashOut(); }
  takeSkim() { return this.#wallet.takeSkim(); }
  placePoints(alloc) { this.#wallet.placePoints(alloc); }
  placeLeft(place) { return this.#wallet.placeLeft(place); }
  canPlace(place, k) { return this.#wallet.canPlace(place, k); }
  canUnplace(place, k) { return this.#wallet.canUnplace(place, k); }
  coversFromPoints(k, cost) { return this.#wallet.coversFromPoints(k, cost); }
  roomLeft() { return this.#wallet.roomLeft(); }

  get pathProgress() { return this.#pathTracker.pathProgress; }
  get pathDone() { return this.#pathTracker.pathDone; }
  set pathDone(v) { this.#pathTracker.pathDone = v; }
  get locked() { return this.#pathTracker.locked; }

  creditPath(event) { return this.#pathTracker.creditPath(event); }
  gradChecks() { return this.#pathTracker.gradChecks(); }
  graduates() { return this.#pathTracker.graduates(); }
  lockEnding() { this.#pathTracker.lockEnding(); }
  wins() { return this.#pathTracker.wins(); }
  ending() { return this.#pathTracker.ending(); }
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
