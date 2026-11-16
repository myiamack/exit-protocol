/* Spot test: Game refuses calls made in the wrong step.
   Run from the repo folder:  node Tests/check_steps.js */
const path = require("path");
const EP = require("../rules/index.js");   // ES modules (Part 12)
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

game.startNextRound(); game.advance();
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
  expect("Discount never goes below 1: 1-point gift still costs 1", g.cost === 1 && a.hearts.count === 2, a.hearts.count);
  // Message bug: the roll fired but the cost stayed at 1, so .discount must be false (no "1 less" text).
  expect("Cooperative 1-point gift, roll fires: no discount shown (cost stayed 1)", !g.discount && !g.gift.discount, g.discount);
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
  g.startNextRound(); g.advance();

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
  g2.startNextRound(); g2.advance();
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
    g.startNextRound(); g.advance(); g.level = 4; g.round = null;   // jump straight to Level 5
    g.startNextRound(); g.advance(); g.advance();                   // Open Floor > Trial
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
    g.startNextRound(); g.advance();
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

// Attendance (Part 7). Time is passed in, so these tests fake the clock in seconds.
{
  const s = n => n * 1000;
  // A full miss: the popup opens 15 s before, then the countdown runs out.
  const missAt = (g, t) => { g.checkAttendance(t - s(15)); return g.checkAttendance(t); };
  const mkGame = (attendance) => {
    const ps = ["coop", "coop", "indep", "contra", "coop", "coop", "indep", "coop"].map((t, i) => EP.Bots.makePlayer(200 + i, "A" + i, t));
    ps[0].isBot = false;   // the one human; bots are not checked
    const ts = [0, 1].map(i => new EP.Team({ id: i, name: "T" + i, members: ps.slice(i * 4, i * 4 + 4) }));
    const clock = { now: 0 };   // fake clock for Game's pause and resume; set clock.now to move time
    return { g: new EP.Game({ teams: ts, rng: NO, attendance, clock: () => clock.now }), me: ps[0], bot: ps[1], clock };
  };

  const d = new EP.Attendance().settings;
  expect("Default settings: 60 s idle, 15 s popup, 1 per round",
         d.idleMs === 60000 && d.popupMs === 15000 && d.maxPerRound === 1, JSON.stringify(d));
  const custom = mkGame({ idleMs: s(30), popupMs: s(5), maxPerRound: 2 }).g.attendance.settings;
  expect("Settings can be changed (idle, popup, per-round max)",
         custom.idleMs === 30000 && custom.popupMs === 5000 && custom.maxPerRound === 2, JSON.stringify(custom));
  throws("A bad setting is refused", () => new EP.Attendance({ idleMs: -5 }));

  // A miss before the gift window closes: Glitching (pending). Nothing locks in yet.
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance();
    g.activity(me, 0);
    const attrs = { ...me.attrs }, hearts = me.hearts.count;
    expect("No popup before 60 s", g.checkAttendance(s(59)).length === 0);
    const pop = g.checkAttendance(s(60));
    expect("Popup opens at 60 s with a 15 s countdown", pop.length === 1 && pop[0].state === "popup" && pop[0].msLeft === s(15),
           pop[0] && pop[0].state + " " + pop[0].msLeft);
    expect("Popup still open at 74 s", g.checkAttendance(s(74))[0].state === "popup");
    const miss = g.checkAttendance(s(75));
    expect("No input by 75 s (Open Floor): missed, pending, Glitching, glitch count unchanged",
           miss[0].state === "missed" && miss[0].counted && miss[0].pending && !miss[0].locked &&
           me.attendancePending && me.flag() === "Glitching" && me.glitches === 0, "glitches " + me.glitches);
    expect("Pending miss leaves attributes and hearts unchanged",
           JSON.stringify(me.attrs) === JSON.stringify(attrs) && me.hearts.count === hearts);
    expect("Pending miss is not a locked glitch yet (no glitchedThisRound)", me.glitchedThisRound === false);
    // Part 8: the miss also makes the player idle. Board order is Stuck, Glitching, Idle, so it shows Glitching.
    const boardOf = p => g.board().players.find(x => x.name === p.name).status;
    expect("Teammates see Glitching on the Board while idle (Glitching comes before Idle)", me.idle && boardOf(me) === "Glitching", boardOf(me));
    g.activity(me, s(76));
    expect("After the next input: still Glitching on the Board", !me.idle && boardOf(me) === "Glitching", boardOf(me));
    // Idle and not Glitching: Idle, even when At risk too (Idle comes before At risk).
    me.attendancePending = false; me.idle = true;
    expect("Board: idle, not Glitching shows Idle", boardOf(me) === "Idle", boardOf(me));
    const grit = me.attrs.grit, h = me.hearts.count;
    me.attrs.grit = 0; me.hearts.empty();
    expect("Board: idle and At risk shows Idle", me.isAtRisk() && boardOf(me) === "Idle", boardOf(me));
    me.idle = false;
    expect("Board: At risk, not idle shows At risk", boardOf(me) === "At risk", boardOf(me));
    me.attrs.grit = grit; me.hearts.refund(h); me.attendancePending = true;   // back as it was for the tests below
    expect("Bots are never checked", g.players.filter(p => p.isBot).every(p => p.glitches === 0));
  }

  // Only 1 Attendance glitch per player per round.
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance();
    g.activity(me, 0);
    missAt(g, s(75));                             // first miss
    const again = missAt(g, s(150));              // second miss, same round
    expect("Second miss in the same round is not counted",
           again[0].state === "missed" && !again[0].counted && !again[0].pending && me.glitches === 0, "glitches " + me.glitches);
    // Finish the round and start the next; the per-round max resets.
    g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance();
    expect("Unsaved miss locks in at Lock-in: 1 glitch, not Stuck", me.glitches === 1 && me.glitchedThisRound && !me.isStuck(), "glitches " + me.glitches);
    g.computeEarnings(); me.isBot = true; EP.Bots.statsUpdate(g); me.isBot = false;   // place my points the bot way
    g.finishRound(); g.startNextRound(); g.advance();
    const had = me.glitches;
    const next = missAt(g, s(225));
    expect("Next round: a miss counts again (pending)", had === 1 && next[0].counted && next[0].pending, JSON.stringify(next[0].counted));
  }
  {
    const { g, me } = mkGame({ maxPerRound: 2 });
    g.startNextRound(); g.advance(); g.activity(me, 0);
    const a = missAt(g, s(75)), b = missAt(g, s(150));
    expect("Per-round max is a setting (max 2: two misses count)", a[0].counted && b[0].counted && me.attendanceMissesThisRound === 2);
    g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); g.advance(); g.lockIn();
    expect("Two misses in one round still lock in as one glitch", me.glitches === 1, "glitches " + me.glitches);
  }

  // Two glitches of any kind make the player Stuck.
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance(); g.activity(me, 0);
    me.attrs.focus = -1; me.lockIn();             // one locked (attribute) glitch, an earlier round
    me.glitchedThisRound = false;
    expect("One locked glitch: not Stuck", me.glitches === 1 && !me.isStuck());
    missAt(g, s(75));
    g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); g.advance(); g.lockIn();
    expect("Locked glitch + locked Attendance glitch = Stuck", me.isStuck(), "glitches " + me.glitches);
    expect("Stuck players are no longer checked", g.checkAttendance(s(500)).length === 0 && me.glitches === 2);
  }
  {
    const { g, me } = mkGame();
    const playOut = () => { g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance();
                            g.computeEarnings(); me.isBot = true; EP.Bots.statsUpdate(g); me.isBot = false; g.finishRound(); };
    g.startNextRound(); g.advance(); g.activity(me, 0);
    missAt(g, s(75)); playOut();
    g.startNextRound(); g.advance(); missAt(g, s(150)); playOut();
    expect("Two Attendance glitches (two rounds) = Stuck", me.isStuck() && me.boardStatus() === "Stuck", "glitches " + me.glitches);
  }

  // Any input resets the timer.
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance(); g.activity(me, 0);
    g.activity(me, s(50));
    expect("Input at 50 s: no popup at 75 s", g.checkAttendance(s(75)).length === 0);
    expect("Popup opens 60 s after the last input (110 s)", g.checkAttendance(s(110))[0].state === "popup");
    g.activity(me, s(120));                       // answer the popup
    expect("Input during the popup closes it", g.checkAttendance(s(121)).length === 0);
    expect("Input during the popup prevents the glitch", g.checkAttendance(s(179)).length === 0 && me.glitches === 0);
    // Typing a Level 5-6 submission counts as input (uses the same activity call).
    const before = me.lastActivity;
    g.typeSubmission(me, "x", s(178));
    expect("Typing a submission counts as input", me.lastActivity === s(178), before + " > " + me.lastActivity);
  }
  // Bug fix: the first check of the game must show the popup before any glitch, even if the
  // player was quiet much longer than 75 s (intro, intermission, or late checks in a background tab).
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance();
    const first = g.checkAttendance(s(0));         // first check: starts the clock
    expect("First check of the game starts the clock (no popup, no glitch)", first.length === 0 && me.glitches === 0);
    const late = g.checkAttendance(s(300));        // next check is very late: 300 s quiet
    expect("First time over the limit shows the popup with the full 15 s, not a glitch",
           late.length === 1 && late[0].state === "popup" && late[0].msLeft === s(15) && me.glitches === 0,
           late[0] && late[0].state + " " + late[0].msLeft + ", glitches " + me.glitches);
    expect("Still the popup 14 s later, no glitch", g.checkAttendance(s(314))[0].state === "popup" && me.glitches === 0);
    const m = g.checkAttendance(s(315));
    expect("Miss only after the 15 s countdown", m[0].state === "missed" && m[0].pending && me.attendancePending, m[0].state);
  }
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance();
    me.markActive(s(0));                           // last input long ago (for example, during the intro)
    const r = g.checkAttendance(s(400));
    expect("Old input before the first check: popup first, no glitch", r[0].state === "popup" && me.glitches === 0, r[0].state);
    g.activity(me, s(405));
    expect("Answering that popup prevents the glitch", g.checkAttendance(s(420)).length === 0 && me.glitches === 0);
  }

  // Pause and resume (Attendance class itself). These call Attendance.check directly, because
  // Game.checkAttendance re-applies Game's own pause rule first (tested further down).
  const chk = (g, p, t) => { const r = g.attendance.check(p, t); return r.state === "popup" || r.state === "missed" ? [r] : []; };
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance(); g.activity(me, 0);
    g.attendance.pause(me, s(10));
    const quiet = [s(60), s(75), s(1000), s(100000)].map(t => chk(g, me, t));
    expect("Paused: no popup or glitch, however long", quiet.every(r => r.length === 0) && me.glitches === 0, "glitches " + me.glitches);
    expect("Paused: check() says paused", g.attendance.check(me, s(200000)).state === "paused");
    g.attendance.resume(me, s(200000));
    expect("Resume: no popup at 59 s after resume", chk(g, me, s(200059)).length === 0);
    const r = chk(g, me, s(200060));
    expect("Resume gives a full 60 s before the popup", r.length === 1 && r[0].state === "popup" && r[0].msLeft === s(15), r[0] && r[0].state);
    expect("Then a full 15 s countdown before a miss", chk(g, me, s(200074))[0].state === "popup" &&
           chk(g, me, s(200075))[0].state === "missed");
  }
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance(); g.activity(me, 0);
    expect("Popup open at 65 s", chk(g, me, s(65))[0].state === "popup");
    g.attendance.pause(me, s(70));
    expect("Pausing during an open popup closes it with no glitch",
           me.attendancePopupAt === null && chk(g, me, s(90)).length === 0 && me.glitches === 0, "glitches " + me.glitches);
    g.attendance.resume(me, s(500));
    expect("After resume, the old popup does not come back (no popup until 60 s later)",
           chk(g, me, s(501)).length === 0 && chk(g, me, s(559)).length === 0 && me.glitches === 0);
    expect("After resume, popup at 60 s", chk(g, me, s(560))[0].state === "popup");
  }
  {
    const { g, me } = mkGame();
    g.startNextRound(); g.advance();
    g.attendance.pause(me, 0);                     // paused before any input or check (intro)
    expect("Paused from the start: nothing happens", chk(g, me, s(5000)).length === 0 && me.glitches === 0);
    g.attendance.resume(me, s(5000));
    expect("First resume starts the clock: popup at resume + 60 s",
           chk(g, me, s(5059)).length === 0 && chk(g, me, s(5060))[0].state === "popup");
  }

  // A miss restarts the timer: the next popup comes 60 s after the miss, not at once.
  {
    const { g, me } = mkGame({ maxPerRound: 2 });
    g.startNextRound(); g.advance(); g.activity(me, 0);
    missAt(g, s(75));
    expect("After a miss, no popup until 60 s later", g.checkAttendance(s(134)).length === 0 &&
           g.checkAttendance(s(135))[0].state === "popup");
  }
}

// A missed check-in follows the normal glitch path: pending until the gift window closes, a gift saves it,
// otherwise it locks in (hearts to 0, no attribute refill, 1 point, Empathy). Same round as an attribute glitch: one glitch.
{
  const s = n => n * 1000;
  const mk = () => {
    const ps = ["coop", "coop", "indep", "contra", "coop", "coop", "indep", "coop"].map((t, i) => EP.Bots.makePlayer(500 + i, "M" + i, t));
    ps[0].isBot = false;
    const ts = [0, 1].map(i => new EP.Team({ id: i, name: "MT" + i, members: ps.slice(i * 4, i * 4 + 4) }));
    const clock = { now: 0 };
    const g = new EP.Game({ teams: ts, rng: NO, clock: () => clock.now });
    const me = ps[0], coopMate = ps[1];
    g.startNextRound(); g.advance(); g.activity(me, 0);
    me.attrs = { focus: 5, initiative: 3, collab: 6, composure: 6, grit: 6 };   // Level 1 costs 2 Grit: stays above 0
    const miss = t => { g.checkAttendance(t - s(15)); return g.checkAttendance(t)[0]; };
    const toGiftWindow = () => { g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); };
    return { g, me, coopMate, miss, toGiftWindow };
  };

  // Saved by a gift in the gift window.
  {
    const { g, me, coopMate, miss, toGiftWindow } = mk();
    miss(s(75));
    toGiftWindow();
    expect("Still pending in the gift window", g.step === "giftWindow" && me.attendancePending && me.flag() === "Glitching");
    const h = coopMate.hearts.count;
    const r = g.gift(coopMate, me, 1);
    g.activity(me, s(80));                        // the player comes back (input clears idle), then accepts
    const a = g.answerGift(r.gift, true);
    expect("Accepted gift in the gift window cancels the pending glitch", a.ok && !me.attendancePending && me.flag() !== "Glitching");
    expect("Normal gift cost (1 heart for a Cooperative)", coopMate.hearts.count === h - 1, h + " > " + coopMate.hearts.count);
    expect("Points go to the lowest attribute (Initiative 3)", a.target === "initiative" && me.attrs.initiative === 4, a.target);
    expect("Counts for Lifeline", a.cancelled && coopMate.pathDone, "progress " + coopMate.pathProgress);
    const again = miss(s(155));                   // popup 60 s after the input at 80 s, missed 15 s later
    expect("A miss saved by a gift still uses the cap: next miss not counted", again && !again.counted && !me.attendancePending);
    g.advance(); const locked = g.lockIn();
    expect("Saved: nothing locks in", !locked.includes(me) && me.glitches === 0 && !me.glitchedThisRound);
  }
  // A gift in Open Floor does not save a pending miss (only the gift window does).
  {
    const { g, me, coopMate, miss } = mk();
    miss(s(75));
    const r = g.gift(coopMate, me, 1); g.activity(me, s(80)); const a = g.answerGift(r.gift, true);
    expect("Open Floor gift lands but does not cancel the pending glitch, no Lifeline",
           a.ok && me.attendancePending && !a.cancelled && !coopMate.pathDone);
  }
  // Not saved: locks in when the gift window closes.
  {
    const { g, me, coopMate, miss, toGiftWindow } = mk();
    miss(s(75));
    toGiftWindow(); g.advance();
    const attrs = JSON.stringify(me.attrs), h = coopMate.hearts.count;
    const locked = g.lockIn();
    expect("Not saved: locks in at Lock-in (+1 glitch, glitchedThisRound)", locked.includes(me) && me.glitches === 1 && me.glitchedThisRound && me.attendanceGlitchThisRound);
    expect("Reboot: hearts to 0, no attribute refill", me.hearts.count === 0 && JSON.stringify(me.attrs) === attrs, me.attrs && JSON.stringify(me.attrs));
    expect("Empathy: Cooperative teammate loses 1 heart", coopMate.hearts.count === h - 1, h + " > " + coopMate.hearts.count);
    g.advance(); g.computeEarnings();
    expect("1 point that round", me.earned === 1, me.earned);
  }
  // Attendance glitch and attribute glitch in the same round: one glitch.
  {
    const { g, me, miss, toGiftWindow } = mk();
    miss(s(75));
    toGiftWindow(); me.attrs.focus = -1; g.advance(); g.lockIn();
    expect("Pending miss + attribute below 0 in the same round = 1 glitch", me.glitches === 1 && me.attrs.focus === 1 && !me.attendanceGlitchThisRound, "glitches " + me.glitches);
  }
  // A miss after the gift window closed locks in at once, same reboot.
  {
    const { g, me, coopMate, toGiftWindow } = mk();
    toGiftWindow(); g.advance(); g.lockIn(); g.advance();
    expect("In Stats Update a miss cannot wait", g.step === "statsUpdate" && !g.attendanceCanWait());
    const attrs = JSON.stringify(me.attrs), h = coopMate.hearts.count;
    const r = g.attendanceMiss(me, true);
    expect("Miss after the window closed: locks in at once", r.locked && !r.pending && me.glitches === 1 && me.glitchedThisRound && !me.attendancePending);
    expect("Same reboot: hearts to 0, attributes unchanged, Empathy",
           me.hearts.count === 0 && JSON.stringify(me.attrs) === attrs && coopMate.hearts.count === h - 1);
    const r2 = g.attendanceMiss(me, true);
    expect("A second locked glitch in the same round counts as one", !r2.locked && me.glitches === 1);
  }
  {
    const { g, me, toGiftWindow } = mk();
    toGiftWindow(); me.attrs.focus = -1; g.advance(); g.lockIn(); g.advance();
    const r = g.attendanceMiss(me, true);
    expect("Attribute glitch locked, then a miss after the window: still 1 glitch", !r.locked && me.glitches === 1, "glitches " + me.glitches);
  }
  // A miss that is not counted (over the cap) does nothing.
  {
    const { g, me } = mk();
    const r = g.attendanceMiss(me, false);
    expect("Uncounted miss: no pending, no glitch", !r.counted && !r.pending && !r.locked && !me.attendancePending && me.glitches === 0);
  }
  // Bots treat a pending teammate as Glitching: a Cooperative bot gifts in the gift window.
  {
    const { g, me, coopMate, miss, toGiftWindow } = mk();
    miss(s(75)); toGiftWindow();
    EP.Bots.gifts(g, NO);
    const gift = g.round.gifts.find(x => x.receiver === me && x.status === "pending");
    expect("Cooperative bot gifts to a pending teammate", !!gift && gift.giver.type.key === "coop");
    if (gift) { g.activity(me, s(80)); g.answerGift(gift, true); expect("Accepting it saves the player", !me.attendancePending); }
  }
}

// Stats Update auto-advance: unplaced points are placed by the bot rule, keeping what the player picked.
{
  const ps = ["coop", "indep", "contra", "coop", "coop", "indep", "contra", "coop"].map((t, i) => EP.Bots.makePlayer(600 + i, "U" + i, t));
  const me = ps[0]; me.isBot = false;
  const ts = [0, 1].map(i => new EP.Team({ id: i, name: "UT" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  const g = new EP.Game({ teams: ts, rng: NO });
  g.startNextRound(); g.advance(); g.advance(); g.runTrial(); g.payTrialCosts(); g.advance();
  expect("Glitch Report: no Attendance popup or miss, however long", g.checkAttendance(10 ** 9).length === 0 && me.attendancePaused);
  g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance(); g.computeEarnings();
  EP.Bots.statsUpdate(g);
  const total = me.total(), n = me.earned;
  throws("Auto-place refused before Stats Update work is ready", () => new EP.Game({ teams: ts, rng: NO }).autoPlacePoints(me));
  const alloc = g.autoPlacePoints(me, { composure: 1 });
  expect("Auto-place keeps the player's own pick and places the rest", n >= 2 && alloc.composure >= 1 && me.earned === 0 && me.total() === total + n,
         JSON.stringify(alloc) + " earned " + n);
  expect("Stats Update: no Attendance popup or miss", g.checkAttendance(2 * 10 ** 9).length === 0);
  g.finishRound();
  expect("Round can finish after auto-place", g.step === "intermission");
}

// Game decides Attendance pausing from its own steps (no screen). Briefing and intermission: paused.
// Every other step: running. Checked at every step of Levels 1 to 7.
{
  let a = 7;
  const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ps = Array.from({ length: 12 }, (_, i) => EP.Bots.makePlayer(300 + i, "G" + i, ["coop", "indep", "contra"][i % 3]));
  const ts = [0, 1, 2].map(i => new EP.Team({ id: i, name: "GT" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  const clock = { now: 0 };
  const g = new EP.Game({ teams: ts, rng, clock: () => clock.now });
  const me = ps[0];
  expect("Paused steps are kept in Game: briefing, intermission, Glitch Report, Stats Update",
         JSON.stringify(EP.Game.PAUSED_STEPS) === JSON.stringify(["briefing", "intermission", "glitchReport", "statsUpdate"]));
  expect("Glitch Report and Stats Update end on their own after 30 s",
         EP.Game.AUTO_ADVANCE_SECONDS.glitchReport === 30 && EP.Game.AUTO_ADVANCE_SECONDS.statsUpdate === 30);
  const allPaused = () => g.players.every(p => p.attendancePaused);
  const nonePaused = () => g.players.every(p => !p.attendancePaused);
  const seen = {}, bad = [];
  const at = (label, wantPaused) => {
    seen[g.step] = true;
    const ok = wantPaused ? allPaused() : nonePaused();
    if (!ok) bad.push("Level " + g.level + " " + label + " (" + g.step + ")");
  };
  expect("New game starts in intermission (covers the intro), paused", g.step === "intermission" && allPaused());
  for (let lv = 1; lv <= 6; lv++) {
    clock.now += 1000;
    g.startNextRound();                 at("briefing", true);
    if (lv === 1) {
      refusedResult("Gift during the briefing is refused", g.gift(ps[1], ps[2], 1));
      expect("Check during the briefing: nothing, however long", g.attendance.check(me, 10 ** 9).state === "paused");
    }
    clock.now += 1000;
    const resumeAt = clock.now;
    g.advance();                        at("Open Floor", false);
    if (lv === 1) expect("Leaving the briefing starts a fresh clock (resume time = Game's clock)",
                         me.attendanceResumeAt === resumeAt, me.attendanceResumeAt + " vs " + resumeAt);
    EP.Bots.openFloor(g, rng); g.advance(); at("Trial", false);
    EP.Bots.trial(g, rng); g.payTrialCosts(); g.advance(); at("Glitch Report", true);
    EP.Bots.accusations(g, rng); g.endGlitchReport(); g.advance(); at("Gift window", false);
    EP.Bots.gifts(g, rng); g.advance(); at("Lock-in", false);
    g.lockIn(); g.advance();            at("Stats Update", true);
    g.computeEarnings(); EP.Bots.statsUpdate(g);
    clock.now += 1000;
    g.finishRound();                    at("intermission", true);
  }
  g.startNextRound();                   at("Level 7 briefing", true);
  g.advance();
  // Graduation: running only for players with Round 7 points to place (Stuck players have 0: paused).
  const gradOk = () => g.players.every(p => p.attendancePaused === (p.earned === 0));
  expect("Graduation: running for players with points to place, paused for players with 0",
         gradOk() && g.players.some(p => !p.attendancePaused), g.players.map(p => p.earned + (p.attendancePaused ? "P" : "R")).join(" "));
  seen.graduation = true;
  EP.Bots.graduation(g); g.checkAttendance(clock.now);
  expect("Graduation: everyone paused once all points are placed", allPaused());
  expect("Every step was visited, Levels 1 to 7",
         ["briefing", "openFloor", "trial", "glitchReport", "giftWindow", "lockIn", "statsUpdate", "intermission", "graduation"]
           .every(k => seen[k]), Object.keys(seen).join(","));
  expect("Paused in every briefing, intermission, Glitch Report and Stats Update; running in every other step", bad.length === 0, bad.join("; "));
}

// Graduation: Attendance runs only until a player has placed all Round 7 points. Endings lock at results().
{
  const s = n => n * 1000;
  const ps = ["coop", "indep", "contra", "coop", "coop", "indep", "contra", "coop"].map((t, i) => EP.Bots.makePlayer(400 + i, "R" + i, t));
  const [placing, placer, maxed] = ps;
  [placing, placer, maxed].forEach(p => { p.isBot = false; });
  const ts = [0, 1].map(i => new EP.Team({ id: i, name: "RT" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  const clock = { now: 0 };
  const g = new EP.Game({ teams: ts, rng: NO, clock: () => clock.now });
  g.startNextRound(); g.level = 6; g.round = null;                // jump straight to Level 7
  for (const k of EP.Player.KEYS) maxed.attrs[k] = maxed.max(k);  // no room: 0 points to place
  g.startNextRound();
  expect("Level 7 opens with a briefing, everyone paused", g.step === "briefing" && g.players.every(p => p.attendancePaused));
  clock.now = s(1000);
  g.advance();
  expect("Graduation step", g.step === "graduation", g.step);
  expect("0 points to place: paused from the start of Graduation", maxed.earned === 0 && maxed.attendancePaused);
  expect("Players with points to place: running", placing.earned === 3 && !placing.attendancePaused && placer.earned === 3 && !placer.attendancePaused);

  placer.placePoints(EP.Bots.allocate(placer, placer.earned, false));   // places all points
  const pop = g.checkAttendance(s(1060));
  expect("Still placing: popup at 60 s", pop.some(r => r.player === placing && r.state === "popup"));
  expect("Placed all points: paused at the next check", placer.attendancePaused && !pop.some(r => r.player === placer));
  const miss = g.checkAttendance(s(1075));
  expect("Still placing: a miss at Graduation locks in at once", miss.some(r => r.player === placing && r.locked && !r.pending) && placing.glitches === 1,
         "glitches " + placing.glitches);
  const late = [s(5000), s(100000), s(10 ** 7)].map(t => g.checkAttendance(t));
  expect("Placed all points: no popup or glitch however long", late.every(l => !l.some(r => r.player === placer)) && placer.glitches === 0,
         "glitches " + placer.glitches);
  expect("0 points to place: no popup or glitch however long", late.every(l => !l.some(r => r.player === maxed)) && maxed.glitches === 0);

  placing.placePoints(EP.Bots.allocate(placing, placing.earned, false));
  EP.Bots.statsUpdate(g);                                                 // bots place theirs
  ps[3].attrs.focus = 0;                                                  // one player misses the lowest-attribute rule
  const res = g.results();
  const before = res.map(r => r.player.name + ":" + r.ending + ":" + r.wins).join(" ");
  expect("After results(): everyone paused", g.players.every(p => p.attendancePaused));
  // Try to change every ending: graduates become Stuck, everyone else gets maxed attributes and no glitches.
  for (const r of res) {
    if (r.ending === "Graduated") r.player.glitches = 2;
    else { for (const k of EP.Player.KEYS) r.player.attrs[k] = r.player.max(k); r.player.glitches = 0; r.player.pathDone = true; }
  }
  const after = g.results().map(r => r.player.name + ":" + r.ending + ":" + r.wins).join(" ");
  const live = g.players.map(p => p.name + ":" + p.ending() + ":" + p.wins()).join(" ");
  expect("Endings locked at results(): no later change alters them", before === after && before === live);
  expect("Both kinds of ending were tested (some Graduated, some not)",
         res.some(r => r.ending === "Graduated") && res.some(r => r.ending !== "Graduated"), before);
}

// Part 8: idle auto-pilot. A missed check-in sets idle; any input clears it. Idle players take no optional
// actions (gifts, answering gifts, accusations, sabotage, votes) and are left out of active counts.
// Bots are never checked by Attendance, so tests that need an idle bot set p.idle directly.
{
  const s = n => n * 1000;
  const mk = () => {
    const ps = ["coop", "contra", "indep", "coop", "coop", "coop", "indep", "coop"].map((t, i) => EP.Bots.makePlayer(700 + i, "I" + i, t));
    ps[0].isBot = false;   // the one human
    const ts = [0, 1].map(i => new EP.Team({ id: i, name: "IT" + i, members: ps.slice(i * 4, i * 4 + 4) }));
    const clock = { now: 0 };
    const g = new EP.Game({ teams: ts, rng: NO, clock: () => clock.now });
    return { g, ps, ts, me: ps[0], contra: ps[1], indep: ps[2], coopMate: ps[3] };
  };
  // Input at t - 75 s, popup at t - 15 s, missed at t.
  const goIdle = (g, me, t) => { g.activity(me, t - s(75)); g.checkAttendance(t - s(15)); return g.checkAttendance(t)[0]; };

  // Set and clear.
  {
    const { g, me } = mk();
    g.startNextRound(); g.advance();
    expect("Part 8: not idle at the start", !me.idle && me.isActive());
    const r = goIdle(g, me, s(75));
    expect("Part 8: a missed check-in sets idle", r.state === "missed" && r.counted && me.idle && !me.isActive());
    expect("Part 8: Team.active() leaves out idle players", !g.teamOf(me).active().includes(me) && g.teamOf(me).active().length === 3);
    g.activity(me, s(80));
    expect("Part 8: the next input clears idle", !me.idle && me.isActive() && g.teamOf(me).active().includes(me));
    const r2 = goIdle(g, me, s(160));
    expect("Part 8: a miss over the per-round cap still sets idle (the cap limits glitches only)",
           r2.state === "missed" && !r2.counted && me.idle, r2.state + " counted " + r2.counted);
    g.advance(); g.runTrial(); g.payTrialCosts(); g.advance();
    expect("Glitch Report: Attendance paused", g.step === "glitchReport" && me.attendancePaused);
    g.activity(me, s(200));
    expect("Part 8: input on a paused screen also clears idle", !me.idle);
    expect("Part 8: bots never go idle", g.players.filter(p => p.isBot).every(p => !p.idle));
  }

  // Blocks, gifts, trial cost, Cash Out, Stats Update auto-placement.
  {
    const { g, me, contra, indep, coopMate } = mk();
    g.startNextRound(); g.advance();
    goIdle(g, me, s(75));
    refusedResult("Part 8: idle player cannot give a gift", g.gift(me, coopMate, 1));
    const h = coopMate.hearts.count;
    const toMe = g.gift(coopMate, me, 1);
    expect("Part 8: a gift to an idle player can be sent (giver pays)", toMe.ok && toMe.gift.status === "pending" && coopMate.hearts.count === h - 1);
    refusedResult("Part 8: idle player cannot accept a gift", g.answerGift(toMe.gift, true));
    refusedResult("Part 8: idle player cannot decline a gift", g.answerGift(toMe.gift, false));
    expect("Part 8: idle players can still be sabotaged (only Stuck are protected)", g.sabotage(contra, me).ok);
    contra.idle = true;
    refusedResult("Part 8: idle player cannot sabotage", g.sabotage(contra, coopMate));
    contra.idle = false;
    g.advance();
    expect("Part 8: gift to an idle player expires at the end of the step, giver refunded",
           toMe.gift.status === "expired" && coopMate.hearts.count === h, toMe.gift.status + " hearts " + coopMate.hearts.count);
    g.runTrial();
    const paid = g.payTrialCosts();
    expect("Part 8: idle players pay trial costs as normal", me.idle && paid.has(me));
    g.advance();
    refusedResult("Part 8: idle player cannot accuse", g.accuse(me, contra));
    g.endGlitchReport();
    expect("Part 8: idle player's Glitch Report counts as Skip", !me.accusedThisRound && me.idle);
    g.advance();
    const back = g.gift(coopMate, me, 1);
    g.activity(me, s(300));                       // comes back before the gift window closes
    expect("Part 8: back in time, the player can answer a gift sent while idle", g.answerGift(back.gift, true).ok);
    g.advance(); g.lockIn(); g.advance(); g.computeEarnings();
    me.idle = true;                               // idle from a miss earlier (Stats Update itself is paused)
    indep.idle = true;
    expect("Part 8: Cash Out is not blocked for idle players", g.cashOut(indep).ok);
    indep.idle = false;
    const earned = me.earned, total = me.total();
    g.autoPlacePoints(me, {});                    // the 30 s timer ran out
    expect("Part 8: idle player's points are auto-placed at Stats Update",
           earned > 0 && me.earned === 0 && me.total() === total + earned, earned + " points, total " + total + " > " + me.total());
    EP.Bots.statsUpdate(g);
    g.finishRound();
    expect("Round finishes with the idle player's points placed", g.step === "intermission");
  }

  // Team switching is not blocked for idle players.
  {
    const { g, me } = mk();
    g.startNextRound(); g.advance();
    goIdle(g, me, s(75));
    expect("Part 8: team switching is not blocked for idle players", me.idle && g.switchTeam(me, g.teams[1]).ok);
  }

  // Light influence: active players only.
  {
    const { ps, ts } = mk();
    for (const p of ps) p.attrs.grit = 2;
    ps[1].attrs.grit = 10; ps[1].idle = true;     // team 0 has one idle player with high Grit
    const inf = EP.Trial.influence({ attr: "grit" }, ts);
    expect("Part 8: light influence leaves out idle players", inf.get(ts[0]) === 0 && inf.get(ts[1]) === 0,
           inf.get(ts[0]) + " / " + inf.get(ts[1]));
  }

  // Levels 5-6: writing and the vote.
  {
    const { g, ps, ts, me } = mk();
    g.startNextRound(); g.level = 4; g.round = null;   // jump to Level 5
    g.startNextRound(); g.advance(); g.advance();
    expect("Level 5 trial", g.level === 5 && g.step === "trial");
    g.startWriting();
    ps[6].idle = true;                            // never writes
    let last;
    for (const p of ps) if (p !== ps[6]) last = g.submit(p, "Bot answer", s(10));
    expect("Part 8: writing closes early when every active player has submitted (idle not waited for)", last.closed === true);
    const vote = g.startVote();
    vote.cast(ps[2], vote.choicesFor(ps[2]).slice(0, 3));   // votes, then goes idle
    ps[1].idle = true; ps[2].idle = true; ps[5].idle = true;
    expect("Part 8: idle players are not in the ranking choices", !vote.choicesFor(me).includes(ps[5]));
    // Team 1 has 2 active players left (ps4, ps7), so a ranking has 2 slots.
    expect("Only the 2 active players on team 1 can be ranked", vote.slotsFor(me) === 2, vote.slotsFor(me));
    const idleRank = vote.cast(me, [ps[5], ps[4]]);
    expect("Part 8: an idle player cannot be ranked", idleRank.ok === false && /idle/.test(idleRank.reason), idleRank.reason);
    refusedResult("Part 8: an idle player cannot vote", vote.cast(ps[1], vote.choicesFor(ps[1]).slice(0, 3)));
    expect("Ranking without idle players works", vote.cast(me, [ps[4], ps[7]]).ok);
    EP.Bots.vote(g, vote, () => 0.5);
    expect("Part 8: a ballot cast before going idle stays", vote.ballots.has(ps[2]) && !vote.ballots.has(ps[1]));
    const res = g.runTrial();
    const t0 = res.find(r => r.team === ts[0]), t1 = res.find(r => r.team === ts[1]);
    expect("Part 8: vote math leaves out idle players (each team: 2 active, 2 possible voters)",
           t0.active === 2 && t0.voters === 2 && t1.active === 2 && t1.voters === 2,
           "t0 " + t0.active + "/" + t0.voters + ", t1 " + t1.active + "/" + t1.voters);
  }

  // Graduation: 60 s placement timer; idle at results() = Contract renewed, unless the second path is done.
  {
    const { g, ps } = mk();
    const fill = (p, v) => { for (const k of EP.Player.KEYS) p.attrs[k] = Math.min(v, p.max(k)); };
    ps.forEach(p => fill(p, 5));                  // total 24 or 25, every attribute 2+: graduates
    const [idleGrad, idlePath, activeGrad, cameBack, lowFocus, partial] = ps;
    fill(lowFocus, 6); lowFocus.attrs.focus = 0;  // one attribute below 2
    g.startNextRound(); g.level = 6; g.round = null;
    g.startNextRound(); g.advance();
    expect("Graduation step", g.step === "graduation");
    expect("Level 7 placement timer is 60 seconds", EP.Game.GRADUATION_PLACE_SECONDS === 60);
    g.autoPlacePoints(lowFocus, {});
    expect("Level 7 auto-placement: Round 7 bot rule (attributes below 2 first)", lowFocus.earned === 0 && lowFocus.attrs.focus >= 2,
           "focus " + lowFocus.attrs.focus);
    const g0 = partial.attrs.grit;
    g.autoPlacePoints(partial, { grit: 1 });
    expect("Level 7 auto-placement keeps points already placed", partial.earned === 0 && partial.attrs.grit >= g0 + 1);
    idleGrad.idle = true; idlePath.idle = true; idlePath.pathDone = true; cameBack.idle = true;
    g.activity(cameBack, s(10));
    for (const p of ps) if (p.earned > 0) g.autoPlacePoints(p, {});   // timer ran out for everyone else
    const res = g.results();
    const end = p => res.find(r => r.player === p);
    expect("Part 8: idle at Graduation = Contract renewed, even with graduating stats",
           idleGrad.graduates() && end(idleGrad).ending === "Contract renewed" && !end(idleGrad).wins, end(idleGrad).ending);
    expect("Part 8: idle with a completed second path still wins",
           end(idlePath).wins && end(idlePath).ending === idlePath.type.pathName + " complete", end(idlePath).ending);
    expect("Not idle with graduating stats: Graduated", end(activeGrad).ending === "Graduated" && end(activeGrad).wins);
    expect("Part 8: input before results() clears idle: Graduated", end(cameBack).ending === "Graduated", end(cameBack).ending);
    idleGrad.idle = false;
    expect("Ending stays locked after idle clears", g.results().find(r => r.player === idleGrad).ending === "Contract renewed");
    throws("Level 7 auto-placement refused after results()", () => g.autoPlacePoints(partial, {}));
  }
}

// Part 6: quiet heart buff. At round start, every non-Stuck player on a team with 3 or fewer active players
// (Team.active(): not Stuck, not idle) gets +1 heart, capped. Not shown on screen; logged for the host only.
{
  const types = ["coop", "indep", "contra", "coop", "indep", "contra", "coop", "coop", "indep", "contra", "coop", "coop", "indep", "contra", "coop"];
  const ps = types.map((t, i) => EP.Bots.makePlayer(800 + i, "Q" + i, t));
  let at = 0;
  const ts = [3, 4, 4, 4].map((n, i) => { const t = new EP.Team({ id: i, name: "QT" + i, members: ps.slice(at, at + n) }); at += n; return t; });
  const [three, four, fourIdle, fourStuck] = ts;
  const idler = fourIdle.members[0]; idler.idle = true;
  const stuck = fourStuck.members[0]; stuck.glitches = 2;
  const g = new EP.Game({ teams: ts, rng: NO });
  ps.forEach(p => p.hearts.spend(2));             // everyone at 1 heart so the +1 shows
  const full = three.members[2]; full.hearts.refill(2);   // already at the cap
  let before = new Map(ps.map(p => [p, p.hearts.count]));
  const gained = p => p.hearts.count - before.get(p);
  const logs = () => g.log.filter(e => e.event === "quietHeart");

  g.startNextRound();
  expect("Part 6: team with 3 active players: +1 heart each at round start",
         three.active().length === 3 && three.members.filter(p => p !== full).every(p => gained(p) === 1));
  expect("Part 6: capped at the normal max", full.hearts.count === 3, full.hearts.count);
  expect("Part 6: team with 4 active players gets nothing", four.active().length === 4 && four.members.every(p => gained(p) === 0));
  expect("Part 6: team of 4 with 1 idle (3 active) gets the buff, idle player included",
         fourIdle.active().length === 3 && fourIdle.members.every(p => gained(p) === 1));
  expect("Part 6: team of 4 with 1 Stuck (3 active): the 3 get the buff",
         fourStuck.members.filter(p => p !== stuck).every(p => gained(p) === 1));
  expect("Part 6: Stuck players get nothing", gained(stuck) === 0);
  expect("Part 6: logged for the host only (10 players)", logs().length === 1 && logs()[0].hostOnly && logs()[0].players.length === 10,
         logs().length + " entries");
  expect("Part 6: not shown on the Board (no hearts in board data)", !/heart/i.test(JSON.stringify(g.board())));

  // Once per round: no second buff while the round plays out.
  ps.forEach(p => { if (!p.isStuck()) { p.hearts.empty(); p.hearts.refill(1); } });   // back to 1 heart
  before = new Map(ps.map(p => [p, p.hearts.count]));
  g.advance();
  expect("Part 6: leaving the briefing gives no second buff", ps.every(p => gained(p) === 0));
  g.advance(); g.runTrial(); g.payTrialCosts(); g.advance(); g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance();
  g.computeEarnings(); EP.Bots.statsUpdate(g);
  expect("Part 6: the buff happens once per round (1 log entry after the whole round)", logs().length === 1, logs().length);
  g.finishRound(); g.startNextRound();
  expect("Part 6: the next round gets its own buff", logs().length === 2 && logs()[1].level === 2, logs().length);
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
