/* Attendance popup: "Still there?" and the missed check-in message.
   Screen code only, shared by index.html and pages/vote-test.html. The rules live in rules/Attendance.js
   and rules/Game.js: this file only reports input to Game.activity() and draws what Game.checkAttendance() returns.
   Pausing is decided in Game (briefings and intermissions), never here. */
(function (root) {
  /* opts.game(): the Game, or null. opts.me(): your Player, or null. opts.onChange(): redraw after a miss. */
  function mount(opts) {
    const el = document.createElement("div");
    el.className = "board-ov";
    el.hidden = true;
    document.body.appendChild(el);
    const live = () => { const G = opts.game(), ME = opts.me(); return G && ME && G.round ? { G, ME } : null; };
    const input = () => { const l = live(); if (l) l.G.activity(l.ME, Date.now()); };

    const api = {
      isOpen: () => !el.hidden,
      kind: () => el.dataset.kind || "",
      close() { el.hidden = true; el.innerHTML = ""; el.dataset.kind = ""; },
      /* Opening clears focus first (for example the footer button), so Space or Enter cannot press anything behind it. */
      show(kind, html) {
        const f = document.activeElement;
        if (f && f !== document.body && f.blur) f.blur();
        el.dataset.kind = kind;
        el.innerHTML = `<div class="board-box" role="alertdialog" aria-modal="true" aria-labelledby="attT" style="max-width:520px">${html}<button class="btn red" id="attOk" tabindex="-1">${kind === "popup" ? "I'm here" : "OK"}</button></div>`;
        el.hidden = false;
        el.querySelector("#attOk").onclick = api.close;
      },
      /* One check. The page runs it about once a second. */
      tick() {
        const l = live();
        if (!l || l.G.over) return;
        const r = l.G.checkAttendance(Date.now()).find(x => x.player === l.ME);
        if (!r) { if (api.kind() === "popup") api.close(); return; }
        if (r.state === "popup") {
          api.show("popup", `<h2 id="attT">Still there?</h2><p>Press any key, click or tap within <b>${Math.ceil(r.msLeft / 1000)}</b> seconds, or you take a glitch.</p>`);
          return;
        }
        api.show("missed", `<h2 id="attT">Check-in missed</h2><p>${missedText(r, l.ME)}</p>`);
        if (opts.onChange) opts.onChange();
      },
    };

    /* While the popup is open, a key press only closes it. The key never reaches any other element.
       Its keyup is swallowed too, because a button presses on Space keyup.
       Registered on window in the capture phase, so it runs before the page's own key listeners. */
    const swallowed = new Set();
    addEventListener("keydown", e => {
      if (el.hidden) return;
      e.preventDefault(); e.stopImmediatePropagation();
      swallowed.add(e.code);
      input();
      api.close();
    }, true);
    addEventListener("keyup", e => {
      if (!swallowed.delete(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);

    /* Any key, click or touch counts as input, and closes the "Still there?" popup. */
    ["keydown", "pointerdown", "touchstart"].forEach(ev => addEventListener(ev, () => {
      input();
      if (api.kind() === "popup") api.close();
    }, { capture: true, passive: true }));

    setInterval(api.tick, 1000);
    return api;
  }

  function missedText(r, ME) {
    if (!r.glitched) return "You missed the check-in. No extra glitch: you already took one for attendance this round.";
    return `You missed the check-in. +1 glitch (${ME.glitches}/2). Your attributes and hearts are unchanged.${r.stuck ? " You are Stuck: you watch the rest of the game." : ""}`;
  }

  root.AttendanceView = { mount };
})(typeof globalThis !== "undefined" ? globalThis : this);
