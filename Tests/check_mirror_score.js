/* Unit tests for Level 3 MirrorTrial scoring (0 to 7), Focus ranking, tie-breaks, and save/load.
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_score.js */
const fs = require("fs");
const path = require("path");
const EP = require("../rules/index.js");
const { Bots, MirrorData, Player, Rng, Round, Team, Trial } = EP;
const { MirrorTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function makeTeam(teamId, size, { humans = size, focus = 4, prefix = "P" + teamId + "_" } = {}) {
  const members = Array.from({ length: size }, (_, i) => {
    const p = Bots.makePlayer(teamId * 10 + i, prefix + i, "coop");
    p.isBot = i >= humans;
    p.setAttrsForTest({ focus, collab: 4, initiative: 4, grit: 4, composure: 4 });
    return p;
  });
  return new Team({ id: teamId, name: "Team " + teamId, members });
}

function makeRound3() {
  return new Round(3);
}

function plainProblem(x, pathStr = "save", seen = []) {
  if (x === null || typeof x === "string" || typeof x === "boolean") return null;
  if (typeof x === "number") return Number.isFinite(x) ? null : pathStr + " is " + x;
  if (typeof x !== "object") return pathStr + " is a " + typeof x;
  if (seen.includes(x)) return pathStr + " is a circular link";
  const proto = Object.getPrototypeOf(x);
  if (!Array.isArray(x) && proto !== Object.prototype) {
    return pathStr + " is a " + (proto && proto.constructor ? proto.constructor.name : "special") + " object";
  }
  for (const [k, v] of Object.entries(x)) {
    if (v === undefined) return pathStr + "." + k + " is undefined";
    const why = plainProblem(v, pathStr + "." + k, [...seen, x]);
    if (why) return why;
  }
  return null;
}

function openShowtime(teams, seed = 101) {
  const tr = new MirrorTrial(Rng.seeded(seed));
  tr.startLobby(teams);
  for (const t of teams) {
    for (const p of t.active()) tr.connect(p.id);
  }
  tr.closeDoors();
  tr.startShowtime();
  return tr;
}

function finishSetupCleanly(tr, team, opts = {}) {
  const pid = () => tr.setupCurrentPlayerId(team);
  for (const port of MirrorData.ports) tr.cableHit(pid(), port);
  tr.soundHeld(pid());
  for (let r = 0; r < MirrorData.mic.roundLengths.length; r++) {
    for (const n of tr.micSequenceFor(team)) tr.micTap(pid(), n);
  }
  const okFile = MirrorData.files.find(f => f.correct).name;
  tr.pickFile(pid(), okFile);
  for (let i = 0; i < MirrorData.qaItems.length; i++) {
    tr.answerQa(pid(), tr.currentQaFor(team).correctIndex);
  }
  return tr.wrapUp(pid(), opts);
}

console.log("-- 1. Construction, MAX_SCORE, score(attention) 0..7 edges, and guard rails");
{
  const tr = new MirrorTrial(Rng.seeded(11));
  const ownKeys = [...Object.keys(tr), ...Object.getOwnPropertyNames(tr)];
  const trialSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "Trial.js"), "utf8");
  const mirrorStart = trialSrc.indexOf("class MirrorTrial");
  const mirrorEnd = trialSrc.indexOf("class JudgedTrial");
  const mirrorSlice = trialSrc.slice(mirrorStart, mirrorEnd);
  const hasMathRandom = /Math\.random/.test(mirrorSlice);
  const hasTeamNames = /\b(kestrel|wren|finch|heron)\b/i.test(mirrorSlice) || /\bTeam\s+[A-Z]\w*/.test(mirrorSlice);

  expect(
    "MirrorTrial keeps scoring fields private, Round.LEVELS[2] stays auto, and no Math.random or team names",
    MirrorTrial.MAX_SCORE === 7 &&
      Round.LEVELS[2].trialKind === "auto" &&
      !ownKeys.includes("lockedAttention") &&
      !ownKeys.includes("#lockedAttention") &&
      !ownKeys.includes("failReasons") &&
      !hasMathRandom &&
      !hasTeamNames
  );

  const edges = [
    [-10, 0], [0, 0], [7.14, 0], [7.15, 1],
    [21.42, 1], [21.43, 2], [35.71, 2], [35.72, 3],
    [49.99, 3], [50, 4], [64.28, 4], [64.29, 5],
    [78.57, 5], [78.58, 6], [92.85, 6], [92.86, 7],
    [100, 7], [150, 7], [NaN, 0], [null, 0], [undefined, 0],
  ];
  const badEdges = edges.filter(([att, exp]) => MirrorTrial.score(att) !== exp);
  expect(
    "MirrorTrial.score maps 0..100 cleanly to 0..7 across all rounding and clamp boundaries",
    badEdges.length === 0,
    badEdges.length ? "bad=" + JSON.stringify(badEdges) : "21/21 edges"
  );
}

console.log("-- 2. Lobby failure and attention-0 failure");
{
  const tPass = makeTeam(0, 4, { humans: 4, focus: 4, prefix: "LP_" });
  const tFail = makeTeam(1, 3, { humans: 3, focus: 4, prefix: "LF_" });
  const tr = new MirrorTrial(Rng.seeded(201));
  tr.startLobby([tPass, tFail]);
  for (const p of tPass.active()) tr.connect(p.id);
  tr.connect(tFail.active()[0].id);
  tr.connect(tFail.active()[1].id); // active member 2 left outside
  tr.closeDoors();
  tr.startShowtime();

  const failCheck = tr.checkAttention(tFail, 75);
  const blockedSetup = tr.cableMiss(tFail.active()[0].id, "HDMI");
  const blockedFinish = tr.finishTeam(tFail, 60);
  finishSetupCleanly(tr, tPass, { showtimeSecondsLeft: 75 });
  const res = tr.closeMirror(makeRound3(), [tPass, tFail], { showtimeSecondsLeft: 75 });
  const failEntry = res.find(r => r.team === tFail);
  const passEntry = res.find(r => r.team === tPass);

  expect(
    "Team failing lobby scores 0 with failReason 'lobby' and stays failed",
    tr.isTeamFailed(tFail) &&
      tr.failReasonOf(tFail) === "lobby" &&
      tr.attentionFor(tFail, 75) === 0 &&
      tr.scoreFor(tFail, 75) === 0 &&
      failCheck.failed && failCheck.failReason === "lobby" && failCheck.locked &&
      !blockedSetup.ok &&
      blockedFinish.ok && blockedFinish.score === 0 && blockedFinish.failReason === "lobby" &&
      failEntry.base === 0 && failEntry.attention === 0 && failEntry.failed && failEntry.failReason === "lobby" &&
      passEntry.place === 1 && passEntry.won && !failEntry.won
  );

  // All teams fail lobby -> phase "failed", closeMirror ranks cleanly with score 0
  const fA = makeTeam(2, 3, { humans: 3, focus: 4, prefix: "FA_" });
  const fB = makeTeam(3, 3, { humans: 3, focus: 4, prefix: "FB_" });
  const trAllFail = new MirrorTrial(Rng.seeded(202));
  trAllFail.startLobby([fA, fB]);
  trAllFail.connect(fA.members[0].id);
  trAllFail.closeDoors();
  const resAllFail = trAllFail.closeMirror(makeRound3(), [fA, fB]);
  expect(
    "All-failed lobby ranks cleanly with score 0 and failReason 'lobby'",
    trAllFail.phase === "failed" &&
      resAllFail.length === 2 &&
      resAllFail.every(r => r.base === 0 && r.attention === 0 && r.failed && r.failReason === "lobby")
  );

  // Showtime attention hitting 0 locks team failure and rejects later actions
  const tDrop = makeTeam(4, 4, { humans: 4, focus: 4, prefix: "Drop_" });
  const tOk = makeTeam(5, 4, { humans: 4, focus: 4, prefix: "Ok_" });
  const trDrop = openShowtime([tDrop, tOk], 203);
  const dropS0 = trDrop.setupCurrentPlayerId(tDrop);
  for (let i = 0; i < 4; i++) trDrop.cableMiss(dropS0, "HDMI"); // 12 setup penalty
  const beforeZero = trDrop.checkAttention(tDrop, 15);           // 20 - 12 = 8 > 0 (not locked)
  const atZero = trDrop.checkAttention(tDrop, 6);                // 8 - 12 = -4 -> clamped 0 (locks failure!)
  const afterZeroSetup = trDrop.cableHit(dropS0, "HDMI");
  const afterZeroDance = trDrop.danceHit(trDrop.dancerIdsFor(tDrop)[0], "perfect");
  finishSetupCleanly(trDrop, tOk, { showtimeSecondsLeft: 60 });
  const dropRank = trDrop.closeMirror(makeRound3(), [tDrop, tOk], { showtimeSecondsLeft: 60 });
  const dropEntry = dropRank.find(r => r.team === tDrop);

  expect(
    "Attention hitting 0 locks team at 0 with failReason 'attention' and blocks further actions",
    !beforeZero.failed && !beforeZero.locked && beforeZero.attention === 8 &&
      atZero.failed && atZero.locked && atZero.attention === 0 && atZero.score === 0 && atZero.failReason === "attention" &&
      trDrop.isTeamFailed(tDrop) &&
      trDrop.failReasonOf(tDrop) === "attention" &&
      trDrop.attentionFor(tDrop, 75) === 0 &&
      trDrop.scoreFor(tDrop, 75) === 0 &&
      !afterZeroSetup.ok && !afterZeroDance.ok &&
      dropEntry.base === 0 && dropEntry.attention === 0 && dropEntry.failed && dropEntry.failReason === "attention"
  );
}

console.log("-- 3. Setup penalties, Q&A recoveries, and Dance averages feeding 0..7 score");
{
  const team = makeTeam(0, 4, { humans: 4, focus: 4, prefix: "Feed_" });
  const tr = openShowtime([team], 301);

  // Setup: +3 cableMiss, +4 soundFeedback, +4 micWrong, +6 deckWrong -> 17
  // Q&A: right (-5 -> 12), wrong (+5 -> 17), right (-5 -> 12)
  tr.cableMiss(tr.setupCurrentPlayerId(team), "HDMI");
  for (const port of MirrorData.ports) tr.cableHit(tr.setupCurrentPlayerId(team), port);
  tr.soundFeedback(tr.setupCurrentPlayerId(team));
  tr.soundHeld(tr.setupCurrentPlayerId(team));
  for (let r = 0; r < 3; r++) {
    const pMic = tr.setupCurrentPlayerId(team);
    const seq = tr.micSequenceFor(team);
    if (r === 0) {
      tr.micTap(pMic, (seq[0] % MirrorData.mic.count) + 1);
      for (const n of tr.micSequenceFor(team)) tr.micTap(pMic, n);
    } else {
      for (const n of seq) tr.micTap(pMic, n);
    }
  }
  const wrongFile = MirrorData.files.find(f => !f.correct).name;
  const okFile = MirrorData.files.find(f => f.correct).name;
  tr.pickFile(tr.setupCurrentPlayerId(team), wrongFile);
  tr.pickFile(tr.setupCurrentPlayerId(team), okFile);
  const qa0 = tr.currentQaFor(team);
  tr.answerQa(tr.setupCurrentPlayerId(team), qa0.correctIndex); // 17 -> 12
  const qa1 = tr.currentQaFor(team);
  tr.answerQa(tr.setupCurrentPlayerId(team), (qa1.correctIndex + 1) % qa1.options.length); // 12 -> 17
  const qa2 = tr.currentQaFor(team);
  tr.answerQa(tr.setupCurrentPlayerId(team), qa2.correctIndex); // 17 -> 12

  // Dance (2 dancers): d0 (+9+2=11 boost, +2 pen), d1 (+6 boost, +1 pen) -> avgBoost 8.5, avgPen 1.5
  const [d0, d1] = tr.dancerIdsFor(team);
  tr.danceHit(d0, "perfect");
  tr.danceHit(d0, "perfect");
  tr.danceHit(d0, "perfect");
  tr.danceHit(d0, "good");
  tr.danceMiss(d0);
  tr.danceHit(d1, "perfect");
  tr.danceHit(d1, "perfect");
  tr.danceStray(d1);

  // Wrap up at 37.5s left: base = 50 -> 50 + 8.5 - 12 - 1.5 = 45 -> score = round(45/100*7) = 3
  const wrapped = tr.wrapUp(tr.setupCurrentPlayerId(team), { showtimeSecondsLeft: 37.5 });
  const frozenAt10 = tr.attentionFor(team, 10);
  const danceAfterWrap = tr.danceHit(d0, "perfect");
  const ranked = tr.closeMirror(makeRound3(), [team]);

  expect(
    "Setup penalties/recoveries and averaged Dance Crew boosts/penalties feed exact attention and 0..7 score",
    tr.setupPenalties(team) === 12 &&
      tr.danceBoostFor(team) === 8.5 &&
      tr.dancePenaltiesFor(team) === 1.5 &&
      wrapped.ok && wrapped.attention === 45 && wrapped.score === 3 && !wrapped.failed &&
      tr.lockedAttentionFor(team) === 45 &&
      frozenAt10 === 45 &&
      tr.scoreFor(team, 10) === 3 &&
      !danceAfterWrap.ok &&
      ranked[0].attention === 45 && ranked[0].base === 3 && !ranked[0].failed
  );

  // Clamp high (score 7) and clamp low (score 0)
  const tHigh = makeTeam(1, 4, { humans: 4, focus: 4, prefix: "High_" });
  const tLow = makeTeam(2, 4, { humans: 4, focus: 4, prefix: "Low_" });
  const trClamp = openShowtime([tHigh, tLow], 302);
  for (const id of trClamp.dancerIdsFor(tHigh)) {
    for (let i = 0; i < 6; i++) trClamp.danceHit(id, "perfect"); // +18 boost
  }
  finishSetupCleanly(trClamp, tHigh, { showtimeSecondsLeft: 70 }); // 93.33 + 18 -> clamped 100 -> score 7
  const lowS0 = trClamp.setupCurrentPlayerId(tLow);
  for (let i = 0; i < 10; i++) trClamp.cableMiss(lowS0, "HDMI"); // -30 setup penalty
  const clampRes = trClamp.closeMirror(makeRound3(), [tHigh, tLow], { showtimeSecondsLeft: 15 }); // tLow: 20 - 30 -> clamped 0
  const highEntry = clampRes.find(r => r.team === tHigh);
  const lowEntry = clampRes.find(r => r.team === tLow);

  expect(
    "Final attention clamps at 100 (score 7) and 0 (score 0)",
    highEntry.attention === 100 && highEntry.base === 7 && !highEntry.failed &&
      lowEntry.attention === 0 && lowEntry.base === 0 && lowEntry.failed && lowEntry.failReason === "attention"
  );
}

console.log("-- 4. Team with 0 dancers");
{
  const tZero = makeTeam(0, 3, { humans: 3, focus: 4, prefix: "ZeroD_" });
  tZero.members[1].idle = true;
  tZero.members[2].idle = true; // 1 active -> 1 setup, 0 dancers
  const tOther = makeTeam(1, 4, { humans: 4, focus: 4, prefix: "HasD_" });
  const tr = openShowtime([tZero, tOther], 401);

  const zSetup = tr.setupCurrentPlayerId(tZero);
  tr.cableMiss(zSetup, "HDMI"); // +3
  for (const port of MirrorData.ports) tr.cableHit(zSetup, port);
  tr.soundFeedback(zSetup); // +4 -> total 7
  tr.soundHeld(zSetup);
  for (let r = 0; r < 3; r++) {
    for (const n of tr.micSequenceFor(tZero)) tr.micTap(zSetup, n);
  }
  tr.pickFile(zSetup, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");
  // Skip Q&A timeout (+5) or answer wrong (+5) / right (-5): use timeout + 2 rights? Let's just wrap up clean:
  // Wait: answer 1 wrong (+5 -> 12), answer 2 right (-5 -> 7, -5 -> 2). Net 2. Or 3 timeouts -> 7+15=22?
  // Let's keep 1 wrong (+5 -> 12) and 2 timeouts (+10 -> 22): at 60s left -> 80 - 22 = 58 -> score round(58/100*7=4.06) = 4
  const q0 = tr.currentQaFor(tZero);
  tr.answerQa(zSetup, (q0.correctIndex + 1) % q0.options.length);
  tr.timeoutQa(zSetup);
  tr.timeoutQa(zSetup);
  const wZero = tr.wrapUp(zSetup, { showtimeSecondsLeft: 60 }); // 80 + 0 - 22 - 0 = 58 -> 4

  tr.danceHit(tr.dancerIdsFor(tOther)[0], "perfect"); // avgBoost = 1.5
  finishSetupCleanly(tr, tOther, { showtimeSecondsLeft: 52.5 }); // 70 + 1.5 = 71.5 -> score 5

  const res = tr.closeMirror(makeRound3(), [tZero, tOther]);
  const zEntry = res.find(r => r.team === tZero);
  expect(
    "Team with 0 dancers scores with 0 dance boost/penalty and no NaN",
    tr.dancersFor(tZero).length === 0 &&
      tr.danceBoostFor(tZero) === 0 &&
      tr.dancePenaltiesFor(tZero) === 0 &&
      wZero.ok && wZero.attention === 58 && wZero.score === 4 &&
      zEntry.attention === 58 && zEntry.base === 4 && !Number.isNaN(zEntry.score) &&
      res[0].team === tOther && res[1].team === tZero
  );
}

console.log("-- 5. Focus influence (rankWithInfluence) and top-half winners");
{
  // (a) Focus moves close results (base 4 + Focus 8 beats base 5 + Focus 2)
  const tHighFocus = makeTeam(0, 4, { humans: 4, focus: 8, prefix: "HiF_" });
  const tLowFocus = makeTeam(1, 4, { humans: 4, focus: 2, prefix: "LoF_" });
  const trClose = openShowtime([tHighFocus, tLowFocus], 501);
  finishSetupCleanly(trClose, tHighFocus, { showtimeSecondsLeft: 45 });   // att 60 -> base 4 (+1.5 = 5.5)
  finishSetupCleanly(trClose, tLowFocus, { showtimeSecondsLeft: 52.5 });  // att 70 -> base 5 (-1.5 = 3.5)
  const rClose = trClose.closeMirror(makeRound3(), [tHighFocus, tLowFocus]);

  // (b) Focus does NOT decide big gaps (base 1 + Focus 10 still loses to base 7 + Focus 1)
  const tMaxFocusLowScore = makeTeam(2, 4, { humans: 4, focus: 10, prefix: "MaxF_" });
  const tMinFocusHighScore = makeTeam(3, 4, { humans: 4, focus: 1, prefix: "MinF_" });
  const trGap = openShowtime([tMaxFocusLowScore, tMinFocusHighScore], 502);
  finishSetupCleanly(trGap, tMaxFocusLowScore, { showtimeSecondsLeft: 7.5 }); // att 10 -> base 1 (+2.25 = 3.25)
  finishSetupCleanly(trGap, tMinFocusHighScore, { showtimeSecondsLeft: 75 }); // att 100 -> base 7 (-2.25 = 4.75)
  const rGap = trGap.closeMirror(makeRound3(), [tMaxFocusLowScore, tMinFocusHighScore]);

  // (c) Top-half winners: 4 teams -> 2 win; 5 teams -> 3 win
  const teams4 = [0, 1, 2, 3].map(i => makeTeam(10 + i, 4, { humans: 4, focus: 4, prefix: "W4_" + i + "_" }));
  const tr4 = openShowtime(teams4, 503);
  [15, 30, 60, 75].forEach((sec, i) => finishSetupCleanly(tr4, teams4[i], { showtimeSecondsLeft: sec }));
  const res4 = tr4.closeMirror(makeRound3(), teams4);

  const teams5 = [0, 1, 2, 3, 4].map(i => makeTeam(20 + i, 4, { humans: 4, focus: 4, prefix: "W5_" + i + "_" }));
  const tr5 = openShowtime(teams5, 504);
  [10, 25, 45, 60, 75].forEach((sec, i) => finishSetupCleanly(tr5, teams5[i], { showtimeSecondsLeft: sec }));
  const res5 = tr5.closeMirror(makeRound3(), teams5);

  // (d) Stuck/Idle excluded from Focus average
  const tMixedStatus = makeTeam(30, 4, { humans: 4, focus: 4, prefix: "StuckF_" });
  tMixedStatus.members[2].focus = 10;
  tMixedStatus.members[2].glitches = Player.STUCK_AT;
  tMixedStatus.members[3].focus = 10;
  tMixedStatus.members[3].idle = true;
  const tPlainFocus4 = makeTeam(31, 4, { humans: 4, focus: 4, prefix: "PlainF_" });
  const trExcl = openShowtime([tMixedStatus, tPlainFocus4], 505);
  finishSetupCleanly(trExcl, tMixedStatus, { showtimeSecondsLeft: 60 });
  finishSetupCleanly(trExcl, tPlainFocus4, { showtimeSecondsLeft: 60 });
  const rExcl = trExcl.closeMirror(makeRound3(), [tMixedStatus, tPlainFocus4]);

  expect(
    "Focus influence moves close scores without deciding big gaps",
    rClose[0].team === tHighFocus && rClose[0].score === 5.5 && rClose[1].score === 3.5 &&
      rGap[0].team === tMinFocusHighScore && rGap[0].score === 4.75 && rGap[1].score === 3.25
  );
  expect(
    "Top half win rounded up (4->2, 5->3) and Stuck/Idle excluded from Focus influence",
    res4.filter(r => r.won).length === 2 &&
      teams4[3].won && teams4[2].won && !teams4[1].won && !teams4[0].won &&
      teams4[3].trialWins === 1 && teams4[0].trialWins === 0 &&
      res5.filter(r => r.won).length === 3 &&
      rExcl.every(r => r.influence === 0)
  );
}

console.log("-- 6. Tie on score broken by exact attention");
{
  // (a) Same Focus (4), same base score (6), different exact attention (84 vs 80) -> 84 always wins
  let sameFocusWins = true;
  for (let s = 1; s <= 30; s++) {
    const tLowAtt = makeTeam(0, 4, { humans: 4, focus: 4, prefix: "TL_" });
    const tHighAtt = makeTeam(1, 4, { humans: 4, focus: 4, prefix: "TH_" });
    const tr = openShowtime([tLowAtt, tHighAtt], s);
    finishSetupCleanly(tr, tLowAtt, { showtimeSecondsLeft: 60 });   // att 80 -> base 6
    finishSetupCleanly(tr, tHighAtt, { showtimeSecondsLeft: 63 });  // att 84 -> base 6
    const res = tr.closeMirror(makeRound3(), [tLowAtt, tHighAtt]);
    if (res[0].team !== tHighAtt || res[0].attention !== 84 || res[1].attention !== 80 || !tHighAtt.won || tLowAtt.won) {
      sameFocusWins = false;
      break;
    }
  }

  // (b) Equal score after Focus influence (5 + 0.5 = 5.5 with att 72 vs 6 - 0.5 = 5.5 with att 80) -> 80 wins
  let mixedFocusWins = true;
  for (let s = 1; s <= 20; s++) {
    const tA = makeTeam(2, 4, { humans: 4, focus: 5, prefix: "MFA_" });
    const tB = makeTeam(3, 4, { humans: 4, focus: 3, prefix: "MFB_" });
    const tr = openShowtime([tA, tB], 100 + s);
    finishSetupCleanly(tr, tA, { showtimeSecondsLeft: 54 }); // att 72 -> base 5 + 0.5 = 5.5
    finishSetupCleanly(tr, tB, { showtimeSecondsLeft: 60 }); // att 80 -> base 6 - 0.5 = 5.5
    const res = tr.closeMirror(makeRound3(), [tA, tB]);
    if (res[0].team !== tB || res[0].score !== 5.5 || res[1].score !== 5.5 || res[0].attention !== 80) {
      mixedFocusWins = false;
      break;
    }
  }

  expect(
    "Tie on final score breaks cleanly to higher exact attention across all seeds",
    sameFocusWins && mixedFocusWins
  );
}

console.log("-- 7. Full tie broken by seeded random (EP.Rng)");
{
  const winners = new Set();
  const runTie = seed => {
    const t0 = makeTeam(0, 4, { humans: 4, focus: 4, prefix: "Tie0_" });
    const t1 = makeTeam(1, 4, { humans: 4, focus: 4, prefix: "Tie1_" });
    const tr = openShowtime([t0, t1], seed);
    finishSetupCleanly(tr, t0, { showtimeSecondsLeft: 60 }); // att 80, base 6
    finishSetupCleanly(tr, t1, { showtimeSecondsLeft: 60 }); // att 80, base 6
    const res = tr.closeMirror(makeRound3(), [t0, t1]);
    return res.map(r => r.team.id);
  };
  for (let s = 1; s <= 40; s++) winners.add(runTie(s)[0]);
  const rA = runTie(777);
  const rB = runTie(777);
  expect(
    "Full tie on score and exact attention breaks randomly via EP.Rng and repeats on same seed",
    winners.size === 2 && JSON.stringify(rA) === JSON.stringify(rB),
    "winners=" + [...winners].sort().join(",")
  );
}

console.log("-- 8. Bot-only teams");
{
  const seenScores = new Set();
  let matchedStep2c = true;
  const runBotPair = seed => {
    const b0 = makeTeam(0, 4, { humans: 0, focus: 4, prefix: "B0_" });
    const b1 = makeTeam(1, 4, { humans: 0, focus: 4, prefix: "B1_" });
    const tr = openShowtime([b0, b1], seed);
    const pre0 = tr.botAttentionFor(b0);
    const pre1 = tr.botAttentionFor(b1);
    const res = tr.closeMirror(makeRound3(), [b0, b1]);
    const e0 = res.find(r => r.team === b0);
    const e1 = res.find(r => r.team === b1);
    if (!e0.botOnly || !e1.botOnly || e0.attention !== pre0 || e1.attention !== pre1) matchedStep2c = false;
    if (e0.base !== MirrorTrial.score(pre0) || e1.base !== MirrorTrial.score(pre1)) matchedStep2c = false;
    seenScores.add(e0.base);
    seenScores.add(e1.base);
    return res.map(r => ({ id: r.team.id, att: r.attention, base: r.base, place: r.place }));
  };
  for (let s = 1; s <= 40; s++) runBotPair(s);
  const repA = runBotPair(888);
  const repB = runBotPair(888);

  // Bot-only team that failed lobby scores 0, and direct run() without startLobby works for bot-only teams
  const botFail = makeTeam(2, 3, { humans: 0, focus: 4, prefix: "BF_" });
  const trFail = new MirrorTrial(Rng.seeded(889));
  trFail.startLobby([botFail]);
  trFail.connect(botFail.members[0].id); // leave 2 bots out
  trFail.closeDoors();
  const failRes = trFail.closeMirror(makeRound3(), [botFail]);

  const direct0 = makeTeam(3, 4, { humans: 0, focus: 4, prefix: "DB0_" });
  const direct1 = makeTeam(4, 4, { humans: 0, focus: 4, prefix: "DB1_" });
  const trDirect = new MirrorTrial(Rng.seeded(890));
  const directRes = trDirect.run(makeRound3(), [direct0, direct1]);

  expect(
    "Bot-only teams reuse Step 2c random attention, span 0..7, repeat on seed, and handle lobby fail / direct run",
    matchedStep2c &&
      seenScores.size === 8 &&
      JSON.stringify(repA) === JSON.stringify(repB) &&
      failRes[0].base === 0 && failRes[0].failReason === "lobby" &&
      directRes.every(r => r.botOnly && Number.isInteger(r.attention) && r.base === MirrorTrial.score(r.attention)),
    "scores=" + [...seenScores].sort((a, b) => a - b).join(",")
  );
}

console.log("-- 9. Save and load (toJSON / fromJSON)");
{
  const tFailLobby = makeTeam(0, 3, { humans: 3, focus: 4, prefix: "SLF_" });
  const tWrapped = makeTeam(1, 4, { humans: 4, focus: 6, prefix: "SLW_" });
  const tMid = makeTeam(2, 4, { humans: 4, focus: 3, prefix: "SLM_" });
  const tBot = makeTeam(3, 4, { humans: 0, focus: 4, prefix: "SLB_" });
  const teamsA = [tFailLobby, tWrapped, tMid, tBot];
  const byIdA = new Map(teamsA.flatMap(t => t.members).map(p => [p.id, p]));

  const rngA = Rng.seeded(950);
  const trA = new MirrorTrial(rngA);
  trA.startLobby(teamsA);
  trA.connect(tFailLobby.members[0].id); // leave tFailLobby incomplete
  for (const t of [tWrapped, tMid, tBot]) {
    for (const p of t.active()) trA.connect(p.id);
  }
  trA.closeDoors();
  trA.startShowtime();

  // Wrap up tWrapped with a dance hit (+3 -> avg 1.5) at 45s left -> att 61.5 -> score 4
  trA.danceHit(trA.dancerIdsFor(tWrapped)[0], "perfect");
  finishSetupCleanly(trA, tWrapped, { showtimeSecondsLeft: 45 });

  // Mid-showtime progress on tMid (1 cable miss +3, 1 dance good +2 -> avg 1)
  trA.cableMiss(trA.setupCurrentPlayerId(tMid), "HDMI");
  trA.danceHit(trA.dancerIdsFor(tMid)[0], "good");

  const jsonMid = trA.toJSON();
  const plainErr = plainProblem(jsonMid);
  const midText = JSON.stringify(jsonMid);

  const playersB = [...byIdA.values()].map(p => Player.fromJSON(p.toJSON()));
  const byIdB = new Map(playersB.map(p => [p.id, p]));
  const teamsB = teamsA.map(t => Team.fromJSON(t.toJSON(), byIdB));
  const rngB = Rng.seeded(0);
  rngB.setState(rngA.getState());
  const trB = Trial.fromJSON(JSON.parse(midText), { rng: rngB, teams: teamsB, byId: byIdB });

  const midRestoredOk = !plainErr &&
    trB instanceof MirrorTrial &&
    JSON.stringify(trB.toJSON()) === midText &&
    trB.isTeamFailed(teamsB[0]) &&
    trB.failReasonOf(teamsB[0]) === "lobby" &&
    trB.lockedAttentionFor(teamsB[1]) === 61.5 &&
    trB.scoreFor(teamsB[1], 5) === 4 &&
    trB.botAttentionFor(teamsB[3]) === trA.botAttentionFor(tBot);

  // Continue identically and closeMirror on both
  trA.danceHit(trA.dancerIdsFor(tMid)[1], "perfect");
  trB.danceHit(trB.dancerIdsFor(teamsB[2])[1], "perfect");
  const rankA = trA.closeMirror(makeRound3(), teamsA, { showtimeSecondsLeft: 30 });
  const rankB = trB.closeMirror(makeRound3(), teamsB, { showtimeSecondsLeft: 30 });
  const strip = list => list.map(r => ({
    teamId: r.team.id, place: r.place, won: r.won, base: r.base,
    influence: r.influence, score: r.score, attention: r.attention,
    failed: r.failed, failReason: r.failReason, botOnly: r.botOnly, roll: r.roll,
  }));

  expect(
    "Mid-trial save/load restores locked attentions, fail reasons, bot attentions, and produces identical ranking",
    midRestoredOk &&
      JSON.stringify(strip(rankA)) === JSON.stringify(strip(rankB)) &&
      JSON.stringify(trA.toJSON()) === JSON.stringify(trB.toJSON()),
    plainErr || "plain"
  );

  // Post-close save/load preserves ranking, blocks second run(), blocks actions, and preserves attention-0 fail
  const tZeroSave = makeTeam(10, 4, { humans: 4, focus: 4, prefix: "SZ_" });
  const trZero = openShowtime([tZeroSave], 960);
  for (let i = 0; i < 4; i++) trZero.cableMiss(trZero.setupCurrentPlayerId(tZeroSave), "HDMI");
  trZero.checkAttention(tZeroSave, 5);
  const trZeroLoaded = Trial.fromJSON(JSON.parse(JSON.stringify(trZero.toJSON())), {
    rng: Rng.seeded(1),
    teams: [tZeroSave],
    byId: new Map(tZeroSave.members.map(p => [p.id, p])),
  });

  const closedText = JSON.stringify(trA.toJSON());
  const trAfter = Trial.fromJSON(JSON.parse(closedText), { rng: Rng.seeded(1), teams: teamsB, byId: byIdB });
  let secondRunThrew = false;
  try { trAfter.run(makeRound3(), teamsB); } catch (e) { secondRunThrew = /already ran/i.test(e.message); }

  expect(
    "Post-close save/load restores ranking with live teams, blocks re-run/actions, and keeps attention-0 fail",
    JSON.stringify(trAfter.toJSON()) === closedText &&
      trAfter.ranking.length === 4 &&
      trAfter.ranking.every((r, i) => r.team === teamsB[rankA[i].team.id] && r.place === i + 1) &&
      secondRunThrew &&
      !trAfter.danceHit(trAfter.dancerIdsFor(teamsB[2])[0], "perfect").ok &&
      trZeroLoaded.isTeamFailed(tZeroSave) &&
      trZeroLoaded.failReasonOf(tZeroSave) === "attention" &&
      trZeroLoaded.lockedAttentionFor(tZeroSave) === 0
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
