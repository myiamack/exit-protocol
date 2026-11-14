/* Spot test: gift rules.
   - Any teammate, any status except Stuck, during Open Floor or the gift window.
   - The receiver answers Accept or Decline. No answer by the end of the step = declined and refunded.
   - Accept: Glitching receiver -> the glitching attribute. Otherwise the lowest attribute that still has room.
     Ties: Focus, Collaboration, Initiative, Grit, Composure. Every attribute maxed -> refund.
   - Independents refuse automatically. Bots accept 80% (seeded, so results repeat).
   Run from the repo folder:  node Tests/check_gifts.js */
const path = require("path");
["Hearts", "CharacterType", "Player", "Team", "Round", "Sabotage", "Accusation", "Gift", "Vote", "Game", "bots"]
  .forEach(f => require(path.join(__dirname, "..", "rules", f + ".js")));
const EP = globalThis.EP;

let pass = 0, fail = 0;
function expect(label, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail !== undefined ? "  -> " + detail : ""));
  ok ? pass++ : fail++;
}
// Seeded random numbers, so every run gives the same result.
function seeded(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function setup() {
  const ps = ["coop", "coop", "indep", "contra"].map((t, i) => EP.Bots.makePlayer(i, "P" + i, t));
  const team = new EP.Team({ id: 0, name: "T", members: ps });
  const round = new EP.Round(1);
  return { ps, team, round };
}
const set = (p, a) => { p.attrs = { ...a }; };
const sendAccept = (round, g, r, team, pts) => {
  const res = EP.Gift.apply(round, g, r, team, pts);
  return res.ok && res.gift.status === "pending" ? EP.Gift.accept(round, res.gift) : res;
};
function gameOf(types) {
  const ps = types.map((t, i) => EP.Bots.makePlayer(i, "P" + i, t));
  const teams = [0, 1].map(i => new EP.Team({ id: i, name: "T" + i, members: ps.slice(i * 4, i * 4 + 4) }));
  return { ps, teams, game: new EP.Game({ teams, rng: () => 0.5 }) };
}

console.log("-- Accept, Decline, no answer");
{ // Sending: giver pays now, gift waits for an answer
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: 7 });
  const res = EP.Gift.apply(round, g, r, team, 2);
  expect("Sent gift is pending and nothing has landed yet", res.ok && res.gift.status === "pending" && r.attrs.composure === 2, res.gift && res.gift.status);
  expect("Giver pays when sending (3 -> 1)", g.hearts.count === 1, g.hearts.count);
  const acc = EP.Gift.accept(round, res.gift);
  expect("Accept: points land on the lowest attribute (Composure 2 -> 4)", acc.ok && r.attrs.composure === 4, JSON.stringify(r.attrs));
  expect("Accept: giver does not get the hearts back", g.hearts.count === 1, g.hearts.count);
  expect("A gift cannot be answered twice", !EP.Gift.decline(round, res.gift).ok);
}
{ // Decline: points go back to the giver
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: 7 });
  const res = EP.Gift.apply(round, g, r, team, 2);
  const dec = EP.Gift.decline(round, res.gift);
  expect("Decline: nothing lands", dec.ok && r.attrs.composure === 2, JSON.stringify(r.attrs));
  expect("Decline: giver gets the hearts back (1 -> 3)", g.hearts.count === 3, g.hearts.count);
  expect("Decline: status is declined", res.gift.status === "declined");
}
{ // No answer: declined and refunded when the step ends (Open Floor, then the gift window)
  const { ps, teams, game } = gameOf(Array(8).fill("coop"));
  game.startNextRound();
  const a = game.gift(ps[0], ps[1], 1);
  game.advance();   // Open Floor ends
  expect("No answer in Open Floor: expired when Open Floor ends", a.gift.status === "expired", a.gift.status);
  expect("No answer in Open Floor: giver refunded", ps[0].hearts.count === 3, ps[0].hearts.count);
  expect("An expired gift cannot be accepted later", !EP.Gift.accept(game.round, a.gift).ok);
  teams.forEach(t => game.setTrialResult(t, true)); game.payTrialCosts(); game.advance();
  game.endGlitchReport(); game.advance();
  const before = ps[2].hearts.count;
  const b = game.gift(ps[2], ps[3], 1);
  const total3 = ps[3].total();
  game.advance();   // gift window ends
  expect("No answer in the gift window: expired, refunded, nothing landed",
         b.gift.status === "expired" && ps[2].hearts.count === before && ps[3].total() === total3, b.gift.status);
}
{ // Answering is only allowed during Open Floor or the gift window
  const { ps, teams, game } = gameOf(Array(8).fill("coop"));
  game.startNextRound();
  const a = game.gift(ps[0], ps[1], 1);
  expect("Answer during Open Floor is allowed", game.answerGift(a.gift, true).ok);
  game.advance();
  expect("Answer during the Trial is refused", !game.answerGift(a.gift, true).ok);
}

console.log("-- Where accepted points land");
{ // Tie order: Focus, Collaboration, Initiative, Grit, Composure
  const cases = [
    [{ focus: 3, initiative: 3, collab: 3, composure: 3, grit: 3 }, "focus"],
    [{ focus: 4, initiative: 3, collab: 3, composure: 3, grit: 3 }, "collab"],
    [{ focus: 4, initiative: 3, collab: 4, composure: 3, grit: 3 }, "initiative"],
    [{ focus: 4, initiative: 4, collab: 4, composure: 3, grit: 3 }, "grit"],
  ];
  for (const [a, want] of cases) {
    const { ps: [g, r], team, round } = setup();
    set(r, a); sendAccept(round, g, r, team, 1);
    expect("Tie goes to " + want, r.attrs[want] === a[want] + 1, JSON.stringify(r.attrs));
  }
}
{ // Glitching: glitching attribute gets the points
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: -1 });
  const res = sendAccept(round, g, r, team, 2);
  expect("Glitching: points go to the glitching attribute (Grit -1 -> 1)", r.attrs.grit === 1, JSON.stringify(r.attrs));
  expect("Glitch cancelled, Lifeline credited to a Cooperative giver", res.cancelled && g.pathDone, g.pathProgress);
}
{ // No Lifeline for a gift to a healthy teammate
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 5, initiative: 4, collab: 6, composure: 2, grit: 7 });
  sendAccept(round, g, r, team, 1);
  expect("No Lifeline credit for a gift to a non-glitching teammate", g.pathProgress === 0, g.pathProgress);
}
{ // Maxed attribute
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 6, initiative: 4, collab: 7, composure: 5, grit: 5 });   // Cooperative: Initiative max 4
  sendAccept(round, g, r, team, 1);
  expect("Maxed attribute: lowest (Initiative 4) is maxed, point goes to Grit (tie with Composure goes to Grit)",
         r.attrs.initiative === 4 && r.attrs.grit === 6 && r.attrs.composure === 5, JSON.stringify(r.attrs));
}
{
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 6, initiative: 3, collab: 7, composure: 5, grit: 5 });
  sendAccept(round, g, r, team, 2);
  expect("Fills partway: Initiative 3 -> 4 (max), second point goes to Grit", r.attrs.initiative === 4 && r.attrs.grit === 6, JSON.stringify(r.attrs));
}
{
  const { ps: [g, r], team, round } = setup();
  set(r, { focus: 10, initiative: 4, collab: 10, composure: 10, grit: 10 });
  const before = g.hearts.count;
  sendAccept(round, g, r, team, 2);
  expect("All attributes maxed: nothing lands and the giver is refunded", r.total() === 44 && g.hearts.count === before, "hearts " + before + " -> " + g.hearts.count);
}

console.log("-- Who can gift");
{
  const { ps: [g, , ind], team, round } = setup();
  const before = g.hearts.count;
  const res = EP.Gift.apply(round, g, ind, team, 1);
  expect("Independent refuses automatically and the giver keeps hearts", res.refused && res.gift.status === "refused" && g.hearts.count === before);
}
{
  const { ps: [g, r, , c], team, round } = setup();
  r.glitches = 2;
  expect("Stuck player cannot receive a gift", !EP.Gift.apply(round, g, r, team, 1).ok);
  expect("Stuck player cannot give a gift", !EP.Gift.apply(round, r, c, team, 1).ok);
}
{
  const { ps, teams, game } = gameOf(Array(8).fill("coop"));
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

console.log("-- Bot answers (seeded)");
function botRate(seed, n) {
  const rng = seeded(seed);
  let yes = 0;
  for (let i = 0; i < n; i++) {
    const { ps, game } = gameOf(Array(8).fill("coop"));
    game.startNextRound();
    const res = game.gift(ps[0], ps[1], 1);
    EP.Bots.answer(game, res.gift, rng);
    if (res.gift.status === "accepted") yes++;
  }
  return yes / n;
}
{
  const r1 = botRate(7, 5000), r2 = botRate(7, 5000);
  expect("Bots accept about 80% of gifts (78% to 82%)", r1 >= 0.78 && r1 <= 0.82, (100 * r1).toFixed(1) + "%");
  expect("Same seed gives the same result run to run", r1 === r2, (100 * r2).toFixed(1) + "%");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
