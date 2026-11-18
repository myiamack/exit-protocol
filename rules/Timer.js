/* Timer: step timer deadlines and injected clock for Game (Step 4).
   Stores the running flag and current { name, key, deadline }, never seconds left.
   Rule code only. No screen code. */

class Timer {
  constructor({ clock = () => Date.now(), durations = {}, getPhase, onStart = null, onClose }) {
    this.clock = clock;
    this.durations = durations;
    this.getPhase = getPhase;
    this.onStart = onStart;
    this.onClose = onClose;
    this.running = false;
    this.current = null;
    this.at = null;
  }
  /* The time rules use: the clock, except while a timer closes (then that timer's deadline). */
  now() { return this.at != null ? this.at : this.clock(); }
  /* Start the step timers (the first intermission starts counting now). */
  start() { this.running = true; this.refresh(); return this.current; }
  /* Called after every change that can start or end a timed phase. A new phase gets a deadline from now(). */
  refresh() {
    if (!this.running) return;
    const phase = this.getPhase();
    const name = phase ? phase.name : null;
    const key = phase ? phase.key : null;
    if (key === (this.current ? this.current.key : null)) return;
    this.current = name ? { name, key, deadline: this.now() + this.durations[name] * 1000 } : null;
    if (name && this.onStart) this.onStart(name);
  }
  /* Seconds left on the running timer (for the screen countdown), or null if none. */
  secondsLeft(now = this.clock()) { return this.current ? Math.max(0, Math.ceil((this.current.deadline - now) / 1000)) : null; }
  /* Close every timer whose deadline has passed, in order. Returns the names closed. */
  tick(now = this.clock()) {
    const closed = [];
    while (this.current && now >= this.current.deadline) {
      if (closed.length > 50) throw new Error("Timer loop.");
      closed.push(this.current.name);
      this.closeAt(this.current.deadline);
    }
    return closed;
  }
  /* End the running timed phase early. Same end rules as the timer. */
  close(now = this.clock()) {
    if (!this.current) return null;
    const name = this.current.name;
    this.closeAt(now);
    return name;
  }
  closeAt(at) {
    const t = this.current;
    this.at = at;
    try {
      this.onClose(t.name);
    } finally { this.at = null; }
    if (this.current === t) this.current = null;
  }
  toJSON() {
    return { running: this.running, timer: this.current ? { ...this.current } : null };
  }
  restore(data) {
    this.running = !!data.running;
    this.current = data.timer ? { ...data.timer } : null;
    this.at = null;
  }
}

export { Timer };
