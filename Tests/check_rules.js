/* Balance check for the rules classes. Plays bot games with the final rules.
   Run from the repo folder:  node Tests/check_rules.js
   Target after playtest round 2 (grad total 24, Exploit 3, At risk 3): about 52.3% overall graduation,
   gap between types about 2.1 points (seed 1), with a 50% coin flip per team.
   Part 3 (trials rank teams, top half win): 51.6% overall, gap 2.8 (seed 1). */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Trial", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

const GAMES = 1000;
const SEED = 1;

// Seeded random numbers, so every run gives the same result.
function seeded(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = seeded(SEED);

const stats = {};
const count = (key, yes) => { stats[key] = stats[key] || [0, 0]; stats[key][0] += yes ? 1 : 0; stats[key][1] += 1; };
const pct = key => (100 * stats[key][0] / stats[key][1]).toFixed(1) + "%";

for (let g = 0; g < GAMES; g++) {
  // 16 players: 8 Cooperative, 5 Independent, 3 Contrarian, shuffled into 4 teams of 4.
  const types = [...Array(8).fill("coop"), ...Array(5).fill("indep"), ...Array(3).fill("contra")];
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const players = types.map((t, i) => EP.Bots.makePlayer(i, "Bot " + i, t));
  const teams = [0, 1, 2, 3].map(i => new EP.Team({ id: i, name: "Team " + i, members: players.slice(i * 4, i * 4 + 4) }));
  const game = new EP.Game({ teams, rng });

  for (let level = 1; level <= 6; level++) {
    game.startNextRound();
    EP.Bots.openFloor(game, rng);      // 1. Open Floor
    game.advance();
    EP.Bots.trial(game, rng);          // 2. Trial result (50% win)
    game.payTrialCosts();              //    Trial cost
    game.advance();
    EP.Bots.accusations(game, rng);    // 3. Glitch Report
    game.endGlitchReport();            //    Exploit credit
    game.advance();
    EP.Bots.gifts(game, rng);          // 4. Gift window
    game.advance();
    game.lockIn();                     // 5. Lock-in
    game.advance();
    game.computeEarnings();            // 6. Stats Update
    EP.Bots.statsUpdate(game);
    game.finishRound();
  }
  game.startNextRound();               // 7. Graduation
  EP.Bots.graduation(game);

  for (const r of game.results()) {
    const p = r.player;
    count("grad", p.graduates());
    count("stuck", p.isStuck());
    count("win_" + p.type.key, p.wins());
    count("grad_" + p.type.key, p.graduates());
    count("path_" + p.type.key, p.pathDone);
  }
}

console.log("Games: " + GAMES + "  (16 players, 4 teams, top half win each trial, 1-in-3 guessing)\n");
console.log("Overall graduation:  " + pct("grad") + "   target about 59% (16 players, Part 4b)");
console.log("Stuck:               " + pct("stuck") + "\n");
console.log("Type          Win      Graduate   Second path");
for (const [t, n] of [["coop", "Cooperative"], ["indep", "Independent"], ["contra", "Contrarian"]]) {
  console.log(n.padEnd(13) + pct("win_" + t).padEnd(9) + pct("grad_" + t).padEnd(11) + pct("path_" + t));
}
const wins = ["coop", "indep", "contra"].map(t => 100 * stats["win_" + t][0] / stats["win_" + t][1]);
const gap = Math.max(...wins) - Math.min(...wins);
console.log("\nGap between types: " + gap.toFixed(1) + " points  (target: 1 to 3)");
