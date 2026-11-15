/* Round: one level. Trial attribute, cost, how it is scored, and the step order. */
(function (root) {
  const EP = root.EP || (root.EP = {});

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
  }

  EP.Round = Round;
  if (typeof module !== "undefined" && module.exports) module.exports = Round;
})(typeof globalThis !== "undefined" ? globalThis : this);
