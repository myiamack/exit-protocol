/* Level 3 Mirror (Presentation Day) Dance Crew rhythm lane screen.
   Screen code only, loaded by index.html right after mirror-view.js.
   Note chart, judging, miss deadlines, boosts, penalties, and timers live in rules. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");
  const formatMsg = (tpl, vars = {}) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
  const formatBoost = val => (Number.isInteger(val) ? String(val) : val.toFixed(1));
  const playerById = (team, id) => (team && team.members ? team.members.find(p => p.id === id) || null : null);

  function statusBadge(player) {
    if (!player) return "";
    const s = player.boardStatus();
    return `<span class="flag ${s === "At risk" ? "risk" : esc(s)}">${esc(s)}</span>`;
  }

  /* Deterministic fallback look when a player has no custom sprite (e.g., bots or test players). */
  function fallbackAvatar(seedKey) {
    let h = 2166136261;
    const str = String(seedKey || "intern");
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    const pick = n => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return h % n;
    };
    return {
      body: pick(2),
      skin: pick(10),
      hair: pick(12),
      hairC: pick(10),
      top: pick(10),
      topS: pick(5),
      bot: pick(6),
      botS: pick(3),
      hat: pick(7),
      extra: pick(6),
      acc: pick(10),
      tool: pick(6),
    };
  }

  function dancerAvatarHTML(dancer, team, avatarFor) {
    if (typeof root.avatarSVG !== "function") return "";
    const pl = playerById(team, dancer.playerId);
    const av = (avatarFor && pl ? avatarFor(pl) : null) || fallbackAvatar(`${dancer.playerId}:${dancer.name}`);
    return root.avatarSVG(av, { label: dancer.name });
  }

  function initDanceUI(state, view, dancers) {
    const lastMateBoosts = {};
    for (const d of dancers) lastMateBoosts[d.playerId] = d.boost;
    const ui = {
      camMsg: "",
      camCount: 0,
      mateMoves: {},
      lastMateBoosts,
      lastMisses: view ? view.misses : 0,
    };
    state.danceUI = ui;
    return ui;
  }

  function laneHTML(view, D) {
    const notes = view && Array.isArray(view.notes) ? view.notes : [];
    const bits = notes.map(n => {
      return `<span class="note ${n.judged ? "j" + n.judged : ""}" data-note-id="${n.id}" data-note-dir="${n.dir}" data-note-zone="${n.zone}" style="left:${n.leftPct}%">${D.arrowGlyphs[n.dir]}</span>`;
    }).join("");
    return `<span class="hitframe"><b class="perfect"></b></span>${bits}`;
  }

  /* opts:
     - game, me, team, state
     - headerHTML, attentionBarHTML
     - renderSetupFrame(setup), checkSetupChange(setup)
     - avatarFor(player), onRender() */
  function screen(opts) {
    const G = opts.game, ME = opts.me, MYTEAM = opts.team, state = opts.state;
    const D = EP.MirrorData.dance;
    const setup = G.mirrorSetupTeam(MYTEAM);
    const dance = G.mirrorDanceTeam(MYTEAM);
    const myView = G.mirrorDanceView(ME);
    const myRec = dance ? dance.dancers.find(d => d.playerId === ME.id) || null : null;

    const isShowtimeEnded = () => {
      if (G.didRun("runTrial")) return true;
      if (G.mirrorPhase() !== "showtime") return true;
      if (G.mirrorFailReason(MYTEAM)) return true;
      const st = G.mirrorSetupTeam(MYTEAM);
      return !st || !!st.wrappedUp;
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

    // 0-dancer or unrostered fallback: never renders a rhythm lane or starts an animation loop.
    if (!dance || !dance.dancers.length || !myRec || !myView) {
      const count = dance ? dance.dancers.length : 0;
      const setupWrap = setup && opts.renderSetupFrame ? `<div id="mirrorSetupWrap">${opts.renderSetupFrame(setup)}</div>` : "";
      const html = `${opts.headerHTML || ""}${opts.attentionBarHTML || ""}
<div class="panel dpanel" id="mirrorNoDancers">
  <span class="label">Dance Crew (${count})</span>
  <p class="hint">No active dancers on this team. Attention runs on Setup Crew alone.</p>
</div>
${setupWrap}`;
      return {
        html,
        bind: null,
        tick: () => { if (isShowtimeEnded() && opts.onRender) opts.onRender(); },
        cleanup: () => {},
        isLoopRunning: () => false,
        waitHint: "Finish Presentation Day first",
      };
    }

    const ui = state.danceUI || initDanceUI(state, myView, dance.dancers);

    const renderDancerCardsHTML = (dc, view) => dc.dancers.map(d => {
      const isMe = d.playerId === ME.id;
      const move = isMe
        ? (view && view.stumbling ? "stumble" : (view && view.lastMove ? "mv-" + view.lastMove : ""))
        : (ui.mateMoves[d.playerId] ? "mv-" + ui.mateMoves[d.playerId] : "");
      return `<div class="dancer ${move}" data-dancer="${d.playerId}">
  ${dancerAvatarHTML(d, MYTEAM, opts.avatarFor)}
  <span class="dancer-name">${esc(d.name)}</span>
</div>`;
    }).join("");

    const renderRosterHTML = dc => dc.dancers.map(d => {
      const pl = playerById(MYTEAM, d.playerId);
      const pct = Math.max(0, Math.min(100, Math.round((d.boost / D.boostCap) * 100)));
      const meta = d.penalties > 0 ? `−${d.penalties} attn` : (d.combo > 0 ? `combo ×${d.combo}` : "ready");
      return `<div class="mirror-dancer-row" data-dance-readout="${d.playerId}">
  <span><b>${esc(d.name)}</b>${d.playerId === ME.id ? ' <span class="tag m">you</span>' : ""} ${statusBadge(pl)}</span>
  <span class="dance-row-meta">
    <span class="dance-prog" aria-hidden="true"><i style="width:${pct}%"></i></span>
    <span class="mirror-slot-steps" data-dance-boost="${d.playerId}">+${formatBoost(d.boost)} / ${D.boostCap}</span>
    <span class="hint" data-dance-meta="${d.playerId}">${esc(meta)}</span>
  </span>
</div>`;
    }).join("");

    const myHits = myRec.perfects + myRec.goods;
    const padHTML = D.arrows.map(d => `<button type="button" class="dkey" data-dance="${d}" aria-label="${d} arrow">${D.arrowGlyphs[d]}</button>`).join("");
    const setupHTML = setup && opts.renderSetupFrame ? `<div id="mirrorSetupWrap">${opts.renderSetupFrame(setup)}</div>` : "";
    const msgHTML = `<div class="mmsg" id="mirrorMsg" ${state.msg ? "" : "hidden"}>${state.msg ? "&gt; " + esc(state.msg) : ""}</div>`;

    const html = `${opts.headerHTML || ""}${opts.attentionBarHTML || ""}
<div class="panel dpanel" id="mirrorDancePanel">
  <div class="row" style="justify-content:space-between">
    <span class="label">Dance Crew · keep the room alive</span>
    <span class="counter" id="myDanceBoost">+${formatBoost(myRec.boost)} / ${D.boostCap} boost</span>
  </div>
  <div class="lane" id="lane">${laneHTML(myView, D)}</div>
  <div class="dpad" id="dancePad">
    ${padHTML}
    <span class="combo" id="comboN">combo ×${myRec.combo}</span>
    <span class="dance-stats" id="danceMyStats">
      <span class="dance-stat">Hits <b id="danceHits">${myHits}</b></span>
      <span class="dance-stat">Misses <b id="danceMisses">${myRec.misses}</b></span>
      <span class="dance-stat">Off-beat <b id="danceStrays">${myRec.strays}</b></span>
    </span>
  </div>
  <div class="dancers" id="danceAvatars">${renderDancerCardsHTML(dance, myView)}</div>
  <div class="dcam" id="danceCam">&gt; ${esc(ui.camMsg || "notes incoming. watch the frame.")}</div>
  <span class="hint">Notes slide left. Press an arrow key (or tap a pad arrow) as a note crosses the frame: inner band is PERFECT (+${D.perfectBoost}), outer band is good (+${D.goodBoost}). Missed note −${D.missPenalty} attention, off-beat −${D.strayPenalty}. Boost caps at +${D.boostCap} per dancer.</span>
</div>
<div class="panel" id="mirrorDanceRoster">
  <div class="row" style="justify-content:space-between">
    <span class="label">Dancers (${dance.dancers.length})</span>
    <span class="counter" id="danceRosterAvg">Team avg: +<span id="teamDanceBoost">${formatBoost(dance.avgBoost)}</span> boost · −<span id="teamDancePen">${formatBoost(dance.avgPenalties)}</span> penalty</span>
  </div>
  <div class="mirror-crew-list" id="danceRosterList">${renderRosterHTML(dance)}</div>
</div>
${setupHTML}
${msgHTML}`;

    let mountedRoot = null;
    let laneEl = null;
    let wasConnected = false;
    let rafId = null;
    let bound = false;
    let stopped = false;
    let keyAttached = false;
    let hitTimer = null;

    const isMounted = () => !!mountedRoot && !!laneEl && mountedRoot.contains(laneEl) && (!wasConnected || mountedRoot.isConnected);

    const updateAttentionAndTimerDOM = () => {
      if (!mountedRoot) return;
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
    };

    const syncAvatarsDOM = (dc, view) => {
      if (!mountedRoot || !dc) return;
      for (const d of dc.dancers) {
        const el = mountedRoot.querySelector(`[data-dancer="${d.playerId}"]`);
        if (!el) continue;
        let cls = "dancer";
        if (d.playerId === ME.id) {
          if (view && view.stumbling) cls += " stumble";
          else if (view && view.lastMove) cls += " mv-" + view.lastMove;
        } else if (ui.mateMoves[d.playerId]) {
          cls += " mv-" + ui.mateMoves[d.playerId];
        }
        if (el.className !== cls) el.className = cls;
      }
    };

    const syncDanceDOM = () => {
      if (!mountedRoot) return;
      updateAttentionAndTimerDOM();
      const dc = G.mirrorDanceTeam(MYTEAM);
      const view = G.mirrorDanceView(ME);
      if (!dc) return;
      const meRec = dc.dancers.find(d => d.playerId === ME.id);
      if (meRec) {
        if (meRec.misses > ui.lastMisses) {
          ui.lastMisses = meRec.misses;
          ui.camMsg = EP.MirrorData.flavor.statusMessages.danceMiss;
        }
        const setTxt = (sel, txt) => {
          const el = mountedRoot.querySelector(sel);
          if (el) el.textContent = txt;
        };
        setTxt("#myDanceBoost", `+${formatBoost(meRec.boost)} / ${D.boostCap} boost`);
        setTxt("#comboN", `combo ×${meRec.combo}`);
        setTxt("#danceHits", String(meRec.perfects + meRec.goods));
        setTxt("#danceMisses", String(meRec.misses));
        setTxt("#danceStrays", String(meRec.strays));
      }
      const avgBoostEl = mountedRoot.querySelector("#teamDanceBoost");
      if (avgBoostEl) avgBoostEl.textContent = formatBoost(dc.avgBoost);
      const avgPenEl = mountedRoot.querySelector("#teamDancePen");
      if (avgPenEl) avgPenEl.textContent = formatBoost(dc.avgPenalties);

      // Track teammate (including bot) boost gains from the rules to animate avatars and status line.
      for (const d of dc.dancers) {
        const prev = ui.lastMateBoosts[d.playerId];
        if (d.playerId !== ME.id && prev !== undefined && d.boost > prev) {
          const moves = EP.MirrorData.flavor.danceMoves;
          ui.mateMoves[d.playerId] = D.arrows[ui.camCount % D.arrows.length];
          ui.camMsg = formatMsg(EP.MirrorData.flavor.statusMessages.danceBotMove, {
            name: d.name,
            move: moves[ui.camCount % moves.length],
          });
          ui.camCount += 1;
        }
        ui.lastMateBoosts[d.playerId] = d.boost;
      }

      const listEl = mountedRoot.querySelector("#danceRosterList");
      if (listEl) listEl.innerHTML = renderRosterHTML(dc);
      const camEl = mountedRoot.querySelector("#danceCam");
      if (camEl) camEl.textContent = "> " + (ui.camMsg || "notes incoming. watch the frame.");
      if (laneEl) laneEl.innerHTML = laneHTML(view, D);
      syncAvatarsDOM(dc, view);
    };

    const flashKey = dir => {
      if (!mountedRoot) return;
      mountedRoot.querySelectorAll("[data-dance]").forEach(btn => {
        btn.classList.toggle("hit", btn.dataset.dance === dir);
      });
      if (hitTimer) clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitTimer = null;
        if (mountedRoot) mountedRoot.querySelectorAll("[data-dance].hit").forEach(b => b.classList.remove("hit"));
      }, 150);
    };

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      if (rafId !== null && typeof root.cancelAnimationFrame === "function") {
        root.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (hitTimer) {
        clearTimeout(hitTimer);
        hitTimer = null;
      }
      if (keyAttached) {
        root.removeEventListener("keydown", onKey, false);
        keyAttached = false;
      }
      if (state._danceCleanup === cleanup) state._danceCleanup = null;
    };

    const handleInput = dir => {
      if (stopped || !isMounted() || isShowtimeEnded()) {
        cleanup();
        return { ok: false, reason: "Showtime ended." };
      }
      if (!D.arrows.includes(dir)) return { ok: false, reason: "Invalid arrow." };
      G.activity(ME);
      if (isShowtimeEnded()) {
        cleanup();
        if (opts.onRender) opts.onRender();
        return { ok: false, reason: "Showtime ended." };
      }

      const res = G.mirrorDancePress(ME, dir);
      if (res.ok && res.hit) {
        const moves = EP.MirrorData.flavor.danceMoves;
        ui.camMsg = res.quality === "perfect"
          ? EP.MirrorData.flavor.statusMessages.dancePerfect
          : formatMsg(EP.MirrorData.flavor.statusMessages.danceGood, { move: moves[ui.camCount++ % moves.length] });
        flashKey(dir);
      } else if (res.ok && res.stray) {
        ui.camMsg = EP.MirrorData.flavor.statusMessages.danceStray;
      }

      if (isShowtimeEnded() || (res && (res.failed || res.closed))) {
        cleanup();
        if (opts.onRender) opts.onRender();
        return res;
      }
      syncDanceDOM();
      return res;
    };

    const KEY_TO_DIR = {
      ArrowLeft: "left",
      ArrowUp: "up",
      ArrowRight: "right",
      ArrowDown: "down",
    };

    function onKey(e) {
      if (stopped || !isMounted() || isShowtimeEnded()) {
        cleanup();
        return;
      }
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      const doc = mountedRoot.ownerDocument || document;
      if (doc.querySelector(".board-ov:not([hidden])")) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      handleInput(dir);
    }

    const frame = () => {
      rafId = null;
      if (stopped || !isMounted() || isShowtimeEnded()) {
        const shouldRender = isShowtimeEnded() && isMounted();
        cleanup();
        if (shouldRender && opts.onRender) opts.onRender();
        return;
      }
      syncDanceDOM();
      if (!stopped && isMounted() && !isShowtimeEnded() && typeof root.requestAnimationFrame === "function") {
        rafId = root.requestAnimationFrame(frame);
      }
    };

    const bind = rootEl => {
      bound = true;
      stopped = false;
      mountedRoot = rootEl;
      laneEl = rootEl ? rootEl.querySelector("#lane") : null;
      wasConnected = !!(rootEl && rootEl.isConnected);
      if (!laneEl || isShowtimeEnded()) {
        cleanup();
        return;
      }

      rootEl.querySelectorAll("[data-dance]").forEach(btn => {
        btn.onclick = () => handleInput(btn.dataset.dance);
      });

      // Bubble phase so AttendanceView's capture-phase keydown handler swallows keys first while its popup is open.
      root.addEventListener("keydown", onKey, false);
      keyAttached = true;
      state._danceCleanup = cleanup;

      if (typeof root.requestAnimationFrame === "function") {
        rafId = root.requestAnimationFrame(frame);
      }
    };

    const tick = () => {
      if (!bound) return;
      if (stopped || !isMounted()) {
        cleanup();
        return;
      }
      if (isShowtimeEnded()) {
        cleanup();
        if (opts.onRender) opts.onRender();
        return;
      }
      const st = G.mirrorSetupTeam(MYTEAM);
      if (opts.checkSetupChange && opts.checkSetupChange(st)) {
        if (!st || st.wrappedUp || isShowtimeEnded()) {
          cleanup();
          if (opts.onRender) opts.onRender();
          return;
        }
        const wrapEl = mountedRoot.querySelector("#mirrorSetupWrap");
        if (wrapEl && opts.renderSetupFrame) wrapEl.innerHTML = opts.renderSetupFrame(st);
        const msgEl = mountedRoot.querySelector("#mirrorMsg");
        if (msgEl) {
          msgEl.hidden = !state.msg;
          msgEl.textContent = state.msg ? "> " + state.msg : "";
        }
      }
      syncDanceDOM();
    };

    return {
      html,
      bind,
      tick,
      cleanup,
      handleInput,
      isLoopRunning: () => !stopped && rafId !== null,
      waitHint: "Finish Presentation Day first",
    };
  }

  root.MirrorDanceView = { screen };
})(typeof globalThis !== "undefined" ? globalThis : this);
