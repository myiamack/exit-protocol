/* Part 13: save and load.
   Run from the repo folder:  node Tests/check_save.js
   1. Every step: two copies of the same seeded game play side by side. Copy B is saved to JSON text and
      loaded back after every single action. After every action both copies must hold the same state,
      and the final endings must match. Players include 2 humans (who idle, get Attendance misses,
      edit the SOP board, gift, accuse, vote and pick points) and 14 bots. Timers run on a fake clock.
   2. Passed deadline: a save taken while a timer runs is loaded after its deadline. Loading must close it
      at once (and any later ones that also passed), exactly like a game that never stopped and ticked
      every second. The next timer starts from the missed deadline.
   3. The saved JSON is plain data: no functions, no Maps or class objects, no circular links. */
const EP = require("../rules/index.js");
const { Game, Bots, Rng, Trial } = EP;

const GAMES = 20;
const HUMANS = [0, 6];   // player ids played by the "human" driver below
let pass = 0, fail = 0;
function ok(name, cond, info) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (info !== undefined ? "  -> " + info : ""));
  cond ? pass++ : fail++;
  return cond;
}

/* ----- a seeded game: 16 players, 4 teams of 4, random types ----- */
function newGame(seed, T) {
  const pick = Rng.seeded(seed * 7919);
  const types = ["coop", "indep", "contra"];
  const players = Array.from({ length: 16 }, (_, i) => {
    const p = Bots.makePlayer(i, "P" + i, types[Math.floor(pick() * 3)]);
    if (HUMANS.includes(i)) p.isBot = false;
    return p;
  });
  const teams = [0, 1, 2, 3].map(i => new EP.Team({ id: i, name: "Team " + i, members: players.slice(i * 4, i * 4 + 4) }));
  const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now, hooks: Bots.hooks });
  g.start();
  return g;
}
const save = g => JSON.stringify(g.toJSON());
const load = (text, T, opts = {}) => Game.fromJSON(JSON.parse(text), { clock: () => T.now, hooks: Bots.hooks, ...opts });

/* ----- the driver: one action per call. d = the driver's own seeded rng (same seed for both copies). ----- */
const humans = g => g.players.filter(p => !p.isBot);
const any = (arr, d) => arr[Math.floor(d() * arr.length)];
function act(g, T, d) {
  if (g.over) return null;
  T.now += 1000 * (1 + Math.floor(d() * 8));
  for (const p of humans(g)) if (d() < 0.7) g.activity(p, T.now);
  g.checkAttendance(T.now);
  const closed = g.tick(T.now);
  if (closed.length) return "tick " + closed.join(">");
  const s = g.step, H = humans(g), h = any(H, d), r = d();
  const team = g.teamOf(h);

  if (s === "intermission") {
    if (g.level === 0) return "wait";
    g.startNextRound(); return "startNextRound";
  }
  if (s === "briefing") { g.advance(); return "advance"; }
  if (s === "openFloor") {
    if (r < 0.3) return "gift " + (g.gift(h, any(team.mates(h), d), 1 + Math.floor(d() * 2)).ok);
    if (r < 0.4) return "answer " + answerAll(g, d);
    if (r < 0.5) return "sabotage " + g.sabotage(h, any(team.mates(h), d)).ok;
    if (r < 0.55) return "switch " + g.switchTeam(h, any(g.teams, d)).ok;
    if (r < 0.62) return "close " + g.closeTimer(T.now);
    return "wait";
  }
  if (s === "trial") {
    const t = g.round.trial;
    if (t instanceof Trial.SopTrial && !g.didRun("runTrial")) {
      if (r < 0.5) {
        const all = [...Trial.SopTrial.STEPS, Trial.SopTrial.ENDLESS];
        const board = all.filter(() => d() < 0.6).sort(() => d() - 0.5);
        return "board " + g.setSopBoard(h, board).ok;
      }
      if (r < 0.6) return "submit " + g.closeTimer(T.now);
      return "wait";
    }
    if (t instanceof Trial.SplitBriefTrial && !g.didRun("runTrial")) {
      if (r < 0.25) {
        const ids = t.scenario.tasks.map(x => x.id);
        const n = Math.floor(d() * 3);
        const pool = ids.slice();
        const board = [];
        while (board.length < n && pool.length) board.push(pool.splice(Math.floor(d() * pool.length), 1)[0]);
        return "splitBoard " + t.setBoard(h, board).ok;
      }
      if (r < 0.4) return "splitNote " + t.postNote(h, "Note " + Math.floor(d() * 100)).ok;
      if (r < 0.48) {
        if (!t.boardFor(team).length) {
          const wrongTask = t.tasks.find(x => !t.postTwistAnswer.includes(x.id)).id;
          t.setBoard(h, [wrongTask]); // Step 10: lockIn now needs at least 1 task; wrong task keeps score 0
        }
        return "splitLock " + t.lockIn(h).ok;
      }
      if (r < 0.52) return "close " + g.closeTimer(T.now);
      return "wait";
    }
    if (t instanceof Trial.MirrorTrial && !g.didRun("runTrial")) {
      if (t.phase === "lobby") {
        if (r < 0.2) return "mirrorMiss " + g.mirrorMiss(h.id).ok;
        if (r < 0.55) return "mirrorConnect " + g.mirrorConnect(h.id).ok;
        if (r < 0.62) return "close " + g.closeTimer(T.now);
        return "wait";
      }
      if (t.phase === "reveal") return "wait";
      if (t.phase === "showtime") {
        const role = t.roleOf(h.id);
        if (role === "setup") {
          if (t.isSetupTurn(h.id)) {
            const st = t.setupTeamState(team);
            const step = t.setupStep(team);
            if (step === "cables" && st) {
              const rem = EP.MirrorData.ports.filter(p => !st.cables.connected.includes(p));
              if (rem.length) {
                const port = rem[0];
                const res = r < 0.25 ? g.mirrorCableMiss(h.id, port) : g.mirrorCableHit(h.id, port);
                return "mirrorCable " + res.ok;
              }
            } else if (step === "sound") {
              const res = r < 0.3 ? g.mirrorSoundFeedback(h.id) : g.mirrorSoundHeld(h.id);
              return "mirrorSound " + res.ok;
            } else if (step === "mic" && st && st.mic.sequence && st.mic.index < st.mic.sequence.length) {
              const want = st.mic.sequence[st.mic.index];
              const tap = r < 0.25 ? ((want % EP.MirrorData.mic.count) + 1) : want;
              return "mirrorMic " + g.mirrorMicTap(h.id, tap).ok;
            } else if (step === "deck") {
              const wrongFiles = EP.MirrorData.files.map((f, i) => ({ f, i })).filter(x => !x.f.correct && !(st && st.deck.filesTried.includes(x.i)));
              const res = r < 0.2 ? g.mirrorReshuffleDeck(team)
                : (r < 0.4 && wrongFiles.length) ? g.mirrorPickFile(h.id, wrongFiles[0].f.name)
                : g.mirrorPickFile(h.id, EP.MirrorData.files.find(f => f.correct).name);
              return "mirrorDeck " + res.ok;
            } else if (step === "qa") {
              const qa = t.currentQaFor(team);
              if (qa) {
                const res = r < 0.2 ? g.mirrorTimeoutQa(h.id)
                  : r < 0.4 ? g.mirrorAnswerQa(h.id, (qa.correctIndex + 1) % qa.options.length)
                  : g.mirrorAnswerQa(h.id, qa.correctIndex);
                return "mirrorQa " + res.ok;
              }
            } else if (step === "wrapUp") {
              return "mirrorWrapUp " + g.mirrorWrapUp(h.id).ok;
            }
          }
          return "wait";
        }
        if (role === "dance") {
          if (r < 0.5) return "mirrorDanceHit " + g.mirrorDanceHit(h.id, r < 0.25 ? "perfect" : "good").ok;
          if (r < 0.65) return "mirrorDanceMiss " + g.mirrorDanceMiss(h.id).ok;
          if (r < 0.75) return "mirrorDanceStray " + g.mirrorDanceStray(h.id).ok;
          return "wait";
        }
        if (r < 0.08) return "close " + g.closeTimer(T.now);
        return "wait";
      }
      return "wait";
    }
    if (t instanceof Trial.JudgedTrial && !g.didRun("runTrial")) {
      if (!t.writing) { g.startWriting(); Bots.submit(g); return "startWriting"; }
      if (t.writing === "open") {
        if (r < 0.4) return "submitText " + g.submit(h, "Answer from " + h.name, T.now).ok;
        return "wait";
      }
      if (!t.vote) { g.startVote(); return "startVote"; }
      if (r < 0.5) { const c = t.vote.choicesFor(h).slice(); const rank = []; while (rank.length < t.vote.slotsFor(h) && c.length) rank.push(c.splice(Math.floor(d() * c.length), 1)[0]); return "vote " + g.castVote(h, rank).ok; }
      Bots.vote(g, t.vote, g.rng); g.runTrial(); return "runTrial";
    }
    if (!g.didRun("runTrial")) { g.runTrial(); return "runTrial"; }
    if (!g.didRun("payTrialCosts")) { g.payTrialCosts(); return "payTrialCosts"; }
    g.advance(); return "advance";
  }
  if (s === "glitchReport") {
    if (r < 0.3) return "accuse " + g.accuse(h, any(team.mates(h), d)).ok;
    if (r < 0.4) return "close " + g.closeTimer(T.now);
    return "wait";
  }
  if (s === "giftWindow") {
    if (r < 0.3) return "gift " + g.gift(h, any(team.mates(h), d), 1 + Math.floor(d() * 2)).ok;
    if (r < 0.45) return "answer " + answerAll(g, d);
    if (r < 0.55) { g.advance(); return "advance (manual)"; }   // rest at Lock-in
    return "wait";
  }
  if (s === "lockIn") {
    if (!g.didRun("lockIn")) { g.lockIn(); return "lockIn"; }
    g.advance(); return "advance";
  }
  if (s === "statsUpdate" || s === "graduation") {
    if (s === "statsUpdate" && !g.didRun("computeEarnings")) { g.computeEarnings(); return "computeEarnings"; }
    if (r < 0.2 && s === "statsUpdate" && r < 0.05 && h.canCashOut()) return "cashOut " + g.cashOut(h).ok;
    if (r < 0.5) return "draft " + g.draftPoint(h, any(EP.Player.KEYS, d), d() < 0.8 ? 1 : -1).ok;
    if (r < 0.6) return "lock " + g.lockPoints(h).ok;
    if (r < 0.65 && s === "statsUpdate" && g.players.every(p => p.isStuck() || p.earned === 0)) return "close " + g.closeTimer(T.now);
    return "wait";
  }
  throw new Error("Driver has no move for step " + s);
}
function answerAll(g, d) {
  let n = 0;
  for (const x of g.round.gifts) if (x.status === "pending" && !x.receiver.isBot && g.answerGift(x, d() < 0.6).ok) n++;
  return n;
}

/* First place two saves differ, for the failure message. */
function diffPath(a, b, path = "save") {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = diffPath(a[k], b[k], path + "." + k);
      if (d) return d;
    }
  }
  return path + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b);
}

/* ----- 3. plain JSON check ----- */
function plainProblem(x, path = "save", seen = []) {
  if (x === null || typeof x === "string" || typeof x === "boolean") return null;
  if (typeof x === "number") return Number.isFinite(x) ? null : path + " is " + x;
  if (typeof x !== "object") return path + " is a " + typeof x;
  if (seen.includes(x)) return path + " is a circular link";
  const proto = Object.getPrototypeOf(x);
  if (!Array.isArray(x) && proto !== Object.prototype) return path + " is a " + (proto && proto.constructor ? proto.constructor.name : "special") + " object";
  for (const [k, v] of Object.entries(x)) {
    if (v === undefined) return path + "." + k + " is undefined";
    const why = plainProblem(v, path + "." + k, [...seen, x]);
    if (why) return why;
  }
  return null;
}

/* ----- 1. every step ----- */
const stepsSaved = new Set(), timersSaved = new Set();
const deadlineCases = [];   // [{ text, now, deadline, name }] snapshots with a running timer, for test 2
let actions = 0, plainBad = null, sameEveryStep = true, sameEndings = true, firstDiff = null;
const sel = Rng.seeded(4242);   // picks which saves to reuse in test 2 (separate, so both copies stay in step)
const t0 = Date.now();
for (let seed = 1; seed <= GAMES; seed++) {
  const TA = { now: 1e9 }, TB = { now: 1e9 };
  const dA = Rng.seeded(seed + 1000), dB = Rng.seeded(seed + 1000);
  const A = newGame(seed, TA);
  let B = newGame(seed, TB);
  for (let i = 0; i < 5000; i++) {
    const la = act(A, TA, dA), lb = act(B, TB, dB);
    if (la !== lb) { sameEveryStep = false; firstDiff = firstDiff || "seed " + seed + " action " + i + ": " + la + " vs " + lb; break; }
    if (la === null) break;
    actions++;
    const data = B.toJSON();
    const why = plainProblem(data);
    if (why && !plainBad) plainBad = why;
    const text = JSON.stringify(data);
    B = load(text, TB);
    stepsSaved.add(B.step);
    if (B.timer) timersSaved.add(B.timer.name);
    const textA = save(A);
    if (textA !== text || save(B) !== text) {
      sameEveryStep = false;
      firstDiff = firstDiff || "seed " + seed + " action " + i + " (" + la + "): " +
        (diffPath(JSON.parse(textA), data) || diffPath(data, JSON.parse(save(B))));
      break;
    }
    // Sample mirrorLobby only while an active human is still unconnected, because live bots close the lobby early once all humans connect.
    const lobbyWaitHuman = B.timer && B.timer.name === "mirrorLobby"
      ? humans(B).some(p => { const st = B.round.trial.lobbyPlayerState(p.id); return p.isActive() && st && !st.connected; })
      : true;
    if (B.timer && lobbyWaitHuman && deadlineCases.filter(c => c.name === B.timer.name).length < 6 && sel() < 0.5) {
      deadlineCases.push({ text, now: TB.now, deadline: B.timer.deadline, name: B.timer.name });
    }
  }
  if (!A.over || !B.over) { sameEndings = false; firstDiff = firstDiff || "seed " + seed + ": game did not finish"; continue; }
  const endA = A.results().map(r => r.player.id + ":" + r.ending).join();
  const endB = B.results().map(r => r.player.id + ":" + r.ending).join();
  if (endA !== endB) sameEndings = false;
}

console.log("-- 1. Save and load after every action (" + GAMES + " games, " + actions + " saves)");
ok("both copies hold the same state after every action", sameEveryStep, firstDiff || "all equal");
ok("final endings match the game that never reloaded", sameEndings);
const ALL_STEPS = ["intermission", "briefing", "openFloor", "trial", "glitchReport", "giftWindow", "lockIn", "statsUpdate", "graduation"];
ok("saved and loaded at every round step", ALL_STEPS.every(s => stepsSaved.has(s)), [...stepsSaved].join(", "));
const ALL_TIMERS = Object.keys(Game.TIMER_SECONDS);
ok("saved and loaded while every timer was running", ALL_TIMERS.every(s => timersSaved.has(s)), [...timersSaved].join(", "));

/* ----- 2. passed deadlines ----- */
console.log("-- 2. Load after a passed deadline (" + deadlineCases.length + " saves)");
let catchUpSame = true, closesOnLoad = true, chainFromDeadline = true, caseInfo = "";
const covered = new Set();
for (const c of deadlineCases) {
  covered.add(c.name);
  const late = 1 + Math.floor(Rng.seeded(c.deadline)() * 200000);   // up to 200 s late
  const wake = c.deadline + late;
  // Loaded late: closes on load.
  const TL = { now: wake };
  const L = load(c.text, TL);
  // Never stopped: same save, ticked every second from the save time.
  const TN = { now: c.now };
  const N = load(c.text, TN, { tick: false });
  for (let t = c.now; t <= wake; t += 1000) { TN.now = t; N.tick(t); }
  TN.now = wake; N.tick(wake);
  if (save(L) !== save(N)) { catchUpSame = false; caseInfo = caseInfo || c.name + " late " + late + " ms"; }
  const key = JSON.parse(c.text).timer.key;
  if (L.timer && L.timer.key === key) closesOnLoad = false;
  // Loaded exactly at the deadline: the timer closes, and the next one (if any) starts from that deadline.
  const TD = { now: c.deadline };
  const D = load(c.text, TD);
  if (D.timer && D.timer.key === key) closesOnLoad = false;
  if (D.timer && D.timer.deadline !== c.deadline + Game.TIMER_SECONDS[D.timer.name] * 1000) { chainFromDeadline = false; caseInfo = caseInfo || "chain after " + c.name; }
}
ok("a passed timer closes on load", closesOnLoad);
ok("loading late gives the same game as one that never stopped", catchUpSame, caseInfo || "all equal");
ok("the next timer starts from the missed deadline", chainFromDeadline, caseInfo || "all equal");
ok("tested with every timer", ALL_TIMERS.every(s => covered.has(s)), [...covered].join(", "));

/* ----- 3. plain JSON ----- */
console.log("-- 3. Saved JSON is plain data");
ok("no functions, Maps, class objects, undefined or circular links in any save", !plainBad, plainBad || "all plain");
{
  const T = { now: 1e9 };
  const g = newGame(99, T);
  const data = g.toJSON();
  ok("save is plain data at the start of a game", !plainProblem(data));
  ok("save survives JSON text unchanged", JSON.stringify(JSON.parse(JSON.stringify(data))) === JSON.stringify(data));
  let threw = false;
  try { new Game({ teams: [new EP.Team({ id: 0, name: "X", members: [Bots.makePlayer(0, "a", "coop")] })] }).toJSON(); } catch (e) { threw = /Rng\.seeded/.test(e.message); }
  ok("a game with unsaveable random numbers refuses to save, with a clear reason", threw);
  const next = g.rng();                    // the number after the save point
  const g2 = load(JSON.stringify(data), T); // loaded from the save taken before it
  ok("random numbers continue the same sequence after loading", g2.rng() === next);
}

/* ----- 4. fixed-seed full game through Level 3 Mirror and mid-Level 3 reload ----- */
console.log("-- 4. Fixed-seed full game (Levels 1 to 7) with Level 3 Mirror and mid-Level 3 reload");
{
  const seed = 42;
  const TA = { now: 1e9 };
  const dA = Rng.seeded(seed + 5000);
  const gA = newGame(seed, TA);
  let snapText = null, snapNow = null, snapRngState = null;
  let l3TrialKind = null, l3IsMirror = false, l3Attr = null, l3Cost = null, l3Results = null;

  for (let i = 0; i < 5000 && !gA.over; i++) {
    if (gA.level === 3 && gA.step === "trial") {
      l3TrialKind = gA.round.trialKind;
      l3IsMirror = gA.round.trial instanceof Trial.MirrorTrial;
      l3Attr = gA.round.attr;
      l3Cost = gA.round.cost;
      if (gA.round.mirrorResults) l3Results = JSON.parse(JSON.stringify(gA.round.mirrorResults));
      if (!snapText && l3IsMirror && gA.round.trial.phase === "showtime") {
        snapText = save(gA);
        snapNow = TA.now;
        snapRngState = dA.getState();
      }
    }
    if (act(gA, TA, dA) === null) break;
    if (gA.level === 3 && gA.round && gA.round.mirrorResults) {
      l3Results = JSON.parse(JSON.stringify(gA.round.mirrorResults));
    }
  }

  let sameMidReload = false;
  if (snapText) {
    const TB = { now: snapNow };
    const dB = Rng.seeded(0);
    dB.setState(snapRngState);
    const gB = load(snapText, TB);
    for (let i = 0; i < 5000 && !gB.over; i++) {
      if (act(gB, TB, dB) === null) break;
    }
    const endA = gA.results().map(r => r.player.id + ":" + r.ending).join();
    const endB = gB.results().map(r => r.player.id + ":" + r.ending).join();
    sameMidReload = gB.over && endA === endB && save(gA) === save(gB);
  }

  ok("fixed-seed full game plays Level 3 as Mirror (Focus, cost 3) and finishes",
     gA.over && gA.results().length === 16 && l3TrialKind === "mirror" && l3IsMirror &&
     l3Attr === "focus" && l3Cost === 3 && !!l3Results && Object.keys(l3Results).length === 4);
  ok("save and load mid-Level 3 in a full game matches unbroken run", !!snapText && sameMidReload);
}

/* ----- 5. mid-Q&A, mid-Sound-hold, and mid-Mic-flash reload preserves exact deadline ----- */
console.log("-- 5. Mid-Q&A, mid-Sound-hold, and mid-Mic-flash reload");
{
  const advanceToLv3Showtime = (seed, T, { team0Humans = false } = {}) => {
    const g = newGame(seed, T);
    for (let lv = 1; lv <= 2; lv++) {
      g.startNextRound();
      g.advance();
      g.advance();
      g.runTrial();
      g.payTrialCosts();
      g.advance();
      g.closeGlitchReport();
      g.closeGiftWindow();
      g.placeAllRemaining();
      g.finishRound();
    }
    if (team0Humans) {
      for (const m of g.teams[0].members) m.isBot = false;
    }
    g.startNextRound();
    g.advance();
    g.advance();
    for (const p of g.players) { if (!p.isBot) g.mirrorConnect(p.id); }
    T.now += 16000;
    g.tick(T.now);
    T.now = g.timer.deadline;
    g.tick(T.now);
    return g;
  };
  const findSetupHumanGame = (seedStart, opts = {}) => {
    for (let s = seedStart; s < seedStart + 50; s++) {
      const T = { now: 1e9 };
      const g = advanceToLv3Showtime(s, T, opts);
      const t = g.teams[0];
      const slots = g.mirrorSetupSlots(t);
      if (slots.length >= 1 && !slots[0].isBot) return { g, T, team: t, pid: slots[0].playerId, seed: s };
    }
    throw new Error("Could not find setup human seed.");
  };
  const tickMs = EP.MirrorData.timers.tickMs;

  // (a) Mid-Sound-hold save & reload
  const { g: gSndA, T: TSndA, team: tSnd, pid: pSnd } = findSetupHumanGame(700);
  for (const port of EP.MirrorData.ports) gSndA.mirrorCableHit(pSnd, port);
  for (let i = 0; i < 6; i++) {
    const lv = gSndA.mirrorSetupView(pSnd).sound.level;
    if (lv < 74) gSndA.mirrorSoundAdjust(pSnd, lv <= 68 ? 10 : 5);
    else if (lv > 85) gSndA.mirrorSoundAdjust(pSnd, -10);
    TSndA.now += tickMs;
    gSndA.tick(TSndA.now);
  }
  const sndSnap = save(gSndA);
  const TSndB = { now: TSndA.now };
  const gSndB = load(sndSnap, TSndB);
  let lockedAtA = null, lockedAtB = null;
  for (let i = 0; i < 60 && (lockedAtA === null || lockedAtB === null); i++) {
    for (const [gx, Tx, setter] of [[gSndA, TSndA, v => { lockedAtA = v; }], [gSndB, TSndB, v => { lockedAtB = v; }]]) {
      const sv = gx.mirrorSetupView(pSnd);
      if (sv.currentStep === "sound") {
        if (sv.sound.level < 74) gx.mirrorSoundAdjust(pSnd, sv.sound.level <= 68 ? 10 : 5);
        else if (sv.sound.level > 85) gx.mirrorSoundAdjust(pSnd, -10);
      }
      Tx.now += tickMs;
      gx.tick(Tx.now);
      if (gx.mirrorSetupView(pSnd).sound.locked) setter(Tx.now);
    }
  }
  ok("mid-Sound-hold save/reload locks sound at exact same timestamp", lockedAtA !== null && lockedAtA === lockedAtB && save(gSndA) === save(gSndB));

  // (b) Mid-Mic-flash save & reload
  const { g: gMicA, T: TMicA, pid: pMic } = findSetupHumanGame(720);
  for (const port of EP.MirrorData.ports) gMicA.mirrorCableHit(pMic, port);
  gMicA.mirrorSoundHeld(pMic);
  const hideAt = gMicA.mirrorSetupView(pMic).mic.hideAt;
  TMicA.now += tickMs * 2;
  gMicA.tick(TMicA.now);
  const micSnap = save(gMicA);
  const TMicB = { now: TMicA.now };
  const gMicB = load(micSnap, TMicB);
  TMicA.now = hideAt - 1; gMicA.tick(TMicA.now);
  TMicB.now = hideAt - 1; gMicB.tick(TMicB.now);
  const stillFlashBoth = gMicA.mirrorSetupView(pMic).mic.flashing && gMicB.mirrorSetupView(pMic).mic.flashing;
  TMicA.now = hideAt; gMicA.tick(TMicA.now);
  TMicB.now = hideAt; gMicB.tick(TMicB.now);
  ok("mid-Mic-flash save/reload hides sequence at exact same timestamp",
    stillFlashBoth && !gMicA.mirrorSetupView(pMic).mic.flashing && !gMicB.mirrorSetupView(pMic).mic.flashing && save(gMicA) === save(gMicB));

  // (c) Mid-Q&A save & reload
  const { g: gQaA, T: TQaA, team: tQa } = findSetupHumanGame(740, { team0Humans: true });
  const curPid = () => gQaA.round.trial.setupCurrentPlayerId(tQa);
  for (const port of EP.MirrorData.ports) gQaA.mirrorCableHit(curPid(), port);
  gQaA.mirrorSoundHeld(curPid());
  for (let r = 0; r < EP.MirrorData.mic.roundLengths.length; r++) {
    const mv = gQaA.mirrorSetupView(curPid());
    if (mv.mic.flashing && mv.mic.hideAt !== null && TQaA.now < mv.mic.hideAt) {
      TQaA.now = mv.mic.hideAt;
      gQaA.tick(TQaA.now);
    }
    for (const n of gQaA.round.trial.micSequenceFor(tQa)) gQaA.mirrorMicTap(curPid(), n);
  }
  gQaA.mirrorPickFile(curPid(), EP.MirrorData.files.find(f => f.correct).name);
  const qaOwnerId = curPid();
  const qaDeadline = gQaA.mirrorSetupView(qaOwnerId).qa.itemDeadlineAt;
  TQaA.now += 2000;
  gQaA.tick(TQaA.now);
  const qaSnap = save(gQaA);
  const TQaB = { now: TQaA.now };
  const gQaB = load(qaSnap, TQaB);
  TQaA.now = qaDeadline - 1; gQaA.tick(TQaA.now);
  TQaB.now = qaDeadline - 1; gQaB.tick(TQaB.now);
  const preToBoth = gQaA.mirrorSetupView(qaOwnerId).qa.timeouts === 0 && gQaB.mirrorSetupView(qaOwnerId).qa.timeouts === 0;
  TQaA.now = qaDeadline; gQaA.tick(TQaA.now);
  TQaB.now = qaDeadline; gQaB.tick(TQaB.now);
  ok("mid-Q&A save/reload times out at exact same timestamp",
    preToBoth && gQaA.mirrorSetupView(qaOwnerId).qa.timeouts === 1 && gQaB.mirrorSetupView(qaOwnerId).qa.timeouts === 1 && save(gQaA) === save(gQaB));
}

/* ----- 6. Mid-dance save and load restores chart, counter, and tempo ----- */
console.log("-- 6. Mid-dance save and load restores chart, counter, and tempo");
{
  const findDanceHumanGame = seedStart => {
    for (let s = seedStart; s < seedStart + 50; s++) {
      const T = { now: 1e9 };
      const g = newGame(s, T);
      for (let lv = 1; lv <= 2; lv++) {
        g.startNextRound();
        g.advance();
        g.advance();
        g.runTrial();
        g.payTrialCosts();
        g.advance();
        g.closeGlitchReport();
        g.closeGiftWindow();
        g.placeAllRemaining();
        g.finishRound();
      }
      for (const m of g.teams[0].members) m.isBot = false;
      g.startNextRound();
      g.advance();
      g.advance();
      for (const p of g.players) { if (!p.isBot) g.mirrorConnect(p.id); }
      T.now += 16000;
      g.tick(T.now);
      T.now = g.timer.deadline;
      g.tick(T.now);
      const t = g.teams[0];
      const dIds = g.round.trial.dancerIdsFor(t);
      if (dIds.length >= 1) return { g, T, team: t, dancerId: dIds[0], seed: s };
    }
    throw new Error("Could not find dance human seed.");
  };

  const { g: gDA, T: TDA, dancerId } = findDanceHumanGame(800);
  const tickMs = EP.MirrorData.timers.tickMs;
  for (let i = 1; i <= 140 && !gDA.didRun("runTrial"); i++) {
    TDA.now += tickMs;
    gDA.tick(TDA.now);
    const dv = gDA.mirrorDanceView(dancerId);
    const perf = dv && dv.notes.find(n => n.zone === "perfect");
    if (perf) gDA.mirrorDancePress(dancerId, perf.dir);
  }
  const preView = gDA.mirrorDanceView(dancerId);
  const danceSnap = save(gDA);
  const TDB = { now: TDA.now };
  const gDB = load(danceSnap, TDB);
  const relView = gDB.mirrorDanceView(dancerId);

  for (let i = 1; i <= 20; i++) {
    TDA.now += tickMs; gDA.tick(TDA.now);
    TDB.now += tickMs; gDB.tick(TDB.now);
  }
  const afterViewA = gDA.mirrorDanceView(dancerId);
  const afterViewB = gDB.mirrorDanceView(dancerId);
  ok(
    "mid-dance save/reload restores chart, spawnedCount, tempo gapTicks, and fires identical misses/spawns",
    preView.spawnedCount > EP.MirrorData.dance.tempoRampMidNotes &&
      preView.gapTicks === EP.MirrorData.dance.gapMidTicks &&
      relView.spawnedCount === preView.spawnedCount &&
      relView.gapTicks === preView.gapTicks &&
      JSON.stringify(relView.notes) === JSON.stringify(preView.notes) &&
      JSON.stringify(afterViewA) === JSON.stringify(afterViewB) &&
      save(gDA) === save(gDB)
  );
}

/* ----- 7. Mid-round save/reload preserves round details and anomalies (old saves default to []) ----- */
console.log("-- 7. Mid-round save/reload preserves round details and anomalies (old saves default to [])");
{
  const T = { now: 1e9 };
  const mkTeam = (id, name, base) => new EP.Team({
    id,
    name,
    members: [0, 1, 2, 3].map(i => {
      const p = Bots.makePlayer(base + i, name + "_" + i, "coop");
      if (id === 0 && i === 0) p.isBot = false;
      return p;
    }),
  });
  const teams = [mkTeam(0, "Alpha", 10), mkTeam(1, "Beta", 20), mkTeam(2, "Gamma", 30)];
  const g = new Game({ teams, rng: Rng.seeded(901), clock: () => T.now, hooks: {} });
  const me = g.players[0];
  const mate = g.players[1];

  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  g.advance();        // trial (SOP)

  const addL1 = g.recordAnomaly(me, "L");
  const addL2 = g.recordAnomaly(me, "L");
  const addId = g.recordAnomaly(me, "id");
  const addBad = g.recordAnomaly(me, "bogus");

  // Leave endless step out without calling submitSop, so closeSop sets sopTimedOut=true and records "loop" for team 0
  g.setSopBoard(me, Trial.SopTrial.STEPS);
  g.closeSop();
  g.endTrial(); // pays trial costs -> glitchReport

  me.setAttrsForTest({ focus: 10 }); // guarantees wrong accusation is safe via Focus
  g.accuse(me, mate);

  const snap = save(g);
  const parsed = JSON.parse(snap);
  const g2 = load(snap, T, { hooks: {}, tick: false });
  const me2 = g2.players.find(p => p.id === me.id);
  const mate2 = g2.players.find(p => p.id === mate.id);

  const listCopy = g2.anomaliesFor(me2);
  listCopy.push("loop"); // mutating returned copy must not affect saved state
  const acc1 = g.round.accusations[0];
  const acc2 = g2.round.accusations[0];

  const oldParsed = JSON.parse(snap);
  for (const p of oldParsed.players) delete p.anomalies;
  const gOld = Game.fromJSON(oldParsed, { clock: () => T.now, hooks: {}, tick: false });

  ok(
    "mid-round save/reload keeps trialPayments, accusations[].safe, sopTimedOut, and anomalies (old saves default to [])",
    addL1 === true && addL2 === false && addId === true && addBad === false &&
      g.round.sopTimedOut === true && g2.round.sopTimedOut === true &&
      Object.keys(g.round.trialPayments).length > 0 &&
      JSON.stringify(g2.round.trialPayments) === JSON.stringify(g.round.trialPayments) &&
      !!acc1 && !!acc2 && acc1.safe === true && acc2.safe === true &&
      JSON.stringify(g2.anomaliesFor(me2)) === '["L","id","loop"]' &&
      JSON.stringify(g2.anomaliesFor(mate2)) === '["loop"]' &&
      !JSON.stringify(g2.board()).includes("anomalies") &&
      gOld.players.every(p => JSON.stringify(gOld.anomaliesFor(p)) === "[]") &&
      !plainProblem(parsed) && save(g) === save(g2)
  );
}

console.log("\n" + pass + " passed, " + fail + " failed  (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
process.exit(fail ? 1 : 0);
