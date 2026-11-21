/* Unit tests for Level 3 SetupCrew (direct) and MirrorTrial coordinator (setup crew).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_mirror_setup.js */
const fs = require("fs");
const path = require("path");
const EP = require("../rules/index.js");
const { Bots, MirrorData, MirrorParts, Player, Rng, Round, Team, Trial } = EP;
const { SetupCrew } = MirrorParts;
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

console.log("-- 1. Construction, exports, privacy, and guard rails");
{
  let threw = false;
  try { new SetupCrew(); } catch (e) { threw = /rng/i.test(e.message); }
  const sc = new SetupCrew(Rng.seeded(11));
  const scKeys = [...Object.keys(sc), ...Object.getOwnPropertyNames(sc)];
  const tr = new MirrorTrial(Rng.seeded(12));
  const trKeys = [...Object.keys(tr), ...Object.getOwnPropertyNames(tr)];
  const mirrorPartsSrc = fs.readFileSync(path.join(__dirname, "..", "rules", "MirrorParts.js"), "utf8");
  const hasMathRandom = /Math\.random/.test(mirrorPartsSrc);
  const hasTeamNames = /\b(kestrel|wren|finch|heron)\b/i.test(mirrorPartsSrc) || /\bTeam\s+[A-Z]\w*/.test(mirrorPartsSrc);

  expect(
    "SetupCrew rejects missing rng, keeps fields private, and exposes no #setup on MirrorTrial",
    threw &&
      typeof SetupCrew === "function" &&
      scKeys.length === 0 &&
      !trKeys.includes("setup") &&
      !trKeys.includes("#setup") &&
      tr.setup === undefined &&
      !tr.setupStarted
  );
  expect(
    "Round.LEVELS[2] uses mirror and MirrorParts uses no Math.random or hardcoded team names",
    Round.LEVELS[2].trialKind === "mirror" && !hasMathRandom && !hasTeamNames
  );
}

console.log("-- 2. Crew split (sizes 3, 4, 5, 1, 2, 6) and Stuck or Idle exclusions");
{
  const cases = [
    { label: "size 3 active (2 setup, 1 dance)", size: 3, stuck: 0, idle: 0, expSetup: 2, expDance: 1 },
    { label: "size 4 active (2 setup, 2 dance)", size: 4, stuck: 0, idle: 0, expSetup: 2, expDance: 2 },
    { label: "size 5 active (3 setup, 2 dance)", size: 5, stuck: 0, idle: 0, expSetup: 3, expDance: 2 },
    { label: "size 6 active capped at 3 setup (3 setup, 3 dance)", size: 6, stuck: 0, idle: 0, expSetup: 3, expDance: 3 },
    { label: "size 5 with 1 Stuck -> 4 active (2 setup, 2 dance)", size: 5, stuck: 1, idle: 0, expSetup: 2, expDance: 2 },
    { label: "size 5 with 1 Stuck + 1 Idle -> 3 active (2 setup, 1 dance)", size: 5, stuck: 1, idle: 1, expSetup: 2, expDance: 1 },
    { label: "size 4 with 2 Stuck -> 2 active (1 setup, 1 dance)", size: 4, stuck: 2, idle: 0, expSetup: 1, expDance: 1 },
    { label: "size 3 with 2 Idle -> 1 active (1 setup, 0 dance)", size: 3, stuck: 0, idle: 2, expSetup: 1, expDance: 0 },
  ];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const team = makeTeam(i, c.size, { humans: c.size, prefix: "Split" + i + "_" });
    for (let s = 0; s < c.stuck; s++) team.members[c.size - 1 - s].glitches = Player.STUCK_AT;
    for (let d = 0; d < c.idle; d++) team.members[c.size - 1 - c.stuck - d].idle = true;
    const activeIds = team.active().map(p => p.id);

    const sc = new SetupCrew(Rng.seeded(200 + i), [team]);
    const st = sc.teamState(team);
    const scSetupIds = st.slots.map(s => s.playerId);
    const scDanceIds = st.danceIds;
    const scUnion = [...scSetupIds, ...scDanceIds];
    const scOk = scSetupIds.length === c.expSetup &&
      scDanceIds.length === c.expDance &&
      scUnion.length === activeIds.length &&
      new Set(scUnion).size === activeIds.length &&
      activeIds.every(id => scUnion.includes(id));

    const tr = new MirrorTrial(Rng.seeded(300 + i));
    tr.startLobby([team]);
    for (const id of activeIds) tr.connect(id);
    tr.closeDoors();
    const deal = tr.crewFor(team);
    const trSlots = tr.setupSlots(team);
    const trOk = deal.setupIds.length === c.expSetup &&
      deal.danceIds.length === c.expDance &&
      trSlots.length === c.expSetup &&
      JSON.stringify(trSlots.map(s => s.playerId)) === JSON.stringify(deal.setupIds);

    expect("Crew split " + c.label, scOk && trOk);
  }
}

console.log("-- 3. Setup step split (1, 2, 3 players) and seeded slot order");
{
  const expected = {
    1: [["cables", "sound", "mic", "deck", "qa"]],
    2: [["cables", "sound", "mic"], ["deck", "qa"]],
    3: [["cables", "sound"], ["mic", "deck"], ["qa"]],
  };
  for (const setupCount of [1, 2, 3]) {
    const activeNeeded = setupCount === 1 ? 1 : setupCount === 2 ? 4 : 5;
    const team = makeTeam(0, activeNeeded, { humans: activeNeeded, prefix: "Step" + setupCount + "_" });
    const sc = new SetupCrew(Rng.seeded(400 + setupCount), [team]);
    const slots = sc.slotsFor(team);
    const flat = slots.flatMap(s => s.steps);
    expect(
      "Step split for " + setupCount + " Setup player(s)",
      slots.length === setupCount &&
        JSON.stringify(slots.map(s => s.steps)) === JSON.stringify(expected[setupCount]) &&
        JSON.stringify(flat) === JSON.stringify(MirrorData.setupSteps),
      JSON.stringify(slots.map(s => s.steps))
    );
  }

  const slotDeal = seed => {
    const team = makeTeam(0, 5, { humans: 5, prefix: "Slot_" });
    const sc = new SetupCrew(Rng.seeded(seed), [team]);
    return sc.slotsFor(team).map(s => s.playerId);
  };
  const distinct = new Set();
  for (let s = 1; s <= 20; s++) distinct.add(JSON.stringify(slotDeal(s)));
  expect(
    "Same seed repeats setup slot order and different seeds vary",
    JSON.stringify(slotDeal(77)) === JSON.stringify(slotDeal(77)) && distinct.size > 1,
    "distinct=" + distinct.size
  );
}

console.log("-- 4. Step order, turn handoff, and results-based input (3-player + 2-player + 1-player)");
{
  // 3-player Setup Crew deterministic walkthrough
  const team = makeTeam(0, 5, { humans: 5, prefix: "Flow3_" });
  const sc = new SetupCrew(Rng.seeded(501), [team]);
  const slots = sc.slotsFor(team);
  const [s0, s1, s2] = slots.map(s => s.playerId);
  const danceId = sc.teamState(team).danceIds[0];

  // Cables (slot 0)
  const wrongTurnStart = sc.cableHit(s1, "HDMI");
  const dancerBlocked = sc.cableHit(danceId, "HDMI");
  const wrongStepEarly = sc.soundHeld(s0);
  const unknownPort = sc.cableHit(s0, "DP");
  const missCable = sc.cableMiss(s0, "HDMI");
  const c1 = sc.cableHit(s0, "HDMI");
  const dupPort = sc.cableHit(s0, "HDMI");
  const c2 = sc.cableHit(s0, "USB-C");
  const c3 = sc.cableHit(s0, "AirLink");
  const c4 = sc.cableHit(s0, "VGA");
  expect(
    "Cables enforces turn/step/port rules, +3 spark on miss, and advances to sound (slot 0)",
    !wrongTurnStart.ok && !dancerBlocked.ok && !wrongStepEarly.ok && !unknownPort.ok && !dupPort.ok &&
      missCable.ok && missCable.spark && missCable.penaltyAdded === 3 && sc.penaltiesFor(team) === 3 &&
      c1.ok && !c1.stepDone && c2.ok && c3.ok &&
      c4.ok && c4.stepDone && c4.nextStep === "sound" && c4.nextPlayerId === s0 &&
      sc.currentStep(team) === "sound" && sc.currentPlayerId(team) === s0
  );

  // Sound (slot 0) -> hands off to slot 1 on mic
  const fb = sc.soundFeedback(s0);
  const wrongSlotSound = sc.soundHeld(s1);
  const soundOk = sc.soundHeld(s0);
  const micSeq1 = sc.micSequenceFor(team);
  expect(
    "Sound feedback adds +4 and soundHeld advances to mic and hands turn to slot 1",
    fb.ok && fb.feedback && fb.penaltyAdded === 4 && sc.penaltiesFor(team) === 7 &&
      !wrongSlotSound.ok &&
      soundOk.ok && soundOk.stepDone && soundOk.nextStep === "mic" && soundOk.nextPlayerId === s1 &&
      sc.currentPlayerId(team) === s1 && sc.isPlayersTurn(s1) && !sc.isPlayersTurn(s0) &&
      Array.isArray(micSeq1) && micSeq1.length === 3
  );

  // Mic (slot 1): wrong tap (+4, new sequence), then rounds 3 -> 4 -> 5
  const oldSlotMic = sc.micTap(s0, micSeq1[0]);
  const badMicNum = sc.micTap(s1, 5);
  const wrongMicVal = (micSeq1[0] % 4) + 1;
  const micWrong = sc.micTap(s1, wrongMicVal);
  const seqAfterWrong = sc.micSequenceFor(team);
  let r1Ok = true;
  for (const n of seqAfterWrong) r1Ok = r1Ok && sc.micTap(s1, n).ok;
  const seqRound2 = sc.micSequenceFor(team);
  let r2Ok = true;
  for (const n of seqRound2) r2Ok = r2Ok && sc.micTap(s1, n).ok;
  const seqRound3 = sc.micSequenceFor(team);
  let lastMicRes = null;
  for (const n of seqRound3) lastMicRes = sc.micTap(s1, n);
  const fileOrder = sc.deckOrderFor(team);
  expect(
    "Mic enforces turn/range, adds +4 and regenerates on wrong tap, completes 3/4/5 rounds to deck (slot 1)",
    !oldSlotMic.ok && !badMicNum.ok &&
      micWrong.ok && !micWrong.hit && micWrong.penaltyAdded === 4 && sc.penaltiesFor(team) === 11 &&
      Array.isArray(seqAfterWrong) && seqAfterWrong.length === 3 &&
      r1Ok && seqRound2.length === 4 &&
      r2Ok && seqRound3.length === 5 &&
      lastMicRes && lastMicRes.ok && lastMicRes.stepDone && lastMicRes.nextStep === "deck" &&
      lastMicRes.nextPlayerId === s1 && Array.isArray(fileOrder) && fileOrder.length === 6
  );

  // Deck (slot 1) -> hands off to slot 2 on qa
  const wrongFileIdx = MirrorData.files.findIndex(f => !f.correct);
  const okFileIdx = MirrorData.files.findIndex(f => f.correct);
  const reshuf = sc.reshuffleDeck(team);
  const deckWrong = sc.pickFile(s1, wrongFileIdx);
  const deckDupWrong = sc.pickFile(s1, wrongFileIdx);
  const wrapEarly = sc.wrapUp(s2);
  const deckOk = sc.pickFile(s1, okFileIdx);
  const qaOrder = sc.qaOrderFor(team);
  expect(
    "Deck reshuffles, adds +6 on wrong file, blocks duplicate wrong pick, and advances to Q&A (slot 2)",
    reshuf.ok && reshuf.reshuffles === 1 && reshuf.fileOrder.length === 6 &&
      deckWrong.ok && !deckWrong.hit && deckWrong.penaltyAdded === 6 && deckWrong.reshuffleRequested &&
      !deckDupWrong.ok && !wrapEarly.ok &&
      sc.penaltiesFor(team) === 17 &&
      deckOk.ok && deckOk.stepDone && deckOk.nextStep === "qa" && deckOk.nextPlayerId === s2 &&
      sc.currentPlayerId(team) === s2 && Array.isArray(qaOrder) && qaOrder.length === 3
  );

  // Q&A (slot 2): 1 right (-5 recover), 1 wrong (+5), 1 timeout (+5), then wrapUp
  const q1 = sc.currentQaFor(team);
  const qaWrongTurn = sc.answerQa(s1, q1.correctIndex);
  const qaRight = sc.answerQa(s2, q1.correctIndex); // 17 -> 12
  const q2 = sc.currentQaFor(team);
  const wrongOpt = (q2.correctIndex + 1) % q2.options.length;
  const qaWrong = sc.answerQa(s2, wrongOpt);        // 12 -> 17
  const qaTime = sc.timeoutQa(s2);                  // 17 -> 22
  const wrapWrongPlayer = sc.wrapUp(s1);
  const wrapOk = sc.wrapUp(s2);
  const wrapTwice = sc.wrapUp(s2);
  expect(
    "Q&A enforces turn, recovers 5 on right, adds 5 on wrong/timeout, and slot 2 wraps up once",
    !qaWrongTurn.ok &&
      qaRight.ok && qaRight.correct && qaRight.recovered === 5 && qaRight.penalties === 12 &&
      qaWrong.ok && !qaWrong.correct && qaWrong.penaltyAdded === 5 && qaWrong.penalties === 17 &&
      qaTime.ok && qaTime.timeout && qaTime.penaltyAdded === 5 && sc.penaltiesFor(team) === 22 &&
      qaTime.stepDone && qaTime.nextStep === "wrapUp" && qaTime.nextPlayerId === s2 &&
      !wrapWrongPlayer.ok && wrapOk.ok && wrapOk.wrappedUp && sc.isWrappedUp(team) &&
      !wrapTwice.ok && sc.currentStep(team) === null && sc.currentPlayerId(team) === null
  );

  // Q&A recovery clamps at 0 (does not turn penalties negative)
  const smallTeam = makeTeam(1, 1, { humans: 1, prefix: "Small_" });
  const scSmall = new SetupCrew(Rng.seeded(502), [smallTeam]);
  const pSmall = scSmall.slotsFor(smallTeam)[0].playerId;
  scSmall.cableMiss(pSmall, "HDMI"); // +3 penalty
  for (const port of MirrorData.ports) scSmall.cableHit(pSmall, port);
  scSmall.soundHeld(pSmall);
  for (let r = 0; r < 3; r++) {
    for (const n of scSmall.micSequenceFor(smallTeam)) scSmall.micTap(pSmall, n);
  }
  scSmall.pickFile(pSmall, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");
  const curQ = scSmall.currentQaFor(smallTeam);
  const recRes = scSmall.answerQa(pSmall, curQ.correctIndex);
  expect(
    "Q&A recovery clamps at 0 (3 penalty restored by 3, never negative)",
    recRes.ok && recRes.recovered === 3 && scSmall.penaltiesFor(smallTeam) === 0
  );

  // 2-player Setup handoff check (P0: cables/sound/mic -> P1: deck/qa/wrapUp)
  const t2 = makeTeam(2, 4, { humans: 4, prefix: "Two_" });
  const sc2 = new SetupCrew(Rng.seeded(503), [t2]);
  const [p2a, p2b] = sc2.slotsFor(t2).map(s => s.playerId);
  for (const port of MirrorData.ports) sc2.cableHit(p2a, port);
  sc2.soundHeld(p2a);
  const stillP2aAtMic = sc2.currentPlayerId(t2) === p2a;
  for (let r = 0; r < 3; r++) {
    for (const n of sc2.micSequenceFor(t2)) sc2.micTap(p2a, n);
  }
  const handedToP2bAtDeck = sc2.currentStep(t2) === "deck" && sc2.currentPlayerId(t2) === p2b;
  sc2.pickFile(p2b, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");
  for (let i = 0; i < 3; i++) sc2.answerQa(p2b, sc2.currentQaFor(t2).correctIndex);
  const wrap2 = sc2.wrapUp(p2b);
  expect(
    "2-player Setup hands off from slot 0 to slot 1 after mic and wraps up on slot 1",
    stillP2aAtMic && handedToP2bAtDeck && wrap2.ok && sc2.isWrappedUp(t2)
  );
}

console.log("-- 5. Seeded content picks (mic, deck reshuffle, Q&A order)");
{
  const runPicks = seed => {
    const team = makeTeam(0, 1, { humans: 1, prefix: "Pick_" });
    const sc = new SetupCrew(Rng.seeded(seed), [team]);
    const pid = sc.slotsFor(team)[0].playerId;
    for (const port of MirrorData.ports) sc.cableHit(pid, port);
    sc.soundHeld(pid);
    const mic1 = sc.micSequenceFor(team);
    for (const n of mic1) sc.micTap(pid, n);
    const mic2 = sc.micSequenceFor(team);
    for (const n of mic2) sc.micTap(pid, n);
    const mic3 = sc.micSequenceFor(team);
    for (const n of mic3) sc.micTap(pid, n);
    const deck1 = sc.deckOrderFor(team);
    const deck2 = sc.reshuffleDeck(team).fileOrder;
    sc.pickFile(pid, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");
    const qaOrder = sc.qaOrderFor(team);
    return { mic1, mic2, mic3, deck1, deck2, qaOrder };
  };
  const a = runPicks(606);
  const b = runPicks(606);
  const varied = new Set();
  for (let s = 1; s <= 15; s++) varied.add(JSON.stringify(runPicks(s)));
  expect(
    "Same seed yields identical mic/deck/Q&A content picks and different seeds vary",
    JSON.stringify(a) === JSON.stringify(b) && varied.size > 1,
    "distinct=" + varied.size
  );
}

console.log("-- 6. Bot timing, 30% hiccup (-3), mixed human/bot handoff, and idle autopilot");
{
  // Full bot setup schedule (4, 10, 16, 22, 28, 34s)
  const runBotSchedule = seed => {
    const team = makeTeam(0, 5, { humans: 0, prefix: "Bot_" });
    const sc = new SetupCrew(Rng.seeded(seed), [team]);
    const before = sc.advanceBotSetup(team, 3);
    const evs = [];
    for (const t of [4, 10, 16, 22, 28, 34]) {
      evs.push(...sc.advanceBotSetup(team, t).events);
    }
    return { beforeCount: before.events.length, wrapped: sc.isWrappedUp(team), penalties: sc.penaltiesFor(team), evs };
  };
  const b1 = runBotSchedule(707);
  const b2 = runBotSchedule(707);
  const expectedSteps = ["cables", "sound", "mic", "deck", "qa", "wrapUp"];
  const expectedTimes = [4, 10, 16, 22, 28, 34];
  const stepsMatch = JSON.stringify(b1.evs.map(e => e.step)) === JSON.stringify(expectedSteps);
  const timesMatch = JSON.stringify(b1.evs.map(e => e.finishedAt)) === JSON.stringify(expectedTimes);
  const costsMatch = b1.evs.every(e => e.penaltyAdded === (e.hiccup ? 3 : 0)) && !b1.evs[5].hiccup;

  expect(
    "Bot setup follows milestones 4/10/16/22/28/34s, wraps up automatically, and repeats with same seed",
    b1.beforeCount === 0 && b1.wrapped && stepsMatch && timesMatch && costsMatch &&
      JSON.stringify(b1) === JSON.stringify(b2),
    "penalties=" + b1.penalties
  );

  // Hiccup rate across 200 seeds (1,000 non-wrapUp bot steps)
  let hiccups = 0;
  let totalSteps = 0;
  let badCost = false;
  for (let s = 1; s <= 200; s++) {
    const r = runBotSchedule(s);
    for (let i = 0; i < 5; i++) {
      totalSteps++;
      if (r.evs[i].hiccup) {
        hiccups++;
        if (r.evs[i].penaltyAdded !== 3) badCost = true;
      }
    }
  }
  const rate = hiccups / totalSteps;
  expect(
    "Bot hiccup rate across 200 seeds matches ~30% and costs 3 per hiccup",
    !badCost && hiccups > 0 && rate >= 0.2 && rate <= 0.4,
    hiccups + "/" + totalSteps + " (" + (rate * 100).toFixed(1) + "%)"
  );

  // Mixed bot -> human -> bot handoff + autoPilot for idle human
  const mixedTeam = makeTeam(1, 5, { humans: 1, prefix: "Mix_" }); // member 0 is human, 1..4 are bots
  const scMix = new SetupCrew(Rng.seeded(708), [mixedTeam], { shuffleSlots: false });
  const slotsMix = scMix.slotsFor(mixedTeam); // 3 slots: human(cables, sound), bot(mic, deck), bot(qa, wrapUp)
  const humanId = slotsMix[0].playerId;
  const bot1Id = slotsMix[1].playerId;
  const bot2Id = slotsMix[2].playerId;

  const noBotAtStart = scMix.advanceBotSetup(mixedTeam, 10);
  const dueDuringHuman = scMix.botStepDueAt(mixedTeam);
  const humanAutoBlocked = scMix.completeBotStep(humanId);
  for (const port of MirrorData.ports) scMix.cableHit(humanId, port, { elapsedSeconds: 3 });
  scMix.soundHeld(humanId, { elapsedSeconds: 9 });
  const botMidRun = scMix.advanceBotSetup(mixedTeam, 22); // mic due 9+6=15, deck due 15+6=21, qa due 21+6=27
  const dueAtQa = scMix.botStepDueAt(mixedTeam);
  const idleWrap = scMix.advanceBotSetup(mixedTeam, 35);   // finishes qa at 27 and wrapUp at 33
  expect(
    "Mixed crew stops at human turn, rejects completeBotStep on non-bot, and hands off cleanly to bots",
    noBotAtStart.events.length === 0 &&
      dueDuringHuman === null &&
      !humanAutoBlocked.ok &&
      botMidRun.events.map(e => e.step).join(",") === "mic,deck" &&
      botMidRun.currentStep === "qa" && botMidRun.currentPlayerId === bot2Id &&
      dueAtQa === 27 &&
      idleWrap.events.map(e => e.step).join(",") === "qa,wrapUp" && scMix.isWrappedUp(mixedTeam)
  );

  // Explicit autoPilot test on a human slot
  const idleTeam = makeTeam(2, 1, { humans: 1, prefix: "IdleAuto_" });
  const scIdle = new SetupCrew(Rng.seeded(709), [idleTeam]);
  const idlePid = scIdle.slotsFor(idleTeam)[0].playerId;
  const apRes = scIdle.advanceBotSetup(idleTeam, 40, { autoPilotIds: [idlePid] });
  expect(
    "Idle human can complete setup via autoPilot",
    apRes.events.length === 6 && scIdle.isWrappedUp(idleTeam)
  );
}

console.log("-- 7. MirrorTrial coordinator: showtime gate, setup actions, and bot setup");
{
  const team = makeTeam(0, 5, { humans: 2, prefix: "Coord_" });
  team.members[4].glitches = Player.STUCK_AT; // 4 active -> 2 setup, 2 dance
  const tr = new MirrorTrial(Rng.seeded(808));
  tr.startLobby([team]);
  for (const p of team.active()) tr.connect(p.id);
  tr.closeDoors();

  const slots = tr.setupSlots(team);
  const [slot0Id, slot1Id] = slots.map(s => s.playerId);
  const danceId = tr.crewFor(team).danceIds[0];
  const beforeShowtime = tr.cableHit(slot0Id, "HDMI");
  const started = tr.startShowtime();
  const danceBlocked = tr.cableHit(danceId, "HDMI");
  const stuckBlocked = tr.cableHit(team.members[4].id, "HDMI");

  for (const port of MirrorData.ports) tr.cableHit(slot0Id, port, { elapsedSeconds: 5 });
  tr.soundHeld(slot0Id, { elapsedSeconds: 11 });
  for (let r = 0; r < 3; r++) {
    for (const n of tr.micSequenceFor(team)) tr.micTap(slot0Id, n, { elapsedSeconds: 18 });
  }
  const atDeck = tr.setupStep(team) === "deck" && tr.setupCurrentPlayerId(team) === slot1Id;
  tr.pickFile(slot1Id, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx", { elapsedSeconds: 22 });
  for (let i = 0; i < 3; i++) tr.answerQa(slot1Id, tr.currentQaFor(team).correctIndex);
  const wrapped = tr.wrapUp(slot1Id);

  expect(
    "MirrorTrial gates setup actions until startShowtime and routes full setup flow through coordinator",
    !beforeShowtime.ok &&
      started.ok && tr.phase === "showtime" &&
      !danceBlocked.ok && !stuckBlocked.ok &&
      atDeck && wrapped.ok && tr.isSetupWrappedUp(team)
  );
}

console.log("-- 8. Save and load (SetupCrew direct and MirrorTrial / Trial.fromJSON)");
{
  // Direct SetupCrew mid-mic save/load with synced Rng
  const tOrig = makeTeam(0, 4, { humans: 4, prefix: "Save_" });
  const rngA = Rng.seeded(909);
  const scA = new SetupCrew(rngA, [tOrig]);
  const [p0, p1] = scA.slotsFor(tOrig).map(s => s.playerId);
  for (const port of MirrorData.ports) scA.cableHit(p0, port);
  scA.soundHeld(p0);
  const firstSeq = scA.micSequenceFor(tOrig);
  scA.micTap(p0, firstSeq[0]);

  const jsonA = scA.toJSON();
  const errA = plainProblem(jsonA);
  const rngB = Rng.seeded(0);
  rngB.setState(rngA.getState());
  const scB = SetupCrew.fromJSON(JSON.parse(JSON.stringify(jsonA)), { rng: rngB });

  // Continue identically on both
  for (let i = 1; i < firstSeq.length; i++) {
    scA.micTap(p0, firstSeq[i]);
    scB.micTap(p0, firstSeq[i]);
  }
  const s2A = scA.micSequenceFor(tOrig);
  const s2B = scB.micSequenceFor(tOrig);
  for (const n of s2A) { scA.micTap(p0, n); scB.micTap(p0, n); }
  const s3A = scA.micSequenceFor(tOrig);
  const s3B = scB.micSequenceFor(tOrig);
  for (const n of s3A) { scA.micTap(p0, n); scB.micTap(p0, n); }
  const deckA = scA.pickFile(p1, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");
  const deckB = scB.pickFile(p1, "MEDLINE_deck_v3_CLIENT_SIGNED.pptx");

  expect(
    "SetupCrew.fromJSON produces plain data and continues identically after mid-mic reload",
    !errA &&
      JSON.stringify(s2A) === JSON.stringify(s2B) &&
      JSON.stringify(s3A) === JSON.stringify(s3B) &&
      JSON.stringify(deckA) === JSON.stringify(deckB) &&
      JSON.stringify(scA.toJSON()) === JSON.stringify(scB.toJSON())
  );

  // MirrorTrial mid-showtime save/load through Trial.fromJSON
  const teamsOrig = [makeTeam(0, 4, { humans: 2, prefix: "MT0_" }), makeTeam(1, 3, { humans: 0, prefix: "MT1_" })];
  const trRngA = Rng.seeded(910);
  const trA = new MirrorTrial(trRngA);
  trA.startLobby(teamsOrig);
  for (const t of teamsOrig) for (const p of t.active()) trA.connect(p.id);
  trA.closeDoors();
  trA.startShowtime();
  const t0Slot0 = trA.setupSlots(teamsOrig[0])[0].playerId;
  trA.cableHit(t0Slot0, "HDMI");
  trA.cableMiss(t0Slot0, "USB-C");
  trA.advanceBotSetup(teamsOrig[1], 16);

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
  const contA = trA.advanceBotSetup(teamsOrig[1], 34);
  const contB = trB.advanceBotSetup(teamsCopy[1], 34);
  for (const port of ["USB-C", "AirLink", "VGA"]) {
    trA.cableHit(t0Slot0, port);
    trB.cableHit(t0Slot0, port);
  }
  const sndA = trA.soundHeld(t0Slot0);
  const sndB = trB.soundHeld(t0Slot0);

  expect(
    "MirrorTrial mid-showtime save/load restores setup state and continues identically",
    !trErr &&
      trB instanceof MirrorTrial &&
      trB.phase === "showtime" &&
      JSON.stringify(contA) === JSON.stringify(contB) &&
      JSON.stringify(sndA) === JSON.stringify(sndB) &&
      JSON.stringify(trA.toJSON()) === JSON.stringify(trB.toJSON())
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
