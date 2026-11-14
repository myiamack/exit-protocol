/* Part 5b cheese check. Bots play a strategy on purpose; we compare them to normal play.
   Run from the repo folder:  node Tests/check_cheese.js
   Normal play: random type mix (equal odds), typical spending, no team switching, normal teams.
   A strategy is flagged CHEESE? if it wins more than CHEESE_AT points above normal play.
   Win = graduate or finish the second path. 2,000 seeded games per setting.
     1. Hearts first: never pay trial costs with points. Earned points never go into the next
        level's attribute, so trial costs push it below 0 and hearts cover them.
        Half the players (random) do this; compared with the other half in the same games.
     2. Switcher: a Contrarian who switches to another team after every catch.
        Half the Contrarians (random) do this; compared with the other half.
     3. Same type: every player picks the same type. Compared with a random mix.
     4. Small teams: as many 3-person teams as possible. Run with and without a preview of the
        Part 6 small-team heart (not in the rules yet; applied by this script only). */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Trial", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

const GAMES = 2000;
const SEED = 1;
const CHEESE_AT = 3;
const TYPE_KEYS = ["coop", "indep", "contra"];

const NORMAL = { 16: [4, 4, 4, 4], 20: [4, 4, 4, 4, 4], 24: [4, 4, 4, 3, 3, 3, 3] };
const SMALL  = { 16: [4, 3, 3, 3, 3], 20: [5, 3, 3, 3, 3, 3], 24: [3, 3, 3, 3, 3, 3, 3, 3] };
const COUNTS = [16, 20, 24];

function seeded(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Hearts first: place points the typical way, but never in the blocked attribute
   (unless there is nowhere else to put them). */
function heartsFirstAllocate(p, n, block) {
  if (!block) return EP.Bots.allocate(p, n, false);
  const view = { attrs: p.attrs, type: p.type, max: k => (k === block ? p.attrs[block] : p.max(k)) };
  const alloc = EP.Bots.allocate(view, n, false);
  const placed = Object.values(alloc).reduce((s, x) => s + x, 0);
  if (placed < n) alloc[block] = (alloc[block] || 0) + (n - placed);
  return alloc;
}

/* Contrarian switcher: if the current team caught them, move to a team that has not,
   if one has room and the old team keeps 3. */
function switchAfterCatch(game, p, rng) {
  const from = game.teamOf(p);
  if (p.isStuck() || !p.wasCaughtBy(from.id)) return;
  const options = game.teams.filter(t => t !== from && !p.wasCaughtBy(t.id) &&
                                        t.size() < EP.Team.MAX && from.size() > EP.Team.MIN);
  if (options.length) game.switchTeam(p, options[Math.floor(rng() * options.length)]);
}

/* Preview of Part 6: +1 heart at round start for every active player on a team of 3 or fewer active. */
function smallTeamHeart(game) {
  for (const t of game.teams) {
    const active = t.active();
    if (active.length <= 3) active.forEach(p => p.hearts.refill(1));
  }
}

/* opts: { layout, typeOf(i, rng), tag(p, rng) -> strategy name, buff } */
function playGame(opts, rng) {
  const n = opts.layout.reduce((s, x) => s + x, 0);
  const players = Array.from({ length: n }, (_, i) => EP.Bots.makePlayer(i, "Bot " + i, opts.typeOf(i, rng)));
  players.forEach(p => { p.strategy = opts.tag ? opts.tag(p, rng) : "normal"; });
  let at = 0;
  const teams = opts.layout.map((size, i) => {
    const t = new EP.Team({ id: i, name: "Team " + i, members: players.slice(at, at + size) });
    at += size;
    return t;
  });
  const startSize = new Map(players.map(p => [p, teams.find(t => t.has(p)).size()]));
  const game = new EP.Game({ teams, rng });

  for (let level = 1; level <= 6; level++) {
    game.startNextRound();
    if (opts.buff) smallTeamHeart(game);
    for (const p of players) if (p.strategy === "switcher") switchAfterCatch(game, p, rng);
    EP.Bots.openFloor(game, rng);
    game.advance();
    EP.Bots.trial(game, rng);
    if (opts.onTrial) for (const t of teams) opts.onTrial(level, t);
    game.payTrialCosts();
    game.advance();
    EP.Bots.accusations(game, rng);
    game.endGlitchReport();
    game.advance();
    EP.Bots.gifts(game, rng);
    game.advance();
    game.lockIn();
    game.advance();
    game.computeEarnings();
    const next = EP.Round.LEVELS[game.level];
    for (const p of players) {
      if (p.isStuck()) continue;
      if (p.canCashOut()) game.cashOut(p);
      p.earned = Math.min(p.earned, p.roomLeft());
      p.placePoints(p.strategy === "heartsFirst" ? heartsFirstAllocate(p, p.earned, next && next.attr)
                                                  : EP.Bots.allocate(p, p.earned, false));
    }
    game.finishRound();
  }
  game.startNextRound();
  EP.Bots.graduation(game);
  return game.results().map(r => ({ p: r.player, startSize: startSize.get(r.player) }));
}

/* Run GAMES games and tally win / graduate / path / stuck by group(row) -> key. */
function run(opts, groupOf) {
  const rng = seeded(SEED), s = {};
  const add = (key, field, yes) => { s[key] = s[key] || {}; const c = s[key][field] = s[key][field] || [0, 0]; c[0] += yes ? 1 : 0; c[1] += 1; };
  for (let g = 0; g < GAMES; g++) {
    for (const row of playGame(opts, rng)) {
      for (const key of [].concat(groupOf(row))) {
        add(key, "win", row.p.wins()); add(key, "grad", row.p.graduates());
        add(key, "path", row.p.pathDone); add(key, "stuck", row.p.isStuck());
      }
    }
  }
  const pct = (key, f) => (s[key] && s[key][f] ? 100 * s[key][f][0] / s[key][f][1] : null);
  return { pct, n: key => (s[key] ? s[key].win[1] : 0) };
}

const randomType = (i, rng) => TYPE_KEYS[Math.floor(rng() * 3)];
const f1 = v => (v === null ? "  -  " : v.toFixed(1) + "%");
const verdict = d => (d > CHEESE_AT ? "CHEESE?" : "ok");
function line(cells, widths) { return cells.map((c, i) => String(c).padEnd(widths[i])).join(""); }

console.log("Cheese check. " + GAMES + " games per setting. CHEESE? = wins more than " + CHEESE_AT + " points above normal play.\n");

// Normal play, for reference.
const normal = {};
for (const n of COUNTS) normal[n] = run({ layout: NORMAL[n], typeOf: randomType }, r => ["all", r.p.type.key]);

// 1. Hearts first
console.log("=== 1. Hearts first (never pay trial costs with points) vs typical, same games ===");
const W = [9, 14, 9, 10, 9, 9, 8];
console.log(line(["Players", "Strategy", "Win", "Graduate", "Stuck", "Diff", ""], W));
for (const n of COUNTS) {
  const r = run({ layout: NORMAL[n], typeOf: randomType, tag: (p, rng) => (rng() < 0.5 ? "heartsFirst" : "typical") },
                row => row.p.strategy);
  const d = r.pct("heartsFirst", "win") - r.pct("typical", "win");
  console.log(line([n, "typical", f1(r.pct("typical", "win")), f1(r.pct("typical", "grad")), f1(r.pct("typical", "stuck")), "", ""], W));
  console.log(line(["", "hearts first", f1(r.pct("heartsFirst", "win")), f1(r.pct("heartsFirst", "grad")), f1(r.pct("heartsFirst", "stuck")),
                    (d >= 0 ? "+" : "") + d.toFixed(1), verdict(d)], W));
}

// 2. Contrarian switcher
console.log("\n=== 2. Contrarian switches teams after every catch vs Contrarian who stays, same games ===");
const W2 = [9, 10, 9, 10, 9, 9, 8];
console.log(line(["Players", "Strategy", "Win", "Graduate", "Exploit", "Diff", ""], W2));
for (const n of COUNTS) {
  const r = run({ layout: NORMAL[n], typeOf: randomType,
                  tag: (p, rng) => (p.type.canSabotage() ? (rng() < 0.5 ? "switcher" : "stays") : "other") },
                row => row.p.strategy);
  const d = r.pct("switcher", "win") - r.pct("stays", "win");
  console.log(line([n, "stays", f1(r.pct("stays", "win")), f1(r.pct("stays", "grad")), f1(r.pct("stays", "path")), "", ""], W2));
  console.log(line(["", "switcher", f1(r.pct("switcher", "win")), f1(r.pct("switcher", "grad")), f1(r.pct("switcher", "path")),
                    (d >= 0 ? "+" : "") + d.toFixed(1), verdict(d)], W2));
}

// 3. Same type
console.log("\n=== 3. Everyone picks the same type vs a random mix ===");
const W3 = [9, 16, 9, 10, 13, 9, 8];
console.log(line(["Players", "Lobby", "Win", "Graduate", "Second path", "Diff", ""], W3));
for (const n of COUNTS) {
  console.log(line([n, "random mix", f1(normal[n].pct("all", "win")), f1(normal[n].pct("all", "grad")), f1(normal[n].pct("all", "path")), "", ""], W3));
  for (const k of TYPE_KEYS) {
    const r = run({ layout: NORMAL[n], typeOf: () => k }, () => "all");
    const d = r.pct("all", "win") - normal[n].pct(k, "win");
    console.log(line(["", "all " + EP.CharacterType.get(k).name, f1(r.pct("all", "win")), f1(r.pct("all", "grad")), f1(r.pct("all", "path")),
                      (d >= 0 ? "+" : "") + d.toFixed(1), verdict(d)], W3));
  }
}
console.log("Diff = all-same lobby win minus that type's win in a random mix.");

// 4. Small teams
console.log("\n=== 4. As many 3-person teams as possible vs normal teams ===");
console.log("Small-team heart = preview of Part 6, applied by this script only.");
const W4 = [9, 18, 13, 9, 13, 13, 9, 8];
console.log(line(["Players", "Teams", "Small heart", "Win", "On 3-team", "On 4+ team", "Diff", ""], W4));
for (const n of COUNTS) {
  for (const buff of [false, true]) {
    const base = run({ layout: NORMAL[n], typeOf: randomType, buff }, r => ["all", r.startSize <= 3 ? "small" : "big"]);
    const small = run({ layout: SMALL[n], typeOf: randomType, buff }, r => ["all", r.startSize <= 3 ? "small" : "big"]);
    const d = small.pct("all", "win") - base.pct("all", "win");
    const heart = buff ? "on" : "off";
    console.log(line([n, NORMAL[n].join("/"), heart, f1(base.pct("all", "win")), f1(base.pct("small", "win")), f1(base.pct("big", "win")), "", ""], W4));
    console.log(line(["", SMALL[n].join("/"), heart, f1(small.pct("all", "win")), f1(small.pct("small", "win")), f1(small.pct("big", "win")),
                      (d >= 0 ? "+" : "") + d.toFixed(1), verdict(d)], W4));
  }
}
console.log("Diff = whole-lobby win with small teams minus normal teams. Team size is the size at the start.");

// 5. Trial win rate by team size and level (normal play, no small-team heart).
//    Levels 5-6 vote points are divided by active players, so team size should not matter.
console.log("\n=== 5. Trial win rate by team size (size when the trial runs) ===");
const LAYOUTS = [["24 players", NORMAL[24]], ["16 players", SMALL[16]], ["20 players", SMALL[20]]];
for (const [label, layout] of LAYOUTS) {
  const s = {};
  const onTrial = (level, t) => {
    const key = (level <= 4 ? "1-4" : "L" + level) + "|" + t.size();
    s[key] = s[key] || [0, 0]; s[key][0] += t.won ? 1 : 0; s[key][1] += 1;
  };
  const rng = seeded(SEED);
  for (let g = 0; g < GAMES; g++) playGame({ layout, typeOf: randomType, onTrial }, rng);
  const sizes = [...new Set(layout)].sort();
  const cell = (lv, size) => (s[lv + "|" + size] ? f1(100 * s[lv + "|" + size][0] / s[lv + "|" + size][1]) : "  -  ");
  console.log(label + " (" + layout.join("/") + ", " + Math.ceil(layout.length / 2) + " of " + layout.length + " teams win)");
  console.log("  " + "Levels".padEnd(10) + sizes.map(z => (z + "-person").padEnd(11)).join(""));
  for (const lv of ["1-4", "L5", "L6"]) console.log("  " + lv.replace("L", "Level ").padEnd(10) + sizes.map(z => cell(lv, z).padEnd(11)).join(""));
}
