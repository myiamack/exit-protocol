/* Timing and save/load tests for SplitBriefTrial in Game (Step 3).
   Fixed seeds throughout (Rng.seeded). Never uses Math.random.
   Run from the repo folder:  node Tests/check_split_timing.js */
const EP = require("../rules/index.js");
const { Bots, Game, Rng, Team, Trial } = EP;
const { SplitBriefTrial } = Trial;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}

function setupSplitBriefGame(seed, startAt = 10000) {
  const T = { now: startAt };
  const teams = [0, 1, 2, 3].map(i => {
    const members = Array.from({ length: 4 }, (_, j) => {
      const p = Bots.makePlayer(i * 4 + j, "T" + i + "_P" + j, "coop");
      p.isBot = j > 0;
      p.setAttrsForTest({ focus: 4, initiative: 4, collab: 5, composure: 4, grit: 4 });
      return p;
    });
    return new Team({ id: i, name: "Team " + i, members });
  });
  const g = new Game({ teams, rng: Rng.seeded(seed), clock: () => T.now });
  g.start();
  g.startNextRound(); // Level 1 briefing
  g.advance();        // openFloor
  const trial = new SplitBriefTrial(g.rng);
  g.setTrialForTest(trial);
  g.advance();        // trial (deals cards, starts 180s splitBrief timer)
  return { g, T, teams, trial };
}

console.log("-- 1. Timer is 180s, Attendance active, twist fires at 90s and only once");
{
  const { g, T, teams, trial } = setupSplitBriefGame(101);
  expect("TIMER_SECONDS.splitBrief is 180", Game.TIMER_SECONDS.splitBrief === 180);
  expect("splitBrief timer starts at 180s", g.timer && g.timer.name === "splitBrief" && g.secondsLeft(T.now) === 180);
  expect("Cards are dealt on entering trial step", trial.dealt && teams.every(t => t.members.reduce((n, p) => n + trial.cardsFor(p).length, 0) === 5));
  expect("Attendance is not paused during splitBrief trial", g.players.every(p => !p.attendancePaused));
  expect("Twist deadline saved as absolute timestamp (now + 90s)", trial.twistDeadline === T.now + 90000);

  T.now += 89000;
  g.tick(T.now);
  expect("Twist has not fired at 89s", !trial.twistFired);

  T.now += 1000; // 90s
  const closedAt90 = g.tick(T.now);
  const holdersAt90 = g.players.filter(p => trial.twistFor(p) !== null).map(p => p.id);
  const rngAfter90 = g.rng.getState();
  expect("Twist fires at 90s and trial stays open", trial.twistFired && holdersAt90.length === 4 && closedAt90.length === 0 && !g.didRun("runTrial"));

  T.now += 30000; // 120s
  g.tick(T.now);
  const holdersAt120 = g.players.filter(p => trial.twistFor(p) !== null).map(p => p.id);
  expect("Twist fires only once", JSON.stringify(holdersAt90) === JSON.stringify(holdersAt120) && g.rng.getState() === rngAfter90);
}

console.log("-- 2. Early close when all teams lock in at 30s (twist fires first)");
{
  const { g, T, teams, trial } = setupSplitBriefGame(202);
  T.now += 30000; // 30s
  trial.setBoard(teams[0].members[0], ["D", "B"]);
  trial.setBoard(teams[1].members[0], ["B", "D"]);
  for (let i = 0; i < 3; i++) {
    const r = trial.lockIn(teams[i].members[0]);
    expect("Partial lock-in (" + (i + 1) + "/4) keeps trial open", r.ok && !trial.twistFired && !g.didRun("runTrial"));
  }
  const last = trial.lockIn(teams[3].members[0]);
  const holders = g.players.filter(p => trial.twistFor(p) !== null);
  expect(
    "Last team lock-in at 30s fires twist then closes trial immediately",
    last.ok && last.closed === true && trial.twistFired && holders.length === 4 && g.didRun("runTrial") && trial.ranking !== null && g.timer === null
  );
  const paid = g.payTrialCosts();
  expect("Trial costs can be paid after early close", paid.size === 16);
}

console.log("-- 3. Timer end at 180s closes trial and pays trial costs");
{
  const { g, T, teams, trial } = setupSplitBriefGame(303);
  trial.setBoard(teams[0].members[0], ["D", "B"]);
  T.now += 180000; // 180s
  const closed = g.tick(T.now);
  expect(
    "tick at 180s closes splitBrief, fires twist, and runs trial",
    JSON.stringify(closed) === '["splitBrief"]' && trial.twistFired && g.didRun("runTrial") && trial.ranking !== null && g.timer === null
  );
  const beforeGrits = g.players.map(p => p.attrs.grit);
  const paid = g.payTrialCosts();
  const afterGrits = g.players.map(p => p.attrs.grit);
  g.advance();
  expect(
    "payTrialCosts applies cost and advances to glitchReport",
    paid.size === 16 && afterGrits.every((v, i) => v === beforeGrits[i] - 2) && g.step === "glitchReport"
  );
}

console.log("-- 4. Save at 60s, wake at 100s: twist fired, trial still open");
{
  const { g, T, trial } = setupSplitBriefGame(404);
  const startAt = T.now;
  T.now += 60000; // 60s
  g.tick(T.now);
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  expect("Saved trial stores twistDeadline as absolute ms", saved.round.trialState.twistDeadline === startAt + 90000);

  const wakeClock = { now: startAt + 100000 }; // 100s
  const g2 = Game.fromJSON(saved, { clock: () => wakeClock.now });
  const t2 = g2.round.trial;
  const holders = g2.players.filter(p => t2.twistFor(p) !== null);
  expect(
    "Wake at 100s fires twist and keeps trial open with 80s left",
    t2.twistFired && holders.length === 4 && g2.step === "trial" && !g2.didRun("runTrial") && g2.secondsLeft(wakeClock.now) === 80
  );
}

console.log("-- 5. Save at 60s, wake at 200s: twist fired first, then trial closed");
{
  const { g, T } = setupSplitBriefGame(505);
  const startAt = T.now;
  T.now += 60000; // 60s
  g.tick(T.now);
  const saved = JSON.parse(JSON.stringify(g.toJSON()));

  const wakeClock = { now: startAt + 200000 }; // 200s
  const g2 = Game.fromJSON(saved, { clock: () => wakeClock.now });
  const t2 = g2.round.trial;
  const holders = g2.players.filter(p => t2.twistFor(p) !== null);
  expect(
    "Wake at 200s fires twist first, then closes trial",
    t2.twistFired && holders.length === 4 && g2.didRun("runTrial") && t2.ranking !== null && g2.timer === null
  );
  const paid = g2.payTrialCosts();
  expect("Trial costs can be paid after caught-up close", paid.size === 16);
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
