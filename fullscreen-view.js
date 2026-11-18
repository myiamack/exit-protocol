/* Full screen button in the top bar. Screen code only, shared by index.html and pages/vote-test.html.
   One click enters full screen, the next exits. The label always says what the next click will do.
   Esc (or any other way of leaving) fires "fullscreenchange", which updates the label.
   If the browser blocks full screen, nothing happens and no error shows. */
(function (root) {
  const doc = document;
  const current = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
  const LABEL = { enter: "⛶ Full screen", exit: "✕ Exit full screen" };

  function enter() {
    const el = doc.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) { /* blocked: do nothing */ }
  }
  function exit() {
    const fn = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (!fn) return;
    try { const p = fn.call(doc); if (p && p.catch) p.catch(() => {}); } catch (e) { /* do nothing */ }
  }

  /* btn: the button element. Returns { update } so the page can redraw the label if it wants. */
  function mount(btn) {
    if (!btn) return { update() {} };
    const update = () => {
      const on = !!current();
      btn.textContent = on ? LABEL.exit : LABEL.enter;
      btn.setAttribute("aria-pressed", String(on));
      btn.title = on ? "Exit full screen (Esc)" : "Full screen";
    };
    btn.onclick = () => { if (current()) exit(); else enter(); btn.blur(); };   // blur: Space or Enter never re-toggles
    doc.addEventListener("fullscreenchange", update);
    doc.addEventListener("webkitfullscreenchange", update);
    update();
    return { update };
  }

  root.FullscreenView = { mount, LABEL };
})(typeof window !== "undefined" ? window : globalThis);
