/* Spot test: gift rules. Any teammate, any status, Open Floor or gift window.
   Glitching receiver: points go to the glitching attribute. Otherwise: lowest attribute.
   Ties: Focus, Collaboration, Initiative, Grit, Composure.
   Run from the repo folder:  node Tests/check_gifts.js */
const path = require("path");
["Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}
function setup() {
  const ps = ["coop", "coop", "indep", "contra"].map((t, i) => EP.Bots.makePlayer(i, "P" + i, t));
  const team = new EP.Team({ id: 0, name: "T", members: ps });
  const round = new EP.Round(1);
  return { ps, team, round };
}
const set = (p, a) => { p.attrs = { ...a }; };

{ // Not glitching: lowest attribute gets the points
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: 7 });
  const res = EP.Gift.apply(round, g, r, team, 1);
  expect("Non-glitching teammate can receive a gift", res.ok, res.reason);
  expect("Point goes to the lowest attribute (Composure 2 -> 3)", r.attrs.composure === 3, JSON.stringify(r.attrs));
  expect("No Lifeline credit for a gift to a non-glitching teammate", g.pathProgress === 0, g.pathProgress);
}
{ // Tie order: Focus, Collaboration, Initiative, Grit, Composure
  const cases = [
    [{ focus: 3, initiative: 3, collab: 3, composure: 3, grit: 3 }, "focus"],
    [{ focus: 4, initiative: 3, collab: 3, composure: 3, grit: 3 }, "collab"],
    [{ focus: 4, initiative: 3, collab: 4, composure: 3, grit: 3 }, "initiative"],
    [{ focus: 4, initiative: 4, collab: 4, composure: 3, grit: 3 }, "grit"],
  ];
  for (const [a, want] of cases) {
    const { ps: [g, r], team, round } = setup();
    set(r, a); EP.Gift.apply(round, g, r, team, 1);
    expect("Tie goes to " + want, r.attrs[want] === a[want] + 1, JSON.stringify(r.attrs));
  }
}
{ // Glitching: glitching attribute gets the points, even if another attribute is lower in tie order
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: -1 });
  const res = EP.Gift.apply(round, g, r, team, 2);
  expect("Glitching: points go to the glitching attribute (Grit -1 -> 1)", r.attrs.grit === 1, JSON.stringify(r.attrs));
  expect("Glitch cancelled, Lifeline credited to a Cooperative giver", res.cancelled && g.pathDone, g.pathProgress);
}
{ // Maxed attribute: the lowest attribute is at its max, so the gift goes to the lowest one with room
  const { ps: [g, r], team, round } = setup();
  // Cooperative: Initiative is the weak attribute, max 4
  set(r, { focus: 6, initiative: 4, collab: 7, composure: 5, grit: 5 });
  EP.Gift.apply(round, g, r, team, 1);
  if (EP.Gift.accept) EP.Gift.accept(round, round.gifts[round.gifts.length - 1]);
  expect("Lowest (Initiative 4) is maxed: point goes to Grit, lowest with room (tie with Composure goes to Grit)",
         r.attrs.initiative === 4 && r.attrs.grit === 6 && r.attrs.composure === 5, JSON.stringify(r.attrs));
}
{ // An attribute fills up partway through a 2-point gift
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 6, initiative: 3, collab: 7, composure: 5, grit: 5 });
  EP.Gift.apply(round, g, r, team, 2);
  if (EP.Gift.accept) EP.Gift.accept(round, round.gifts[round.gifts.length - 1]);
  expect("2 points: Initiative 3 -> 4 (max), second point goes to Grit", r.attrs.initiative === 4 && r.attrs.grit === 6, JSON.stringify(r.attrs));
}
{ // Every attribute at max: the giver is refunded
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 10, initiative: 4, collab: 10, composure: 10, grit: 10 });
  const before = g.backup;
  EP.Gift.apply(round, g, r, team, 2);
  if (EP.Gift.accept) EP.Gift.accept(round, round.gifts[round.gifts.length - 1]);
  expect("All attributes maxed: nothing lands and the giver gets the backup back", r.total() === 44 && g.backup === before, "backup " + before + " -> " + g.backup);
}
{ // Independent receiver still refuses; giver keeps backup
  const { ps: [g, , ind], team, round } = setup();
  const before = g.backup;
  const res = EP.Gift.apply(round, g, ind, team, 1);
  expect("Independent refuses the gift and the giver keeps backup", res.refused && g.backup === before);
}
{ // Game steps: Open Floor and Gift window allowed, other steps refused
  const ps = ["coop", "coop", "coop", "coop", "coop", "coop", "coop", "coop"].map((t, i) => EP.Bots.makePlayer(i, "P" + i, t));
  const teams = [0, 1].map(i => new EP.Team({ id: i, name: "T" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  const game = new EP.Game({ teams, rng: () => 0.5 });
  game.startNextRound();
  expect("Gift in Open Floor", game.gift(ps[0], ps[1], 1).ok);
  expect("Gift to another team is refused", !game.gift(ps[0], ps[5], 1).ok);
  game.advance();
  expect("Gift in Trial is refused", !game.gift(ps[0], ps[1], 1).ok);
  teams.forEach(t => game.setTrialResult(t, true)); game.payTrialCosts(); game.advance();
  expect("Gift in Glitch Report is refused", !game.gift(ps[0], ps[1], 1).ok);
  game.endGlitchReport(); game.advance();
  expect("Gift in Gift window", game.gift(ps[0], ps[1], 1).ok);
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
