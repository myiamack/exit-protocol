/* Unit tests for Level 3 DanceCrew (direct) and MirrorTrial coordinator (dance crew + attention).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_dance.js */
const fs = require("fs");
const path = require("path");
const EP = require("../rules/index.js");
const { Bots, MirrorData, MirrorParts, Player, Rng, Round, Team, Trial } = EP;
const { SetupCrew, DanceCrew } = MirrorParts;
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

console.log("-- 1. Construction, exports, privacy, and guard rails");
{
  let missingRngThrew = false;
  try { new DanceCrew(); } catch (e) { missingRngThrew = /rng/i.test(e.message); }

  const rawTeam = makeTeam(0, 4, { humans: 4, prefix: "Raw_" });
  let rawTeamThrew = false;
  try { new DanceCrew(Rng.seeded(10), [rawTeam]); } catch (e) { rawTeamThrew = /SetupCrew/i.test(e.message); }

  const unstartedSetup = new SetupCrew(Rng.seeded(10));
  let unstartedThrew = false;
  try { new DanceCrew(Rng.seeded(10), unstartedSetup); } catch (e) { unstartedThrew = /started/i.test(e.message); }

  const dc = new DanceCrew(Rng.seeded(11));
  const dcKeys = [...Object.keys(dc), ...Object.getOwnPropertyNames(dc)];
  const tr = new MirrorTrial(Rng.seeded(12));
  const trKeys = [...Object.keys(tr), ...Object.getOwnPropertyNames(tr)];
  const mirrorPartsSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "MirrorParts.js"), "utf8");
  const hasMathRandom = /Math\.random/.test(mirrorPartsSrc);
  const hasTeamNames = /\b(kestrel|wren|finch|heron)\b/i.test(mirrorPartsSrc) || /\bTeam\s+[A-Z]\w*/.test(mirrorPartsSrc);

  expect(
    "DanceCrew rejects missing rng, raw Team objects, unstarted SetupCrew, and keeps fields private",
    missingRngThrew &&
      rawTeamThrew &&
      unstartedThrew &&
      typeof DanceCrew === "function" &&
      dcKeys.length === 0 &&
      !trKeys.includes("dance") &&
      !trKeys.includes("#dance") &&
      tr.dance === undefined &&
      !tr.danceStarted
  );
  expect(
    "Round.LEVELS[2] uses mirror and MirrorParts uses no Math.random or hardcoded team names",
    Round.LEVELS[2].trialKind === "mirror" && !hasMathRandom && !hasTeamNames
  );
}

console.log("-- 2. Dance Crew roster (team sizes 3, 4, 5, 6 and Stuck or Idle exclusions)");
{
  const cases = [
    { label: "size 3 active -> 1 dancer", size: 3, stuck: 0, idle: 0, expSetup: 2, expDance: 1 },
    { label: "size 4 active -> 2 dancers", size: 4, stuck: 0, idle: 0, expSetup: 2, expDance: 2 },
    { label: "size 5 active -> 2 dancers", size: 5, stuck: 0, idle: 0, expSetup: 3, expDance: 2 },
    { label: "size 6 active -> 3 dancers", size: 6, stuck: 0, idle: 0, expSetup: 3, expDance: 3 },
    { label: "size 5 with 1 Stuck -> 2 dancers", size: 5, stuck: 1, idle: 0, expSetup: 2, expDance: 2 },
    { label: "size 5 with 1 Stuck + 1 Idle -> 1 dancer", size: 5, stuck: 1, idle: 1, expSetup: 2, expDance: 1 },
    { label: "size 4 with 2 Stuck -> 1 dancer", size: 4, stuck: 2, idle: 0, expSetup: 1, expDance: 1 },
    { label: "size 3 with 2 Idle -> 0 dancers", size: 3, stuck: 0, idle: 2, expSetup: 1, expDance: 0 },
  ];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const team = makeTeam(i, c.size, { humans: c.size, prefix: "Roster" + i + "_" });
    for (let s = 0; s < c.stuck; s++) team.members[c.size - 1 - s].glitches = Player.STUCK_AT;
    for (let d = 0; d < c.idle; d++) team.members[c.size - 1 - c.stuck - d].idle = true;
    const activeIds = team.active().map(p => p.id);

    const sc = new SetupCrew(Rng.seeded(200 + i), [team]);
    const dc = new DanceCrew(Rng.seeded(250 + i), sc, { teams: [team] });
    const scSetupIds = sc.slotsFor(team).map(s => s.playerId);
    const scDanceIds = sc.danceIdsFor(team);
    const dcIds = dc.dancerIdsFor(team);
    const dcUnion = [...scSetupIds, ...dcIds];
    const directOk = scSetupIds.length === c.expSetup &&
      dcIds.length === c.expDance &&
      JSON.stringify(dcIds) === JSON.stringify(scDanceIds) &&
      dcUnion.length === activeIds.length &&
      new Set(dcUnion).size === activeIds.length &&
      activeIds.every(id => dcUnion.includes(id));

    const tr = openShowtime([team], 300 + i);
    const deal = tr.crewFor(team);
    const trDanceIds = tr.dancerIdsFor(team);
    const trOk = deal.setupIds.length === c.expSetup &&
      deal.danceIds.length === c.expDance &&
      JSON.stringify(trDanceIds) === JSON.stringify(deal.danceIds) &&
      deal.danceIds.every(id => tr.roleOf(id) === "dance") &&
      deal.setupIds.every(id => !trDanceIds.includes(id));
    const excludedOk = team.members
      .filter(p => !p.isActive())
      .every(p => !dc.hasPlayer(p.id) && tr.roleOf(p.id) === null && tr.dancerState(p.id) === null);

    expect("Dance roster " + c.label, directOk && trOk && excludedOk);
  }
}

console.log("-- 3. Results-based note hits, misses, stray presses, and boost cap at 45");
{
  const team = makeTeam(0, 4, { humans: 4, prefix: "Hit_" });
  team.members[3].glitches = Player.STUCK_AT; // 3 active -> 2 setup, 1 dance
  const sc = new SetupCrew(Rng.seeded(401), [team]);
  const dc = new DanceCrew(Rng.seeded(402), sc, { teams: [team] });
  const dancerId = dc.dancerIdsFor(team)[0];
  const setupId = sc.slotsFor(team)[0].playerId;
  const stuckId = team.members[3].id;

  const badQuality = dc.noteHit(dancerId, "great");
  const setupBlocked = dc.noteHit(setupId, "perfect");
  const stuckBlocked = dc.noteMiss(stuckId);
  const unknownBlocked = dc.strayPress(9999);

  const p1 = dc.noteHit(dancerId, "perfect", { elapsedSeconds: 2 });
  const g1 = dc.noteHit(dancerId, "good", { elapsedSeconds: 3 });
  const stray = dc.strayPress(dancerId, { elapsedSeconds: 4 });
  const miss = dc.noteMiss(dancerId, { elapsedSeconds: 5 });
  const afterMissState = dc.dancerState(dancerId);

  expect(
    "noteHit/noteMiss/strayPress reject invalid callers and track +3/+2 boost, +1/+2 penalty, and combo",
    !badQuality.ok && !setupBlocked.ok && !stuckBlocked.ok && !unknownBlocked.ok &&
      p1.ok && p1.boostAdded === 3 && p1.boost === 3 && p1.combo === 1 &&
      g1.ok && g1.boostAdded === 2 && g1.boost === 5 && g1.combo === 2 &&
      stray.ok && stray.penaltyAdded === 1 && stray.combo === 0 &&
      miss.ok && miss.penaltyAdded === 2 && miss.penalties === 3 && miss.combo === 0 &&
      afterMissState.maxCombo === 2 && afterMissState.perfects === 1 && afterMissState.goods === 1 &&
      afterMissState.strays === 1 && afterMissState.misses === 1
  );

  // Reach boost cap 45: currently at 5; 13 perfects = 44 (+39), +1 good should clamp at +1 -> 45, next perfect -> +0
  for (let i = 0; i < 13; i++) dc.noteHit(dancerId, "perfect", { elapsedSeconds: 10 + i });
  const at44 = dc.boostFor(dancerId);
  const hitCap = dc.noteHit(dancerId, "good", { elapsedSeconds: 25 });
  const pastCap = dc.noteHit(dancerId, "perfect", { elapsedSeconds: 26 });
  expect(
    "Dancer boost caps strictly at 45 (partial gain at cap, 0 gain past cap)",
    at44 === 44 &&
      hitCap.ok && hitCap.boost === 45 && hitCap.boostAdded === 1 && hitCap.capped &&
      pastCap.ok && pastCap.boost === 45 && pastCap.boostAdded === 0 && pastCap.capped &&
      dc.boostFor(dancerId) === MirrorData.dance.boostCap
  );
}

console.log("-- 4. Averaging across 1, 2, 3 dancers and 0 dancers");
{
  // 1 dancer (team size 3)
  const t1 = makeTeam(0, 3, { humans: 3, prefix: "Avg1_" });
  const sc1 = new SetupCrew(Rng.seeded(501), [t1]);
  const dc1 = new DanceCrew(Rng.seeded(502), sc1, { teams: [t1] });
  const d1 = dc1.dancerIdsFor(t1)[0];
  dc1.noteHit(d1, "perfect"); // +3
  dc1.noteHit(d1, "good");    // +2 -> boost 5
  dc1.noteMiss(d1);           // +2 pen
  expect(
    "Average across 1 dancer equals that dancer's boost and penalty",
    dc1.dancersFor(t1).length === 1 && dc1.avgBoostFor(t1) === 5 && dc1.avgPenaltiesFor(t1) === 2
  );

  // 2 dancers (team size 4)
  const t2 = makeTeam(1, 4, { humans: 4, prefix: "Avg2_" });
  const sc2 = new SetupCrew(Rng.seeded(503), [t2]);
  const dc2 = new DanceCrew(Rng.seeded(504), sc2, { teams: [t2] });
  const [d2a, d2b] = dc2.dancerIdsFor(t2);
  for (let i = 0; i < 16; i++) dc2.noteHit(d2a, "perfect"); // capped at 45
  for (let i = 0; i < 5; i++) dc2.noteHit(d2b, "perfect");  // 15 -> avg 30
  dc2.noteMiss(d2a);  // +2
  dc2.strayPress(d2b); // +1 -> avg 1.5
  expect(
    "Average across 2 dancers averages capped boosts and fractional penalties accurately",
    dc2.dancersFor(t2).length === 2 && dc2.avgBoostFor(t2) === 30 && dc2.avgPenaltiesFor(t2) === 1.5,
    "avgBoost=" + dc2.avgBoostFor(t2) + " avgPen=" + dc2.avgPenaltiesFor(t2)
  );

  // 3 dancers (team size 6 -> 3 setup, 3 dance)
  const t3 = makeTeam(2, 6, { humans: 6, prefix: "Avg3_" });
  const sc3 = new SetupCrew(Rng.seeded(507), [t3]);
  const dc3 = new DanceCrew(Rng.seeded(508), sc3, { teams: [t3] });
  const [e0, e1, e2] = dc3.dancerIdsFor(t3);
  dc3.noteHit(e0, "perfect"); // +3 -> 3
  dc3.noteHit(e1, "good");    // +2
  dc3.noteHit(e1, "perfect"); // +3
  dc3.noteHit(e1, "good");    // +2 -> 7
  dc3.noteHit(e2, "good");    // +2 -> total 12, avg 4
  dc3.noteMiss(e0);           // +2
  dc3.strayPress(e1);         // +1
  dc3.noteMiss(e2);
  dc3.strayPress(e2);         // +3 -> total 6, avg 2
  expect(
    "Average across 3 dancers averages boosts and penalties accurately",
    dc3.dancersFor(t3).length === 3 && dc3.avgBoostFor(t3) === 4 && dc3.avgPenaltiesFor(t3) === 2,
    "avgBoost=" + dc3.avgBoostFor(t3) + " avgPen=" + dc3.avgPenaltiesFor(t3)
  );

  // 0 dancers (size 3 with 2 Idle -> 1 active -> 1 setup, 0 dance)
  const t0 = makeTeam(4, 3, { humans: 3, prefix: "Avg0_" });
  t0.members[1].idle = true;
  t0.members[2].idle = true;
  const sc0 = new SetupCrew(Rng.seeded(509), [t0]);
  const dc0 = new DanceCrew(Rng.seeded(510), sc0, { teams: [t0] });
  const adv0 = dc0.advanceBotDance(t0, 60);
  const tr0 = openShowtime([t0], 511);
  expect(
    "Team with 0 dancers returns 0 avgBoost, 0 avgPenalties, no NaN, and empty bot dance advance",
    dc0.dancersFor(t0).length === 0 &&
      dc0.avgBoostFor(t0) === 0 &&
      dc0.avgPenaltiesFor(t0) === 0 &&
      adv0.ok && adv0.events.length === 0 && adv0.avgBoost === 0 && adv0.avgPenalties === 0 &&
      tr0.dancersFor(t0).length === 0 &&
      tr0.danceBoostFor(t0) === 0 &&
      tr0.dancePenaltiesFor(t0) === 0 &&
      tr0.attentionFor(t0, 37.5) === 50
  );
}

console.log("-- 5. Attention drains only in showtime (75s), formula, and 0..100 clamp");
{
  const tPass = makeTeam(0, 4, { humans: 4, prefix: "Att_" });
  const tFail = makeTeam(1, 3, { humans: 3, prefix: "FailAtt_" });
  const tr = new MirrorTrial(Rng.seeded(601));
  tr.startLobby([tPass, tFail]);

  const lobbyFull = tr.attentionFor(tPass, 75);
  const lobbyLowSec = tr.attentionFor(tPass, 0);

  for (const p of tPass.active()) tr.connect(p.id);
  tr.connect(tFail.active()[0].id); // leave tFail incomplete
  tr.closeDoors();

  const revealFull = tr.attentionFor(tPass, 75);
  const revealLowSec = tr.attentionFor(tPass, 0);
  const failedAtReveal = tr.attentionFor(tFail, 75);

  tr.startShowtime();
  const showStart = tr.attentionFor(tPass, 75);
  const showHalf = tr.attentionFor(tPass, 37.5);

  // Add setup penalty (+3), dancer boosts (d0: +3, d1: +2 -> avg +2.5), dancer penalties (d0 miss +2, d1 stray +1 -> avg 1.5)
  // At 37.5s left: base 50 + 2.5 - 3 - 1.5 = 48
  const setup0 = tr.setupSlots(tPass)[0].playerId;
  tr.cableMiss(setup0, "HDMI"); // +3 setup penalty
  const [da, db] = tr.dancerIdsFor(tPass);
  tr.danceHit(da, "perfect");   // +3
  tr.danceHit(db, "good");      // +2 -> avgBoost 2.5
  tr.danceMiss(da);             // +2
  tr.danceStray(db);            // +1 -> avgPen 1.5
  const combined = tr.attentionFor(tPass, 37.5);
  const clampedHigh = tr.attentionFor(tPass, 75); // 100 + 2.5 - 3 - 1.5 = 98 (boost capped at 100 if higher)
  for (let i = 0; i < 6; i++) tr.danceHit(da, "perfect");
  const over100Clamped = tr.attentionFor(tPass, 75);
  const atZeroSec = tr.attentionFor(tPass, 0); // 0 + 11.5 - 3 - 1.5 = 7
  for (let i = 0; i < 6; i++) tr.danceMiss(da); // +12 -> avgPen 7.5; 0 + 11.5 - 3 - 7.5 = 1
  tr.danceMiss(da);
  tr.danceMiss(db); // +4 -> avgPen 9.5; 0 + 11.5 - 3 - 9.5 = -1 -> clamped 0
  const clampedZero = tr.attentionFor(tPass, 0);

  expect(
    "Attention stays 100 in lobby and reveal, drains only in showtime, fails locked team at 0, and clamps 0..100",
    lobbyFull === 100 && lobbyLowSec === 100 &&
      revealFull === 100 && revealLowSec === 100 &&
      failedAtReveal === 0 && tr.attentionFor(tFail, 75) === 0 &&
      showStart === 100 && showHalf === 50 &&
      combined === 48 && clampedHigh === 98 &&
      over100Clamped === 100 && atZeroSec === 7 && clampedZero === 0
  );
}

console.log("-- 6. Bot dance timing (+1 every 1.5..2.5s, cap 45, no misses) and idle human autoPilot");
{
  const runBotDance = seed => {
    const team = makeTeam(0, 4, { humans: 0, prefix: "BotD_" }); // 2 setup bots, 2 dancer bots
    const sc = new SetupCrew(Rng.seeded(seed), [team]);
    const dc = new DanceCrew(Rng.seeded(seed + 1000), sc, { teams: [team] });
    const res = dc.advanceBotDance(team, 150);
    return { res, state: dc.state() };
  };

  const b1 = runBotDance(707);
  const b2 = runBotDance(707);
  const b3 = runBotDance(708);

  const byDancer = new Map();
  for (const ev of b1.res.events) {
    if (!byDancer.has(ev.playerId)) byDancer.set(ev.playerId, []);
    byDancer.get(ev.playerId).push(ev);
  }

  let intervalsValid = byDancer.size === 2;
  let allCapAndClean = true;
  for (const evs of byDancer.values()) {
    if (evs.length !== 45) allCapAndClean = false;
    let prevAt = 0;
    for (const ev of evs) {
      const gap = ev.at - prevAt;
      if (gap < MirrorData.bots.danceMinSeconds - 1e-9 || gap > MirrorData.bots.danceMaxSeconds + 1e-9) {
        intervalsValid = false;
      }
      if (ev.boostAdded !== 1) allCapAndClean = false;
      prevAt = ev.at;
    }
  }
  for (const d of b1.state.teams[0].dancers) {
    if (d.boost !== 45 || d.penalties !== 0 || d.misses !== 0 || d.strays !== 0 || d.nextBotBoostAt !== null) {
      allCapAndClean = false;
    }
  }

  expect(
    "Bot dancers gain +1 every 1.5..2.5s up to 45 with zero misses, repeat on same seed, and vary across seeds",
    intervalsValid && allCapAndClean &&
      JSON.stringify(b1) === JSON.stringify(b2) &&
      JSON.stringify(b1) !== JSON.stringify(b3)
  );

  // Human dancer skipped unless autoPilot; autoPilot continues from lastActionAt (no retroactive boosts)
  const humanTeam = makeTeam(1, 3, { humans: 3, prefix: "HumD_" });
  const scH = new SetupCrew(Rng.seeded(720), [humanTeam]);
  const dcH = new DanceCrew(Rng.seeded(721), scH, { teams: [humanTeam] });
  const hdId = dcH.dancerIdsFor(humanTeam)[0];
  const noBotOnHuman = dcH.advanceBotDance(humanTeam, 20);
  const directHumanBlocked = dcH.applyBotBoost(hdId);
  dcH.noteHit(hdId, "good", { elapsedSeconds: 20 }); // boost = 2, lastActionAt = 20
  const at20EnterIdle = dcH.advanceBotDance(humanTeam, 20, { autoPilotIds: [hdId] });
  const at26Idle = dcH.advanceBotDance(humanTeam, 26, { autoPilotIds: [hdId] });

  expect(
    "Human dancer is skipped without autoPilot and gains idle autoPilot boosts from lastActionAt onward",
    noBotOnHuman.ok && noBotOnHuman.events.length === 0 &&
      !directHumanBlocked.ok &&
      at20EnterIdle.ok && at20EnterIdle.events.length === 0 &&
      at26Idle.ok && at26Idle.events.length >= 2 &&
      at26Idle.events.every(e => e.at > 20 && e.at <= 26) &&
      dcH.boostFor(hdId) === 2 + at26Idle.events.length
  );
}

console.log("-- 7. Bot-only team random attention with fixed seed");
{
  const runBotOnly = seed => {
    const botTeam = makeTeam(0, 4, { humans: 0, prefix: "BotOnly_" });
    const tr = new MirrorTrial(Rng.seeded(seed));
    tr.startLobby([botTeam]);
    const preLobby = tr.attentionFor(botTeam, 40);
    for (const p of botTeam.active()) tr.connect(p.id);
    tr.closeDoors();
    const preReveal = tr.attentionFor(botTeam, 40);
    tr.startShowtime();
    const show75 = tr.attentionFor(botTeam, 75);
    const show10 = tr.attentionFor(botTeam, 10);
    return { preLobby, preReveal, show75, show10, raw: tr.botAttentionFor(botTeam) };
  };

  const r1 = runBotOnly(808);
  const r2 = runBotOnly(808);
  const seen = new Set();
  let allInRange = true;
  for (let s = 1; s <= 40; s++) {
    const r = runBotOnly(s);
    if (!Number.isInteger(r.raw) || r.raw < 0 || r.raw > 100) allInRange = false;
    seen.add(r.raw);
  }

  expect(
    "Bot-only team stays 100 before showtime, rolls fixed integer attention 0..100 at showtime, repeats on seed, and varies",
    r1.preLobby === 100 && r1.preReveal === 100 &&
      r1.show75 === r1.raw && r1.show10 === r1.raw &&
      JSON.stringify(r1) === JSON.stringify(r2) &&
      allInRange && seen.size > 1,
    "seed808=" + r1.raw + ", distinct=" + seen.size
  );
}

console.log("-- 8. MirrorTrial gating for Dance Crew");
{
  const team = makeTeam(0, 5, { humans: 3, prefix: "Gate_" });
  team.members[4].idle = true; // 4 active -> 2 setup, 2 dance
  const tr = new MirrorTrial(Rng.seeded(850));

  const atIdle = tr.danceHit(team.members[0].id, "perfect");
  tr.startLobby([team]);
  const atLobby = tr.advanceBotDance(team, 10);
  for (const p of team.active()) tr.connect(p.id);
  tr.closeDoors();
  const [d0, d1] = tr.dancerIdsFor(team);
  const s0 = tr.setupSlots(team)[0].playerId;
  const atRevealHit = tr.danceHit(d0, "perfect");
  const atRevealBot = tr.applyBotDanceBoost(d1);

  tr.startShowtime();
  const hitOk = tr.danceHit(d0, "perfect", { elapsedSeconds: 3 });
  const missOk = tr.danceMiss(d0, { elapsedSeconds: 5 });
  const strayOk = tr.danceStray(d1, { elapsedSeconds: 6 });
  const setupBlocked = tr.danceHit(s0, "good");
  const idleBlocked = tr.danceHit(team.members[4].id, "perfect");
  const botAdv = tr.advanceBotDance(team, 12);

  // When trial ranking is set (trial closed), dance actions are blocked
  tr.ranking = [{ team, place: 1, won: true, score: 5 }];
  const afterClose = tr.danceHit(d0, "perfect");

  expect(
    "MirrorTrial gates dance actions to showtime (unclosed), rejects setup/idle, and routes valid dance actions",
    !atIdle.ok && !atLobby.ok && !atRevealHit.ok && !atRevealBot.ok &&
      hitOk.ok && missOk.ok && strayOk.ok &&
      !setupBlocked.ok && !idleBlocked.ok &&
      botAdv.ok && !afterClose.ok
  );
}

console.log("-- 9. Save and load (DanceCrew direct and MirrorTrial / Trial.fromJSON)");
{
  // (a) Direct DanceCrew mid-showtime save/load
  const tOrig = makeTeam(0, 6, { humans: 2, prefix: "SaveD_" }); // 3 setup, 3 dance (at least 1 bot dancer)
  const sc = new SetupCrew(Rng.seeded(901), [tOrig], { shuffleSlots: false }); // slots 0,1 human, slot 2 bot; dance = 3 bots
  const rngA = Rng.seeded(902);
  const dcA = new DanceCrew(rngA, sc, { teams: [tOrig] });
  const [da, db, dcId] = dcA.dancerIdsFor(tOrig);
  dcA.noteHit(da, "perfect", { elapsedSeconds: 2 });
  dcA.noteMiss(db, { elapsedSeconds: 3 });
  dcA.advanceBotDance(tOrig, 7);

  const dcJson = dcA.toJSON();
  const dcErr = plainProblem(dcJson);
  const rngB = Rng.seeded(0);
  rngB.setState(rngA.getState());
  const dcB = DanceCrew.fromJSON(JSON.parse(JSON.stringify(dcJson)), { rng: rngB });

  const cA = dcA.advanceBotDance(tOrig, 30);
  const cB = dcB.advanceBotDance(tOrig, 30);
  const hA = dcA.noteHit(dcId, "good", { elapsedSeconds: 31 });
  const hB = dcB.noteHit(dcId, "good", { elapsedSeconds: 31 });

  expect(
    "DanceCrew.fromJSON produces plain data and continues identically with synced Rng",
    !dcErr &&
      JSON.stringify(cA) === JSON.stringify(cB) &&
      JSON.stringify(hA) === JSON.stringify(hB) &&
      JSON.stringify(dcA.toJSON()) === JSON.stringify(dcB.toJSON())
  );

  // (b) MirrorTrial full 3-part mid-showtime save/load via Trial.fromJSON (mixed team + bot-only team)
  const tMix = makeTeam(0, 5, { humans: 3, prefix: "MTMix_" });
  const tBot = makeTeam(1, 4, { humans: 0, prefix: "MTBot_" });
  const teamsOrig = [tMix, tBot];
  const trRngA = Rng.seeded(950);
  const trA = new MirrorTrial(trRngA);
  trA.startLobby(teamsOrig);
  for (const t of teamsOrig) for (const p of t.active()) trA.connect(p.id);
  trA.closeDoors();
  trA.startShowtime();

  const mixSetup0 = trA.setupSlots(tMix)[0].playerId;
  const [mixDance0, mixDance1] = trA.dancerIdsFor(tMix);
  trA.cableMiss(mixSetup0, "HDMI");
  trA.danceHit(mixDance0, "perfect", { elapsedSeconds: 4 });
  trA.danceStray(mixDance1, { elapsedSeconds: 5 });
  trA.advanceBotDance(tMix, 10);

  const trJson = trA.toJSON();
  const trErr = plainProblem(trJson);
  const trText = JSON.stringify(trJson);
  const byIdOrig = new Map(teamsOrig.flatMap(t => t.members).map(p => [p.id, p]));
  const playersCopy = [...byIdOrig.values()].map(p => Player.fromJSON(p.toJSON()));
  const byIdCopy = new Map(playersCopy.map(p => [p.id, p]));
  const teamsCopy = teamsOrig.map(t => Team.fromJSON(t.toJSON(), byIdCopy));
  const trRngB = Rng.seeded(0);
  trRngB.setState(trRngA.getState());

  const trB = Trial.fromJSON(JSON.parse(trText), { rng: trRngB, teams: teamsCopy, byId: byIdCopy });

  // Continue identically on both trials
  const dAdvA = trA.advanceBotDance(tMix, 35);
  const dAdvB = trB.advanceBotDance(teamsCopy[0], 35);
  const sAdvA = trA.advanceBotSetup(tBot, 22);
  const sAdvB = trB.advanceBotSetup(teamsCopy[1], 22);
  const hitEndA = trA.danceHit(mixDance0, "good", { elapsedSeconds: 36 });
  const hitEndB = trB.danceHit(mixDance0, "good", { elapsedSeconds: 36 });

  expect(
    "MirrorTrial mid-showtime save/load restores #lobby, #setup, #dance, bot attention, and continues identically",
    !trErr &&
      trB instanceof MirrorTrial &&
      trB.danceStarted &&
      trB.isBotOnlyTeam(teamsCopy[1]) &&
      !trB.isBotOnlyTeam(teamsCopy[0]) &&
      JSON.stringify(dAdvA) === JSON.stringify(dAdvB) &&
      JSON.stringify(sAdvA) === JSON.stringify(sAdvB) &&
      JSON.stringify(hitEndA) === JSON.stringify(hitEndB) &&
      trA.attentionFor(tMix, 39) === trB.attentionFor(teamsCopy[0], 39) &&
      trA.attentionFor(tBot, 39) === trB.attentionFor(teamsCopy[1], 39) &&
      JSON.stringify(trA.toJSON()) === JSON.stringify(trB.toJSON())
  );
}

console.log("-- 10. Seeded note chart, tempo ramp, hit judging, miss deadlines, idle gating, and danceViewFor");
{
  // (a) Same seed gives the same chart, tempo ramps 6 -> 5 -> 4, <=2 same consecutive, 0 Game.rng draws
  const buildChartRun = (seed, ticks) => {
    const team = makeTeam(0, 3, { humans: 3, prefix: "Chart_" });
    const sc = new SetupCrew(Rng.seeded(seed), [team]);
    const gameRng = Rng.seeded(seed + 100);
    const seedRng = Rng.seeded(seed + 200);
    const dc = new DanceCrew(gameRng, sc, { teams: [team], seedRng });
    const dId = dc.dancerIdsFor(team)[0];
    const startAt = 100000;
    const rngBefore = gameRng.getState();
    dc.beginShowtime(startAt);

    const seen = new Map();
    const recordNotes = now => {
      const v = dc.danceViewFor(dId, now);
      if (v) {
        for (const n of v.notes) {
          if (!seen.has(n.id)) seen.set(n.id, { id: n.id, t0: n.t0, dir: n.dir });
        }
      }
    };
    recordNotes(startAt);
    for (let t = 1; t <= ticks; t++) {
      const now = startAt + t * MirrorData.timers.tickMs;
      recordNotes(now);
      const v = dc.danceViewFor(dId, now);
      const perf = v.notes.find(n => n.zone === "perfect");
      if (perf) dc.press(dId, perf.dir, { now });
    }
    const rngAfter = gameRng.getState();
    return { notes: [...seen.values()], view: dc.danceViewFor(dId, startAt + ticks * 250), rngUntouched: rngBefore === rngAfter, dc };
  };

  const cA = buildChartRun(1010, 260);
  const cB = buildChartRun(1010, 260);
  const cDiff = buildChartRun(1011, 260);
  const gaps = [];
  for (let i = 1; i < cA.notes.length; i++) gaps.push(cA.notes[i].t0 - cA.notes[i - 1].t0);
  let noTriple = true;
  for (let i = 2; i < cA.notes.length; i++) {
    if (cA.notes[i].dir === cA.notes[i - 1].dir && cA.notes[i - 1].dir === cA.notes[i - 2].dir) noTriple = false;
  }

  expect(
    "Same seed produces identical DanceCrew chart, tempo ramp 6->5->4, <=2 repeats, with 0 Game.rng draws",
    cA.rngUntouched &&
      cA.notes.length > 42 &&
      gaps[0] === MirrorData.dance.gapInitialTicks &&
      gaps[20] === MirrorData.dance.gapMidTicks &&
      gaps[40] === MirrorData.dance.gapFastTicks &&
      noTriple &&
      JSON.stringify(cA.notes) === JSON.stringify(cB.notes) &&
      JSON.stringify(cA.notes) !== JSON.stringify(cDiff.notes)
  );

  // (b) Miss deadlines, idle exclusion/rejection, and older save backward compatibility
  const tmIdle = makeTeam(0, 4, { humans: 4, prefix: "IdleD_" });
  const scIdle = new SetupCrew(Rng.seeded(1020), [tmIdle]);
  const dcIdle = new DanceCrew(Rng.seeded(1021), scIdle, { teams: [tmIdle], seedRng: Rng.seeded(1022) });
  const [actId, idleId] = dcIdle.dancerIdsFor(tmIdle);
  const tStart = 50000;
  const tickMs = MirrorData.timers.tickMs;
  dcIdle.beginShowtime(tStart);
  const miss1At = tStart + (MirrorData.dance.travelTicks + MirrorData.dance.goodWindowTicks + 1) * tickMs;
  const due0 = dcIdle.nextDeadline(tmIdle, { activeHumanIds: new Set([actId]) });
  dcIdle.tickDeadlines(tmIdle, miss1At - 1, { activeHumanIds: new Set([actId]) });
  const zeroBefore = dcIdle.dancerState(actId).misses === 0 && dcIdle.dancerState(idleId).misses === 0;
  dcIdle.tickDeadlines(tmIdle, miss1At, { activeHumanIds: new Set([actId]) });
  const actMissedOnce = dcIdle.dancerState(actId).misses === 1 && dcIdle.dancerState(idleId).misses === 0;
  const rejPress = dcIdle.press(idleId, "left", { now: miss1At, isIdle: true });
  const rejHit = dcIdle.noteHit(idleId, "perfect", { isIdle: true });
  const rejMiss = dcIdle.noteMiss(idleId, { isIdle: true });
  const rejStray = dcIdle.strayPress(idleId, { isIdle: true });

  // Older save without seedRngState/showtimeStartAt/chart still loads cleanly
  const oldJson = JSON.parse(JSON.stringify(dcIdle.toJSON()));
  delete oldJson.seedRngState;
  delete oldJson.showtimeStartAt;
  for (const td of oldJson.teams) {
    for (const d of td.dancers) {
      delete d.chart;
      delete d.lastMove;
      delete d.stumbleUntilTick;
    }
  }
  const dcOld = DanceCrew.fromJSON(oldJson, { rng: Rng.seeded(1021) });

  expect(
    "DanceCrew miss deadlines fire on exact tick for active dancers only, reject idle presses, and load older saves",
    due0 === miss1At &&
      zeroBefore &&
      actMissedOnce &&
      !rejPress.ok && !rejHit.ok && !rejMiss.ok && !rejStray.ok &&
      dcOld.started && dcOld.dancerState(actId).misses === 1 && !!dcOld.danceViewFor(actId, miss1At)
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
