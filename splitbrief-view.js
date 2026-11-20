/* Level 2 Split Brief trial screen.
   Screen code only, loaded by index.html before game.js.
   Rules live in rules/Trial.js (SplitBriefTrial) and rules/Game.js. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = x => Math.floor(Math.max(0, x) / 60) + ":" + String(Math.max(0, x) % 60).padStart(2, "0");

  function renderCardsHTML(cards, twistCard) {
    const list = cards.map(c => `<div class="memo sb-card"><span class="label">${esc(c.title)}</span><p>${esc(c.text)}</p></div>`).join("") ||
      `<span class="hint">No brief cards dealt to you.</span>`;
    const twist = twistCard
      ? `<div class="sb-twist-card"><span class="chip p">Breaking news · Only you</span><p>${esc(twistCard.text)}</p></div>`
      : "";
    return list + twist;
  }

  function renderNotesHTML(notes) {
    if (!notes.length) return `<span class="hint">No team notes yet.</span>`;
    return notes.map(n => `<div class="sb-note"><b>${esc(n.posterName)}:</b> <span>${esc(n.text)}</span></div>`).join("");
  }

  function renderTwistPopupHTML(twistCard) {
    return `<div class="board-ov" id="splitTwistOv"><div class="board-box sb-twist-pop" role="alertdialog" aria-modal="true" aria-labelledby="splitTwistTitle"><span class="chip p">Urgent · Ghosted Teammate</span><h2 id="splitTwistTitle">Breaking news. Only you got this.</h2><p class="sb-twist-text">${esc(twistCard.text)}</p><div class="row"><button type="button" class="btn red" id="splitTwistOk">Got it</button></div></div></div>`;
  }

  /* opts:
     - game: Game instance
     - me: Player instance
     - team: Team instance (me's team)
     - state: mutable UI state object (noteDraft, msg, confirmLock, twistDismissed)
     - onRender: () => void
     - header: () => string
     - costHint: () => string */
  function screen(opts) {
    const G = opts.game, ME = opts.me, MYTEAM = opts.team, state = opts.state;
    if (state.noteDraft == null) state.noteDraft = "";
    if (state.msg == null) state.msg = "";
    if (state.confirmLock == null) state.confirmLock = false;
    if (state.twistDismissed == null) state.twistDismissed = false;

    const SBT = EP.Trial.SplitBriefTrial;
    const trial = G.round.trial;
    const done = G.didRun("runTrial");
    const hdr = opts.header ? opts.header() : `<div><span class="chip r">The Trial · Level ${G.level}</span><h2 style="margin-top:8px">Split Brief</h2></div>`;

    if (done) {
      const rank = trial.ranking || [];
      const mine = rank.find(x => x.team === MYTEAM);
      const maxScore = SBT.MAX_SCORE;
      const shown = x => Math.min(maxScore, Math.max(0, Math.round(x)));
      const board = trial.boardFor(MYTEAM);
      const rawScore = SBT.score(board, trial.postTwistAnswer);
      const keyStr = trial.postTwistAnswer.join(" then ");
      const hint = opts.costHint ? `<span class="hint">${opts.costHint()}</span>` : "";
      const html = `${hdr}<div class="result"><b style="color:${MYTEAM.won ? "var(--ok)" : "var(--bad)"}">Team ${MYTEAM.won ? "WIN" : "LOSS"}. Score ${shown(mine ? mine.score : 0)} of ${maxScore}.</b><span class="hint">Board score: ${rawScore} of ${maxScore} (post-twist key: ${esc(keyStr)}). Top ${EP.Trial.winners(rank.length)} of ${rank.length} teams win.</span><table class="levels"><thead><tr><th>Place</th><th>Team</th><th>Score</th><th>Result</th></tr></thead><tbody>${rank.map(r => `<tr><td class="n">${r.place}</td><td>${esc(r.team.name)}${r.team === MYTEAM ? " (you)" : ""}</td><td class="n">${shown(r.score)} / ${maxScore}</td><td>${r.won ? "Win" : "Loss"}</td></tr>`).join("")}</tbody></table>${hint}</div>`;
      return { html, bind: null, tick: null, waitHint: "Wait for the Split Brief trial to finish" };
    }

    const cards = trial.cardsFor(ME);
    const twistCard = trial.twistFired ? trial.twistFor(ME) : null;
    if (trial.twistFired && state.confirmLock) state.confirmLock = false;
    const notes = trial.notesFor(MYTEAM);
    const left = trial.notesLeft(ME);
    const board = trial.boardFor(MYTEAM);
    const locked = trial.isLocked(MYTEAM);
    const canAct = ME.isActive();
    const canPost = canAct && left > 0;
    const tasks = trial.tasks;
    const taskById = id => tasks.find(t => t.id === id);

    const tasksHTML = tasks.map(t => {
      const dis = locked || !canAct || board.includes(t.id) || board.length >= SBT.MAX_BOARD_TASKS;
      return `<div class="sb-task"><span><b>${esc(t.id)}.</b> ${esc(t.name)} <span class="hint">(${t.days}d)</span></span><button type="button" class="btn blue sm" data-sb-add="${esc(t.id)}" ${dis ? "disabled" : ""}>Add</button></div>`;
    }).join("");

    const slotsHTML = board.length
      ? board.map((id, i) => {
          const t = taskById(id) || { id, name: id, days: 0 };
          return `<div class="sb-slot"><span><b>${i + 1}. ${esc(t.id)} · ${esc(t.name)}</b> <span class="hint">(${t.days}d)</span></span><span class="row"><button type="button" class="btn soft sm" data-sb-up="${i}" aria-label="Move ${esc(t.id)} up" ${locked || !canAct || i === 0 ? "disabled" : ""}>Up</button><button type="button" class="btn soft sm" data-sb-down="${i}" aria-label="Move ${esc(t.id)} down" ${locked || !canAct || i === board.length - 1 ? "disabled" : ""}>Down</button><button type="button" class="btn soft sm" data-sb-rem="${i}" aria-label="Remove ${esc(t.id)}" ${locked || !canAct ? "disabled" : ""}>Remove</button></span></div>`;
        }).join("")
      : `<span class="hint">No tasks picked yet. Add up to ${SBT.MAX_BOARD_TASKS} tasks in order.</span>`;

    const lockHTML = locked
      ? `<div class="locked" id="splitLockedMsg"><span><b>Board locked in.</b> Final for the whole team. Waiting for the timer or other teams.</span></div>`
      : state.confirmLock && !trial.twistFired
        ? `<div class="panel sb-confirm" id="splitLockConfirm"><p><b>Wait:</b> "We locked our plan in early. Then the client changed everything." Once you Lock In, your board is final for the whole team even if new information arrives. Lock in anyway?</p><div class="row"><button type="button" class="btn red" id="splitLockYes">Confirm Lock In</button><button type="button" class="btn soft" id="splitLockNo">Cancel</button></div></div>`
        : `<div class="row"><button type="button" class="btn green" id="splitLockBtn" ${!canAct ? "disabled" : ""}>Lock In</button><span class="hint">${canAct ? "Any active teammate can edit until Lock In." : "Inactive players cannot edit or lock in."}</span></div>`;

    const html = `${hdr}
<div class="panel"><div class="row" style="justify-content:space-between"><span><b>${esc(trial.scenario.title)}</b> · Time remaining</span><span class="counter" id="splitTmr">${fmt(G.secondsLeft() || 0)}</span></div></div>
<div class="cols">
  <div class="panel"><span class="label">My private brief cards (only you)</span><div class="sb-cards" id="splitCards">${renderCardsHTML(cards, twistCard)}</div></div>
  <div class="panel"><div class="row" style="justify-content:space-between"><span class="label">Team notes (${esc(MYTEAM.name)})</span><span class="counter" id="splitNotesLeft">notes left: ${left}/${SBT.MAX_NOTES}</span></div><div class="sb-feed" id="splitNotesFeed">${renderNotesHTML(notes)}</div><div class="sb-noteform"><label class="label" for="splitNoteIn">Post a note (max ${SBT.MAX_NOTE_CHARS} chars)</label><div class="row"><input type="text" id="splitNoteIn" maxlength="${SBT.MAX_NOTE_CHARS}" placeholder="Share what your cards say..." value="${esc(state.noteDraft)}" ${!canPost ? "disabled" : ""} style="flex:1;min-width:160px"><button type="button" class="btn blue sm" id="splitPostNote" ${!canPost || !state.noteDraft.trim() ? "disabled" : ""}>Post</button></div></div></div>
</div>
<div class="panel" id="splitBoard"><span class="label">Shared team board · Pick ${SBT.MAX_BOARD_TASKS} tasks in order</span>
  <div class="cols">
    <div><span class="label">Available tasks</span><div class="sb-tasks">${tasksHTML}</div></div>
    <div><span class="label">Team plan (1st, 2nd)</span><div class="sb-slots">${slotsHTML}</div></div>
  </div>
  ${state.msg ? `<div class="err" id="splitErr">${esc(state.msg)}</div>` : ""}
  ${lockHTML}
</div>
<div id="splitTwistHost">${twistCard && !state.twistDismissed ? renderTwistPopupHTML(twistCard) : ""}</div>`;

    let lastNoteCount = notes.length;
    let lastTwistShown = !!(twistCard && !state.twistDismissed);
    let mountedRoot = null;

    const bindTwistOk = rootEl => {
      const okBtn = rootEl.querySelector("#splitTwistOk");
      if (okBtn) okBtn.onclick = () => {
        state.twistDismissed = true;
        const host = rootEl.querySelector("#splitTwistHost");
        if (host) host.innerHTML = "";
      };
    };

    const bind = rootEl => {
      mountedRoot = rootEl;
      const feed = rootEl.querySelector("#splitNotesFeed");
      if (feed) feed.scrollTop = feed.scrollHeight;

      const noteIn = rootEl.querySelector("#splitNoteIn");
      const postBtn = rootEl.querySelector("#splitPostNote");
      const submitNote = () => {
        if (!noteIn || noteIn.disabled) return;
        G.activity(ME);
        const r = trial.postNote(ME, noteIn.value);
        if (!r.ok) { state.msg = r.reason; opts.onRender(); return; }
        state.noteDraft = "";
        state.msg = "";
        opts.onRender();
      };
      if (noteIn) {
        noteIn.addEventListener("input", () => {
          G.activity(ME);
          state.noteDraft = noteIn.value;
          if (postBtn) postBtn.disabled = !canPost || !noteIn.value.trim();
        });
        noteIn.addEventListener("keydown", e => {
          if (e.key === "Enter") { e.preventDefault(); submitNote(); }
        });
      }
      if (postBtn) postBtn.onclick = submitNote;

      rootEl.querySelectorAll("[data-sb-add]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          const id = btn.dataset.sbAdd;
          const r = trial.setBoard(ME, [...trial.boardFor(MYTEAM), id]);
          state.msg = r.ok ? "" : r.reason;
          opts.onRender();
        };
      });
      rootEl.querySelectorAll("[data-sb-up]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          const i = +btn.dataset.sbUp, b = trial.boardFor(MYTEAM);
          if (i > 0 && i < b.length) [b[i - 1], b[i]] = [b[i], b[i - 1]];
          const r = trial.setBoard(ME, b);
          state.msg = r.ok ? "" : r.reason;
          opts.onRender();
        };
      });
      rootEl.querySelectorAll("[data-sb-down]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          const i = +btn.dataset.sbDown, b = trial.boardFor(MYTEAM);
          if (i >= 0 && i < b.length - 1) [b[i], b[i + 1]] = [b[i + 1], b[i]];
          const r = trial.setBoard(ME, b);
          state.msg = r.ok ? "" : r.reason;
          opts.onRender();
        };
      });
      rootEl.querySelectorAll("[data-sb-rem]").forEach(btn => {
        btn.onclick = () => {
          G.activity(ME);
          const i = +btn.dataset.sbRem, b = trial.boardFor(MYTEAM);
          b.splice(i, 1);
          const r = trial.setBoard(ME, b);
          state.msg = r.ok ? "" : r.reason;
          opts.onRender();
        };
      });

      const doLockIn = () => {
        G.activity(ME);
        const r = trial.lockIn(ME);
        state.confirmLock = false;
        state.msg = r.ok ? "" : r.reason;
        opts.onRender();
      };
      const lockBtn = rootEl.querySelector("#splitLockBtn");
      if (lockBtn) lockBtn.onclick = () => {
        G.activity(ME);
        if (!trial.twistFired) { state.confirmLock = true; opts.onRender(); return; }
        doLockIn();
      };
      const lockYes = rootEl.querySelector("#splitLockYes");
      if (lockYes) lockYes.onclick = doLockIn;
      const lockNo = rootEl.querySelector("#splitLockNo");
      if (lockNo) lockNo.onclick = () => { state.confirmLock = false; opts.onRender(); };

      bindTwistOk(rootEl);
    };

    const tick = (txt, low) => {
      if (!mountedRoot) return;
      const st = mountedRoot.querySelector("#splitTmr");
      if (st) { st.textContent = txt; st.classList.toggle("low", !!low); }

      const curNotes = trial.notesFor(MYTEAM);
      if (curNotes.length !== lastNoteCount) {
        lastNoteCount = curNotes.length;
        const feed = mountedRoot.querySelector("#splitNotesFeed");
        if (feed) {
          feed.innerHTML = renderNotesHTML(curNotes);
          feed.scrollTop = feed.scrollHeight;
        }
      }

      if (trial.twistFired) {
        if (state.confirmLock) {
          state.confirmLock = false;
          opts.onRender();
          return;
        }
        const tc = trial.twistFor(ME);
        if (tc && !lastTwistShown && !state.twistDismissed) {
          lastTwistShown = true;
          const cardsEl = mountedRoot.querySelector("#splitCards");
          if (cardsEl) cardsEl.innerHTML = renderCardsHTML(trial.cardsFor(ME), tc);
          const host = mountedRoot.querySelector("#splitTwistHost");
          if (host) {
            host.innerHTML = renderTwistPopupHTML(tc);
            bindTwistOk(mountedRoot);
          }
        }
      }
    };

    return { html, bind, tick, waitHint: "Wait for the Split Brief timer to finish" };
  }

  root.SplitBriefView = { screen, fmt };
})(typeof globalThis !== "undefined" ? globalThis : this);
