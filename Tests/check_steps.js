/* Spot test: Game refuses calls made in the wrong step.
   Run from the repo folder:  node Tests/check_steps.js */
const path = require("path");
["Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Game", "bots"]
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
throws("Pay costs before every team has a result", () => game.payTrialCosts());
throws("Advance before trial costs are paid", () => game.advance());
teams.forEach(t => game.setTrialResult(t, true));
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
