/* Timing, Game pass-through, mid-trial save/load, and full-game handoff tests for MirrorTrial (Step 3).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_timing.js */
const fs = require("fs");
const path = require("path");
const EP = require("../rules/index.js");
const { Bots, Game, MirrorData, Player, Rng, Round, Team, Trial } = EP;
const { MirrorTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
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

function makeMirrorTeams({ humanTeams = 1, totalTeams = 4, teamSize = 4, focus = 4 } = {}) {
  const teams = [];
  for (let i = 0; i < totalTeams; i++) {
    const isHumanTeam = i < humanTeams;
    const members = Array.from({ length: teamSize }, (_, j) => {
      const p = Bots.makePlayer(i * 10 + j, "T" + i + "_P" + j, "coop");
      p.isBot = !isHumanTeam;
      p.setAttrsForTest({ focus, collab: 4, initiative: 4, grit: 4, composure: 4 });
      return p;
    });
    teams.push(new Team({ id: i, name: "Team " + i, members }));
  }
  return teams;
}

function setupMirrorGame(seed, { startAt = 10000, humanTeams = 2, totalTeams = 4, hooks = {} } = {}) {
  const T = { now: startAt };
  const teams = makeMirrorTeams({ humanTeams, totalTeams });
  const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now, hooks });
  g.start();
  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  const trial = new MirrorTrial(g.rng);
  g.setTrialForTest(trial);
  g.advance();        // trial (starts MirrorTrial lobby + 30s mirrorLobby timer)
  return { g, T, teams, trial };
}

function connectTeam(g, team) {
  let last = null;
  for (const p of team.active()) last = g.mirrorConnect(p.id);
  return last;
}

function playSetupCleanlyThroughGame(g, team) {
  const tr = g.mirror();
  const pid = () => tr.setupCurrentPlayerId(team);
  for (const port of MirrorData.ports) g.mirrorCableHit(pid(), port);
  g.mirrorSoundHeld(pid());
  for (let r = 0; r < MirrorData.mic.roundLengths.length; r++) {
    for (const n of tr.micSequenceFor(team)) g.mirrorMicTap(pid(), n);
  }
  const okFile = MirrorData.files.find(f => f.correct).name;
  g.mirrorPickFile(pid(), okFile);
  for (let i = 0; i < MirrorData.qaItems.length; i++) {
    g.mirrorAnswerQa(pid(), tr.currentQaFor(team).correctIndex);
  }
  return g.mirrorWrapUp(pid());
}

console.log("-- 1. Timer constants, guards, and no Math.random or hardcoded team names");
{
  const gameSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "Game.js"), "utf8");
  const mirrorMethodStart = gameSrc.indexOf("  _mirrorWhy()");
  const mirrorMethodEnd = gameSrc.indexOf("  judged()");
  const mirrorSlice = gameSrc.slice(mirrorMethodStart, mirrorMethodEnd);
  const hasMathRandom = /Math\.random/.test(mirrorSlice);
  const hasTeamNames = /\b(kestrel|wren|finch|heron)\b/i.test(mirrorSlice) || /\bTeam\s+[A-Z]\w*/.test(mirrorSlice);

  expect(
    "TIMER_SECONDS exposes mirrorLobby (30), mirrorReveal (1), mirrorShowtime (75) and Round.LEVELS[2] uses mirror",
    Game.TIMER_SECONDS.mirrorLobby === 30 &&
      Game.TIMER_SECONDS.mirrorReveal === 1 &&
      Game.TIMER_SECONDS.mirrorShowtime === 75 &&
      MirrorTrial.LOBBY_SECONDS === 30 &&
      MirrorTrial.REVEAL_SECONDS === 1 &&
      MirrorTrial.SHOWTIME_SECONDS === 75 &&
      Round.LEVELS[2].trialKind === "mirror" &&
      !hasMathRandom &&
      !hasTeamNames
  );

  // Guards before trial step and on non-Mirror trial
  const teams = makeMirrorTeams({ humanTeams: 1, totalTeams: 2 });
  const g = new Game({ teams, rng: Rng.seeded(101), clock: () => 5000 });
  g.startNextRound(); // briefing
  let threwBeforeTrial = false;
  try { g.mirror(); } catch (e) { threwBeforeTrial = /Trial/.test(e.message); }
  const blockedBeforeTrial = g.mirrorConnect(teams[0].members[0].id);

  g.advance(); // openFloor
  g.advance(); // trial (Level 1 SopTrial)
  let threwWrongTrial = false;
  try { g.closeMirrorLobby(); } catch (e) { threwWrongTrial = /no Mirror trial/i.test(e.message); }
  const blockedWrongTrial = g.mirrorCableHit(teams[0].members[0].id, "HDMI");

  expect(
    "Game guards MirrorTrial methods in wrong step and on non-Mirror trial",
    threwBeforeTrial &&
      blockedBeforeTrial && blockedBeforeTrial.ok === false &&
      threwWrongTrial &&
      blockedWrongTrial && blockedWrongTrial.ok === false &&
      g.mirrorAttention(teams[0]) === null &&
      g.mirrorScore(teams[0]) === null
  );
}

console.log("-- 2. Full timer chain: 30s lobby -> 1s reveal -> 75s showtime -> close");
{
  const { g, T, teams, trial } = setupMirrorGame(201, { humanTeams: 2, totalTeams: 2 });
  const startAt = T.now;
  expect(
    "Entering Mirror trial starts lobby, sets 30s mirrorLobby timer, Attendance active, attention stays 100",
    trial.lobbyStarted &&
      trial.phase === "lobby" &&
      g.timer && g.timer.name === "mirrorLobby" && g.secondsLeft(T.now) === 30 &&
      g.players.every(p => !p.attendancePaused) &&
      g.mirrorAttention(teams[0], T.now) === 100
  );

  // Connect all of team 0; leave one player out on team 1 so lobby runs full 30s
  connectTeam(g, teams[0]);
  g.mirrorConnect(teams[1].members[0].id);
  T.now += 15000;
  g.tick(T.now);
  expect(
    "Mid-lobby at 15s: elapsed=15, 15s left, attention still 100",
    g.mirrorLobbyElapsed(T.now) === 15 &&
      g.secondsLeft(T.now) === 15 &&
      g.mirrorShowtimeSecondsLeft(T.now) === 75 &&
      g.mirrorAttention(teams[0], T.now) === 100
  );

  // At 30s, mirrorLobby closes -> team 1 fails lobby -> team 0 enters 1s mirrorReveal
  T.now = startAt + 30000;
  const closed30 = g.tick(T.now);
  expect(
    "At 30s mirrorLobby closes into 1s mirrorReveal with deadline +31s and attention still 100",
    JSON.stringify(closed30) === '["mirrorLobby"]' &&
      trial.phase === "reveal" &&
      trial.isTeamFailed(teams[1]) && trial.failReasonOf(teams[1]) === "lobby" &&
      !trial.isTeamFailed(teams[0]) &&
      g.timer && g.timer.name === "mirrorReveal" && g.timer.deadline === startAt + 31000 &&
      g.mirrorShowtimeSecondsLeft(T.now) === 75 &&
      g.mirrorAttention(teams[0], T.now) === 100
  );

  // At 30.5s still in reveal, attention untouched
  T.now = startAt + 30500;
  g.tick(T.now);
  expect(
    "During reveal at 30.5s attention stays 100 and showtime has not started",
    trial.phase === "reveal" &&
      g.timer && g.timer.name === "mirrorReveal" &&
      g.mirrorAttention(teams[0], T.now) === 100
  );

  // At 31s mirrorReveal closes into 75s mirrorShowtime
  T.now = startAt + 31000;
  const closed31 = g.tick(T.now);
  expect(
    "At 31s mirrorReveal closes into 75s mirrorShowtime with deadline +106s",
    JSON.stringify(closed31) === '["mirrorReveal"]' &&
      trial.phase === "showtime" &&
      g.timer && g.timer.name === "mirrorShowtime" && g.timer.deadline === startAt + 106000 &&
      g.secondsLeft(T.now) === 75 &&
      g.mirrorAttention(teams[0], T.now) === 100
  );

  // At +15s into showtime (60s left): attention drained 15s only -> 80
  T.now = startAt + 31000 + 15000;
  g.tick(T.now);
  expect(
    "Attention drains strictly by showtime clock (60s left -> 80 attention)",
    g.mirrorShowtimeSecondsLeft(T.now) === 60 &&
      g.mirrorShowtimeElapsed(T.now) === 15 &&
      g.mirrorAttention(teams[0], T.now) === 80
  );

  // Add dancer boost on team 0 so score is non-zero when 75s expires naturally
  const dancers0 = trial.dancerIdsFor(teams[0]);
  for (let i = 0; i < 6; i++) g.mirrorDanceHit(dancers0[0], "perfect"); // +18 / 2 = +9 avg boost

  // At +106s (75s showtime elapsed): mirrorShowtime closes and records round.mirrorResults
  T.now = startAt + 106000;
  const closedEnd = g.tick(T.now);
  const mr = g.round.mirrorResults;
  expect(
    "At 75s showtime end, trial closes, scores remaining team, and writes round.mirrorResults",
    JSON.stringify(closedEnd) === '["mirrorShowtime"]' &&
      g.didRun("runTrial") &&
      g.timer === null &&
      mr && mr[teams[0].id] && mr[teams[1].id] &&
      mr[teams[0].id].attention === 9 && mr[teams[0].id].score === 1 && !mr[teams[0].id].failed &&
      mr[teams[1].id].attention === 0 && mr[teams[1].id].score === 0 && mr[teams[1].id].failReason === "lobby"
  );
}

console.log("-- 3. Early lobby close on allConnected and mirrorMiss pass-through");
{
  const { g, T, teams, trial } = setupMirrorGame(301, { humanTeams: 2, totalTeams: 2 });
  const startAt = T.now;
  const p0 = teams[0].members[0];
  const beforeSpeed = trial.lobbyPlayerState(p0.id).speed;
  const missRes = g.mirrorMiss(p0.id);
  const afterSpeed = trial.lobbyPlayerState(p0.id).speed;

  T.now = startAt + 12000;
  connectTeam(g, teams[0]);
  const notYet = trial.phase;
  const finalConn = connectTeam(g, teams[1]);
  expect(
    "mirrorMiss speeds up tile and final connect closes lobby early at 12s into 1s mirrorReveal",
    missRes.ok && afterSpeed === Math.min(MirrorData.lobby.signalMaxSpeed, beforeSpeed + MirrorData.lobby.signalMissSpeedUp) &&
      notYet === "lobby" &&
      finalConn.ok && finalConn.closed === true && finalConn.phase === "reveal" &&
      g.timer && g.timer.name === "mirrorReveal" && g.timer.deadline === startAt + 13000
  );

  T.now = startAt + 13000;
  g.tick(T.now);
  expect(
    "Early reveal chains mirrorShowtime from +13s to +88s",
    trial.phase === "showtime" &&
      g.timer && g.timer.name === "mirrorShowtime" && g.timer.deadline === startAt + 88000
  );
}

console.log("-- 4. Lobby fail fast-close (all fail, and human fail with bot-only teams)");
{
  // (a) All teams fail lobby at 30s -> closes immediately with score 0
  const TAll = { now: 10000 };
  const hooksSeen = [];
  const gHook = new Game({
    teams: makeMirrorTeams({ humanTeams: 2, totalTeams: 2 }),
    rng: Rng.seeded(401),
    clock: () => TAll.now,
    hooks: { onStart: (_, n) => hooksSeen.push("start:" + n), beforeClose: (_, n) => hooksSeen.push("close:" + n) },
  });
  gHook.start();
  gHook.startNextRound();
  gHook.advance();
  gHook.setTrialForTest(new MirrorTrial(gHook.rng));
  gHook.advance();
  gHook.mirrorConnect(gHook.teams[0].members[0].id);

  TAll.now = 40000;
  const closedAll = gHook.tick(TAll.now);
  expect(
    "All-fail lobby closes immediately at 30s without opening reveal or showtime",
    JSON.stringify(closedAll) === '["mirrorLobby"]' &&
      gHook.round.trial.phase === "failed" &&
      gHook.didRun("runTrial") &&
      gHook.timer === null &&
      gHook.round.mirrorResults[0].score === 0 && gHook.round.mirrorResults[0].failReason === "lobby" &&
      gHook.round.mirrorResults[1].score === 0 && gHook.round.mirrorResults[1].failReason === "lobby" &&
      !hooksSeen.includes("start:mirrorReveal") && !hooksSeen.includes("start:mirrorShowtime")
  );

  // (b) 1 human team fails lobby while 3 bot-only teams connected -> closes immediately at 30s
  const { g: gMix, T: TMix, teams: teamsMix, trial: trialMix } = setupMirrorGame(402, { humanTeams: 1, totalTeams: 4 });
  connectTeam(gMix, teamsMix[1]);
  connectTeam(gMix, teamsMix[2]);
  connectTeam(gMix, teamsMix[3]);
  gMix.mirrorConnect(teamsMix[0].members[0].id); // leave human teammate out

  TMix.now += 30000;
  const closedMix = gMix.tick(TMix.now);
  const resMix = gMix.round.mirrorResults;
  expect(
    "Human team lobby fail closes immediately at 30s even when bot-only teams passed lobby",
    JSON.stringify(closedMix) === '["mirrorLobby"]' &&
      gMix.didRun("runTrial") &&
      gMix.timer === null &&
      trialMix.failReasonOf(teamsMix[0]) === "lobby" &&
      resMix[teamsMix[0].id].score === 0 && resMix[teamsMix[0].id].failReason === "lobby" &&
      [1, 2, 3].every(id => resMix[id].botOnly && resMix[id].score === MirrorTrial.score(resMix[id].attention))
  );
}

console.log("-- 5. Setup/Dance Game pass-throughs and partial/full human wrap-up");
{
  const { g, T, teams, trial } = setupMirrorGame(501, { humanTeams: 2, totalTeams: 4 });
  T.now += 10000;
  connectTeam(g, teams[0]);
  connectTeam(g, teams[1]);
  connectTeam(g, teams[2]);
  connectTeam(g, teams[3]);
  T.now += 1000;
  g.tick(T.now); // startShowtime

  // Advance 15s into showtime (60s left -> base 80)
  T.now += 15000;
  g.tick(T.now);

  const pid0 = () => trial.setupCurrentPlayerId(teams[0]);
  const rCableMiss = g.mirrorCableMiss(pid0(), "HDMI"); // +3
  for (const port of MirrorData.ports) g.mirrorCableHit(pid0(), port);
  const rSoundFb = g.mirrorSoundFeedback(pid0()); // +4
  g.mirrorSoundHeld(pid0());
  const firstMicSeq = trial.micSequenceFor(teams[0]);
  const rMicWrong = g.mirrorMicTap(pid0(), (firstMicSeq[0] % MirrorData.mic.count) + 1); // +4
  for (let r = 0; r < MirrorData.mic.roundLengths.length; r++) {
    for (const n of trial.micSequenceFor(teams[0])) g.mirrorMicTap(pid0(), n);
  }
  const rReshuffle = g.mirrorReshuffleDeck(teams[0]);
  const wrongFile = MirrorData.files.find(f => !f.correct).name;
  const rWrongFile = g.mirrorPickFile(pid0(), wrongFile); // +6 -> total setup pen 17
  g.mirrorPickFile(pid0(), MirrorData.files.find(f => f.correct).name);
  const qa0 = trial.currentQaFor(teams[0]);
  const rQaWrong = g.mirrorAnswerQa(pid0(), (qa0.correctIndex + 1) % qa0.options.length); // +5 -> 22
  const qa1 = trial.currentQaFor(teams[0]);
  const rQaRight = g.mirrorAnswerQa(pid0(), qa1.correctIndex); // -5 -> 17
  const rQaTo = g.mirrorTimeoutQa(pid0()); // +5 -> 22

  const [d0, d1] = trial.dancerIdsFor(teams[0]);
  const rDHit1 = g.mirrorDanceHit(d0, "perfect"); // +3
  const rDHit2 = g.mirrorDanceHit(d1, "good");    // +2 -> avgBoost = 2.5
  const rDMiss = g.mirrorDanceMiss(d0);           // +2 -> avgPen = 1.0
  const rDStray = g.mirrorDanceStray(d1);         // +1 -> avgPen = 1.5
  // At 60s left: 80 + 2.5 - 22 - 1.5 = 59 -> score round(59/100*7) = 4
  const preWrapAtt = g.mirrorAttention(teams[0], T.now);
  const preWrapScore = g.mirrorScore(teams[0], T.now);
  const wrap0 = g.mirrorWrapUp(pid0());

  // Wait 20s more; team 0 attention must stay frozen at 59 while team 1 keeps draining
  T.now += 20000;
  g.tick(T.now);
  const frozenAtt0 = g.mirrorAttention(teams[0], T.now);
  const t1Wrap = playSetupCleanlyThroughGame(g, teams[1]);

  expect(
    "All Setup & Dance pass-throughs work, first human wrap-up locks team 0, second closes trial",
    rCableMiss.ok && rSoundFb.ok && rMicWrong.ok && rReshuffle.ok && rWrongFile.ok &&
      rQaWrong.ok && rQaRight.ok && rQaTo.ok &&
      rDHit1.ok && rDHit2.ok && rDMiss.ok && rDStray.ok &&
      preWrapAtt === 59 && preWrapScore === 4 &&
      wrap0.ok && wrap0.attention === 59 && wrap0.score === 4 && !wrap0.closed &&
      frozenAtt0 === 59 &&
      t1Wrap.ok && t1Wrap.closed === true &&
      g.didRun("runTrial") && g.timer === null &&
      g.round.mirrorResults[teams[0].id].attention === 59 &&
      g.round.mirrorResults[teams[1].id].score === 4 &&
      g.round.mirrorResults[teams[2].id].botOnly &&
      g.round.mirrorResults[teams[3].id].botOnly
  );
}

console.log("-- 6. Attention hitting 0 during showtime (action-triggered and clock-drain)");
{
  // (a) Action-triggered attention 0 closes trial immediately
  const { g: gAct, T: TAct, teams: teamsAct, trial: trialAct } = setupMirrorGame(601, { humanTeams: 1, totalTeams: 2 });
  TAct.now += 5000;
  connectTeam(gAct, teamsAct[0]);
  connectTeam(gAct, teamsAct[1]);
  TAct.now += 1000;
  gAct.tick(TAct.now); // showtime starts
  TAct.now += 70000;   // 5s left -> base ~6.67
  gAct.tick(TAct.now);
  const sAct = trialAct.setupCurrentPlayerId(teamsAct[0]);
  gAct.mirrorCableMiss(sAct, "HDMI"); // -3 -> 3.67
  gAct.mirrorCableMiss(sAct, "HDMI"); // -3 -> 0.67
  const thirdMiss = gAct.mirrorCableMiss(sAct, "HDMI"); // -3 -> 0 -> fails & closes!

  expect(
    "Penalty action dropping attention to 0 fails team with failReason 'attention' and closes trial",
    thirdMiss.ok && thirdMiss.failed === true && thirdMiss.failReason === "attention" &&
      thirdMiss.score === 0 && thirdMiss.closed === true &&
      gAct.didRun("runTrial") && gAct.timer === null &&
      gAct.round.mirrorResults[teamsAct[0].id].attention === 0 &&
      gAct.round.mirrorResults[teamsAct[0].id].failReason === "attention"
  );

  // (b) Clock drain in tick() dropping attention to 0 closes trial early before 75s
  const { g: gClk, T: TClk, teams: teamsClk, trial: trialClk } = setupMirrorGame(602, { humanTeams: 1, totalTeams: 2 });
  TClk.now += 5000;
  connectTeam(gClk, teamsClk[0]);
  connectTeam(gClk, teamsClk[1]);
  TClk.now += 1000;
  gClk.tick(TClk.now); // showtime starts (75s deadline)
  TClk.now += 15000;   // 60s left -> base 80
  gClk.tick(TClk.now);
  const sClk = trialClk.setupCurrentPlayerId(teamsClk[0]);
  for (let i = 0; i < 4; i++) gClk.mirrorCableMiss(sClk, "HDMI"); // 12 penalty -> hits 0 at 9s left (66s elapsed)
  TClk.now += 54000; // 69s elapsed (6s left -> base 8 - 12 = -4 -> 0), BEFORE 75s deadline!
  const closedClk = gClk.tick(TClk.now);

  expect(
    "Clock drain reaching attention 0 closes mirrorShowtime early in tick() with failReason 'attention'",
    JSON.stringify(closedClk) === '["mirrorShowtime"]' &&
      gClk.didRun("runTrial") && gClk.timer === null &&
      trialClk.failReasonOf(teamsClk[0]) === "attention" &&
      gClk.round.mirrorResults[teamsClk[0].id].attention === 0 &&
      gClk.round.mirrorResults[teamsClk[0].id].failReason === "attention"
  );

  // (c) mirrorCheckAttention and mirrorFinishTeam pass-throughs with 2 human teams
  const { g: gChk, T: TChk, teams: teamsChk, trial: trialChk } = setupMirrorGame(603, { humanTeams: 2, totalTeams: 2 });
  TChk.now += 5000;
  connectTeam(gChk, teamsChk[0]);
  connectTeam(gChk, teamsChk[1]);
  TChk.now += 1000;
  gChk.tick(TChk.now);
  const sChk = trialChk.setupCurrentPlayerId(teamsChk[0]);
  for (let i = 0; i < 4; i++) gChk.mirrorCableMiss(sChk, "HDMI");
  TChk.now += 69000; // team 0 hits 0, team 1 still > 0
  const chk0 = gChk.mirrorCheckAttention(teamsChk[0], TChk.now);
  const fin1 = gChk.mirrorFinishTeam(teamsChk[1]);
  expect(
    "mirrorCheckAttention and mirrorFinishTeam handle partial vs final human team completion",
    chk0.ok && chk0.failed && chk0.failReason === "attention" && !chk0.closed &&
      fin1.ok && fin1.closed === true && gChk.didRun("runTrial")
  );
}

console.log("-- 7. Mid-trial save and load catch-up + plain JSON");
{
  // (a) Save in mirrorLobby -> wake in lobby, reveal, showtime, and post-close vs continuous twin
  const { g, T, teams } = setupMirrorGame(701, { humanTeams: 2, totalTeams: 4 });
  const startAt = T.now;
  connectTeam(g, teams[0]);
  connectTeam(g, teams[2]);
  connectTeam(g, teams[3]);
  g.mirrorConnect(teams[1].members[0].id); // team 1 incomplete -> full lobby -> reveal -> showtime path
  T.now = startAt + 10000;
  g.tick(T.now);

  const savedLobby = g.toJSON();
  const plainErr = plainProblem(savedLobby);
  const lobbyText = JSON.stringify(savedLobby);

  const loadAt = (ms) => Game.fromJSON(JSON.parse(lobbyText), { clock: () => startAt + ms });
  const gLobby20 = loadAt(20000);
  const gReveal30_5 = loadAt(30500);
  const gShow50 = loadAt(50000);
  const gClosed120 = loadAt(120000);

  // Continuous twin ticked every 1s to +50s and +120s
  const TCont = { now: startAt + 10000 };
  const gCont = Game.fromJSON(JSON.parse(lobbyText), { clock: () => TCont.now, tick: false });
  for (let ms = 11000; ms <= 50000; ms += 1000) { TCont.now = startAt + ms; gCont.tick(TCont.now); }
  const contAt50Text = JSON.stringify(gCont.toJSON());
  for (let ms = 51000; ms <= 120000; ms += 1000) { TCont.now = startAt + ms; gCont.tick(TCont.now); }
  const contAt120Text = JSON.stringify(gCont.toJSON());

  expect(
    "Save in mirrorLobby is plain JSON and wakes identically at 20s (lobby), 30.5s (reveal), 50s (showtime), and 120s (closed)",
    !plainErr &&
      gLobby20.timer.name === "mirrorLobby" && gLobby20.mirrorLobbyElapsed(startAt + 20000) === 20 && gLobby20.secondsLeft(startAt + 20000) === 10 &&
      gReveal30_5.timer.name === "mirrorReveal" && gReveal30_5.mirrorAttention(gReveal30_5.teams[0], startAt + 30500) === 100 &&
      gShow50.timer.name === "mirrorShowtime" && gShow50.mirrorShowtimeElapsed(startAt + 50000) === 19 && gShow50.mirrorShowtimeSecondsLeft(startAt + 50000) === 56 &&
      JSON.stringify(gShow50.toJSON()) === contAt50Text &&
      gClosed120.didRun("runTrial") && gClosed120.timer === null &&
      JSON.stringify(gClosed120.toJSON()) === contAt120Text,
    plainErr || "exact match"
  );

  // (b) Save mid-showtime -> reload & continue identically, plus wake past showtime deadline & post-close reload
  const { g: gMid, T: TMid, teams: teamsMid, trial: trialMid } = setupMirrorGame(702, { humanTeams: 2, totalTeams: 4 });
  const midStart = TMid.now;
  TMid.now += 8000;
  for (const t of teamsMid) connectTeam(gMid, t);
  TMid.now += 1000;
  gMid.tick(TMid.now); // showtime starts at midStart + 9000 (deadline midStart + 84000)
  TMid.now += 10000;
  gMid.tick(TMid.now);

  const mPid = trialMid.setupCurrentPlayerId(teamsMid[0]);
  gMid.mirrorCableMiss(mPid, "HDMI");
  gMid.mirrorCableHit(mPid, MirrorData.ports[0]);
  gMid.mirrorCableHit(mPid, MirrorData.ports[1]);
  gMid.mirrorDanceHit(trialMid.dancerIdsFor(teamsMid[0])[0], "perfect");

  const midJson = gMid.toJSON();
  const midPlainErr = plainProblem(midJson);
  const midText = JSON.stringify(midJson);

  // Reload A: wake at same time and finish identically
  const TMidReload = { now: TMid.now };
  const gMidReload = Game.fromJSON(JSON.parse(midText), { clock: () => TMidReload.now });
  // Finish remaining cables, sound, mic, deck, qa, wrap-up on both
  const finishBoth = (game, teamIdx) => {
    const t = game.teams[teamIdx];
    const tr = game.mirror();
    const p = () => tr.setupCurrentPlayerId(t);
    for (const port of MirrorData.ports.slice(2)) game.mirrorCableHit(p(), port);
    game.mirrorSoundHeld(p());
    for (let r = 0; r < MirrorData.mic.roundLengths.length; r++) {
      for (const n of tr.micSequenceFor(t)) game.mirrorMicTap(p(), n);
    }
    game.mirrorPickFile(p(), MirrorData.files.find(f => f.correct).name);
    for (let i = 0; i < MirrorData.qaItems.length; i++) game.mirrorAnswerQa(p(), tr.currentQaFor(t).correctIndex);
    return game.mirrorWrapUp(p());
  };
  TMid.now += 5000;
  TMidReload.now += 5000;
  finishBoth(gMid, 0);
  finishBoth(gMidReload, 0);
  playSetupCleanlyThroughGame(gMid, gMid.teams[1]);
  playSetupCleanlyThroughGame(gMidReload, gMidReload.teams[1]);

  // Reload B: wake past showtime deadline (+90s after showtime start) vs continuous twin
  const gLateWake = Game.fromJSON(JSON.parse(midText), { clock: () => midStart + 90000 });
  const TLateCont = { now: midStart + 19000 };
  const gLateCont = Game.fromJSON(JSON.parse(midText), { clock: () => TLateCont.now, tick: false });
  for (let ms = 20000; ms <= 90000; ms += 1000) { TLateCont.now = midStart + ms; gLateCont.tick(TLateCont.now); }

  // Reload C: post-close save preserves round.mirrorResults and live trial.ranking
  const closedSaveText = JSON.stringify(gMid.toJSON());
  const gAfterClose = Game.fromJSON(JSON.parse(closedSaveText), { clock: () => TMid.now });

  expect(
    "Mid-showtime save/load finishes identically, catches up past deadline identically, and preserves mirrorResults",
    !midPlainErr &&
      JSON.stringify(gMid.toJSON()) === JSON.stringify(gMidReload.toJSON()) &&
      JSON.stringify(gMid.round.mirrorResults) === JSON.stringify(gMidReload.round.mirrorResults) &&
      JSON.stringify(gLateWake.toJSON()) === JSON.stringify(gLateCont.toJSON()) &&
      gLateWake.didRun("runTrial") &&
      gAfterClose.round.mirrorResults &&
      JSON.stringify(gAfterClose.round.mirrorResults) === JSON.stringify(gMid.round.mirrorResults) &&
      gAfterClose.round.trial.ranking.length === 4 &&
      !gAfterClose.mirrorCableHit(gAfterClose.teams[0].members[0].id, "HDMI").ok,
    midPlainErr || "identical"
  );
}

console.log("-- 8. Fixed-seed full Level 3 handoff to the rest of the game");
{
  const runFullThroughLevel3 = seed => {
    const T = { now: 100000 };
    const pick = Rng.seeded(seed * 7919);
    const types = ["coop", "indep", "contra"];
    const players = Array.from({ length: 16 }, (_, i) => {
      const p = Bots.makePlayer(i, "P" + i, types[Math.floor(pick() * 3)]);
      if (i < 4) p.isBot = false; // Team 0 is human team
      return p;
    });
    const teams = [0, 1, 2, 3].map(i => new Team({ id: i, name: "Team " + i, members: players.slice(i * 4, i * 4 + 4) }));
    const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now });

    // Play Levels 1 and 2 normally
    for (let lv = 1; lv <= 2; lv++) {
      g.startNextRound();
      g.advance(); // openFloor
      Bots.openFloor(g, g.rng);
      g.advance(); // trial
      Bots.trial(g, g.rng);
      g.payTrialCosts();
      g.advance(); // glitchReport
      Bots.accusations(g, g.rng);
      g.closeGlitchReport(); // giftWindow
      Bots.gifts(g, g.rng);
      g.closeGiftWindow(); // lockIn -> statsUpdate -> computeEarnings
      for (const p of g.players) {
        if (!p.isStuck()) {
          p.earned = Math.min(p.earned, p.roomLeft());
          p.placePoints(Bots.allocate(p, p.earned, false));
        }
      }
      g.finishRound();
    }

    // Enter Level 3, inject MirrorTrial
    g.startNextRound(); // Level 3 briefing
    g.advance();        // openFloor
    Bots.openFloor(g, g.rng);
    g.setTrialForTest(new MirrorTrial(g.rng));
    g.start();
    g.advance();        // trial -> starts MirrorLobby + 30s timer

    const focusBefore = g.players.map(p => p.attrs.focus);
    const winsBefore = g.teams.map(t => t.trialWins);
    const level3Attr = g.round.attr;
    const level3Cost = g.round.cost;

    T.now += 5000;
    for (const t of g.teams) connectTeam(g, t);
    T.now += 1000;
    g.tick(T.now); // showtime
    T.now += 10000;
    g.tick(T.now);
    const wrapRes = playSetupCleanlyThroughGame(g, g.teams[0]);

    const mirrorResults = JSON.parse(JSON.stringify(g.round.mirrorResults));
    const rankingWinners = g.round.trial.ranking.filter(r => r.won).map(r => r.team.id);

    const costs = g.payTrialCosts();
    const focusAfter = g.players.map(p => p.attrs.focus);
    g.advance(); // glitchReport
    Bots.accusations(g, g.rng);
    g.closeGlitchReport(); // giftWindow
    Bots.gifts(g, g.rng);
    g.closeGiftWindow(); // lockIn -> statsUpdate -> computeEarnings
    const earnings3 = JSON.parse(JSON.stringify(g.round.earnings));
    for (const p of g.players) {
      if (!p.isStuck()) {
        p.earned = Math.min(p.earned, p.roomLeft());
        p.placePoints(Bots.allocate(p, p.earned, false));
      }
    }
    g.finishRound();
    g.startNextRound(); // Level 4 briefing

    return {
      g,
      level3Attr,
      level3Cost,
      wrapRes,
      mirrorResults,
      rankingWinners,
      costsSize: costs.size,
      focusBefore,
      focusAfter,
      winsBefore,
      winsAfter: g.teams.map(t => t.trialWins),
      earnings3,
      json: JSON.stringify(g.toJSON()),
    };
  };

  const r1 = runFullThroughLevel3(808);
  const r2 = runFullThroughLevel3(808);
  const winnersMatchWins = r1.g.teams.every((t, i) => t.trialWins === r1.winsBefore[i] + (r1.rankingWinners.includes(t.id) ? 1 : 0));
  const earningsMatchRules = r1.g.teams.every(t =>
    t.members.every(p => {
      const lines = r1.earnings3[p.id];
      if (p.isStuck()) return lines === undefined;
      if (p.glitchedThisRound) return Array.isArray(lines) && lines.includes("Glitched this round: 1");
      return Array.isArray(lines) && lines.includes(r1.rankingWinners.includes(t.id) ? "Points earned: 4" : "Points earned: 2");
    })
  );

  expect(
    "Fixed-seed Level 3 plays start-to-finish, charges 3 Focus, pays earnings, updates trialWins, advances to Level 4, and repeats identically",
    r1.wrapRes.closed === true &&
      r1.level3Attr === "focus" && r1.level3Cost === 3 &&
      Object.keys(r1.mirrorResults).length === 4 &&
      r1.rankingWinners.length === 2 &&
      winnersMatchWins &&
      earningsMatchRules &&
      r1.costsSize === r1.g.players.filter(p => !p.isStuck()).length &&
      r1.focusAfter.every((v, i) => v <= r1.focusBefore[i]) &&
      r1.g.level === 4 && r1.g.step === "briefing" &&
      r1.json === r2.json
  );
}

console.log("-- 9. Hook firing order and exact deadline timestamps during catch-up");
{
  const hookLog = [];
  const T = { now: 10000 };
  const teams = makeMirrorTeams({ humanTeams: 2, totalTeams: 2 });
  const g = new Game({
    teams,
    rng: Rng.seeded(901),
    clock: () => T.now,
    hooks: {
      onStart: (game, name) => hookLog.push("onStart:" + name + "@" + game.now()),
      beforeClose: (game, name) => hookLog.push("beforeClose:" + name + "@" + game.now()),
    },
  });
  g.start();
  g.startNextRound();
  g.advance(); // openFloor
  g.setTrialForTest(new MirrorTrial(g.rng));
  hookLog.length = 0;
  g.advance(); // trial -> starts mirrorLobby at 10000
  connectTeam(g, teams[0]);
  g.mirrorConnect(teams[1].members[0].id); // leave 1 out on team 1

  T.now = 10000 + 120000;
  const closed = g.tick(T.now);
  const expectedLog = [
    "onStart:mirrorLobby@10000",
    "beforeClose:mirrorLobby@40000",
    "onStart:mirrorReveal@40000",
    "beforeClose:mirrorReveal@41000",
    "onStart:mirrorShowtime@41000",
    "beforeClose:mirrorShowtime@116000",
  ];
  expect(
    "Hooks fire in exact order with deadline timestamps across mirrorLobby -> mirrorReveal -> mirrorShowtime catch-up",
    JSON.stringify(closed) === '["mirrorLobby","mirrorReveal","mirrorShowtime"]' &&
      JSON.stringify(hookLog) === JSON.stringify(expectedLog),
    hookLog.join(" -> ")
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
