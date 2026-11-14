/* Part 4c balance report. Plays seeded bot games with the rules classes.
   Run from the repo folder:  node Tests/check_balance.js
   Settings: 16, 20 and 24 players x typical and aware spending. 2,000 games each.
   Every player's type is picked at random with equal odds, new each game.
   Target check: type gap (win % by type, highest minus lowest) of 1 to 3 points. PASS or FAIL.
   Games are also grouped by Contrarian count, so extreme mixes do not hide in the average. */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Trial", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

const GAMES = 2000;
const SEED = 1;
const TYPES = [["coop", "Cooperative"], ["indep", "Independent"], ["contra", "Contrarian"]];
const GAP_MIN = 1, GAP_MAX = 3;
const MIN_GROUP_GAMES = 50;   // smaller Contrarian groups are shown but marked "few games"

const HEADCOUNTS = [
  { players: 16, teams: [4, 4, 4, 4] },
  { players: 20, teams: [4, 4, 4, 4, 4] },
  { players: 24, teams: [4, 4, 4, 3, 3, 3, 3] },
];
const SPENDING = ["typical", "aware"];

// Seeded random numbers, so every run gives the same result.
function seeded(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Aware spending: half the earned points (rounded up) go to the next level's attribute,
   as far as its max allows. The rest are placed the typical way. */
function awareAllocate(p, n, nextAttr) {
  const alloc = {};
  let toNext = nextAttr ? Math.min(Math.ceil(n / 2), p.max(nextAttr) - p.attrs[nextAttr]) : 0;
  if (toNext > 0) { alloc[nextAttr] = toNext; p.attrs[nextAttr] += toNext; }
  const rest = EP.Bots.allocate(p, n - toNext, false);
  if (toNext > 0) p.attrs[nextAttr] -= toNext;   // allocate() only reads attrs; placePoints adds them
  for (const k in rest) alloc[k] = (alloc[k] || 0) + rest[k];
  return alloc;
}

function statsUpdate(game, spending) {
  if (spending === "typical") return EP.Bots.statsUpdate(game);
  const next = EP.Round.LEVELS[game.level];   // the next level (index = level number - 1)
  const nextAttr = next ? next.attr : null;
  for (const p of game.players) {
    if (!p.isBot || p.isStuck()) continue;
    if (p.canCashOut()) game.cashOut(p);
    p.earned = Math.min(p.earned, p.roomLeft());
    p.placePoints(awareAllocate(p, p.earned, nextAttr));
  }
}

/* One game. Returns per-player results plus sabotage and Level 1 numbers. */
function playGame(hc, spending, rng) {
  const types = Array.from({ length: hc.players }, () => TYPES[Math.floor(rng() * 3)][0]);
  const players = types.map((t, i) => EP.Bots.makePlayer(i, "Bot " + i, t));
  let at = 0;
  const teams = hc.teams.map((size, i) => {
    const t = new EP.Team({ id: i, name: "Team " + i, members: players.slice(at, at + size) });
    at += size;
    return t;
  });
  const game = new EP.Game({ teams, rng });
  const out = { sabotages: 0, caught: 0, l1Won: new Map(), laterWins: new Map() };
  teams.forEach(t => out.laterWins.set(t, 0));

  for (let level = 1; level <= 6; level++) {
    game.startNextRound();
    EP.Bots.openFloor(game, rng);
    game.advance();
    EP.Bots.trial(game, rng);
    game.payTrialCosts();
    for (const t of teams) {
      if (level === 1) out.l1Won.set(t, t.won);
      else if (t.won) out.laterWins.set(t, out.laterWins.get(t) + 1);
    }
    game.advance();
    EP.Bots.accusations(game, rng);
    game.endGlitchReport();
    for (const s of game.round.sabotages) { out.sabotages += 1; if (s.actor.caughtThisRound) out.caught += 1; }
    game.advance();
    EP.Bots.gifts(game, rng);
    game.advance();
    game.lockIn();
    game.advance();
    game.computeEarnings();
    statsUpdate(game, spending);
    game.finishRound();
  }
  game.startNextRound();
  EP.Bots.graduation(game);
  out.results = game.results();
  out.contras = types.filter(t => t === "contra").length;
  return out;
}

/* Tally helpers: [yes, total] pairs. */
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
/* Type gap: highest win % by type minus lowest. Types with no players are left out. */
function gapOf(t, prefix = "") {
  const wins = TYPES.map(([k]) => t.pct(prefix + "win_" + k)).filter(v => v !== null);
  return wins.length < 2 ? null : Math.max(...wins) - Math.min(...wins);
}
const check = gap => (gap !== null && gap >= GAP_MIN && gap <= GAP_MAX ? "PASS" : "FAIL");

function record(t, r, prefix = "") {
  for (const { player: p } of r.results) {
    t.add(prefix + "grad", p.graduates());
    t.add(prefix + "stuck", p.isStuck());
    t.add(prefix + "win_" + p.type.key, p.wins());
    t.add(prefix + "grad_" + p.type.key, p.graduates());
    t.add(prefix + "path_" + p.type.key, p.pathDone);
  }
}

const summary = [];
const pooled = {};   // spending -> Tally over all headcounts

for (const spending of SPENDING) {
  pooled[spending] = Tally();
  for (const hc of HEADCOUNTS) {
    const rng = seeded(SEED);
    const t = Tally();
    const groups = new Map();   // Contrarian count -> Tally
    for (let g = 0; g < GAMES; g++) {
      const r = playGame(hc, spending, rng);
      record(t, r);
      record(pooled[spending], r);
      if (!groups.has(r.contras)) groups.set(r.contras, { tally: Tally(), games: 0 });
      const grp = groups.get(r.contras);
      grp.games += 1;
      record(grp.tally, r);
      t.addN("caught", r.caught, r.sabotages);
      for (const [team, won] of r.l1Won) t.addN(won ? "later_l1win" : "later_l1lose", r.laterWins.get(team), 5);
    }

    const gap = gapOf(t);
    summary.push({ spending, players: hc.players, grad: t.pct("grad"), gap, result: check(gap) });

    console.log("=== " + hc.players + " players (" + hc.teams.length + " teams: " + hc.teams.join("/") + "), "
                + spending + " spending, " + GAMES + " games ===");
    console.log("Graduation " + fmt(t.pct("grad")) + "   Stuck " + fmt(t.pct("stuck"))
                + "   Sabotages caught " + fmt(t.pct("caught")) + " of " + t.n("caught"));
    console.log("Later trials (Levels 2-6) won: Level 1 winners " + fmt(t.pct("later_l1win"))
                + ", Level 1 losers " + fmt(t.pct("later_l1lose")));
    console.log("Type          Win      Graduate   Second path");
    for (const [k, name] of TYPES) {
      console.log("  " + name.padEnd(12) + fmt(t.pct("win_" + k)).padEnd(9) + fmt(t.pct("grad_" + k)).padEnd(11) + fmt(t.pct("path_" + k)));
    }
    console.log("Type gap " + gap.toFixed(1) + " points: " + check(gap));
    console.log("By Contrarian count:  Contras  Games  Coop win  Indep win  Contra win  Gap");
    for (const c of [...groups.keys()].sort((a, b) => a - b)) {
      const { tally: gt, games } = groups.get(c);
      const gg = gapOf(gt);
      const note = games < MIN_GROUP_GAMES ? "  (few games)" : "";
      console.log("                      " + String(c).padStart(7) + String(games).padStart(7)
                  + fmt(gt.pct("win_coop")).padStart(10) + fmt(gt.pct("win_indep")).padStart(11)
                  + fmt(gt.pct("win_contra")).padStart(12)
                  + (gg === null ? "    -" : (gg.toFixed(1)).padStart(6) + " " + check(gg)) + note);
    }
    console.log("");
  }
}

console.log("=== Target check: type gap " + GAP_MIN + " to " + GAP_MAX + " points ===");
console.log("Spending  Players  Graduation  Gap    Result");
for (const s of SPENDING) {
  for (const r of summary.filter(x => x.spending === s)) {
    console.log(s.padEnd(10) + String(r.players).padEnd(9) + fmt(r.grad).padEnd(12) + r.gap.toFixed(1).padEnd(7) + r.result);
  }
  const g = gapOf(pooled[s]);
  console.log(s.padEnd(10) + "all".padEnd(9) + fmt(pooled[s].pct("grad")).padEnd(12) + g.toFixed(1).padEnd(7) + check(g));
}
