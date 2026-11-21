/* Level 3 Mirror (Presentation Day) trial screens: Lobby and Crew Reveal.
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
    }
    const ms = state.mirror;

    const lobbySecs = () => {
      const s = G.secondsLeft();
      return s == null ? EP.MirrorData.timers.lobbySeconds : s;
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

    const html = renderHeader() +
      (failReason === "lobby" ? renderLobbyFailedHTML() : "") +
      `<div class="panel" id="mirrorShowtimePlaceholder">
  <span class="label">Showtime · Placeholder</span>
  <p>Setup and Dance: coming in Steps 6c and 6d.</p>
  <div class="row"><button type="button" class="btn green" id="finishMirrorPlaceholder">Finish trial</button></div>
</div>`;

    const bind = rootEl => {
      mountedRoot = rootEl;
      const fin = rootEl.querySelector("#finishMirrorPlaceholder");
      if (fin) {
        fin.onclick = () => {
          G.activity(ME);
          if (!G.didRun("runTrial")) {
            G.closeMirror();
            opts.onRender();
          }
        };
      }
    };

    const tick = () => {
      if (!mountedRoot) return;
      if (G.didRun("runTrial") !== done || G.mirrorPhase() !== phase) {
        opts.onRender();
      }
    };

    return { html, bind, tick, waitHint: "Finish Presentation Day first" };
  }

  root.MirrorView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
