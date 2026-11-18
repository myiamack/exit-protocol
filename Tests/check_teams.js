/* Part 11 team size report. Plays seeded bot games with the rules classes.
   Run from the repo folder:  node Tests/check_teams.js
   Settings: 16, 20 and 24 players. 1,000 games each. Typical bot spending.
   Each game: every player's type is picked at random with equal odds, then players are
   shuffled and dealt into teams as even as possible (16 = 4x4, 20 = 5x4, 24 = 7 teams: three of 4, four of 3).
   Report per player count: teams and sizes, graduation, win % by type, type gap, win % by team size.
   Target check: type gap 1 to 3 points. Anything outside is flagged FAIL.
   Report only. No rule or bot changes. */
const path = require("path");
const EP = require("../rules/index.js");   // ES modules (Part 12)

const GAMES = 1000;
const SEED = 11;
const TYPES = [["coop", "Cooperative"], ["indep", "Independent"], ["contra", "Contrarian"]];
const GAP_MIN = 1, GAP_MAX = 3;
const HEADCOUNTS = [
  { players: 16, teams: 4 },
  { players: 20, teams: 5 },
  { players: 24, teams: 7 },
];

function shuffle(a, rng) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* Even sizes: n players into k teams, sizes differ by at most 1, larger teams first. */
function evenSizes(n, k) {
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/* One game. Returns the results and each player's team size. */
function playGame(hc, rng) {
  const types = Array.from({ length: hc.players }, () => TYPES[Math.floor(rng() * 3)][0]);
  const players = shuffle(types.map((t, i) => EP.Bots.makePlayer(i, "Bot " + i, t)), rng);
  const sizes = evenSizes(hc.players, hc.teams);
  const sizeOf = new Map();
  let at = 0;
  const teams = sizes.map((size, i) => {
    const members = players.slice(at, at + size);
    at += size;
    members.forEach(p => sizeOf.set(p, size));
    return new EP.Team({ id: i, name: "Team " + i, members });
  });
  const game = new EP.Game({ teams, rng });
  const trialWins = new Map(teams.map(t => [t, 0]));

  for (let level = 1; level <= 6; level++) {
    game.startNextRound(); game.advance();
    EP.Bots.openFloor(game, rng);
    game.advance();
    EP.Bots.trial(game, rng);
    game.payTrialCosts();
    for (const t of teams) if (t.won) trialWins.set(t, trialWins.get(t) + 1);
    game.advance();
    EP.Bots.accusations(game, rng);
    game.endGlitchReport();
    game.advance();
    EP.Bots.gifts(game, rng);
    game.advance();
    game.lockIn();
    game.advance();
    game.computeEarnings();
    EP.Bots.statsUpdate(game);
    game.finishRound();
  }
  game.startNextRound(); game.advance();
  EP.Bots.graduation(game);
  return { results: game.results(), sizeOf, sizes, teams, trialWins };
}

function Tally() {
  const s = {};
  return {
    add(key, yes) { s[key] = s[key] || [0, 0]; s[key][0] += yes ? 1 : 0; s[key][1] += 1; },
    addN(key, yes, n) { s[key] = s[key] || [0, 0]; s[key][0] += yes; s[key][1] += n; },
    pct(key) { return s[key] && s[key][1] ? 100 * s[key][0] / s[key][1] : null; },
    n(key) { return s[key] ? s[key][1] : 0; },
  };
}
const fmt = v => (v === null ? "  -  " : v.toFixed(1) + "%");
const check = gap => (gap !== null && gap >= GAP_MIN && gap <= GAP_MAX ? "PASS" : "FAIL");

const started = Date.now();
const summary = [];

for (const hc of HEADCOUNTS) {
  const rng = EP.Rng.seeded(SEED);
  const t = Tally();
  const sizes = evenSizes(hc.players, hc.teams);
  const distinct = [...new Set(sizes)].sort((a, b) => b - a);

  for (let g = 0; g < GAMES; g++) {
    const r = playGame(hc, rng);
    for (const { player: p } of r.results) {
      const size = r.sizeOf.get(p);
      t.add("grad", p.graduates());
      t.add("win", p.wins());
      t.add("win_" + p.type.key, p.wins());
      t.add("size" + size + "_win", p.wins());
      t.add("size" + size + "_grad", p.graduates());
      t.add("size" + size + "_win_" + p.type.key, p.wins());
    }
    for (const team of r.teams) t.addN("size" + team.members.length + "_trials", r.trialWins.get(team), 6);
  }

  const wins = TYPES.map(([k]) => t.pct("win_" + k)).filter(v => v !== null);
  const gap = Math.max(...wins) - Math.min(...wins);
  summary.push({ players: hc.players, grad: t.pct("grad"), gap, result: check(gap) });

  const shape = distinct.map(s => sizes.filter(x => x === s).length + " of " + s).join(", ");
  console.log("=== " + hc.players + " players: " + hc.teams + " teams (" + shape + "), " + GAMES + " games ===");
  console.log("Graduation " + fmt(t.pct("grad")) + "   Overall win " + fmt(t.pct("win")));
  console.log("Win by type:");
  for (const [k, name] of TYPES) console.log("  " + name.padEnd(12) + fmt(t.pct("win_" + k)));
  console.log("Type gap " + gap.toFixed(1) + " points: " + check(gap) + (check(gap) === "FAIL" ? "  <-- outside the 1 to 3 goal" : ""));
  console.log("By team size:  Size  Players  Win      Graduate  Trials won  Coop win  Indep win  Contra win");
  for (const s of distinct) {
    const k = "size" + s;
    console.log("               " + String(s).padStart(4) + String(t.n(k + "_win")).padStart(9) + "  "
                + fmt(t.pct(k + "_win")).padEnd(9) + fmt(t.pct(k + "_grad")).padEnd(10) + fmt(t.pct(k + "_trials")).padEnd(12)
                + fmt(t.pct(k + "_win_coop")).padEnd(10) + fmt(t.pct(k + "_win_indep")).padEnd(11) + fmt(t.pct(k + "_win_contra")));
  }
  if (distinct.length > 1) {
    const ws = distinct.map(s => t.pct("size" + s + "_win"));
    console.log("Team size win spread " + (Math.max(...ws) - Math.min(...ws)).toFixed(1) + " points (largest minus smallest win %).");
  } else console.log("All teams the same size, so no size comparison.");
  console.log("");
}

console.log("=== Target check: type gap " + GAP_MIN + " to " + GAP_MAX + " points ===");
console.log("Players  Graduation  Gap    Result");
for (const r of summary) console.log(String(r.players).padEnd(9) + fmt(r.grad).padEnd(12) + r.gap.toFixed(1).padEnd(7) + r.result);
console.log("\nFull run time: " + ((Date.now() - started) / 1000).toFixed(1) + " seconds.");
