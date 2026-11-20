/* Screen check: plays Level 1 in a fake browser (jsdom), presses Replay Level 1, plays again,
   and confirms the gift window still closes on time with no console errors.
   The second run waits in the trial so the gift window overlaps the moment the
   first run's Stats Update timer (30 s) would have fired. Takes about 75 seconds.
   Needs "npm install" once first (installs jsdom).
   Run from the repo folder:  node Tests/check_screens.js */
const path = require("path");
const fs = require("fs");
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e) { console.log('jsdom is missing. Run "npm install" once in the repo folder, then try again.'); process.exit(1); }

const repo = path.join(__dirname, "..");
const errors = [];
const FS = { el: null, block: false };   // fake full screen state
const isFontError = msg => /fonts\.(googleapis|gstatic)\.com/.test(msg);
const vc = new VirtualConsole();
vc.on("jsdomError", e => { const msg = String(e.message || e).split("\n")[0]; if (!isFontError(msg)) errors.push(msg); });
vc.on("error", e => errors.push("console.error " + e));

const dom = new JSDOM(fs.readFileSync(path.join(repo, "index.html"), "utf8"), {
  url: "file:///" + repo.replace(/\\/g, "/") + "/index.html",
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    // jsdom has no canvas, matchMedia or scrollTo. Stub them so the screens load.
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({}) });
    w.confirm = () => true;
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.HTMLElement.prototype.scrollTo = () => {};
    // jsdom has no Fullscreen API. Fake it: FS.block makes the browser refuse (promise rejects).
    Object.defineProperty(w.Document.prototype, "fullscreenElement", { configurable: true, get: () => FS.el });
    const fsChange = () => w.document.dispatchEvent(new w.Event("fullscreenchange"));
    w.Element.prototype.requestFullscreen = function () { if (FS.block) return Promise.reject(new w.TypeError("Permissions check failed")); FS.el = this; fsChange(); return Promise.resolve(); };
    w.Document.prototype.exitFullscreen = function () { FS.el = null; fsChange(); return Promise.resolve(); };
    if (!w.HTMLFormElement.prototype.requestSubmit) w.HTMLFormElement.prototype.requestSubmit = function () { this.dispatchEvent(new w.Event("submit", { cancelable: true })); };
  },
});
const w = dom.window, d = w.document;
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const next = () => $("#navNext").click();
const t0 = Date.now(), at = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
const log = (...a) => console.log(at(), ...a);
let passed = 0;
const check = (name, ok, got) => {
  log((ok ? "PASS " : "FAIL ") + name + (got !== undefined ? "  -> " + got : ""));
  if (ok) passed += 1; else errors.push("check failed: " + name);
};

/* Full screen button (Part 10): label shows the next action, clicks toggle, Esc updates it, a block shows no error. */
async function fullscreen() {
  const b = $("#fsBtn"), isEnter = () => /^⛶ Full screen$/.test(b.textContent), isExit = () => /Exit full screen/.test(b.textContent);
  check("full screen button shows on the game screen, label says Full screen", !b.hidden && isEnter(), b.textContent);
  b.click(); await sleep(20);
  check("click enters full screen, label says Exit", !!FS.el && isExit(), b.textContent);
  FS.el = null; d.dispatchEvent(new w.Event("fullscreenchange")); await sleep(20);   // what the browser does on Esc
  check("Esc exits, label goes back to Full screen", isEnter(), b.textContent);
  b.click(); await sleep(20); b.click(); await sleep(20);
  check("second click exits full screen", !FS.el && isEnter(), b.textContent);
  FS.block = true; const before = errors.length; b.click(); await sleep(50); FS.block = false;
  check("blocked by the browser: nothing happens, no error", !FS.el && isEnter() && errors.length === before, b.textContent);
}

async function creation(type = "coop") {
  $('[data-type="' + type + '"]').click(); await sleep(30);
  while (true) { const b = $$("[data-inc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
  next(); await sleep(50);
  for (let i = 0; i < 40 && !/Start Level 1/.test($("#navNext").textContent); i++) { next(); await sleep(200); }
}
async function level1(trialWait) {
  next(); await sleep(50);   // > briefing
  next(); await sleep(50);   // > open floor
  next(); await sleep(50);   // > trial
  if (trialWait) { log("waiting " + trialWait / 1000 + " s in the trial"); await sleep(trialWait); }
  for (let i = 0; i < 6; i++) { const c = $("[data-pile]"); if (c) { c.click(); await sleep(5); } }
  $("#check").click(); await sleep(50);
  next(); await sleep(50);   // > glitch report
  $("#skipAcc").click(); await sleep(50);
  log("gift window open, timer " + ($("#tmr") ? $("#tmr").textContent : "?"));
  const start = Date.now();
  for (let i = 0; i < 40 && $("#navNext").disabled; i++) await sleep(1000);
  const secs = (Date.now() - start) / 1000;
  check("gift window closed on time (about 30 s)", !$("#navNext").disabled && secs < 35, secs.toFixed(0) + " s");
  next(); await sleep(50);   // > stats update
  for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(5); }
  next(); await sleep(50);   // lock in
  check("points locked, Level 2 unlocked", /Start Level 2/.test($("#navNext").textContent) && !$("#navNext").disabled, $("#navNext").textContent);
}

/* Full 7-level run: checks per-level briefings, Level 2 hints, trialKind screens (sop, splitBrief, auto, judged),
   continuing past Level 1 through Level 7 Graduation, and reaching the Final Results screen with zero errors. */
async function fullSevenLevelGame() {
  w.eval('endSession(); S = fresh(); S.email = "tester@icstars.org"; S.code = "CYCLE60"; S.name = "Runner7"; S.step = 3; S.maxStep = 3; render();');
  await sleep(50);
  await creation("coop");
  check("full game starts at Lobby ready for Level 1", /Start Level 1/.test($("#navNext").textContent));
  next(); await sleep(30); // -> Level 1 Briefing

  const seenBriefings = [];
  let level1HintsOk = false;
  let level2HintsOk = false;

  for (let lv = 1; lv <= 7; lv++) {
    const levelState = w.eval(`({ level: G.level, step: S.step, header: BRIEFINGS[${lv}].header, title: BRIEFINGS[${lv}].title })`);
    const stageText = $("#stage").textContent;
    const hasBriefing = levelState.level === lv && levelState.step === 5 &&
      stageText.includes(levelState.header) && stageText.includes(levelState.title);
    check("Level " + lv + " shows its own briefing", hasBriefing, levelState.title);
    if (hasBriefing) seenBriefings.push(levelState.title);

    if (lv === 1) {
      level1HintsOk = w.eval('ghostHint("ATTEMPT_01") === LEVEL_HINTS[1].ghosts["ATTEMPT_01"] && teaHint() === LEVEL_HINTS[1].tea');
      check("Level 1 keeps original ghost and tea hints", level1HintsOk);
    } else if (lv === 2) {
      level2HintsOk = w.eval(
        'ghostHint("ATTEMPT_01") === "We locked our plan in early. Then the client changed everything." && ' +
        'ghostHint("NULL") === "Not every note is true. Check who wrote it." && ' +
        'ghostHint("USER_???") === "The news comes halfway through. Only one of you hears it first." && ' +
        'teaHint().startsWith("On my first sprint, we committed to a plan on day one.")'
      );
      check("Level 2 switches to Level 2 ghost and tea hints", level2HintsOk);
    }

    next(); await sleep(30); // -> Open Floor (1-6) or Graduation (7)

    if (lv === 7) {
      check("Level 7 reaches Graduation screen", w.eval('S.step === 9 && G.step === "graduation"') && $("#stage").textContent.includes("Graduation check"));
      for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
      next(); await sleep(30); // Lock in final points -> Final Results
      const fin = w.eval('({ over: G.over, ending: ME.ending(), players: G.players.length, teams: G.teams.map(t => t.name) })');
      const finalText = $("#stage").textContent;
      check(
        "Final results screen renders endings and team standings",
        fin.over === true && fin.players === 16 &&
          finalText.includes(fin.ending) &&
          fin.teams.every(name => finalText.includes(name)) &&
          !!$("#replay") && !!$("#restart") && $("#navNext").disabled,
        fin.ending
      );
      break;
    }

    next(); await sleep(30); // Open Floor -> Trial
    const kind = w.eval("R().trialKind");
    if (kind === "sop") {
      for (let i = 0; i < 6; i++) { const c = $("[data-pile]"); if (c) { c.click(); await sleep(2); } }
      $("#check").click(); await sleep(30);
    } else if (kind === "splitBrief") {
      const hasUI = !!$("#splitTmr") && !!$("#splitCards") && !!$("#splitNotesFeed") && !!$("#splitNoteIn") && !!$("#splitBoard") && !!$("#splitLockBtn");
      check("Level 2 renders Split Brief UI with timer, cards, notes, board, and Lock In", hasUI);
      check("Split Brief starts with notes left: 3/3", ($("#splitNotesLeft") || {}).textContent === "notes left: 3/3");

      // Post a note and verify counter drops
      $("#splitNoteIn").value = "Test note 1";
      $("#splitNoteIn").dispatchEvent(new w.Event("input", { bubbles: true }));
      $("#splitPostNote").click(); await sleep(10);
      check(
        "Split Brief post note updates feed and drops counter to 2/3",
        ($("#splitNotesLeft") || {}).textContent === "notes left: 2/3" && ($("#splitNotesFeed") || {}).textContent.includes("Test note 1"),
        ($("#splitNotesLeft") || {}).textContent
      );

      // Board add / up / down / remove
      $('[data-sb-add="C"]').click(); await sleep(5);
      $('[data-sb-add="D"]').click(); await sleep(5);
      check("Split Brief board Add places C then D", w.eval('JSON.stringify(G.round.trial.boardFor(MYTEAM))') === '["C","D"]');
      $('[data-sb-up="1"]').click(); await sleep(5);
      check("Split Brief board Up moves D to slot 1", w.eval('JSON.stringify(G.round.trial.boardFor(MYTEAM))') === '["D","C"]');
      $('[data-sb-down="0"]').click(); await sleep(5);
      check("Split Brief board Down moves D back to slot 2", w.eval('JSON.stringify(G.round.trial.boardFor(MYTEAM))') === '["C","D"]');
      $('[data-sb-rem="0"]').click(); await sleep(5);
      check("Split Brief board Remove leaves D", w.eval('JSON.stringify(G.round.trial.boardFor(MYTEAM))') === '["D"]');
      $('[data-sb-add="B"]').click(); await sleep(5);
      check("Split Brief board Add sets D then B", w.eval('JSON.stringify(G.round.trial.boardFor(MYTEAM))') === '["D","B"]');

      // Pre-twist Lock In shows warning and cancel keeps board unlocked
      $("#splitLockBtn").click(); await sleep(10);
      check(
        "Pre-twist Lock In shows warning confirmation",
        !!$("#splitLockConfirm") && $("#splitLockConfirm").textContent.includes("We locked our plan in early")
      );
      $("#splitLockNo").click(); await sleep(10);
      check("Cancel pre-twist Lock In keeps board unlocked", !$("#splitLockConfirm") && !w.eval('G.round.trial.isLocked(MYTEAM)'));

      // Advance past 25s (bot notes) and 90s (twist)
      const twistInfo = w.eval(
        '(() => { const startMs = G.timer.deadline - 180000; ' +
        'G.tick(startMs + 25000); G.tick(startMs + 95000); drawTimer(); ' +
        'const ghost = MYTEAM.members.find(p => G.round.trial.twistFor(p)); ' +
        'const nonGhost = MYTEAM.members.find(p => !G.round.trial.twistFor(p)); ' +
        'const gv = ghost ? SplitBriefView.screen({ game: G, me: ghost, team: MYTEAM, state: { noteDraft: "", msg: "", confirmLock: false, twistDismissed: false }, onRender: () => {} }) : null; ' +
        'const ngv = nonGhost ? SplitBriefView.screen({ game: G, me: nonGhost, team: MYTEAM, state: { noteDraft: "", msg: "", confirmLock: false, twistDismissed: false }, onRender: () => {} }) : null; ' +
        'return { fired: G.round.trial.twistFired, notes: G.round.trial.notesFor(MYTEAM).length, ' +
        'ghostPopup: !!(gv && gv.html.includes("splitTwistOv") && gv.html.includes("Breaking news. Only you got this.")), ' +
        'nonGhostQuiet: !!(ngv && !ngv.html.includes("splitTwistOv") && !ngv.html.includes("Breaking news")) }; })()'
      );
      await sleep(10);
      check("Twist fires at 90s: ghosted player sees popup, teammates do not", twistInfo.fired && twistInfo.ghostPopup && twistInfo.nonGhostQuiet, "notes=" + twistInfo.notes);

      // Reload mid-trial restores cards, notes, board, and twist state from save
      const restored = w.eval(
        '(() => { const saved = G.toJSON(); ' +
        'G = EP.Game.fromJSON(saved, { hooks: EP.Bots.hooks }); ' +
        'ME = G.players.find(p => p.id === ME.id); MYTEAM = G.teamOf(ME); ' +
        'resetRoundUI(); render(); ' +
        'return { cards: G.round.trial.cardsFor(ME).length, board: JSON.stringify(G.round.trial.boardFor(MYTEAM)), ' +
        'notes: G.round.trial.notesFor(MYTEAM).length, twist: G.round.trial.twistFired }; })()'
      );
      await sleep(10);
      check(
        "Reload mid-trial restores cards, notes, board, and twist state",
        restored.cards > 0 && restored.board === '["D","B"]' && restored.notes === twistInfo.notes && restored.twist &&
          ($("#splitNotesLeft") || {}).textContent === "notes left: 2/3" &&
          ($("#splitNotesFeed") || {}).textContent.includes("Test note 1") &&
          ($("#splitBoard") || {}).textContent.includes("Build the dashboard")
      );

      // Post-twist Lock In freezes the board
      if ($("#splitTwistOk")) { $("#splitTwistOk").click(); await sleep(5); }
      $("#splitLockBtn").click(); await sleep(10);
      const allBoardBtnsDisabled = $$("[data-sb-add], [data-sb-up], [data-sb-down], [data-sb-rem]").every(b => b.disabled);
      check(
        "Lock In freezes the board for the whole team",
        w.eval('G.round.trial.isLocked(MYTEAM)') && !!$("#splitLockedMsg") && allBoardBtnsDisabled
      );

      // Close trial by timer and verify score/rank
      const doneState = w.eval('(() => { const closed = G.tick(G.timer.deadline); afterClose(closed); return { done: G.didRun("runTrial"), hasTable: !!document.querySelector("table.levels") }; })()');
      await sleep(20);
      check("Split Brief closes on timer and shows team score and rank", doneState.done && doneState.hasTable && !$("#navNext").disabled);
    } else if (kind === "auto") {
      check("Level " + lv + " renders AutoTrial placeholder", !!$("#runAuto"));
      $("#runAuto").click(); await sleep(20);
    } else if (kind === "judged") {
      if ($("#subDraft")) {
        $("#subDraft").value = "Level " + lv + " team submission.";
        $("#subDraft").dispatchEvent(new w.Event("input", { bubbles: true }));
        $("#subBtn").click(); await sleep(20);
      }
      const picks = [];
      for (const sel of $$("[data-vpick]")) {
        const opt = [...sel.options].find(o => o.value && !picks.includes(o.value));
        if (opt) { sel.value = opt.value; picks.push(opt.value); sel.dispatchEvent(new w.Event("change", { bubbles: true })); }
      }
      $("#castVote").click(); await sleep(20);
    }

    check("Level " + lv + " (" + kind + ") trial completes and enables All-hands", !$("#navNext").disabled);
    next(); await sleep(30); // -> Glitch Report
    if (lv === 2) {
      const reportText = ($(".report") || {}).textContent || "";
      check("Level 2 All-Hands shows no Level 1 anomaly lines", $$(".report .clue").length === 0 && !/spelled wrong|badge flickered|SOP/i.test(reportText));
    }
    $("#skipAcc").click(); await sleep(20); // -> Gift Window
    w.eval('if (G.timer && G.timer.name === "giftWindow") afterClose(G.tick(G.timer.deadline));');
    await sleep(20); // Gift Window closed, Stats Update button enabled
    next(); await sleep(30); // -> Stats Update
    for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
    next(); await sleep(30); // Lock in points -> roundDone
    if (lv === 2) {
      const s1 = w.eval('({ teams: G.teams.map(t => t.name), myTeam: MYTEAM.name, wins: MYTEAM.trialWins, hearts: ME.hearts.count, glitches: ME.glitches })');
      const s1Text = $("#stage").textContent;
      const hasSprint1 = s1Text.includes("Sprint 1 Complete") &&
        s1Text.includes("Level 1") && s1Text.includes("Level 2") &&
        s1Text.includes("Hearts: " + s1.hearts + "/3") &&
        s1Text.includes("Glitches: " + s1.glitches + "/2") &&
        s1Text.includes(s1.myTeam) &&
        s1.teams.every(name => s1Text.includes(name)) &&
        s1Text.includes("Level 3 locked") &&
        !!$("#replay") && !!$("#restart") &&
        $("#navNext").disabled && /Level 3 locked/.test($("#navNext").textContent);
      check("Sprint 1 Complete screen appears after Level 2 Stats Update", hasSprint1);
      const leaksTypeOrPath = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i.test(s1Text);
      check("Sprint 1 Complete screen hides work style and secret path", !leaksTypeOrPath, leaksTypeOrPath ? "leaked" : "clean");
      w.eval("startNextLevel()"); await sleep(30); // -> Level 3 Briefing
    } else {
      check("Level " + lv + " unlocks Level " + (lv + 1), new RegExp("Start Level " + (lv + 1)).test($("#navNext").textContent) && !$("#navNext").disabled);
      next(); await sleep(30); // -> Level lv+1 Briefing
    }
  }
  check("All 7 levels displayed unique briefings", new Set(seenBriefings).size === 7, seenBriefings.length + "/7");
}

/* Breakout Room USE label (map): it must say "Sabotage" only when a Sabotage button inside would work.
   A Contrarian walks to the Breakout Room in Open Floor, sabotages twice (1 + 2 hearts, so 0 hearts left).
   With every button blocked, the label must no longer say "Sabotage". The player walks by holding keys;
   the position is read from the map (#wme). */
const key = (type, k) => d.body.dispatchEvent(new w.KeyboardEvent(type, { key: k, bubbles: true }));
const pos = () => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec($("#wme").getAttribute("transform")); return { x: +m[1], y: +m[2] }; };
async function walk(k, until) {   // hold a key until the condition holds, or the player stops moving (a wall)
  key("keydown", k);
  let last = pos(), still = 0;
  for (let i = 0; i < 800; i++) {
    await sleep(10);
    const p = pos();
    if (until && until(p)) break;
    if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 0.5) { if ((still += 10) >= 300) break; } else still = 0;
    last = p;
  }
  key("keyup", k); await sleep(40);
}
async function breakoutLabel() {
  next(); await sleep(50);   // > briefing
  next(); await sleep(100);  // > open floor (map)
  /* Stop random ghost hops so a ghost near the Breakout Room table cannot flip USE from "Sabotage" to "Listen". */
  w.eval("W.ghostT = Infinity; W.near = -1; W.ghostPos.forEach(p => { p.on = false; p.x = -9999; p.y = -9999; });");
  await walk("s");                       // down to the elevator wall
  await walk("d");                       // right to the reception wall
  await walk("w", p => p.y <= 712);      // up into the hallway
  await walk("d", p => p.x >= 1628);     // along the hallway to the Breakout Room door
  await walk("s");                       // into the room, stops at the table
  check("walked into the Breakout Room", $("#wroom").textContent === "Breakout Room", $("#wroom").textContent + " " + JSON.stringify(pos()));
  check("USE says Sabotage when a sabotage would work", $("#usebtn").textContent === "Sabotage", $("#usebtn").textContent);
  key("keydown", "e"); await sleep(50); key("keyup", "e");
  for (let i = 0; i < 3; i++) { const b = $$("[data-sab]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(50); }
  const left = $$("[data-sab]").filter(b => !b.disabled).length;
  key("keydown", "Escape"); await sleep(100);
  check("all Sabotage buttons blocked (0 hearts)", left === 0, left + " enabled");
  check("USE no longer says Sabotage when every sabotage is blocked", $("#usebtn").textContent !== "Sabotage", $("#usebtn").textContent);
}

async function voteTestPage() {
  const vtDom = new JSDOM(fs.readFileSync(path.join(repo, "pages", "vote-test.html"), "utf8"), {
    url: "file:///" + repo.replace(/\\/g, "/") + "/pages/vote-test.html",
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      win.HTMLElement.prototype.scrollTo = () => {};
    },
  });
  const vw = vtDom.window, vd = vw.document;
  const v$ = s => vd.querySelector(s), v$$ = s => [...vd.querySelectorAll(s)];
  await new Promise(r => vw.addEventListener("load", r));
  await sleep(100);
  check("vote-test.html loads setup screen", !!v$("#go"));
  v$("#go").click(); await sleep(50);
  if (v$("#subDraft")) {
    v$("#subDraft").value = "Vote test submission.";
    v$("#subDraft").dispatchEvent(new vw.Event("input", { bubbles: true }));
    v$("#subBtn").click(); await sleep(50);
  }
  const picks = [];
  for (const sel of v$$("[data-vpick]")) {
    const opt = [...sel.options].find(o => o.value && !picks.includes(o.value));
    if (opt) { sel.value = opt.value; picks.push(opt.value); sel.dispatchEvent(new vw.Event("change", { bubbles: true })); }
  }
  check("vote-test.html reaches voting screen", !!v$("#castVote"));
  v$("#castVote").click(); await sleep(50);
  check("vote-test.html shows vote results", !!v$("#next") && vd.querySelectorAll("table.levels tbody tr").length === 4);
  vtDom.window.close();
}

w.addEventListener("load", async () => {
  try {
    await sleep(300);
    $("#em").value = "tester@icstars.org"; $("#jc").value = "CYCLE60"; next(); await sleep(50);
    next(); await sleep(50);
    const nm = $("#nm"); nm.value = "Tester"; nm.dispatchEvent(new w.Event("input", { bubbles: true })); await sleep(50);
    next(); await sleep(50);
    await creation();
    log("run 1");
    await level1(0);
    await fullscreen();
    $("#replay").click(); await sleep(50);
    log("replay pressed");
    await creation();
    log("run 2");
    await level1(12000);
    log("waiting 10 s more for any stale timer");
    await sleep(10000);
    $("#replay").click(); await sleep(50);
    await creation("contra");
    log("run 3: Contrarian, Breakout Room label");
    await breakoutLabel();
    log("run 4: full 7-level game");
    await fullSevenLevelGame();
    log("run 5: pages/vote-test.html");
    await voteTestPage();
  } catch (e) { errors.push(String(e.message || e)); }
  check("no console errors", !errors.length, errors.length ? [...new Set(errors)].join(" | ") : "none");
  console.log("");
  console.log(passed + " passed, " + (errors.length ? [...new Set(errors)].length : 0) + " failed");
  process.exit(errors.length ? 1 : 0);
});
