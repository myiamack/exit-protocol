/* Unit tests for Level 2 SplitBriefTrial (rules only).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_split_brief.js */
const EP = require("../rules/index.js");
const { Bots, Game, Player, Rng, Round, Scenarios, Team, Trial } = EP;
const { SplitBriefTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function makeTeam(teamId, size, { humans = size, collab = 4, prefix = "P" + teamId + "_" } = {}) {
  const members = Array.from({ length: size }, (_, i) => {
    const p = Bots.makePlayer(teamId * 10 + i, prefix + i, "coop");
    p.isBot = i >= humans;
    p.setAttrsForTest({ focus: 4, initiative: 4, collab, composure: 4, grit: 4 });
    return p;
  });
  return new Team({ id: teamId, name: "Team " + teamId, members });
}

function makeRound2() {
  return new Round(2);
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

console.log("-- 1. Construction and Deal");
{
  let threw = false;
  try { new SplitBriefTrial(); } catch (e) { threw = /rng/i.test(e.message); }
  expect("Constructor rejects missing rng", threw);

  const t3 = makeTeam(0, 3);
  const t4 = makeTeam(1, 4);
  const t5 = makeTeam(2, 5);
  const trial = new SplitBriefTrial(Rng.seeded(101), Scenarios.MEDLINE_SPRINT_1);
  trial.deal([t3, t4, t5]);

  const expectedIds = Scenarios.MEDLINE_SPRINT_1.cards.map(c => c.id).sort();
  for (const [label, team, expectedCounts] of [
    ["3-player team", t3, [1, 2, 2]],
    ["4-player team", t4, [1, 1, 1, 2]],
    ["5-player team", t5, [1, 1, 1, 1, 1]],
  ]) {
    const held = team.members.map(p => trial.cardsFor(p).map(c => c.id));
    const counts = held.map(h => h.length).sort((a, b) => a - b);
    const allCards = held.flat().sort();
    expect(
      label + " holds 5 unique cards total with round-robin counts",
      JSON.stringify(counts) === JSON.stringify(expectedCounts) && JSON.stringify(allCards) === JSON.stringify(expectedIds),
      "counts=" + JSON.stringify(counts)
    );
  }

  // Private view: cardsFor(p) shows only own cards, disjoint from teammates
  const p0Cards = trial.cardsFor(t3.members[0]).map(c => c.id);
  const p1Cards = trial.cardsFor(t3.members[1]).map(c => c.id);
  const p2Cards = trial.cardsFor(t3.members[2]).map(c => c.id);
  const disjoint = p0Cards.every(id => !p1Cards.includes(id) && !p2Cards.includes(id))
    && p1Cards.every(id => !p2Cards.includes(id));
  expect("Private cardsFor shows only player's own cards", disjoint && p0Cards.length + p1Cards.length + p2Cards.length === 5);

  // Stuck and idle players get 0 cards; active teammates still get all 5
  const mixed = makeTeam(3, 4);
  mixed.members[0].glitches = Player.STUCK_AT;
  mixed.members[1].idle = true;
  const trial2 = new SplitBriefTrial(Rng.seeded(102), Scenarios.MEDLINE_SPRINT_1);
  trial2.deal([mixed]);
  const stuckCards = trial2.cardsFor(mixed.members[0]).length;
  const idleCards = trial2.cardsFor(mixed.members[1]).length;
  const activeHeld = [mixed.members[2], mixed.members[3]].map(p => trial2.cardsFor(p).map(c => c.id));
  const activeCounts = activeHeld.map(h => h.length).sort((a, b) => a - b);
  expect(
    "Stuck and idle players receive 0 cards while active teammates hold all 5",
    stuckCards === 0 && idleCards === 0
      && JSON.stringify(activeCounts) === JSON.stringify([2, 3])
      && JSON.stringify(activeHeld.flat().sort()) === JSON.stringify(expectedIds)
  );
}

console.log("-- 2. Team notes");
{
  const t0 = makeTeam(0, 4);
  const t1 = makeTeam(1, 4);
  const trial = new SplitBriefTrial(Rng.seeded(202), Scenarios.MEDLINE_SPRINT_1);
  trial.deal([t0, t1]);

  const p0 = t0.members[0];
  const p1 = t0.members[1];
  const pStuck = t0.members[2];
  const pIdle = t0.members[3];
  const other = t1.members[0];
  pStuck.glitches = Player.STUCK_AT;
  pIdle.idle = true;

  const rEmpty = trial.postNote(p0, "   ");
  expect("Empty/whitespace note is rejected", !rEmpty.ok);

  const r81 = trial.postNote(p0, "x".repeat(81));
  expect("81-character note is rejected without spending a note", !r81.ok && trial.notesLeft(p0) === 3);

  const rStuck = trial.postNote(pStuck, "Can Stuck post?");
  const rIdle = trial.postNote(pIdle, "Can idle post?");
  expect("Stuck and idle players cannot post notes", !rStuck.ok && !rIdle.ok);

  const r80 = trial.postNote(p0, "a".repeat(80));
  const r2 = trial.postNote(p0, "Second note");
  const r3 = trial.postNote(p0, "Third note");
  const r4 = trial.postNote(p0, "Fourth note");
  expect(
    "80 chars allowed, cap is 3 notes, 4th rejected, notesLeft accurate",
    r80.ok && r2.ok && r3.ok && !r4.ok && trial.notesLeft(p0) === 0 && trial.notesLeft(p1) === 3
  );

  // Notes allowed even after Lock In
  const wrongNoteTask = trial.tasks.find(x => !trial.postTwistAnswer.includes(x.id)).id;
  trial.setBoard(p1, [wrongNoteTask]); // Step 10: lockIn now needs at least 1 task; wrong task keeps score 0
  const lockedRes = trial.lockIn(p1);
  const afterLockNote = trial.postNote(p1, "Note after lock in");
  expect("Notes are still allowed after team Lock In", lockedRes.ok && afterLockNote.ok && trial.notesLeft(p1) === 2);

  // Team isolation and stored fields
  trial.postNote(other, "Team 1 secret");
  const feed0 = trial.notesFor(t0);
  const feed1 = trial.notesFor(t1);
  const storedFields = feed0.length === 4
    && feed0[0].posterId === p0.id && feed0[0].posterName === p0.name && feed0[0].text === "a".repeat(80) && feed0[0].order === 1
    && feed0[3].posterId === p1.id && feed0[3].posterName === p1.name && feed0[3].order === 4;
  expect("Feed shows only own team's notes with poster id, name, text, and order", storedFields && feed1.length === 1 && feed1[0].text === "Team 1 secret");
}

console.log("-- 3. Board and Lock In");
{
  const t0 = makeTeam(0, 4);
  const t1 = makeTeam(1, 3);
  const trial = new SplitBriefTrial(Rng.seeded(303), Scenarios.MEDLINE_SPRINT_1);
  trial.deal([t0, t1]);

  const [a0, a1, aStuck, aIdle] = t0.members;
  aStuck.glitches = Player.STUCK_AT;
  aIdle.idle = true;
  const b0 = t1.members[0];

  expect("Bad task id rejected", !trial.setBoard(a0, ["Z"]).ok);
  expect("Duplicate task id rejected", !trial.setBoard(a0, ["D", "D"]).ok);
  expect("3 tasks rejected", !trial.setBoard(a0, ["A", "B", "C"]).ok);
  expect("Stuck player rejected from editing board", !trial.setBoard(aStuck, ["D", "B"]).ok);
  expect("Idle player rejected from editing board", !trial.setBoard(aIdle, ["D", "B"]).ok);

  expect("0 tasks allowed", trial.setBoard(a0, []).ok && trial.boardFor(t0).length === 0);
  expect("1 task allowed", trial.setBoard(a0, ["D"]).ok && JSON.stringify(trial.boardFor(t0)) === '["D"]');
  expect("2 ordered tasks allowed and editable by teammate", trial.setBoard(a1, ["C", "D"]).ok && JSON.stringify(trial.boardFor(t0)) === '["C","D"]');

  expect("Stuck player cannot lock in", !trial.lockIn(aStuck).ok);
  expect("Idle player cannot lock in", !trial.lockIn(aIdle).ok);

  const l0 = trial.lockIn(a0);
  expect("Active player locks team board (order 1)", l0.ok && l0.lockOrder === 1 && trial.isLocked(t0));
  expect("Second Lock In on same team rejected", !trial.lockIn(a1).ok);
  expect("Board edit after Lock In rejected", !trial.setBoard(a1, ["D", "B"]).ok && JSON.stringify(trial.boardFor(t0)) === '["C","D"]');
  expect("allLocked is false while another team is unlocked", !trial.allLocked());
  expect("Unlocked team can still edit its board", trial.setBoard(b0, ["D", "B"]).ok);

  const l1 = trial.lockIn(b0);
  expect("Second team locks in (order 2) and allLocked becomes true", l1.ok && l1.lockOrder === 2 && trial.allLocked());
}

console.log("-- 4. Ghosted Teammate twist");
{
  const t0 = makeTeam(0, 4);
  const t1 = makeTeam(1, 4);
  t0.members[0].glitches = Player.STUCK_AT;
  t0.members[1].idle = true;
  const trial = new SplitBriefTrial(Rng.seeded(404), Scenarios.MEDLINE_SPRINT_1);
  trial.deal([t0, t1]);

  // Team 0 locks in before twist
  trial.setBoard(t0.members[2], ["C", "D"]);
  trial.lockIn(t0.members[2]);
  expect("Twist is null for everyone before fireTwist()", [...t0.members, ...t1.members].every(p => trial.twistFor(p) === null));

  const rngBeforeSecond = Rng.seeded(404);
  // Check across 30 seeds that Stuck/idle players are never chosen and locked teams still get twist
  let onlyActiveChosen = true, lockedGotTwist = true;
  for (let s = 1; s <= 30; s++) {
    const tr = new SplitBriefTrial(Rng.seeded(s), Scenarios.MEDLINE_SPRINT_1);
    tr.deal([t0, t1]);
    const wrongTwistTask = tr.tasks.find(x => !tr.postTwistAnswer.includes(x.id)).id;
    tr.setBoard(t0.members[2], [wrongTwistTask]); // Step 10: lockIn now needs at least 1 task; wrong task keeps score 0
    tr.lockIn(t0.members[2]);
    tr.fireTwist();
    const h0 = t0.members.filter(p => tr.twistFor(p) !== null);
    const h1 = t1.members.filter(p => tr.twistFor(p) !== null);
    if (h0.length !== 1 || h1.length !== 1) { onlyActiveChosen = false; lockedGotTwist = false; break; }
    if (!h0[0].isActive() || !h1[0].isActive()) { onlyActiveChosen = false; break; }
  }
  expect("fireTwist picks exactly 1 active player per team and fires for locked teams", onlyActiveChosen && lockedGotTwist);

  const firstFire = trial.fireTwist();
  const holders1 = [...t0.members, ...t1.members].filter(p => trial.twistFor(p) !== null).map(p => p.id);
  const stateAfterFirst = trial.rng.getState();
  const secondFire = trial.fireTwist();
  const holders2 = [...t0.members, ...t1.members].filter(p => trial.twistFor(p) !== null).map(p => p.id);
  const stateAfterSecond = trial.rng.getState();
  const holderPlayer = [...t0.members, ...t1.members].find(p => p.id === holders1[0]);
  expect(
    "fireTwist fires once only, preserves holders/rng, and exposes twist card text only to holder",
    firstFire === true && secondFire === false
      && JSON.stringify(holders1) === JSON.stringify(holders2)
      && stateAfterFirst === stateAfterSecond
      && trial.twistFor(holderPlayer).id === Scenarios.MEDLINE_SPRINT_1.twist.id
      && typeof rngBeforeSecond === "function"
  );
}

console.log("-- 5. Scoring");
{
  const cases = [
    [["D", "B"], 5],
    [["B", "D"], 4],
    [["C", "D"], 2],
    [["D"], 2],
    [[], 0],
    [["A", "C"], 0],
  ];
  for (const [board, expected] of cases) {
    const got = SplitBriefTrial.score(board);
    expect("Score " + JSON.stringify(board) + " === " + expected, got === expected, got);
  }
}

console.log("-- 6. Ranking, bot-only teams, influence, and lock-order tiebreak");
{
  // Bot-only teams get 0..5 base score from Rng
  const seenScores = new Set();
  let inRange = true;
  for (let s = 1; s <= 120; s++) {
    const botTeam = makeTeam(0, 4, { humans: 0, collab: 4 });
    const round = makeRound2();
    const tr = new SplitBriefTrial(Rng.seeded(s), Scenarios.MEDLINE_SPRINT_1);
    tr.deal([botTeam]);
    const res = tr.run(round, [botTeam]);
    const b = res[0].base;
    if (!Number.isInteger(b) || b < 0 || b > 5) inRange = false;
    seenScores.add(b);
  }
  expect("Bot-only team base score is integer 0 to 5 across seeds", inRange && seenScores.size === 6, [...seenScores].sort().join(","));

  // Stat influence breaks ties when base scores are equal
  {
    const highCollab = makeTeam(0, 4, { humans: 1, collab: 8 });
    const lowCollab = makeTeam(1, 4, { humans: 1, collab: 2 });
    const round = makeRound2();
    const tr = new SplitBriefTrial(Rng.seeded(505), Scenarios.MEDLINE_SPRINT_1);
    tr.deal([highCollab, lowCollab]);
    tr.setBoard(highCollab.members[0], ["D", "B"]);
    tr.setBoard(lowCollab.members[0], ["D", "B"]);
    tr.fireTwist();
    // lowCollab locks earlier post-twist, but highCollab has higher score after influence
    tr.lockIn(lowCollab.members[0]);
    tr.lockIn(highCollab.members[0]);
    const res = tr.run(round, [highCollab, lowCollab]);
    expect("Higher score after influence beats earlier lock-in", res[0].team === highCollab && res[0].score > res[1].score);
  }

  // Equal score after influence -> earlier post-twist lock-order wins every time
  {
    let lockWinsAll = true;
    for (let s = 1; s <= 25; s++) {
      const tA = makeTeam(0, 4, { humans: 1, collab: 4 });
      const tB = makeTeam(1, 4, { humans: 1, collab: 4 });
      const round = makeRound2();
      const tr = new SplitBriefTrial(Rng.seeded(s), Scenarios.MEDLINE_SPRINT_1);
      tr.deal([tA, tB]);
      tr.setBoard(tA.members[0], ["D", "B"]);
      tr.setBoard(tB.members[0], ["D", "B"]);
      tr.fireTwist();
      tr.lockIn(tB.members[0]);   // tB locks first post-twist (lockOrder 1)
      tr.lockIn(tA.members[0]);   // tA locks second post-twist (lockOrder 2)
      const res = tr.run(round, [tA, tB]);
      if (
        res[0].team !== tB || res[0].lockOrder !== 1 || res[0].postTwistLockOrder !== 1
        || res[1].postTwistLockOrder !== 2 || !tB.won || tA.won
      ) {
        lockWinsAll = false;
        break;
      }
    }
    expect("Tie after influence breaks to earliest post-twist lock-in across 25 seeds", lockWinsAll);
  }

  // (a) Post-twist Lock In beats pre-twist Lock In on a tie
  {
    let postBeatsPre = true;
    for (let s = 1; s <= 25; s++) {
      const tPre = makeTeam(0, 4, { humans: 1, collab: 4 });
      const tPost = makeTeam(1, 4, { humans: 1, collab: 4 });
      const round = makeRound2();
      const tr = new SplitBriefTrial(Rng.seeded(s + 300), Scenarios.MEDLINE_SPRINT_1);
      tr.deal([tPre, tPost]);
      tr.setBoard(tPre.members[0], ["D", "B"]);
      tr.setBoard(tPost.members[0], ["D", "B"]);
      tr.lockIn(tPre.members[0]);   // pre-twist (lockOrder 1, no post-twist lock-in)
      tr.fireTwist();
      tr.lockIn(tPost.members[0]);  // post-twist (lockOrder 2, postTwistLockOrder 2)
      const res = tr.run(round, [tPre, tPost]);
      if (
        res[0].team !== tPost || res[0].postTwistLockOrder !== 2
        || res[1].team !== tPre || res[1].postTwistLockOrder !== null
        || !tPost.won || tPre.won
      ) {
        postBeatsPre = false;
        break;
      }
    }
    expect("Post-twist Lock In beats pre-twist Lock In on a tie across 25 seeds", postBeatsPre);
  }

  // (b) Post-twist Lock In beats no Lock In on a tie
  {
    let lockedBeatsUnlocked = true;
    for (let s = 1; s <= 25; s++) {
      const tA = makeTeam(0, 4, { humans: 1, collab: 4 });
      const tB = makeTeam(1, 4, { humans: 1, collab: 4 });
      const round = makeRound2();
      const tr = new SplitBriefTrial(Rng.seeded(s + 100), Scenarios.MEDLINE_SPRINT_1);
      tr.deal([tA, tB]);
      tr.setBoard(tA.members[0], ["B", "D"]);
      tr.setBoard(tB.members[0], ["B", "D"]);
      tr.fireTwist();
      tr.lockIn(tB.members[0]);   // tA stays unlocked
      const res = tr.run(round, [tA, tB]);
      if (
        res[0].team !== tB || res[0].lockOrder !== 1 || res[0].postTwistLockOrder !== 1
        || res[1].lockOrder !== null || res[1].postTwistLockOrder !== null
        || !tB.won || tA.won
      ) {
        lockedBeatsUnlocked = false;
        break;
      }
    }
    expect("Post-twist Lock In beats no Lock In on a tie across 25 seeds", lockedBeatsUnlocked);
  }

  // (c) Two pre-twist Lock In teams go to random (both orders possible across seeds)
  {
    let noPostOrder = true;
    const winners = new Set();
    for (let s = 1; s <= 25; s++) {
      const tA = makeTeam(0, 4, { humans: 1, collab: 4 });
      const tB = makeTeam(1, 4, { humans: 1, collab: 4 });
      const round = makeRound2();
      const tr = new SplitBriefTrial(Rng.seeded(s + 400), Scenarios.MEDLINE_SPRINT_1);
      tr.deal([tA, tB]);
      tr.setBoard(tA.members[0], ["C", "D"]);
      tr.setBoard(tB.members[0], ["C", "D"]);
      tr.lockIn(tB.members[0]);   // tB locks first pre-twist
      tr.lockIn(tA.members[0]);   // tA locks second pre-twist
      tr.fireTwist();
      const res = tr.run(round, [tA, tB]);
      if (res[0].postTwistLockOrder !== null || res[1].postTwistLockOrder !== null) {
        noPostOrder = false;
        break;
      }
      winners.add(res[0].team.id);
    }
    expect("Tie between two pre-twist Lock In teams falls back to Rng", noPostOrder && winners.size === 2, [...winners].sort().join(","));
  }

  // Unlocked vs unlocked tiebreak uses Rng (both orders possible across seeds)
  {
    const winners = new Set();
    for (let s = 1; s <= 25; s++) {
      const tA = makeTeam(0, 4, { humans: 1, collab: 4 });
      const tB = makeTeam(1, 4, { humans: 1, collab: 4 });
      const round = makeRound2();
      const tr = new SplitBriefTrial(Rng.seeded(s + 200), Scenarios.MEDLINE_SPRINT_1);
      tr.deal([tA, tB]);
      tr.setBoard(tA.members[0], ["D", "B"]);
      tr.setBoard(tB.members[0], ["D", "B"]);
      const res = tr.run(round, [tA, tB]);
      winners.add(res[0].team.id);
    }
    expect("Tie between unlocked teams falls back to Rng", winners.size === 2, [...winners].sort().join(","));
  }
}

console.log("-- 7. Save and load (toJSON / fromJSON)");
{
  const teamsA = [
    makeTeam(0, 3, { humans: 2, collab: 5, prefix: "A0_" }),
    makeTeam(1, 4, { humans: 2, collab: 3, prefix: "A1_" }),
    makeTeam(2, 4, { humans: 0, collab: 4, prefix: "A2_" }),
  ];
  const byIdA = new Map(teamsA.flatMap(t => t.members).map(p => [p.id, p]));
  const roundA = makeRound2();
  const trA = new SplitBriefTrial(Rng.seeded(777), Scenarios.MEDLINE_SPRINT_1);
  trA.deal(teamsA);
  trA.postNote(teamsA[0].members[0], "Dashboard is required");
  trA.postNote(teamsA[1].members[0], "Import takes 2 days");
  trA.setBoard(teamsA[0].members[0], ["D", "B"]);
  trA.lockIn(teamsA[0].members[0]);
  trA.fireTwist();
  trA.setBoard(teamsA[1].members[1], ["B", "D"]);

  const jsonObj = trA.toJSON();
  const plainErr = plainProblem(jsonObj);
  expect("toJSON returns plain JSON-safe data", !plainErr, plainErr || "plain");

  const savedText = JSON.stringify(jsonObj);
  const parsed = JSON.parse(savedText);
  const playersB = [...byIdA.values()].map(p => Player.fromJSON(p.toJSON()));
  const byIdB = new Map(playersB.map(p => [p.id, p]));
  const teamsB = teamsA.map(t => Team.fromJSON(t.toJSON(), byIdB));
  const rngB = Rng.seeded(0);
  rngB.setState(trA.rng.getState());
  const trB = Trial.fromJSON(parsed, { rng: rngB, teams: teamsB, byId: byIdB });

  const p0B = byIdB.get(teamsA[0].members[0].id);
  const p1B = byIdB.get(teamsA[1].members[0].id);
  const sameMidState = JSON.stringify(trB.toJSON()) === savedText
    && trB.notesLeft(p0B) === 2
    && trB.isLocked(teamsB[0])
    && trB.postTwistLockOrderOf(teamsB[0]) === null
    && !trB.isLocked(teamsB[1])
    && trB.twistFired === true
    && JSON.stringify(trB.boardFor(teamsB[0])) === '["D","B"]'
    && JSON.stringify(trB.boardFor(teamsB[1])) === '["B","D"]';
  expect("Trial.fromJSON rebuilds identical mid-trial state", sameMidState);

  // Locking team 1 after load continues lockOrder at 2 on both
  const lockA = trA.lockIn(teamsA[1].members[0]);
  const lockB = trB.lockIn(p1B);
  expect(
    "Lock order counter continues accurately after load",
    lockA.lockOrder === 2 && lockB.lockOrder === 2
      && lockA.afterTwist === true && lockB.afterTwist === true
      && trA.postTwistLockOrderOf(teamsA[1]) === 2 && trB.postTwistLockOrderOf(teamsB[1]) === 2
  );

  // Running rank() on both with identical remaining RNG produces identical ranking
  const roundB = makeRound2();
  const rankA = trA.run(roundA, teamsA).map(r => ({ id: r.team.id, place: r.place, won: r.won, score: r.score, lockOrder: r.lockOrder, postTwistLockOrder: r.postTwistLockOrder }));
  const rankB = trB.run(roundB, teamsB).map(r => ({ id: r.team.id, place: r.place, won: r.won, score: r.score, lockOrder: r.lockOrder, postTwistLockOrder: r.postTwistLockOrder }));
  expect("Loaded trial produces the exact same ranking as original", JSON.stringify(rankA) === JSON.stringify(rankB));

  // Save and load after run() preserves ranking and closed state
  const afterRunSaved = JSON.stringify(trA.toJSON());
  const trAfter = Trial.fromJSON(JSON.parse(afterRunSaved), { rng: Rng.seeded(1), teams: teamsA, byId: byIdA });
  expect(
    "Post-run save/load preserves ranking and blocks further edits/notes",
    JSON.stringify(trAfter.toJSON()) === afterRunSaved
      && !trAfter.postNote(teamsA[0].members[1], "Too late").ok
      && !trAfter.setBoard(teamsA[2].members[0], ["D"]).ok
  );
}

console.log("-- 8. Per-game label and card order shuffle");
{
  const maps = new Set();
  const orders = new Set();
  let allScore5 = true;
  let allTasksValid = true;

  for (let s = 1; s <= 15; s++) {
    const t = makeTeam(0, 4, { humans: 1, collab: 4 });
    const round = makeRound2();
    const tr = new SplitBriefTrial(Rng.seeded(s), Scenarios.MEDLINE_SPRINT_1);
    tr.deal([t]);
    maps.add(JSON.stringify(tr.letterMap));
    orders.add(JSON.stringify(tr.cardOrder));

    const ids = tr.tasks.map(x => x.id);
    if (JSON.stringify(ids) !== '["A","B","C","D"]') allTasksValid = false;

    const expectedPost = Scenarios.MEDLINE_SPRINT_1.postTwistAnswer.map(id => tr.letterMap[id]);
    const expectedPre = Scenarios.MEDLINE_SPRINT_1.preTwistAnswer.map(id => tr.letterMap[id]);
    if (
      JSON.stringify(tr.postTwistAnswer) !== JSON.stringify(expectedPost) ||
      JSON.stringify(tr.preTwistAnswer) !== JSON.stringify(expectedPre)
    ) {
      allScore5 = false;
    }

    tr.setBoard(t.members[0], tr.postTwistAnswer);
    const res = tr.run(round, [t]);
    if (res[0].base !== 5) allScore5 = false;
  }

  expect("Different seeds produce different letter maps", maps.size > 1, "distinct=" + maps.size);
  expect("Different seeds produce different card deal orders", orders.size > 1, "distinct=" + orders.size);
  expect("Tasks keep sorted A-D ids after shuffle", allTasksValid);
  expect("Shuffled postTwistAnswer scores 5 under every map", allScore5);

  // Save/load preserves letterMap, cardOrder, tasks, answers, and card botNotes
  const tOrig = makeTeam(0, 3, { humans: 1, collab: 4 });
  const byIdOrig = new Map(tOrig.members.map(p => [p.id, p]));
  const trOrig = new SplitBriefTrial(Rng.seeded(919), Scenarios.MEDLINE_SPRINT_1);
  trOrig.deal([tOrig]);
  const saved = JSON.parse(JSON.stringify(trOrig.toJSON()));
  const pLoaded = tOrig.members.map(p => Player.fromJSON(p.toJSON()));
  const byIdLoaded = new Map(pLoaded.map(p => [p.id, p]));
  const tLoaded = Team.fromJSON(tOrig.toJSON(), byIdLoaded);
  const trLoaded = Trial.fromJSON(saved, { rng: Rng.seeded(0), teams: [tLoaded], byId: byIdLoaded });
  expect(
    "Save/load preserves letterMap, cardOrder, tasks, and postTwistAnswer",
    JSON.stringify(trLoaded.letterMap) === JSON.stringify(trOrig.letterMap) &&
      JSON.stringify(trLoaded.cardOrder) === JSON.stringify(trOrig.cardOrder) &&
      JSON.stringify(trLoaded.tasks) === JSON.stringify(trOrig.tasks) &&
      JSON.stringify(trLoaded.postTwistAnswer) === JSON.stringify(trOrig.postTwistAnswer) &&
      JSON.stringify(trLoaded.cardsFor(byIdLoaded.get(tOrig.members[0].id))) === JSON.stringify(trOrig.cardsFor(tOrig.members[0]))
  );

  // Bot notes use shuffled letters
  let botSeed = null;
  for (let s = 1; s <= 50; s++) {
    const trProbe = new SplitBriefTrial(Rng.seeded(s), Scenarios.MEDLINE_SPRINT_1);
    trProbe.deal([makeTeam(0, 4)]);
    const m = trProbe.letterMap;
    if (m.A !== "A" || m.C !== "C" || m.D !== "D") { botSeed = s; break; }
  }
  let now = 10000;
  const botTeam = makeTeam(0, 4, { humans: 0, collab: 4 });
  const g = new Game({ teams: [botTeam], rng: Rng.seeded(botSeed), clock: () => now, hooks: Bots.hooks });
  g.start();
  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  const trBot = new SplitBriefTrial(g.rng);
  g.setTrialForTest(trBot);
  g.advance();        // trial -> deals & shuffles
  for (let s = 1; s <= 35; s++) { now += 1000; g.tick(now); }
  const notesText = trBot.notesFor(botTeam).map(n => n.text).join("\n");
  const lm = trBot.letterMap;
  expect(
    "Bot notes use shuffled task letters",
    notesText.includes("(" + lm.D + ")") &&
      notesText.includes("(" + lm.C + ")") &&
      notesText.includes("(" + lm.A + ")"),
    JSON.stringify(lm)
  );
}

console.log("-- 9. Empty board Lock In check (Step 10)");
{
  const teams = [makeTeam(0, 4, { humans: 1 }), makeTeam(1, 4, { humans: 1 })];
  const g = new Game({ teams, rng: Rng.seeded(950) });
  g.start();
  g.startNextRound(); // L1 briefing
  g.advance();        // L1 openFloor
  g.advance();        // L1 sop
  g.closeSop();
  g.endTrial();
  g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance();
  g.computeEarnings(); g.placeAllRemaining(); g.finishRound();
  g.startNextRound(); // L2 briefing
  g.advance();        // L2 openFloor
  g.advance();        // L2 splitBrief
  const sb = g.splitBrief();
  const h0 = teams[0].members[0];
  const h1 = teams[1].members[0];

  const rEmptyTrial = sb.lockIn(h0);
  const rEmptyGame = g.splitBriefLockIn(h0);
  const unlockedAfterEmpty = !sb.isLocked(teams[0]);

  const tasks = sb.tasks.map(t => t.id);
  g.splitBriefSetBoard(h0, [tasks[0]]);
  const rOne = g.splitBriefLockIn(h0);

  g.splitBriefSetBoard(h1, [tasks[0], tasks[1]]);
  const rTwo = g.splitBriefLockIn(h1);

  expect(
    "Empty board lockIn is rejected by SplitBriefTrial and Game and stays unlocked",
    !rEmptyTrial.ok && !!rEmptyTrial.reason && !rEmptyGame.ok && !!rEmptyGame.reason && unlockedAfterEmpty
  );
  expect(
    "Lock in succeeds with 1 task or 2 tasks",
    rOne.ok && sb.isLocked(teams[0]) && rTwo.ok && sb.isLocked(teams[1])
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
