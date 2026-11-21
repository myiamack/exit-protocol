/* Bot hooks & idle auto-pilot tests for MirrorTrial via Game hooks (Level 3 Step 4).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_bots.js */
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

function makeMirrorTeams({ humanTeams = 1, totalTeams = 4, teamSize = 4, humansPerMixed = 1, focus = 4 } = {}) {
  const teams = [];
  for (let i = 0; i < totalTeams; i++) {
    const isHumanTeam = i < humanTeams;
    const members = Array.from({ length: teamSize }, (_, j) => {
      const p = Bots.makePlayer(i * 10 + j, "T" + i + "_P" + j, "coop");
      p.isBot = !(isHumanTeam && j < humansPerMixed);
      p.setAttrsForTest({ focus, collab: 4, initiative: 4, grit: 4, composure: 4 });
      return p;
    });
    teams.push(new Team({ id: i, name: "Team " + i, members }));
  }
  return teams;
}

function setupMirrorGame(
  seed,
  { startAt = 10000, humanTeams = 1, totalTeams = 4, teamSize = 4, humansPerMixed = 1, attendance = {}, hooks = Bots.hooks } = {}
) {
  const T = { now: startAt };
  const teams = makeMirrorTeams({ humanTeams, totalTeams, teamSize, humansPerMixed });
  const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now, attendance, hooks });
  g.start();
  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  const trial = new MirrorTrial(g.rng);
  g.setTrialForTest(trial);
  g.advance();        // trial -> starts MirrorTrial lobby + 30s mirrorLobby timer
  return { g, T, teams, trial, startAt };
}

function startShowtimeWithBots(seed, opts = {}) {
  const ctx = setupMirrorGame(seed, opts);
  const { g, T, teams, trial } = ctx;
  T.now += 1000;
  g.tick(T.now);
  for (const team of teams) {
    for (const p of team.active()) {
      if (!p.isBot) g.mirrorConnect(p.id);
    }
  }
  while (trial.phase === "lobby") {
    T.now += 1000;
    g.tick(T.now);
  }
  const revealEnd = g.timer && g.timer.name === "mirrorReveal" ? g.timer.deadline : T.now + 1000;
  T.now = revealEnd;
  g.tick(T.now); // enters mirrorShowtime
  return { ...ctx, showStart: T.now };
}

function findMirrorSeed(startSeed, opts, pred) {
  for (let s = startSeed; s < startSeed + 500; s++) {
    const ctx = startShowtimeWithBots(s, opts);
    if (pred(ctx)) return { seed: s, ...ctx };
  }
  throw new Error("Could not find matching Mirror seed starting at " + startSeed);
}

console.log("-- 1. Hook wiring, no Game-to-Bots link, no MirrorParts duplication, and guards");
{
  const gameSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "Game.js"), "utf8");
  const botsSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "bots.js"), "utf8");
  const mirrorStart = botsSrc.indexOf("  mirror(");
  const mirrorEnd = botsSrc.indexOf("  /* Game hooks");
  const mirrorSlice = botsSrc.slice(mirrorStart, mirrorEnd);

  const mirrorCode = mirrorSlice.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

  const gameCode = gameSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const hasGameToBots = /\bBots\b|bots\.js/.test(gameCode);
  const hasMathRandom = /Math\.random/.test(mirrorCode);
  const hasMirrorParts = /MirrorParts|MirrorLobby|SetupCrew|DanceCrew/.test(mirrorCode);
  const hasTeamNames = /\b(kestrel|wren|finch|heron)\b/i.test(mirrorCode) || /\bTeam\s+[A-Z]\w*/.test(mirrorCode);
  const delegatesToTrialAndGame = /botConnectTimes/.test(mirrorCode) &&
    /mirrorConnect/.test(mirrorCode) &&
    /advanceBotSetup/.test(mirrorCode) &&
    /advanceBotDance/.test(mirrorCode) &&
    /botSetupDueAt/.test(mirrorCode);

  // Guard checks outside trial / on SopTrial / after MirrorTrial closes
  const T = { now: 5000 };
  const gGuard = new Game({ teams: makeMirrorTeams({ humanTeams: 1, totalTeams: 2 }), rng: Rng.seeded(101), clock: () => T.now, hooks: Bots.hooks });
  gGuard.start();
  Bots.mirror(gGuard, T.now); // intermission
  gGuard.startNextRound();
  Bots.mirror(gGuard, T.now); // briefing
  gGuard.advance();
  Bots.mirror(gGuard, T.now); // openFloor
  gGuard.advance();
  Bots.mirror(gGuard, T.now); // SopTrial

  const closedCtx = startShowtimeWithBots(102, { humanTeams: 0, totalTeams: 2 });
  closedCtx.T.now = closedCtx.showStart + 75000;
  closedCtx.g.tick(closedCtx.T.now);
  const snapBeforeExtra = JSON.stringify(closedCtx.g.toJSON());
  Bots.mirror(closedCtx.g, closedCtx.T.now + 5000);
  const snapAfterExtra = JSON.stringify(closedCtx.g.toJSON());

  expect(
    "No Game-to-Bots link, Bots.mirror delegates without Math.random/MirrorParts/team names, Round.LEVELS[2] uses mirror, and guards hold",
    !hasGameToBots &&
      !hasMathRandom &&
      !hasMirrorParts &&
      !hasTeamNames &&
      delegatesToTrialAndGame &&
      Round.LEVELS[2].trialKind === "mirror" &&
      closedCtx.g.didRun("runTrial") &&
      snapBeforeExtra === snapAfterExtra
  );
}

console.log("-- 2. Lobby bot connections inside 3..15s window and beforeClose catch-up");
{
  // (a) Bots connect at their seeded 3..15s time; human stays unconnected until 16s
  const { g, T, teams, trial } = setupMirrorGame(201, { humanTeams: 1, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
  const human = teams[0].members[0];
  const bots = teams.flatMap(t => t.members).filter(p => p.isBot);
  const times = trial.botConnectTimes();
  const validRange = times.length === 15 &&
    times.every(e => Number.isInteger(e.seconds) && e.seconds >= 3 && e.seconds <= 15) &&
    trial.botConnectTimeOf(human.id) === null;

  const connectedAt = new Map();
  let zeroBeforeThree = true;
  for (let s = 1; s <= 15; s++) {
    T.now += 1000;
    g.tick(T.now);
    for (const b of bots) {
      const st = trial.lobbyPlayerState(b.id);
      if (st && st.connected && !connectedAt.has(b.id)) connectedAt.set(b.id, s);
    }
    if (s < 3 && connectedAt.size > 0) zeroBeforeThree = false;
  }
  const exactMatches = bots.every(b => connectedAt.get(b.id) === trial.botConnectTimeOf(b.id));
  const humanStillOut = trial.lobbyPlayerState(human.id).connected === false && trial.phase === "lobby";
  T.now += 1000;
  const humConn = g.mirrorConnect(human.id);

  expect(
    "Bots connect at exact seeded 3..15s lobby times while human remains unconnected until human connects",
    validRange && zeroBeforeThree && exactMatches && humanStillOut &&
      humConn.ok && humConn.closed && trial.phase === "reveal"
  );

  // (b) Human connects at 1s, last bot triggers early lobby close into 1s mirrorReveal
  const early = setupMirrorGame(202, { humanTeams: 1, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
  const maxBotSec = Math.max(...early.trial.botConnectTimes().map(e => e.seconds));
  early.T.now += 1000;
  early.g.tick(early.T.now);
  early.g.mirrorConnect(early.teams[0].members[0].id);
  let closedAtSec = null;
  for (let s = 2; s <= 20 && early.trial.phase === "lobby"; s++) {
    early.T.now += 1000;
    early.g.tick(early.T.now);
    if (early.trial.phase !== "lobby") closedAtSec = s;
  }
  expect(
    "Lobby closes early at exact last bot connect second (<= 15s) into 1s reveal",
    closedAtSec !== null &&
      closedAtSec === maxBotSec &&
      closedAtSec >= 3 && closedAtSec <= 15 &&
      early.trial.phase === "reveal" &&
      early.g.timer && early.g.timer.name === "mirrorReveal" &&
      early.g.timer.deadline === early.startAt + closedAtSec * 1000 + 1000
  );

  // (c) Direct jump to 30s deadline triggers beforeClose('mirrorLobby') so all bots connect
  const jump = setupMirrorGame(203, { humanTeams: 1, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
  jump.g.mirrorConnect(jump.teams[0].members[0].id);
  jump.T.now = jump.startAt + 30000;
  const closedJump = jump.g.tick(jump.T.now);
  const allBotsIn = jump.trial.lobbyState().teams.every(ts => ts.players.every(p => p.connected));
  expect(
    "Jumping straight to 30s closes mirrorLobby via beforeClose after connecting all bots",
    JSON.stringify(closedJump) === '["mirrorLobby"]' &&
      jump.trial.phase === "reveal" &&
      jump.trial.failedTeamIds().length === 0 &&
      allBotsIn
  );
}

console.log("-- 3. Bot setup steps run in order with ~30% hiccups (-3 attention) and wrap-up");
{
  // (a) Single fixed run where human drew Dance Crew so bots own all Setup slots
  const found = findMirrorSeed(301, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 }, ctx =>
    ctx.trial.roleOf(ctx.teams[0].members[0].id) === "dance"
  );
  const { g, T, teams, trial, showStart } = found;
  const team0 = teams[0];
  let noneBeforeFour = true;
  const stepDoneAt = {};
  for (let s = 1; s <= 40 && !g.didRun("runTrial"); s++) {
    T.now = showStart + s * 1000;
    g.tick(T.now);
    const st = trial.setupTeamState(team0);
    if (s < 4 && st.completedSteps.length > 0) noneBeforeFour = false;
    for (const step of st.completedSteps) {
      if (stepDoneAt[step] === undefined) stepDoneAt[step] = s;
    }
    if (st.wrappedUp && stepDoneAt.wrapUp === undefined) stepDoneAt.wrapUp = s;
  }
  const mr0 = g.round.mirrorResults[team0.id];
  const st0 = trial.setupTeamState(team0);
  const expectedOrder = { cables: 4, sound: 10, mic: 16, deck: 22, qa: 28, wrapUp: 34 };
  const exactTiming = Object.keys(expectedOrder).every(k => stepDoneAt[k] === expectedOrder[k]);

  expect(
    "Bot setup runs cables/sound/mic/deck/qa/wrapUp at 4/10/16/22/28/34s and locks team score",
    noneBeforeFour &&
      exactTiming &&
      trial.isSetupWrappedUp(team0) &&
      g.didRun("runTrial") &&
      st0.penalties === st0.botHiccups * 3 &&
      mr0 && !mr0.failed && mr0.score === MirrorTrial.score(mr0.attention),
    "seed=" + found.seed + ", hiccups=" + st0.botHiccups + ", att=" + mr0.attention.toFixed(2)
  );

  // (b) Hiccup rate across 100 fixed seeds (500 non-wrapUp bot setup steps)
  let checkedRuns = 0;
  let totalSteps = 0;
  let totalHiccups = 0;
  let badCost = false;
  let badOrder = false;
  let sampleSeed = null;
  for (let s = 1; s <= 300 && checkedRuns < 100; s++) {
    const ctx = startShowtimeWithBots(s, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
    const hum = ctx.teams[0].members[0];
    if (ctx.trial.roleOf(hum.id) !== "dance") continue;
    if (sampleSeed === null) sampleSeed = s;
    checkedRuns++;
    for (let sec = 1; sec <= 35 && !ctx.g.didRun("runTrial"); sec++) {
      ctx.T.now = ctx.showStart + sec * 1000;
      ctx.g.tick(ctx.T.now);
    }
    const st = ctx.trial.setupTeamState(ctx.teams[0]);
    if (st.completedSteps.join(",") !== "cables,sound,mic,deck,qa" || !st.wrappedUp) badOrder = true;
    if (st.penalties !== st.botHiccups * 3 || st.penaltiesAdded !== st.botHiccups * 3) badCost = true;
    totalSteps += 5;
    totalHiccups += st.botHiccups;
  }
  const hiccupRate = totalHiccups / totalSteps;

  // Repeatability check on sampleSeed
  const runOnce = s => {
    const c = startShowtimeWithBots(s, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
    for (let sec = 1; sec <= 35 && !c.g.didRun("runTrial"); sec++) {
      c.T.now = c.showStart + sec * 1000;
      c.g.tick(c.T.now);
    }
    return JSON.stringify(c.g.toJSON());
  };
  expect(
    "Across 100 bot setup runs (500 steps), hiccup rate is ~30% and each hiccup costs 3 attention",
    checkedRuns === 100 &&
      !badOrder &&
      !badCost &&
      hiccupRate >= 0.20 && hiccupRate <= 0.40 &&
      runOnce(sampleSeed) === runOnce(sampleSeed),
    totalHiccups + "/" + totalSteps + " (" + (hiccupRate * 100).toFixed(1) + "%)"
  );
}

console.log("-- 4. Bot dancers boost +1 every 1.5..2.5s up to 45 with no misses");
{
  // (a) Mixed team with human on Setup Crew (holds setup open for full 75s) and 2 bot dancers
  const found = findMirrorSeed(401, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 }, ctx =>
    ctx.trial.roleOf(ctx.teams[0].members[0].id) === "setup"
  );
  const { g, T, teams, trial, showStart } = found;
  const dancers = trial.dancerIdsFor(teams[0]);
  const boostTimes = new Map(dancers.map(id => [id, []]));
  const prevBoost = new Map(dancers.map(id => [id, 0]));
  let onlyPlusOne = true;
  let zeroMissesOrStrays = true;

  for (let tick = 1; tick <= 300 && !g.didRun("runTrial"); tick++) {
    T.now = showStart + tick * 250;
    g.tick(T.now);
    const sec = tick * 0.25;
    for (const d of trial.dancersFor(teams[0])) {
      const prev = prevBoost.get(d.playerId);
      if (d.boost > prev) {
        if (d.boost - prev !== 1) onlyPlusOne = false;
        boostTimes.get(d.playerId).push(sec);
        prevBoost.set(d.playerId, d.boost);
      }
      if (d.misses !== 0 || d.strays !== 0 || d.penalties !== 0 || d.boost > 45) zeroMissesOrStrays = false;
    }
  }

  let gapsValid = dancers.length === 2;
  let allHit30to45 = true;
  for (const id of dancers) {
    const times = boostTimes.get(id);
    if (times.length < 30 || times.length > 45) allHit30to45 = false;
    let prevAt = 0;
    for (const t of times) {
      const gap = t - prevAt;
      if (gap < 1.5 - 1e-9 || gap > 2.5 + 1e-9) gapsValid = false;
      prevAt = t;
    }
  }

  expect(
    "Bot dancers gain +1 every 1.5..2.5s up to 45 with zero misses/strays over full 75s showtime",
    g.didRun("runTrial") &&
      onlyPlusOne &&
      zeroMissesOrStrays &&
      gapsValid &&
      allHit30to45 &&
      trial.dancePenaltiesFor(teams[0]) === 0,
    "boosts=" + dancers.map(id => prevBoost.get(id)).join(",")
  );

  // (b) Boost cap 45 stops further boosts and active human dancer receives 0 bot boosts
  const capCtx = findMirrorSeed(450, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 2 }, ctx => {
    const [h0, h1] = ctx.teams[0].members;
    return ctx.trial.roleOf(h0.id) === "setup" && ctx.trial.roleOf(h1.id) === "dance";
  });
  const [hSetup, hDance] = capCtx.teams[0].members;
  // First 10s while hDance is active: hDance gets 0 bot boosts
  for (let s = 1; s <= 10; s++) {
    capCtx.T.now = capCtx.showStart + s * 1000;
    capCtx.g.tick(capCtx.T.now);
  }
  const activeHumanBotBoosts = capCtx.trial.dancerState(hDance.id).botBoosts;
  // Push hDance to 36 via 12 perfect hits, then go idle to hit cap 45 and verify no overflow past 45
  for (let i = 0; i < 12; i++) capCtx.g.mirrorDanceHit(hDance.id, "perfect", { elapsedSeconds: 10 });
  hDance.idle = true;
  for (let tick = 41; tick <= 260 && !capCtx.g.didRun("runTrial"); tick++) {
    capCtx.T.now = capCtx.showStart + tick * 250;
    capCtx.g.tick(capCtx.T.now);
  }
  const stDance = capCtx.trial.dancerState(hDance.id);
  const stillLockedSetup = capCtx.trial.setupCurrentPlayerId(capCtx.teams[0]) === hSetup.id;
  expect(
    "Active human dancer gets 0 bot boosts; auto-pilot stops cleanly at boost cap 45",
    activeHumanBotBoosts === 0 &&
      stillLockedSetup &&
      stDance.boost === 45 &&
      stDance.botBoosts === 9 &&
      stDance.nextBotBoostAt === null
  );
}

console.log("-- 5. Bot-only teams get seeded random attention 0..100 and 0..7 score");
{
  // (a) Pure bot-only game (4 bot-only teams) driven purely by Game + Bots.hooks
  const { g, T, teams, trial, showStart } = startShowtimeWithBots(501, { humanTeams: 0, totalTeams: 4, teamSize: 4 });
  const initialBotAtt = teams.map(t => trial.botAttentionFor(t));
  T.now = showStart + 35000;
  g.tick(T.now);
  const midBotAtt = teams.map(t => g.mirrorAttention(t, T.now));
  T.now = showStart + 75000;
  const closed = g.tick(T.now);
  const mr = g.round.mirrorResults;

  expect(
    "All-bot-only game rolls 0..100 attention on showtime start, keeps it constant, and scores on 75s close",
    JSON.stringify(closed) === '["mirrorShowtime"]' &&
      g.didRun("runTrial") &&
      initialBotAtt.every(a => Number.isInteger(a) && a >= 0 && a <= 100) &&
      JSON.stringify(initialBotAtt) === JSON.stringify(midBotAtt) &&
      teams.every(t =>
        mr[t.id].botOnly === true &&
        mr[t.id].attention === initialBotAtt[t.id] &&
        mr[t.id].score === MirrorTrial.score(initialBotAtt[t.id]) &&
        trial.setupPenalties(t) === 0 &&
        trial.danceBoostFor(t) === 0
      )
  );

  // (b) Distribution across 30 fixed seeds + repeatability
  const runBotOnlyAtt = seed => {
    const ctx = startShowtimeWithBots(seed, { humanTeams: 1, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
    return ctx.teams.slice(1).map(t => ctx.trial.botAttentionFor(t));
  };
  const seen = new Set();
  let allInts = true;
  for (let s = 1; s <= 30; s++) {
    for (const a of runBotOnlyAtt(s)) {
      if (!Number.isInteger(a) || a < 0 || a > 100) allInts = false;
      seen.add(a);
    }
  }
  expect(
    "Bot-only random attention across 30 seeds stays integer 0..100, varies, and repeats on same seed",
    allInts && seen.size > 10 && JSON.stringify(runBotOnlyAtt(515)) === JSON.stringify(runBotOnlyAtt(515)),
    "distinct=" + seen.size
  );
}

console.log("-- 6. Mixed team combining humans and bots (both turn orders)");
{
  // (a) Human in Setup slot 0, Bot in Setup slot 1 (+ bot dancers)
  const orderA = findMirrorSeed(601, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 2 }, ctx => {
    const slots = ctx.trial.setupSlots(ctx.teams[0]);
    const p0 = ctx.teams[0].members.find(m => m.id === slots[0].playerId);
    const p1 = ctx.teams[0].members.find(m => m.id === slots[1].playerId);
    return !p0.isBot && p1.isBot;
  });
  const teamA = orderA.teams[0];
  const slotsA = orderA.trial.setupSlots(teamA);
  const humSlot0 = slotsA[0].playerId;
  const botSlot1 = slotsA[1].playerId;

  // Run 10s while human holds slot 0: setup stays on cables, bot dancer boosts
  for (let s = 1; s <= 10; s++) {
    orderA.T.now = orderA.showStart + s * 1000;
    orderA.g.tick(orderA.T.now);
  }
  const waitedForHuman = orderA.trial.setupStep(teamA) === "cables" &&
    orderA.trial.setupCurrentPlayerId(teamA) === humSlot0 &&
    orderA.trial.danceBoostFor(teamA) > 0;

  // Human finishes slot 0 cleanly -> hands off to botSlot1 on deck (due at 10+6=16, qa at 22, wrapUp at 28)
  for (const port of MirrorData.ports) orderA.g.mirrorCableHit(humSlot0, port);
  orderA.g.mirrorSoundHeld(humSlot0);
  for (let r = 0; r < MirrorData.mic.roundLengths.length; r++) {
    for (const n of orderA.trial.micSequenceFor(teamA)) orderA.g.mirrorMicTap(humSlot0, n);
  }
  const handedToBot = orderA.trial.setupStep(teamA) === "deck" && orderA.trial.setupCurrentPlayerId(teamA) === botSlot1;
  for (let s = 11; s <= 30 && !orderA.g.didRun("runTrial"); s++) {
    orderA.T.now = orderA.showStart + s * 1000;
    orderA.g.tick(orderA.T.now);
  }
  expect(
    "Human slot 0 -> Bot slot 1 handoff: bots wait for human, boost dance, then complete deck/qa/wrapUp",
    waitedForHuman && handedToBot && orderA.trial.isSetupWrappedUp(teamA) && orderA.g.didRun("runTrial")
  );

  // (b) Bot in Setup slot 0, Human in Setup slot 1 (+ 1 human dancer + 1 bot dancer)
  const orderB = findMirrorSeed(650, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 2 }, ctx => {
    const slots = ctx.trial.setupSlots(ctx.teams[0]);
    const p0 = ctx.teams[0].members.find(m => m.id === slots[0].playerId);
    const p1 = ctx.teams[0].members.find(m => m.id === slots[1].playerId);
    const dancers = ctx.trial.dancerIdsFor(ctx.teams[0]).map(id => ctx.teams[0].members.find(m => m.id === id));
    return p0.isBot && !p1.isBot && dancers.some(d => !d.isBot) && dancers.some(d => d.isBot);
  });
  const teamB = orderB.teams[0];
  const slotsB = orderB.trial.setupSlots(teamB);
  const humSlot1 = slotsB[1].playerId;
  const humDancerB = orderB.trial.dancerIdsFor(teamB)
    .map(id => teamB.members.find(m => m.id === id))
    .find(d => !d.isBot);

  for (let s = 1; s <= 25; s++) {
    orderB.T.now = orderB.showStart + s * 1000;
    orderB.g.tick(orderB.T.now);
  }
  const stoppedAtHuman = orderB.trial.setupStep(teamB) === "deck" &&
    orderB.trial.setupCurrentPlayerId(teamB) === humSlot1 &&
    !orderB.g.didRun("runTrial");

  orderB.g.mirrorDanceHit(humDancerB.id, "perfect"); // +3 human dance boost
  orderB.g.mirrorPickFile(humSlot1, MirrorData.files.find(f => f.correct).name);
  for (let i = 0; i < MirrorData.qaItems.length; i++) {
    orderB.g.mirrorAnswerQa(humSlot1, orderB.trial.currentQaFor(teamB).correctIndex);
  }
  const wrapB = orderB.g.mirrorWrapUp(humSlot1);
  expect(
    "Bot slot 0 -> Human slot 1 handoff: bot completes cables/sound/mic, waits for human, human dances & wraps up",
    stoppedAtHuman &&
      wrapB.ok && wrapB.closed === true &&
      orderB.g.didRun("runTrial") &&
      orderB.trial.dancerState(humDancerB.id).boost === 3
  );
}

console.log("-- 7. Idle human on auto-pilot (pre-lobby, mid-lobby, Attendance mid-showtime, and return)");
{
  // (a) Idle before lobby: excluded by Team.active(), active bots complete cleanly
  const ctxPre = setupMirrorGame(701, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  // Create a fresh game where human is idle BEFORE MirrorTrial starts
  const TPre = { now: 10000 };
  const teamsPre = makeMirrorTeams({ humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  teamsPre[0].members[0].idle = true;
  const gPre = new Game({ teams: teamsPre, rng: Rng.seeded(702), clock: () => TPre.now, hooks: Bots.hooks });
  gPre.start();
  gPre.startNextRound();
  gPre.advance();
  const trPre = new MirrorTrial(gPre.rng);
  gPre.setTrialForTest(trPre);
  gPre.advance();
  const preIdleExcluded = !trPre.lobbyPlayerState(teamsPre[0].members[0].id);
  for (let s = 1; s <= 60 && !gPre.didRun("runTrial"); s++) {
    TPre.now += 1000;
    gPre.tick(TPre.now);
  }
  expect(
    "Pre-lobby idle human is excluded from lobby/crews while remaining bots finish cleanly",
    preIdleExcluded && gPre.didRun("runTrial") && !trPre.isTeamFailed(teamsPre[0]) && ctxPre.trial.lobbyStarted
  );

  // (b) Human goes idle mid-lobby -> Bots.hooks connects them so team passes lobby
  const ctxMid = setupMirrorGame(703, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  const humMid = ctxMid.teams[0].members[0];
  humMid.idle = true;
  ctxMid.T.now += 16000;
  ctxMid.g.tick(ctxMid.T.now);
  const inReveal = ctxMid.trial.phase === "reveal";
  ctxMid.T.now += 1000;
  ctxMid.g.tick(ctxMid.T.now);
  expect(
    "Human going idle mid-lobby is auto-connected by Bots.hooks so team passes lobby",
    ctxMid.trial.lobbyPlayerState(humMid.id).connected === true &&
      !ctxMid.trial.isTeamFailed(ctxMid.teams[0]) &&
      inReveal &&
      ctxMid.trial.phase === "showtime"
  );

  // (c) Real Attendance checkAttendance() triggers p.idle mid-showtime -> auto-pilot finishes Setup Crew
  const attSeed = findMirrorSeed(710, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 }, ctx =>
    ctx.trial.roleOf(ctx.teams[0].members[0].id) === "setup"
  ).seed;
  const TAtt = { now: 10000 };
  const teamsAtt = makeMirrorTeams({ humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  const humAtt = teamsAtt[0].members[0];
  const gAtt = new Game({ teams: teamsAtt, rng: Rng.seeded(attSeed), clock: () => TAtt.now, hooks: Bots.hooks });
  gAtt.start();
  gAtt.startNextRound();
  gAtt.advance(); // openFloor
  const trAtt = new MirrorTrial(gAtt.rng);
  gAtt.setTrialForTest(trAtt);
  gAtt.advance(); // mirrorLobby
  TAtt.now += 1000;
  gAtt.activity(humAtt, TAtt.now); // human touches signal grab at +1s
  gAtt.mirrorConnect(humAtt.id);
  let missedAtSec = null;
  let wrappedAfterIdle = false;
  for (let s = 2; s <= 100 && !gAtt.didRun("runTrial"); s++) {
    TAtt.now += 1000;
    const attEvents = gAtt.checkAttendance(TAtt.now);
    if (attEvents.some(e => e.player === humAtt && e.state === "missed")) missedAtSec = s;
    gAtt.tick(TAtt.now);
    if (humAtt.idle && trAtt.isSetupWrappedUp(teamsAtt[0])) wrappedAfterIdle = true;
  }
  expect(
    "Real Attendance miss mid-showtime triggers idle auto-pilot to finish Setup Crew and wrap up",
    missedAtSec !== null &&
      humAtt.idle === true &&
      wrappedAfterIdle &&
      gAtt.didRun("runTrial") &&
      !trAtt.isTeamFailed(teamsAtt[0]),
    "missedAt=" + missedAtSec + "s"
  );

  // (d) Idle Dance Crew human gets +1 auto-pilot boosts, then stops immediately upon activity()
  const retCtx = findMirrorSeed(750, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 2 }, ctx => {
    const [h0, h1] = ctx.teams[0].members;
    return ctx.trial.roleOf(h0.id) === "setup" && ctx.trial.roleOf(h1.id) === "dance";
  });
  const hD = retCtx.teams[0].members[1];
  retCtx.g.mirrorDanceHit(hD.id, "perfect", { elapsedSeconds: 0 }); // +3, lastActionAt=0
  hD.idle = true;
  for (let tick = 1; tick <= 48; tick++) { // 12s -> several +1 boosts
    retCtx.T.now = retCtx.showStart + tick * 250;
    retCtx.g.tick(retCtx.T.now);
  }
  const boostWhileIdle = retCtx.trial.dancerState(hD.id).boost;
  const botBoostsWhileIdle = retCtx.trial.dancerState(hD.id).botBoosts;

  // Player returns via activity() -> clears idle -> auto-pilot stops immediately
  retCtx.g.activity(hD, retCtx.T.now);
  for (let tick = 49; tick <= 100; tick++) { // 12s -> 25s
    retCtx.T.now = retCtx.showStart + tick * 250;
    retCtx.g.tick(retCtx.T.now);
  }
  const boostAfterReturn = retCtx.trial.dancerState(hD.id).boost;
  expect(
    "Idle human dancer gains +1 auto-pilot boosts, then stops immediately when activity() clears idle",
    !hD.idle &&
      botBoostsWhileIdle >= 4 &&
      boostWhileIdle === 3 + botBoostsWhileIdle &&
      boostAfterReturn === boostWhileIdle
  );
}

console.log("-- 8. Save and load mid-showtime with bots matches unbroken run identically");
{
  // (a) 2 mixed teams (bot setup + bot dance) + 2 bot-only teams: save at 15s -> 4 twins identical
  const saveSeed = findMirrorSeed(801, { humanTeams: 2, totalTeams: 4, teamSize: 4, humansPerMixed: 1 }, ctx =>
    ctx.trial.roleOf(ctx.teams[0].members[0].id) === "dance" &&
    ctx.trial.roleOf(ctx.teams[1].members[0].id) === "dance"
  ).seed;

  const unbroken = startShowtimeWithBots(saveSeed, { humanTeams: 2, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
  for (let s = 1; s <= 15; s++) {
    unbroken.T.now = unbroken.showStart + s * 1000;
    unbroken.g.tick(unbroken.T.now);
  }
  const snapData = unbroken.g.toJSON();
  const snapPlainErr = plainProblem(snapData);
  const snapText = JSON.stringify(snapData);

  // Twin A: unbroken ticked 1s at a time from 16s to close
  for (let s = 16; s <= 40 && !unbroken.g.didRun("runTrial"); s++) {
    unbroken.T.now = unbroken.showStart + s * 1000;
    unbroken.g.tick(unbroken.T.now);
  }

  // Twin B: reloaded at 15s, ticked 1s at a time to close
  const TB = { now: unbroken.showStart + 15000 };
  const twinB = Game.fromJSON(JSON.parse(snapText), { clock: () => TB.now, hooks: Bots.hooks });
  for (let s = 16; s <= 40 && !twinB.didRun("runTrial"); s++) {
    TB.now = unbroken.showStart + s * 1000;
    twinB.tick(TB.now);
  }

  // Twin C: reloaded at 50s (single catch-up jump past 34s wrap-up, before 75s deadline)
  const twinC = Game.fromJSON(JSON.parse(snapText), { clock: () => unbroken.showStart + 50000, hooks: Bots.hooks });

  // Twin D: reloaded at 100s (single catch-up jump past 75s showtime deadline)
  const twinD = Game.fromJSON(JSON.parse(snapText), { clock: () => unbroken.showStart + 100000, hooks: Bots.hooks });

  const jsonA = JSON.stringify(unbroken.g.toJSON());
  const jsonB = JSON.stringify(twinB.toJSON());
  const jsonC = JSON.stringify(twinC.toJSON());
  const jsonD = JSON.stringify(twinD.toJSON());

  expect(
    "Mid-showtime save (15s) is plain JSON and unbroken, 1s-reload, 50s-jump, and 100s-jump twins end identically",
    !snapPlainErr &&
      unbroken.g.didRun("runTrial") &&
      unbroken.g.timer === null &&
      jsonA === jsonB &&
      jsonA === jsonC &&
      jsonA === jsonD,
    snapPlainErr || "4 twins identical"
  );

  // (b) Long-running mixed team (human holds Setup open to 75s while bot dancers boost full 75s)
  const longSeed = findMirrorSeed(830, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 }, ctx =>
    ctx.trial.roleOf(ctx.teams[0].members[0].id) === "setup"
  ).seed;
  const longCtx = startShowtimeWithBots(longSeed, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  for (let s = 1; s <= 15; s++) {
    longCtx.T.now = longCtx.showStart + s * 1000;
    longCtx.g.tick(longCtx.T.now);
  }
  const longSnapText = JSON.stringify(longCtx.g.toJSON());

  for (let s = 16; s <= 50; s++) {
    longCtx.T.now = longCtx.showStart + s * 1000;
    longCtx.g.tick(longCtx.T.now);
  }
  const unbroken50Text = JSON.stringify(longCtx.g.toJSON());
  const reload50 = Game.fromJSON(JSON.parse(longSnapText), { clock: () => longCtx.showStart + 50000, hooks: Bots.hooks });

  for (let s = 51; s <= 75; s++) {
    longCtx.T.now = longCtx.showStart + s * 1000;
    longCtx.g.tick(longCtx.T.now);
  }
  const unbroken75Text = JSON.stringify(longCtx.g.toJSON());
  const reload100 = Game.fromJSON(JSON.parse(longSnapText), { clock: () => longCtx.showStart + 100000, hooks: Bots.hooks });

  expect(
    "Long-running bot dancers across 75s match identically after mid-showtime save at both 50s and 100s catch-up",
    unbroken50Text === JSON.stringify(reload50.toJSON()) &&
      longCtx.g.didRun("runTrial") &&
      unbroken75Text === JSON.stringify(reload100.toJSON())
  );

  // (c) Attention hitting 0 mid-showtime with bot dancers: save before 0 -> wake past 0 matches unbroken identically
  const zeroCtx = startShowtimeWithBots(longSeed, { humanTeams: 1, totalTeams: 2, teamSize: 4, humansPerMixed: 1 });
  const zHum = zeroCtx.teams[0].members[0].id;
  for (let s = 1; s <= 15; s++) {
    zeroCtx.T.now = zeroCtx.showStart + s * 1000;
    zeroCtx.g.tick(zeroCtx.T.now);
  }
  // 15 misses * 3 = 45 penalty -> exceeds max boost 45 + remaining base near ~55s
  for (let i = 0; i < 15; i++) zeroCtx.g.mirrorCableMiss(zHum, "HDMI");
  const zeroSnapText = JSON.stringify(zeroCtx.g.toJSON());
  for (let s = 16; s <= 75 && !zeroCtx.g.didRun("runTrial"); s++) {
    zeroCtx.T.now = zeroCtx.showStart + s * 1000;
    zeroCtx.g.tick(zeroCtx.T.now);
  }
  const zeroReload = Game.fromJSON(JSON.parse(zeroSnapText), { clock: () => zeroCtx.showStart + 100000, hooks: Bots.hooks });
  expect(
    "Attention-0 failure with bot dancers matches identically on late wake (no resurrection by later bot boosts)",
    zeroCtx.g.didRun("runTrial") &&
      zeroCtx.g.round.mirrorResults[0].failReason === "attention" &&
      zeroCtx.g.round.mirrorResults[0].attention === 0 &&
      zeroCtx.g.round.mirrorResults[0].score === 0 &&
      JSON.stringify(zeroCtx.g.toJSON()) === JSON.stringify(zeroReload.toJSON())
  );
}

console.log("-- 9. Fixed-seed repeatability across full Mirror trial");
{
  const runMirrorSeed = seed => {
    const ctx = startShowtimeWithBots(seed, { humanTeams: 1, totalTeams: 4, teamSize: 4, humansPerMixed: 1 });
    // Put human idle at start of showtime so full trial plays via Bots.hooks
    ctx.teams[0].members[0].idle = true;
    for (let s = 1; s <= 75 && !ctx.g.didRun("runTrial"); s++) {
      ctx.T.now = ctx.showStart + s * 1000;
      ctx.g.tick(ctx.T.now);
    }
    return {
      json: JSON.stringify(ctx.g.toJSON()),
      results: ctx.g.round.mirrorResults,
      winners: ctx.g.round.trial.ranking.filter(r => r.won).map(r => r.team.id),
    };
  };
  const a1 = runMirrorSeed(909);
  const a2 = runMirrorSeed(909);
  const b1 = runMirrorSeed(910);
  expect(
    "Same fixed seed produces identical full Mirror bot run; different seed varies",
    a1.json === a2.json && a1.json !== b1.json && a1.winners.length === 2
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
