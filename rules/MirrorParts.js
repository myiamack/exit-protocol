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

/* Setup Crew state for Presentation Day: seeded slot order, 1/2/3 player step splits,
   sequential step turns, results-based step actions, seeded content picks, penalties/recovery,
   bot setup schedule/hiccups, and wrap-up. Outside code calls MirrorTrial only. */
class SetupCrew {
  #rng;
  #started = false;
  #teams = new Map();       // teamId -> team setup state
  #playerIndex = new Map(); // playerId -> { teamId, slotIndex, name, isBot }

  constructor(rng, entries = null, options = {}) {
    if (typeof rng !== "function") throw new Error("SetupCrew requires a seeded rng.");
    this.#rng = rng;
    if (entries !== null) this.start(entries, options);
  }

  get started() { return this.#started; }

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

  #shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.#rng() * (i + 1));
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

  #enterStep(ts, step) {
    if (step === "mic") {
      ts.mic.round = 0;
      ts.mic.index = 0;
      ts.mic.done = false;
      ts.mic.sequence = this.#makeMicSequence(MirrorData.mic.roundLengths[0]);
    } else if (step === "deck") {
      ts.deck.fileOrder = this.#makeFileOrder();
      ts.deck.filesTried = [];
      ts.deck.grabbed = false;
      ts.deck.reshuffles = 0;
    } else if (step === "qa") {
      ts.qa.order = this.#makeQaOrder();
      ts.qa.index = 0;
      ts.qa.done = false;
    }
  }

  #advanceStep(ts, elapsedSeconds = null) {
    if (ts.stepIndex < MirrorData.setupSteps.length) {
      ts.completedSteps.push(MirrorData.setupSteps[ts.stepIndex]);
    }
    ts.stepIndex += 1;
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds)) {
      ts.stepStartedAt = elapsedSeconds;
    }
    const next = this.#currentStep(ts);
    if (next) this.#enterStep(ts, next);
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
        cables: { connected: [], sparks: 0 },
        sound: { locked: false, feedbacks: 0 },
        mic: { round: 0, index: 0, sequence: null, done: false, wrongs: 0 },
        deck: { fileOrder: null, filesTried: [], grabbed: false, reshuffles: 0 },
        qa: { order: null, index: 0, right: 0, wrong: 0, timeouts: 0, done: false },
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
  cableHit(playerOrId, port, { elapsedSeconds = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "cables");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    if (!MirrorData.ports.includes(port)) return { ok: false, reason: "Unknown cable port." };
    if (ts.cables.connected.includes(port)) return { ok: false, reason: "Port is already connected." };
    ts.cables.connected.push(port);
    const remaining = MirrorData.ports.length - ts.cables.connected.length;
    const stepDone = remaining === 0;
    if (stepDone) this.#advanceStep(ts, elapsedSeconds);
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

  /* Step 2 (sound): record that sound held steady in the green zone for 3 seconds. */
  soundHeld(playerOrId, { elapsedSeconds = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "sound");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    ts.sound.locked = true;
    this.#advanceStep(ts, elapsedSeconds);
    return {
      ok: true,
      teamId: ts.teamId,
      playerId: entry.playerId,
      step: "sound",
      hit: true,
      locked: true,
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

  /* Step 3 (mic): record a mic tap against the seeded sequence across rounds of lengths 3, 4, 5. */
  micTap(playerOrId, micNumber, { elapsedSeconds = null } = {}) {
    const chk = this.#checkTurn(playerOrId, "mic");
    if (!chk.ok) return chk;
    const { ts, entry } = chk;
    if (!Number.isInteger(micNumber) || micNumber < 1 || micNumber > MirrorData.mic.count) {
      return { ok: false, reason: "Invalid mic number." };
    }
    const expected = ts.mic.sequence[ts.mic.index];
    if (micNumber === expected) {
      ts.mic.index += 1;
      if (ts.mic.index === ts.mic.sequence.length) {
        if (ts.mic.round >= MirrorData.mic.roundLengths.length - 1) {
          ts.mic.done = true;
          this.#advanceStep(ts, elapsedSeconds);
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
  pickFile(playerOrId, fileIndexOrName, { elapsedSeconds = null } = {}) {
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
      this.#advanceStep(ts, elapsedSeconds);
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
  reshuffleDeck(teamOrId) {
    if (!this.#started) return { ok: false, reason: "Setup has not started." };
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts || this.#currentStep(ts) !== "deck") return { ok: false, reason: "Deck step is not active." };
    ts.deck.fileOrder = this.#makeFileOrder();
    ts.deck.reshuffles += 1;
    return {
      ok: true,
      teamId: ts.teamId,
      fileOrder: ts.deck.fileOrder.slice(),
      reshuffles: ts.deck.reshuffles,
    };
  }

  /* Step 5 (qa): record a multiple-choice answer. Right restores up to 5 penalty points; wrong costs 5. */
  answerQa(playerOrId, answerIndex, { elapsedSeconds = null } = {}) {
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
      this.#advanceStep(ts, elapsedSeconds);
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
  timeoutQa(playerOrId, { elapsedSeconds = null } = {}) {
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
      this.#advanceStep(ts, elapsedSeconds);
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

    if (step === "cables") ts.cables.connected = MirrorData.ports.slice();
    else if (step === "sound") ts.sound.locked = true;
    else if (step === "mic") ts.mic.done = true;
    else if (step === "deck") ts.deck.grabbed = true;
    else if (step === "qa") {
      ts.qa.index = ts.qa.order ? ts.qa.order.length : MirrorData.qaItems.length;
      ts.qa.done = true;
    }

    this.#advanceStep(ts, finishedAt);
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
      cables: { connected: ts.cables.connected.slice(), sparks: ts.cables.sparks },
      sound: { locked: ts.sound.locked, feedbacks: ts.sound.feedbacks },
      mic: {
        round: ts.mic.round,
        index: ts.mic.index,
        sequence: ts.mic.sequence ? ts.mic.sequence.slice() : null,
        done: ts.mic.done,
        wrongs: ts.mic.wrongs,
      },
      deck: {
        fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
        filesTried: ts.deck.filesTried.slice(),
        grabbed: ts.deck.grabbed,
        reshuffles: ts.deck.reshuffles,
      },
      qa: {
        order: ts.qa.order ? ts.qa.order.slice() : null,
        index: ts.qa.index,
        right: ts.qa.right,
        wrong: ts.qa.wrong,
        timeouts: ts.qa.timeouts,
        done: ts.qa.done,
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
        cables: { connected: ts.cables.connected.slice(), sparks: ts.cables.sparks },
        sound: { locked: ts.sound.locked, feedbacks: ts.sound.feedbacks },
        mic: {
          round: ts.mic.round,
          index: ts.mic.index,
          sequence: ts.mic.sequence ? ts.mic.sequence.slice() : null,
          done: ts.mic.done,
          wrongs: ts.mic.wrongs,
        },
        deck: {
          fileOrder: ts.deck.fileOrder ? ts.deck.fileOrder.slice() : null,
          filesTried: ts.deck.filesTried.slice(),
          grabbed: ts.deck.grabbed,
          reshuffles: ts.deck.reshuffles,
        },
        qa: {
          order: ts.qa.order ? ts.qa.order.slice() : null,
          index: ts.qa.index,
          right: ts.qa.right,
          wrong: ts.qa.wrong,
          timeouts: ts.qa.timeouts,
          done: ts.qa.done,
        },
      })),
    };
  }

  static fromJSON(data, { rng } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid SetupCrew save data.");
    const sc = new SetupCrew(rng);
    sc.#started = !!data.started;
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
        },
        sound: {
          locked: !!(td.sound && td.sound.locked),
          feedbacks: (td.sound && td.sound.feedbacks) || 0,
        },
        mic: {
          round: (td.mic && td.mic.round) || 0,
          index: (td.mic && td.mic.index) || 0,
          sequence: td.mic && Array.isArray(td.mic.sequence) ? td.mic.sequence.slice() : null,
          done: !!(td.mic && td.mic.done),
          wrongs: (td.mic && td.mic.wrongs) || 0,
        },
        deck: {
          fileOrder: td.deck && Array.isArray(td.deck.fileOrder) ? td.deck.fileOrder.slice() : null,
          filesTried: ((td.deck && td.deck.filesTried) || []).slice(),
          grabbed: !!(td.deck && td.deck.grabbed),
          reshuffles: (td.deck && td.deck.reshuffles) || 0,
        },
        qa: {
          order: td.qa && Array.isArray(td.qa.order) ? td.qa.order.slice() : null,
          index: (td.qa && td.qa.index) || 0,
          right: (td.qa && td.qa.right) || 0,
          wrong: (td.qa && td.qa.wrong) || 0,
          timeouts: (td.qa && td.qa.timeouts) || 0,
          done: !!(td.qa && td.qa.done),
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
   results-based note hits (cap 45), misses/strays, averaged boosts and penalties across dancers,
   bot dance boost timing (+1 every 1.5 to 2.5 seconds, no misses), and toJSON/fromJSON.
   Outside code calls MirrorTrial only. */
class DanceCrew {
  #rng;
  #started = false;
  #teams = new Map();       // teamId -> { teamId, order: playerId[], dancers: Map<playerId, rec> }
  #playerIndex = new Map(); // playerId -> { teamId, rec }

  constructor(rng, entries = null, options = {}) {
    if (typeof rng !== "function") throw new Error("DanceCrew requires a seeded rng.");
    this.#rng = rng;
    if (entries !== null) this.start(entries, options);
  }

  get started() { return this.#started; }

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

  /* Record a note hit ("perfect" +3 or "good" +2), capped at 45 boost per dancer. */
  noteHit(playerOrId, quality, { elapsedSeconds = null } = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
    if (quality !== "perfect" && quality !== "good") {
      return { ok: false, reason: "Hit quality must be perfect or good." };
    }
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
  noteMiss(playerOrId, { elapsedSeconds = null } = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
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
  strayPress(playerOrId, { elapsedSeconds = null } = {}) {
    const chk = this.#checkDancer(playerOrId);
    if (!chk.ok) return chk;
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

  teamIds() { return [...this.#teams.keys()]; }
  hasPlayer(playerOrId) { return !!this.#lookupPlayer(playerOrId); }

  dancerIdsFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    return ts ? ts.order.slice() : [];
  }

  dancersFor(teamOrId) {
    const ts = this.#teams.get(idOf(teamOrId));
    if (!ts) return [];
    return ts.order.map(id => ({ ...ts.dancers.get(id), teamId: ts.teamId }));
  }

  dancerState(playerOrId) {
    const entry = this.#lookupPlayer(playerOrId);
    return entry ? { ...entry.rec, teamId: entry.teamId } : null;
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
      teams: [...this.#teams.values()].map(ts => ({
        teamId: ts.teamId,
        dancers: ts.order.map(id => ({ ...ts.dancers.get(id) })),
      })),
    };
  }

  static fromJSON(data, { rng } = {}) {
    if (!data || typeof data !== "object") throw new Error("Invalid DanceCrew save data.");
    const dc = new DanceCrew(rng);
    dc.#started = !!data.started;
    for (const td of (data.teams || [])) {
      const ts = { teamId: td.teamId, order: [], dancers: new Map() };
      for (const d of (td.dancers || [])) {
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
