/* PlayerStatus: glitches, idle, pending attendance glitch, and status flags (Step 6).
   Only reads stats and hearts through Player; never changes them.
   Rule code only. No screen code. */

const KEYS = ["focus", "initiative", "collab", "composure", "grit"];
const AT_RISK_COST = 3;
const STUCK_AT = 2;

class PlayerStatus {
  #player;
  #glitches = 0;
  #idle = false;
  #attendancePending = false;

  constructor(player) { this.#player = player; }

  get glitches() { return this.#glitches; }
  set glitches(n) { this.#glitches = n; }
  get idle() { return this.#idle; }
  set idle(v) { this.#idle = !!v; }
  get attendancePending() { return this.#attendancePending; }
  set attendancePending(v) { this.#attendancePending = !!v; }

  addGlitch() { this.#glitches += 1; }
  isStuck() { return this.#glitches >= STUCK_AT; }
  isActive() { return !this.isStuck() && !this.#idle; }
  isGlitching() { return KEYS.some(k => this.#player.attr(k) < 0); }
  isGlitchingAny() { return this.isGlitching() || this.#attendancePending; }
  isAtRisk() {
    return KEYS.some(k => this.#player.attr(k) + Math.floor(this.#player.hearts.count / this.#player.rate(k)) < AT_RISK_COST);
  }

  /* What other players see. Never numbers. */
  flag() {
    if (this.isStuck()) return "Stuck";
    if (this.isGlitchingAny()) return "Glitching";
    if (this.isAtRisk()) return "At risk";
    return "OK";
  }
  /* Progress board status. First that applies: Stuck, Glitching, Idle, At risk, Active. */
  boardStatus() {
    if (this.isStuck()) return "Stuck";
    if (this.isGlitchingAny()) return "Glitching";
    if (this.#idle) return "Idle";
    if (this.isAtRisk()) return "At risk";
    return "Active";
  }

  toJSON() {
    return { glitches: this.#glitches, idle: this.#idle, attendancePending: this.#attendancePending };
  }
  static fromJSON(player, data) {
    const s = new PlayerStatus(player);
    s.#glitches = data.glitches || 0;
    s.#idle = !!data.idle;
    s.#attendancePending = !!data.attendancePending;
    return s;
  }
}

PlayerStatus.AT_RISK_COST = AT_RISK_COST;
PlayerStatus.STUCK_AT = STUCK_AT;

export { PlayerStatus };
