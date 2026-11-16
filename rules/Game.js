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
import { Accusation } from "./Accusation.js";
import { Attendance } from "./Attendance.js";
import { Bots } from "./bots.js";
import { CharacterType } from "./CharacterType.js";
import { Gift } from "./Gift.js";
import { Player } from "./Player.js";
import { Rng } from "./Rng.js";
import { Round } from "./Round.js";
import { Sabotage } from "./Sabotage.js";
import { Team } from "./Team.js";
import { Trial } from "./Trial.js";


const POINTS = { win: 4, lose: 2, glitched: 1, correctAccusation: 1, final: 3 };

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
     intermission  the first one only, before Level 1   ends: startNextRound
     openFloor                                            ends: advance (unanswered gifts expire)
     sop           Level 1 Trial, until the SOP is scored ends: closeSop (each board scored as it stands)
     writing       Levels 5-6, while writing is open     ends: closeWriting
     glitchReport  until accusations close                ends: closeGlitchReport
     giftWindow                                           ends: closeGiftWindow (Lock-in, earnings)
     statsUpdate   after earnings                         ends: unplaced points by the bot rule, finishRound
     graduation    Level 7                                ends: unplaced points by the bot rule, results
   A timer that ends opens the next one from its own deadline (decided), so a game that slept
   catches up exactly as if it never stopped. */
const TIMER_SECONDS = {
  intermission: STEP_SECONDS.intermission, openFloor: STEP_SECONDS.openFloor, sop: STEP_SECONDS.sopTrial,
  writing: Trial.JudgedTrial.WRITING_SECONDS, glitchReport: AUTO_ADVANCE_SECONDS.glitchReport,
  giftWindow: STEP_SECONDS.giftWindow, statsUpdate: AUTO_ADVANCE_SECONDS.statsUpdate, graduation: GRADUATION_PLACE_SECONDS,
};

class Game {
  /* attendance: Attendance settings (host dials): { idleMs, popupMs, maxPerRound }.
     clock: returns the time in ms. Times Attendance and the step timers. Tests pass a fake one.
     rng: the game's random numbers. Use Rng.seeded(seed) if the game will be saved (toJSON).
     hooks (optional, not saved): { onStart(game, timerName), beforeClose(game, timerName) }.
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
    this.clock = clock;
    this.hooks = hooks;
    this.running = false;      // step timers run only after start()
    this.timer = null;         // { name, key, deadline } for the timed phase now running
    this.at = null;            // while a timer closes: its deadline, used as "now" (chained timers)
    this.syncAttendance();   // starts in intermission: paused
  }

  /* ----- step timers (Part 13) ----- */
  /* The time rules use: the clock, except while a timer closes (then that timer's deadline). */
  now() { return this.at != null ? this.at : this.clock(); }
  /* Start the step timers (the first intermission starts counting now). */
  start() { this.running = true; this.refreshTimer(); return this.timer; }
  /* Which timed phase should be running right now, or null. */
  timerName() {
    const s = this.step;
    if (s === "intermission") return this.level === 0 ? "intermission" : null;
    if (s === "openFloor" || s === "giftWindow") return s;
    if (s === "trial") {
      const t = this.round.trial;
      if (t instanceof Trial.SopTrial && !this.didRun("runTrial")) return "sop";
      if (t instanceof Trial.JudgedTrial && t.writing === "open") return "writing";
      return null;
    }
    if (s === "glitchReport") return this.didRun("endGlitchReport") ? null : "glitchReport";
    if (s === "statsUpdate") return this.didRun("computeEarnings") ? "statsUpdate" : null;
    if (s === "graduation") return this.over ? null : "graduation";
    return null;
  }
  /* Called after every change that can start or end a timed phase. A new phase gets a deadline from now(). */
  refreshTimer() {
    if (!this.running) return;
    const name = this.timerName();
    const key = name ? this.level + ":" + name : null;
    if (key === (this.timer ? this.timer.key : null)) return;
    this.timer = name ? { name, key, deadline: this.now() + TIMER_SECONDS[name] * 1000 } : null;
    if (name && this.hooks.onStart) this.hooks.onStart(this, name);
  }
  /* Seconds left on the running timer (for the screen countdown), or null if none. */
  secondsLeft(now = this.clock()) { return this.timer ? Math.max(0, Math.ceil((this.timer.deadline - now) / 1000)) : null; }
  /* Close every timer whose deadline has passed, in order. Returns the names closed. Call about once a second. */
  tick(now = this.clock()) {
    const closed = [];
    while (this.timer && now >= this.timer.deadline) {
      if (closed.length > 50) throw new Error("Timer loop.");
      closed.push(this.timer.name);
      this.closeTimerAt(this.timer.deadline);
    }
    return closed;
  }
  /* End the running timed phase early (a button, or everyone is done). Same end rules as the timer. */
  closeTimer(now = this.clock()) {
    if (!this.timer) return null;
    const name = this.timer.name;
    this.closeTimerAt(now);
    return name;
  }
  closeTimerAt(at) {
    const t = this.timer;
    this.at = at;
    try {
      if (this.hooks.beforeClose) this.hooks.beforeClose(this, t.name);
      switch (t.name) {
        case "intermission": this.startNextRound(); break;
        case "openFloor": this.advance(); break;
        case "sop": this.closeSop(); break;
        case "writing": this.closeWriting(); break;
        case "glitchReport": this.closeGlitchReport(); break;
        case "giftWindow": this.closeGiftWindow(); break;
        case "statsUpdate": this.placeAllRemaining(); this.finishRound(); break;
        case "graduation": this.placeAllRemaining(); this.results(); break;
      }
    } finally { this.at = null; }
    if (this.timer === t) this.timer = null;
  }
  /* Timer ran out at Stats Update or Graduation: everyone's unplaced points go in by the bot rule.
     Points a player already picked (their draft) stay. */
  placeAllRemaining() {
    for (const p of this.players) if (!p.isStuck() && p.earned > 0) this.autoPlacePoints(p);
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
    this.syncAttendance();
    this.refreshTimer();
    return step;
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
      for (const p of this.players) if (!p.isStuck()) p.earned = Math.min(POINTS.final, p.roomLeft());
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
    return Sabotage.apply(this.round, actor, target, this.teamOf(actor), this.rng);
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
  setSopScore(team, score) {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.SopTrial)) throw new Error("This level has no SOP.");
    this.round.trial.setScore(team, score);
  }
  /* Level 1 in one call: score the team's SOP board, then rank every team.
     built = the steps in board order. Returns { right, endlessOut, score, rank }. */
  scoreSop(team, built, steps, endless) {
    const r = Trial.SopTrial.score(built, steps, endless);
    this.setSopScore(team, r.score);
    return { ...r, rank: this.runTrial() };
  }
  /* The team's shared SOP board (Level 1): the steps in board order. Any active teammate can edit it. */
  sopBoard(team) { return ((this.round && this.round.sopBoards) || {})[team.id] || []; }
  setSopBoard(p, built) {
    const all = [...Trial.SopTrial.STEPS, Trial.SopTrial.ENDLESS];
    const why = this.wrongStep("trial") ||
      (!(this.round.trial instanceof Trial.SopTrial) ? "This level has no SOP." : null) ||
      (this.didRun("runTrial") ? "The SOP is closed." : null) ||
      (p.isStuck() ? "You are Stuck." : null) ||
      (!Array.isArray(built) || built.some(s => !all.includes(s)) || new Set(built).size !== built.length ? "Not a valid board." : null);
    if (why) return { ok: false, reason: why };
    if (!this.round.sopBoards) this.round.sopBoards = {};
    this.round.sopBoards[this.teamOf(p).id] = built.slice();
    return { ok: true };
  }
  /* The SOP timer ended (or the team submitted): every team with a player on it scores its board as it
     stands (placing nothing scores 0); bot-only teams get a random score. Then the trial ranks the teams.
     Results per team id: { right, endlessOut, score } in round.sopResults. */
  closeSop() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.SopTrial)) throw new Error("This level has no SOP.");
    this.round.sopResults = {};
    for (const t of this.teams) {
      if (!t.members.some(p => !p.isBot)) continue;
      const r = Trial.SopTrial.score(this.sopBoard(t), Trial.SopTrial.STEPS, Trial.SopTrial.ENDLESS);
      this.round.trial.setScore(t, r.score);
      this.round.sopResults[t.id] = r;
    }
    return this.runTrial();
  }
  judged() {
    this.mustBe("trial");
    if (!(this.round.trial instanceof Trial.JudgedTrial)) throw new Error("This level is not judged.");
    return this.round.trial;
  }
  /* Levels 5-6, host only: a list number (0 to 9) or custom text. A custom prompt is saved on this game's
     record (game.prompts), not added to the list. */
  setPrompt(choice) {
    const jt = this.judged();
    if (!this.host) return { ok: false, reason: "No host. The engine picks the prompt." };
    return typeof choice === "number" ? jt.choosePrompt(choice) : jt.customPrompt(choice);
  }
  /* Opens writing. No host: the engine picks a prompt at random. */
  startWriting() {
    const jt = this.judged();
    if (!jt.prompt) {
      if (this.host) throw new Error("The host picks a prompt first.");
      jt.randomPrompt();
    }
    jt.startWriting();
    this.prompts.push({ ...jt.prompt });
    this.refreshTimer();
    return jt.prompt;
  }
  /* Called on every keystroke in the writing box. Typing counts as activity (Attendance check). */
  typeSubmission(p, text, now) {
    this.activity(p, now);
    const n = String(text || "").trim().length, max = Trial.JudgedTrial.MAX_CHARS;
    return { length: n, left: max - n, tooLong: n > max };
  }
  /* Writing closes early when every active player has submitted. */
  submit(p, text, now) {
    const jt = this.judged();
    this.activity(p, now);
    const r = jt.submit(p, text);
    if (r.ok && jt.allSubmitted(this.players)) { this.closeWriting(); r.closed = true; }
    return r;
  }
  /* The 3-minute timer ran out (or the host closes it). Submissions go on the game record. */
  closeWriting() {
    const jt = this.judged();
    if (jt.writing !== "open") return;
    jt.closeWriting();
    for (const [p, text] of jt.submissions) this.submissions.push({ level: this.level, name: p.name, text });
    this.refreshTimer();
  }
  startVote() {
    const jt = this.judged();
    if (jt.writing === "open") throw new Error("Writing is still open. Close it first (closeWriting).");
    if (!jt.writing) throw new Error("Writing has not started (startWriting).");
    return jt.startVote(this.teams);
  }
  /* Returns the ranked list: [{ team, place, won, ... }] best first. */
  runTrial() {
    this.mustBe("trial");
    this.once("runTrial");
    const ranking = this.round.trial.run(this.round, this.teams);
    this.refreshTimer();
    return ranking;
  }
  payTrialCosts() {
    this.mustBe("trial");
    if (!this.didRun("runTrial")) throw new Error("Run the trial first (runTrial).");
    this.once("payTrialCosts");
    const out = new Map();
    for (const p of this.players) {
      const r = p.payTrial(this.round.attr, this.round.cost);
      if (r) out.set(p, r);
    }
    return out;
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
    return Accusation.apply(this.round, accuser, target, this.teamOf(accuser), this.rng);
  }
  endGlitchReport() {
    this.mustBe("glitchReport");
    this.once("endGlitchReport");
    // Exploit: +1 for each Contrarian who sabotaged this round and was not caught.
    for (const p of this.round.saboteurs()) if (!p.caughtThisRound) p.creditPath(CharacterType.PATH_EVENTS.uncaughtSabotage);
    this.refreshTimer();
  }
  /* Glitch Report over (accusations done or 30 s up): credit Exploit, then open the gift window. */
  closeGlitchReport() {
    this.endGlitchReport();
    this.advance();
  }

  /* Gifts: Open Floor or the gift window. */
  gift(giver, receiver, pts) {
    const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
      "Not allowed now. Gifts happen in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
    if (why) return { ok: false, reason: why };
    return Gift.apply(this.round, giver, receiver, this.teamOf(giver), pts, this.rng);
  }
  /* The receiver answers a pending gift: accept (true) or decline (false). */
  answerGift(gift, accept) {
    const why = (this.step === "openFloor" || this.step === "giftWindow") ? null :
      "Not allowed now. Gifts are answered in Open Floor or the Gift window; the game is in " + this.stepName() + ".";
    if (why) return { ok: false, reason: why };
    // Only a gift accepted in the gift window saves a player from a missed check-in.
    return accept ? Gift.accept(this.round, gift, { savesAttendance: this.step === "giftWindow" })
                  : Gift.decline(this.round, gift);
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
    this.advance();
    this.lockIn();
    this.advance();
    return this.computeEarnings();
  }

  /* 6. Stats Update */
  computeEarnings() {
    this.mustBe("statsUpdate");
    this.once("computeEarnings");
    const out = new Map();
    for (const team of this.teams) {
      for (const p of team.members) {
        if (p.isStuck()) continue;
        const lines = [];
        let e;
        if (p.glitchedThisRound) { e = POINTS.glitched; lines.push("Glitched this round: 1"); }
        else if (team.won) { e = POINTS.win; lines.push("Points earned: 4"); }
        else { e = POINTS.lose; lines.push("Points earned: 2"); }
        if (p.correctAccusation) { e += POINTS.correctAccusation; lines.push("Correct accusation: +1"); }
        const skim = p.takeSkim();
        if (skim) { e += skim; lines.push("Skim: +1"); }
        p.earned = Math.min(e, p.roomLeft());
        out.set(p, lines);
      }
    }
    this.round.earnings = Object.fromEntries([...out].map(([p, lines]) => [p.id, lines]));   // saved; the screen reads it
    this.refreshTimer();
    return out;
  }
  /* Stats Update (after earnings) or Graduation: one point picked (+1) or taken back (-1) in the
     player's draft. Picked points stay if the timer runs out. */
  placingWhy() {
    if (this.step === "graduation") return this.over ? "Results are locked." : null;
    return this.wrongStep("statsUpdate") || (!this.didRun("computeEarnings") ? "Earnings come first." : null);
  }
  draftPoint(p, k, delta) {
    const why = this.placingWhy() || (p.isStuck() ? "You are Stuck." : null) ||
      (!Player.KEYS.includes(k) ? "No such attribute." : null) ||
      (delta === 1 ? (!p.canPlace(p.draft, k) ? "No point or no room left there." : null) :
       delta === -1 ? (!p.canUnplace(p.draft, k) ? "Nothing to take back there." : null) : "Pick +1 or -1.");
    if (why) return { ok: false, reason: why };
    p.draft[k] = (p.draft[k] || 0) + delta;
    if (!p.draft[k]) delete p.draft[k];
    return { ok: true, draft: { ...p.draft } };
  }
  /* Lock in the draft. It must use all the player's points. */
  lockPoints(p) {
    const why = this.placingWhy() || (p.placeLeft(p.draft) !== 0 ? "Place all your points first." : null);
    if (why) return { ok: false, reason: why };
    p.placePoints(p.draft);
    return { ok: true };
  }
  /* Cash Out adds 1 to p.earned. Only after earnings, before the round ends. */
  cashOut(p) {
    const why = this.wrongStep("statsUpdate") ||
                (!this.didRun("computeEarnings") ? "Earnings come first." : null) ||
                (this.didRun("finishRound") ? "The round is over." : null) ||
                (!p.canCashOut() ? "Cash Out needs an Independent with full hearts, once per game." : null);
    if (why) return { ok: false, reason: why };
    p.cashOut();
    return { ok: true };
  }
  /* Stats Update (30 s) or Graduation (60 s) ran out of time: keep the points this player already placed
     (partial), and place the rest by the bot placement rule (at Graduation, the Round 7 way: attributes below
     2 first). Idle players are placed this way too. Returns the full placement used. */
  autoPlacePoints(p, partial = p.draft) {
    const final = this.step === "graduation";
    if (!final) this.mustBe("statsUpdate");
    if (final && this.over) throw new Error("Results are locked.");
    if (!final && !this.didRun("computeEarnings")) throw new Error("Compute earnings first.");
    const KEYS = Player.KEYS;
    p.earned = Math.min(p.earned, p.roomLeft());
    const mine = KEYS.reduce((n, k) => n + (partial[k] || 0), 0);
    for (const k of KEYS) p.attrs[k] += partial[k] || 0;        // place the rest on top of what was picked
    const rest = Bots.allocate(p, Math.max(0, p.earned - mine), final);
    for (const k of KEYS) p.attrs[k] -= partial[k] || 0;
    const alloc = {};
    for (const k of KEYS) if ((partial[k] || 0) + (rest[k] || 0)) alloc[k] = (partial[k] || 0) + (rest[k] || 0);
    p.placePoints(alloc);
    return alloc;
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
      running: this.running,
      timer: this.timer ? { ...this.timer } : null,
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
      attendance: new Attendance(data.attendance), clock, hooks,
      running: data.running, timer: data.timer ? { ...data.timer } : null, at: null,
    });
    if (data.round) g.round = Round.fromJSON(data.round, { byId, trialFromJSON: d => Trial.fromJSON(d, { rng, teams, byId }) });
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
}

Game.POINTS = POINTS;
Game.QUIET_HEART_TEAM_MAX = QUIET_HEART_TEAM_MAX;
Game.STEP_NAME = STEP_NAME;
Game.PAUSED_STEPS = PAUSED_STEPS;
Game.AUTO_ADVANCE_SECONDS = AUTO_ADVANCE_SECONDS;
Game.GRADUATION_PLACE_SECONDS = GRADUATION_PLACE_SECONDS;
Game.STEP_SECONDS = STEP_SECONDS;
Game.TIMER_SECONDS = TIMER_SECONDS;
Game.SAVE_VERSION = 1;

export { Game };
