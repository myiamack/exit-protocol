const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, HeadingLevel, LevelFormat, PageBreak, Footer,
  PageNumber, BorderStyle, TableOfContents
} = require("docx");

const D = JSON.parse(fs.readFileSync("data.json"));
const DG = JSON.parse(fs.readFileSync("diag.json"));
const V = JSON.parse(fs.readFileSync("verify_all.json"));
const G = JSON.parse(fs.readFileSync("grid_all.json"));

const W = 10080; // content width (DXA)
const f1 = (x) => x.toFixed(1);
const f0 = (x) => Math.round(x).toString();
const gap = (a) => Math.max(...a) - Math.min(...a);
const worst = (rows, m) => Math.max(...rows.map((r) => gap(r[m])));
const NAMES = { initiative: "Initiative", focus: "Focus", composure: "Composure", collab: "Collaboration", grit: "Grit" };
const setLabel = (r) => `${r.style === "typical" ? "Typical" : "Careful"}, ${r.acc < 0.4 ? "random 33%" : "better 50%"}`;

// ---------- helpers ----------
const P = (text, opts = {}) => new Paragraph({
  spacing: { after: 120 }, ...opts,
  children: Array.isArray(text) ? text : [new TextRun(text)],
});
const B = (t) => new TextRun({ text: t, bold: true });
const T = (t) => new TextRun(t);
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (children) => new Paragraph({
  numbering: { reference: "bul", level: 0 }, spacing: { after: 80 },
  children: Array.isArray(children) ? children : [new TextRun(children)],
});
const note = (t) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: t, italics: true, size: 18 })] });

const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, w, head = false, fill) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { fill: "D9D9D9", type: ShadingType.CLEAR, color: "auto" } :
      fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: head, size: 17 })] })],
  });
}
function table(headers, rows, widths, highlight = []) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const ws = widths.map((w) => Math.round((w * W) / sum));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, ws[i], true)) }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) => cell(c, ws[i], false, highlight.includes(ri) ? "FFF2CC" : undefined)),
      })),
    ],
  });
}
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// Per-setting table for one data key
function settingTable(key, showPaths = false) {
  const rows = D[key].map((r) => {
    const base = [setLabel(r), f0(r.all),
      r.grad.map(f1).join(" / "), f1(gap(r.grad)),
      r.any.map(f1).join(" / "), f1(gap(r.any))];
    if (showPaths) base.push(r.path.map(f0).join(" / "));
    return base;
  });
  const h = ["Setting", "All grad %", "Graduate C / I / X", "Gap", "Any win C / I / X", "Gap"];
  const w = [20, 9, 22, 7, 22, 7];
  if (showPaths) { h.push("Lifeline / Auditor / Exploit %"); w.push(17); }
  return table(h, rows, w);
}
function summaryRow(label, key, extra = "") {
  return [label, f1(worst(D[key], "grad")), f1(worst(D[key], "any")),
    D[key].map((r) => f0(r.all)).join(", "), extra];
}

// ---------- content ----------
const c = [];

// Title
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: "Performance_Review: Exit_ProtocoL", bold: true, size: 36 })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: "Rules v2: Type Balance Test Report", bold: true, size: 30 })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
  children: [new TextRun({ text: "Draft for Ben Coppage to vet  ·  November 12, 2026  ·  No Base44 credits used", size: 20 })] }));
c.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
c.push(note("If the contents list is blank, right-click it and choose Update Field."));
c.push(new Paragraph({ children: [new PageBreak()] }));

// 1 Summary
c.push(H1("1. Summary"));
c.push(P([B("Goal. "), T("Win rates of the three types within 1 to 3 points of each other. No type ability nerfed. Overall win rate matters less, as long as the game stays fun.")]));
c.push(P([B("Starting point. "), T(`Rules v2 as written has a worst type gap of ${f1(worst(D.base, "grad"))} points for graduation and ${f1(worst(D.base, "any"))} points for any win, at a 50% trial win rate.`)]));
c.push(P([B("Best package found (Package A). "), T("Three changes, all buffs or reorders:")]));
c.push(bullet("Reorder which attribute each level tests. Costs stay the same."));
c.push(bullet("Lifeline goal: 2 rescues down to 1."));
c.push(bullet("Exploit goal: 3 uncaught sabotage rounds down to 2."));
c.push(P([B("Result. "), T(`Worst gap drops to ${f1(worst(D.A, "grad"))} for graduation and ${f1(worst(D.A, "any"))} for any win. With random guessing, any win is within about 1 point for both play styles. That meets the 1 to 3 point target in those settings.`)]));
c.push(P([B("Limit. "), T("No fixed rule set met 1 to 3 points in every setting. Balance shifts with three things the rules do not control: how often teams win trials, how well players guess the saboteur, and how players spend points. At a 30% trial win rate, Package A gaps reach 13 points.")]));
c.push(P([B("Decision needed. "), T("Balance for one target condition, or add host dials set before each game. See section 9.")]));

// 2 Definitions
c.push(H1("2. Terms used in this report"));
c.push(table(["Term", "Meaning"], [
  ["Graduate %", "Share of players of a type who pass the round 7 check: total 22 or more, every attribute 2 or more, not Stuck."],
  ["Any win %", "Share who graduate OR complete their second path (Lifeline, Auditor, Exploit). This is the closest match to \"win rate of each type.\""],
  ["C / I / X", "Cooperative / Independent / Contrarian, always in that order."],
  ["Gap", "Highest type % minus lowest type % in one setting."],
  ["Worst gap", "The largest gap across the four test settings. This is the main balance score. Lower is better."],
  ["Setting", "One combination of play style (typical or careful) and guessing skill (random 33% or better 50%)."],
  ["Trial win rate", "Chance a team wins a trial. The host enters win or loss. Default test value: 50%."],
  ["Nerf", "A change that makes a type ability weaker. Ruled out by the goal."],
], [18, 82]));
c.push(spacer());

// 3 Rules as tested
c.push(H1("3. Rules as tested (rules v2 plus Package A)"));
c.push(P("Source: OOAD Class Reference v2 and Base44 Build Prompts v2 (Nov 11, 2026). Rows marked Package A are proposed changes. Everything else is rules v2 as written."));
c.push(H2("3.1 Levels and trial costs"));
c.push(table(["Level", "Trial", "v2 attribute", "Package A attribute", "Cost"], [
  ["1 Boot Up", "SOP mini-game", "Initiative", "Grit", "2"],
  ["2 Sprint 1", "Prioritize against a timer", "Focus", "Collaboration", "3"],
  ["3 The Mirror", "Q&A gauntlet", "Composure", "Focus", "3"],
  ["4 Geek Week", "Testing challenge", "Focus", "Initiative", "4"],
  ["5 Sprint 2", "Fix the broken team", "Collaboration", "Composure", "4"],
  ["6 Sprint 3", "Final build and dream speech", "Grit", "Grit", "6"],
  ["7 Graduation", "Crack the simulation", "All five", "All five", "none"],
], [16, 30, 18, 20, 10]));
c.push(spacer());
c.push(H2("3.2 Character creation and types"));
c.push(table(["Rule", "Value"], [
  ["Free points", "1 in each attribute (5)"],
  ["Points to spend", "15"],
  ["Type boost", "+2 in each of two bonus attributes"],
  ["Starting total", "24"],
  ["Max per attribute", "10. Penalty attribute max 4. Boost counts toward max."],
  ["Starting backup", "3. Cap 3. Refills 1 per round."],
], [30, 70]));
c.push(spacer());
c.push(table(["Type", "Bonus", "Penalty (max 4)", "Gift cost", "Incentive", "Disincentive", "Second path"], [
  ["Cooperative", "Collaboration, Composure", "Initiative", "1 backup per point", "Cheapest gifts", "Empathy: lose 1 backup when a teammate's glitch locks in", "Lifeline: v2 goal 2, Package A goal 1"],
  ["Independent", "Focus, Grit", "Collaboration", "1 pt = 2, 2 pts = 3", "Cash Out: 2 backup to 1 point, once, needs full backup", "Cannot accept gifts", "Auditor: 1 own correct accusation"],
  ["Contrarian", "Initiative, Grit", "Composure", "1 backup per point", "Skim: +1 per uncaught sabotage round, max 2", "Sabotage costs backup. Caught: no more sabotage, Exploit lost", "Exploit: v2 goal 3 rounds, Package A goal 2"],
], [12, 14, 11, 12, 17, 18, 16]));
c.push(spacer());
c.push(H2("3.3 Round rules"));
c.push(table(["Rule", "Value"], [
  ["Points earned", "Team wins trial 4. Loses 2. Glitched that round 1. Round 7: 3."],
  ["Point bonuses", "+1 for a correct accusation (lands at Stats Update). Skim and Cash Out as above."],
  ["Trial cost", "Paid from the tested attribute. Backup covers a shortfall: 1 backup per point in a bonus attribute, 2 in any other."],
  ["Already Glitching", "Pays no trial cost that round."],
  ["Glitch", "Any attribute below 0. Exactly 0 is safe."],
  ["Gift window", "About 30 seconds after accusations. A gift that brings the attribute to 0 or more cancels the glitch."],
  ["Reboot", "Points taken evenly from other attributes until the glitched one reaches 1. Shortfall forgiven. Backup set to 0."],
  ["Stuck", "Second locked glitch. Spectator for the rest of the game."],
  ["Sabotage", "Contrarian only, teammates only, not Stuck targets. Cost 1 backup, then 2 for each extra in a round. Drain 2 from the target's trial attribute, 1 if target Composure is 6 or more."],
  ["Accusation", "One per player per round, against a teammate. Correct: +1 point. Wrong: accuser loses 1 attribute point."],
  ["Caught", "Contrarian loses 0 points. No more sabotage. Exploit lost."],
  ["At risk flag", "Shown if any attribute cannot cover a cost of 4."],
  ["Graduation", "Total 22 or more, every attribute 2 or more, not Stuck. Backup does not count."],
], [22, 78]));
c.push(spacer());

// 4 Package A
c.push(H1("4. Package A: changes and evidence"));
c.push(table(["Change", "Was", "Now", "Type", "Evidence (section)"], [
  ["Trial attribute order", "Init, Focus, Comp, Focus, Collab, Grit", "Grit, Collab, Focus, Init, Comp, Grit", "Reorder", `Worst graduation gap ${f1(worst(D.base, "grad"))} to ${f1(worst(D.only_sched, "grad"))} on its own (6.5)`],
  ["Lifeline goal", "2", "1", "Buff (Coop)", `Coop any win rises. With the reorder, any-win gap ${f1(worst(D.only_sched, "any"))} to ${f1(worst(D.sched_lifeline, "any"))} (6.5)`],
  ["Exploit goal", "3", "2", "Buff (Contra)", `Adds to Contrarian any win. Final any-win gap ${f1(worst(D.A, "any"))} (6.5)`],
], [16, 22, 22, 12, 28]));
c.push(spacer());
c.push(P([B("Not changed: "), T("Empathy, Cash Out, Skim, sabotage cost and drain, gift costs, Independent gift refusal, penalty max 4, point earning, graduation rule. No ability was nerfed.")]));

// 5 Method
c.push(H1("5. How the test works"));
c.push(P("A simulation is a program that plays many games with computer players (bots) and counts results. It was written in Python from the v2 rules in the OOAD doc, because the performance_review repo was not reachable from the test machine."));
c.push(table(["Setting", "Value"], [
  ["Players", "16: 8 Cooperative, 5 Independent, 3 Contrarian, types shuffled each game"],
  ["Teams", "4 teams of 4, fixed (no team switching)"],
  ["Games", "2,000 per setting for all section 6 tables unless noted. Fixed random seed 2026."],
  ["Trial win rate", "50% default. 30% and 70% also tested."],
  ["Guessing skill", "Chance an accuser picks the real saboteur: 33% (random, 1 of 3 teammates) or 50%"],
  ["Play styles", "Typical: spends 5/4/3/2/1 at creation, bonus first, penalty last; half of earned points to bonus attributes. Careful: spreads creation evenly; earned points to lowest attribute."],
], [22, 78]));
c.push(spacer());
c.push(H2("5.1 Bot behavior assumptions"));
[
  "Contrarians sabotage in 50% of rounds if not locked out and backup is 1 or more. One sabotage per round. They target At risk teammates first.",
  "In a round with a sabotage on the team, the victim accuses 90% of the time. Each other teammate accuses 25%. In a round with no sabotage, each player accuses 5%.",
  "Contrarians also accuse at these rates, so they pay wrong-accusation costs like everyone else.",
  "Gifts happen only in the gift window, to Glitching teammates. Cooperatives always gift if they can. Others gift 25% of the time. Gift size 2 if affordable, else 1. Receivers accept and place points in their lowest attribute.",
  "Bots do not gift to Independents (the gift would be refused and refunded, with no effect).",
  "Independents use Cash Out at the first Stats Update with full backup.",
  "In round 7, bots first raise any attribute below 2.",
  "Backup does not cover a sabotage drain (as written in v2). Section 7.4 shows this choice does not change results.",
].forEach((t) => c.push(bullet(t)));
c.push(H2("5.2 How much the numbers move by chance"));
const seeds = [["Seed 2026", "A"], ["Seed 7", "A_seed2"], ["Seed 99", "A_seed3"]];
c.push(P("Package A was run three times with different random seeds, 2,000 games each. The spread shows how much a result can move from chance alone."));
c.push(table(["Run", "Worst graduation gap", "Worst any-win gap", "All grad % by setting"],
  seeds.map(([l, k]) => [l, f1(worst(D[k], "grad")), f1(worst(D[k], "any")), D[k].map((r) => f0(r.all)).join(", ")]),
  [20, 25, 25, 30]));
c.push(note("Conclusion: worst gaps move by about 1 to 2 points between runs. A difference under 2 points between two options is not reliable."));

// 6 Results
c.push(new Paragraph({ children: [new PageBreak()] }));
c.push(H1("6. Results"));
c.push(H2("6.1 Rules v2 as written"));
c.push(settingTable("base", true));
c.push(note("Trial win rate 50%. C / I / X = Cooperative / Independent / Contrarian."));
c.push(P([B("Finding: "), T(`Typical Contrarians lead (${f1(D.base[0].grad[2])}% graduate vs about 76%). Careful Contrarians trail when guessing is better (${f1(D.base[3].grad[2])}%). The direction of the imbalance flips with play style, so one flat buff cannot fix both.`)]));
c.push(table(["Trial win rate", "Worst graduation gap", "Worst any-win gap", "All grad % by setting"],
  [["30%", "base30"], ["50%", "base"], ["70%", "base70"]].map(([l, k]) =>
    [l, f1(worst(D[k], "grad")), f1(worst(D[k], "any")), D[k].map((r) => f0(r.all)).join(", ")]),
  [20, 25, 25, 30]));
c.push(note("Balance gets worse as the trial win rate falls."));

c.push(H2("6.2 Why v2 is unbalanced"));
const dgRows = [];
for (const [k, lab] of [["base|typical|0.33", "v2, typical, random"], ["base|careful|0.5", "v2, careful, better"], ["A|typical|0.33", "Package A, typical, random"], ["A|careful|0.5", "Package A, careful, better"]]) {
  dgRows.push([lab, ...["coop", "ind", "contra"].map((t) => `${f1(DG[k][t][0])} / ${f0(DG[k][t][1])}% / ${f0(DG[k][t][2])}%`)]);
}
c.push(table(["Setting", "Cooperative", "Independent", "Contrarian"], dgRows, [28, 24, 24, 24]));
c.push(note("Each cell: average final total / % glitched at least once / % sabotaged at least once. 2,000 games, seed 2026."));
[
  "Typical Cooperatives glitch far more often (about 67%) than the other types (about 1% to 14%). A likely cause: the costliest trial (round 6, cost 6) tests Grit, which is a bonus attribute for Independents and Contrarians but not Cooperatives. This is an inference from the rules, not a separate test.",
  `Contrarians are sabotaged least, because they are the saboteurs. Under v2, players sabotaged at least once graduate ${D.base.map((r) => f0(r.sab[0])).join(", ")}% vs ${D.base.map((r) => f0(r.sab[1])).join(", ")}% for players never sabotaged (by setting).`,
  "Under v2, Contrarians end with the highest average total in the typical setting (24.6). Skim adds up to 2 points and being caught costs 0.",
  "Lifeline almost never completes (0.4% to 4.7%). Careful players rarely glitch, so there is no one to rescue.",
].forEach((t) => c.push(bullet(t)));

c.push(H2("6.3 Search 1: which attribute each level tests"));
c.push(P("Each level's cost stayed fixed (2, 3, 3, 4, 4, 6). The test tried every way to assign the five attributes to the six levels, with each attribute used at least once. That is 1,800 orders."));
[
  "Screening: every order, 200 games, two extreme settings (typical random, careful better), graduation gap only. Seed 7.",
  "The current v2 order ranked 281 of 1,800 in screening.",
  "Check: the best 24 orders from screening rerun at 1,500 games in all four settings. Seed 11.",
].forEach((t) => c.push(bullet(t)));
const vRows = V.slice(0, 8).map((x, i) => [String(i + 1), x[1].map((k) => NAMES[k]).join(", "), f1(x[0]), x[3].join(", ")]);
c.push(table(["Rank", "Order (levels 1 to 6)", "Worst grad gap", "All grad % by setting"], vRows, [7, 55, 14, 24], [4]));
c.push(note("Highlighted: the order used in Package A. It ranks 5th on graduation alone but did best in combination with the buffs (6.4). It also keeps Grit at round 6, matching the Sprint 3 theme. Order 1 is the next-best alternative."));

c.push(H2("6.4 Search 2: buffs on top of the best orders"));
c.push(P("96 combinations: 3 orders (top 3 from 6.3) x Empathy on or off x Lifeline goal 1 or 2 x Cooperative backup cap 3 or 4 x Exploit goal 2 or 3 x Cooperative penalty max 4 or 5. 600 games per setting, seed 7."));
const orderName = { S1: "Order 1", S2: "Order 3", S3: "Package A order" };
const gRows = G.slice(0, 8).map((x) => [orderName[x[2]], x[3] ? "On" : "Off", String(x[4]), String(x[5]), String(x[6]), String(x[7]), f1(x[1]), f1(x[0])]);
c.push(table(["Order", "Empathy", "Lifeline goal", "Coop backup cap", "Exploit goal", "Coop penalty max", "Worst grad gap", "Worst any gap"], gRows, [18, 10, 10, 11, 10, 11, 15, 15], [1]));
c.push(note("Sorted by the larger of the two gaps. Highlighted: Package A. The top row differs only by Empathy off, which tied within chance (5.2) and changes a Cooperative trait, so the simpler option was kept. Every top result uses the Package A order and Exploit goal 2."));

c.push(H2("6.5 What each change does on its own"));
c.push(table(["Rules", "Worst grad gap", "Worst any gap", "All grad % by setting", "Note"], [
  summaryRow("v2 as written", "base"),
  summaryRow("Reorder only", "only_sched", "Main graduation fix"),
  summaryRow("Lifeline goal 1 only", "only_lifeline", "Worse alone: Coop any win jumps"),
  summaryRow("Exploit goal 2 only", "only_exploit"),
  summaryRow("Reorder + Lifeline 1", "sched_lifeline"),
  summaryRow("Package A (all three)", "A", "Best overall"),
], [26, 13, 13, 22, 26], [5]));
c.push(note("2,000 games, seed 2026, trial win rate 50%. Lifeline goal 1 only helps when paired with the reorder."));

c.push(H2("6.6 Package A, full results"));
c.push(settingTable("A", true));
c.push(note("Trial win rate 50%."));
c.push(P([B("Finding: "), T(`With random guessing, any win is within ${f1(gap(D.A[0].any))} (typical) and ${f1(gap(D.A[1].any))} (careful) points. With better guessing, Contrarians trail on any win by up to ${f1(worst(D.A, "any"))} points because they are caught more and lose Exploit.`)]));
c.push(table(["Trial win rate", "Worst graduation gap", "Worst any-win gap", "All grad % by setting"],
  [["30%", "A30"], ["50%", "A"], ["70%", "A70"]].map(([l, k]) =>
    [l, f1(worst(D[k], "grad")), f1(worst(D[k], "any")), D[k].map((r) => f0(r.all)).join(", ")]),
  [20, 25, 25, 30]));
c.push(settingTable("A30", true));
c.push(note("Trial win rate 30%. Many more players glitch, so Lifeline (goal 1) completes often and Cooperative any win pulls ahead."));
c.push(P([B("Sabotage victims: "), T(`under Package A at 50%, sabotaged players graduate ${D.A.map((r) => f0(r.sab[0])).join(", ")}% vs ${D.A.map((r) => f0(r.sab[1])).join(", ")}% for players never sabotaged (by setting). Sabotage stays the most punishing event in the game.`)]));

// 7 Rejected
c.push(new Paragraph({ children: [new PageBreak()] }));
c.push(H1("7. Options tested and rejected"));
c.push(H2("7.1 Nerfs to the Contrarian (ruled out by the goal)"));
c.push(table(["Rules (v2 order)", "Worst grad gap", "Worst any gap", "All grad % by setting"], [
  summaryRow("v2 as written", "base").slice(0, 4),
  summaryRow("Caught loses 1 point", "nerf_caught1").slice(0, 4),
  summaryRow("Caught loses 2 points", "nerf_caught2").slice(0, 4),
  summaryRow("Skim max 1", "nerf_skim1").slice(0, 4),
  summaryRow("Skim off", "nerf_skim0").slice(0, 4),
], [34, 18, 18, 30]));
c.push(note("Every nerf makes the worst gap larger, because careful Contrarians already trail. Nerfs fail on the data as well as on the goal."));
c.push(H2("7.2 Other buffs"));
c.push(table(["Rules", "Worst grad gap", "Worst any gap", "Why rejected"], [
  [`Package A`, f1(worst(D.A, "grad")), f1(worst(D.A, "any")), "Baseline for comparison"],
  ["A + Empathy off + Coop backup cap 4", f1(worst(D.rej_emp_cap, "grad")), f1(worst(D.rej_emp_cap, "any")), "Typical Cooperatives jump ahead; Independents fall behind"],
  ["A + caught Contrarian locked out 1 round only", f1(worst(D.rej_lock_e2, "grad")), f1(worst(D.rej_lock_e2, "any")), "Contrarians pull ahead with random guessing"],
  ["Same, with Exploit goal 3", f1(worst(D.rej_lock_e3, "grad")), f1(worst(D.rej_lock_e3, "any")), "Graduation gap stays wide"],
], [36, 14, 14, 36]));
c.push(spacer());
c.push(H2("7.3 Difficulty dials"));
c.push(table(["Rules (v2 order)", "Worst grad gap", "Worst any gap", "All grad % by setting"], [
  summaryRow("v2 as written", "base").slice(0, 4),
  summaryRow("Round 6 cost 7", "r6_7").slice(0, 4),
  summaryRow("Graduation total 23", "grad23").slice(0, 4),
], [34, 18, 18, 30]));
c.push(note("Both dials lower overall graduation but widen type gaps. Under the balance goal, neither is recommended. If the team wants a harder game later, retest the dial on Package A first."));
c.push(H2("7.4 Rule gaps that do not affect balance"));
c.push(table(["Rule gap", "Option tested", "Worst grad gap", "Worst any gap"], [
  ["(baseline)", "v2 as written", f1(worst(D.base, "grad")), f1(worst(D.base, "any"))],
  ["Does backup cover a sabotage drain?", "Yes", f1(worst(D.drain_backup, "grad")), f1(worst(D.drain_backup, "any"))],
  ["Does a Glitching player pay the trial cost?", "Yes", f1(worst(D.glitch_pays, "grad")), f1(worst(D.glitch_pays, "any"))],
], [38, 18, 22, 22]));
c.push(note("Both changes move results by under 1 point, which is within chance. Choose whichever is simpler to explain and build."));

// 8 Limits
c.push(H1("8. Limits"));
[
  "Bots are not people. Real players bluff, coordinate, and target friends. Treat results as direction, not exact numbers.",
  "Chance alone moves worst gaps by 1 to 2 points (5.2). A 1-point target is at the edge of what this test can measure.",
  "Balance depends on trial win rate, guessing skill, and play style. None of these are rule settings. No tested rule set met 1 to 3 points in all of them.",
  "Teams were fixed. Team switching (teams of 3 to 5) was not simulated.",
  "Only one sabotage per round per Contrarian was simulated. v2 allows more at a higher cost.",
  "The clue system and special abilities are not designed yet and were not tested.",
  "This simulation was rebuilt from the OOAD doc. It has not been checked against the original sim in the performance_review repo.",
  "The reorder changes the story fit of three levels (for example, The Mirror Q&A now tests Focus, not Composure). The team should confirm the themes still work.",
].forEach((t) => c.push(bullet(t)));

// 9 Decisions
c.push(H1("9. Decisions for the team"));
c.push(table(["#", "Decision", "Options"], [
  ["1", "How to balance", "A: Balance for one target condition (for example 50% trial win rate, random guessing), where Package A meets the target. B: Add host dials (Lifeline goal, Exploit goal) set before each game for the group."],
  ["2", "Adopt Package A?", "Approve, or pick order 1 from 6.3 and retest."],
  ["3", "Level themes after the reorder", "Confirm each trial still fits its new attribute."],
  ["4", "Rule gap: backup and sabotage drain", "Either choice. No effect on balance (7.4)."],
  ["5", "Rule gap: Glitching player and trial cost", "Either choice. No effect on balance (7.4)."],
  ["6", "Paper playtest", "Schedule it. It is the only test of real guessing skill."],
], [5, 30, 65]));
c.push(spacer());

// 10 Corrections
c.push(H1("10. Corrections to earlier chat numbers"));
c.push(P("Earlier runs in chat used fewer settings, different seeds, and in some runs Contrarian bots did not accuse. This report reruns everything under one setup. Three earlier statements change:"));
[
  "Round 6 cost 7 was described as keeping careful and typical players even. That is true for overall graduation, but it widens the type gap (7.3). It is no longer recommended.",
  "\"Caught loses 1 + Skim max 1\" was described as the best balance package. That was measured mainly in one setting. Across all four settings, Contrarian nerfs widen the gap (7.1). It is also ruled out as a nerf.",
  "Exact percentages in this report differ from chat by 1 to 3 points because of the larger, consistent rerun. Use this report's numbers.",
].forEach((t) => c.push(bullet(t)));

// 11 Reproduce
c.push(H1("11. Files and how to rerun"));
c.push(table(["File", "What it does"], [
  ["sim_v2.py", "The game simulation. Rule switches are named settings at the top of the file."],
  ["bal.py", "Resets to rules v2 and scores the four settings."],
  ["gen_data.py", "Produces every section 6 and 7 table (data.json). Run: python gen_data.py"],
  ["diag.py", "Produces the section 6.2 table (diag.json)."],
  ["search.py, verify.py", "Section 6.3 order search (screen, then check)."],
  ["grid.py", "Section 6.4 buff search."],
  ["build_doc.js", "Builds this document from the JSON files."],
], [25, 75]));

// ---------- document ----------
const doc = new Document({
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Arial", size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Arial", size: 23, bold: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Exit_ProtocoL  ·  Rules v2 Type Balance Report  ·  Page ", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })] })] }) },
    children: c,
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("Exit_ProtocoL_Rules_v2_Balance_Report.docx", b); console.log("written"); });
