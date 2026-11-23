/* Level 3 Mirror (Presentation Day) trial screens: Lobby, Crew Reveal, Setup Crew (cables, sound, mic, deck, Q&A, wrap up).
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
    if (step === "mic") {
      const len = (setup.mic.sequence && setup.mic.sequence.length) || EP.MirrorData.mic.roundLengths[setup.mic.round] || 3;
      return `Round ${setup.mic.round + 1} of ${EP.MirrorData.mic.roundLengths.length} · ${setup.mic.index} of ${len}`;
    }
    if (step === "deck") {
      if (setup.deck.grabbed) return "Signed deck found";
      const n = setup.deck.filesTried.length;
      return n ? `Searching shared drive (${n} wrong file${n === 1 ? "" : "s"} ruled out)` : "Searching shared drive for the signed deck";
    }
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
      st.mic.wrongs,
      st.deck.grabbed ? 1 : 0,
      st.deck.filesTried.length,
      st.qa.index,
      st.qa.right,
      st.qa.wrong,
      st.qa.timeouts,
    ].join(":");
  }

  function formatBoost(val) {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }

  function formatAtt(val) {
    const n = Math.max(0, Math.min(100, typeof val === "number" && Number.isFinite(val) ? val : 0));
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
    return n.toFixed(1);
  }

  function countSetupHiccups(setup) {
    if (!setup) return 0;
    return setup.botHiccups + setup.cables.sparks + setup.sound.feedbacks + setup.mic.wrongs +
      setup.deck.filesTried.length + setup.qa.wrong + setup.qa.timeouts;
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
    m.dance = null;
    m.cables = { tick: 0, belt: [], nextSpawn: 0, nextId: 1 };
    m.sound = { tick: 0, level: S.start, holdTicks: 0, spikeAt: 0, spikeBoost: 0 };
    m.mic = { tick: 0, hideAt: 0, flashKey: null };
    m.deck = { tick: 0, shuffleAt: 0, active: false };
    m.qa = { tick: 0, deadline: 0, qKey: null };
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
      const cursorStart = G.mirrorLobbyCursorStart(ME);
      state.mirror = {
        key: trialKey,
        pos: cursorStart ? cursorStart.pos : 0,
        dir: cursorStart ? cursorStart.dir : 1,
        msg: "",
        wobble: false,
        seenConnected,
      };
      resetShowtimeState(state.mirror);
    }
    const ms = state.mirror;
    if (ms._danceCleanup) {
      ms._danceCleanup();
      ms._danceCleanup = null;
    }

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
      const mine = rank.find(x => x.team === MYTEAM) || null;
      const mineWon = mine ? !!mine.won : !!MYTEAM.won;
      const mineScore = mine ? mine.base : 0;
      const mineAtt = mine ? mine.attention : (G.mirrorAttention(MYTEAM) || 0);
      const mineAttClamped = Math.max(0, Math.min(100, mineAtt));
      const mineFailReason = (mine && mine.failReason) || failReason;

      const attnBarHTML = `<div class="attn final" id="mirrorAttnBar">
  <span class="label">Audience attention</span>
  <span class="atrk" id="attnBar"><i style="width:${mineAttClamped}%" class="${mineAttClamped <= 25 ? "low" : ""}"></i></span>
  <span class="apct" id="attnPct">${formatAtt(mineAtt)}%</span>
</div>`;

      const failBannerHTML = mineFailReason === "lobby"
        ? renderLobbyFailedHTML()
        : mineFailReason === "attention"
          ? `<div class="panel ready mirror-failed" id="mirrorAttnFailed">
  <div class="readybig mirror-fail-title">ROOM EMPTIED</div>
  <span class="failnote">TRIAL FAILED · Score 0</span>
  <p>Audience attention hit 0% before the end.</p>
</div>`
          : "";

      const rows = rank.map(r => {
        const failTag = r.failReason === "lobby"
          ? ' <span class="mirror-row-fail">Failed lobby</span>'
          : r.failReason === "attention"
            ? ' <span class="mirror-row-fail">Attention 0%</span>'
            : "";
        return `<tr data-team-id="${r.team.id}" data-place="${r.place}" data-fail-reason="${r.failReason || ""}"><td class="n">${r.place}</td><td>${esc(r.team.name)}${r.team === MYTEAM ? " (you)" : ""}${failTag}</td><td class="n">${formatAtt(r.attention)}%</td><td class="n">${r.base} / ${maxScore}</td><td>${r.won ? "Win" : "Loss"}</td></tr>`;
      }).join("");

      const connectedCount = lobbyPlayers.filter(p => p.connected).length;
      const totalLobby = lobbyPlayers.length;
      const lobbySummary = (mineFailReason === "lobby" || (lobbyTeam && lobbyTeam.failed))
        ? `Failed (${connectedCount} of ${totalLobby} connected before doors closed)`
        : lobbyTeam
          ? `Passed (${connectedCount} of ${totalLobby} connected)`
          : "Passed";

      const setupRes = G.mirrorSetupTeam(MYTEAM);
      const totalSteps = EP.MirrorData.setupSteps.length;
      let setupSummary;
      if (setupRes) {
        const stepsDone = setupRes.completedSteps.length;
        const hiccups = countSetupHiccups(setupRes);
        setupSummary = `${stepsDone} of ${totalSteps} steps done${setupRes.wrappedUp ? " (wrapped up)" : ""} · ${hiccups} hiccup${hiccups === 1 ? "" : "s"}${setupRes.penalties > 0 ? ` (−${setupRes.penalties} attention)` : ""}${setupRes.qaRecovered > 0 ? ` · +${setupRes.qaRecovered} Q&A recovery` : ""}`;
      } else {
        setupSummary = `0 of ${totalSteps} steps done · 0 hiccups (lobby failed)`;
      }

      const danceRes = G.mirrorDanceTeam(MYTEAM);
      let danceSummary;
      if (danceRes && danceRes.dancers.length) {
        danceSummary = `${danceRes.dancers.length} dancer${danceRes.dancers.length === 1 ? "" : "s"} · +${formatBoost(danceRes.avgBoost)} / ${EP.MirrorData.dance.boostCap} boost avg · −${formatBoost(danceRes.avgPenalties)} penalty avg`;
      } else if (danceRes) {
        danceSummary = "0 dancers · +0 boost avg · −0 penalty avg";
      } else {
        danceSummary = "Not started (lobby failed)";
      }

      const summaryHTML = `<div class="panel mirror-summary" id="mirrorTeamSummary">
  <span class="label">Your team summary · ${esc(MYTEAM.name)}</span>
  <div class="mirror-summary-row" id="mirrorSumLobby"><span>Lobby</span><b>${esc(lobbySummary)}</b></div>
  <div class="mirror-summary-row" id="mirrorSumSetup"><span>Setup Crew</span><b>${esc(setupSummary)}</b></div>
  <div class="mirror-summary-row" id="mirrorSumDance"><span>Dance Crew</span><b>${esc(danceSummary)}</b></div>
</div>`;

      const hint = opts.costHint ? `<span class="hint">${opts.costHint()}</span>` : "";
      return `${attnBarHTML}${failBannerHTML}<div class="result" id="mirrorResult"><b style="color:${mineWon ? "var(--ok)" : "var(--bad)"}">Team ${mineWon ? "WIN" : "LOSS"}. Score ${mineScore} of ${maxScore}.</b><span class="hint">Final attention: ${formatAtt(mineAtt)}%. Top ${EP.Trial.winners(rank.length)} of ${rank.length} teams win. Your team's ${esc(opts.attrName || "Focus")} can move the score a little.</span><span class="hint" id="mirrorTieRule">Ties: higher exact attention wins, then random.</span><table class="levels" id="mirrorRankTable"><thead><tr><th>Place</th><th>Team</th><th>Attention</th><th>Score</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>${summaryHTML}${hint}</div>`;
    };

    let mountedRoot = null;

    if (done) {
      const html = renderHeader() + renderResultHTML();
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
    if (setup) {
      if (setup.currentStep !== "mic") ms.mic.flashKey = null;
      if (setup.currentStep !== "deck") ms.deck.active = false;
      if (setup.currentStep !== "qa") ms.qa.qKey = null;
    }

    const ensureMicFlash = st => {
      if (!st || st.currentStep !== "mic" || !st.mic.sequence) {
        ms.mic.flashKey = null;
        return;
      }
      const key = `${st.mic.round}:${st.mic.wrongs}:${st.mic.sequence.join(",")}`;
      if (ms.mic.flashKey !== key) {
        ms.mic.flashKey = key;
        if (st.mic.index === 0) {
          const M = EP.MirrorData.mic;
          const dur = (st.mic.round === 0 && st.mic.wrongs === 0)
            ? M.flashRound1Ticks
            : M.flashBaseTicks + st.mic.sequence.length;
          ms.mic.hideAt = ms.mic.tick + dur;
        } else {
          ms.mic.hideAt = ms.mic.tick;
        }
      }
    };

    const ensureDeckTimer = st => {
      if (!st || st.currentStep !== "deck") {
        ms.deck.active = false;
        return;
      }
      if (!ms.deck.active) {
        ms.deck.active = true;
        ms.deck.tick = 0;
        ms.deck.shuffleAt = EP.MirrorData.deck.reshuffleTicks;
      }
    };

    const ensureQaTimer = st => {
      if (!st || st.currentStep !== "qa" || !st.qa.order || st.qa.index >= st.qa.order.length) {
        ms.qa.qKey = null;
        return;
      }
      const itemIndex = st.qa.order[st.qa.index];
      const key = `${st.qa.index}:${itemIndex}`;
      if (ms.qa.qKey !== key) {
        ms.qa.qKey = key;
        ms.qa.deadline = ms.qa.tick + EP.MirrorData.qa.countdownTicks;
      }
    };

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

    const renderMicStepHTML = st => {
      ensureMicFlash(st);
      const M = EP.MirrorData.mic;
      const seq = st.mic.sequence || [];
      const flashing = ms.mic.tick < ms.mic.hideAt;
      const totalRounds = M.roundLengths.length;
      const seqText = flashing ? seq.join(" · ") : "? ".repeat(seq.length).trim() + " (from memory)";
      const btns = Array.from({ length: M.count }, (_, idx) => {
        const n = idx + 1;
        const doneHit = !flashing && seq.slice(0, st.mic.index).includes(n);
        return `<button type="button" class="cable mic ${doneHit ? "done" : ""}" data-mic="${n}" ${flashing ? "disabled" : ""}>MIC ${n}</button>`;
      }).join("");
      return `<div class="panel" id="mirrorMicStep" data-mic-round="${st.mic.round}" data-mic-len="${seq.length}">
  <span class="label">Step 3 · Mic check · three rounds from memory</span>
  <p class="hint">Round ${st.mic.round + 1} of ${totalRounds}. Watch the flash, then tap it back from memory: <b id="micSeqDisp" data-flashing="${flashing ? "1" : "0"}">${esc(seqText)}</b> Each round runs longer than the last. A wrong tap costs ${M.wrongPenalty} attention and flashes a new order.</p>
  <div class="mics">${btns}<span class="hint" id="micProgress">round ${st.mic.round + 1} of ${totalRounds} · ${st.mic.index} of ${seq.length}</span></div>
</div>`;
    };

    const renderDeckStepHTML = st => {
      ensureDeckTimer(st);
      const D = EP.MirrorData.deck;
      const files = EP.MirrorData.files;
      const signed = files.find(f => f.correct);
      const order = st.deck.fileOrder || files.map((_, i) => i);
      const buttons = order.map((fileIdx, pos) => {
        const f = files[fileIdx];
        const tried = st.deck.filesTried.includes(fileIdx);
        return `<button type="button" class="mfile ${tried ? "bad" : ""}" id="fileBtn${fileIdx}" data-file="${fileIdx}" data-file-order="${pos}" ${tried ? "disabled" : ""}>${esc(f.name)}</button>`;
      }).join("");
      return `<div class="panel" id="mirrorDeckStep">
  <span class="label">Step 4 · Grab the deck · the drive keeps shuffling</span>
  <p class="hint">The shared drive reshuffles every couple of seconds. Grab ${esc(signed ? signed.name : "the signed deck")} while you can find it. A wrong file costs ${D.wrongPenalty} attention and triggers an extra reshuffle.</p>
  <div class="mfiles" id="fileGrid">${buttons}</div>
</div>`;
    };

    const renderQaStepHTML = st => {
      ensureQaTimer(st);
      const Q = EP.MirrorData.qa;
      const order = st.qa.order || [];
      const itemIndex = order[st.qa.index];
      const item = EP.MirrorData.qaItems[itemIndex];
      const leftT = Math.max(0, ms.qa.deadline - ms.qa.tick);
      const pct = Math.round((leftT / Q.countdownTicks) * 100);
      const optionsHTML = item.options.map((opt, i) => `<button type="button" class="mopt" data-qa="${i}"><span class="num">${i + 1}.</span><span>${esc(opt)}</span></button>`).join("");
      return `<div class="panel" id="mirrorQaStep" data-qa-index="${st.qa.index}" data-qa-item="${itemIndex}">
  <div class="row" style="justify-content:space-between">
    <span class="label">Step 5 · The Q&amp;A gauntlet · rapid fire</span>
    <span class="counter" id="qaCount">Question ${st.qa.index + 1} of ${order.length}</span>
  </div>
  <div class="mq" id="qaQuestion">${esc(item.question)}</div>
  <span class="atrk qacd" id="qaCd" data-ticks-left="${leftT}"><i style="width:${pct}%" class="${leftT <= Q.lowWarningTicks ? "low" : ""}"></i></span>
  <div class="mqa">${optionsHTML}</div>
  <span class="hint">Answer before the bar empties. Hesitating costs ${Q.wrongPenalty} attention, a wrong answer costs ${Q.wrongPenalty}, landing it restores up to ${Q.rightRecover} lost attention.</span>
</div>`;
    };

    const renderWrapUpStepHTML = st => {
      const totalQa = st.qa.order ? st.qa.order.length : EP.MirrorData.qaItems.length;
      return `<div class="panel" id="mirrorWrapUpStep">
  <span class="label">Wrap up · Presentation ready</span>
  <p>The deck held. Medline is nodding. All ${EP.MirrorData.setupSteps.length} setup steps are done (${st.qa.right} of ${totalQa} Q&amp;A right).</p>
  <p class="hint">Press the button below to lock in your team's Audience Attention and end the presentation.</p>
  <div class="row"><button type="button" class="btn green" id="wrapUp">Wrap up the presentation</button></div>
</div>`;
    };

    const msgHTML = `<div class="mmsg" id="mirrorMsg" ${ms.msg ? "" : "hidden"}>${ms.msg ? "&gt; " + esc(ms.msg) : ""}</div>`;

    const syncSetupSnapshots = st => {
      if (!st) return;
      ms.lastStep = st.currentStep;
      ms.lastOwnerId = st.currentPlayerId;
      ms.lastCompletedCount = st.completedSteps.length;
      ms.lastBotHiccups = st.botHiccups;
      ms.lastWrappedUp = st.wrappedUp;
      ms.lastProgressSig = setupProgressSig(st);
    };

    const checkSetupChange = st => {
      if (!st) return false;
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
        return true;
      }
      return false;
    };

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
      if (root.MirrorDanceView) {
        return root.MirrorDanceView.screen({
          game: G,
          me: ME,
          team: MYTEAM,
          state: ms,
          headerHTML: renderHeader(),
          attentionBarHTML: renderAttentionBarHTML(),
          renderSetupFrame: renderSetupFrameHTML,
          checkSetupChange,
          avatarFor: opts.avatarFor,
          onRender: opts.onRender,
        });
      }
      bodyHTML = renderAttentionBarHTML() + renderSetupFrameHTML(setup) + msgHTML;
    } else if (myRole === "setup") {
      let stepPanelHTML;
      if (setup.currentPlayerId === ME.id) {
        if (setup.currentStep === "cables") stepPanelHTML = renderCablesStepHTML(setup);
        else if (setup.currentStep === "sound") stepPanelHTML = renderSoundStepHTML();
        else if (setup.currentStep === "mic") stepPanelHTML = renderMicStepHTML(setup);
        else if (setup.currentStep === "deck") stepPanelHTML = renderDeckStepHTML(setup);
        else if (setup.currentStep === "qa") stepPanelHTML = renderQaStepHTML(setup);
        else stepPanelHTML = renderWrapUpStepHTML(setup);
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

    const updateMicUI = st => {
      if (!mountedRoot || !st || !st.mic.sequence) return;
      const seq = st.mic.sequence;
      const flashing = ms.mic.tick < ms.mic.hideAt;
      const disp = mountedRoot.querySelector("#micSeqDisp");
      if (disp) {
        disp.dataset.flashing = flashing ? "1" : "0";
        disp.textContent = flashing ? seq.join(" · ") : "? ".repeat(seq.length).trim() + " (from memory)";
      }
      mountedRoot.querySelectorAll("[data-mic]").forEach(btn => {
        const n = Number(btn.dataset.mic);
        btn.disabled = flashing;
        btn.classList.toggle("done", !flashing && seq.slice(0, st.mic.index).includes(n));
      });
    };

    const updateDeckOrderUI = fileOrder => {
      if (!mountedRoot || !Array.isArray(fileOrder)) return;
      const grid = mountedRoot.querySelector("#fileGrid");
      if (!grid) return;
      fileOrder.forEach((fileIdx, pos) => {
        const btn = grid.querySelector(`[data-file="${fileIdx}"]`);
        if (btn) {
          btn.dataset.fileOrder = String(pos);
          grid.appendChild(btn);
        }
      });
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

      rootEl.querySelectorAll("[data-mic]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          if (!st || st.currentStep !== "mic" || st.currentPlayerId !== ME.id || !st.mic.sequence || ms.mic.tick < ms.mic.hideAt) {
            opts.onRender();
            return;
          }
          const micNum = Number(btn.dataset.mic);
          const r = G.mirrorMicTap(ME, micNum);
          if (r.ok) {
            const nextSt = G.mirrorSetupTeam(MYTEAM);
            syncSetupSnapshots(nextSt);
            if (r.stepDone) {
              ms.msg = EP.MirrorData.flavor.statusMessages.micDone;
              if (r.nextPlayerId && r.nextPlayerId !== ME.id && nextSt) {
                const nextSlot = ownerSlotFor(nextSt.slots, r.nextStep);
                if (nextSlot) ms.msg += ` Handing off to ${nextSlot.name}.`;
              }
            } else if (r.roundDone) {
              ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.micNextRound, { round: r.round + 1 });
            } else if (r.hit) {
              ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.micTapOk, { mic: micNum, left: r.remaining });
            } else {
              ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.micWrong, { round: r.round + 1 });
            }
          } else {
            ms.msg = r.reason || "";
          }
          opts.onRender();
        };
      });

      rootEl.querySelectorAll("[data-file]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          const fileIdx = Number(btn.dataset.file);
          if (!st || st.currentStep !== "deck" || st.currentPlayerId !== ME.id || st.deck.filesTried.includes(fileIdx)) {
            opts.onRender();
            return;
          }
          const r = G.mirrorPickFile(ME, fileIdx);
          if (r.ok) {
            const nextSt = G.mirrorSetupTeam(MYTEAM);
            syncSetupSnapshots(nextSt);
            if (r.hit) {
              ms.deck.active = false;
              ms.msg = EP.MirrorData.flavor.statusMessages.deckGrabbed;
              if (r.nextPlayerId && r.nextPlayerId !== ME.id && nextSt) {
                const nextSlot = ownerSlotFor(nextSt.slots, r.nextStep);
                if (nextSlot) ms.msg += ` Handing off to ${nextSlot.name}.`;
              }
            } else {
              ms.deck.shuffleAt = ms.deck.tick + EP.MirrorData.deck.wrongReshuffleTicks;
              ms.msg = formatMsg(EP.MirrorData.flavor.statusMessages.deckWrong, { file: r.fileName });
            }
          } else {
            ms.msg = r.reason || "";
          }
          opts.onRender();
        };
      });

      rootEl.querySelectorAll("[data-qa]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          if (!st || st.currentStep !== "qa" || st.currentPlayerId !== ME.id) {
            opts.onRender();
            return;
          }
          const r = G.mirrorAnswerQa(ME, Number(btn.dataset.qa));
          if (r.ok) {
            syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
            ms.msg = formatMsg(
              r.correct ? EP.MirrorData.flavor.statusMessages.qaRight : EP.MirrorData.flavor.statusMessages.qaWrong,
              { why: r.why }
            );
          } else {
            ms.msg = r.reason || "";
          }
          opts.onRender();
        };
      });

      const wrapBtn = rootEl.querySelector("#wrapUp");
      if (wrapBtn) {
        wrapBtn.onclick = () => {
          G.activity(ME);
          if (G.mirrorPhase() !== "showtime" || G.didRun("runTrial")) { opts.onRender(); return; }
          const st = G.mirrorSetupTeam(MYTEAM);
          if (!st || st.currentStep !== "wrapUp" || st.currentPlayerId !== ME.id) { opts.onRender(); return; }
          const r = G.mirrorWrapUp(ME);
          if (!r.ok) ms.msg = r.reason || "";
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

      if (checkSetupChange(st)) {
        opts.onRender();
        return;
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
              const next = G.mirrorNextCable(MYTEAM);
              const chosen = next && next.ok ? next.port : needed[0];
              c.belt.push({ id: c.nextId++, port: chosen, t0: c.tick, judged: null, judgedAt: 0 });
              c.nextSpawn = c.tick + gap;
            }
            for (const item of c.belt) {
              if (!item.judged && c.tick - (item.t0 + C.travelTicks) > C.hitWindowTicks) {
                item.judged = "past";
                item.judgedAt = c.tick;
                if (needed.includes(item.port)) {
                  G.mirrorReturnCable(MYTEAM, item.port);
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
            const sp = G.mirrorNextSoundSpike(MYTEAM);
            if (sp && sp.ok) {
              snd.spikeAt = snd.tick + sp.delayTicks;
              snd.spikeBoost = sp.boost;
            }
          }
          if (snd.spikeAt && snd.tick >= snd.spikeAt) {
            snd.level = Math.min(S.max, snd.level + snd.spikeBoost);
            const sp = G.mirrorNextSoundSpike(MYTEAM);
            if (sp && sp.ok) {
              snd.spikeAt = snd.tick + sp.delayTicks;
              snd.spikeBoost = sp.boost;
            } else {
              snd.spikeAt = 0;
              snd.spikeBoost = 0;
            }
            ms.msg = EP.MirrorData.flavor.statusMessages.soundSpike;
          }
          const drift = snd.level > S.start ? -S.driftStep : snd.level < S.start ? S.driftStep : 0;
          const jr = G.mirrorNextSoundJitter(MYTEAM);
          const jitter = jr && jr.ok ? jr.jitter : 0;
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
        } else if (st.currentStep === "mic") {
          ensureMicFlash(st);
          const wasFlashing = ms.mic.tick < ms.mic.hideAt;
          ms.mic.tick += 1;
          if (wasFlashing !== (ms.mic.tick < ms.mic.hideAt)) updateMicUI(st);
        } else if (st.currentStep === "deck") {
          ensureDeckTimer(st);
          ms.deck.tick += 1;
          if (ms.deck.tick >= ms.deck.shuffleAt) {
            const r = G.mirrorReshuffleDeck(MYTEAM);
            ms.deck.shuffleAt = ms.deck.tick + EP.MirrorData.deck.reshuffleTicks;
            if (r.ok) updateDeckOrderUI(r.fileOrder);
          }
        } else if (st.currentStep === "qa") {
          ensureQaTimer(st);
          ms.qa.tick += 1;
          const Q = EP.MirrorData.qa;
          const leftT = Math.max(0, ms.qa.deadline - ms.qa.tick);
          const bar = mountedRoot.querySelector("#qaCd");
          if (bar) {
            bar.dataset.ticksLeft = String(leftT);
            const fill = bar.querySelector("i");
            if (fill) {
              fill.style.width = Math.round((leftT / Q.countdownTicks) * 100) + "%";
              fill.classList.toggle("low", leftT <= Q.lowWarningTicks);
            }
          }
          if (leftT <= 0) {
            const r = G.mirrorTimeoutQa(ME);
            if (r.ok) {
              syncSetupSnapshots(G.mirrorSetupTeam(MYTEAM));
              ms.msg = EP.MirrorData.flavor.statusMessages.qaTimeout;
            } else {
              ms.msg = r.reason || "";
            }
            opts.onRender();
            return;
          }
        }
      }
    };

    return { html, bind, tick, waitHint: "Finish Presentation Day first" };
  }

  root.MirrorView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
