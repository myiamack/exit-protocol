/* Attendance popup: "Still there?" and the missed check-in message.
   Screen code only, shared by index.html and pages/vote-test.html. The rules live in rules/Attendance.js
   and rules/Game.js: this file only reports input to Game.activity() and draws what Game.pollAttendance() returns.
   Pausing and clock timing are owned by Game, never here. */
(function (root) {
  const MOVE_THROTTLE_MS = 1000;   // mouse movement counts as input at most once per second

  /* opts.game(): the Game, or null. opts.me(): your Player, or null. opts.onChange(): redraw after a miss. */
  function mount(opts) {
    const el = document.createElement("div");
    el.className = "board-ov";
    el.hidden = true;
    document.body.appendChild(el);
    const live = () => { const G = opts.game(), ME = opts.me(); return G && ME && G.round ? { G, ME } : null; };
    const input = () => { const l = live(); if (l) l.G.activity(l.ME); };

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
        el.querySelector("#attOk").onclick = () => { input(); api.close(); };
      },
      /* Show or hide the popup from the results returned by Game.pollAttendance(). */
      sync(events) {
        const l = live();
        if (!l || l.G.over) { if (api.kind() === "popup") api.close(); return; }
        const r = Array.isArray(events) ? events.find(x => x.player === l.ME) : null;
        if (!r) { if (api.kind() === "popup") api.close(); return; }
        if (r.state === "popup") {
          const secs = Math.ceil(r.msLeft / 1000);
          const secEl = api.kind() === "popup" ? el.querySelector("#attSec") : null;
          if (secEl) secEl.textContent = String(secs);
          else api.show("popup", `<h2 id="attT">Still there?</h2><p>Press any key, click or tap within <b id="attSec">${secs}</b> seconds, or you take a glitch.</p>`);
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

    /* Key press, click, touch, mouse movement and scrolling all count as input, and close the "Still there?" popup.
       Mouse movement fires many times a second, so it counts at most once per second. */
    const answer = () => { input(); if (api.kind() === "popup") api.close(); };
    ["keydown", "pointerdown", "touchstart", "wheel", "scroll"].forEach(ev => addEventListener(ev, answer, { capture: true, passive: true }));
    let lastMove = -Infinity;
    addEventListener("pointermove", () => {
      const now = performance.now();
      if (now - lastMove < MOVE_THROTTLE_MS) return;
      lastMove = now;
      answer();
    }, { capture: true, passive: true });

    return api;
  }

  /* r comes from Game.checkAttendance: { counted, pending, locked, stuck }. */
  function missedText(r, ME) {
    if (r.pending) return "You missed the check-in. You are Glitching. A teammate's gift can save you before the gift window closes.";
    if (r.locked) return `You missed the check-in. +1 glitch (${ME.glitches}/2).${r.stuck ? " You are Stuck: you watch the rest of the game." : ""}`;
    if (r.counted) return `You missed the check-in. You already have a glitch this round, so it counts as the same one (${ME.glitches}/2).`;
    return "You missed the check-in. You already missed one this round, so nothing more happens.";
  }

  root.AttendanceView = { mount };
})(typeof globalThis !== "undefined" ? globalThis : this);
