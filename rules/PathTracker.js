/* PathTracker: second path progress, graduation checks, and locked ending (Step 10).
   Rule code only. No screen code. */

const GRAD_TOTAL = 24, GRAD_MIN = 2;

class PathTracker {
  #player;
  #pathProgress = 0;
  #pathDone = false;
  #locked = null;   // { ending, wins }, set once by Game.results()

  constructor(player) { this.#player = player; }

  get pathProgress() { return this.#pathProgress; }
  get pathDone() { return this.#pathDone; }
  set pathDone(v) { this.#pathDone = !!v; }
  get locked() { return this.#locked; }

  /* An event happened (rescue, correctAccusation, uncaughtSabotage). It counts only if it is
     this type's second-path event. Returns true if it counted. */
  creditPath(event) {
    const t = this.#player.type;
    if (!t.pathCounts(event) || this.#pathDone) return false;
    this.#pathProgress += 1;
    if (this.#pathProgress >= t.goal) this.#pathDone = true;
    return true;
  }

  /* The three graduation checks, for the Stats Update screen. */
  gradChecks() {
    const p = this.#player;
    const total = p.total(), lowest = p.lowest();
    return { total, totalOk: total >= GRAD_TOTAL, lowest, lowestOk: lowest >= GRAD_MIN,
             glitches: p.glitches, glitchesOk: !p.isStuck() };
  }
  graduates() {
    const p = this.#player;
    return !p.isStuck() && p.total() >= GRAD_TOTAL && p.lowest() >= GRAD_MIN;
  }
  /* After Game.results() the ending is locked: wins() and ending() return the locked values. */
  lockEnding() {
    if (this.#locked) return;
    const ending = this.ending(), wins = this.wins();
    this.#locked = Object.freeze({ ending, wins });
  }
  /* Idle at Graduation (when results() runs): Contract renewed, even if the stats would graduate.
     A second path already completed still wins. */
  wins() {
    if (this.#locked) return this.#locked.wins;
    return (this.graduates() && !this.#player.idle) || this.#pathDone;
  }
  ending() {
    if (this.#locked) return this.#locked.ending;
    if (this.graduates() && !this.#player.idle) return "Graduated";
    if (this.#pathDone) return this.#player.type.pathName + " complete";
    return "Contract renewed";
  }

  toJSON() {
    return {
      pathProgress: this.#pathProgress,
      pathDone: this.#pathDone,
      locked: this.#locked ? { ...this.#locked } : null,
    };
  }
  static fromJSON(player, data) {
    const pt = new PathTracker(player);
    pt.#pathProgress = data.pathProgress || 0;
    pt.#pathDone = !!data.pathDone;
    pt.#locked = data.locked ? Object.freeze({ ...data.locked }) : null;
    return pt;
  }
}

PathTracker.GRAD_TOTAL = GRAD_TOTAL;
PathTracker.GRAD_MIN = GRAD_MIN;

export { PathTracker };
