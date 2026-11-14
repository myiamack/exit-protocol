/* Spot test: Game refuses calls made in the wrong step.
   Run from the repo folder:  node Tests/check_steps.js */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Trial", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}
function refusedResult(label, r) { expect(label, r && r.ok === false, r && r.reason); }
function throws(label, fn) {
  try { fn(); expect(label, false, "was allowed"); }
  catch (e) { expect(label, true, e.message); }
}

// One Contrarian on team 0 so sabotage is possible.
const types = ["contra", "coop", "coop", "indep", "coop", "coop", "indep", "coop"];
const players = types.map((t, i) => EP.Bots.makePlayer(i, "P" + i, t));
const teams = [0, 1].map(i => new EP.Team({ id: i, name: "Team " + i, members: players.slice(i * 4, i * 4 + 4) }));
const game = new EP.Game({ teams, rng: () => 0.5 });
const [contra, mate] = players;

game.startNextRound();
expect("Round starts in Open Floor", game.step === "openFloor", game.step);
refusedResult("Accuse during Open Floor", game.accuse(mate, contra));
throws("Pay trial costs during Open Floor", () => game.payTrialCosts());
expect("Sabotage during Open Floor is allowed", game.sabotage(contra, mate).ok);
expect("Gift during Open Floor is allowed", game.gift(players[2], mate, 1).ok);

game.advance();
expect("Advance moves to Trial", game.step === "trial", game.step);
refusedResult("Sabotage during Trial", game.sabotage(contra, mate));
refusedResult("Accuse during Trial", game.accuse(mate, contra));
refusedResult("Gift during Trial", game.gift(players[2], mate, 1));
throws("Pay costs before the trial runs", () => game.payTrialCosts());
throws("Advance before trial costs are paid", () => game.advance());
throws("Vote on a level that is not judged", () => game.startVote());
expect("Level 1 ranks every team", game.runTrial().length === teams.length);
throws("Run the trial twice", () => game.runTrial());
game.payTrialCosts();
throws("Pay trial costs twice", () => game.payTrialCosts());

game.advance();
expect("Accuse during Glitch Report is allowed", game.accuse(mate, contra).ok);
throws("Advance before the Glitch Report is closed", () => game.advance());
game.endGlitchReport();
refusedResult("Accuse after the Glitch Report closed", game.accuse(players[2], contra));

game.advance();
throws("Lock-in during the Gift window", () => game.lockIn());
game.advance();
game.lockIn();
game.advance();
expect("Reaches Stats Update", game.step === "statsUpdate", game.step);
refusedResult("Cash Out before earnings", game.cashOut(players[3]));
throws("Advance past Stats Update", () => game.advance());
throws("Start the next round before finishing this one", () => game.startNextRound());
game.computeEarnings();
throws("Finish the round before points are placed", () => game.finishRound());

// Trials: ranked list, top half win (rounded up).
{
  const W = EP.Trial.winners;
  expect("Winners: 4 teams -> 2, 5 -> 3, 7 -> 4", W(4) === 2 && W(5) === 3 && W(7) === 4, [W(4), W(5), W(7)].join(","));

  const SOP = ["a", "b", "c", "d", "e", "f"], END = "loop";
  const sc = EP.Trial.SopTrial.score;
  expect("SOP score: all 6 right, endless step out = 7", sc(SOP, SOP, END).score === 7);
  expect("SOP score: endless step included = right steps only", sc([...SOP.slice(0, 4), END], SOP, END).score === 4);
  expect("SOP score: nothing placed = 0 (not counted as leaving it out)", sc([], SOP, END).score === 0);

  const ts = [0, 1, 2, 3].map(i => new EP.Team({ id: i, name: "S" + i, members: [EP.Bots.makePlayer(100 + i, "s" + i, "coop")] }));
  const sop = new EP.Trial.SopTrial(() => 0.5);
  [3, 7, 1, 5].forEach((s, i) => sop.setScore(ts[i], s));
  const r = sop.run(new EP.Round(1), ts);
  expect("SOP ranks by score (7, 5, 3, 1) and the top 2 win",
         r.map(x => x.score).join(",") === "7,5,3,1" && r.map(x => x.won).join(",") === "true,true,false,false",
         r.map(x => x.team.name + ":" + x.score).join(" "));

  const auto = new EP.Trial.AutoTrial(Math.random).run(new EP.Round(2), ts);
  expect("AutoTrial: 4 teams, exactly 2 win", auto.filter(x => x.won).length === 2);

  // Judged, 5 teams of 1. Totals a8 c8 e5 d5 b4. d and e tie at the cutoff; e has a first place, d has none.
  const ps = ["a", "b", "c", "d", "e"].map((n, i) => EP.Bots.makePlayer(200 + i, n, "coop"));
  const jts = ps.map((p, i) => new EP.Team({ id: 10 + i, name: p.name.toUpperCase(), members: [p] }));
  const jt = new EP.Trial.JudgedTrial(() => 0.5);
  const v = jt.startVote(jts);
  const [a, b, c, d, e] = ps;
  [[a, [b, c, d]], [b, [a, c, e]], [c, [a, d, e]], [d, [e, a, c]], [e, [c, d, b]]]
    .forEach(([voter, rank]) => v.cast(voter, rank));
  const jr = jt.run(new EP.Round(5), jts);
  expect("Judged: 5 teams, 3 win; cutoff tie goes to more first places",
         jr.map(x => x.team.name).join("") === "ACEDB" && jr.filter(x => x.won).length === 3,
         jr.map(x => x.team.name + ":" + x.total + "/" + x.firsts + (x.won ? "W" : "")).join(" "));
}

// Part 4: caught Contrarian. Caught by a team = no sabotage while on that team. Exploit never lost.
{
  const ps = ["contra", "coop", "coop", "coop", "indep", "coop", "coop"].map((t, i) => EP.Bots.makePlayer(100 + i, "C" + i, t));
  const [c, v] = ps;
  const tA = new EP.Team({ id: "A", name: "A", members: ps.slice(0, 4) });
  const r1 = new EP.Round(1);
  expect("Sabotage on own team allowed before being caught", EP.Sabotage.apply(r1, c, v, tA).ok);
  const acc = EP.Accusation.apply(r1, v, c, tA);
  expect("Correct accusation catches the Contrarian", acc.ok && acc.correct && c.caughtThisRound);
  expect("Caught list holds team A only", c.caughtBy.join(",") === "A", c.caughtBy.join(","));
  expect("Caught Contrarian loses 0 points", c.total() === 24, c.total());
  // Game.endGlitchReport credits Exploit only if not caughtThisRound.
  expect("Caught round gives no Skim", c.takeSkim() === 0);
  c.resetRoundFlags();
  const r2 = new EP.Round(2);
  const again = EP.Sabotage.apply(r2, c, v, tA);
  expect("Cannot sabotage team A again", !again.ok, again.reason);
  // Switch teams: leave A, join B.
  tA.members.splice(tA.members.indexOf(c), 1);
  const tB = new EP.Team({ id: "B", name: "B", members: [c, ...ps.slice(4)] });
  expect("On team B, sabotage is allowed again", EP.Sabotage.apply(r2, c, ps[4], tB).ok);
  expect("Exploit still counts after being caught", c.creditPath(EP.CharacterType.PATH_EVENTS.uncaughtSabotage) && c.pathProgress === 1, c.pathProgress);
  expect("Uncaught round gives Skim", c.takeSkim() === 1);
}

// Hearts: only its own methods change the count.
{
  const h = new EP.Hearts();
  expect("Hearts start at 3", h.count === 3, h.count);
  try { h.count = 99; } catch (e) { /* strict mode throws; either way it must not change */ }
  expect("Setting hearts.count directly does nothing", h.count === 3, h.count);
  expect("Spend more than you have is refused", h.spend(4) === false && h.count === 3, h.count);
  h.spend(2); h.refill(); h.refund(5);
  expect("Refill and refund stop at the cap of 3", h.count === 3, h.count);
  h.lose(5);
  expect("Lose never goes below 0", h.count === 0, h.count);
  h.refill(); h.empty();
  expect("Empty sets hearts to 0", h.count === 0, h.count);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
