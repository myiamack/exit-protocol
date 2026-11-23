/* Private parts of MirrorTrial (Level 3: The Mirror: Presentation Day).
   Rule code only. No screen code. No moving tiles or per-tick motion.
   Outside code calls MirrorTrial, never these classes directly. */
import { MirrorData } from "./mirrorData.js";
import { Rng } from "./Rng.js";

const idOf = x => (x && typeof x === "object" ? x.id : x);
const SEED_MIX = 0x9E3779B9;

function deriveSeedRng(rng) {
  if (Rng.canSave(rng)) return Rng.seeded((rng.getState() ^ SEED_MIX) >>> 0);
  // Test-only 1-draw fallback for non-saveable RNGs; real games always use a saveable Rng.
  return Rng.seeded((Math.floor(rng() * 4294967296) ^ SEED_MIX) >>> 0);
}

/* Lobby state for Presentation Day: active players per team (Team.active()),
   connect and miss results, tile speed-up, bot connect delays, and doors-close lockout. */
class MirrorLobby {
  #rng;
  #seedRng;
  #started = false;
  #closed = false;
  #teams = new Map();       // teamId -> { teamId, order: playerId[], players: Map<playerId, rec>, failed: bool }
  #playerIndex = new Map(); // playerId -> { teamId, rec }

  constructor(rng, teams = null, { seedRng = null } = {}) {
    if (typeof rng !== "function") throw new Error("MirrorLobby requires a seeded rng.");
    this.#rng = rng;
    this.#seedRng = typeof seedRng === "function" ? seedRng : deriveSeedRng(rng);
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
        const cursorPos = Math.floor(this.#seedRng() * 100);
        const cursorDir = this.#seedRng() < 0.5 ? -1 : 1;
        const rec = {
          playerId: p.id,
          name: p.name,
          isBot: !!p.isBot,
          connected: false,
          misses: 0,
          speed,
          zone,
          botConnectAt,
          cursorPos,
          cursorDir,
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

  cursorStartOf(playerId) {
    const entry = this.#lookupPlayer(playerId);
    return entry ? { pos: entry.rec.cursorPos, dir: entry.rec.cursorDir } : null;
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
      seedRngState: Rng.canSave(this.#seedRng) ? this.#seedRng.getState() : null,
      teams: [...this.#teams.values()].map(ts => ({
        teamId: ts.teamId,
        failed: ts.failed,
        players: ts.order.map(id => ({ ...ts.players.get(id) })),
      })),
    };
  }

  static fromJSON(data, { rng, seedRng = null } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid MirrorLobby save data.");
    let useSeedRng = typeof seedRng === "function" ? seedRng : null;
    if (!useSeedRng && typeof data.seedRngState === "number") {
      useSeedRng = Rng.seeded(0);
      useSeedRng.setState(data.seedRngState);
    }
    const lobby = new MirrorLobby(rng, null, { seedRng: useSeedRng });
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
          cursorPos: typeof pd.cursorPos === "number" ? pd.cursorPos : 0,
          cursorDir: pd.cursorDir === -1 ? -1 : 1,
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

/* Setup Crew state for Presentation Day: seeded slot order, 1/2/3 player step splits,
   sequential step turns, results-based step actions, seeded content picks, penalties/recovery,
   bot setup schedule/hiccups, and wrap-up. Outside code calls MirrorTrial only. */
class SetupCrew {
  #rng;
  #seedRng;
  #started = false;
  #showtimeStartAt = null;
  #teams = new Map();       // teamId -> team setup state
  #playerIndex = new Map(); // playerId -> { teamId, slotIndex, name, isBot }

  constructor(rng, entries = null, options = {}) {
    if (typeof rng !== "function") throw new Error("SetupCrew requires a seeded rng.");
    this.#rng = rng;
    this.#seedRng = options && typeof options.seedRng === "function"
      ? options.seedRng
      : deriveSeedRng(rng);
    if (entries !== null) this.start(entries, options);
  }

  get started() { return this.#started; }
  get showtimeStartAt() { return this.#showtimeStartAt; }

  beginShowtime(now = null) {
    this.#showtimeStartAt = typeof now === "number" && Number.isFinite(now) ? now : null;
  }

  #msFromElapsed(elapsedSeconds, now = null) {
    if (typeof now === "number" && Number.isFinite(now)) return now;
    if (this.#showtimeStartAt !== null && typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      return this.#showtimeStartAt + Math.round(elapsedSeconds * 1000);
    }
    return null;
  }

  #elapsedFromMs(at) {
    if (this.#showtimeStartAt !== null && typeof at === "number" && Number.isFinite(at)) {
      return Math.max(0, (at - this.#showtimeStartAt) / 1000);
    }
    return null;
  }

  static crewSize(activeCount) {
    if (activeCount <= 0) return 0;
    return Math.min(MirrorData.scoring.maxSetupCrew, Math.ceil(activeCount / 2));
  }

  static splitSteps(slotCount) {
    const groups = MirrorData.setupSplits[slotCount];
    return groups ? groups.map(g => g.slice()) : [];
  }

  static botStepDuration(step) {
    const ms = MirrorData.bots.setupMilestones;
    const idx = ms.findIndex(m => m.step === step);
    if (idx < 0) return null;
    return idx === 0 ? ms[0].seconds : ms[idx].seconds - ms[idx - 1].seconds;
  }

  static botMilestoneLabel(step) {
    const found = MirrorData.bots.setupMilestones.find(m => m.step === step);
    return found ? found.label : step;
  }

  #shuffle(list, rng = this.#rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  #lookupPlayer(playerOrId) {
    const id = idOf(playerOrId);
    if (id === null || id === undefined) return null;
    return this.#playerIndex.get(id) || null;
  }

  #currentStep(ts) {
    if (ts.wrappedUp) return null;
    if (ts.stepIndex < MirrorData.setupSteps.length) return MirrorData.setupSteps[ts.stepIndex];
    return "wrapUp";
  }

  #ownerSlot(ts, step) {
    if (!step) return null;
    if (step === "wrapUp") return ts.slots[ts.slots.length - 1] || null;
    return ts.slots.find(s => s.steps.includes(step)) || null;
  }

  #currentPlayerId(ts) {
    const slot = this.#ownerSlot(ts, this.#currentStep(ts));
    return slot ? slot.playerId : null;
  }

  #makeMicSequence(length) {
    return Array.from({ length }, () => 1 + Math.floor(this.#rng() * MirrorData.mic.count));
  }

  #makeFileOrder() {
    return this.#shuffle(MirrorData.files.map((_, i) => i));
  }

  #makeQaOrder() {
    return this.#shuffle(MirrorData.qaItems.map((_, i) => i));
  }

  #rollSoundSpike(ts) {
    const S = MirrorData.sound;
    const initial = ts.sound.spikesRolled === 0;
    const delayTicks = initial
      ? S.spikeInitialMinTicks + Math.floor(this.#seedRng() * S.spikeInitialRangeTicks)
      : S.spikeIntervalMinTicks + Math.floor(this.#seedRng() * S.spikeIntervalRangeTicks);
    const boost = S.spikeBoostMin + Math.floor(this.#seedRng() * S.spikeBoostRange);
    ts.sound.spikesRolled += 1;
    return { initial, delayTicks, boost, spikesRolled: ts.sound.spikesRolled };
  }

  #rollSoundJitter() {
    const half = MirrorData.sound.jitterHalf;
    const raw = Math.round(this.#seedRng() * (half * 2) - half);
    return raw === 0 ? 0 : raw;
  }

  #clearStepDeadlines(ts) {
    ts.sound.nextTickAt = null;
    ts.sound.spikeAt = null;
    ts.mic.hideAt = null;
    ts.mic.flashing = false;
    ts.deck.nextReshuffleAt = null;
    ts.qa.itemDeadlineAt = null;
  }

  #armSound(ts, now) {
    const S = MirrorData.sound;
    const tickMs = MirrorData.timers.tickMs;
    ts.sound.level = S.start;
    ts.sound.holdTicks = 0;
    ts.sound.lockedLevel = null;
    ts.sound.spikesTriggered = 0;
    const slot = this.#ownerSlot(ts, "sound");
    if (typeof now === "number" && Number.isFinite(now) && slot && !slot.isBot) {
      ts.sound.nextTickAt = now + tickMs;
      const sp = this.#rollSoundSpike(ts);
      ts.sound.spikeAt = now + sp.delayTicks * tickMs;
      ts.sound.spikeBoost = sp.boost;
    } else {
      ts.sound.nextTickAt = null;
      ts.sound.spikeAt = null;
      ts.sound.spikeBoost = 0;
    }
  }

  #armMicFlash(ts, now, { isFirstRound = false } = {}) {
    const M = MirrorData.mic;
    const tickMs = MirrorData.timers.tickMs;
    const slot = this.#ownerSlot(ts, "mic");
    if (typeof now === "number" && Number.isFinite(now) && slot && !slot.isBot && ts.mic.sequence) {
      const durTicks = isFirstRound ? M.flashRound1Ticks : (M.flashBaseTicks + ts.mic.sequence.length);
      ts.mic.hideAt = now + durTicks * tickMs;
      ts.mic.flashing = true;
    } else {
      ts.mic.hideAt = null;
      ts.mic.flashing = false;
    }
  }

  #armDeck(ts, now) {
    const D = MirrorData.deck;
    const tickMs = MirrorData.timers.tickMs;
    const slot = this.#ownerSlot(ts, "deck");
    if (typeof now === "number" && Number.isFinite(now) && slot && !slot.isBot) {
      ts.deck.nextReshuffleAt = now + D.reshuffleTicks * tickMs;
    } else {
      ts.deck.nextReshuffleAt = null;
    }
  }

  #armQaItem(ts, now) {
    const Q = MirrorData.qa;
    const tickMs = MirrorData.timers.tickMs;
    const slot = this.#ownerSlot(ts, "qa");
    if (typeof now === "number" && Number.isFinite(now) && slot && !slot.isBot) {
      ts.qa.itemDeadlineAt = now + Q.countdownTicks * tickMs;
    } else {
      ts.qa.itemDeadlineAt = null;
    }
  }

  #enterStep(ts, step, now = null) {
    this.#clearStepDeadlines(ts);
    if (step === "sound") {
      this.#armSound(ts, now);
    } else if (step === "mic") {
      ts.mic.round = 0;
      ts.mic.index = 0;
      ts.mic.done = false;
      ts.mic.sequence = this.#makeMicSequence(MirrorData.mic.roundLengths[0]);
      this.#armMicFlash(ts, now, { isFirstRound: true });
    } else if (step === "deck") {
      ts.deck.fileOrder = this.#makeFileOrder();
      ts.deck.filesTried = [];
      ts.deck.grabbed = false;
      ts.deck.reshuffles = 0;
      this.#armDeck(ts, now);
    } else if (step === "qa") {
      ts.qa.order = this.#makeQaOrder();
      ts.qa.index = 0;
      ts.qa.done = false;
      this.#armQaItem(ts, now);
    }
  }

  #advanceStep(ts, elapsedSeconds = null, now = null) {
    if (ts.stepIndex < MirrorData.setupSteps.length) {
      ts.completedSteps.push(MirrorData.setupSteps[ts.stepIndex]);
    }
    ts.stepIndex += 1;
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      ts.stepStartedAt = elapsedSeconds;
    }
    const next = this.#currentStep(ts);
    const stepNow = this.#msFromElapsed(elapsedSeconds, now);
    if (next) this.#enterStep(ts, next, stepNow);
  }

  #checkTurn(playerOrId, expectedStep) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return { ok: false, reason: "Player is not on the Setup Crew." };
    const ts = this.#teams.get(entry.teamId);
    if (ts.wrappedUp) return { ok: false, reason: "Setup is already wrapped up." };
    const curStep = this.#currentStep(ts);
    if (curStep !== expectedStep) {
      return { ok: false, reason: "Current step is " + curStep + ", not " + expectedStep + "." };
    }
    if (this.#currentPlayerId(ts) !== entry.playerId) {
      return { ok: false, reason: "It is not your turn." };
    }
    return { ok: true, ts, entry };
  }

  /* Initialize Setup Crew from Team objects (active players only) or { teamId, players, danceIds } deals. */
  start(entries, { shuffleSlots = true } = {}) {
    if (this.#started) throw new Error("Setup already started.");
    this.#started = true;

    for (const item of entries) {
      let teamId;
      let setupPlayers;
      let danceIds;
      if (item && typeof item.active === "function") {
        teamId = item.id;
        const active = item.active();
        if (!active.length) continue;
        const pool = shuffleSlots ? this.#shuffle(active) : active.slice();
        const count = SetupCrew.crewSize(pool.length);
        setupPlayers = pool.slice(0, count);
        danceIds = pool.slice(count).map(p => p.id);
      } else {
        teamId = item.teamId;
        const list = (item.players || []).slice();
        if (!list.length) continue;
        if (list.length > MirrorData.scoring.maxSetupCrew) {
          throw new Error("Setup Crew cannot exceed " + MirrorData.scoring.maxSetupCrew + " players.");
        }
        setupPlayers = shuffleSlots ? this.#shuffle(list) : list;
        danceIds = (item.danceIds || []).slice();
      }

      const split = SetupCrew.splitSteps(setupPlayers.length);
      const slots = setupPlayers.map((p, slotIndex) => {
        const playerId = p.playerId !== undefined ? p.playerId : p.id;
        const name = p.name !== undefined ? p.name : String(playerId);
        const isBot = !!p.isBot;
        return { slotIndex, playerId, name, isBot, steps: split[slotIndex] };
      });

      const ts = {
        teamId,
        slots,
        danceIds,
        stepIndex: 0,
        wrappedUp: false,
        penalties: 0,
        penaltiesAdded: 0,
        qaRecovered: 0,
        stepStartedAt: 0,
        botHiccups: 0,
        completedSteps: [],
        cables: { connected: [], sparks: 0, bag: [] },
        sound: {
          locked: false,
          feedbacks: 0,
          spikesRolled: 0,
          level: MirrorData.sound.start,
          holdTicks: 0,
          nextTickAt: null,
          spikeAt: null,
          spikeBoost: 0,
          spikesTriggered: 0,
          lockedLevel: null,
        },
        mic: { round: 0, index: 0, sequence: null, done: false, wrongs: 0, hideAt: null, flashing: false },
        deck: { fileOrder: null, filesTried: [], grabbed: false, reshuffles: 0, nextReshuffleAt: null },
        qa: { order: null, index: 0, right: 0, wrong: 0, timeouts: 0, done: false, itemDeadlineAt: null },
      };

      this.#teams.set(teamId, ts);
      for (const slot of slots) {
        this.#playerIndex.set(slot.playerId, {
          teamId,
          slotIndex: slot.slotIndex,
          playerId: slot.playerId,
          name: slot.name,
          isBot: slot.isBot,
        });
      }
    }
    return this.state();
  }

  /* Step 1 (cables): record a matched cable connection reported by the screen. */
  cableHit(playerOrId, port, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "cables");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    if (!MirrorData.ports.includes(port)) return { ok: false, reason: "Unknown cable port." };
    if (ts.cables.connected.includes(port)) return { ok: false, reason: "Port is already connected." };
    ts.cables.connected.push(port);
    const remaining = MirrorData.ports.length - ts.cables.connected.length;
    const stepDone = remaining === 0;
    if (stepDone) this.#advanceStep(ts, elapsedSeconds, now);
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "cables",
      hit: true,
      port,
      connected: ts.cables.connected.slice(),
      remaining,
      stepDone,
      nextStep: this.#currentStep(ts),
      nextPlayerId: this.#currentPlayerId(ts),
      penalties: ts.penalties,
    };
  }

  /* Step 1 (cables): record a wrong cable click (spark) costing 3 attention. */
  cableMiss(playerOrId, port = null, { elapsedSeconds = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "cables");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    if (port !== null && port !== undefined) {
      if (!MirrorData.ports.includes(port)) return { ok: false, reason: "Unknown cable port." };
      if (ts.cables.connected.includes(port)) return { ok: false, reason: "Port is already connected." };
    }
    ts.cables.sparks += 1;
    const penaltyAdded = MirrorData.cables.wrongPenalty;
    ts.penalties += penaltyAdded;
    ts.penaltiesAdded += penaltyAdded;
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "cables",
      hit: false,
      spark: true,
      port: port ?? null,
      penaltyAdded,
      penalties: ts.penalties,
      remaining: MirrorData.ports.length - ts.cables.connected.length,
      stepDone: false,
      nextStep: "cables",
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 2 (sound): apply a mixer gain button (-10, +5, +10); feedback at 100 resets to 45 (-4 attention). */
  soundAdjust(playerOrId, delta, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "sound");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    const S = MirrorData.sound;
    if (!S.controls.includes(delta)) return { ok: false, reason: "Invalid sound control." };
    const at = this.#msFromElapsed(elapsedSeconds, now);
    if (at !== null && !entry.isBot) {
      const tickMs = MirrorData.timers.tickMs;
      if (ts.sound.nextTickAt === null) ts.sound.nextTickAt = at + tickMs;
      if (ts.sound.spikeAt === null) {
        const sp = this.#rollSoundSpike(ts);
        ts.sound.spikeAt = at + sp.delayTicks * tickMs;
        ts.sound.spikeBoost = sp.boost;
      }
    }
    ts.sound.level = Math.max(S.min, Math.min(S.max, ts.sound.level + delta));
    if (ts.sound.level >= S.feedbackAt) {
      ts.sound.feedbacks += 1;
      const penaltyAdded = S.feedbackPenalty;
      ts.penalties += penaltyAdded;
      ts.penaltiesAdded += penaltyAdded;
      ts.sound.level = S.start;
      ts.sound.holdTicks = 0;
      return {
        ok: true,
        teamId: ts.teamId,
        playerId: entry.playerId,
        step: "sound",
        delta,
        level: ts.sound.level,
        holdTicks: 0,
        feedback: true,
        penaltyAdded,
        penalties: ts.penalties,
        stepDone: false,
        nextStep: "sound",
        nextPlayerId: this.#currentPlayerId(ts),
      };
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "sound",
      delta,
      level: ts.sound.level,
      holdTicks: ts.sound.holdTicks,
      feedback: false,
      penaltyAdded: 0,
      penalties: ts.penalties,
      stepDone: false,
      nextStep: "sound",
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 2 (sound): record that sound held steady in the green zone for 3 seconds. */
  soundHeld(playerOrId, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "sound");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    ts.sound.locked = true;
    ts.sound.lockedLevel = ts.sound.level;
    ts.sound.nextTickAt = null;
    ts.sound.spikeAt = null;
    this.#advanceStep(ts, elapsedSeconds, now);
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "sound",
      hit: true,
      locked: true,
      level: ts.sound.lockedLevel,
      stepDone: true,
      nextStep: this.#currentStep(ts),
      nextPlayerId: this.#currentPlayerId(ts),
      micSequence: ts.mic.sequence ? ts.mic.sequence.slice() : null,
      penalties: ts.penalties,
    };
  }

  /* Step 2 (sound): record feedback overshoot costing 4 attention. */
  soundFeedback(playerOrId) {
    const chk = this.#checkTurn(playerOrId, "sound");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    ts.sound.feedbacks += 1;
    ts.sound.level = MirrorData.sound.start;
    ts.sound.holdTicks = 0;
    const penaltyAdded = MirrorData.sound.feedbackPenalty;
    ts.penalties += penaltyAdded;
    ts.penaltiesAdded += penaltyAdded;
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "sound",
      hit: false,
      feedback: true,
      penaltyAdded,
      penalties: ts.penalties,
      stepDone: false,
      nextStep: "sound",
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 1 (cables): draw the next needed port from the seeded spawn bag (refilling lazily). */
  nextCable(teamOrId) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "cables") return { ok: false, reason: "Cables step is not active." };
    const needed = MirrorData.ports.filter(p => !ts.cables.connected.includes(p));
    if (!needed.length) return { ok: false, reason: "All cables are already connected." };
    if (!ts.cables.bag.length) ts.cables.bag = this.#shuffle(needed.concat(needed), this.#seedRng);
    let chosen = null;
    while (ts.cables.bag.length) {
      const candidate = ts.cables.bag.pop();
      if (needed.includes(candidate)) { chosen = candidate; break; }
    }
    if (!chosen) {
      ts.cables.bag = this.#shuffle(needed.concat(needed), this.#seedRng);
      chosen = ts.cables.bag.pop() || needed[0];
    }
    return {
      ok: true,
      teamId: ts.teamId,
      port: chosen,
      remainingInBag: ts.cables.bag.length,
    };
  }

  /* Step 1 (cables): push a missed cable port back into the spawn bag. */
  returnCable(teamOrId, port) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "cables") return { ok: false, reason: "Cables step is not active." };
    if (!MirrorData.ports.includes(port)) return { ok: false, reason: "Unknown cable port." };
    if (ts.cables.connected.includes(port)) return { ok: false, reason: "Port is already connected." };
    ts.cables.bag.push(port);
    return {
      ok: true,
      teamId: ts.teamId,
      port,
      remainingInBag: ts.cables.bag.length,
    };
  }

  /* Step 2 (sound): roll the next crowd spike delay (in ticks) and boost (+8 to +17). */
  nextSoundSpike(teamOrId) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "sound") return { ok: false, reason: "Sound step is not active." };
    return { ok: true, teamId: ts.teamId, ...this.#rollSoundSpike(ts) };
  }

  /* Step 2 (sound): roll one per-tick sound meter jitter from seeded Rng. */
  nextSoundJitter(teamOrId) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "sound") return { ok: false, reason: "Sound step is not active." };
    return { ok: true, teamId: ts.teamId, jitter: this.#rollSoundJitter() };
  }

  /* Step 3 (mic): record a mic tap against the seeded sequence across rounds of lengths 3, 4, 5. */
  micTap(playerOrId, micNumber, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "mic");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    if (!Number.isInteger(micNumber) || micNumber < 1 || micNumber > MirrorData.mic.count) {
      return { ok: false, reason: "Invalid mic number." };
    }
    const at = this.#msFromElapsed(elapsedSeconds, now);
    if (ts.mic.flashing) {
      if (at !== null && ts.mic.hideAt !== null && at >= ts.mic.hideAt) {
        ts.mic.flashing = false;
        ts.mic.hideAt = null;
      } else {
        return { ok: false, reason: "Watch the sequence before tapping." };
      }
    }
    const expected = ts.mic.sequence[ts.mic.index];
    if (micNumber === expected) {
      ts.mic.index += 1;
      if (ts.mic.index === ts.mic.sequence.length) {
        if (ts.mic.round >= MirrorData.mic.roundLengths.length - 1) {
          ts.mic.done = true;
          ts.mic.flashing = false;
          ts.mic.hideAt = null;
          this.#advanceStep(ts, elapsedSeconds, now);
          return {
            ok: true,
            teamId: ts.teamId,
            playerId: entry.playerId,
            step: "mic",
            hit: true,
            micNumber,
            round: ts.mic.round,
            roundDone: true,
            stepDone: true,
            nextStep: this.#currentStep(ts),
            nextPlayerId: this.#currentPlayerId(ts),
            fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
            penalties: ts.penalties,
          };
        }
        ts.mic.round += 1;
        ts.mic.index = 0;
        ts.mic.sequence = this.#makeMicSequence(MirrorData.mic.roundLengths[ts.mic.round]);
        this.#armMicFlash(ts, at, { isFirstRound: false });
        return {
          ok: true,
          teamId: ts.teamId,
          playerId: entry.playerId,
          step: "mic",
          hit: true,
          micNumber,
          round: ts.mic.round,
          index: 0,
          sequence: ts.mic.sequence.slice(),
          roundDone: true,
          stepDone: false,
          nextStep: "mic",
          nextPlayerId: this.#currentPlayerId(ts),
          penalties: ts.penalties,
        };
      }
      return {
        ok: true,
        teamId: ts.teamId,
        playerId: entry.playerId,
        step: "mic",
        hit: true,
        micNumber,
        round: ts.mic.round,
        index: ts.mic.index,
        remaining: ts.mic.sequence.length - ts.mic.index,
        roundDone: false,
        stepDone: false,
        nextStep: "mic",
        nextPlayerId: this.#currentPlayerId(ts),
        penalties: ts.penalties,
      };
    }

    ts.mic.wrongs += 1;
    ts.mic.index = 0;
    const penaltyAdded = MirrorData.mic.wrongPenalty;
    ts.penalties += penaltyAdded;
    ts.penaltiesAdded += penaltyAdded;
    ts.mic.sequence = this.#makeMicSequence(MirrorData.mic.roundLengths[ts.mic.round]);
    this.#armMicFlash(ts, at, { isFirstRound: false });
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "mic",
      hit: false,
      micNumber,
      round: ts.mic.round,
      index: 0,
      sequence: ts.mic.sequence.slice(),
      penaltyAdded,
      penalties: ts.penalties,
      roundDone: false,
      stepDone: false,
      nextStep: "mic",
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 4 (deck): record a file click by index or name. Wrong file costs 6 attention. */
  pickFile(playerOrId, fileIndexOrName, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "deck");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    let idx = -1;
    if (typeof fileIndexOrName === "string") {
      idx = MirrorData.files.findIndex(f => f.name === fileIndexOrName);
    } else if (Number.isInteger(fileIndexOrName) && fileIndexOrName >= 0 && fileIndexOrName < MirrorData.files.length) {
      idx = fileIndexOrName;
    }
    if (idx < 0) return { ok: false, reason: "Unknown deck file." };
    if (ts.deck.filesTried.includes(idx)) return { ok: false, reason: "File was already tried." };

    const file = MirrorData.files[idx];
    if (file.correct) {
      ts.deck.grabbed = true;
      ts.deck.nextReshuffleAt = null;
      this.#advanceStep(ts, elapsedSeconds, now);
      return {
        ok: true,
        teamId: ts.teamId,
        playerId: entry.playerId,
        step: "deck",
        hit: true,
        fileIndex: idx,
        fileName: file.name,
        stepDone: true,
        nextStep: this.#currentStep(ts),
        nextPlayerId: this.#currentPlayerId(ts),
        qaOrder: ts.qa.order ? ts.qa.order.slice() : null,
        penalties: ts.penalties,
      };
    }

    ts.deck.filesTried.push(idx);
    const penaltyAdded = MirrorData.deck.wrongPenalty;
    ts.penalties += penaltyAdded;
    ts.penaltiesAdded += penaltyAdded;
    const at = this.#msFromElapsed(elapsedSeconds, now);
    if (at !== null && !entry.isBot) {
      ts.deck.nextReshuffleAt = at + MirrorData.deck.wrongReshuffleTicks * MirrorData.timers.tickMs;
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "deck",
      hit: false,
      fileIndex: idx,
      fileName: file.name,
      penaltyAdded,
      penalties: ts.penalties,
      reshuffleRequested: true,
      stepDone: false,
      nextStep: "deck",
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 4 (deck): generate a seeded reshuffle of the 6 deck files. */
  reshuffleDeck(teamOrId, { elapsedSeconds = null, now = null } = {}) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "deck") return { ok: false, reason: "Deck step is not active." };
    ts.deck.fileOrder = this.#makeFileOrder();
    ts.deck.reshuffles += 1;
    const at = this.#msFromElapsed(elapsedSeconds, now);
    const slot = this.#ownerSlot(ts, "deck");
    if (at !== null && slot && !slot.isBot) {
      ts.deck.nextReshuffleAt = at + MirrorData.deck.reshuffleTicks * MirrorData.timers.tickMs;
    }
    return {
      ok: true,
      teamId: ts.teamId,
      fileOrder: ts.deck.fileOrder.slice(),
      reshuffles: ts.deck.reshuffles,
    };
  }

  /* Step 5 (qa): record a multiple-choice answer. Right restores up to 5 penalty points; wrong costs 5. */
  answerQa(playerOrId, answerIndex, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "qa");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    const itemIndex = ts.qa.order[ts.qa.index];
    const item = MirrorData.qaItems[itemIndex];
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= item.options.length) {
      return { ok: false, reason: "Invalid Q&A option." };
    }
    const correct = answerIndex === item.correctIndex;
    let penaltyAdded = 0;
    let recovered = 0;
    if (correct) {
      ts.qa.right += 1;
      recovered = Math.min(ts.penalties, MirrorData.qa.rightRecover);
      ts.penalties -= recovered;
      ts.qaRecovered += recovered;
    } else {
      ts.qa.wrong += 1;
      penaltyAdded = MirrorData.qa.wrongPenalty;
      ts.penalties += penaltyAdded;
      ts.penaltiesAdded += penaltyAdded;
    }
    ts.qa.index += 1;
    const stepDone = ts.qa.index >= ts.qa.order.length;
    if (stepDone) {
      ts.qa.done = true;
      ts.qa.itemDeadlineAt = null;
      this.#advanceStep(ts, elapsedSeconds, now);
    } else {
      this.#armQaItem(ts, this.#msFromElapsed(elapsedSeconds, now));
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "qa",
      hit: correct,
      correct,
      itemIndex,
      answerIndex,
      why: item.why,
      recovered,
      penaltyAdded,
      penalties: ts.penalties,
      qaIndex: ts.qa.index,
      remaining: ts.qa.order.length - ts.qa.index,
      stepDone,
      nextStep: this.#currentStep(ts),
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Step 5 (qa): record a question timeout costing 5 attention. */
  timeoutQa(playerOrId, { elapsedSeconds = null, now = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "qa");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    const itemIndex = ts.qa.order[ts.qa.index];
    ts.qa.timeouts += 1;
    const penaltyAdded = MirrorData.qa.wrongPenalty;
    ts.penalties += penaltyAdded;
    ts.penaltiesAdded += penaltyAdded;
    ts.qa.index += 1;
    const stepDone = ts.qa.index >= ts.qa.order.length;
    if (stepDone) {
      ts.qa.done = true;
      ts.qa.itemDeadlineAt = null;
      this.#advanceStep(ts, elapsedSeconds, now);
    } else {
      this.#armQaItem(ts, this.#msFromElapsed(elapsedSeconds, now));
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "qa",
      hit: false,
      timeout: true,
      itemIndex,
      recovered: 0,
      penaltyAdded,
      penalties: ts.penalties,
      qaIndex: ts.qa.index,
      remaining: ts.qa.order.length - ts.qa.index,
      stepDone,
      nextStep: this.#currentStep(ts),
      nextPlayerId: this.#currentPlayerId(ts),
    };
  }

  /* Last Setup slot wraps up the presentation after Q&A completes. */
  wrapUp(playerOrId) {
    const chk = this.#checkTurn(playerOrId, "wrapUp");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    ts.wrappedUp = true;
    ts.stepIndex = MirrorData.setupSteps.length + 1;
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "wrapUp",
      wrappedUp: true,
      penalties: ts.penalties,
      penaltiesAdded: ts.penaltiesAdded,
      qaRecovered: ts.qaRecovered,
    };
  }

  /* Bot or autoPilot human completes the current setup step with a seeded 30% hiccup (-3 attention). */
  completeBotStep(playerOrId, { elapsedSeconds = null, autoPilot = false } = {}) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return { ok: false, reason: "Player is not on the Setup Crew." };
    const ts = this.#teams.get(entry.teamId);
    if (ts.wrappedUp) return { ok: false, reason: "Setup is already wrapped up." };
    if (this.#currentPlayerId(ts) !== entry.playerId) return { ok: false, reason: "It is not your turn." };
    if (!entry.isBot && !autoPilot) return { ok: false, reason: "Player is not a bot." };

    const step = this.#currentStep(ts);
    const duration = SetupCrew.botStepDuration(step);
    const finishedAt = (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds))
      ? elapsedSeconds
      : ts.stepStartedAt + duration;
    const label = SetupCrew.botMilestoneLabel(step);

    if (step === "wrapUp") {
      ts.wrappedUp = true;
      ts.stepIndex = MirrorData.setupSteps.length + 1;
      ts.stepStartedAt = finishedAt;
      return {
        ok: true,
        teamId: ts.teamId,
        playerId: entry.playerId,
        step,
        label,
        hiccup: false,
        penaltyAdded: 0,
        penalties: ts.penalties,
        finishedAt,
        nextStep: null,
        nextPlayerId: null,
        wrappedUp: true,
      };
    }

    const hiccup = this.#rng() < MirrorData.bots.setupHiccupChance;
    const penaltyAdded = hiccup ? MirrorData.bots.setupHiccupPenalty : 0;
    if (hiccup) {
      ts.botHiccups += 1;
      ts.penalties += penaltyAdded;
      ts.penaltiesAdded += penaltyAdded;
    }

    this.#clearStepDeadlines(ts);
    if (step === "cables") ts.cables.connected = MirrorData.ports.slice();
    else if (step === "sound") ts.sound.locked = true;
    else if (step === "mic") ts.mic.done = true;
    else if (step === "deck") ts.deck.grabbed = true;
    else if (step === "qa") {
      ts.qa.index = ts.qa.order ? ts.qa.order.length : MirrorData.qaItems.length;
      ts.qa.done = true;
    }

    const stepNow = this.#msFromElapsed(finishedAt, null);
    this.#advanceStep(ts, finishedAt, stepNow);
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step,
      label,
      hiccup,
      penaltyAdded,
      penalties: ts.penalties,
      finishedAt,
      nextStep: this.#currentStep(ts),
      nextPlayerId: this.#currentPlayerId(ts),
      wrappedUp: false,
    };
  }

  /* Advance any due bot (or autoPilot human) setup steps up to elapsedSeconds. */
  advanceBotSetup(teamOrId, elapsedSeconds, { autoPilotIds = null } = {}) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return { ok: false, reason: "Team is not in Setup Crew." };
    if (typeof elapsedSeconds !== "number" || !Number.isFinite(elapsedSeconds)) {
      return { ok: false, reason: "Invalid elapsedSeconds." };
    }
    const isAuto = id => !!(autoPilotIds && (autoPilotIds instanceof Set
      ? autoPilotIds.has(id)
      : Array.isArray(autoPilotIds) && autoPilotIds.includes(id)));

    const events = [];
    while (!ts.wrappedUp) {
      const step = this.#currentStep(ts);
      const slot = this.#ownerSlot(ts, step);
      if (!slot) break;
      const auto = isAuto(slot.playerId);
      if (!slot.isBot && !auto) break;
      const dueAt = ts.stepStartedAt + SetupCrew.botStepDuration(step);
      if (elapsedSeconds < dueAt) break;
      const ev = this.completeBotStep(slot.playerId, { elapsedSeconds: dueAt, autoPilot: auto });
      if (!ev.ok) break;
      events.push(ev);
    }

    return {
      ok: true,
      teamId: ts.teamId,
      events,
      currentStep: this.#currentStep(ts),
      currentPlayerId: this.#currentPlayerId(ts),
      wrappedUp: ts.wrappedUp,
      penalties: ts.penalties,
    };
  }

  teamIds() { return [...this.#teams.keys()]; }
  hasPlayer(playerOrId) { return !!this.#lookupPlayer(playerOrId); }

  slotsFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.slots.map(s => ({ ...s, steps: s.steps.slice() })) : [];
  }

  danceIdsFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.danceIds.slice() : [];
  }

  slotOf(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return null;
    const ts = this.#teams.get(entry.teamId);
    const slot = ts ? ts.slots[entry.slotIndex] : null;
    return slot ? { teamId: entry.teamId, ...slot, steps: slot.steps.slice() } : null;
  }

  currentStep(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? this.#currentStep(ts) : null;
  }

  currentPlayerId(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? this.#currentPlayerId(ts) : null;
  }

  isPlayersTurn(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return false;
    const ts = this.#teams.get(entry.teamId);
    return !!ts && !ts.wrappedUp && this.#currentPlayerId(ts) === entry.playerId;
  }

  isWrappedUp(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return !!ts && ts.wrappedUp;
  }

  penaltiesFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.penalties : 0;
  }

  micSequenceFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts && ts.mic.sequence ? ts.mic.sequence.slice() : null;
  }

  deckOrderFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts && ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null;
  }

  qaOrderFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts && ts.qa.order ? ts.qa.order.slice() : null;
  }

  currentQaFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "qa" || !ts.qa.order || ts.qa.index >= ts.qa.order.length) {
      return null;
    }
    const itemIndex = ts.qa.order[ts.qa.index];
    const item = MirrorData.qaItems[itemIndex];
    return {
      index: ts.qa.index,
      total: ts.qa.order.length,
      itemIndex,
      question: item.question,
      options: item.options.slice(),
      correctIndex: item.correctIndex,
      why: item.why,
    };
  }

  botStepDueAt(teamOrId, { autoPilot = false } = {}) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || ts.wrappedUp) return null;
    const step = this.#currentStep(ts);
    const slot = this.#ownerSlot(ts, step);
    if (!slot || (!slot.isBot && !autoPilot)) return null;
    return ts.stepStartedAt + SetupCrew.botStepDuration(step);
  }

  #isActiveHumanTurn(ts, activeHumanIds) {
    if (!ts || ts.wrappedUp) return false;
    const step = this.#currentStep(ts);
    const slot = this.#ownerSlot(ts, step);
    if (!slot || slot.isBot || slot.playerId === null || slot.playerId === undefined) return false;
    if (activeHumanIds === null || activeHumanIds === undefined) return true;
    return activeHumanIds instanceof Set
      ? activeHumanIds.has(slot.playerId)
      : Array.isArray(activeHumanIds) && activeHumanIds.includes(slot.playerId);
  }

  /* Next rules deadline (ms) for a non-idle human on Sound, Mic, Deck, or Q&A, or null. */
  nextDeadline(teamOrId, { activeHumanIds = null, now = null } = {}) {
    if (!this.#started) return null;
    const ts = this.#teams.get(idOf(teamOrId));
    if (!this.#isActiveHumanTurn(ts, activeHumanIds)) return null;
    const step = this.#currentStep(ts);
    const tickMs = MirrorData.timers.tickMs;
    const hasNow = typeof now === "number" && Number.isFinite(now);
    if (step === "sound") {
      if (ts.sound.nextTickAt === null && hasNow) {
        ts.sound.nextTickAt = now + tickMs;
        if (ts.sound.spikeAt === null) {
          const sp = this.#rollSoundSpike(ts);
          ts.sound.spikeAt = now + sp.delayTicks * tickMs;
          ts.sound.spikeBoost = sp.boost;
        }
      }
      return ts.sound.nextTickAt;
    }
    if (step === "mic") {
      return ts.mic.flashing ? ts.mic.hideAt : null;
    }
    if (step === "deck") {
      if (ts.deck.nextReshuffleAt === null && hasNow) {
        ts.deck.nextReshuffleAt = now + MirrorData.deck.reshuffleTicks * tickMs;
      }
      return ts.deck.nextReshuffleAt;
    }
    if (step === "qa") {
      if (ts.qa.itemDeadlineAt === null && hasNow) {
        ts.qa.itemDeadlineAt = now + MirrorData.qa.countdownTicks * tickMs;
      }
      return ts.qa.itemDeadlineAt;
    }
    return null;
  }

  /* Advance all passed SetupCrew deadlines up to now for a non-idle human turn. */
  tickDeadlines(teamOrId, now, { activeHumanIds = null, elapsedSeconds = null } = {}) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return { ok: false, reason: "Team is not in Setup Crew." };
    if (typeof now !== "number" || !Number.isFinite(now)) {
      return { ok: false, reason: "Invalid timestamp." };
    }
    if (!this.#isActiveHumanTurn(ts, activeHumanIds)) {
      return { ok: true, teamId: ts.teamId, events: [] };
    }

    const events = [];
    const tickMs = MirrorData.timers.tickMs;
    const S = MirrorData.sound;
    const D = MirrorData.deck;
    let guard = 0;

    while (!ts.wrappedUp && this.#isActiveHumanTurn(ts, activeHumanIds)) {
      if (++guard > 2000) throw new Error("Setup deadline loop.");
      const dueAt = this.nextDeadline(ts.teamId, { activeHumanIds, now });
      if (dueAt === null || dueAt > now) break;
      const step = this.#currentStep(ts);
      const pid = this.#currentPlayerId(ts);
      const elAt = this.#elapsedFromMs(dueAt);
      const el = elAt !== null ? elAt : elapsedSeconds;

      if (step === "sound") {
        ts.sound.nextTickAt = dueAt + tickMs;
        if (ts.sound.spikeAt !== null && dueAt >= ts.sound.spikeAt) {
          ts.sound.level = Math.min(S.max, ts.sound.level + ts.sound.spikeBoost);
          ts.sound.spikesTriggered += 1;
          const sp = this.#rollSoundSpike(ts);
          ts.sound.spikeAt = dueAt + sp.delayTicks * tickMs;
          ts.sound.spikeBoost = sp.boost;
          events.push({ kind: "soundSpike", at: dueAt, teamId: ts.teamId, playerId: pid, level: ts.sound.level });
        }
        const drift = ts.sound.level > S.start ? -S.driftStep : ts.sound.level < S.start ? S.driftStep : 0;
        const jitter = this.#rollSoundJitter();
        ts.sound.level = Math.max(S.min, Math.min(S.max, ts.sound.level + drift + jitter));
        if (ts.sound.level >= S.feedbackAt) {
          ts.sound.feedbacks += 1;
          const penaltyAdded = S.feedbackPenalty;
          ts.penalties += penaltyAdded;
          ts.penaltiesAdded += penaltyAdded;
          ts.sound.level = S.start;
          ts.sound.holdTicks = 0;
          events.push({
            kind: "soundFeedback",
            at: dueAt,
            teamId: ts.teamId,
            playerId: pid,
            penaltyAdded,
            penalties: ts.penalties,
          });
        } else if (ts.sound.level >= S.greenMin && ts.sound.level <= S.greenMax) {
          ts.sound.holdTicks += 1;
          if (ts.sound.holdTicks >= S.holdTicks) {
            ts.sound.locked = true;
            ts.sound.lockedLevel = ts.sound.level;
            ts.sound.nextTickAt = null;
            ts.sound.spikeAt = null;
            this.#advanceStep(ts, el, dueAt);
            events.push({
              kind: "soundHeld",
              at: dueAt,
              teamId: ts.teamId,
              playerId: pid,
              level: ts.sound.lockedLevel,
              nextStep: this.#currentStep(ts),
              nextPlayerId: this.#currentPlayerId(ts),
            });
          }
        } else {
          ts.sound.holdTicks = 0;
        }
      } else if (step === "mic") {
        ts.mic.flashing = false;
        ts.mic.hideAt = null;
        events.push({ kind: "micHide", at: dueAt, teamId: ts.teamId, playerId: pid });
      } else if (step === "deck") {
        ts.deck.fileOrder = this.#shuffle(MirrorData.files.map((_, i) => i), this.#seedRng);
        ts.deck.reshuffles += 1;
        ts.deck.nextReshuffleAt = dueAt + D.reshuffleTicks * tickMs;
        events.push({
          kind: "deckReshuffle",
          at: dueAt,
          teamId: ts.teamId,
          playerId: pid,
          fileOrder: ts.deck.fileOrder.slice(),
          reshuffles: ts.deck.reshuffles,
        });
      } else if (step === "qa") {
        const res = this.timeoutQa(pid, { elapsedSeconds: el, now: dueAt });
        events.push({
          kind: "qaTimeout",
          at: dueAt,
          teamId: ts.teamId,
          playerId: pid,
          penaltyAdded: res.penaltyAdded,
          penalties: res.penalties,
          stepDone: res.stepDone,
          nextStep: res.nextStep,
          nextPlayerId: res.nextPlayerId,
        });
      } else {
        break;
      }
    }

    return { ok: true, teamId: ts.teamId, events };
  }

  /* Read-only snapshot of Setup step state for screen rendering. */
  setupViewFor(teamOrId, now = null) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return null;
    const tickMs = MirrorData.timers.tickMs;
    const S = MirrorData.sound;
    const Q = MirrorData.qa;
    const hasNow = typeof now === "number" && Number.isFinite(now);

    const isFlashing = Boolean(
      ts.mic.flashing && (ts.mic.hideAt === null || !hasNow || now < ts.mic.hideAt)
    );
    const micSeqLen = ts.mic.sequence ? ts.mic.sequence.length : 0;
    const micSecsLeft = isFlashing && ts.mic.hideAt !== null && hasNow
      ? Math.max(0, (ts.mic.hideAt - now) / 1000)
      : 0;

    const totalQaMs = Q.countdownTicks * tickMs;
    const qaMsLeft = ts.qa.itemDeadlineAt !== null && hasNow
      ? Math.max(0, Math.min(totalQaMs, ts.qa.itemDeadlineAt - now))
      : totalQaMs;
    const qaTicksLeft = Math.max(0, Math.min(Q.countdownTicks, Math.ceil(qaMsLeft / tickMs)));

    return {
      teamId: ts.teamId,
      currentStep: this.#currentStep(ts),
      currentPlayerId: this.#currentPlayerId(ts),
      wrappedUp: ts.wrappedUp,
      sound: {
        level: ts.sound.level,
        holdTicks: ts.sound.holdTicks,
        holdSeconds: (ts.sound.holdTicks * tickMs) / 1000,
        holdTargetSeconds: S.holdSeconds,
        holdProgress: Math.min(1, ts.sound.holdTicks / S.holdTicks),
        inZone: ts.sound.level >= S.greenMin && ts.sound.level <= S.greenMax,
        locked: ts.sound.locked,
        lockedLevel: ts.sound.lockedLevel,
        feedbacks: ts.sound.feedbacks,
        spikesTriggered: ts.sound.spikesTriggered,
      },
      mic: {
        round: ts.mic.round,
        index: ts.mic.index,
        length: micSeqLen,
        flashing: isFlashing,
        sequence: isFlashing && ts.mic.sequence ? ts.mic.sequence.slice() : null,
        tappedMics: ts.mic.sequence ? ts.mic.sequence.slice(0, ts.mic.index) : [],
        done: ts.mic.done,
        wrongs: ts.mic.wrongs,
        hideAt: ts.mic.hideAt,
        secondsLeft: micSecsLeft,
      },
      deck: {
        fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
        filesTried: ts.deck.filesTried.slice(),
        grabbed: ts.deck.grabbed,
        reshuffles: ts.deck.reshuffles,
        nextReshuffleAt: ts.deck.nextReshuffleAt,
      },
      qa: {
        index: ts.qa.index,
        total: ts.qa.order ? ts.qa.order.length : 0,
        itemIndex: (ts.qa.order && ts.qa.index < ts.qa.order.length) ? ts.qa.order[ts.qa.index] : null,
        right: ts.qa.right,
        wrong: ts.qa.wrong,
        timeouts: ts.qa.timeouts,
        done: ts.qa.done,
        itemDeadlineAt: ts.qa.itemDeadlineAt,
        secondsLeft: qaMsLeft / 1000,
        ticksLeft: qaTicksLeft,
        lowWarning: qaMsLeft <= Q.lowWarningTicks * tickMs,
        pct: Math.round((qaMsLeft / totalQaMs) * 100),
      },
    };
  }

  teamState(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return null;
    return {
      teamId: ts.teamId,
      currentStep: this.#currentStep(ts),
      currentPlayerId: this.#currentPlayerId(ts),
      slots: ts.slots.map(s => ({ ...s, steps: s.steps.slice() })),
      danceIds: ts.danceIds.slice(),
      stepIndex: ts.stepIndex,
      wrappedUp: ts.wrappedUp,
      penalties: ts.penalties,
      penaltiesAdded: ts.penaltiesAdded,
      qaRecovered: ts.qaRecovered,
      stepStartedAt: ts.stepStartedAt,
      botHiccups: ts.botHiccups,
      completedSteps: ts.completedSteps.slice(),
      cables: { connected: ts.cables.connected.slice(), sparks: ts.cables.sparks, bag: ts.cables.bag.slice() },
      sound: {
        locked: ts.sound.locked,
        feedbacks: ts.sound.feedbacks,
        spikesRolled: ts.sound.spikesRolled,
        level: ts.sound.level,
        holdTicks: ts.sound.holdTicks,
        nextTickAt: ts.sound.nextTickAt,
        spikeAt: ts.sound.spikeAt,
        spikeBoost: ts.sound.spikeBoost,
        spikesTriggered: ts.sound.spikesTriggered,
        lockedLevel: ts.sound.lockedLevel,
      },
      mic: {
        round: ts.mic.round,
        index: ts.mic.index,
        sequence: ts.mic.sequence ? ts.mic.sequence.slice() : null,
        done: ts.mic.done,
        wrongs: ts.mic.wrongs,
        hideAt: ts.mic.hideAt,
        flashing: ts.mic.flashing,
      },
      deck: {
        fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
        filesTried: ts.deck.filesTried.slice(),
        grabbed: ts.deck.grabbed,
        reshuffles: ts.deck.reshuffles,
        nextReshuffleAt: ts.deck.nextReshuffleAt,
      },
      qa: {
        order: ts.qa.order ? ts.qa.order.slice() : null,
        index: ts.qa.index,
        right: ts.qa.right,
        wrong: ts.qa.wrong,
        timeouts: ts.qa.timeouts,
        done: ts.qa.done,
        itemDeadlineAt: ts.qa.itemDeadlineAt,
      },
    };
  }

  state() {
    return {
      started: this.#started,
      teams: [...this.#teams.keys()].map(id => this.teamState(id)),
    };
  }

  toJSON() {
    return {
      started: this.#started,
      showtimeStartAt: this.#showtimeStartAt,
      seedRngState: Rng.canSave(this.#seedRng) ? this.#seedRng.getState() : null,
      teams: [...this.#teams.values()].map(ts => ({
        teamId: ts.teamId,
        slots: ts.slots.map(s => ({ ...s, steps: s.steps.slice() })),
        danceIds: ts.danceIds.slice(),
        stepIndex: ts.stepIndex,
        wrappedUp: ts.wrappedUp,
        penalties: ts.penalties,
        penaltiesAdded: ts.penaltiesAdded,
        qaRecovered: ts.qaRecovered,
        stepStartedAt: ts.stepStartedAt,
        botHiccups: ts.botHiccups,
        completedSteps: ts.completedSteps.slice(),
        cables: { connected: ts.cables.connected.slice(), sparks: ts.cables.sparks, bag: ts.cables.bag.slice() },
        sound: {
          locked: ts.sound.locked,
          feedbacks: ts.sound.feedbacks,
          spikesRolled: ts.sound.spikesRolled,
          level: ts.sound.level,
          holdTicks: ts.sound.holdTicks,
          nextTickAt: ts.sound.nextTickAt,
          spikeAt: ts.sound.spikeAt,
          spikeBoost: ts.sound.spikeBoost,
          spikesTriggered: ts.sound.spikesTriggered,
          lockedLevel: ts.sound.lockedLevel,
        },
        mic: {
          round: ts.mic.round,
          index: ts.mic.index,
          sequence: ts.mic.sequence ? ts.mic.sequence.slice() : null,
          done: ts.mic.done,
          wrongs: ts.mic.wrongs,
          hideAt: ts.mic.hideAt,
          flashing: ts.mic.flashing,
        },
        deck: {
          fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
          filesTried: ts.deck.filesTried.slice(),
          grabbed: ts.deck.grabbed,
          reshuffles: ts.deck.reshuffles,
          nextReshuffleAt: ts.deck.nextReshuffleAt,
        },
        qa: {
          order: ts.qa.order ? ts.qa.order.slice() : null,
          index: ts.qa.index,
          right: ts.qa.right,
          wrong: ts.qa.wrong,
          timeouts: ts.qa.timeouts,
          done: ts.qa.done,
          itemDeadlineAt: ts.qa.itemDeadlineAt,
        },
      })),
    };
  }

  static fromJSON(data, { rng, seedRng = null } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid SetupCrew save data.");
    let useSeedRng = typeof seedRng === "function" ? seedRng : null;
    if (!useSeedRng && typeof data.seedRngState === "number") {
      useSeedRng = Rng.seeded(0);
      useSeedRng.setState(data.seedRngState);
    }
    const sc = new SetupCrew(rng, null, { seedRng: useSeedRng });
    sc.#started = !!data.started;
    sc.#showtimeStartAt = typeof data.showtimeStartAt === "number" ? data.showtimeStartAt : null;
    for (const td of (data.teams || [])) {
      const ts = {
        teamId: td.teamId,
        slots: (td.slots || []).map(s => ({
          slotIndex: s.slotIndex,
          playerId: s.playerId,
          name: s.name,
          isBot: !!s.isBot,
          steps: (s.steps || []).slice(),
        })),
        danceIds: (td.danceIds || []).slice(),
        stepIndex: td.stepIndex || 0,
        wrappedUp: !!td.wrappedUp,
        penalties: td.penalties || 0,
        penaltiesAdded: td.penaltiesAdded || 0,
        qaRecovered: td.qaRecovered || 0,
        stepStartedAt: td.stepStartedAt || 0,
        botHiccups: td.botHiccups || 0,
        completedSteps: (td.completedSteps || []).slice(),
        cables: {
          connected: ((td.cables && td.cables.connected) || []).slice(),
          sparks: (td.cables && td.cables.sparks) || 0,
          bag: ((td.cables && td.cables.bag) || []).slice(),
        },
        sound: {
          locked: !!(td.sound && td.sound.locked),
          feedbacks: (td.sound && td.sound.feedbacks) || 0,
          spikesRolled: (td.sound && td.sound.spikesRolled) || 0,
          level: (td.sound && typeof td.sound.level === "number") ? td.sound.level : MirrorData.sound.start,
          holdTicks: (td.sound && td.sound.holdTicks) || 0,
          nextTickAt: (td.sound && typeof td.sound.nextTickAt === "number") ? td.sound.nextTickAt : null,
          spikeAt: (td.sound && typeof td.sound.spikeAt === "number") ? td.sound.spikeAt : null,
          spikeBoost: (td.sound && td.sound.spikeBoost) || 0,
          spikesTriggered: (td.sound && td.sound.spikesTriggered) || 0,
          lockedLevel: (td.sound && typeof td.sound.lockedLevel === "number") ? td.sound.lockedLevel : null,
        },
        mic: {
          round: (td.mic && td.mic.round) || 0,
          index: (td.mic && td.mic.index) || 0,
          sequence: td.mic && Array.isArray(td.mic.sequence) ? td.mic.sequence.slice() : null,
          done: !!(td.mic && td.mic.done),
          wrongs: (td.mic && td.mic.wrongs) || 0,
          hideAt: (td.mic && typeof td.mic.hideAt === "number") ? td.mic.hideAt : null,
          flashing: !!(td.mic && td.mic.flashing),
        },
        deck: {
          fileOrder: td.deck && Array.isArray(td.deck.fileOrder) ? td.deck.fileOrder.slice() : null,
          filesTried: ((td.deck && td.deck.filesTried) || []).slice(),
          grabbed: !!(td.deck && td.deck.grabbed),
          reshuffles: (td.deck && td.deck.reshuffles) || 0,
          nextReshuffleAt: (td.deck && typeof td.deck.nextReshuffleAt === "number") ? td.deck.nextReshuffleAt : null,
        },
        qa: {
          order: td.qa && Array.isArray(td.qa.order) ? td.qa.order.slice() : null,
          index: (td.qa && td.qa.index) || 0,
          right: (td.qa && td.qa.right) || 0,
          wrong: (td.qa && td.qa.wrong) || 0,
          timeouts: (td.qa && td.qa.timeouts) || 0,
          done: !!(td.qa && td.qa.done),
          itemDeadlineAt: (td.qa && typeof td.qa.itemDeadlineAt === "number") ? td.qa.itemDeadlineAt : null,
        },
      };
      sc.#teams.set(ts.teamId, ts);
      for (const slot of ts.slots) {
        sc.#playerIndex.set(slot.playerId, {
          teamId: ts.teamId,
          slotIndex: slot.slotIndex,
          playerId: slot.playerId,
          name: slot.name,
          isBot: slot.isBot,
        });
      }
    }
    return sc;
  }
}

/* Dance Crew state for Presentation Day: dancer roster taken from SetupCrew's crew split,
   seeded per-dancer note charts & tempo ramp, hit judging, miss deadlines, idle gating,
   averaged boosts and penalties across dancers, bot dance boost timing, and toJSON/fromJSON.
   Outside code calls MirrorTrial only. */
class DanceCrew {
  #rng;
  #seedRng;
  #started = false;
  #showtimeStartAt = null;
  #teams = new Map();       // teamId -> { teamId, order: playerId[], dancers: Map<playerId, rec> }
  #playerIndex = new Map(); // playerId -> { teamId, rec }

  constructor(rng, entries = null, options = {}) {
    if (typeof rng !== "function") throw new Error("DanceCrew requires a seeded rng.");
    this.#rng = rng;
    this.#seedRng = options && typeof options.seedRng === "function"
      ? options.seedRng
      : deriveSeedRng(rng);
    if (entries !== null) this.start(entries, options);
  }

  get started() { return this.#started; }
  get showtimeStartAt() { return this.#showtimeStartAt; }

  #lookupPlayer(playerOrId) {
    const id = idOf(playerOrId);
    if (id === null || id === undefined) return null;
    return this.#playerIndex.get(id) || null;
  }

  #rollBotInterval() {
    const tickSec = MirrorData.timers.tickMs / 1000;
    const minTicks = Math.round(MirrorData.bots.danceMinSeconds / tickSec);
    const maxTicks = Math.round(MirrorData.bots.danceMaxSeconds / tickSec);
    return (minTicks + Math.floor(this.#rng() * (maxTicks - minTicks + 1))) * tickSec;
  }

  #rollChartSeed() {
    return (Math.floor(this.#seedRng() * 0x100000000) | 0);
  }

  #makeEmptyChart(seedState = null) {
    return {
      notes: [],
      nextNoteTick: 0,
      spawnedCount: 0,
      nextId: 1,
      lastDirs: [],
      rngState: typeof seedState === "number" ? (seedState | 0) : this.#rollChartSeed(),
    };
  }

  #cloneChart(chart) {
    return {
      notes: chart.notes.map(n => ({ ...n })),
      nextNoteTick: chart.nextNoteTick,
      spawnedCount: chart.spawnedCount,
      nextId: chart.nextId,
      lastDirs: chart.lastDirs.slice(),
      rngState: chart.rngState,
    };
  }

  #noteGapTicks(spawnedCount) {
    const D = MirrorData.dance;
    if (spawnedCount > D.tempoRampFastNotes) return D.gapFastTicks;
    if (spawnedCount > D.tempoRampMidNotes) return D.gapMidTicks;
    return D.gapInitialTicks;
  }

  #nextArrowDir(lastDirs, rngFn) {
    const D = MirrorData.dance;
    const arrows = D.arrows;
    const maxSame = D.maxConsecutiveSame;
    for (let attempt = 0; attempt < 24; attempt++) {
      const dir = arrows[Math.floor(rngFn() * arrows.length)];
      const n = lastDirs.length;
      if (n >= maxSame && lastDirs.slice(n - maxSame).every(prev => prev === dir)) continue;
      return dir;
    }
    const last = lastDirs[lastDirs.length - 1];
    return arrows.find(dir => dir !== last) || arrows[0];
  }

  #spawnOnChart(chart, upToTick) {
    if (chart.nextNoteTick > upToTick) return;
    const r = Rng.seeded(0);
    r.setState(chart.rngState);
    const maxSame = MirrorData.dance.maxConsecutiveSame;
    while (chart.nextNoteTick <= upToTick) {
      const spawnT = chart.nextNoteTick;
      const dir = this.#nextArrowDir(chart.lastDirs, r);
      chart.lastDirs.push(dir);
      if (chart.lastDirs.length > maxSame) chart.lastDirs.shift();
      chart.notes.push({ id: chart.nextId++, dir, t0: spawnT, judged: null, judgedAt: null });
      chart.spawnedCount += 1;
      chart.nextNoteTick = spawnT + this.#noteGapTicks(chart.spawnedCount);
    }
    chart.rngState = r.getState();
  }

  #spawnUpTo(rec, upToTick) {
    this.#spawnOnChart(rec.chart, upToTick);
  }

  #pruneJudged(chart, currentTick) {
    chart.notes = chart.notes.filter(n => !n.judged || currentTick - n.judgedAt <= 2);
  }

  #resumeChartFromIdle(chart, atTick) {
    chart.notes = chart.notes.filter(n => !n.judged && this.#missTickOf(n.t0) > atTick);
    const nextTick = Math.ceil(atTick);
    if (chart.nextNoteTick < nextTick) chart.nextNoteTick = nextTick;
  }

  #missTickOf(t0) {
    const D = MirrorData.dance;
    return t0 + D.travelTicks + D.goodWindowTicks + 1;
  }

  #tickFromOpts(elapsedSeconds, now) {
    const tickMs = MirrorData.timers.tickMs;
    if (typeof now === "number" && Number.isFinite(now) && this.#showtimeStartAt !== null) {
      return Math.max(0, (now - this.#showtimeStartAt) / tickMs);
    }
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      return Math.max(0, elapsedSeconds * (1000 / tickMs));
    }
    return 0;
  }

  #isIdlePlayer(playerOrId, opts) {
    return !!(opts && opts.isIdle) || !!(playerOrId && typeof playerOrId === "object" && playerOrId.idle);
  }

  #isActiveHumanDancer(rec, activeHumanIds) {
    if (!rec || rec.isBot) return false;
    if (activeHumanIds === null || activeHumanIds === undefined) return true;
    return activeHumanIds instanceof Set
      ? activeHumanIds.has(rec.playerId)
      : Array.isArray(activeHumanIds) && activeHumanIds.includes(rec.playerId);
  }

  beginShowtime(now = null) {
    this.#showtimeStartAt = typeof now === "number" && Number.isFinite(now) ? now : null;
    for (const ts of this.#teams.values()) {
      for (const pid of ts.order) {
        const rec = ts.dancers.get(pid);
        if (rec && !rec.isBot && rec.chart.spawnedCount === 0) {
          this.#spawnUpTo(rec, 0);
        }
      }
    }
  }

  #makeDancerRecord(p) {
    const playerId = p.playerId !== undefined ? p.playerId : p.id;
    const name = p.name !== undefined ? p.name : String(playerId);
    const isBot = !!p.isBot;
    return {
      playerId,
      name,
      isBot,
      boost: 0,
      penalties: 0,
      combo: 0,
      maxCombo: 0,
      perfects: 0,
      goods: 0,
      misses: 0,
      strays: 0,
      botBoosts: 0,
      lastActionAt: 0,
      lastBotAt: 0,
      nextBotBoostAt: isBot ? this.#rollBotInterval() : null,
      lastMove: "",
      stumbleUntilTick: 0,
      wasIdle: false,
      chart: this.#makeEmptyChart(),
    };
  }

  #checkDancer(playerOrId) {
    if (!this.#started) return { ok: false, reason: "Dance Crew has not started." };
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return { ok: false, reason: "Player is not on the Dance Crew." };
    return { ok: true, ts: this.#teams.get(entry.teamId), rec: entry.rec };
  }

  /* Initialize Dance Crew strictly from SetupCrew's crew split (or pre-split entries). */
  start(source, options = {}) {
    if (this.#started) throw new Error("Dance Crew already started.");

    if (source instanceof SetupCrew) {
      if (!source.started) throw new Error("SetupCrew must be started before DanceCrew.");
      const teams = Array.isArray(options) ? options : (options && options.teams) || null;
      const playerLookup = !Array.isArray(options) && options ? options.playerLookup || null : null;
      const playerById = new Map();
      if (Array.isArray(teams)) {
        for (const t of teams) {
          for (const p of (t.members || [])) playerById.set(p.id, p);
        }
      }
      const resolvePlayer = pid =>
        (playerLookup && playerLookup(pid)) ||
        playerById.get(pid) ||
        { playerId: pid, name: String(pid), isBot: false };

      for (const teamId of source.teamIds()) {
        const danceIds = source.danceIdsFor(teamId);
        const ts = { teamId, order: [], dancers: new Map() };
        for (const pid of danceIds) {
          const rec = this.#makeDancerRecord(resolvePlayer(pid));
          ts.order.push(rec.playerId);
          ts.dancers.set(rec.playerId, rec);
          this.#playerIndex.set(rec.playerId, { teamId, rec });
        }
        this.#teams.set(teamId, ts);
      }
    } else if (Array.isArray(source)) {
      if (source.some(item => item && typeof item.active === "function")) {
        throw new Error("DanceCrew uses SetupCrew's crew split; pass a SetupCrew instance or pre-split dancer entries.");
      }
      for (const item of source) {
        if (!item || item.teamId === undefined || item.teamId === null) {
          throw new Error("DanceCrew requires a SetupCrew instance or pre-split dancer entries.");
        }
        const ts = { teamId: item.teamId, order: [], dancers: new Map() };
        for (const p of (item.players || [])) {
          const rec = this.#makeDancerRecord(p);
          ts.order.push(rec.playerId);
          ts.dancers.set(rec.playerId, rec);
          this.#playerIndex.set(rec.playerId, { teamId: item.teamId, rec });
        }
        this.#teams.set(item.teamId, ts);
      }
    } else {
      throw new Error("DanceCrew requires a SetupCrew instance or pre-split dancer entries.");
    }

    this.#started = true;
    return this.state();
  }

  /* Judge an arrow press ("left" | "up" | "right" | "down") against the dancer's seeded note schedule. */
  press(playerOrId, dir, opts = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    if (this.#isIdlePlayer(playerOrId, opts)) {
      return { ok: false, reason: "Idle players cannot act." };
    }
    const D = MirrorData.dance;
    if (!D.arrows.includes(dir)) {
      return { ok: false, reason: "Invalid arrow." };
    }
    const { rec } = chk;
    const { elapsedSeconds = null, now = null } = opts;
    const atTick = this.#tickFromOpts(elapsedSeconds, now);
    const elSec = (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds))
      ? elapsedSeconds
      : (atTick * MirrorData.timers.tickMs) / 1000;
    if (rec.wasIdle) {
      this.#resumeChartFromIdle(rec.chart, atTick);
      rec.wasIdle = false;
    }
    this.#spawnUpTo(rec, Math.floor(atTick));

    let best = null;
    let bd = Infinity;
    for (const n of rec.chart.notes) {
      if (n.judged || n.dir !== dir) continue;
      const d = Math.abs(atTick - (n.t0 + D.travelTicks));
      if (d < bd) {
        bd = d;
        best = n;
      }
    }

    if (best && bd <= D.goodWindowTicks) {
      const quality = bd <= D.perfectWindowTicks ? "perfect" : "good";
      best.judged = quality;
      best.judgedAt = atTick;
      rec.lastMove = dir;
      rec.stumbleUntilTick = 0;
      this.#pruneJudged(rec.chart, atTick);
      const res = this.noteHit(playerOrId, quality, { elapsedSeconds: elSec });
      return { ...res, hit: true, stray: false, dir, noteId: best.id };
    }

    rec.stumbleUntilTick = atTick + D.stumbleTicks;
    this.#pruneJudged(rec.chart, atTick);
    const res = this.strayPress(playerOrId, { elapsedSeconds: elSec });
    return { ...res, hit: false, stray: true, dir, noteId: null };
  }

  /* Record a note hit ("perfect" +3 or "good" +2), capped at 45 boost per dancer. */
  noteHit(playerOrId, quality, opts = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    if (this.#isIdlePlayer(playerOrId, opts)) {
      return { ok: false, reason: "Idle players cannot act." };
    }
    if (quality !== "perfect" && quality !== "good") {
      return { ok: false, reason: "Hit quality must be perfect or good." };
    }
    const { elapsedSeconds = null } = opts;
    const { ts, rec } = chk;
    const D = MirrorData.dance;
    const rawGain = quality === "perfect" ? D.perfectBoost : D.goodBoost;
    const before = rec.boost;
    rec.boost = Math.min(D.boostCap, rec.boost + rawGain);
    const boostAdded = rec.boost - before;
    rec.combo += 1;
    if (rec.combo > rec.maxCombo) rec.maxCombo = rec.combo;
    if (quality === "perfect") rec.perfects += 1;
    else rec.goods += 1;
    if (rec.boost >= D.boostCap) rec.nextBotBoostAt = null;
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      rec.lastActionAt = elapsedSeconds;
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: rec.playerId,
      quality,
      boostAdded,
      boost: rec.boost,
      capped: rec.boost >= D.boostCap,
      combo: rec.combo,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Record a missed note costing 2 attention (averaged across dancers) and resetting combo. */
  noteMiss(playerOrId, opts = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    if (this.#isIdlePlayer(playerOrId, opts)) {
      return { ok: false, reason: "Idle players cannot act." };
    }
    const { elapsedSeconds = null } = opts;
    const { ts, rec } = chk;
    const penaltyAdded = MirrorData.dance.missPenalty;
    rec.penalties += penaltyAdded;
    rec.misses += 1;
    rec.combo = 0;
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      rec.lastActionAt = elapsedSeconds;
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: rec.playerId,
      miss: true,
      penaltyAdded,
      penalties: rec.penalties,
      combo: 0,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Record an off-beat stray key press costing 1 attention (averaged across dancers) and resetting combo. */
  strayPress(playerOrId, opts = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    if (this.#isIdlePlayer(playerOrId, opts)) {
      return { ok: false, reason: "Idle players cannot act." };
    }
    const { elapsedSeconds = null } = opts;
    const { ts, rec } = chk;
    const penaltyAdded = MirrorData.dance.strayPenalty;
    rec.penalties += penaltyAdded;
    rec.strays += 1;
    rec.combo = 0;
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      rec.lastActionAt = elapsedSeconds;
    }
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: rec.playerId,
      stray: true,
      penaltyAdded,
      penalties: rec.penalties,
      combo: 0,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Bot or autoPilot dancer gains +1 boost (up to 45), no misses, then schedules next 1.5..2.5s tick. */
  applyBotBoost(playerOrId, { elapsedSeconds = null, autoPilot = false } = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    const { ts, rec } = chk;
    if (!rec.isBot && !autoPilot) return { ok: false, reason: "Player is not a bot." };
    const cap = MirrorData.dance.boostCap;
    if (rec.boost >= cap) return { ok: false, reason: "Dancer boost is already at cap." };

    const at = (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds))
      ? elapsedSeconds
      : (rec.nextBotBoostAt !== null ? rec.nextBotBoostAt : rec.lastActionAt + this.#rollBotInterval());
    const before = rec.boost;
    rec.boost = Math.min(cap, rec.boost + MirrorData.bots.danceBoostStep);
    const boostAdded = rec.boost - before;
    rec.botBoosts += 1;
    rec.lastBotAt = at;
    const moves = MirrorData.flavor.danceMoves;
    const move = moves[(rec.botBoosts - 1) % moves.length];
    rec.nextBotBoostAt = rec.boost >= cap ? null : at + this.#rollBotInterval();
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: rec.playerId,
      at,
      boostAdded,
      boost: rec.boost,
      capped: rec.boost >= cap,
      move,
      nextBoostAt: rec.nextBotBoostAt,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Advance all due bot (or autoPilot human) dancer boosts on a team up to elapsedSeconds. */
  advanceBotDance(teamOrId, elapsedSeconds, { autoPilotIds = null } = {}) {
    if (!this.#started) return { ok: false, reason: "Dance Crew has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return { ok: false, reason: "Team is not in Dance Crew." };
    if (typeof elapsedSeconds !== "number" || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return { ok: false, reason: "Invalid elapsedSeconds." };
    }
    const isAuto = id => !!(autoPilotIds && (autoPilotIds instanceof Set
      ? autoPilotIds.has(id)
      : Array.isArray(autoPilotIds) && autoPilotIds.includes(id)));
    const cap = MirrorData.dance.boostCap;

    const events = [];
    for (const pid of ts.order) {
      const rec = ts.dancers.get(pid);
      const auto = isAuto(pid);
      if ((!rec.isBot && !auto) || rec.boost >= cap) continue;
      if (rec.nextBotBoostAt === null) {
        rec.nextBotBoostAt = rec.lastActionAt + this.#rollBotInterval();
      }
      while (rec.boost < cap && rec.nextBotBoostAt !== null && elapsedSeconds >= rec.nextBotBoostAt) {
        const ev = this.applyBotBoost(pid, { elapsedSeconds: rec.nextBotBoostAt, autoPilot: auto });
        if (!ev.ok) break;
        events.push(ev);
      }
    }
    events.sort((a, b) => a.at - b.at);

    return {
      ok: true,
      teamId: ts.teamId,
      events,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Next miss deadline (ms) among active non-idle human dancers on a team, or null. */
  nextDeadline(teamOrId, { activeHumanIds = null, includeSpawns = false } = {}) {
    if (!this.#started || this.#showtimeStartAt === null) return null;
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return null;
    const tickMs = MirrorData.timers.tickMs;
    let earliest = Infinity;
    for (const pid of ts.order) {
      const rec = ts.dancers.get(pid);
      if (!this.#isActiveHumanDancer(rec, activeHumanIds)) continue;
      let minT0 = null;
      for (const n of rec.chart.notes) {
        if (!n.judged && (minT0 === null || n.t0 < minT0)) minT0 = n.t0;
      }
      if (minT0 === null) minT0 = rec.chart.nextNoteTick;
      const dueAt = this.#showtimeStartAt + this.#missTickOf(minT0) * tickMs;
      if (dueAt < earliest) earliest = dueAt;
      if (includeSpawns) {
        const spawnAt = this.#showtimeStartAt + rec.chart.nextNoteTick * tickMs;
        if (spawnAt < earliest) earliest = spawnAt;
      }
    }
    return Number.isFinite(earliest) ? earliest : null;
  }

  /* Spawn notes and record any missed-note deadlines up to now for active non-idle human dancers. */
  tickDeadlines(teamOrId, now, { activeHumanIds = null } = {}) {
    if (!this.#started) return { ok: false, reason: "Dance Crew has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return { ok: false, reason: "Team is not in Dance Crew." };
    if (typeof now !== "number" || !Number.isFinite(now)) {
      return { ok: false, reason: "Invalid timestamp." };
    }
    if (this.#showtimeStartAt === null) {
      return {
        ok: true,
        teamId: ts.teamId,
        events: [],
        avgBoost: this.avgBoostFor(ts.teamId),
        avgPenalties: this.avgPenaltiesFor(ts.teamId),
      };
    }

    const tickMs = MirrorData.timers.tickMs;
    const D = MirrorData.dance;
    const currentTick = Math.max(0, (now - this.#showtimeStartAt) / tickMs);
    const events = [];

    for (const pid of ts.order) {
      const rec = ts.dancers.get(pid);
      if (!rec || rec.isBot) continue;
      if (!this.#isActiveHumanDancer(rec, activeHumanIds)) {
        // Idle human dancers follow bot auto-pilot and receive no -2 missed notes.
        rec.wasIdle = true;
        rec.chart.notes = rec.chart.notes.filter(n => !n.judged && this.#missTickOf(n.t0) > currentTick);
        continue;
      }
      if (rec.wasIdle) {
        this.#resumeChartFromIdle(rec.chart, currentTick);
        rec.wasIdle = false;
      }
      this.#spawnUpTo(rec, Math.floor(currentTick));
      for (const n of rec.chart.notes) {
        if (n.judged) continue;
        const missTick = this.#missTickOf(n.t0);
        if (missTick <= currentTick) {
          n.judged = "miss";
          n.judgedAt = missTick;
          rec.stumbleUntilTick = missTick + D.stumbleTicks;
          const missRes = this.noteMiss(pid, { elapsedSeconds: (missTick * tickMs) / 1000 });
          events.push({
            kind: "danceMiss",
            at: this.#showtimeStartAt + missTick * tickMs,
            teamId: ts.teamId,
            playerId: pid,
            noteId: n.id,
            dir: n.dir,
            penaltyAdded: missRes.penaltyAdded,
            penalties: missRes.penalties,
          });
        }
      }
      this.#pruneJudged(rec.chart, currentTick);
    }

    return {
      ok: true,
      teamId: ts.teamId,
      events,
      avgBoost: this.avgBoostFor(ts.teamId),
      avgPenalties: this.avgPenaltiesFor(ts.teamId),
    };
  }

  /* Read-only snapshot of a dancer's rhythm lane and note schedule at clock now. */
  danceViewFor(playerOrId, now = null) {
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return null;
    const { teamId, rec } = entry;
    const D = MirrorData.dance;
    const tickMs = MirrorData.timers.tickMs;
    const hasNow = typeof now === "number" && Number.isFinite(now) && this.#showtimeStartAt !== null;
    const currentTick = hasNow ? Math.max(0, (now - this.#showtimeStartAt) / tickMs) : 0;

    const preview = this.#cloneChart(rec.chart);
    if (!rec.isBot && hasNow && rec.wasIdle) {
      this.#resumeChartFromIdle(preview, currentTick);
    }
    if (!rec.isBot && hasNow) {
      this.#spawnOnChart(preview, Math.floor(currentTick));
    }
    const visibleNotes = [];
    for (const n of preview.notes) {
      if (n.judged && currentTick - n.judgedAt > 2) continue;
      const progress = (currentTick - n.t0) / D.travelTicks;
      const leftPct = Math.max(-6, (1 - progress) * 100);
      let zone;
      if (n.judged) {
        zone = "judged";
      } else {
        const diff = Math.abs(currentTick - (n.t0 + D.travelTicks));
        zone = diff <= D.perfectWindowTicks ? "perfect" : diff <= D.goodWindowTicks ? "good" : "incoming";
      }
      visibleNotes.push({
        id: n.id,
        dir: n.dir,
        t0: n.t0,
        judged: n.judged,
        judgedAt: n.judgedAt,
        progress,
        leftPct,
        zone,
      });
    }

    return {
      teamId,
      playerId: rec.playerId,
      name: rec.name,
      isBot: rec.isBot,
      tick: currentTick,
      elapsedSeconds: (currentTick * tickMs) / 1000,
      boost: rec.boost,
      boostCap: D.boostCap,
      penalties: rec.penalties,
      combo: rec.combo,
      maxCombo: rec.maxCombo,
      perfects: rec.perfects,
      goods: rec.goods,
      misses: rec.misses,
      strays: rec.strays,
      hits: rec.perfects + rec.goods,
      spawnedCount: preview.spawnedCount,
      gapTicks: this.#noteGapTicks(preview.spawnedCount),
      nextNoteTick: preview.nextNoteTick,
      notes: visibleNotes,
      stumbling: currentTick < rec.stumbleUntilTick,
      lastMove: rec.lastMove,
    };
  }

  teamIds() { return [...this.#teams.keys()]; }
  hasPlayer(playerOrId) { return !!this.#lookupPlayer(playerOrId); }

  dancerIdsFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.order.slice() : [];
  }

  dancersFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return [];
    return ts.order.map(id => {
      const rec = ts.dancers.get(id);
      return { ...rec, teamId: ts.teamId, chart: this.#cloneChart(rec.chart) };
    });
  }

  dancerState(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    if (!entry) return null;
    return { ...entry.rec, teamId: entry.teamId, chart: this.#cloneChart(entry.rec.chart) };
  }

  boostFor(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    return entry ? entry.rec.boost : 0;
  }

  penaltiesForPlayer(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    return entry ? entry.rec.penalties : 0;
  }

  avgBoostFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || ts.order.length === 0) return 0;
    let total = 0;
    for (const id of ts.order) total += ts.dancers.get(id).boost;
    return total / ts.order.length;
  }

  avgPenaltiesFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || ts.order.length === 0) return 0;
    let total = 0;
    for (const id of ts.order) total += ts.dancers.get(id).penalties;
    return total / ts.order.length;
  }

  botNextBoostAt(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    return entry ? entry.rec.nextBotBoostAt : null;
  }

  botNextBoostsFor(teamOrId = null) {
    const tids = teamOrId === null || teamOrId === undefined ? [...this.#teams.keys()] : [idOf(teamOrId)];
    const out = [];
    for (const tid of tids) {
      const ts = this.#teams.get(tid);
      if (!ts) continue;
      for (const id of ts.order) {
        const rec = ts.dancers.get(id);
        if (rec.isBot) out.push({ playerId: rec.playerId, teamId: ts.teamId, seconds: rec.nextBotBoostAt });
      }
    }
    return out;
  }

  teamState(teamOrId) {
    const tid = idOf(teamOrId);
    const ts = this.#teams.get(tid);
    if (!ts) return null;
    return {
      teamId: ts.teamId,
      dancerIds: ts.order.slice(),
      dancers: this.dancersFor(tid),
      avgBoost: this.avgBoostFor(tid),
      avgPenalties: this.avgPenaltiesFor(tid),
    };
  }

  state() {
    return {
      started: this.#started,
      teams: [...this.#teams.keys()].map(id => this.teamState(id)),
    };
  }

  toJSON() {
    return {
      started: this.#started,
      showtimeStartAt: this.#showtimeStartAt,
      seedRngState: Rng.canSave(this.#seedRng) ? this.#seedRng.getState() : null,
      teams: [...this.#teams.values()].map(ts => ({
        teamId: ts.teamId,
        dancers: ts.order.map(id => {
          const rec = ts.dancers.get(id);
          return {
            playerId: rec.playerId,
            name: rec.name,
            isBot: rec.isBot,
            boost: rec.boost,
            penalties: rec.penalties,
            combo: rec.combo,
            maxCombo: rec.maxCombo,
            perfects: rec.perfects,
            goods: rec.goods,
            misses: rec.misses,
            strays: rec.strays,
            botBoosts: rec.botBoosts,
            lastActionAt: rec.lastActionAt,
            lastBotAt: rec.lastBotAt,
            nextBotBoostAt: rec.nextBotBoostAt,
            lastMove: rec.lastMove,
            stumbleUntilTick: rec.stumbleUntilTick,
            wasIdle: !!rec.wasIdle,
            chart: {
              ...this.#cloneChart(rec.chart),
              gapTicks: this.#noteGapTicks(rec.chart.spawnedCount),
            },
          };
        }),
      })),
    };
  }

  static fromJSON(data, { rng, seedRng = null } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid DanceCrew save data.");
    let useSeedRng = typeof seedRng === "function" ? seedRng : null;
    if (!useSeedRng && typeof data.seedRngState === "number") {
      useSeedRng = Rng.seeded(0);
      useSeedRng.setState(data.seedRngState);
    }
    const dc = new DanceCrew(rng, null, { seedRng: useSeedRng });
    dc.#started = !!data.started;
    dc.#showtimeStartAt = typeof data.showtimeStartAt === "number" ? data.showtimeStartAt : null;
    for (const td of (data.teams || [])) {
      const ts = { teamId: td.teamId, order: [], dancers: new Map() };
      for (const d of (td.dancers || [])) {
        const savedChart = d.chart && typeof d.chart === "object" ? d.chart : null;
        const chart = savedChart ? {
          notes: Array.isArray(savedChart.notes)
            ? savedChart.notes.map(n => ({
                id: n.id,
                dir: n.dir,
                t0: n.t0,
                judged: n.judged || null,
                judgedAt: typeof n.judgedAt === "number" ? n.judgedAt : null,
              }))
            : [],
          nextNoteTick: typeof savedChart.nextNoteTick === "number" ? savedChart.nextNoteTick : 0,
          spawnedCount: typeof savedChart.spawnedCount === "number" ? savedChart.spawnedCount : 0,
          nextId: typeof savedChart.nextId === "number" ? savedChart.nextId : 1,
          lastDirs: Array.isArray(savedChart.lastDirs) ? savedChart.lastDirs.slice() : [],
          rngState: typeof savedChart.rngState === "number" ? (savedChart.rngState | 0) : dc.#rollChartSeed(),
        } : dc.#makeEmptyChart();
        const rec = {
          playerId: d.playerId,
          name: d.name,
          isBot: !!d.isBot,
          boost: d.boost || 0,
          penalties: d.penalties || 0,
          combo: d.combo || 0,
          maxCombo: d.maxCombo || 0,
          perfects: d.perfects || 0,
          goods: d.goods || 0,
          misses: d.misses || 0,
          strays: d.strays || 0,
          botBoosts: d.botBoosts || 0,
          lastActionAt: d.lastActionAt || 0,
          lastBotAt: d.lastBotAt || 0,
          nextBotBoostAt: d.nextBotBoostAt ?? null,
          lastMove: typeof d.lastMove === "string" ? d.lastMove : "",
          stumbleUntilTick: typeof d.stumbleUntilTick === "number" ? d.stumbleUntilTick : 0,
          wasIdle: !!d.wasIdle,
          chart,
        };
        ts.order.push(rec.playerId);
        ts.dancers.set(rec.playerId, rec);
        dc.#playerIndex.set(rec.playerId, { teamId: ts.teamId, rec });
      }
      dc.#teams.set(ts.teamId, ts);
    }
    return dc;
  }
}

const MirrorParts = { MirrorLobby, SetupCrew, DanceCrew };

export { MirrorParts };
