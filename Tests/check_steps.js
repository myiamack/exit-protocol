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

  // Collaboration: gift costs 1 heart less, never below 1. Collab 3 = 30%. Giver a is Cooperative (1 per point).
  set(a, { collab: 3 }); set(b, { composure: 2 });
  r = new EP.Round(1);
  let g = EP.Gift.apply(r, a, b, team, 2, at(0.29));
  expect("Collab 3, roll 0.29: 2-point gift costs 1 heart (2 - 1)", g.ok && g.discount && g.cost === 1 && a.hearts.count === 2, a.hearts.count);
  EP.Gift.decline(r, g.gift);
  expect("Declined discounted gift refunds the 1 heart paid", a.hearts.count === 3, a.hearts.count);
  g = EP.Gift.apply(r, a, b, team, 1, at(0.29));
  expect("Discount never goes below 1: 1-point gift still costs 1", g.discount && g.cost === 1 && a.hearts.count === 2, a.hearts.count);
  EP.Gift.decline(r, g.gift);
  g = EP.Gift.apply(r, a, b, team, 2, at(0.31));
  expect("Collab 3, roll 0.31: gift costs 2 hearts", g.ok && !g.discount && a.hearts.count === 1, a.hearts.count);
  EP.Gift.decline(r, g.gift);
  g = EP.Gift.apply(r, a, ind, team, 1, at(0));
  expect("Refused gift: no Collaboration roll, nothing spent", g.refused && !g.discount && a.hearts.count === 3);
  // Independent giver: 1 point costs 2 -> 1, 2 points cost 3 -> 2.
  set(ind, { collab: 3 });
  g = EP.Gift.apply(r, ind, b, team, 1, at(0));
  expect("Independent 1-point gift with discount: 2 -> 1 heart", g.cost === 1 && ind.hearts.count === 2, ind.hearts.count);
  EP.Gift.decline(r, g.gift);
  g = EP.Gift.apply(r, ind, b, team, 2, at(0));
  expect("Independent 2-point gift with discount: 3 -> 2 hearts", g.cost === 2 && ind.hearts.count === 1, ind.hearts.count);
  EP.Gift.decline(r, g.gift);
  // Discounted gift that overflows: refund what was paid, never more.
  set(b, { focus: 10, collab: 10, initiative: b.max("initiative"), grit: 10, composure: 10 });
  g = EP.Gift.apply(r, a, b, team, 2, at(0));
  EP.Gift.accept(r, g.gift);
  expect("Discounted gift that cannot land refunds the 1 paid, not 2", g.cost === 1 && g.gift.overflow === 2 && a.hearts.count === 3, a.hearts.count);
  // 0 hearts: no gift, even with a lucky roll.
  a.hearts.empty();
  const zero = EP.Gift.apply(r, a, b, team, 1, at(0));
  expect("0 hearts: gift refused, even when the discount would fire", !zero.ok, zero.reason);
  a.hearts.refill(3);

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

// Part 5b: vote points divided by active players. 5-person team B vs 3-person team S; team X votes.
{
  const mk = (n, i) => { const p = EP.Bots.makePlayer(300 + i, n, "coop"); p.attrs.initiative = 0; return p; };   // weight 1
  const bs = [0, 1, 2, 3, 4].map(i => mk("b" + i, i));
  const ss = [0, 1, 2].map(i => mk("s" + i, 5 + i));
  const xs = [0, 1, 2].map(i => mk("x" + i, 8 + i));
  const mkTeams = () => [new EP.Team({ id: "B", name: "B", members: bs }),
                         new EP.Team({ id: "S", name: "S", members: ss }),
                         new EP.Team({ id: "X", name: "X", members: xs })];
  // Ballots: B gets 3+3+4 = 10 points, S gets 3+3+2 = 8.
  const ballots = [[xs[0], [ss[0], bs[0], bs[1]]], [xs[1], [ss[1], bs[2], bs[3]]], [xs[2], [bs[4], ss[2], bs[0]]]];
  const tallyWith = (before) => {
    const tm = mkTeams(), v = new EP.Vote(tm, () => 0.5);
    ballots.forEach(([voter, r]) => v.cast(voter, r));
    if (before) before();
    return v.tally();
  };
  const row = (tl, n) => tl.find(x => x.team.name === n);
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const show = tl => tl.map(x => x.team.name + ":" + x.total + "/(" + x.active + "x" + x.voters + ")=" + x.score.toFixed(3)).join(" ");

  // 11 active players. B: 5 active, 6 possible voters. S: 3 active, 8 possible voters.
  let tl = tallyWith();
  expect("5 vs 3: B voters 6, S voters 8", row(tl, "B").voters === 6 && row(tl, "S").voters === 8, show(tl));
  expect("5 vs 3: B 10 / (5 x 6) = 0.333, S 8 / (3 x 8) = 0.333",
         near(row(tl, "B").score, 1 / 3) && near(row(tl, "S").score, 1 / 3), show(tl));
  expect("5 vs 3: equal score, tie goes to more first places (S 2, B 1)", tl.map(x => x.team.name).join("") === "SBX", show(tl));
  expect("5 vs 3: top half win (3 teams -> 2): S and B", row(tl, "S").won && row(tl, "B").won && !row(tl, "X").won);

  // Initiative still applies to each voter's points before the division. x2 Initiative 10 = weight 2.
  tl = tallyWith(() => { xs[2].attrs.initiative = 10; });
  expect("Initiative first, then divide: B (3+3+8) / 30 = 0.467 beats S (3+3+4) / 24 = 0.417",
         row(tl, "B").total === 14 && near(row(tl, "B").score, 14 / 30) && near(row(tl, "S").score, 10 / 24) &&
         tl[0].team.name === "B", show(tl));
  xs[2].attrs.initiative = 0;

  // Stuck players do not count, as members or as voters. B with 2 Stuck: 3 active, 6 voters (S 3 + X 3).
  tl = tallyWith(() => { bs[3].glitches = 2; bs[4].glitches = 2; });
  expect("Stuck not counted: B 10 / (3 x 6) = 0.556 beats S 8 / (3 x 6) = 0.444",
         row(tl, "B").active === 3 && row(tl, "S").voters === 6 && near(row(tl, "B").score, 10 / 18) &&
         tl[0].team.name === "B", show(tl));
  bs[3].glitches = 0; bs[4].glitches = 0;

  // A team with no active players scores 0.
  tl = tallyWith(() => { ss.forEach(p => { p.glitches = 2; }); });
  expect("Team with no active players scores 0", row(tl, "S").score === 0, show(tl));
  ss.forEach(p => { p.glitches = 0; });
}

// Levels 5-6: submissions and vote.
{
  const JT = EP.Trial.JudgedTrial;
  // 3 teams of 3, all bots. Play Levels 1-4 with the usual bot rules, then stop at Level 5's Trial.
  function judgedGame({ host = false, seed = 7 } = {}) {
    let a = seed;   // seeded random numbers (same generator as check_balance.js)
    const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ps = Array.from({ length: 9 }, (_, i) => EP.Bots.makePlayer(300 + i, "J" + i, ["coop", "indep", "contra"][i % 3]));
    const ts = [0, 1, 2].map(i => new EP.Team({ id: "J" + i, name: "Team J" + i, members: ps.slice(i * 3, i * 3 + 3) }));
    const g = new EP.Game({ teams: ts, rng, host });
    g.startNextRound(); g.level = 4; g.round = null;   // jump straight to Level 5
    g.startNextRound(); g.advance();                   // Open Floor > Trial
    return { g, ps, ts };
  }

  // Prompts: 10 per level, from the rules code.
  expect("10 prompts each for Levels 5 and 6", JT.prompts(5).length === 10 && JT.prompts(6).length === 10);

  // No host: the engine picks one at random from the list.
  {
    const { g } = judgedGame();
    refusedResult("No host: setPrompt is refused", g.setPrompt(0));
    const pr = g.startWriting();
    expect("No host: random prompt from the Level 5 list", !pr.custom && JT.prompts(5)[pr.index] === pr.text, pr.text);
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => judgedGame({ seed: s }).g.startWriting().index));
    expect("No host: different seeds pick different prompts", picks.size > 1, [...picks].join(","));
  }

  // Host: custom prompt saved on the game record, not added to the list.
  {
    const { g } = judgedGame({ host: true });
    throws("Host: writing cannot start before a prompt is picked", () => g.startWriting());
    refusedResult("Host: empty custom prompt is refused", g.setPrompt("   "));
    refusedResult("Host: custom prompt of 201 characters is refused", g.setPrompt("p".repeat(201)));
    expect("Host: custom prompt of exactly 200 characters is accepted", g.setPrompt("p".repeat(200)).ok);
    expect("Host: list pick works", g.setPrompt(3).ok && g.round.trial.prompt.text === JT.prompts(5)[3]);
    expect("Host: custom prompt replaces the pick", g.setPrompt("What did you learn this week?").ok);
    g.startWriting();
    const rec = g.prompts[0];
    expect("Custom prompt saved on the game record",
           g.prompts.length === 1 && rec.custom === true && rec.text === "What did you learn this week?" && rec.level === 5,
           JSON.stringify(rec));
    expect("Custom prompt not added to the list",
           JT.prompts(5).length === 10 && !JT.prompts(5).includes("What did you learn this week?"));
    refusedResult("Prompt cannot change after writing starts", g.setPrompt(1));
  }

  // 300 character limit.
  {
    const { g, ps } = judgedGame();
    g.startWriting();
    refusedResult("Submission of 301 characters is refused", g.submit(ps[0], "x".repeat(301)));
    refusedResult("Empty submission is refused", g.submit(ps[0], "   "));
    expect("Submission of exactly 300 characters is accepted", g.submit(ps[0], "x".repeat(300)).ok);
    refusedResult("Second submission by the same player is refused", g.submit(ps[0], "again"));
    const t = g.typeSubmission(ps[1], "y".repeat(301));
    expect("Counter: 301 characters shows 1 over", t.tooLong && t.left === -1, JSON.stringify(t));
  }

  // Early close: writing closes when every active player has submitted. Stuck players are not waited for.
  {
    const { g, ps } = judgedGame();
    ps[8].glitches = 2;   // Stuck
    g.startWriting();
    refusedResult("Stuck player cannot submit", g.submit(ps[8], "hi"));
    let last;
    for (const p of ps.slice(0, 7)) { last = g.submit(p, "answer " + p.name); }
    expect("Writing still open with one active player left", g.round.trial.writing === "open" && !last.closed);
    throws("Vote cannot start while writing is open", () => g.startVote());
    last = g.submit(ps[7], "last one");
    expect("Writing closes early when every active player has submitted",
           last.ok && last.closed === true && g.round.trial.writing === "closed");
    refusedResult("Submit after writing closed is refused", g.submit(ps[8], "late"));
  }

  // No submission: cannot be ranked, can still vote.
  {
    const { g, ps } = judgedGame();
    const quiet = ps[0];   // Team J0, never submits
    g.startWriting();
    ps.slice(1).forEach(p => g.submit(p, "answer"));
    expect("Writing stays open until the timer ends if someone has not submitted", g.round.trial.writing === "open");
    g.closeWriting();      // the 3-minute timer ran out
    const v = g.startVote();
    const voter = ps[3];   // Team J1
    expect("No submission: not in anyone's choices", !v.choicesFor(voter).includes(quiet));
    refusedResult("No submission: ranking them is refused", v.cast(voter, [quiet, ps[1], ps[6]]));
    expect("No submission: they can still vote", v.cast(quiet, [ps[3], ps[4], ps[6]]).ok);
    const tl = g.runTrial();
    expect("Vote runs and ranks every team", tl.length === 3 && tl.filter(x => x.won).length === 2,
           tl.map(x => x.team.name + ":" + x.total.toFixed(1)).join(" "));
  }

  // Bots submit "Bot answer" so tests still run the vote.
  {
    const { g, ps } = judgedGame();
    EP.Bots.trial(g, () => 0.3);
    const subs = [...g.round.trial.submissions.values()];
    expect('Every bot submits "Bot answer"', subs.length === ps.length && subs.every(t => t === "Bot answer"), subs[0]);
    expect("Bot votes counted", g.round.trial.vote.ballots.size === ps.length && g.round.trial.ranking.length === 3);
  }

  // Typing resets the Attendance check (Part 7 reads player.lastActivity).
  {
    const { g, ps } = judgedGame();
    g.startWriting();
    ps[0].lastActivity = 1000;
    g.typeSubmission(ps[0], "I would", 5000);
    expect("Typing resets the Attendance check (last activity updated)", ps[0].lastActivity === 5000, ps[0].lastActivity);
    g.submit(ps[0], "I would fix it", 9000);
    expect("Submitting also counts as activity", ps[0].lastActivity === 9000, ps[0].lastActivity);
  }
}

// Progress board (Part 2).
{
  let a = 11;
  const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ps = Array.from({ length: 12 }, (_, i) => EP.Bots.makePlayer(400 + i, "B" + i, ["coop", "indep", "contra"][i % 3]));
  const ts = [0, 1, 2].map(i => new EP.Team({ id: "B" + i, name: "Team B" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  const g = new EP.Game({ teams: ts, rng });

  // Only the allowed fields.
  const same = (o, keys) => Object.keys(o).sort().join() === keys.slice().sort().join();
  const b0 = g.board();
  expect("Board has only players, teams, submissions", same(b0, ["players", "teams", "submissions"]), Object.keys(b0).join());
  expect("Board players: only name, team, status", b0.players.length === 12 && b0.players.every(x => same(x, ["name", "team", "status"])),
         Object.keys(b0.players[0]).join());
  expect("Board teams: only name, wins", b0.teams.every(x => same(x, ["name", "wins"])), Object.keys(b0.teams[0]).join());
  expect("Board values are plain text and numbers (no Player objects)",
         b0.players.every(x => typeof x.name === "string" && typeof x.team === "string" && typeof x.status === "string") &&
         b0.teams.every(x => typeof x.wins === "number"));
  const hidden = /"(type|attrs|hearts|glitches|earned|skim|skimUsed|cashOutUsed|pathProgress|gifts|caughtBy|focus|grit)"/;
  expect("Board JSON has no type, attributes, hearts, gifts, Skim or Cash Out", !hidden.test(JSON.stringify(b0)));

  // The 5 statuses.
  const st = p => g.board().players.find(x => x.name === p.name).status;
  const [pA, pR, pG, pS, pI] = ps;
  pR.attrs.grit = 0; pR.hearts.empty();          // cannot pay 3 even with hearts
  pG.attrs.focus = -1;                           // below 0
  pS.glitches = 2;                               // Stuck
  pI.idle = true;                                // missed an Attendance check (Part 8 sets this)
  expect("Status Active", st(pA) === "Active", st(pA));
  expect("Status At risk (same rule as the HUD flag)", st(pR) === "At risk" && pR.flag() === "At risk", st(pR));
  expect("Status Glitching", st(pG) === "Glitching", st(pG));
  expect("Status Stuck", st(pS) === "Stuck", st(pS));
  expect("Status Idle", st(pI) === "Idle", st(pI));
  pR.attrs.grit = 6; pR.hearts.refill(); pR.hearts.refill(); pR.hearts.refill();
  expect("Status updates live (At risk back to Active)", st(pR) === "Active", st(pR));
  pG.attrs.focus = 4; pS.glitches = 0; pI.idle = false;

  // Play all 6 levels with bots; check team wins after each trial.
  let ok = true, detail = "";
  for (let n = 1; n <= 6; n++) {
    g.startNextRound();
    EP.Bots.openFloor(g, rng); g.advance();
    const before = g.board().teams.map(x => x.wins);
    EP.Bots.trial(g, rng);
    const after = g.board().teams.map(x => x.wins);
    const winners = ts.map(t => t.won);
    const right = after.every((w, i) => w === before[i] + (winners[i] ? 1 : 0)) && winners.filter(Boolean).length === 2;
    if (!right) { ok = false; detail = "Level " + n + ": " + before + " > " + after; }
    if (n === 5) {
      const s5 = g.board().submissions;
      expect("Level 5 submissions appear on the board with name and level",
             s5.length === 12 && s5.every(x => x.level === 5 && x.text === "Bot answer" && same(x, ["level", "name", "text"])),
             s5.length + " entries");
    }
    g.payTrialCosts(); g.advance();
    EP.Bots.accusations(g, rng); g.endGlitchReport(); g.advance();
    EP.Bots.gifts(g, rng); g.advance(); g.lockIn(); g.advance();
    g.computeEarnings(); EP.Bots.statsUpdate(g); g.finishRound();
  }
  expect("Team wins update after every trial (2 winners each level)", ok, detail);
  expect("Team wins add up to 12 after 6 levels", g.board().teams.reduce((s, x) => s + x.wins, 0) === 12,
         g.board().teams.map(x => x.name + ":" + x.wins).join(" "));
  const subs = g.board().submissions;
  expect("Level 6 submissions added after Level 5's",
         subs.filter(x => x.level === 5).length === 12 && subs.filter(x => x.level === 6).length > 0 &&
         subs.findIndex(x => x.level === 6) > subs.map(x => x.level).lastIndexOf(5),
         subs.filter(x => x.level === 6).length + " at Level 6");
  expect("No submissions on the board before Level 5", b0.submissions.length === 0);
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
