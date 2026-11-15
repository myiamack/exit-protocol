/* Attendance: checks that each player is still at the keyboard.
   Any input resets a timer: key press, click, touch, mouse movement (counted at most once per second) or scrolling. After idleMs with no input, a popup opens with a
   popupMs countdown. No input before it ends: +1 glitch count, attributes unchanged.
   At most maxPerRound Attendance glitches per player per round. Two glitches of any kind = Stuck
   (Player.isStuck already counts every glitch).
   Rule code only. No screen code, no clock: the caller passes the time (ms) in, so tests can fake it.
   The screen calls activity() on every input and check() about once a second.
   The timer runs only on screens that need input: the screen calls pause() when the intro, a briefing or
   an intermission opens, and resume() when it closes. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  // Host dials. Defaults: 60 s idle, 15 s popup, 1 Attendance glitch per player per round.
  const DEFAULTS = { idleMs: 60000, popupMs: 15000, maxPerRound: 1 };

  class Attendance {
    constructor(settings = {}) {
      this.settings = { ...DEFAULTS };
      this.set(settings);
    }
    static get DEFAULTS() { return { ...DEFAULTS }; }

    /* Change any setting. Each must be a whole number, 0 or more (idle and popup above 0). */
    set(settings = {}) {
      for (const [k, v] of Object.entries(settings)) {
        if (!(k in DEFAULTS)) throw new Error("No Attendance setting " + k + ".");
        if (!Number.isInteger(v) || v < 0 || (k !== "maxPerRound" && v === 0)) throw new Error("Bad value for " + k + ": " + v);
        this.settings[k] = v;
      }
      return this.settings;
    }

    /* Any input. Resets the timer and closes the popup. */
    activity(p, now) { p.markActive(now); }

    /* Pause on screens with no player input (intro, briefings, intermissions).
       Closes any open popup with no glitch. While paused, check() never opens a popup or adds a glitch. */
    pause(p, now) {
      p.attendancePaused = true;
      p.attendancePopupAt = null;
    }
    /* Back on a screen that needs input. A fresh clock starts at now: full idleMs before the popup. */
    resume(p, now) {
      p.attendancePaused = false;
      p.attendancePopupAt = null;
      p.attendanceResumeAt = now;
    }

    /* The time this player's current timer started: the last input, miss or resume, whichever is latest. */
    since(p) {
      const t = v => (v == null ? -Infinity : v);
      return Math.max(t(p.lastActivity), t(p.attendanceMissAt), t(p.attendanceResumeAt));
    }

    /* Check one player at time now. Returns one of:
       { state: "off" }                        Stuck players are not checked
       { state: "paused" }                     a no-input screen is showing; nothing happens
       { state: "ok", msLeft }                 time until the popup opens
       { state: "popup", msLeft }              popup open, time left to answer
       { state: "missed", glitched, stuck }    countdown ran out; timer restarts from now
       A miss only happens popupMs after the popup opened, so the player always sees the full countdown.
       A miss adds 1 glitch only if this player is under the per-round max. */
    check(p, now) {
      if (p.isStuck()) return { state: "off" };
      if (p.attendancePaused) return { state: "paused" };
      if (p.lastActivity == null && p.attendanceResumeAt == null) p.markActive(now);   // first check starts the clock
      const { idleMs, popupMs, maxPerRound } = this.settings;
      // Input after the popup opened answers it.
      if (p.attendancePopupAt != null && p.lastActivity > p.attendancePopupAt) p.attendancePopupAt = null;
      if (p.attendancePopupAt == null) {
        const quiet = now - this.since(p);
        if (quiet < idleMs) return { state: "ok", msLeft: idleMs - quiet };
        // Quiet too long. Always open the popup first with the full countdown, even if checks were late.
        p.attendancePopupAt = now;
        return { state: "popup", msLeft: popupMs };
      }
      const left = p.attendancePopupAt + popupMs - now;
      if (left > 0) return { state: "popup", msLeft: left };
      p.attendancePopupAt = null;
      p.attendanceMissAt = now;
      const glitched = p.attendanceGlitch(maxPerRound);
      return { state: "missed", glitched, stuck: p.isStuck() };
    }
  }

  EP.Attendance = Attendance;
  if (typeof module !== "undefined" && module.exports) module.exports = Attendance;
})(typeof globalThis !== "undefined" ? globalThis : this);
