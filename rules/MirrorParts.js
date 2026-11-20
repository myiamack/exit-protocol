/* Private parts of MirrorTrial (Level 3: The Mirror: Presentation Day).
   Rule code only. No screen code. No moving tiles or per-tick motion.
   Outside code calls MirrorTrial, never these classes directly. */
import { MirrorData } from "./mirrorData.js";

const idOf = x => (x && typeof x === "object" ? x.id : x);

/* Lobby state for Presentation Day: active players per team (Team.active()),
   connect and miss results, tile speed-up, bot connect delays, and doors-close lockout. */
class MirrorLobby {
  #rng;
  #started = false;
  #closed = false;
  #teams = new Map();       // teamId -> { teamId, order: playerId[], players: Map<playerId, rec>, failed: bool }
  #playerIndex = new Map(); // playerId -> { teamId, rec }

  constructor(rng, teams = null) {
    if (typeof rng !== "function") throw new Error("MirrorLobby requires a seeded rng.");
    this.#rng = rng;
    if (teams !== null) this.start(teams);
  }

  get started() { return this.#started; }
  get closed() { return this.#closed; }

  #lookupPlayer(playerOrId) {
    const id = idOf(playerOrId);
    if (id === null || id === undefined) return null;
    return this.#playerIndex.get(id) || null;
  }

  /* Initialize lobby rosters using Team.active() (Stuck and Idle players are excluded). */
  start(teams) {
    if (this.#started) throw new Error("Mirror lobby already started.");
    this.#started = true;

    const L = MirrorData.lobby;
    const speedMin = L.signalStartSpeedMin;
    const speedRange = L.signalStartSpeedRange;
    const zoneMin = L.signalZoneMin;
    const zoneRange = 100 - L.signalBandWidth - L.signalZonePadding;
    const botMin = L.botConnectMinSeconds;
    const botMax = L.botConnectMaxSeconds;

    for (const team of teams) {
      const active = team.active();
      const ts = { teamId: team.id, order: [], players: new Map(), failed: false };
      for (const p of active) {
        const speed = speedMin + Math.floor(this.#rng() * speedRange);
        const zone = zoneMin + Math.floor(this.#rng() * zoneRange);
        const botConnectAt = p.isBot ? botMin + Math.floor(this.#rng() * (botMax - botMin + 1)) : null;
        const rec = {
          playerId: p.id,
          name: p.name,
          isBot: !!p.isBot,
          connected: false,
          misses: 0,
          speed,
          zone,
          botConnectAt,
        };
        ts.order.push(p.id);
        ts.players.set(p.id, rec);
        this.#playerIndex.set(p.id, { teamId: team.id, rec });
      }
      this.#teams.set(team.id, ts);
    }
    return this.state();
  }

  /* Record a successful signal grab reported by the screen. */
  connect(playerId) {
    const entry = this.#lookupPlayer(playerId);
    const why = (!this.#started ? "Lobby has not started." : null) ||
      (this.#closed ? "Lobby doors are closed." : null) ||
      (!entry ? "Player is not active in this lobby." : null) ||
      (entry.rec.connected ? "Player is already connected." : null);
    if (why) return { ok: false, reason: why };
    entry.rec.connected = true;
    return {
      ok: true,
      playerId: entry.rec.playerId,
      teamId: entry.teamId,
      connected: true,
      teamAllConnected: this.isTeamConnected(entry.teamId),
      allConnected: this.allConnected(),
    };
  }

  /* Record a missed signal grab reported by the screen and raise tile speed up to the cap. */
  miss(playerId) {
    const entry = this.#lookupPlayer(playerId);
    const why = (!this.#started ? "Lobby has not started." : null) ||
      (this.#closed ? "Lobby doors are closed." : null) ||
      (!entry ? "Player is not active in this lobby." : null) ||
      (entry.rec.connected ? "Player is already connected." : null);
    if (why) return { ok: false, reason: why };
    const L = MirrorData.lobby;
    entry.rec.misses += 1;
    entry.rec.speed = Math.min(L.signalMaxSpeed, entry.rec.speed + L.signalMissSpeedUp);
    const reasons = MirrorData.flavor.glitchReasons;
    const glitchReason = reasons[Math.floor(this.#rng() * reasons.length)];
    return {
      ok: true,
      playerId: entry.rec.playerId,
      teamId: entry.teamId,
      misses: entry.rec.misses,
      speed: entry.rec.speed,
      glitchReason,
    };
  }

  /* Close lobby doors: any team with an active player not connected is marked failed. */
  closeDoors() {
    if (!this.#started) throw new Error("Lobby has not started.");
    if (this.#closed) {
      return {
        ok: false,
        alreadyClosed: true,
        failedTeams: this.failedTeamIds(),
        passedTeams: this.passedTeamIds(),
      };
    }
    this.#closed = true;
    const results = [];
    for (const ts of this.#teams.values()) {
      const connectedIds = ts.order.filter(id => ts.players.get(id).connected);
      const missingIds = ts.order.filter(id => !ts.players.get(id).connected);
      ts.failed = ts.order.length === 0 || missingIds.length > 0;
      results.push({ teamId: ts.teamId, failed: ts.failed, connectedIds, missingIds });
    }
    return {
      ok: true,
      closed: true,
      failedTeams: this.failedTeamIds(),
      passedTeams: this.passedTeamIds(),
      results,
    };
  }

  teamIds() { return [...this.#teams.keys()]; }
  hasPlayer(playerId) { return !!this.#lookupPlayer(playerId); }

  playerState(playerId) {
    const entry = this.#lookupPlayer(playerId);
    return entry ? { ...entry.rec, teamId: entry.teamId } : null;
  }

  playersForTeam(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return [];
    return ts.order.map(id => ({ ...ts.players.get(id), teamId: ts.teamId }));
  }

  connectedIds(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.order.filter(id => ts.players.get(id).connected) : [];
  }

  missingIds(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.order.filter(id => !ts.players.get(id).connected) : [];
  }

  botConnectTimeOf(playerId) {
    const entry = this.#lookupPlayer(playerId);
    return entry ? entry.rec.botConnectAt : null;
  }

  botConnectTimes(teamOrId = null) {
    const tids = teamOrId === null || teamOrId === undefined ? [...this.#teams.keys()] : [idOf(teamOrId)];
    const out = [];
    for (const tid of tids) {
      const ts = this.#teams.get(tid);
      if (!ts) continue;
      for (const id of ts.order) {
        const rec = ts.players.get(id);
        if (rec.isBot) out.push({ playerId: rec.playerId, teamId: ts.teamId, seconds: rec.botConnectAt });
      }
    }
    return out;
  }

  isTeamConnected(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return !!ts && ts.order.length > 0 && ts.order.every(id => ts.players.get(id).connected);
  }

  allConnected() {
    if (!this.#teams.size) return false;
    for (const ts of this.#teams.values()) {
      if (ts.order.length === 0 || !ts.order.every(id => ts.players.get(id).connected)) return false;
    }
    return true;
  }

  isTeamFailed(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return !!ts && ts.failed;
  }

  failedTeamIds() {
    return [...this.#teams.values()].filter(ts => ts.failed).map(ts => ts.teamId);
  }

  passedTeamIds() {
    return [...this.#teams.values()].filter(ts => !ts.failed).map(ts => ts.teamId);
  }

  teamState(teamOrId) {
    const tid = idOf(teamOrId);
    const ts = this.#teams.get(tid);
    if (!ts) return null;
    return {
      teamId: ts.teamId,
      closed: this.#closed,
      failed: ts.failed,
      allConnected: this.isTeamConnected(tid),
      players: this.playersForTeam(tid),
    };
  }

  state() {
    return {
      started: this.#started,
      closed: this.#closed,
      allConnected: this.allConnected(),
      teams: [...this.#teams.keys()].map(tid => this.teamState(tid)),
    };
  }

  toJSON() {
    return {
      started: this.#started,
      closed: this.#closed,
      teams: [...this.#teams.values()].map(ts => ({
        teamId: ts.teamId,
        failed: ts.failed,
        players: ts.order.map(id => ({ ...ts.players.get(id) })),
      })),
    };
  }

  static fromJSON(data, { rng } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid MirrorLobby save data.");
    const lobby = new MirrorLobby(rng);
    lobby.#started = !!data.started;
    lobby.#closed = !!data.closed;
    for (const td of (data.teams || [])) {
      const ts = { teamId: td.teamId, order: [], players: new Map(), failed: !!td.failed };
      for (const pd of (td.players || [])) {
        const rec = {
          playerId: pd.playerId,
          name: pd.name,
          isBot: !!pd.isBot,
          connected: !!pd.connected,
          misses: pd.misses || 0,
          speed: pd.speed,
          zone: pd.zone,
          botConnectAt: pd.botConnectAt ?? null,
        };
        ts.order.push(rec.playerId);
        ts.players.set(rec.playerId, rec);
        lobby.#playerIndex.set(rec.playerId, { teamId: ts.teamId, rec });
      }
      lobby.#teams.set(ts.teamId, ts);
    }
    return lobby;
  }
}

const MirrorParts = { MirrorLobby };

export { MirrorParts };
