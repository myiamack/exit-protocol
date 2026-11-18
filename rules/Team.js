/* Team: members and the trial result for the round. */

class Team {
  constructor({ id, name, members = [] }) {
    this.id = id;
    this.name = name;
    this.members = [];
    this.won = null;   // trial result this round: true, false, or null (not set)
    this.trialWins = 0;   // trials won so far this game (Progress board)
    members.forEach(p => this.add(p));
  }
  add(p) { p.teamId = this.id; this.members.push(p); }
  remove(p) { this.members = this.members.filter(q => q !== p); }
  size() { return this.members.length; }
  active() { return this.members.filter(p => p.isActive()); }   // not Stuck, not idle
  mates(p) { return this.members.filter(q => q !== p); }
  has(p) { return this.members.includes(p); }
  resetRound() { this.won = null; }

  /* Save (Part 13): members by player id. */
  toJSON() { return { id: this.id, name: this.name, members: this.members.map(p => p.id), won: this.won, trialWins: this.trialWins }; }
  /* Load. byId: player id -> Player. Members keep their saved order. */
  static fromJSON(data, byId) {
    const t = new Team({ id: data.id, name: data.name, members: data.members.map(id => byId.get(id)) });
    t.won = data.won;
    t.trialWins = data.trialWins;
    return t;
  }
}

Team.MIN = 3;   // team switching keeps every team at 3 to 5 members
Team.MAX = 5;

export { Team };
