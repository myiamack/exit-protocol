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
      if (r < 0.48) return "splitLock " + t.lockIn(h).ok;
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
      if (r < 0.5) { const c = t.vote.choicesFor(h).slice(); const rank = []; while (rank.length < t.vote.slotsFor(h) && c.length) rank.push(c.splice(Math.floor(d() * c.length), 1)[0]); return "vote " + t.vote.cast(h, rank).ok; }
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

console.log("\n" + pass + " passed, " + fail + " failed  (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
process.exit(fail ? 1 : 0);
