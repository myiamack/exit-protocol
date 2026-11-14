/* CharacterType: what a work style changes. One base class, three subclasses.
   This is the only place that knows the difference between Cooperative, Independent and Contrarian.
   Other code asks the type (player.type.canSabotage(), player.type.giftCost(2), ...) instead of
   checking its name. Rule code only. No screen code. Works in the browser and in Node. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  const MAX = 10, PEN_MAX = 4;

  /* Events that can count toward a second path. */
  const PATH_EVENTS = { rescue: "rescue", correctAccusation: "correctAccusation", uncaughtSabotage: "uncaughtSabotage" };

  class CharacterType {
    constructor({ key, name, bonus, penalty, pathName, goal, pathEvent }) {
      this.key = key;               // "coop", "indep", "contra": an id for saving and lookups, not for rule checks
      this.name = name;
      this.bonus = bonus;           // the 2 bonus attributes (+2 each at creation)
      this.penalty = penalty;       // the penalty attribute (max 4)
      this.pathName = pathName;     // second path
      this.goal = goal;
      this.pathEvent = pathEvent;   // which event counts toward the second path
    }

    isBonus(k) { return this.bonus.includes(k); }
    max(k) { return k === this.penalty ? PEN_MAX : MAX; }

    /* Gifts. Default: 1 heart per point. */
    giftCost(pts) { return pts; }
    giftRefundPerPoint() { return 1; }
    canAcceptGifts() { return true; }

    canSabotage() { return false; }

    /* Incentives and disincentives. Each type turns on its own. */
    hasEmpathy() { return false; }   // loses 1 heart when a teammate's glitch locks in
    hasCashOut() { return false; }   // once per game, 2 hearts for 1 point, needs full hearts
    hasSkim() { return false; }      // +1 point per uncaught sabotage round, max 2 per game

    /* True if this event counts toward this type's second path. */
    pathCounts(event) { return event === this.pathEvent; }

    static get MAX() { return MAX; }
    static get PEN_MAX() { return PEN_MAX; }
    static get PATH_EVENTS() { return PATH_EVENTS; }
    /* Look up a type by key. Passing a type object returns it unchanged. */
    static get(key) {
      if (key instanceof CharacterType) return key;
      const t = ALL[key];
      if (!t) throw new Error("Unknown type: " + key);
      return t;
    }
    static all() { return Object.values(ALL); }
  }

  class Cooperative extends CharacterType {
    constructor() {
      super({ key: "coop", name: "Cooperative", bonus: ["collab", "composure"], penalty: "initiative",
              pathName: "Lifeline", goal: 1, pathEvent: PATH_EVENTS.rescue });
    }
    hasEmpathy() { return true; }
  }

  class Independent extends CharacterType {
    constructor() {
      super({ key: "indep", name: "Independent", bonus: ["focus", "grit"], penalty: "collab",
              pathName: "Auditor", goal: 1, pathEvent: PATH_EVENTS.correctAccusation });
    }
    giftCost(pts) { return pts === 1 ? 2 : 3; }   // 1 point costs 2, 2 points cost 3
    giftRefundPerPoint() { return 2; }
    canAcceptGifts() { return false; }
    hasCashOut() { return true; }
  }

  class Contrarian extends CharacterType {
    constructor() {
      super({ key: "contra", name: "Contrarian", bonus: ["initiative", "grit"], penalty: "composure",
              pathName: "Exploit", goal: 3, pathEvent: PATH_EVENTS.uncaughtSabotage });
    }
    canSabotage() { return true; }
    hasSkim() { return true; }
  }

  // One shared object per type. Types hold no player state, so players can share them.
  const ALL = { coop: new Cooperative(), indep: new Independent(), contra: new Contrarian() };

  CharacterType.Cooperative = Cooperative;
  CharacterType.Independent = Independent;
  CharacterType.Contrarian = Contrarian;
  EP.CharacterType = CharacterType;
  if (typeof module !== "undefined" && module.exports) module.exports = CharacterType;
})(typeof globalThis !== "undefined" ? globalThis : this);
