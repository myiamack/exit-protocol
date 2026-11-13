/* Team: members and the trial result for the round. */
(function (root) {
  const EP = root.EP || (root.EP = {});

  class Team {
    constructor({ id, name, members = [] }) {
      this.id = id;
      this.name = name;
      this.members = [];
      this.won = null;   // trial result this round: true, false, or null (not set)
      members.forEach(p => this.add(p));
    }
    add(p) { p.teamId = this.id; this.members.push(p); }
    active() { return this.members.filter(p => !p.isStuck()); }
    mates(p) { return this.members.filter(q => q !== p); }
    has(p) { return this.members.includes(p); }
    resetRound() { this.won = null; }
  }

  EP.Team = Team;
  if (typeof module !== "undefined" && module.exports) module.exports = Team;
})(typeof globalThis !== "undefined" ? globalThis : this);
