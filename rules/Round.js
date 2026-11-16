/* Round: one level. Trial attribute, cost, how it is scored, and the step order. */

// Package A order. Trial activities stay in their original levels.
const LEVELS = [
  { n: 1, name: "Boot Up",    trial: "SOP mini-game",                attr: "grit",       cost: 2, judged: false, trialKind: "sop" },
  { n: 2, name: "Sprint 1",   trial: "Prioritize against a timer",   attr: "collab",     cost: 3, judged: false, trialKind: "auto" },
  { n: 3, name: "The Mirror", trial: "Q&A gauntlet",                 attr: "focus",      cost: 3, judged: false, trialKind: "auto" },
  { n: 4, name: "Geek Week",  trial: "Testing challenge",            attr: "initiative", cost: 4, judged: false, trialKind: "auto" },
  { n: 5, name: "Sprint 2",   trial: "Fix the broken team",          attr: "composure",  cost: 4, judged: true,  trialKind: "judged" },
  { n: 6, name: "Sprint 3",   trial: "Final build and dream speech", attr: "composure",  cost: 5, judged: true,  trialKind: "judged" },
  { n: 7, name: "Graduation", trial: "Crack the simulation",         attr: null,         cost: 0, judged: false, trialKind: null }
];

// Every level opens with a briefing (no player actions). Level 7: briefing, then graduation.
const STEPS = ["briefing", "openFloor", "trial", "glitchReport", "giftWindow", "lockIn", "statsUpdate"];
const FINAL_STEPS = ["briefing", "graduation"];

class Round {
  constructor(levelNumber) {
    const lv = LEVELS[levelNumber - 1];
    if (!lv) throw new Error("No level " + levelNumber);
    Object.assign(this, lv);
    this.isFinal = lv.n === 7;
    this.stepIndex = 0;
    this.sabotages = [];    // { actor, target, drain, cost }
    this.accusations = [];  // { accuser, target, correct }
    this.gifts = [];        // { giver, receiver, pts, cost, refused, cancelled }
    this.completed = new Set();   // one-time Game actions already run this round
  }
  static get LEVELS() { return LEVELS; }
  static get STEPS() { return STEPS; }
  get steps() { return this.isFinal ? FINAL_STEPS : STEPS; }
  get step() { return this.steps[this.stepIndex]; }
  nextStep() { if (this.stepIndex < this.steps.length - 1) this.stepIndex += 1; return this.step; }
  saboteurs() { return [...new Set(this.sabotages.map(s => s.actor))]; }
  /* Total drained from this player by sabotage this round. */
  drainOn(p) { return this.sabotages.filter(s => s.target === p).reduce((n, s) => n + s.drain, 0); }
  /* Teammates caught sabotaging this round by a correct accusation (each once), leaving out one player. */
  caughtOn(team, except = null) {
    return [...new Set(this.accusations.filter(a => a.correct && team.has(a.target) && a.target !== except).map(a => a.target))];
  }

  /* Save (Part 13): plain data, players by id. The level's fixed data (name, attr, cost...) comes back from LEVELS. */
  toJSON() {
    const id = p => p.id;
    const out = {
      n: this.n, stepIndex: this.stepIndex, completed: [...this.completed],
      sabotages: this.sabotages.map(s => ({ ...s, actor: s.actor.id, target: s.target.id })),
      accusations: this.accusations.map(a => ({ ...a, accuser: a.accuser.id, target: a.target.id })),
      gifts: this.gifts.map(g => ({ ...g, giver: g.giver.id, receiver: g.receiver.id })),
    };
    if (this.trial && typeof this.trial === "object") out.trialState = this.trial.toJSON();
    if (this.quietHearts) out.quietHearts = this.quietHearts.map(id);
    if (this.gritBonus) out.gritBonus = this.gritBonus.map(id);
    for (const k of ["sopBoards", "sopResults", "earnings", "done"]) if (this[k] !== undefined) out[k] = JSON.parse(JSON.stringify(this[k]));
    return out;
  }
  /* Load. trialFromJSON rebuilds the trial (passed in so Round does not need to know the Trial class). */
  static fromJSON(data, { byId, trialFromJSON }) {
    const r = new Round(data.n);
    const P = id => byId.get(id);
    r.stepIndex = data.stepIndex;
    r.completed = new Set(data.completed);
    r.sabotages = data.sabotages.map(s => ({ ...s, actor: P(s.actor), target: P(s.target) }));
    r.accusations = data.accusations.map(a => ({ ...a, accuser: P(a.accuser), target: P(a.target) }));
    r.gifts = data.gifts.map(g => ({ ...g, giver: P(g.giver), receiver: P(g.receiver) }));
    if (data.trialState) r.trial = trialFromJSON(data.trialState);
    if (data.quietHearts) r.quietHearts = data.quietHearts.map(P);
    if (data.gritBonus) r.gritBonus = data.gritBonus.map(P);
    for (const k of ["sopBoards", "sopResults", "earnings", "done"]) if (data[k] !== undefined) r[k] = JSON.parse(JSON.stringify(data[k]));
    return r;
  }
}

export { Round };
