/* Unit tests for Level 3 MirrorLobby (direct) and MirrorTrial coordinator (lobby + crew deal).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_lobby.js */
const EP = require("../rules/index.js");
const { Bots, MirrorData, MirrorParts, Player, Rng, Round, Team, Trial } = EP;
const { MirrorLobby } = MirrorParts;
const { MirrorTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function makeTeam(teamId, size, { humans = size, prefix = "P" + teamId + "_" } = {}) {
  const members = Array.from({ length: size }, (_, i) => {
    const p = Bots.makePlayer(teamId * 10 + i, prefix + i, "coop");
    p.isBot = i >= humans;
    p.setAttrsForTest({ focus: 4, collab: 4, initiative: 4, grit: 4, composure: 4 });
    return p;
  });
  return new Team({ id: teamId, name: "Team " + teamId, members });
}

function plainProblem(x, path = "save", seen = []) {
  if (x === null || typeof x === "string" || typeof x === "boolean") return null;
  if (typeof x === "number") return Number.isFinite(x) ? null : path + " is " + x;
  if (typeof x !== "object") return path + " is a " + typeof x;
  if (seen.includes(x)) return path + " is a circular link";
  const proto = Object.getPrototypeOf(x);
  if (!Array.isArray(x) && proto !== Object.prototype) {
    return path + " is a " + (proto && proto.constructor ? proto.constructor.name : "special") + " object";
  }
  for (const [k, v] of Object.entries(x)) {
    if (v === undefined) return path + "." + k + " is undefined";
    const why = plainProblem(v, path + "." + k, [...seen, x]);
    if (why) return why;
  }
  return null;
}

console.log("-- 1. Construction, exports, and Round.LEVELS guard");
{
  let lobbyThrew = false;
  try { new MirrorLobby(); } catch (e) { lobbyThrew = /rng/i.test(e.message); }
  let trialThrew = false;
  try { new MirrorTrial(); } catch (e) { trialThrew = /rng/i.test(e.message); }
  expect("MirrorLobby and MirrorTrial reject missing rng", lobbyThrew && trialThrew);

  const tr = new MirrorTrial(Rng.seeded(11));
  const ownKeys = [...Object.keys(tr), ...Object.getOwnPropertyNames(tr)];
  expect(
    "MirrorTrial keeps #lobby private and is exported through Trial and MirrorParts",
    typeof MirrorLobby === "function" &&
      typeof MirrorTrial === "function" &&
      tr.kind === "mirror" &&
      tr.phase === "idle" &&
      !ownKeys.includes("lobby") &&
      !ownKeys.includes("#lobby") &&
      tr.lobby === undefined
  );

  const r3 = new Round(3);
  const forR3 = Trial.forRound(r3, Rng.seeded(12));
  const forMirror = Trial.forRound({ trialKind: "mirror" }, Rng.seeded(12));
  expect(
    "Round.LEVELS[2] uses mirror and Trial.forRound returns MirrorTrial",
    Round.LEVELS[2].trialKind === "mirror" &&
      forR3 instanceof MirrorTrial &&
      forMirror instanceof MirrorTrial
  );
}

console.log("-- 2. MirrorLobby direct: active-only, connect/miss, speed cap, bot times, closeDoors");
{
  // Stuck and Idle players excluded from lobby
  const mixed = makeTeam(0, 5, { humans: 2 });
  const [pHuman0, pHumanStuck, pBotIdle, pBot3, pBot4] = mixed.members;
  pHumanStuck.glitches = Player.STUCK_AT;
  pBotIdle.idle = true;

  const lobby = new MirrorLobby(Rng.seeded(101), [mixed]);
  const ps = lobby.playersForTeam(mixed);
  expect(
    "MirrorLobby excludes Stuck and Idle players and includes active players only",
    ps.length === 3 &&
      lobby.hasPlayer(pHuman0.id) &&
      !lobby.hasPlayer(pHumanStuck.id) &&
      !lobby.hasPlayer(pBotIdle.id) &&
      lobby.hasPlayer(pBot3.id) &&
      lobby.hasPlayer(pBot4.id) &&
      !lobby.connect(pHumanStuck.id).ok &&
      !lobby.miss(pBotIdle.id).ok &&
      !lobby.miss(pHumanStuck.id).ok
  );

  // Initial speed, zone, miss speed-up (+2 up to cap 16), and glitch reasons
  const init0 = lobby.playerState(pHuman0.id);
  const startSpeed = init0.speed;
  const L = MirrorData.lobby;
  const zoneMax = 100 - L.signalBandWidth - (L.signalZonePadding - L.signalZoneMin);
  let prevSpeed = startSpeed;
  let steppedByStep = true;
  let allReasonsValid = true;
  const recordedSpeeds = [startSpeed];
  for (let i = 0; i < 8; i++) {
    const r = lobby.miss(pHuman0.id);
    if (!r.ok || r.misses !== i + 1) steppedByStep = false;
    const expected = Math.min(L.signalMaxSpeed, prevSpeed + L.signalMissSpeedUp);
    if (r.speed !== expected || r.speed > L.signalMaxSpeed) steppedByStep = false;
    if (!MirrorData.flavor.glitchReasons.includes(r.glitchReason)) allReasonsValid = false;
    prevSpeed = r.speed;
    recordedSpeeds.push(r.speed);
  }
  expect(
    "MirrorLobby miss raises tile speed by +2 up to cap 16 with valid glitchReason",
    startSpeed >= L.signalStartSpeedMin &&
      startSpeed < L.signalStartSpeedMin + L.signalStartSpeedRange &&
      init0.zone >= L.signalZoneMin &&
      init0.zone <= zoneMax &&
      steppedByStep &&
      allReasonsValid &&
      lobby.playerState(pHuman0.id).speed === L.signalMaxSpeed &&
      lobby.playerState(pHuman0.id).misses === 8,
    "speeds=" + JSON.stringify(recordedSpeeds)
  );

  // Connect succeeds once, blocks duplicate connect and post-connect miss
  const c0 = lobby.connect(pHuman0.id);
  const c0Again = lobby.connect(pHuman0.id);
  const m0After = lobby.miss(pHuman0.id);
  expect(
    "MirrorLobby connect succeeds once and rejects duplicate connect or post-connect miss",
    c0.ok && c0.connected && !c0.teamAllConnected && !c0Again.ok && !m0After.ok
  );

  // Bot connect times across 50 seeds: all 3..15 seconds, human null, same seed identical
  let allBotTimesInRange = true;
  let humanAlwaysNull = true;
  const seenBotTimes = new Set();
  for (let s = 1; s <= 50; s++) {
    const tm = makeTeam(0, 4, { humans: 1 });
    const lb = new MirrorLobby(Rng.seeded(s), [tm]);
    if (lb.botConnectTimeOf(tm.members[0].id) !== null) humanAlwaysNull = false;
    const times = lb.botConnectTimes(tm);
    if (times.length !== 3) allBotTimesInRange = false;
    for (const entry of times) {
      if (!Number.isInteger(entry.seconds) || entry.seconds < L.botConnectMinSeconds || entry.seconds > L.botConnectMaxSeconds) {
        allBotTimesInRange = false;
      }
      seenBotTimes.add(entry.seconds);
    }
  }
  const lbSeedA = new MirrorLobby(Rng.seeded(4242), [makeTeam(0, 5, { humans: 1 })]);
  const lbSeedB = new MirrorLobby(Rng.seeded(4242), [makeTeam(0, 5, { humans: 1 })]);
  expect(
    "MirrorLobby bot connect times are integers 3..15s, human is null, and same seed repeats",
    allBotTimesInRange &&
      humanAlwaysNull &&
      seenBotTimes.has(L.botConnectMinSeconds) &&
      seenBotTimes.has(L.botConnectMaxSeconds) &&
      JSON.stringify(lbSeedA.botConnectTimes()) === JSON.stringify(lbSeedB.botConnectTimes()),
    "distinct=" + seenBotTimes.size
  );

  // closeDoors fails any team with an unconnected active player (and empty active team), passes complete teams
  const tPass = makeTeam(0, 3, { humans: 3, prefix: "Pass_" });
  const tFail = makeTeam(1, 3, { humans: 3, prefix: "Fail_" });
  const tEmpty = makeTeam(2, 3, { humans: 3, prefix: "Empty_" });
  tEmpty.members.forEach(p => { p.idle = true; });
  const lbDoors = new MirrorLobby(Rng.seeded(202), [tPass, tFail, tEmpty]);
  for (const p of tPass.members) lbDoors.connect(p.id);
  lbDoors.connect(tFail.members[0].id);
  lbDoors.connect(tFail.members[1].id); // tFail.members[2] stays out
  const closeRes = lbDoors.closeDoors();
  const secondClose = lbDoors.closeDoors();
  expect(
    "MirrorLobby closeDoors fails incomplete/empty teams, passes full teams, blocks late actions, and is idempotent",
    closeRes.ok &&
      !lbDoors.isTeamFailed(tPass) &&
      lbDoors.isTeamFailed(tFail) &&
      lbDoors.isTeamFailed(tEmpty) &&
      JSON.stringify(lbDoors.passedTeamIds()) === "[0]" &&
      JSON.stringify(lbDoors.failedTeamIds()) === "[1,2]" &&
      !lbDoors.connect(tFail.members[2].id).ok &&
      !lbDoors.miss(tFail.members[2].id).ok &&
      !secondClose.ok &&
      secondClose.alreadyClosed
  );
}

console.log("-- 3. MirrorTrial coordinator: lobby pass-throughs, closeDoors, and crew deal");
{
  const tPass = makeTeam(0, 5, { humans: 2, prefix: "M0_" });
  tPass.members[4].glitches = Player.STUCK_AT; // 4 active on tPass
  const tFail = makeTeam(1, 3, { humans: 1, prefix: "M1_" });
  tFail.members[2].idle = true; // 2 active on tFail
  const teams = [tPass, tFail];

  const trial = new MirrorTrial(Rng.seeded(303));
  trial.startLobby(teams);
  expect(
    "MirrorTrial excludes Stuck/Idle in lobby and forwards bot connect times",
    trial.lobbyStarted &&
      !trial.lobbyClosed &&
      trial.phase === "lobby" &&
      trial.lobbyTeamState(tPass).players.length === 4 &&
      trial.lobbyTeamState(tFail).players.length === 2 &&
      trial.botConnectTimes(tPass).length === 2 &&
      trial.botConnectTimes(tFail).length === 1 &&
      trial.botConnectTimeOf(tPass.members[0].id) === null
  );

  // Miss + speed cap through MirrorTrial
  const pTest = tPass.members[0];
  let hitCap = false;
  for (let i = 0; i < 6; i++) {
    const mr = trial.miss(pTest.id);
    if (mr.speed === MirrorData.lobby.signalMaxSpeed) hitCap = true;
  }
  expect("MirrorTrial miss forwards speed-up up to cap", hitCap && trial.lobbyPlayerState(pTest.id).speed === MirrorData.lobby.signalMaxSpeed);

  // Connect all active on tPass, leave 1 out on tFail, then closeDoors
  for (const p of tPass.active()) trial.connect(p.id);
  trial.connect(tFail.active()[0].id);
  const doorsOut = trial.closeDoors();
  const cPass = trial.crewFor(tPass);
  const cFail = trial.crewFor(tFail);
  expect(
    "MirrorTrial closeDoors fails team with missing player (no crew) and deals passing team",
    doorsOut.ok &&
      trial.lobbyClosed &&
      trial.phase === "reveal" &&
      trial.isTeamFailed(tFail) &&
      !trial.isTeamFailed(tPass) &&
      cFail === null &&
      cPass !== null &&
      cPass.setupIds.length === 2 &&
      cPass.danceIds.length === 2 &&
      trial.roleOf(tPass.members[4].id) === null &&
      trial.roleOf(tFail.active()[0].id) === null
  );
}

console.log("-- 4. Crew deal sizes (1 to 5 active players) and seeded shuffle");
{
  const expectedSplits = [
    [1, 1, 0],
    [2, 1, 1],
    [3, 2, 1],
    [4, 2, 2],
    [5, 3, 2],
  ];
  let sizesOk = true;
  for (const [n, expSetup, expDance] of expectedSplits) {
    // Also attach a Stuck + Idle player to verify only active connected count
    const team = makeTeam(0, n + 2, { humans: n + 2, prefix: "S" + n + "_" });
    team.members[n].glitches = Player.STUCK_AT;
    team.members[n + 1].idle = true;

    const tr = new MirrorTrial(Rng.seeded(400 + n));
    tr.startLobby([team]);
    const activeIds = team.active().map(p => p.id);
    for (const id of activeIds) tr.connect(id);
    tr.closeDoors();

    const deal = tr.crewFor(team);
    const union = [...deal.setupIds, ...deal.danceIds];
    const uniqueUnion = new Set(union);
    const matchesActive = union.length === n && uniqueUnion.size === n && activeIds.every(id => uniqueUnion.has(id));
    const rolesOk = deal.setupIds.every(id => tr.roleOf(id) === "setup") &&
      deal.danceIds.every(id => tr.roleOf(id) === "dance") &&
      tr.roleOf(team.members[n].id) === null &&
      tr.roleOf(team.members[n + 1].id) === null;
    if (deal.setupIds.length !== expSetup || deal.danceIds.length !== expDance || !matchesActive || !rolesOk) {
      sizesOk = false;
    }
    expect(
      "Crew deal for " + n + " active players -> " + expSetup + " setup / " + expDance + " dance",
      deal.setupIds.length === expSetup && deal.danceIds.length === expDance && matchesActive && rolesOk
    );
  }
  expect("All 1..5 active player crew splits pass", sizesOk);

  // Same seed gives identical deal; different seeds shuffle differently
  const runDeal = seed => {
    const team = makeTeam(0, 5, { humans: 2, prefix: "D_" });
    const tr = new MirrorTrial(Rng.seeded(seed));
    tr.startLobby([team]);
    for (const p of team.active()) tr.connect(p.id);
    tr.closeDoors();
    return tr.crewFor(team);
  };
  const d1 = runDeal(909);
  const d2 = runDeal(909);
  const distinct = new Set();
  for (let s = 1; s <= 20; s++) distinct.add(JSON.stringify(runDeal(s)));
  expect(
    "Same seed gives identical crew deal and different seeds produce varied deals",
    JSON.stringify(d1) === JSON.stringify(d2) && distinct.size > 1,
    "distinct=" + distinct.size
  );
}

console.log("-- 5. Save and load (MirrorLobby direct and MirrorTrial / Trial.fromJSON)");
{
  // (a) Direct MirrorLobby mid-lobby save/load
  const tA = makeTeam(0, 4, { humans: 2, prefix: "L0_" });
  const tB = makeTeam(1, 3, { humans: 1, prefix: "L1_" });
  const lbRngA = Rng.seeded(555);
  const lbA = new MirrorLobby(lbRngA, [tA, tB]);
  lbA.miss(tA.members[0].id);
  lbA.connect(tA.members[0].id);
  lbA.connect(tA.members[1].id);
  lbA.miss(tB.members[0].id);

  const lbJson = lbA.toJSON();
  const lbErr = plainProblem(lbJson);
  expect("MirrorLobby.toJSON produces plain JSON-safe data", !lbErr, lbErr || "plain");

  const lbSaved = JSON.parse(JSON.stringify(lbJson));
  const lbRngB = Rng.seeded(0);
  lbRngB.setState(lbRngA.getState());
  const lbB = MirrorLobby.fromJSON(lbSaved, { rng: lbRngB });
  const lbMissA = lbA.miss(tB.members[1].id);
  const lbMissB = lbB.miss(tB.members[1].id);
  expect(
    "MirrorLobby.fromJSON restores identical lobby state and continues identically",
    JSON.stringify(lbMissA) === JSON.stringify(lbMissB) &&
      JSON.stringify(lbB.toJSON()) === JSON.stringify(lbA.toJSON()) &&
      lbB.playerState(tA.members[0].id).connected === true &&
      lbB.playerState(tB.members[0].id).misses === 1 &&
      lbB.botConnectTimeOf(tA.members[2].id) === lbA.botConnectTimeOf(tA.members[2].id)
  );

  // (b) MirrorTrial mid-lobby save/load + identical continuation with synced Rng state
  const teamsOrig = [
    makeTeam(0, 5, { humans: 2, prefix: "T0_" }),
    makeTeam(1, 3, { humans: 1, prefix: "T1_" }),
  ];
  teamsOrig[0].members[4].glitches = Player.STUCK_AT; // 4 active on team 0
  const rngOrig = Rng.seeded(777);
  const trOrig = new MirrorTrial(rngOrig);
  trOrig.startLobby(teamsOrig);
  trOrig.miss(teamsOrig[0].members[0].id);
  trOrig.connect(teamsOrig[0].members[0].id);
  trOrig.connect(teamsOrig[0].members[1].id);
  trOrig.connect(teamsOrig[0].members[2].id);
  trOrig.connect(teamsOrig[0].members[3].id);
  trOrig.miss(teamsOrig[1].members[0].id);
  trOrig.connect(teamsOrig[1].members[0].id);

  const trJson = trOrig.toJSON();
  const trErr = plainProblem(trJson);
  expect("MirrorTrial.toJSON returns plain JSON-safe data", !trErr, trErr || "plain");

  const trText = JSON.stringify(trJson);
  const byIdOrig = new Map(teamsOrig.flatMap(t => t.members).map(p => [p.id, p]));
  const playersCopy = [...byIdOrig.values()].map(p => Player.fromJSON(p.toJSON()));
  const byIdCopy = new Map(playersCopy.map(p => [p.id, p]));
  const teamsCopy = teamsOrig.map(t => Team.fromJSON(t.toJSON(), byIdCopy));
  const rngCopy = Rng.seeded(0);
  rngCopy.setState(rngOrig.getState());

  const trLoaded = Trial.fromJSON(JSON.parse(trText), { rng: rngCopy, teams: teamsCopy, byId: byIdCopy });
  expect(
    "Trial.fromJSON rebuilds identical mid-lobby MirrorTrial state",
    trLoaded instanceof MirrorTrial && JSON.stringify(trLoaded.toJSON()) === trText
  );

  // Continue identically on both after mid-lobby load: miss + closeDoors (team 0 passes, team 1 fails)
  const mOrig = trOrig.miss(teamsOrig[1].members[1].id);
  const mLoad = trLoaded.miss(teamsCopy[1].members[1].id);
  const dOrig = trOrig.closeDoors();
  const dLoad = trLoaded.closeDoors();
  expect(
    "Original and loaded MirrorTrial stay identical after subsequent miss and closeDoors",
    JSON.stringify(mOrig) === JSON.stringify(mLoad) &&
      JSON.stringify(dOrig) === JSON.stringify(dLoad) &&
      JSON.stringify(trOrig.toJSON()) === JSON.stringify(trLoaded.toJSON()) &&
      trLoaded.isTeamFailed(teamsCopy[1]) &&
      !trLoaded.isTeamFailed(teamsCopy[0]) &&
      trLoaded.crewFor(teamsCopy[0]).setupIds.length === 2
  );

  // (c) Post-closeDoors save/load preserves crews, failedTeams, and phase
  const postText = JSON.stringify(trOrig.toJSON());
  const rngPost = Rng.seeded(0);
  rngPost.setState(rngOrig.getState());
  const trPost = MirrorTrial.fromJSON(JSON.parse(postText), { rng: rngPost, teams: teamsCopy });
  expect(
    "Post-closeDoors MirrorTrial.fromJSON restores crews, failed teams, phase, and blocks late joins",
    JSON.stringify(trPost.toJSON()) === postText &&
      trPost.phase === "reveal" &&
      trPost.isTeamFailed(teamsCopy[1]) &&
      JSON.stringify(trPost.crewFor(teamsCopy[0])) === JSON.stringify(trOrig.crewFor(teamsOrig[0])) &&
      !trPost.connect(teamsCopy[1].members[1].id).ok
  );
}

console.log("-- 6. Seeded lobby cursor start, private #seedRng mix, and save/load compatibility");
{
  // (a) Direct MirrorLobby cursorStartOf repeatability & bounds
  const runCursor = seed => {
    const t = makeTeam(0, 4, { humans: 2, prefix: "Cur_" });
    t.members[3].idle = true;
    const lb = new MirrorLobby(Rng.seeded(seed), [t]);
    return {
      p0: lb.cursorStartOf(t.members[0].id),
      p1: lb.cursorStartOf(t.members[1].id),
      p2: lb.cursorStartOf(t.members[2].id),
      inactive: lb.cursorStartOf(t.members[3].id),
      missing: lb.cursorStartOf(99999),
    };
  };
  const cA = runCursor(1201);
  const cB = runCursor(1201);
  const seenPos = new Set();
  const seenDir = new Set();
  let cursorBoundsOk = cA.inactive === null && cA.missing === null && JSON.stringify(cA) === JSON.stringify(cB);
  for (let s = 1; s <= 30; s++) {
    const r = runCursor(s);
    for (const k of ["p0", "p1", "p2"]) {
      const c = r[k];
      if (!c || !Number.isInteger(c.pos) || c.pos < 0 || c.pos >= 100 || (c.dir !== -1 && c.dir !== 1)) {
        cursorBoundsOk = false;
      } else {
        seenPos.add(c.pos);
        seenDir.add(c.dir);
      }
    }
  }
  expect(
    "MirrorLobby cursorStartOf yields integer pos 0..99, dir -1/1, repeats on seed, and returns null for inactive/unknown",
    cursorBoundsOk && seenPos.size > 10 && seenDir.has(-1) && seenDir.has(1),
    "distinctPos=" + seenPos.size
  );

  // (b) Private #seedRng mixes Game.rng.getState() with 0x9E3779B9 using 0 draws (plus 1-draw test fallback)
  const parentRng = Rng.seeded(1203);
  const stateBeforeCtor = parentRng.getState();
  const trialIso = new MirrorTrial(parentRng);
  const stateAfterCtor = parentRng.getState();
  const expectedSeedState = (stateBeforeCtor ^ 0x9E3779B9) | 0;
  const trialSeedState = trialIso.toJSON().seedRngState;

  const isoTeams = [makeTeam(0, 4, { humans: 2, prefix: "Iso0_" }), makeTeam(1, 4, { humans: 0, prefix: "Iso1_" })];
  trialIso.startLobby(isoTeams);
  const stateBeforeCursorRead = parentRng.getState();
  const cursorT0 = trialIso.lobbyCursorStart(isoTeams[0].members[0].id);
  const stateAfterCursorRead = parentRng.getState();

  const trialIso2 = new MirrorTrial(Rng.seeded(1203));
  trialIso2.startLobby([makeTeam(0, 4, { humans: 2, prefix: "Iso0_" }), makeTeam(1, 4, { humans: 0, prefix: "Iso1_" })]);
  const cursorT0Copy = trialIso2.lobbyCursorStart(isoTeams[0].members[0].id);

  let plainDraws = 0;
  const plainRng = () => { plainDraws++; return 0.25; };
  const trialPlain = new MirrorTrial(plainRng);
  trialPlain.startLobby([makeTeam(2, 3, { humans: 1, prefix: "Pln_" })]);
  const plainCursor = trialPlain.lobbyCursorStart(20);

  expect(
    "MirrorTrial seeds #seedRng from mixed Game.rng state with 0 extra draws, repeats cursorStart, and supports test RNG fallback",
    stateBeforeCtor === stateAfterCtor &&
      stateBeforeCursorRead === stateAfterCursorRead &&
      trialSeedState === expectedSeedState &&
      trialSeedState !== stateBeforeCtor &&
      cursorT0 !== null &&
      JSON.stringify(cursorT0) === JSON.stringify(cursorT0Copy) &&
      plainDraws >= 1 &&
      plainCursor !== null &&
      typeof trialPlain.toJSON().seedRngState === "number"
  );

  // (c) seedRngState saves/restores in toJSON/fromJSON and older saves missing it still load with 0 draws
  const tSave = makeTeam(0, 3, { humans: 2, prefix: "Sav_" });
  const rngSaveA = Rng.seeded(1202);
  const trSaveA = new MirrorTrial(rngSaveA);
  trSaveA.startLobby([tSave]);
  trSaveA.miss(tSave.members[0].id);
  const trSaveJson = trSaveA.toJSON();
  const rngSaveB = Rng.seeded(0);
  rngSaveB.setState(rngSaveA.getState());
  const byIdSave = new Map(tSave.members.map(p => [p.id, p]));
  const trSaveB = Trial.fromJSON(JSON.parse(JSON.stringify(trSaveJson)), { rng: rngSaveB, teams: [tSave], byId: byIdSave });

  // Older save without seedRngState / cursorPos / cursorDir
  const oldTrialJson = JSON.parse(JSON.stringify(trSaveJson));
  delete oldTrialJson.seedRngState;
  delete oldTrialJson.lobby.seedRngState;
  delete oldTrialJson.setup.seedRngState;
  for (const td of oldTrialJson.lobby.teams) {
    for (const pd of td.players) {
      delete pd.cursorPos;
      delete pd.cursorDir;
    }
  }
  const rngOld = Rng.seeded(0);
  rngOld.setState(rngSaveA.getState());
  const oldStateBefore = rngOld.getState();
  const trOldLoaded = Trial.fromJSON(oldTrialJson, { rng: rngOld, teams: [tSave], byId: byIdSave });
  const oldStateAfter = rngOld.getState();

  const lbOrig = new MirrorLobby(Rng.seeded(1205), [tSave]);
  const lbOldJson = JSON.parse(JSON.stringify(lbOrig.toJSON()));
  delete lbOldJson.seedRngState;
  for (const td of lbOldJson.teams) {
    for (const pd of td.players) { delete pd.cursorPos; delete pd.cursorDir; }
  }
  const rngLbOld = Rng.seeded(1205);
  const lbOldLoaded = MirrorLobby.fromJSON(lbOldJson, { rng: rngLbOld });

  expect(
    "MirrorTrial and MirrorLobby save/restore seedRngState and load older saves without cursor or seedRngState cleanly",
    typeof trSaveJson.seedRngState === "number" &&
      JSON.stringify(trSaveB.toJSON()) === JSON.stringify(trSaveJson) &&
      JSON.stringify(trSaveB.lobbyCursorStart(tSave.members[0].id)) === JSON.stringify(trSaveA.lobbyCursorStart(tSave.members[0].id)) &&
      oldStateBefore === oldStateAfter &&
      JSON.stringify(trOldLoaded.lobbyCursorStart(tSave.members[0].id)) === '{"pos":0,"dir":1}' &&
      rngLbOld.getState() === Rng.seeded(1205).getState() &&
      JSON.stringify(lbOldLoaded.cursorStartOf(tSave.members[0].id)) === '{"pos":0,"dir":1}'
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
