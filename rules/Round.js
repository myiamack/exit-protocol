/* Round: one level. Trial attribute, cost, how it is scored, and the step order. */
import { Accusation } from "./Accusation.js";
import { CharacterType } from "./CharacterType.js";
import { Gift } from "./Gift.js";
import { Sabotage } from "./Sabotage.js";

// Package A order. Trial activities stay in their original levels.
const LEVELS = [
  { n: 1, name: "Boot Up",    trialName: "SOP mini-game",                attr: "grit",       cost: 2, judged: false, trialKind: "sop" },
  { n: 2, name: "Sprint 1",   trialName: "Prioritize against a timer",   attr: "collab",     cost: 3, judged: false, trialKind: "splitBrief" },
  { n: 3, name: "The Mirror", trialName: "Presentation Day",             attr: "focus",      cost: 3, judged: false, trialKind: "mirror" },
  { n: 4, name: "Geek Week",  trialName: "Testing challenge",            attr: "initiative", cost: 4, judged: false, trialKind: "auto" },
  { n: 5, name: "Sprint 2",   trialName: "Fix the broken team",          attr: "composure",  cost: 4, judged: true,  trialKind: "judged" },
  { n: 6, name: "Sprint 3",   trialName: "Final build and dream speech", attr: "composure",  cost: 5, judged: true,  trialKind: "judged" },
  { n: 7, name: "Graduation", trialName: "Crack the simulation",         attr: null,         cost: 0, judged: false, trialKind: null }
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
    this.trial = null;
    this.sabotages = [];    // { actor, target, drain, cost }
    this.accusations = [];  // { accuser, target, correct, safe }
    this.gifts = [];        // { giver, receiver, pts, cost, refused, cancelled }
    this.completed = new Set();   // one-time Game actions already run this round
    this.sopBoards = {};
    this.sopResults = {};
    this.trialPayments = {};
    this.sopTimedOut = false;
    this.earnings = {};
    this.quietHearts = [];
    this.gritBonus = [];
    this.done = false;
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

  /* Round actions (Step 7): Game checks step order, then calls Round. */
  sabotage(actor, target, team, rng) { return Sabotage.apply(this, actor, target, team, rng); }
  gift(giver, receiver, team, pts, rng) { return Gift.apply(this, giver, receiver, team, pts, rng); }
  answerGift(gift, accept) {
    // Only a gift accepted in the gift window saves a player from a missed check-in.
    return accept ? Gift.accept(this, gift, { savesAttendance: this.step === "giftWindow" })
                  : Gift.decline(this, gift);
  }
  accuse(accuser, target, team, rng) { return Accusation.apply(this, accuser, target, team, rng); }
  endGlitchReport() {
    // Exploit: +1 for each Contrarian who sabotaged this round and was not caught.
    for (const p of this.saboteurs()) if (!p.caughtThisRound) p.creditPath(CharacterType.PATH_EVENTS.uncaughtSabotage);
  }
  closeGlitchReport({ advance, refreshTimer } = {}) {
    this.endGlitchReport();
    if (refreshTimer) refreshTimer();
    if (advance) advance();
  }
  closeGiftWindow({ advance, lockIn, computeEarnings }) {
    advance();
    lockIn();
    advance();
    return computeEarnings();
  }

  /* Save (Part 13): plain data, players by id. The level's fixed data (name, attr, cost...) comes back from LEVELS. */
  toJSON() {
    const id = p => p.id;
    const out = {
      n: this.n, stepIndex: this.stepIndex, completed: [...this.completed],
      sabotages: this.sabotages.map(s => ({ ...s, actor: s.actor.id, target: s.target.id })),
      accusations: this.accusations.map(a => ({ ...a, accuser: a.accuser.id, target: a.target.id, safe: !!a.safe })),
      gifts: this.gifts.map(g => ({ ...g, giver: g.giver.id, receiver: g.receiver.id })),
    };
    if (this.trial && typeof this.trial === "object") out.trialState = this.trial.toJSON();
    if (this.quietHearts) out.quietHearts = this.quietHearts.map(id);
    if (this.gritBonus) out.gritBonus = this.gritBonus.map(id);
    for (const k of ["sopBoards", "sopResults", "mirrorResults", "trialPayments", "sopTimedOut", "earnings", "done"]) if (this[k] !== undefined) out[k] = JSON.parse(JSON.stringify(this[k]));
    return out;
  }
  /* Load. trialFromJSON rebuilds the trial (passed in so Round does not need to know the Trial class). */
  static fromJSON(data, { byId, trialFromJSON }) {
    const r = new Round(data.n);
    const P = id => byId.get(id);
    r.stepIndex = data.stepIndex;
    r.completed = new Set(data.completed);
    r.sabotages = data.sabotages.map(s => ({ ...s, actor: P(s.actor), target: P(s.target) }));
    r.accusations = data.accusations.map(a => ({ ...a, accuser: P(a.accuser), target: P(a.target), safe: a.safe !== undefined ? !!a.safe : false }));
    r.gifts = data.gifts.map(g => ({ ...g, giver: P(g.giver), receiver: P(g.receiver) }));
    const ts = data.trialState || (data.trial && typeof data.trial === "object" ? data.trial : null);
    if (ts) r.trial = trialFromJSON(ts);
    if (data.quietHearts) r.quietHearts = data.quietHearts.map(P);
    if (data.gritBonus) r.gritBonus = data.gritBonus.map(P);
    for (const k of ["sopBoards", "sopResults", "mirrorResults", "trialPayments", "sopTimedOut", "earnings", "done"]) if (data[k] !== undefined) r[k] = JSON.parse(JSON.stringify(data[k]));
    return r;
  }
}

export { Round };
