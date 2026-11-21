/* Game: runs the rounds in step order and applies every rule.
   Game enforces the step order. A call in the wrong step is refused with a reason.
   Player actions (sabotage, accuse, gift, cashOut) return { ok: false, reason }.
   Engine calls (payTrialCosts, lockIn, ...) throw an Error with the reason.
   Order each level 1 to 6 (advance() moves to the next step):
     briefing:     no player actions (Attendance paused)             > advance
     openFloor:    sabotage*, gift*, answerGift*, switchTeam*           > advance (unanswered gifts expire)
     trial:        setSopScore (Level 1) / Levels 5-6: setPrompt (host only), startWriting, typeSubmission*, submit*,
                   closeWriting (or early close), startVote + cast; then runTrial, payTrialCosts  > advance
     glitchReport: accuse*, endGlitchReport (auto after 30 s)  > advance
     giftWindow:   gift*, answerGift*                         > advance (unanswered gifts expire)
     lockIn:       lockIn                                     > advance
     statsUpdate:  computeEarnings, cashOut*, place points (autoPlacePoints after 30 s), finishRound
   finishRound puts the game in intermission (no round running, Attendance paused) until startNextRound.
   The game also starts in intermission, before Level 1.
   startNextRound also gives the quiet heart buff (Part 6) to small teams.
   Level 7: startNextRound (briefing) > advance > graduation: place points (autoPlacePoints after 60 s) > results.
   Idle (Part 8): any missed Attendance check sets p.idle; any input (activity) clears it. Idle players take no
   optional actions (gifts, answering gifts, accusations, sabotage, votes); the rule classes refuse them.
   Trial costs are paid as normal. Their points are placed when the timer ends, like anyone else's. */
import { Attendance } from "./Attendance.js";
import { Economy } from "./Economy.js";
import { Gift } from "./Gift.js";
import { Player } from "./Player.js";
import { Rng } from "./Rng.js";
import { Round } from "./Round.js";
import { Team } from "./Team.js";
import { Timer } from "./Timer.js";
import { Trial } from "./Trial.js";

// Part 6: a team with this many active players or fewer gets the quiet heart buff at round start.
const QUIET_HEART_TEAM_MAX = 3;

const STEP_NAME = { openFloor: "Open Floor", trial: "Trial", glitchReport: "Glitch Report",
                    giftWindow: "Gift window", lockIn: "Lock-in", statsUpdate: "Stats Update",
                    graduation: "Graduation", briefing: "Briefing", intermission: "Intermission" };

// Steps where Attendance does not fire. Game pauses the Attendance timer for every player while in one,
// and resumes it (fresh 60 s clock) on entering any other step. Applies to every level.
// Briefing and intermission have no player input. Glitch Report and Stats Update end on their own (AUTO_ADVANCE).
const PAUSED_STEPS = ["briefing", "intermission", "glitchReport", "statsUpdate"];

// Steps that end on their own after this many seconds. The screen shows the countdown.
// Glitch Report: anyone who has not accused skips. Stats Update: unplaced points are placed by the bot rule.
const AUTO_ADVANCE_SECONDS = { glitchReport: 30, statsUpdate: 30 };

// Level 7 placement timer. Points not placed when it ends are placed by the bot placement rule (Round 7 way).
const GRADUATION_PLACE_SECONDS = 60;

// Other step timers the engine runs when there is no host. The screen shows the countdown.
// Gift window: 30 seconds.
const STEP_SECONDS = { intermission: 90, openFloor: 90, sopTrial: 60, giftWindow: 30 };

// What must happen before advance() may leave each step.
const REQUIRED = { trial: "payTrialCosts", glitchReport: "endGlitchReport", lockIn: "lockIn" };

/* Step timers (Part 13). Game stores each running timer's end time (a deadline), never seconds left.
   Only these phases are timed; every other step waits for an explicit call (decided: untimed for now).
     intermission    the first one only, before Level 1     ends: startNextRound
     openFloor                                              ends: advance (unanswered gifts expire)
     sop             Level 1 Trial, until the SOP is scored ends: closeSop (each board scored as it stands)
     splitBrief      Level 2 Trial, until locked or 180 s   ends: closeSplitBrief (fires twist first if needed)
     mirrorLobby     Level 3 Trial, 30 s connect lobby      ends: closeMirrorLobby
     mirrorReveal    Level 3 Trial, 1 s crew reveal         ends: startMirrorShowtime
     mirrorShowtime  Level 3 Trial, 75 s presentation       ends: closeMirror
     writing         Levels 5-6, while writing is open      ends: closeWriting
     glitchReport    until accusations close                ends: closeGlitchReport
     giftWindow                                             ends: closeGiftWindow (Lock-in, earnings)
     statsUpdate     after earnings                         ends: unplaced points by the bot rule, finishRound
     graduation      Level 7                                ends: unplaced points by the bot rule, results
   A timer that ends opens the next one from its own deadline (decided), so a game that slept
   catches up exactly as if it never stopped. */
const TIMER_SECONDS = {
  intermission: STEP_SECONDS.intermission, openFloor: STEP_SECONDS.openFloor, sop: STEP_SECONDS.sopTrial,
  splitBrief: Trial.SplitBriefTrial.TRIAL_SECONDS,
  mirrorLobby: Trial.MirrorTrial.LOBBY_SECONDS,
  mirrorReveal: Trial.MirrorTrial.REVEAL_SECONDS,
  mirrorShowtime: Trial.MirrorTrial.SHOWTIME_SECONDS,
  writing: Trial.JudgedTrial.WRITING_SECONDS, glitchReport: AUTO_ADVANCE_SECONDS.glitchReport,
  giftWindow: STEP_SECONDS.giftWindow, statsUpdate: AUTO_ADVANCE_SECONDS.statsUpdate, graduation: GRADUATION_PLACE_SECONDS,
};

class Game {
  /* attendance: Attendance settings (host dials): { idleMs, popupMs, maxPerRound }.
     clock: returns the time in ms. Times Attendance and the step timers. Tests pass a fake one.
     rng: the game's random numbers. Use Rng.seeded(seed) if the game will be saved (toJSON).
     hooks (optional, not saved): { onStart(game, timerName), beforeClose(game, timerName), onTick(game, now) }.
       The prototype passes Bots.hooks so bots act at the same moments as before. Base44 passes none. */
  constructor({ teams, rng = Math.random, host = false, attendance = {}, clock = () => Date.now(), hooks = {} }) {
    this.teams = teams;
    this.players = teams.flatMap(t => t.members);
    this.rng = rng;
    this.host = host;          // host mode controls are parked; no-host is built first
    this.level = 0;
    this.round = null;
    this.log = [];
    this.prompts = [];         // game record: the prompt used at each judged level { level, index, text, custom }
    this.submissions = [];     // game record: Level 5-6 submissions once writing closes { level, name, text }
    this.attendance = new Attendance(attendance);
    this.economy = new Economy();
    this.hooks = hooks;
    this._closingPhase = null;
    this._timer = this._makeTimer(clock);
    this.syncAttendance();   // starts in intermission: paused
  }

  _makeTimer(clock) {
    return new Timer({
      clock,
      durations: TIMER_SECONDS,
      getPhase: () => { const name = this.timerName(); return name ? { name, key: this.level + ":" + name } : null; },
      onStart: name => {
        if (name === "splitBrief") this._startSplitBrief();
        if (this.hooks.onStart) this.hooks.onStart(this, name);
      },
      onClose: name => {
        if (name === "splitBrief") this._checkTwist(this.now());
        this._closingPhase = name;
        try {
          if (this.hooks.beforeClose) this.hooks.beforeClose(this, name);
          this._closeTimerPhase(name);
        } finally {
          this._closingPhase = null;
        }
      },
    });
  }

  /* ----- step timers (Part 13) ----- */
  get timer() { return this._timer.current ? { ...this._timer.current } : null; }
  get running() { return this._timer.running; }
  now() { return this._timer.now(); }
  start() { return this._timer.start(); }
  /* Which timed phase should be running right now, or null. */
  timerName() {
    const s = this.step;
    if (s === "intermission") return this.level === 0 ? "intermission" : null;
    if (s === "openFloor" || s === "giftWindow") return s;
    if (s === "trial") {
      const t = this.round.trial;
      if (t instanceof Trial.SopTrial && !this.didRun("runTrial")) return "sop";
      if (t instanceof Trial.SplitBriefTrial && !this.didRun("runTrial")) return "splitBrief";
      if (t instanceof Trial.MirrorTrial && !this.didRun("runTrial")) {
        if (t.phase === "lobby") return "mirrorLobby";
        if (t.phase === "reveal") return "mirrorReveal";
        if (t.phase === "showtime") return "mirrorShowtime";
        return null;
      }
      if (t instanceof Trial.JudgedTrial && t.writing === "open") return "writing";
      return null;
    }
    if (s === "glitchReport") return this.didRun("endGlitchReport") ? null : "glitchReport";
    if (s === "statsUpdate") return this.didRun("computeEarnings") ? "statsUpdate" : null;
    if (s === "graduation") return this.over ? null : "graduation";
    return null;
  }
  refreshTimer() { this._timer.refresh(); }
  secondsLeft(now) { return this._timer.secondsLeft(now); }
  _startSplitBrief() {
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.SplitBriefTrial)) return;
    if (t.twistDeadline == null && !t.twistFired) {
      t.setTwistDeadline(this.now() + Trial.SplitBriefTrial.TWIST_SECONDS * 1000);
    }
  }
  _wireSplitBrief(t) {
    if (!(t instanceof Trial.SplitBriefTrial)) return;
    t.onAllLocked = () => {
      if (this.running) this.closeTimer(this.now());
      else this.closeSplitBrief();
    };
  }
  _checkTwist(now) {
    if (this.step !== "trial" || this.didRun("runTrial")) return false;
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.SplitBriefTrial)) return false;
    if (t.twistFired || t.twistDeadline == null || now < t.twistDeadline) return false;
    return t.fireTwist(this.teams);
  }
  tick(now = this.now()) {
    this._checkTwist(now);
    const closed = this._timer.tick(now);
    this._checkTwist(now);
    if (this.hooks.onTick) this.hooks.onTick(this, now);
    const hadShowtimeTimer = this.running && this._timer.current && this._timer.current.name === "mirrorShowtime";
    if (this._checkMirrorShowtime(now) && hadShowtimeTimer) closed.push("mirrorShowtime");
    return closed;
  }
  closeTimer(now) { return this._timer.close(now); }
  closeTimerAt(at) { this._timer.closeAt(at); }
  _closeTimerPhase(name) {
    switch (name) {
      case "intermission": this.startNextRound(); break;
      case "openFloor": this.advance(); break;
      case "sop": this.closeSop(); break;
      case "splitBrief": this.closeSplitBrief(); break;
      case "mirrorLobby": this.closeMirrorLobby(); break;
      case "mirrorReveal": this.startMirrorShowtime(); break;
      case "mirrorShowtime": this.closeMirror(); break;
      case "writing": this.closeWriting(); break;
      case "glitchReport": this.closeGlitchReport(); break;
      case "giftWindow": this.closeGiftWindow(); break;
      case "statsUpdate": this.placeAllRemaining(); this.finishRound(); break;
      case "graduation": this.placeAllRemaining(); this.results(); break;
    }
  }
  /* Timer ran out at Stats Update or Graduation: everyone's unplaced points go in by the bot rule.
     Points a player already picked (their draft) stay. */
  placeAllRemaining() {
    this.economy.placeAllRemaining(this.players, this.step === "graduation");
  }

  /* True if this player's Attendance timer should be paused right now:
     - a briefing or intermission (no input), or
     - Graduation, once the player has no Round 7 points left to place (placed them all, or had 0 to place), or
     - the game is over (results() ran). */
  attendancePausedFor(p) {
    if (PAUSED_STEPS.includes(this.step)) return true;
    if (this.step === "graduation") return this.over || p.earned === 0;
    return false;
  }
  /* Called on every step change, and for each player before every Attendance check
     (that is how Graduation notices points were placed). Resume gives a fresh 60 s clock. */
  syncAttendance(now = this.now()) {
    for (const p of this.players) {
      const paused = this.attendancePausedFor(p);
      if (paused && !p.attendancePaused) this.attendance.pause(p, now);
      else if (!paused && p.attendancePaused) this.attendance.resume(p, now);
    }
  }

  /* ----- Attendance (any time) ----- */
  /* Any input by this player: key press, click, touch, mouse movement (at most once per second) or scrolling. */
  activity(p, now = this.now()) { this.attendance.activity(p, now); }   // no time given: the game's clock
  /* Run about once a second. Checks every human player (bots answer at once, so they are skipped).
     Returns [{ player, state, msLeft }] for players with the popup open, and for a miss
     [{ player, state: "missed", counted, pending, locked, stuck }] (see attendanceMiss). */
  checkAttendance(now) {
    const out = [];
    this.syncAttendance(now);
    for (const p of this.players) {
      if (p.isBot) continue;
      let r = this.attendance.check(p, now);
      if (r.state === "missed") {
        p.idle = true;   // Part 8: any miss, counted or not; the next input clears it
        r = { ...r, ...this.attendanceMiss(p, r.counted) };
        this.log.push({ level: this.level, event: "attendanceMiss", player: p.id, counted: r.counted, pending: r.pending, locked: r.locked, stuck: r.stuck });
      }
      if (r.state === "popup" || r.state === "missed") out.push({ player: p, ...r });
    }
    return out;
  }

  /* True while a missed check-in can still be saved: from Open Floor until the gift window closes
     (Lock-in locks it). Level 7 has no gift window. */
  attendanceCanWait() {
    if (!this.round || this.round.isFinal) return false;
    if (["openFloor", "trial", "glitchReport", "giftWindow"].includes(this.step)) return true;
    return this.step === "lockIn" && !this.didRun("lockIn");
  }
  /* A missed check-in follows the normal glitch path. Only counted misses (max 1 per round) do anything.
     Before the gift window closes: the player is Glitching (pending). A teammate's gift accepted in the
     gift window saves them; if not saved, it locks in at Lock-in.
     After the gift window closed: it locks in at once. Reboot: hearts to 0, no attribute refill,
     1 point that round, Empathy. An attribute glitch and an attendance glitch in one round count as one.
     Returns { counted, pending, locked, stuck }. */
  attendanceMiss(p, counted) {
    const out = { counted: !!counted, pending: false, locked: false };
    if (counted) {
      if (this.attendanceCanWait()) { p.attendancePending = true; out.pending = true; }
      else if (p.lockAttendanceGlitch()) { out.locked = true; this.empathy(p); }
    }
    out.stuck = p.isStuck();
    return out;
  }
  /* Empathy: each Cooperative teammate (not Stuck) loses 1 heart when this player's glitch locks in. */
  empathy(p) {
    const team = this.teamOf(p);
    for (const q of team.mates(p)) if (q.type.hasEmpathy() && !q.isStuck()) q.hearts.lose(1);
  }

  teamOf(p) { return this.teams.find(t => t.has(p)); }
  get over() { return this.level === 7 && this.round && this.round.done; }

  /* ----- step order ----- */
  /* No round yet, or the round is finished: intermission. */
  get step() {
    if (!this.round || this.round.completed.has("finishRound")) return "intermission";
    return this.round.step;
  }
  stepName() { return STEP_NAME[this.step] || "no round"; }
  didRun(action) { return !!this.round && this.round.completed.has(action); }

  /* null if this is the right step, else the reason. */
  wrongStep(step) {
    if (this.step === step) return null;
    return "Not allowed now. That happens in " + STEP_NAME[step] + "; the game is in " + this.stepName() + ".";
  }
  mustBe(step) { const why = this.wrongStep(step); if (why) throw new Error(why); }
  once(action) {
    if (this.didRun(action)) throw new Error(action + " already ran this round.");
    this.round.completed.add(action);
  }

  /* Move to the next step. Refused if the current step is not finished. */
  advance() {
    if (this.step === "intermission") throw new Error("Intermission. Call startNextRound.");
    if (this.step === "graduation") throw new Error("Graduation is the last step.");
    if (this.step === "statsUpdate") throw new Error("Stats Update is the last step. Call finishRound, then startNextRound.");
    const need = REQUIRED[this.step];
    if (need && !this.didRun(need)) throw new Error("Finish " + this.stepName() + " first (" + need + ").");
    if (this.step === "openFloor" || this.step === "giftWindow") Gift.expireAll(this.round);   // no answer = declined
    const step = this.round.nextStep();
    if (step === "trial" && this.round.trial instanceof Trial.SplitBriefTrial) {
      if (!this.round.trial.dealt) this.round.trial.deal(this.teams);
      this._wireSplitBrief(this.round.trial);
    }
    if (step === "trial" && this.round.trial instanceof Trial.MirrorTrial) {
      if (!this.round.trial.lobbyStarted) this.round.trial.startLobby(this.teams);
    }
    this.syncAttendance();
    this.refreshTimer();
    return step;
  }
  setTrialForTest(trial) {
    if (!this.round || this.round.isFinal) throw new Error("No active trial round.");
    this.round.trial = trial;
    if (this.step === "trial" && trial instanceof Trial.SplitBriefTrial) {
      if (!trial.dealt) trial.deal(this.teams);
      this._wireSplitBrief(trial);
      this.refreshTimer();
    }
    if (this.step === "trial" && trial instanceof Trial.MirrorTrial) {
      if (!trial.lobbyStarted) trial.startLobby(this.teams);
      this.refreshTimer();
    }
  }

  startNextRound() {
    if (this.level >= 7) throw new Error("The game is over.");
    if (this.round && !this.didRun("finishRound")) throw new Error("Finish this round first (finishRound).");
    this.level += 1;
    this.round = new Round(this.level);
    if (!this.round.isFinal) this.round.trial = Trial.forRound(this.round, this.rng);
    this.players.forEach(p => p.resetRoundFlags());
    this.teams.forEach(t => t.resetRound());
    if (this.round.isFinal) {
      for (const p of this.players) if (!p.isStuck()) p.earned = Math.min(Economy.POINTS.final, p.roomLeft());
    }
    this.quietHeartBuff();
    this.syncAttendance();   // briefing: paused
    this.refreshTimer();
    return this.round;
  }

  /* Part 6, quiet heart buff. At the start of each round (called only by startNextRound, so once per round),
     every non-Stuck player on a team with 3 or fewer active players (Team.active(): not Stuck, not idle)
     gets +1 heart, capped at the normal max. Not shown on screen. Logged for the host only. */
  quietHeartBuff() {
    const got = [];
    for (const t of this.teams) {
      if (t.active().length > QUIET_HEART_TEAM_MAX) continue;
      for (const p of t.members) {
        if (p.isStuck()) continue;
        p.hearts.refill(1);
        got.push(p);
      }
    }
    this.round.quietHearts = got;
    if (got.length) this.log.push({ level: this.level, event: "quietHeart", hostOnly: true, players: got.map(p => p.id) });
    return got;
  }

  /* 1. Open Floor */
  sabotage(actor, target) {
    const why = this.wrongStep("openFloor");
    if (why) return { ok: false, reason: why };
    return this.round.sabotage(actor, target, this.teamOf(actor), this.rng);
  }

  /* Team switching (Open Floor only). Teams stay 3 to 5 members.
     A player who sabotaged this round cannot switch that round.
     Stuck players are spectators and cannot switch. */
  switchTeam(p, to) {
    const from = this.teamOf(p);
    const why = this.wrongStep("openFloor") ||
      (!this.teams.includes(to) ? "No such team." : null) ||
      (from === to ? "You are already on that team." : null) ||
      (p.isStuck() ? "You are Stuck." : null) ||
      (p.sabotagesThisRound > 0 ? "You sabotaged this round. You cannot switch teams this round." : null) ||
      (from.size() - 1 < Team.MIN ? from.name + " would drop below " + Team.MIN + " members." : null) ||
      (to.size() + 1 > Team.MAX ? to.name + " is full (" + Team.MAX + " members)." : null);
    if (why) return { ok: false, reason: why };
    from.remove(p);
    to.add(p);
    this.log.push({ level: this.level, event: "switchTeam", player: p.id, from: from.id, to: to.id });
    return { ok: true, from, to };
  }

  /* 2. Trial. The round's Trial ranks the teams; the top half win.
     Level 1: the screen sets a team's SOP score (teams with none get a random score).
     Levels 5-6: players cast votes on startVote(), then runTrial. */
  sop() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.SopTrial)) throw new Error("This level has no SOP.");
    return this.round.trial;
  }
  setSopScore(team, score) {
    this.sop().setSopScore(team, score);
  }
  /* Level 1 in one call: score the team's SOP board, then rank every team.
     built = the steps in board order. Returns { right, endlessOut, score, rank }. */
  scoreSop(team, built, steps, endless) {
    const out = this.sop().scoreSop(team, built, steps, endless, this.round, this.teams);
    this.refreshTimer();
    return out;
  }
  /* The team's shared SOP board (Level 1): the steps in board order. Any active teammate can edit it. */
  sopBoard(team) {
    return this.round && this.round.trial instanceof Trial.SopTrial
      ? this.round.trial.sopBoard(this.round, team)
      : Trial.SopTrial.sopBoard(this.round, team);
  }
  setSopBoard(p, built) {
    const why = this.wrongStep("trial") || (!(this.round.trial instanceof Trial.SopTrial) ? "This level has no SOP." : null);
    if (why) return { ok: false, reason: why };
    return this.round.trial.setSopBoard(this.round, p, this.teamOf(p), built);
  }
  /* The SOP timer ended (or the team submitted): every team with a player on it scores its board as it
     stands (placing nothing scores 0); bot-only teams get a random score. Then the trial ranks the teams.
     Results per team id: { right, endlessOut, score } in round.sopResults. */
  closeSop() {
    const ranking = this.sop().closeSop(this.round, this.teams);
    this.refreshTimer();
    return ranking;
  }
  splitBrief() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.SplitBriefTrial)) throw new Error("This level has no Split Brief.");
    return this.round.trial;
  }
  closeSplitBrief() {
    const ranking = this.splitBrief().closeSplitBrief(this.round, this.teams);
    this.refreshTimer();
    return ranking;
  }
  _mirrorWhy() {
    return this.wrongStep("trial") || (!(this.round.trial instanceof Trial.MirrorTrial) ? "This level has no Mirror trial." : null);
  }
  mirrorLobbyElapsed(now = this.now()) {
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.MirrorTrial) || t.phase !== "lobby") return null;
    const cur = this._timer.current;
    if (cur && cur.name === "mirrorLobby") {
      const left = Math.max(0, Math.min(Trial.MirrorTrial.LOBBY_SECONDS, (cur.deadline - now) / 1000));
      return Trial.MirrorTrial.LOBBY_SECONDS - left;
    }
    return 0;
  }
  mirrorShowtimeSecondsLeft(now = this.now()) {
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.MirrorTrial)) return null;
    if (t.phase === "lobby" || t.phase === "reveal") return Trial.MirrorTrial.SHOWTIME_SECONDS;
    if (t.phase !== "showtime") return 0;
    const cur = this._timer.current;
    if (cur && cur.name === "mirrorShowtime") {
      return Math.max(0, Math.min(Trial.MirrorTrial.SHOWTIME_SECONDS, (cur.deadline - now) / 1000));
    }
    return Trial.MirrorTrial.SHOWTIME_SECONDS;
  }
  mirrorShowtimeElapsed(now = this.now()) {
    const left = this.mirrorShowtimeSecondsLeft(now);
    return left === null ? null : Trial.MirrorTrial.SHOWTIME_SECONDS - left;
  }
  _mirrorElapsedOpts(opts = {}) {
    if (typeof opts.elapsedSeconds === "number" && Number.isFinite(opts.elapsedSeconds)) return opts;
    const elapsed = this.mirrorShowtimeElapsed(this.now());
    return elapsed === null ? opts : { ...opts, elapsedSeconds: elapsed };
  }
  _mirrorLeftOpts(opts = {}) {
    if (typeof opts.showtimeSecondsLeft === "number" && Number.isFinite(opts.showtimeSecondsLeft)) return opts;
    if (typeof opts.elapsedSeconds === "number" && Number.isFinite(opts.elapsedSeconds)) return opts;
    const left = this.mirrorShowtimeSecondsLeft(this.now());
    return left === null ? opts : { ...opts, showtimeSecondsLeft: left };
  }
  _allHumanMirrorTeamsDone(t) {
    const humanTeams = this.teams.filter(team => !t.isBotOnlyTeam(team));
    if (!humanTeams.length) return false;
    return humanTeams.every(team => t.isTeamFailed(team) || t.lockedAttentionFor(team) !== null);
  }
  _maybeCloseMirrorShowtime(now = this.now()) {
    if (this.step !== "trial" || this.didRun("runTrial") || this._closingPhase === "mirrorShowtime") return false;
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.MirrorTrial) || t.phase !== "showtime" || !this._allHumanMirrorTeamsDone(t)) return false;
    if (this.running && this._timer.current && this._timer.current.name === "mirrorShowtime") {
      this.closeTimer(now);
    } else {
      this.closeMirror({ showtimeSecondsLeft: this.mirrorShowtimeSecondsLeft(now) });
    }
    return true;
  }
  _checkMirrorShowtime(now = this.now()) {
    if (this.step !== "trial" || this.didRun("runTrial")) return false;
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.MirrorTrial) || t.phase !== "showtime") return false;
    const left = this.mirrorShowtimeSecondsLeft(now);
    for (const team of this.teams) {
      if (!t.isBotOnlyTeam(team)) t.checkAttention(team, left);
    }
    return this._maybeCloseMirrorShowtime(now);
  }
  _afterMirrorAction(res, { checkAttention = false, checkClose = false } = {}) {
    if (!res || !res.ok) return res;
    const t = this.round && this.round.trial;
    if (!(t instanceof Trial.MirrorTrial)) return res;
    const now = this.now();
    if (checkAttention && res.teamId !== undefined) {
      const att = t.checkAttention(res.teamId, this.mirrorShowtimeSecondsLeft(now));
      if (att.failed) {
        const closed = this._maybeCloseMirrorShowtime(now);
        return {
          ...res,
          attention: att.attention,
          score: att.score,
          failed: true,
          failReason: att.failReason,
          ...(closed ? { closed: true } : {}),
        };
      }
    }
    if (checkClose) {
      const closed = this._maybeCloseMirrorShowtime(now);
      if (closed) return { ...res, closed: true };
    }
    return res;
  }
  _mirrorCall(fn, afterOpts = null) {
    const why = this._mirrorWhy();
    if (why) return { ok: false, reason: why };
    const res = fn(this.round.trial);
    return afterOpts ? this._afterMirrorAction(res, afterOpts) : res;
  }
  mirror() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.MirrorTrial)) throw new Error("This level has no Mirror trial.");
    return this.round.trial;
  }
  closeMirrorLobby() {
    const t = this.mirror();
    const res = t.closeDoors();
    if (!this.didRun("runTrial") && (t.phase === "failed" || this._allHumanMirrorTeamsDone(t))) {
      this.closeMirror({ showtimeSecondsLeft: 0 });
      return { ...res, closed: true };
    }
    this.refreshTimer();
    return res;
  }
  startMirrorShowtime() {
    const res = this.mirror().startShowtime();
    this.refreshTimer();
    return res;
  }
  closeMirror(opts = {}) {
    const t = this.mirror();
    const sec = typeof opts.showtimeSecondsLeft === "number" && Number.isFinite(opts.showtimeSecondsLeft)
      ? opts.showtimeSecondsLeft
      : this.mirrorShowtimeSecondsLeft(this.now());
    const ranking = t.closeMirror(this.round, this.teams, { showtimeSecondsLeft: sec });
    this.refreshTimer();
    return ranking;
  }
  mirrorConnect(playerOrId) {
    return this._mirrorCall(t => {
      const res = t.connect(playerOrId);
      if (res.ok && res.allConnected && this._closingPhase !== "mirrorLobby") {
        if (this.running && this._timer.current && this._timer.current.name === "mirrorLobby") {
          this.closeTimer(this.now());
        } else {
          this.closeMirrorLobby();
        }
        return { ...res, closed: true, phase: t.phase };
      }
      return res;
    });
  }
  mirrorMiss(playerOrId) { return this._mirrorCall(t => t.miss(playerOrId)); }
  mirrorCableHit(playerOrId, port, opts) { return this._mirrorCall(t => t.cableHit(playerOrId, port, this._mirrorElapsedOpts(opts))); }
  mirrorCableMiss(playerOrId, port, opts) { return this._mirrorCall(t => t.cableMiss(playerOrId, port, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorSoundHeld(playerOrId, opts) { return this._mirrorCall(t => t.soundHeld(playerOrId, this._mirrorElapsedOpts(opts))); }
  mirrorSoundFeedback(playerOrId) { return this._mirrorCall(t => t.soundFeedback(playerOrId), { checkAttention: true }); }
  mirrorMicTap(playerOrId, micNumber, opts) { return this._mirrorCall(t => t.micTap(playerOrId, micNumber, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorPickFile(playerOrId, fileIndexOrName, opts) { return this._mirrorCall(t => t.pickFile(playerOrId, fileIndexOrName, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorReshuffleDeck(teamOrId) { return this._mirrorCall(t => t.reshuffleDeck(teamOrId)); }
  mirrorAnswerQa(playerOrId, answerIndex, opts) { return this._mirrorCall(t => t.answerQa(playerOrId, answerIndex, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorTimeoutQa(playerOrId, opts) { return this._mirrorCall(t => t.timeoutQa(playerOrId, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorWrapUp(playerOrId, opts = {}) { return this._mirrorCall(t => t.wrapUp(playerOrId, this._mirrorLeftOpts(opts)), { checkClose: true }); }
  mirrorDanceHit(playerOrId, quality, opts) { return this._mirrorCall(t => t.danceHit(playerOrId, quality, this._mirrorElapsedOpts(opts))); }
  mirrorDanceMiss(playerOrId, opts) { return this._mirrorCall(t => t.danceMiss(playerOrId, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorDanceStray(playerOrId, opts) { return this._mirrorCall(t => t.danceStray(playerOrId, this._mirrorElapsedOpts(opts)), { checkAttention: true }); }
  mirrorAttention(teamOrId, now = this.now()) {
    const t = this.round && this.round.trial;
    return t instanceof Trial.MirrorTrial ? t.attentionFor(teamOrId, this.mirrorShowtimeSecondsLeft(now)) : null;
  }
  mirrorScore(teamOrId, now = this.now()) {
    const t = this.round && this.round.trial;
    return t instanceof Trial.MirrorTrial ? t.scoreFor(teamOrId, this.mirrorShowtimeSecondsLeft(now)) : null;
  }
  mirrorPhase() { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.phase : null; }
  mirrorLobbyTeam(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.lobbyTeamState(teamOrId) : null; }
  mirrorCrew(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.crewFor(teamOrId) : null; }
  mirrorSetupSlots(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.setupSlots(teamOrId) : []; }
  mirrorRole(playerOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.roleOf(playerOrId) : null; }
  mirrorFailReason(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.failReasonOf(teamOrId) : null; }
  mirrorSetupTeam(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.setupTeamState(teamOrId) : null; }
  mirrorDanceTeam(teamOrId) { const t = this.round && this.round.trial; return t instanceof Trial.MirrorTrial ? t.danceTeamState(teamOrId) : null; }
  trialRanking() { return (this.round && this.round.trial && this.round.trial.ranking) || []; }
  mirrorCheckAttention(teamOrId, now = this.now()) {
    return this._mirrorCall(t => {
      const res = t.checkAttention(teamOrId, this.mirrorShowtimeSecondsLeft(now));
      if (res.failed) this._maybeCloseMirrorShowtime(now);
      return { ok: true, ...res, closed: this.didRun("runTrial") };
    });
  }
  mirrorFinishTeam(teamOrId, opts = {}) {
    return this._mirrorCall(t => {
      const sec = typeof opts.showtimeSecondsLeft === "number" && Number.isFinite(opts.showtimeSecondsLeft)
        ? opts.showtimeSecondsLeft
        : this.mirrorShowtimeSecondsLeft(this.now());
      return t.finishTeam(teamOrId, sec);
    }, { checkClose: true });
  }
  judged() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.JudgedTrial)) throw new Error("This level is not judged.");
    return this.round.trial;
  }
  /* Levels 5-6, host only: a list number (0 to 9) or custom text. A custom prompt is saved on this game's
     record (game.prompts), not added to the list. */
  setPrompt(choice) {
    return this.judged().setPrompt(choice, this.host);
  }
  /* Opens writing. No host: the engine picks a prompt at random. */
  startWriting() {
    const prompt = this.judged().startWriting({ host: this.host, prompts: this.prompts });
    this.refreshTimer();
    return prompt;
  }
  /* Called on every keystroke in the writing box. Typing counts as activity (Attendance check). */
  typeSubmission(p, text, now) {
    this.activity(p, now);
    return this.round && this.round.trial instanceof Trial.JudgedTrial
      ? this.round.trial.typeSubmission(text)
      : Trial.JudgedTrial.typeSubmission(text);
  }
  /* Writing closes early when every active player has submitted. */
  submit(p, text, now) {
    const jt = this.judged();
    this.activity(p, now);
    const r = jt.submit(p, text, { players: this.players, submissions: this.submissions });
    if (r.closed) this.refreshTimer();
    return r;
  }
  /* The 3-minute timer ran out (or the host closes it). Submissions go on the game record. */
  closeWriting() {
    if (this.judged().closeWriting(this.submissions)) this.refreshTimer();
  }
  startVote() {
    return this.judged().startVote(this.teams);
  }
  /* Returns the ranked list: [{ team, place, won, ... }] best first. */
  runTrial() {
    this.mustBe("trial");
    const ranking = this.round.trial.runTrial(this.round, this.teams);
    this.refreshTimer();
    return ranking;
  }
  payTrialCosts() {
    this.mustBe("trial");
    if (!this.didRun("runTrial")) throw new Error("Run the trial first (runTrial).");
    this.once("payTrialCosts");
    return this.economy.payTrialCosts(this.players, this.round);
  }
  /* Trial over: pay the cost (the trial must have run), then move to the Glitch Report. Returns the payments. */
  endTrial() {
    const out = this.payTrialCosts();
    this.advance();
    return out;
  }

  /* 3. Glitch Report */
  accuse(accuser, target) {
    const why = this.wrongStep("glitchReport") || (this.didRun("endGlitchReport") ? "The Glitch Report is closed." : null);
    if (why) return { ok: false, reason: why };
    return this.round.accuse(accuser, target, this.teamOf(accuser), this.rng);
  }
  endGlitchReport() {
    this.mustBe("glitchReport");
    this.once("endGlitchReport");
    this.round.endGlitchReport();
    this.refreshTimer();
  }
  /* Glitch Report over (accusations done or 30 s up): credit Exploit, then open the gift window. */
  closeGlitchReport() {
    this.mustBe("glitchReport");
    this.once("endGlitchReport");
    this.round.closeGlitchReport({ advance: () => this.advance(), refreshTimer: () => this.refreshTimer() });
  }

  /* Gifts: Open Floor or the gift window. */
  gift(giver, receiver, pts) {
    const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
      "Not allowed now. Gifts happen in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
    if (why) return { ok: false, reason: why };
    return this.round.gift(giver, receiver, this.teamOf(giver), pts, this.rng);
  }
  /* The receiver answers a pending gift: accept (true) or decline (false). */
  answerGift(gift, accept) {
    const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
      "Not allowed now. Gifts are answered in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
    if (why) return { ok: false, reason: why };
    return this.round.answerGift(gift, accept);
  }

  /* 5. Lock-in: glitches count (attribute below 0, or a missed check-in nobody saved), reboot, Empathy. */
  lockIn() {
    this.mustBe("lockIn");
    this.once("lockIn");
    const locked = [];
    for (const team of this.teams) {
      for (const p of team.members) {
        if (!p.lockIn()) continue;
        locked.push(p);
        this.empathy(p);
      }
    }
    return locked;
  }
  /* Gift window over: lock in glitches, move to Stats Update and work out earnings. Returns the earnings lines. */
  closeGiftWindow() {
    this.mustBe("giftWindow");
    return this.round.closeGiftWindow({
      advance: () => this.advance(),
      lockIn: () => this.lockIn(),
      computeEarnings: () => this.computeEarnings(),
    });
  }

  /* 6. Stats Update */
  computeEarnings() {
    this.mustBe("statsUpdate");
    this.once("computeEarnings");
    const out = this.economy.computeEarnings(this.teams, this.round);
    this.refreshTimer();
    return out;
  }
  /* Stats Update (after earnings) or Graduation: one point picked (+1) or taken back (-1) in the
     player's draft. Picked points stay if the timer runs out. */
  placingWhy() {
    return this.economy.placingWhy({
      step: this.step,
      over: this.over,
      stepWhy: this.wrongStep("statsUpdate"),
      earningsReady: this.didRun("computeEarnings"),
    });
  }
  draftPoint(p, k, delta) {
    const why = this.placingWhy();
    if (why) return { ok: false, reason: why };
    return this.economy.draftPoint(p, k, delta);
  }
  /* Lock in the draft. It must use all the player's points. */
  lockPoints(p) {
    const why = this.placingWhy();
    if (why) return { ok: false, reason: why };
    return this.economy.lockPoints(p);
  }
  /* Cash Out adds 1 to p.earned. Only after earnings, before the round ends. */
  cashOut(p) {
    const why = this.wrongStep("statsUpdate") ||
                (!this.didRun("computeEarnings") ? "Earnings come first." : null) ||
                (this.didRun("finishRound") ? "The round is over." : null);
    if (why) return { ok: false, reason: why };
    return this.economy.cashOut(p);
  }
  /* Stats Update (30 s) or Graduation (60 s) ran out of time: keep the points this player already placed
     (partial), and place the rest by the bot placement rule (at Graduation, the Round 7 way: attributes below
     2 first). Idle players are placed this way too. Returns the full placement used. */
  autoPlacePoints(p, partial = p.draft) {
    const final = this.step === "graduation";
    if (!final) this.mustBe("statsUpdate");
    if (final && this.over) throw new Error("Results are locked.");
    if (!final && !this.didRun("computeEarnings")) throw new Error("Compute earnings first.");
    return this.economy.autoPlacePoints(p, partial, final);
  }
  finishRound() {
    this.mustBe("statsUpdate");
    if (!this.didRun("computeEarnings")) throw new Error("Compute earnings first.");
    const unplaced = this.players.find(p => !p.isStuck() && p.earned > 0);
    if (unplaced) throw new Error(unplaced.name + " has not placed their points.");
    this.once("finishRound");
    this.syncAttendance();   // intermission: paused
    const gritBonus = [];
    for (const p of this.players) {
      if (p.isStuck()) continue;
      p.hearts.refill();
      // Grit: after the normal refill, Grit x 5% chance of +1 heart, capped (Part 4b).
      if (p.rollAbility("grit", this.rng)) { p.hearts.refill(); gritBonus.push(p); }
    }
    this.round.gritBonus = gritBonus;
    this.refreshTimer();
    return gritBonus;
  }

  /* ----- save and load (Part 13) ----- */
  /* The whole rules state as plain JSON data: no functions, no object links (players and teams by id).
     Hooks and the clock are not saved; fromJSON takes them again. */
  toJSON() {
    if (!Rng.canSave(this.rng)) throw new Error("This game's random numbers cannot be saved. Create it with rng: Rng.seeded(seed).");
    const clone = x => JSON.parse(JSON.stringify(x));
    return {
      version: Game.SAVE_VERSION,
      players: this.players.map(p => p.toJSON()),
      teams: this.teams.map(t => t.toJSON()),
      host: this.host,
      level: this.level,
      round: this.round ? this.round.toJSON() : null,
      log: clone(this.log),
      prompts: clone(this.prompts),
      submissions: clone(this.submissions),
      attendance: { ...this.attendance.settings },
      rng: this.rng.getState(),
      ...this._timer.toJSON(),
    };
  }
  /* Rebuild a working Game from toJSON() data. Then any timer whose deadline has passed closes at once,
     running its normal end rules (pass tick: false to skip that). */
  static fromJSON(data, { clock = () => Date.now(), hooks = {}, tick = true } = {}) {
    if (data.version !== Game.SAVE_VERSION) throw new Error("Unknown save version " + data.version + ".");
    const players = data.players.map(d => Player.fromJSON(d));
    const byId = new Map(players.map(p => [p.id, p]));
    const teams = data.teams.map(d => Team.fromJSON(d, byId));
    const rng = Rng.seeded(0);
    rng.setState(data.rng);
    const g = Object.create(Game.prototype);
    Object.assign(g, {
      teams, players, rng, host: data.host, level: data.level, round: null,
      log: data.log.map(x => ({ ...x })), prompts: data.prompts.map(x => ({ ...x })), submissions: data.submissions.map(x => ({ ...x })),
      attendance: new Attendance(data.attendance), economy: new Economy(), hooks, _closingPhase: null,
    });
    g._timer = g._makeTimer(clock);
    g._timer.restore({ running: data.running, timer: data.timer });
    if (data.round) {
      g.round = Round.fromJSON(data.round, { byId, trialFromJSON: d => Trial.fromJSON(d, { rng, teams, byId }) });
      if (g.round.trial instanceof Trial.SplitBriefTrial) g._wireSplitBrief(g.round.trial);
    }
    if (tick) g.tick();
    return g;
  }

  /* Progress board: read-only, open to every player at any time. Returns new plain objects with only
     these fields, so screen code never reaches type, attributes, hearts, gifts, Skim or Cash Out. */
  board() {
    return {
      players: this.players.map(p => ({ name: p.name, team: this.teamOf(p).name, status: p.boardStatus() })),
      teams: this.teams.map(t => ({ name: t.name, wins: t.trialWins })),
      submissions: this.submissions.map(s => ({ level: s.level, name: s.name, text: s.text })),
    };
  }

  /* Level 7. The first call locks every player's ending; no later change can alter it.
     Later calls return the same locked endings. Attendance is paused for everyone after this. */
  results() {
    this.mustBe("graduation");
    if (!this.round.done) {
      for (const p of this.players) p.lockEnding();
      this.round.done = true;
      this.syncAttendance();
      this.refreshTimer();
    }
    return this.players.map(p => ({ player: p, ending: p.ending(), wins: p.wins() }));
  }

  static get POINTS() { return Economy.POINTS; }
}

Game.QUIET_HEART_TEAM_MAX = QUIET_HEART_TEAM_MAX;
Game.STEP_NAME = STEP_NAME;
Game.PAUSED_STEPS = PAUSED_STEPS;
Game.AUTO_ADVANCE_SECONDS = AUTO_ADVANCE_SECONDS;
Game.GRADUATION_PLACE_SECONDS = GRADUATION_PLACE_SECONDS;
Game.STEP_SECONDS = STEP_SECONDS;
Game.TIMER_SECONDS = TIMER_SECONDS;
Game.SAVE_VERSION = 1;

export { Game };
