/* Progress board panel. Screen code only, shared by index.html and pages/vote-test.html.
   It draws only what Game.board() returns: player name, team, status; team trial wins;
   past Level 5-6 submissions. Read-only. Closes with the Close button or Esc. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FLAG = { "Active": "Active", "At risk": "risk", "Glitching": "Glitching", "Stuck": "Stuck", "Idle": "Idle" };

  function html(d) {
    const byLevel = [5, 6].map(n => ({ n, list: d.submissions.filter(s => s.level === n) })).filter(x => x.list.length);
    return `<div class="board-box" role="dialog" aria-modal="true" aria-labelledby="boardTitle">
      <div class="row" style="justify-content:space-between"><h2 id="boardTitle">Progress board</h2><button class="btn soft sm" id="boardClose">Close (Esc)</button></div>
      <div class="board-cols">
        <div class="panel"><span class="label">Teams · trial wins</span>
          <table class="board-t">${d.teams.map(t => `<tr><td>${esc(t.name)}</td><td>${t.wins}</td></tr>`).join("")}</table></div>
        <div class="panel"><span class="label">Players</span>
          <table class="board-t">${d.players.map(p => `<tr><td>${esc(p.name)}</td><td class="hint">${esc(p.team)}</td><td><span class="flag ${FLAG[p.status]}">${esc(p.status)}</span></td></tr>`).join("")}</table></div>
      </div>
      <div class="panel"><span class="label">Past submissions · Levels 5 and 6</span>
        ${byLevel.length ? byLevel.map(x => `<span class="label" style="color:var(--muted)">Level ${x.n}</span>${x.list.map(s => `<div class="board-sub"><b>${esc(s.name)}</b><span>${esc(s.text)}</span></div>`).join("")}`).join("")
          : `<span class="hint">None yet. Submissions appear here after Level 5 writing closes.</span>`}
      </div></div>`;
  }

  /* getBoard: a function that returns Game.board(), or null when there is no game yet. */
  function mount(getBoard) {
    const el = document.createElement("div");
    el.className = "board-ov";
    el.hidden = true;
    document.body.appendChild(el);
    let last = null;
    const api = {
      isOpen: () => !el.hidden,
      open() {
        const d = getBoard();
        if (!d) return;
        last = document.activeElement;
        el.innerHTML = html(d);
        el.hidden = false;
        el.querySelector("#boardClose").onclick = api.close;
        el.querySelector("#boardClose").focus();
      },
      close() { el.hidden = true; el.innerHTML = ""; if (last && last.focus) last.focus(); },
      /* Redraw with fresh data if open (call after the game changes). */
      refresh() { if (!el.hidden) { const d = getBoard(); if (d) { el.innerHTML = html(d); el.querySelector("#boardClose").onclick = api.close; } } },
    };
    el.addEventListener("click", e => { if (e.target === el) api.close(); });
    addEventListener("keydown", e => { if ((e.key === "Escape" || e.key === "Esc") && api.isOpen()) { e.stopImmediatePropagation(); api.close(); } }, true);
    return api;
  }

  root.BoardView = { mount, html };
})(typeof globalThis !== "undefined" ? globalThis : this);
