/* Level 3 Mirror (Presentation Day) trial screens: Lobby, Crew Reveal, Setup Crew frame, cables and sound steps.
   Screen code only, loaded by index.html before game.js.
   Rules live in rules/Trial.js (MirrorTrial) and rules/MirrorParts.js. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");
  const formatMsg = (tpl, vars = {}) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));

  const STEP_LABELS = {
    cables: "Cables",
    sound: "Sound",
    mic: "Mic",
    deck: "Deck",
    qa: "Q&A",
  };

  const playerById = (team, id) => (team && team.members ? team.members.find(p => p.id === id) || null : null);

  function statusBadge(player) {
    if (!player) return "";
    const s = player.boardStatus();
    return `<span class="flag ${s === "At risk" ? "risk" : esc(s)}">${esc(s)}</span>`;
  }

  function inBand(pos, zone, width) {
    return pos >= zone && pos <= zone + width;
  }

  function shuffleArr(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function milestoneLabel(step) {
    const found = EP.MirrorData.bots.setupMilestones.find(m => m.step === step);
    return found ? found.label : step;
  }

  function ownerSlotFor(slots, step) {
    if (!Array.isArray(slots) || !slots.length || !step) return null;
    if (step === "wrapUp") return slots[slots.length - 1];
    return slots.find(s => Array.isArray(s.steps) && s.steps.includes(step)) || null;
  }

  function stepProgressText(setup, step) {
    if (!setup || !step) return "";
    if (step === "cables") return `${setup.cables.connected.length} of ${EP.MirrorData.ports.length} machines connected`;
    if (step === "sound") {
      const base = setup.sound.locked ? "Sound locked" : "Holding sound in the green zone (70–85)";
      return setup.sound.feedbacks
        ? `${base} · ${setup.sound.feedbacks} feedback reset${setup.sound.feedbacks === 1 ? "" : "s"}`
        : base;
    }
    if (step === "mic") return `Round ${setup.mic.round + 1} of ${EP.MirrorData.mic.roundLengths.length}`;
    if (step === "deck") return setup.deck.grabbed ? "Signed deck found" : "Searching shared drive for the signed deck";
    if (step === "qa") return `Question ${Math.min(setup.qa.index + 1, EP.MirrorData.qaItems.length)} of ${EP.MirrorData.qaItems.length}`;
    if (step === "wrapUp") return "Wrapping up the presentation…";
    return "";
  }

  function setupProgressSig(st) {
    if (!st) return "";
    return [
      st.cables.connected.length,
      st.cables.sparks,
      st.sound.locked ? 1 : 0,
      st.sound.feedbacks,
      st.mic.round,
      st.mic.index,
      st.deck.grabbed ? 1 : 0,
      st.qa.index,
    ].join(":");
  }

  function formatBoost(val) {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }

  function resetShowtimeState(m) {
    const S = EP.MirrorData.sound;
    m.showtimeInit = false;
    m.lastStep = null;
    m.lastOwnerId = null;
    m.lastCompletedCount = 0;
    m.lastBotHiccups = 0;
    m.lastWrappedUp = false;
    m.lastProgressSig = "";
    m.lastDanceTotalBoost = 0;
    m.danceCamMsg = "";
    m.danceCamCount = 0;
    m.cables = { tick: 0, belt: [], bag: [], nextSpawn: 0, nextId: 1 };
    m.sound = { tick: 0, level: S.start, holdTicks: 0, spikeAt: 0 };
  }

  /* opts:
     - game: Game instance
     - me: Player instance
     - team: Team instance (me's team)
     - state: mutable UI state object
     - attrName: tested attribute label
     - sabotageAlert: pre-rendered sabotage alert HTML
     - costHint: () => string
     - onRender: () => void */
  function screen(opts) {
    const G = opts.game, ME = opts.me, MYTEAM = opts.team, state = opts.state;
    const done = G.didRun("runTrial");
    const phase = G.mirrorPhase();
    const lobbyTeam = G.mirrorLobbyTeam(MYTEAM);
    const lobbyPlayers = lobbyTeam ? lobbyTeam.players : [];
    const myRec = lobbyPlayers.find(p => p.playerId === ME.id) || null;
    const crew = G.mirrorCrew(MYTEAM);
    const slots = G.mirrorSetupSlots(MYTEAM);
    const myRole = G.mirrorRole(ME);
    const failReason = G.mirrorFailReason(MYTEAM);
    const bandWidth = EP.MirrorData.lobby.signalBandWidth;

    const trialKey = G.level + ":" + ME.id + ":" + MYTEAM.id;
    if (!state.mirror || state.mirror.key !== trialKey) {
      const seenConnected = {};
      for (const p of lobbyPlayers) if (p.connected) seenConnected[p.playerId] = true;
      state.mirror = {
        key: trialKey,
        pos: Math.floor(Math.random() * 100),
        dir: Math.random() < 0.5 ? -1 : 1,
        msg: "",
        wobble: false,
        seenConnected,
      };
      resetShowtimeState(state.mirror);
    }
    const ms = state.mirror;

    const lobbySecs = () => {
      const s = G.secondsLeft();
      return s == null ? EP.MirrorData.timers.lobbySeconds : s;
    };

    const showtimeSecs = () => {
      const s = G.secondsLeft();
      if (s != null) return s;
      const msLeft = G.mirrorShowtimeSecondsLeft();
      return msLeft == null ? EP.MirrorData.timers.showtimeSeconds : Math.ceil(msLeft);
    };

    const teamAttentionPct = () => {
      const att = G.mirrorAttention(MYTEAM);
      return Math.round(Math.max(0, Math.min(100, att == null ? 0 : att)));
    };

    const rackMachines = () => {
      const live = [MYTEAM, ...(G.teams || []).filter(t => t && t !== MYTEAM)].filter(Boolean);
      return EP.MirrorData.ports.map((port, i) => ({
        port,
        name: live[i] ? live[i].name : "Rack Station " + (i + 1),
        isMine: !!live[i] && live[i] === MYTEAM,
      }));
    };

    const renderHeader = () => `<div class="preshead">
  <span class="chip r">The Trial · ${esc(opts.attrName || "Focus")}</span>
  <div class="presday">PRESENTATION DAY</div>
  <span class="label">Level ${G.level} · The Mirror · initial client presentation</span>
</div>
${opts.sabotageAlert || ""}`;

    const renderLobbyFailedHTML = () => {
      const missing = lobbyPlayers.filter(p => !p.connected);
      let detail;
      if (missing.some(p => p.playerId === ME.id)) {
        detail = EP.MirrorData.flavor.statusMessages.doorsFailed;
      } else if (missing.length) {
        detail = `Doors closed before everyone connected (${missing.map(p => p.name).join(", ")} missed the call).`;
      } else {
        detail = "No active teammates connected before the doors closed.";
      }
      return `<div class="panel ready mirror-failed" id="mirrorLobbyFailed">
  <div class="readybig mirror-fail-title">LOBBY FAILED</div>
  <span class="failnote">TRIAL FAILED · Score 0</span>
  <p>${esc(detail)}</p>
  <p class="hint">Your team failed the lobby and scores 0 for Presentation Day.</p>
</div>`;
    };

    const renderResultHTML = () => {
      const rank = G.trialRanking();
      const maxScore = EP.Trial.MirrorTrial.MAX_SCORE;
      const mine = rank.find(x => x.team === MYTEAM);
      const shown = x => Math.min(maxScore, Math.max(0, Math.round(x)));
      const hint = opts.costHint ? `<span class="hint">${opts.costHint()}</span>` : "";
      const rows = rank.map(r => `<tr><td class="n">${r.place}</td><td>${esc(r.team.name)}${r.team === MYTEAM ? " (you)" : ""}</td><td class="n">${shown(r.score)} / ${maxScore}</td><td>${r.won ? "Win" : "Loss"}</td></tr>`).join("");
      return `<div class="result"><b style="color:${MYTEAM.won ? "var(--ok)" : "var(--bad)"}">Team ${MYTEAM.won ? "WIN" : "LOSS"}. Score ${shown(mine ? mine.score : 0)} of ${maxScore}.</b><span class="hint">Top ${EP.Trial.winners(rank.length)} of ${rank.length} teams win.</span><table class="levels"><thead><tr><th>Place</th><th>Team</th><th>Score</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>${hint}</div>`;
    };

    let mountedRoot = null;

    if (done) {
      const html = renderHeader() + (failReason === "lobby" ? renderLobbyFailedHTML() : "") + renderResultHTML();
      return { html, bind: null, tick: null, waitHint: "Finish Presentation Day first" };
    }

    if (phase === "lobby") {
      if (ms.showtimeInit) resetShowtimeState(ms);
      const secs = lobbySecs();
      const connectedCount = lobbyPlayers.filter(p => p.connected).length;
      const myTileHTML = myRec
        ? `<button type="button" class="ltile sig ${myRec.connected ? "in" : ""} ${ms.wobble ? "wobble" : ""}" id="mirrorSignalBtn" data-mirror-signal="me" data-pos="${ms.pos}" data-zone="${myRec.zone}" data-band="${bandWidth}" data-speed="${myRec.speed}" data-misses="${myRec.misses}" ${myRec.connected ? "disabled" : ""}>
  <span class="mname">${esc(myRec.name)} <span class="tag m">you</span></span>
  ${statusBadge(ME)}
  <span class="atrk sig" id="mirrorSigTrack"><b class="zn" style="left:${myRec.zone}%;width:${bandWidth}%"></b><i id="mirrorSigCursor" style="left:${ms.pos}%" class="${inBand(ms.pos, myRec.zone, bandWidth) ? "hot" : ""}"></i></span>
  <span class="lstat">${myRec.connected ? "IN THE CALL" : myRec.misses ? `wobbling · speed ${myRec.speed}` : "connecting…"}</span>
</button>`
        : `<div class="panel" id="mirrorInactiveNotice"><p>${statusBadge(ME)} You are ${esc(ME.boardStatus())} and not in the lobby or crews.</p></div>`;

      const mateTilesHTML = lobbyPlayers.filter(p => p.playerId !== ME.id).map(p => {
        const pl = playerById(MYTEAM, p.playerId);
        return `<div class="ltile mate ${p.connected ? "in" : ""}" data-lobby-player="${p.playerId}">
  <span class="mname">${esc(p.name)}</span>
  ${statusBadge(pl)}
  <span class="lstat">${p.connected ? "IN THE CALL" : "connecting…"}</span>
</div>`;
      }).join("");

      const waitingHint = myRec && myRec.connected
        ? `<p class="hint">${lobbyTeam && lobbyTeam.allConnected ? "Your team is in. Waiting for other teams…" : "You are in the call. Waiting for teammates to connect…"}</p>`
        : "";

      const html = `${renderHeader()}
<p class="hint">Medline is filing into the Conference Room. The doors close in <b id="lobbyCd" class="counter ${secs <= 10 ? "low" : ""}">${secs}s</b>. Every active teammate must connect before the doors close, or your team scores zero.</p>
<div class="panel">
  <div class="row" style="justify-content:space-between">
    <span class="label">Step 0 · Connect to the call (a game, not a real login, never type a real password)</span>
    <span class="counter" id="mirrorLobbyCount">${connectedCount} of ${lobbyPlayers.length} connected</span>
  </div>
  <p class="hint">Tap your signal tile when the cursor crosses the green band. A miss wobbles your signal and speeds it up.</p>
  <div class="lobby">${myTileHTML}${mateTilesHTML}</div>
  ${waitingHint}
</div>
${ms.msg ? `<div class="mmsg" id="mirrorMsg">&gt; ${esc(ms.msg)}</div>` : ""}`;

      const bind = rootEl => {
        mountedRoot = rootEl;
        const btn = rootEl.querySelector("#mirrorSignalBtn");
        if (btn) {
          btn.onclick = () => {
            G.activity(ME);
            if (G.mirrorPhase() !== "lobby") { opts.onRender(); return; }
            const lt = G.mirrorLobbyTeam(MYTEAM);
            const rec = lt ? lt.players.find(p => p.playerId === ME.id) : null;
            if (!rec || rec.connected) { opts.onRender(); return; }
            const hit = inBand(ms.pos, rec.zone, bandWidth);
            if (hit) {
              const r = G.mirrorConnect(ME);
              if (r.ok) {
                ms.wobble = false;
                ms.seenConnected[ME.id] = true;
                ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.lobbyJoined, { name: rec.name });
              } else {
                ms.msg = r.reason || "";
              }
            } else {
              const r = G.mirrorMiss(ME);
              if (r.ok) {
                ms.wobble = true;
                ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.lobbyMiss, { name: rec.name, reason: r.glitchReason });
              } else {
                ms.msg = r.reason || "";
              }
            }
            opts.onRender();
          };
        }
      };

      const tick = () => {
        if (!mountedRoot) return;
        if (G.didRun("runTrial") !== done || G.mirrorPhase() !== phase) {
          opts.onRender();
          return;
        }
        const s = lobbySecs();
        const cd = mountedRoot.querySelector("#lobbyCd");
        if (cd) {
          cd.textContent = s + "s";
          cd.classList.toggle("low", s <= 10);
        }
        const lt = G.mirrorLobbyTeam(MYTEAM);
        if (!lt) return;
        let changed = false;
        for (const p of lt.players) {
          if (p.connected && !ms.seenConnected[p.playerId]) {
            ms.seenConnected[p.playerId] = true;
            ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.lobbyJoined, { name: p.name });
            changed = true;
          }
        }
        if (changed) {
          opts.onRender();
          return;
        }
        const rec = lt.players.find(p => p.playerId === ME.id);
        if (rec && !rec.connected) {
          ms.wobble = false;
          ms.pos += ms.dir * rec.speed;
          if (ms.pos >= 100) { ms.pos = 100; ms.dir = -1; }
          else if (ms.pos <= 0) { ms.pos = 0; ms.dir = 1; }
          const cur = mountedRoot.querySelector("#mirrorSigCursor");
          if (cur) {
            cur.style.left = ms.pos + "%";
            cur.classList.toggle("hot", inBand(ms.pos, rec.zone, bandWidth));
          }
          const btn = mountedRoot.querySelector("#mirrorSignalBtn");
          if (btn) {
            btn.dataset.pos = String(ms.pos);
            btn.classList.remove("wobble");
          }
        }
      };

      return { html, bind, tick, waitHint: "Connect to the call before the doors close" };
    }

    if (phase === "reveal" || phase === "failed") {
      if (ms.showtimeInit) resetShowtimeState(ms);
      let bodyHTML;
      if (failReason === "lobby" || phase === "failed" || !crew) {
        bodyHTML = renderLobbyFailedHTML();
      } else {
        const setupRows = slots.map(slot => {
          const pl = playerById(MYTEAM, slot.playerId);
          const stepText = slot.steps.map(k => STEP_LABELS[k] || k).join(", ");
          return `<div class="mirror-slot" data-setup-slot="${slot.slotIndex}" data-player-id="${slot.playerId}">
  <span class="mirror-slot-who"><b>${slot.slotIndex + 1}. ${esc(slot.name)}</b>${slot.playerId === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(pl)}</span>
  <span class="mirror-slot-steps">${esc(stepText)}</span>
</div>`;
        }).join("");

        const danceRows = crew.danceIds.length
          ? crew.danceIds.map(pid => {
              const pl = playerById(MYTEAM, pid);
              const rec = lobbyPlayers.find(p => p.playerId === pid);
              const name = pl ? pl.name : (rec ? rec.name : String(pid));
              return `<div class="mirror-dancer-row" data-dance-player="${pid}"><span><b>${esc(name)}</b>${pid === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(pl)}</span></div>`;
            }).join("")
          : `<span class="hint">No dancers on this team.</span>`;

        let headline;
        if (myRole === "setup") {
          const mySlot = slots.find(s => s.playerId === ME.id);
          const mySteps = mySlot ? mySlot.steps.map(k => STEP_LABELS[k] || k).join(", ") : "";
          headline = mySlot
            ? `You drew Setup Crew (Slot ${mySlot.slotIndex + 1}: ${mySteps}).`
            : "You drew Setup Crew.";
        } else if (myRole === "dance") {
          headline = "You drew Dance Crew.";
        } else {
          headline = `You are ${ME.boardStatus()} and not in the crews.`;
        }

        bodyHTML = `<div class="panel ready" id="mirrorCrewReveal">
  <div class="readybig">CREW LOCKED</div>
  <p><b>${esc(headline)}</b></p>
  <div class="mirror-crews cols">
    <div class="panel" id="mirrorSetupCrew">
      <span class="label">Setup Crew (${slots.length})</span>
      <div class="mirror-crew-list">${setupRows}</div>
    </div>
    <div class="panel" id="mirrorDanceCrew">
      <span class="label">Dance Crew (${crew.danceIds.length})</span>
      <div class="mirror-crew-list">${danceRows}</div>
    </div>
  </div>
  <p class="hint">Showtime in a second<span class="rdots">…</span></p>
</div>`;
      }

      const html = renderHeader() + bodyHTML;
      const bind = rootEl => { mountedRoot = rootEl; };
      const tick = () => {
        if (!mountedRoot) return;
        if (G.didRun("runTrial") !== done || G.mirrorPhase() !== phase) {
          opts.onRender();
        }
      };
      return { html, bind, tick, waitHint: "Crews are locked. Showtime starting" };
    }

    const setup = G.mirrorSetupTeam(MYTEAM);
    const dance = G.mirrorDanceTeam(MYTEAM);
    if (!ms.showtimeInit) {
      resetShowtimeState(ms);
      ms.showtimeInit = true;
      ms.msg = "";
      if (setup) {
        ms.lastStep = setup.currentStep;
        ms.lastOwnerId = setup.currentPlayerId;
        ms.lastCompletedCount = setup.completedSteps.length;
        ms.lastBotHiccups = setup.botHiccups;
        ms.lastWrappedUp = setup.wrappedUp;
        ms.lastProgressSig = setupProgressSig(setup);
      }
      if (dance) {
        ms.lastDanceTotalBoost = dance.dancers.reduce((sum, d) => sum + d.boost, 0);
      }
    }

    const renderAttentionBarHTML = () => {
      const att = teamAttentionPct();
      const secs = showtimeSecs();
      return `<div class="attn" id="mirrorAttnBar">
  <span class="label">Audience attention</span>
  <span class="atrk" id="attnBar"><i style="width:${att}%" class="${att <= 25 ? "low" : ""}"></i></span>
  <span class="apct" id="attnPct">${att}%</span>
  <span class="counter ${secs <= 10 ? "low" : ""}" id="mirrorShowtimeCd">${fmt(secs)}</span>
</div>`;
    };

    const renderSetupFrameHTML = st => {
      const rows = EP.MirrorData.setupSteps.map((step, idx) => {
        const slot = ownerSlotFor(st.slots, step);
        const ownerPlayer = slot ? playerById(MYTEAM, slot.playerId) : null;
        const isDone = st.completedSteps.includes(step);
        const isLive = !st.wrappedUp && st.currentStep === step;
        const stateKey = isDone ? "done" : isLive ? "live" : "waiting";
        const stateLabel = isDone ? "Done" : isLive ? "Live now" : "Waiting";
        return `<div class="mirror-step-row ${isDone ? "done" : isLive ? "now" : ""}" data-setup-step="${step}" data-step-owner="${slot ? slot.playerId : ""}" data-step-state="${stateKey}">
  <span class="mirror-step-name">${idx + 1}. ${esc(STEP_LABELS[step] || step)}</span>
  <span class="mirror-step-owner">${slot ? esc(slot.name) : "Unassigned"}${slot && slot.playerId === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(ownerPlayer)}</span>
  <span class="mirror-step-state">${stateLabel}</span>
</div>`;
      }).join("");
      const lastSlot = st.slots.length ? st.slots[st.slots.length - 1] : null;
      const lastPlayer = lastSlot ? playerById(MYTEAM, lastSlot.playerId) : null;
      const wrapRow = (st.currentStep === "wrapUp" || st.wrappedUp) && lastSlot
        ? `<div class="mirror-step-row ${st.wrappedUp ? "done" : "now"}" data-setup-step="wrapUp" data-step-owner="${lastSlot.playerId}" data-step-state="${st.wrappedUp ? "done" : "live"}">
  <span class="mirror-step-name">Wrap up</span>
  <span class="mirror-step-owner">${esc(lastSlot.name)}${lastSlot.playerId === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(lastPlayer)}</span>
  <span class="mirror-step-state">${st.wrappedUp ? "Done" : "Live now"}</span>
</div>`
        : "";
      const hiccupCost = st.botHiccups * EP.MirrorData.bots.setupHiccupPenalty;
      const hiccupHTML = st.botHiccups > 0
        ? `<div class="mirror-hiccup" id="mirrorSetupHiccups">${st.botHiccups === 1 ? `Setup hiccup: attention −${hiccupCost}` : `${st.botHiccups} setup hiccups: attention −${hiccupCost}`}</div>`
        : "";
      return `<div class="panel" id="mirrorSetupFrame">
  <div class="row" style="justify-content:space-between">
    <span class="label">Setup Crew · 5 steps in order</span>
    <span class="counter" id="mirrorSetupCount">${st.completedSteps.length} of ${EP.MirrorData.setupSteps.length} done</span>
  </div>
  <div class="mirror-checklist">${rows}${wrapRow}</div>
  ${hiccupHTML}
</div>`;
    };

    const renderDanceReadoutHTML = dc => {
      if (!dc || !dc.dancers.length) {
        return `<div class="panel dpanel" id="mirrorDanceReadout">
  <span class="label">Dance Crew (0)</span>
  <p class="hint">No dancers on this team. Attention runs on Setup Crew alone.</p>
</div>`;
      }
      const rows = dc.dancers.map(d => {
        const pl = playerById(MYTEAM, d.playerId);
        return `<div class="mirror-dancer-row" data-dance-readout="${d.playerId}">
  <span><b>${esc(d.name)}</b>${d.playerId === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(pl)}</span>
  <span class="mirror-slot-steps" data-dance-boost="${d.playerId}">+${d.boost} boost</span>
</div>`;
      }).join("");
      return `<div class="panel dpanel" id="mirrorDanceReadout">
  <div class="row" style="justify-content:space-between">
    <span class="label">Dance Crew (${dc.dancers.length})</span>
    <span class="counter" id="mirrorDanceBoost">+${formatBoost(dc.avgBoost)} / ${EP.MirrorData.dance.boostCap} boost</span>
  </div>
  <div class="mirror-crew-list">${rows}</div>
  <div class="dcam" id="danceCam">&gt; ${esc(ms.danceCamMsg || "holding the room")}</div>
</div>`;
    };

    const renderWaitingViewHTML = st => {
      const curStep = st.currentStep;
      const ownerSlot = ownerSlotFor(st.slots, curStep);
      const ownerPlayer = ownerSlot ? playerById(MYTEAM, ownerSlot.playerId) : null;
      const stepName = curStep === "wrapUp" ? "Wrap up" : (STEP_LABELS[curStep] || curStep);
      return `<div class="panel mirror-wait" id="mirrorWaitingView">
  <span class="label">Waiting for your turn</span>
  <p><b>${ownerSlot ? esc(ownerSlot.name) : "Teammate"}</b> ${statusBadge(ownerPlayer)} is working on <b>${esc(stepName)}</b> now.</p>
  <p class="hint" id="mirrorWaitProgress">${esc(stepProgressText(st, curStep))} · ${st.completedSteps.length} of ${EP.MirrorData.setupSteps.length} steps done.</p>
</div>`;
    };

    const rackLaneHTML = () => {
      const C = EP.MirrorData.cables;
      const bits = ms.cables.belt.map(item => {
        if (item.judged && ms.cables.tick - item.judgedAt > 2) return "";
        const prog = (ms.cables.tick - item.t0) / C.travelTicks;
        const leftPct = Math.max(-14, (1 - prog) * 100);
        const inFrame = !item.judged && Math.abs(ms.cables.tick - (item.t0 + C.travelTicks)) <= C.hitWindowTicks;
        return `<span class="note cablebit ${item.judged ? "j" + item.judged : ""}" data-cable-item="${esc(item.port)}" data-in-frame="${inFrame ? "1" : "0"}" style="left:${leftPct}%">${esc(item.port)}</span>`;
      }).join("");
      return `<span class="hitframe plug"><b></b></span>${bits}`;
    };

    const renderCablesStepHTML = st => {
      const machines = rackMachines();
      const buttons = machines.map(m => {
        const linked = st.cables.connected.includes(m.port);
        return `<button type="button" class="mteam ${linked ? "on" : ""}" data-cable-port="${esc(m.port)}" ${linked ? "disabled" : ""}>
  <span class="mname">${esc(m.name)}${m.isMine ? ' <span class="tag m">you</span>' : ""}</span>
  <span class="mport">${linked ? esc(m.port) + " · connected" : "PORT · " + esc(m.port)}</span>
  <span class="mstat">${linked ? "signal locked" : "waiting for the cable"}</span>
</button>`;
      }).join("");
      return `<div class="panel" id="mirrorCablesStep">
  <span class="label">Step 1 · Patch the rack</span>
  <p class="hint">Cables ride the belt toward the plug frame. When a cable is inside the frame, click the machine that takes that plug. A wrong click sparks (−3 attention). Missed cables return to the belt.</p>
  <div class="lane rack" id="rackLane">${rackLaneHTML()}</div>
  <div class="mteams">${buttons}</div>
</div>`;
    };

    const renderSoundStepHTML = () => {
      const S = EP.MirrorData.sound;
      const snd = ms.sound;
      const inZone = snd.level >= S.greenMin && snd.level <= S.greenMax;
      const btns = S.controls.map(g => `<button type="button" class="btn soft sm" data-sound-gain="${g}">${g > 0 ? "+" + g : g}</button>`).join("");
      return `<div class="panel" id="mirrorSoundStep">
  <span class="label">Step 2 · Sound check · hold it steady</span>
  <p class="hint">The level drifts back toward 45 and crowd whoops spike it upward. Keep it in the green zone (70 to 85) for 3.0 seconds. Hitting 100 causes feedback and resets to 45 (−4 attention).</p>
  <div class="mixer"><span class="atrk mix"><i id="soundFill" style="width:${Math.min(100, snd.level)}%" class="${inZone ? "zone" : ""}"></i><b class="zn"></b></span><span class="apct" id="soundVal">${snd.level}</span></div>
  <div class="row">${btns}<span class="hint" id="holdN">holding ${(snd.holdTicks / 4).toFixed(1)}s of ${S.holdSeconds.toFixed(1)}s</span></div>
</div>`;
    };

    const renderStepPlaceholderHTML = step => {
      const cfg = {
        mic: { label: "Step 3 · Mic check", text: "Mic check: coming in Step 6c-2.", btn: "Continue to Deck ▶" },
        deck: { label: "Step 4 · Grab the deck", text: "Grab the deck: coming in Step 6c-2.", btn: "Continue to Q&A ▶" },
        qa: { label: "Step 5 · Rapid-fire Q&A", text: "Rapid-fire Q&A: coming in Step 6c-2.", btn: "Continue to Wrap up ▶" },
        wrapUp: { label: "Wrap up", text: "Wrap up: coming in Step 6c-2.", btn: "Wrap up presentation ▶" },
      }[step] || { label: "Setup", text: "Coming in Step 6c-2.", btn: "Continue ▶" };
      return `<div class="panel" id="mirrorStepPlaceholder" data-placeholder-step="${esc(step)}">
  <span class="label">${esc(cfg.label)}</span>
  <p>${esc(cfg.text)}</p>
  <div class="row"><button type="button" class="btn green" id="mirrorAdvanceStepPlaceholder" data-placeholder-step="${esc(step)}">${esc(cfg.btn)}</button></div>
</div>`;
    };

    const msgHTML = `<div class="mmsg" id="mirrorMsg" ${ms.msg ? "" : "hidden"}>${ms.msg ? "&gt; " + esc(ms.msg) : ""}</div>`;

    let bodyHTML;
    if (failReason === "lobby" || !setup) {
      bodyHTML = renderLobbyFailedHTML() + `<p class="hint">Waiting for other teams to finish showtime…</p>`;
    } else if (failReason === "attention") {
      bodyHTML = renderAttentionBarHTML() + renderSetupFrameHTML(setup) +
        `<div class="panel ready mirror-failed" id="mirrorAttnFailed"><div class="readybig mirror-fail-title">ROOM EMPTIED</div><span class="failnote">TRIAL FAILED · Score 0</span><p>Audience attention hit 0% before the end.</p></div>`;
    } else if (setup.wrappedUp) {
      bodyHTML = renderAttentionBarHTML() + renderSetupFrameHTML(setup) +
        `<div class="panel" id="mirrorWrappedWaiting"><span class="label">Setup complete</span><p>Presentation wrapped up. Waiting for other teams…</p></div>`;
    } else if (myRole === "dance") {
      bodyHTML = renderAttentionBarHTML() +
        `<div class="panel dpanel" id="mirrorDancePlaceholder"><span class="label">Dance Crew · Placeholder</span><p>Dance lane: coming in Step 6d.</p></div>` +
        renderSetupFrameHTML(setup) +
        msgHTML;
    } else if (myRole === "setup") {
      let stepPanelHTML;
      if (setup.currentPlayerId === ME.id) {
        if (setup.currentStep === "cables") stepPanelHTML = renderCablesStepHTML(setup);
        else if (setup.currentStep === "sound") stepPanelHTML = renderSoundStepHTML();
        else stepPanelHTML = renderStepPlaceholderHTML(setup.currentStep);
      } else {
        stepPanelHTML = renderWaitingViewHTML(setup);
      }
      bodyHTML = renderAttentionBarHTML() + renderSetupFrameHTML(setup) + stepPanelHTML + renderDanceReadoutHTML(dance) + msgHTML;
    } else {
      bodyHTML = renderAttentionBarHTML() +
        `<div class="panel" id="mirrorInactiveNotice"><p>${statusBadge(ME)} You are ${esc(ME.boardStatus())} and watching Presentation Day.</p></div>` +
        renderSetupFrameHTML(setup) + renderDanceReadoutHTML(dance);
    }

    const html = renderHeader() + bodyHTML;

    const syncSetupSnapshots = st => {
      if (!st) return;
      ms.lastStep = st.currentStep;
      ms.lastOwnerId = st.currentPlayerId;
      ms.lastCompletedCount = st.completedSteps.length;
      ms.lastBotHiccups = st.botHiccups;
      ms.lastWrappedUp = st.wrappedUp;
      ms.lastProgressSig = setupProgressSig(st);
    };

    const updateMsgEl = () => {
      if (!mountedRoot) return;
      const msgEl = mountedRoot.querySelector("#mirrorMsg");
      if (msgEl) {
        msgEl.hidden = !ms.msg;
        msgEl.textContent = ms.msg ? "> " + ms.msg : "";
      }
    };

    const updateSoundUI = () => {
      if (!mountedRoot) return;
      const S = EP.MirrorData.sound;
      const snd = ms.sound;
      const fill = mountedRoot.querySelector("#soundFill");
      if (fill) {
        fill.style.width = Math.min(100, snd.level) + "%";
        fill.classList.toggle("zone", snd.level >= S.greenMin && snd.level <= S.greenMax);
      }
      const val = mountedRoot.querySelector("#soundVal");
      if (val) val.textContent = String(snd.level);
      const hold = mountedRoot.querySelector("#holdN");
      if (hold) hold.textContent = `holding ${(snd.holdTicks / 4).toFixed(1)}s of ${S.holdSeconds.toFixed(1)}s`;
    };

    const bind = rootEl => {
      mountedRoot = rootEl;

      rootEl.querySelectorAll("[data-cable-port]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          const port = btn.dataset.cablePort;
          if (!st || st.currentStep !== "cables" || st.currentPlayerId !== ME.id || st.cables.connected.includes(port)) {
            opts.onRender();
            return;
          }
          const C = EP.MirrorData.cables;
          const machine = rackMachines().find(m => m.port === port);
          const machineName = machine ? machine.name : port;
          let best = null, bd = 999;
          for (const item of ms.cables.belt) {
            if (item.judged || item.port !== port) continue;
            const d = Math.abs(ms.cables.tick - (item.t0 + C.travelTicks));
            if (d < bd) { bd = d; best = item; }
          }
          if (best && bd <= C.hitWindowTicks) {
            const r = G.mirrorCableHit(ME, port);
            if (r.ok) {
              best.judged = "plug";
              best.judgedAt = ms.cables.tick;
              const nextSt = G.mirrorSetupTeam(MYTEAM);
              syncSetupSnapshots(nextSt);
              if (r.stepDone) {
                ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.cableAllConnected, { machine: machineName });
                if (r.nextPlayerId && r.nextPlayerId !== ME.id && nextSt) {
                  const nextSlot = ownerSlotFor(nextSt.slots, r.nextStep);
                  if (nextSlot) ms.msg += ` Handing off to ${nextSlot.name}.`;
                }
              } else {
                ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.cableConnected, { machine: machineName, left: r.remaining });
              }
            } else {
              ms.msg = r.reason || "";
            }
          } else {
            const r = G.mirrorCableMiss(ME, port);
            if (r.ok) {
              syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
              ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.cableSpark, { machine: machineName, port });
            } else {
              ms.msg = r.reason || "";
            }
          }
          opts.onRender();
        };
      });

      rootEl.querySelectorAll("[data-sound-gain]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          if (!st || st.currentStep !== "sound" || st.currentPlayerId !== ME.id || st.sound.locked) {
            opts.onRender();
            return;
          }
          const S = EP.MirrorData.sound;
          const snd = ms.sound;
          const gain = Number(btn.dataset.soundGain);
          snd.level = Math.max(S.min, Math.min(S.max, snd.level + gain));
          if (snd.level >= S.feedbackAt) {
            const r = G.mirrorSoundFeedback(ME);
            snd.level = S.start;
            snd.holdTicks = 0;
            syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
            ms.msg = r.ok ? EP.MirrorData.flavor.statusMessages.soundFeedback : (r.reason || "");
            opts.onRender();
            return;
          }
          updateSoundUI();
        };
      });

      const phBtn = rootEl.querySelector("#mirrorAdvanceStepPlaceholder");
      if (phBtn) {
        phBtn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          let st = G.mirrorSetupTeam(MYTEAM);
          if (!st || st.currentPlayerId !== ME.id) { opts.onRender(); return; }
          const curStep = st.currentStep;
          if (curStep === "mic") {
            let guard = 0;
            while (guard++ < 20 && st && st.currentStep === "mic" && st.currentPlayerId === ME.id && st.mic.sequence) {
              const r = G.mirrorMicTap(ME, st.mic.sequence[st.mic.index]);
              if (!r.ok) break;
              st = G.mirrorSetupTeam(MYTEAM);
            }
            ms.msg = EP.MirrorData.flavor.statusMessages.micDone;
          } else if (curStep === "deck") {
            const correctFile = EP.MirrorData.files.find(f => f.correct);
            if (correctFile) G.mirrorPickFile(ME, correctFile.name);
            ms.msg = EP.MirrorData.flavor.statusMessages.deckGrabbed;
          } else if (curStep === "qa") {
            let guard = 0;
            while (guard++ < 5 && st && st.currentStep === "qa" && st.currentPlayerId === ME.id && st.qa.order && st.qa.index < st.qa.order.length) {
              const item = EP.MirrorData.qaItems[st.qa.order[st.qa.index]];
              const r = G.mirrorAnswerQa(ME, item.correctIndex);
              if (!r.ok) break;
              st = G.mirrorSetupTeam(MYTEAM);
            }
            ms.msg = "Q&A complete.";
          } else if (curStep === "wrapUp") {
            G.mirrorWrapUp(ME);
          }
          syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
          opts.onRender();
        };
      }
    };

    const tick = () => {
      if (!mountedRoot) return;
      if (G.didRun("runTrial") !== done || G.mirrorPhase() !== phase || G.mirrorFailReason(MYTEAM) !== failReason) {
        opts.onRender();
        return;
      }

      const att = teamAttentionPct();
      const secs = showtimeSecs();
      const bar = mountedRoot.querySelector("#attnBar i");
      if (bar) {
        bar.style.width = att + "%";
        bar.classList.toggle("low", att <= 25);
      }
      const pct = mountedRoot.querySelector("#attnPct");
      if (pct) pct.textContent = att + "%";
      const cd = mountedRoot.querySelector("#mirrorShowtimeCd");
      if (cd) {
        cd.textContent = fmt(secs);
        cd.classList.toggle("low", secs <= 10);
      }

      const st = G.mirrorSetupTeam(MYTEAM);
      const dc = G.mirrorDanceTeam(MYTEAM);

      if (st) {
        const newHiccups = st.botHiccups - ms.lastBotHiccups;
        const newCompleted = st.completedSteps.length > ms.lastCompletedCount;
        if (newCompleted || newHiccups > 0) {
          const doneStep = st.completedSteps[st.completedSteps.length - 1];
          const label = milestoneLabel(doneStep);
          if (newHiccups > 0) {
            ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.botSetupHiccup, { label });
          } else if (ms.lastOwnerId !== ME.id) {
            ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.botSetupStep, { label });
          }
        }
        const sig = setupProgressSig(st);
        if (
          st.currentStep !== ms.lastStep ||
          st.currentPlayerId !== ms.lastOwnerId ||
          st.completedSteps.length !== ms.lastCompletedCount ||
          st.botHiccups !== ms.lastBotHiccups ||
          st.wrappedUp !== ms.lastWrappedUp ||
          sig !== ms.lastProgressSig
        ) {
          syncSetupSnapshots(st);
          opts.onRender();
          return;
        }
      }

      if (dc && dc.dancers.length) {
        const totalBoost = dc.dancers.reduce((sum, d) => sum + d.boost, 0);
        if (totalBoost > ms.lastDanceTotalBoost) {
          const mover = dc.dancers[ms.danceCamCount % dc.dancers.length];
          const moves = EP.MirrorData.flavor.danceMoves;
          ms.danceCamMsg = formatMsg(EP.MirrorData.flavor.statusMessages.danceBotMove, {
            name: mover.name,
            move: moves[ms.danceCamCount % moves.length],
          });
          ms.danceCamCount += 1;
          ms.lastDanceTotalBoost = totalBoost;
          const boostEl = mountedRoot.querySelector("#mirrorDanceBoost");
          if (boostEl) boostEl.textContent = `+${formatBoost(dc.avgBoost)} / ${EP.MirrorData.dance.boostCap} boost`;
          for (const d of dc.dancers) {
            const dEl = mountedRoot.querySelector(`[data-dance-boost="${d.playerId}"]`);
            if (dEl) dEl.textContent = `+${d.boost} boost`;
          }
          const camEl = mountedRoot.querySelector("#danceCam");
          if (camEl) camEl.textContent = "> " + ms.danceCamMsg;
        }
      }

      if (myRole === "setup" && st && !st.wrappedUp && st.currentPlayerId === ME.id) {
        if (st.currentStep === "cables") {
          const C = EP.MirrorData.cables;
          const c = ms.cables;
          c.tick += 1;
          const needed = EP.MirrorData.ports.filter(p => !st.cables.connected.includes(p));
          if (needed.length) {
            const connectedCount = st.cables.connected.length;
            const gap = connectedCount >= 3 ? C.spawnGapFast : connectedCount >= 1 ? C.spawnGapMid : C.spawnGapInitial;
            if (c.tick >= c.nextSpawn) {
              if (!c.bag.length) c.bag = shuffleArr(needed.concat(needed));
              let chosen = null;
              while (c.bag.length) {
                const candidate = c.bag.pop();
                if (needed.includes(candidate)) { chosen = candidate; break; }
              }
              if (!chosen) {
                c.bag = shuffleArr(needed.concat(needed));
                chosen = c.bag.pop() || needed[0];
              }
              c.belt.push({ id: c.nextId++, port: chosen, t0: c.tick, judged: null, judgedAt: 0 });
              c.nextSpawn = c.tick + gap;
            }
            for (const item of c.belt) {
              if (!item.judged && c.tick - (item.t0 + C.travelTicks) > C.hitWindowTicks) {
                item.judged = "past";
                item.judgedAt = c.tick;
                if (needed.includes(item.port)) {
                  c.bag.push(item.port);
                  ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.cableMissed, { port: item.port });
                }
              }
            }
            c.belt = c.belt.filter(item => !item.judged || c.tick - item.judgedAt <= 2);
            const lane = mountedRoot.querySelector("#rackLane");
            if (lane) lane.innerHTML = rackLaneHTML();
            updateMsgEl();
          }
        } else if (st.currentStep === "sound") {
          const S = EP.MirrorData.sound;
          const snd = ms.sound;
          snd.tick += 1;
          if (!snd.spikeAt) {
            snd.spikeAt = snd.tick + S.spikeInitialMinTicks + Math.floor(Math.random() * S.spikeInitialRangeTicks);
          }
          if (snd.tick >= snd.spikeAt) {
            snd.level = Math.min(S.max, snd.level + S.spikeBoostMin + Math.floor(Math.random() * S.spikeBoostRange));
            snd.spikeAt = snd.tick + S.spikeIntervalMinTicks + Math.floor(Math.random() * S.spikeIntervalRangeTicks);
            ms.msg = EP.MirrorData.flavor.statusMessages.soundSpike;
          }
          const drift = snd.level > S.start ? -S.driftStep : snd.level < S.start ? S.driftStep : 0;
          const jitter = Math.round(Math.random() * (S.jitterHalf * 2) - S.jitterHalf);
          snd.level = Math.max(S.min, Math.min(S.max, snd.level + drift + jitter));
          if (snd.level >= S.feedbackAt) {
            const r = G.mirrorSoundFeedback(ME);
            snd.level = S.start;
            snd.holdTicks = 0;
            syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
            ms.msg = r.ok ? EP.MirrorData.flavor.statusMessages.soundFeedback : (r.reason || "");
            opts.onRender();
            return;
          }
          if (snd.level >= S.greenMin && snd.level <= S.greenMax) {
            snd.holdTicks += 1;
            if (snd.holdTicks >= S.holdTicks) {
              const r = G.mirrorSoundHeld(ME);
              if (r.ok) {
                const nextSt = G.mirrorSetupTeam(MYTEAM);
                syncSetupSnapshots(nextSt);
                ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.soundLocked, { level: snd.level });
                if (r.nextPlayerId && r.nextPlayerId !== ME.id && nextSt) {
                  const nextSlot = ownerSlotFor(nextSt.slots, r.nextStep);
                  if (nextSlot) ms.msg += ` Handing off to ${nextSlot.name}.`;
                }
              }
              opts.onRender();
              return;
            }
          } else {
            snd.holdTicks = 0;
          }
          updateSoundUI();
          updateMsgEl();
        }
      }
    };

    return { html, bind, tick, waitHint: "Finish Presentation Day first" };
  }

  root.MirrorView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
