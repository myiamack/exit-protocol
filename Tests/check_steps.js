/* Spot test: Game refuses calls made in the wrong step.
   Run from the repo folder:  node Tests/check_steps.js */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Trial", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;
const NO = () => 0.999;   // rng that never fires an ability (below 10)

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
  expect("Sabotage on own team allowed before being caught", EP.Sabotage.apply(r1, c, v, tA, NO).ok);
  const acc = EP.Accusation.apply(r1, v, c, tA, NO);
  expect("Correct accusation catches the Contrarian", acc.ok && acc.correct && c.caughtThisRound);
  expect("Caught list holds team A only", c.caughtBy.join(",") === "A", c.caughtBy.join(","));
  expect("Caught Contrarian loses 0 points", c.total() === 24, c.total());
  // Game.endGlitchReport credits Exploit only if not caughtThisRound.
  expect("Caught round gives no Skim", c.takeSkim() === 0);
  // Part 5b: the next round, no sabotage on any team.
  c.resetRoundFlags();
  expect("Next round: sabotage blocked flag is on", c.sabotageBlockedThisRound === true);
  const r2 = new EP.Round(2);
  const again = EP.Sabotage.apply(r2, c, v, tA, NO);
  expect("Next round: blocked on team A", !again.ok, again.reason);
  // Switch teams: leave A, join B.
  tA.members.splice(tA.members.indexOf(c), 1);
  const tB = new EP.Team({ id: "B", name: "B", members: [c, ...ps.slice(4)] });
  const onB = EP.Sabotage.apply(r2, c, ps[4], tB, NO);
  expect("Next round: blocked on team B too (any team)", !onB.ok && /any team/.test(onB.reason), onB.reason);
  // The round after: old rule. A still refused, B allowed.
  c.resetRoundFlags();
  expect("Round after: block is off", c.sabotageBlockedThisRound === false);
  const r3 = new EP.Round(3);
  const onA3 = EP.Sabotage.check(c, v, tA);
  expect("Round after: still refused on team A (caught there)", !!onA3, onA3);
  expect("Round after: sabotage allowed on team B", EP.Sabotage.apply(r3, c, ps[4], tB, NO).ok);
  expect("Exploit still counts after being caught", c.creditPath(EP.CharacterType.PATH_EVENTS.uncaughtSabotage) && c.pathProgress === 1, c.pathProgress);
  expect("Uncaught round gives Skim", c.takeSkim() === 1);
  // Caught again on team B: no points lost, Exploit stays, blocked again next round.
  const before = c.total();
  const accB = EP.Accusation.apply(r3, ps[4], c, tB, NO);
  expect("Caught on team B: 0 points lost", accB.correct && c.total() === before, before + " -> " + c.total());
  expect("Caught list now holds A and B", c.caughtBy.join(",") === "A,B", c.caughtBy.join(","));
  expect("Exploit never lost after a second catch", c.pathProgress === 1, c.pathProgress);
  c.resetRoundFlags();
  expect("Blocked again the round after the second catch", c.sabotageBlockedThisRound === true);
  c.resetRoundFlags();
}

// Part 5b: wrong accusation tie order Focus, Collaboration, Initiative, Grit, Composure.
{
  const c = EP.Bots.makePlayer(200, "T", "contra");
  const tieCase = (label, attrs, want) => {
    Object.assign(c.attrs, attrs);
    c.takeFromHighest(1);
    const lost = Object.keys(attrs).filter(k => c.attrs[k] === attrs[k] - 1);
    expect("Wrong accusation tie order: " + label, lost.length === 1 && lost[0] === want, lost.join(","));
  };
  tieCase("all equal -> Focus",        { focus: 4, collab: 4, initiative: 4, grit: 4, composure: 4 }, "focus");
  tieCase("Collab = Initiative -> Collaboration", { focus: 3, collab: 6, initiative: 6, grit: 6, composure: 4 }, "collab");
  tieCase("Initiative = Grit -> Initiative",      { focus: 3, collab: 3, initiative: 6, grit: 6, composure: 4 }, "initiative");
  tieCase("Grit = Composure -> Grit",             { focus: 1, collab: 1, initiative: 1, grit: 4, composure: 4 }, "grit");
  tieCase("Highest wins over order -> Composure", { focus: 1, collab: 1, initiative: 1, grit: 2, composure: 4 }, "composure");
}

// Part 4b: stat abilities. "at" makes an rng that always returns x.
{
  const at = x => () => x;
  const set = (p, a) => { p.attrs = { focus: 5, initiative: 5, collab: 5, composure: 5, grit: 5, ...a }; };
  const ps = ["coop", "coop", "indep", "contra", "coop", "coop", "coop", "coop"].map((t, i) => EP.Bots.makePlayer(200 + i, "S" + i, t));
  const [a, b, ind, con] = ps;
  const team = new EP.Team({ id: "S", name: "S", members: ps.slice(0, 4) });

  set(a, { focus: -2 }); expect("Negative stat counts as 0", a.abilityValue("focus") === 0);
  set(a, { focus: 12 }); expect("Stat above 10 counts as 10", a.abilityValue("focus") === 10);
  set(a, { focus: 6 });
  expect("Own screen line: 'Focus 6: 60% safe accusation'", a.abilityLines()[0].text === "Focus 6: 60% safe accusation", a.abilityLines()[0].text);
  throws("An ability roll without the seeded rng is refused", () => a.rollAbility("focus"));

  // Focus: wrong accusation. Focus 6 = 60%.
  let r = new EP.Round(1); let t0 = a.total();
  let acc = EP.Accusation.apply(r, a, b, team, at(0.59));
  expect("Focus 6, roll 0.59: wrong accusation costs nothing", acc.safe && a.total() === t0);
  a.accusedThisRound = false; r = new EP.Round(1); t0 = a.total();
  acc = EP.Accusation.apply(r, a, b, team, at(0.61));
  expect("Focus 6, roll 0.61: wrong accusation costs 1", !acc.safe && a.total() === t0 - 1);

  // Collaboration: free gift. Collab 3 = 30%.
  set(a, { collab: 3 }); set(b, { composure: 2 });
  r = new EP.Round(1);
  let g = EP.Gift.apply(r, a, b, team, 2, at(0.29));
  expect("Collab 3, roll 0.29: gift costs 0 hearts", g.ok && g.free && a.hearts.count === 3, a.hearts.count);
  EP.Gift.decline(r, g.gift);
  expect("Declined free gift refunds nothing", a.hearts.count === 3, a.hearts.count);
  g = EP.Gift.apply(r, a, b, team, 2, at(0.31));
  expect("Collab 3, roll 0.31: gift costs 2 hearts", g.ok && !g.free && a.hearts.count === 1, a.hearts.count);
  EP.Gift.decline(r, g.gift);
  g = EP.Gift.apply(r, a, ind, team, 1, at(0));
  expect("Refused gift: no Collaboration roll, nothing spent", g.refused && !g.free && a.hearts.count === 3);
  // Free gift that overflows: no refund (it cost nothing).
  set(b, { focus: 10, collab: 10, initiative: b.max("initiative"), grit: 10, composure: 10 });
  a.hearts.spend(1);
  g = EP.Gift.apply(r, a, b, team, 1, at(0));
  EP.Gift.accept(r, g.gift);
  expect("Free gift that cannot land refunds nothing", g.free && a.hearts.count === 2, a.hearts.count);
  a.hearts.refill();

  // Composure: drain. Composure 6 = 60%.
  set(b, { composure: 6 });
  expect("Composure 6, roll 0.59: drain 1", EP.Sabotage.drain(b, at(0.59)) === 1);
  expect("Composure 6, roll 0.61: drain 2", EP.Sabotage.drain(b, at(0.61)) === 2);
  set(b, { composure: 9 });
  expect("Old rule gone: Composure 9, roll 0.95: drain 2", EP.Sabotage.drain(b, at(0.95)) === 2);

  // Grit: Grit 10 = 50%.
  set(a, { grit: 10 });
  expect("Grit 10, roll 0.49: extra heart", a.rollAbility("grit", at(0.49)));
  expect("Grit 10, roll 0.51: no extra heart", !a.rollAbility("grit", at(0.51)));

  // Initiative: vote points x (1 + Initiative / 10).
  const vt = [0, 1].map(i => new EP.Team({ id: "V" + i, name: "V" + i, members: ps.slice(4 + i * 2, 6 + i * 2) }));
  const tm = [new EP.Team({ id: "W", name: "W", members: [ps[0]] }), ...vt];
  set(ps[0], { initiative: 5 });
  const v = new EP.Vote(tm, at(0.5));
  v.cast(ps[0], [ps[4], ps[5], ps[6]]);
  const tl = v.tally();
  const tot = name => tl.find(x => x.team.name === name).total;
  expect("Initiative 5: 1st+2nd = (3+2) x 1.5 = 7.5, 3rd = 1 x 1.5 = 1.5", tot("V0") === 7.5 && tot("V1") === 1.5, tot("V0") + " / " + tot("V1"));

  // Light influence: 0.5 x (team average minus all teams' average), Levels 1-4.
  const i1 = new EP.Team({ id: "I1", name: "I1", members: ps.slice(4, 6) });
  const i2 = new EP.Team({ id: "I2", name: "I2", members: ps.slice(6, 8) });
  set(ps[4], { grit: 8 }); set(ps[5], { grit: 6 }); set(ps[6], { grit: 2 }); set(ps[7], { grit: -1 });
  const inf = EP.Trial.influence(new EP.Round(1), [i1, i2]);   // averages 7 and 1, all 4
  expect("Influence: +1.5 and -1.5 (negative grit counts as 0)", inf.get(i1) === 1.5 && inf.get(i2) === -1.5, inf.get(i1) + " / " + inf.get(i2));
  const at2 = new EP.Trial.AutoTrial(at(0.5)).run(new EP.Round(2), [i1, i2]);
  expect("AutoTrial: base is a whole number 0 to 7, score = base + influence",
         at2.every(x => Number.isInteger(x.base) && x.base >= 0 && x.base <= 7 && x.score === x.base + x.influence));
  const sop = new EP.Trial.SopTrial(at(0.5)); sop.setScore(i2, 7); sop.setScore(i1, 5);
  const sr = sop.run(new EP.Round(1), [i1, i2]);
  expect("SOP score includes influence: 5 + 1.5 = 6.5 beats 7 - 1.5 = 5.5", sr[0].team === i1 && sr[0].score === 6.5, sr.map(x => x.score).join(" / "));
}

// Part 5: team switching in Open Floor. Teams stay 3 to 5 members. Sabotaged this round = no switch.
{
  const ps = ["contra", "coop", "coop", "indep",            // A: 4
              "coop", "coop", "indep", "coop", "coop",      // B: 5
              "contra", "coop", "indep"]                    // C: 3
    .map((t, i) => EP.Bots.makePlayer(100 + i, "S" + i, t));
  const A = new EP.Team({ id: 10, name: "Team A", members: ps.slice(0, 4) });
  const B = new EP.Team({ id: 11, name: "Team B", members: ps.slice(4, 9) });
  const C = new EP.Team({ id: 12, name: "Team C", members: ps.slice(9) });
  const g = new EP.Game({ teams: [A, B, C], rng: NO });
  g.startNextRound();

  refusedResult("Switch to your own team", g.switchTeam(ps[1], A));
  refusedResult("Switch into a full team (5)", g.switchTeam(ps[1], B));
  refusedResult("Switch out of a team of 3", g.switchTeam(ps[10], A));
  expect("Contrarian sabotages a teammate", g.sabotage(ps[0], ps[1]).ok);
  refusedResult("Saboteur switches the same round", g.switchTeam(ps[0], C));

  const r = g.switchTeam(ps[1], C);
  expect("Switch from 4 to 3 is allowed", r.ok, r.reason);
  expect("Player moved: A has 3, C has 4", A.size() === 3 && C.size() === 4, A.size() + " / " + C.size());
  expect("teamId and teamOf follow the switch", ps[1].teamId === C.id && g.teamOf(ps[1]) === C);
  refusedResult("Switch out of A now that it has 3", g.switchTeam(ps[2], C));

  g.advance();
  refusedResult("Switch during Trial", g.switchTeam(ps[11], A));

  // Caught by team A, then switch: sabotage allowed again on the new team.
  const stuck = ps[7]; stuck.glitches = 2;
  const g2 = new EP.Game({ teams: [A, B, C], rng: NO });
  g2.startNextRound();
  refusedResult("Stuck player switches", g2.switchTeam(stuck, A));
  expect("Move back to A (A 4, C 3)", g2.switchTeam(ps[1], A).ok);
  ps[0].markCaughtBy(A.id);
  refusedResult("Caught Contrarian sabotages on the team that caught them", g2.sabotage(ps[0], ps[2]));
  expect("Caught Contrarian switches to C", g2.switchTeam(ps[0], C).ok);
  expect("Sabotage allowed on the new team", g2.sabotage(ps[0], ps[10]).ok);
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
