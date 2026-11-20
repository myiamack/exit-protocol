/* Bot behavior tests for SplitBriefTrial via Game hooks (Step 4).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_split_bots.js */
const EP = require("../rules/index.js");
const { Bots, Game, Rng, Scenarios, Team, Trial } = EP;
const { SplitBriefTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function setupGame(seed, { startAt = 10000, botsPerTeam = 3, stuckMask = null, idleMask = null } = {}) {
  const T = { now: startAt };
  const teams = [0, 1, 2, 3].map(ti => {
    const members = Array.from({ length: 4 }, (_, j) => {
      const p = Bots.makePlayer(ti * 4 + j, "T" + ti + "_P" + j, "coop");
      p.isBot = j >= (4 - botsPerTeam);
      p.setAttrsForTest({ focus: 4, initiative: 4, collab: 5, composure: 4, grit: 4 });
      if (stuckMask && stuckMask(ti, j)) p.glitches = 2;
      if (idleMask && idleMask(ti, j)) p.idle = true;
      return p;
    });
    return new Team({ id: ti, name: "Team " + ti, members });
  });
  const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now, hooks: Bots.hooks });
  g.start();
  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  const trial = new SplitBriefTrial(g.rng);
  g.setTrialForTest(trial);
  g.advance();        // trial (deals cards, starts 180s splitBrief timer)
  return { g, T, teams, trial };
}

console.log("-- 1. Every bot card note posted by 30s, matches botNote, posterName is bot's name");
{
  const { g, T, teams, trial } = setupGame(101);
  for (let s = 1; s <= 30; s++) {
    T.now += 1000;
    g.tick(T.now);
  }
  let allPresent = true;
  let allMatch = true;
  let count = 0;
  for (const team of teams) {
    const notes = trial.notesFor(team);
    for (const p of team.members) {
      if (!p.isBot) continue;
      const cards = trial.cardsFor(p);
      const byBot = notes.filter(n => n.posterId === p.id);
      if (byBot.length !== cards.length) allPresent = false;
      for (const c of cards) {
        const found = byBot.find(n => n.text === c.botNote && n.posterName === p.name);
        if (!found) allMatch = false;
        else count++;
      }
    }
  }
  expect("All bot card notes posted by 30s", allPresent && count > 0, "notes=" + count);
  expect("Every note text matches botNote and posterName matches bot name", allMatch);
  expect("Bots never edit the board or lock in", teams.every(t => trial.boardFor(t).length === 0 && !trial.isLocked(t)));
}

console.log("-- 2. Twist held by a bot: twist note posted between 90s and 100s");
{
  const { g, T, teams, trial } = setupGame(202, { botsPerTeam: 4 });
  let firstTwistNoteAt = null;
  const twistText = Scenarios.MEDLINE_SPRINT_1.twist.botNote;
  const postedTimes = [];

  for (let s = 1; s <= 105; s++) {
    T.now += 1000;
    g.tick(T.now);
    for (const team of teams) {
      for (const n of trial.notesFor(team)) {
        if (n.text === twistText && !postedTimes.some(x => x.team === team.id)) {
          postedTimes.push({ team: team.id, sec: s, posterId: n.posterId });
          if (firstTwistNoteAt === null) firstTwistNoteAt = s;
        }
      }
    }
  }

  expect("No twist note posted before 90s", firstTwistNoteAt !== null && firstTwistNoteAt >= 90, "firstAt=" + firstTwistNoteAt + "s");
  expect(
    "All 4 bot teams posted twist note between 90s and 100s",
    postedTimes.length === 4 && postedTimes.every(x => x.sec >= 90 && x.sec <= 100)
  );
  const allHoldersMatch = postedTimes.every(x => {
    const p = g.players.find(q => q.id === x.posterId);
    return p && trial.twistFor(p) !== null;
  });
  expect("Twist note poster is the bot holding the twist", allHoldersMatch);
}

console.log("-- 3. Bot holding 3 cards: 2 before twist, 1 spare; twist holder uses spare for twist");
{
  // Team 0 has 2 active bots (j=2,3) and 2 stuck players (j=0,1) -> 5 cards split 3 and 2.
  let seedWithTwist = null;
  let seedWithoutTwist = null;
  for (let seed = 1; seed < 200 && (!seedWithTwist || !seedWithoutTwist); seed++) {
    const { g, T, teams, trial } = setupGame(seed, {
      botsPerTeam: 2,
      stuckMask: (ti, j) => ti === 0 && j < 2,
    });
    const threeCardBot = teams[0].members.find(p => p.isBot && trial.cardsFor(p).length === 3);
    if (!threeCardBot) continue;
    T.now += 90000;
    g.tick(T.now);
    if (trial.twistFor(threeCardBot)) {
      if (!seedWithTwist) seedWithTwist = seed;
    } else {
      if (!seedWithoutTwist) seedWithoutTwist = seed;
    }
  }

  // Case A: 3-card bot gets the twist
  {
    const { g, T, teams, trial } = setupGame(seedWithTwist, {
      botsPerTeam: 2,
      stuckMask: (ti, j) => ti === 0 && j < 2,
    });
    const bot3 = teams[0].members.find(p => p.isBot && trial.cardsFor(p).length === 3);
    for (let s = 1; s <= 89; s++) { T.now += 1000; g.tick(T.now); }
    const beforeTwist = trial.notesFor(teams[0]).filter(n => n.posterId === bot3.id);
    expect(
      "3-card bot posts 2 card notes before twist and keeps 1 spare",
      beforeTwist.length === 2 && trial.notesLeft(bot3) === 1
    );

    for (let s = 90; s <= 100; s++) { T.now += 1000; g.tick(T.now); }
    const afterTwist = trial.notesFor(teams[0]).filter(n => n.posterId === bot3.id);
    const twistText = Scenarios.MEDLINE_SPRINT_1.twist.botNote;
    expect(
      "3-card bot with twist uses its spare note for the twist note",
      afterTwist.length === 3 && trial.notesLeft(bot3) === 0 && afterTwist.some(n => n.text === twistText)
    );
  }

  // Case B: 3-card bot does NOT get the twist
  {
    const { g, T, teams, trial } = setupGame(seedWithoutTwist, {
      botsPerTeam: 2,
      stuckMask: (ti, j) => ti === 0 && j < 2,
    });
    const bot3 = teams[0].members.find(p => p.isBot && trial.cardsFor(p).length === 3);
    for (let s = 1; s <= 89; s++) { T.now += 1000; g.tick(T.now); }
    const beforeTwist = trial.notesFor(teams[0]).filter(n => n.posterId === bot3.id);
    for (let s = 90; s <= 100; s++) { T.now += 1000; g.tick(T.now); }
    const afterTwist = trial.notesFor(teams[0]).filter(n => n.posterId === bot3.id);
    const cardTexts = new Set(trial.cardsFor(bot3).map(c => c.botNote));
    expect(
      "3-card bot without twist uses its spare note for its 3rd card",
      beforeTwist.length === 2 && afterTwist.length === 3 && trial.notesLeft(bot3) === 0 && afterTwist.every(n => cardTexts.has(n.text))
    );
  }
}

console.log("-- 4. Save at 15s, wake at 40s: no duplicate notes, all card notes present");
{
  const { g, T, teams } = setupGame(404);
  const startAt = T.now;
  T.now += 15000; // 15s
  g.tick(T.now);
  const saved = JSON.parse(JSON.stringify(g.toJSON()));

  const wakeClock = { now: startAt + 40000 }; // 40s
  const g2 = Game.fromJSON(saved, { clock: () => wakeClock.now, hooks: Bots.hooks });
  const t2 = g2.round.trial;

  let noDupes = true;
  let allPresent = true;
  for (const team of g2.teams) {
    const notes = t2.notesFor(team);
    const seen = new Set();
    for (const n of notes) {
      const k = n.posterId + ":" + n.text;
      if (seen.has(k)) noDupes = false;
      seen.add(k);
    }
    for (const p of team.members) {
      if (!p.isBot) continue;
      const cards = t2.cardsFor(p);
      const byBot = notes.filter(n => n.posterId === p.id);
      if (byBot.length !== cards.length) allPresent = false;
    }
  }
  expect("Save at 15s, wake at 40s: no duplicate notes and all card notes present", noDupes && allPresent);
  expect("Bots still never edited board or locked in after reload", teams.every((_, i) => t2.boardFor(g2.teams[i]).length === 0 && !t2.isLocked(g2.teams[i])));
}

console.log("-- 5. Same seed gives the same note times every run");
{
  function recordNoteSeconds(seed) {
    const { g, T, teams, trial } = setupGame(seed, { botsPerTeam: 4 });
    const startAt = T.now;
    const events = [];
    const seen = new Set();
    for (let s = 1; s <= 110; s++) {
      T.now = startAt + s * 1000;
      g.tick(T.now);
      for (const team of teams) {
        for (const n of trial.notesFor(team)) {
          const k = team.id + ":" + n.posterId + ":" + n.text;
          if (!seen.has(k)) {
            seen.add(k);
            events.push({ sec: s, team: team.id, posterId: n.posterId, text: n.text });
          }
        }
      }
    }
    return events;
  }
  const run1 = recordNoteSeconds(505);
  const run2 = recordNoteSeconds(505);
  expect("Same seed produces identical note times and order", run1.length > 0 && JSON.stringify(run1) === JSON.stringify(run2));
}

console.log("-- 6. Stuck and idle bots do nothing");
{
  const { g, T, teams, trial } = setupGame(606, {
    botsPerTeam: 4,
    stuckMask: (ti, j) => ti === 0 && j === 1,
    idleMask: (ti, j) => ti === 0 && j === 2,
  });
  for (let s = 1; s <= 110; s++) { T.now += 1000; g.tick(T.now); }
  const t0Notes = trial.notesFor(teams[0]);
  const stuckBot = teams[0].members[1];
  const idleBot = teams[0].members[2];
  expect(
    "Stuck and idle bots post 0 notes",
    t0Notes.every(n => n.posterId !== stuckBot.id && n.posterId !== idleBot.id) &&
      trial.notesLeft(stuckBot) === 3 &&
      trial.notesLeft(idleBot) === 3
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
