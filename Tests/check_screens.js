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
const finishTimedStep = expectedName => {
  w.eval(`(() => {
    if (!G || !G.timer) return;
    if (${JSON.stringify(expectedName || "")} && G.timer.name !== ${JSON.stringify(expectedName || "")}) return;
    G._testClockOffset = G.timer.deadline - Date.now();
    G._timer.clock = () => Date.now() + G._testClockOffset;
    G.activity(ME);
    const closed = G.tick();
    if (closed.length) afterClose(closed);
  })()`);
};
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

const ATTR_ORDER = ["Focus", "Collaboration", "Initiative", "Grit", "Composure"];
const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
const toggleHost = () => w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "H", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
const noOkFlags = () => $$(".flag").every(el => el.textContent.trim() !== "OK");
async function creation(type = "coop") {
  $('[data-type="' + type + '"]').click(); await sleep(30);
  if (type === "coop") {
    const cAttrs = $$(".buy .brow .nm").map(el => ATTR_ORDER.find(a => el.textContent.startsWith(a)));
    check("character creation lists attributes in standard order", JSON.stringify(cAttrs) === JSON.stringify(ATTR_ORDER), cAttrs.join(", "));
  }
  while (true) { const b = $$("[data-inc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
  next(); await sleep(50);
  for (let i = 0; i < 40 && !/Start Level 1/.test($("#navNext").textContent); i++) { next(); await sleep(200); }
}
async function level1(trialWait) {
  next(); await sleep(50);   // > briefing
  next(); await sleep(50);   // > open floor
  finishTimedStep("openFloor"); await sleep(50);   // > trial
  if (trialWait) { log("waiting " + trialWait / 1000 + " s in the trial"); await sleep(trialWait); }
  for (let i = 0; i < 6; i++) { const c = $("[data-pile]"); if (c) { c.click(); await sleep(5); } }
  $("#check").click(); await sleep(50);
  finishTimedStep("sop"); await sleep(50);
  next(); await sleep(50);   // > glitch report
  $("#skipAcc").click(); await sleep(50);
  finishTimedStep("glitchReport"); await sleep(50);
  log("gift window open, timer " + ($("#tmr") ? $("#tmr").textContent : "?"));
  const start = Date.now();
  for (let i = 0; i < 40 && w.eval("S.step === 8"); i++) await sleep(1000);
  const secs = (Date.now() - start) / 1000;
  check("gift window auto-advanced on time (about 30 s)", w.eval('S.step === 9 && G.step === "statsUpdate"') && secs < 35, secs.toFixed(0) + " s");
  for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(5); }
  next(); await sleep(50);   // lock in
  finishTimedStep("statsUpdate"); await sleep(50);
  check("points locked, Level 2 unlocked", /Start Level 2/.test($("#navNext").textContent) && !$("#navNext").disabled, $("#navNext").textContent);
}

/* Full 7-level run: checks per-level briefings, Level 2 hints, trialKind screens (sop, splitBrief, auto, judged),
   continuing past Level 1 through Level 7 Graduation, and reaching the Final Results screen with zero errors. */
async function fullSevenLevelGame() {
  w.eval('endSession(); S = fresh(); S.email = "tester@icstars.org"; S.code = "CYCLE60"; S.name = "Runner7"; S.step = 3; S.maxStep = 3; render();');
  await sleep(50);
  await creation("coop");
  check("full game starts at Lobby ready for Level 1", /Start Level 1/.test($("#navNext").textContent));
  const hudAttrs = $$("#hud .attr .top span:first-child").map(el => el.textContent.trim());
  check("HUD lists attributes in standard order", JSON.stringify(hudAttrs) === JSON.stringify(ATTR_ORDER), hudAttrs.join(", "));
  let anyOkFlag = !noOkFlags();
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
      check(
        "Level 2 briefing shows exact header and title",
        stageText.includes("System Briefing · Level 2") && stageText.includes("Sprint 1: Back-Plan the Demo")
      );
      level2HintsOk = w.eval(
        'ghostHint("ATTEMPT_01") === "We locked our plan in early. Then the client changed everything." && ' +
        'ghostHint("NULL") === "Not every note is true. Check who wrote it." && ' +
        'ghostHint("USER_???") === "The news comes halfway through. Only one of you hears it first." && ' +
        'teaHint().startsWith("On my first sprint, we committed to a plan on day one.")'
      );
      check("Level 2 switches to Level 2 ghost and tea hints", level2HintsOk);
    } else if (lv === 3) {
      const expectedMemo = "Today you present to Medline. The call opens in 30 seconds. Every active member must connect before the doors close, or the room empties and your team scores zero. Once you're in, crews are drawn at random. Setup Crew runs the steps in order: cables, sound, mic, deck, Q&A. Dance Crew keeps the audience awake. Attention drains from the moment showtime starts. Finish fast and finish clean.";
      const lv3Meta = w.eval('({ name: ME.name, team: MYTEAM.name, focus: ME.attrs.focus })');
      const panels = $$("#stage .cols .panel");
      const hasFocusCard = panels.some(p => p.textContent.includes("This trial tests") && p.textContent.includes("Focus"));
      const hasCostCard = panels.some(p => p.textContent.includes("Cost for every player") && p.textContent.includes("3 points"));
      const hasMyFocusCard = panels.some(p => p.textContent.includes("Your Focus") && p.textContent.includes(String(lv3Meta.focus)));
      check(
        "Level 3 briefing shows exact approved header, title, memo, and Focus cards without leaks",
        stageText.includes("System Briefing · Level 3") &&
          stageText.includes("The Mirror: Presentation Day") &&
          stageText.includes("To: " + lv3Meta.name + ", " + lv3Meta.team) &&
          stageText.includes(expectedMemo) &&
          hasFocusCard && hasCostCard && hasMyFocusCard &&
          !LEAK_RE.test(stageText)
      );
      const hostHiddenAtBrief = $("#facBtn").hidden && $("#fac").hidden;
      toggleHost(); await sleep(10);
      const hostShownAtBrief = !$("#facBtn").hidden && $("#fac").hidden;
      $("#facBtn").click(); await sleep(10);
      const briefHostOk = hostHiddenAtBrief && hostShownAtBrief && !$("#fac").hidden &&
        $("#fac").textContent.includes("Level 3. Presentation Day. Read the memo. You present to the Medline client today.");
      toggleHost(); await sleep(10);
      const hostRehiddenAtBrief = $("#facBtn").hidden && $("#fac").hidden;
      check("Level 3 Briefing host script is hidden from non-host players and shows exact approved line to host", briefHostOk && hostRehiddenAtBrief);
    }

    next(); await sleep(30); // -> Open Floor (1-6) or Graduation (7)

    if (lv === 3) {
      const expUser = "The doors closed with one of us still outside. They don't wait for stragglers. Neither does the client.";
      const expAttempt = "I grabbed the first deck I saw. Draft. Wrong version. The client only trusts what they signed.";
      const expNull = "Seventy to eighty-five. Louder is not better. When the crowd roars, pull the sound down.";
      const expTea = "My first client demo, the projector cable didn't fit. We had tested everything except the room. Now I check the setup first, I keep the signed version of the deck in one place, and I know the client's problem cold before anyone asks me a question. A presentation fails in the setup long before it fails on stage.";
      const hintsTableOk = w.eval(
        `ghostHint("USER_???") === ${JSON.stringify(expUser)} && ` +
        `ghostHint("ATTEMPT_01") === ${JSON.stringify(expAttempt)} && ` +
        `ghostHint("NULL") === ${JSON.stringify(expNull)} && ` +
        `teaHint() === ${JSON.stringify(expTea)}`
      );
      w.eval('S.room = "hightea"; S.panel = "room"; render();'); await sleep(10);
      const teaPanelText = ($(".wpanel") || {}).textContent || "";
      const teaPanelOk = teaPanelText.includes(expTea) && !LEAK_RE.test(teaPanelText);
      const ghostTexts = [];
      for (let gi = 0; gi < 3; gi++) {
        w.eval(`S.panel = "ghost"; S.nearGhost = ${gi}; render();`); await sleep(10);
        ghostTexts.push(($(".wpanel") || {}).textContent || "");
      }
      w.eval('S.panel = false; S.room = "studio"; render();'); await sleep(10);
      const joinedGhosts = ghostTexts.join("\n");
      const ghostPanelsOk = joinedGhosts.includes(expUser) && joinedGhosts.includes(expAttempt) &&
        joinedGhosts.includes(expNull) && !LEAK_RE.test(joinedGhosts);
      check("Level 3 hint table has exact approved ghost hints and tea guest story", hintsTableOk && teaPanelOk && ghostPanelsOk);
    }

    if (lv === 7) {
      check("Level 7 reaches Graduation screen", w.eval('S.step === 9 && G.step === "graduation"') && $("#stage").textContent.includes("Graduation check"));
      for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
      next(); await sleep(30); // Lock in final points -> Final Results
      finishTimedStep("graduation"); await sleep(30);
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

    if (lv === 3) {
      w.eval('window._mirSimNow = G.timer.deadline; G._timer.clock = () => window._mirSimNow; G.activity(ME); afterClose(G.tick());');
      await sleep(30);
    } else {
      finishTimedStep("openFloor"); await sleep(30); // Open Floor -> Trial
    }
    const kind = w.eval("R().trialKind");
    if (kind === "sop") {
      for (let i = 0; i < 6; i++) { const c = $("[data-pile]"); if (c) { c.click(); await sleep(2); } }
      $("#check").click(); await sleep(30);
      finishTimedStep("sop"); await sleep(30);
    } else if (kind === "splitBrief") {
      const hasUI = !!$("#splitTmr") && !!$("#splitCards") && !!$("#splitNotesFeed") && !!$("#splitNoteIn") && !!$("#splitBoard") && !!$("#splitLockBtn");
      check("Level 2 renders Split Brief UI with timer, cards, notes, board, and Lock In", hasUI);
      check("Split Brief starts with notes left: 3/3", ($("#splitNotesLeft") || {}).textContent === "notes left: 3/3");

      // Post 3 notes, verify counter 3 -> 2 -> 1 -> 0, poster name, Post button disabled & outside scrolling feed
      check("Post button sits outside scrolling notes feed", !$("#splitNotesFeed").contains($("#splitPostNote")));
      const expectedCounters = ["notes left: 2/3", "notes left: 1/3", "notes left: 0/3"];
      let notesCapOk = true;
      for (let ni = 0; ni < 3; ni++) {
        $("#splitNoteIn").value = "Test note " + (ni + 1);
        $("#splitNoteIn").dispatchEvent(new w.Event("input", { bubbles: true }));
        $("#splitPostNote").click(); await sleep(10);
        if (($("#splitNotesLeft") || {}).textContent !== expectedCounters[ni]) notesCapOk = false;
      }
      const feedText = ($("#splitNotesFeed") || {}).textContent || "";
      const myName = w.eval("ME.name");
      const hasAllNotesAndNames = [1, 2, 3].every(i => feedText.includes("Test note " + i)) && feedText.includes(myName + ":");
      check("Split Brief notes counter goes 3, 2, 1, 0 and shows poster name", notesCapOk && hasAllNotesAndNames, ($("#splitNotesLeft") || {}).textContent);
      const countBefore4th = w.eval("G.round.trial.notesFor(MYTEAM).length");
      $("#splitPostNote").click(); await sleep(10);
      const fourthBlocked = $("#splitPostNote").disabled && $("#splitNoteIn").disabled &&
        w.eval("G.round.trial.notesFor(MYTEAM).length") === countBefore4th &&
        !w.eval('G.round.trial.postNote(ME, "Note 4").ok');
      check("After 3 notes, Post button is disabled and 4th note is not added", fourthBlocked);

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
        'const nonGhosts = MYTEAM.members.filter(p => p !== ghost); ' +
        'const ghostState = { noteDraft: "", msg: "", confirmLock: false, twistDismissed: false }; ' +
        'const gv = ghost ? SplitBriefView.screen({ game: G, me: ghost, team: MYTEAM, state: ghostState, onRender: () => {} }) : null; ' +
        'const ngvs = nonGhosts.map(p => SplitBriefView.screen({ game: G, me: p, team: MYTEAM, state: { noteDraft: "", msg: "", confirmLock: false, twistDismissed: false }, onRender: () => {} })); ' +
        'const refire1 = G.round.trial.fireTwist(); ' +
        'G.tick(startMs + 115000); drawTimer(); ' +
        'const ghostAfterTick = MYTEAM.members.find(p => G.round.trial.twistFor(p)); ' +
        'return { fired: G.round.trial.twistFired, notes: G.round.trial.notesFor(MYTEAM).length, ' +
        'ghostId: ghost ? ghost.id : null, sameGhostAfterTick: ghostAfterTick === ghost, refire1, ' +
        'ghostPopup: !!(gv && gv.html.includes("splitTwistOv") && gv.html.includes("Breaking news. Only you got this.")), ' +
        'allNonGhostsQuiet: ngvs.length > 0 && ngvs.every(v => !v.html.includes("splitTwistOv") && !v.html.includes("Breaking news")) }; })()'
      );
      await sleep(10);
      check("Twist fires once at 90s: ghosted player only, not on later ticks", twistInfo.fired && twistInfo.ghostPopup && twistInfo.allNonGhostsQuiet && !twistInfo.refire1 && twistInfo.sameGhostAfterTick, "notes=" + twistInfo.notes);

      // Reload mid-trial restores cards, notes, board, and twist state from save; twist does not re-fire
      const restored = w.eval(
        '(() => { const saved = G.toJSON(); ' +
        'G = EP.Game.fromJSON(saved, { hooks: EP.Bots.hooks }); ' +
        'ME = G.players.find(p => p.id === ME.id); MYTEAM = G.teamOf(ME); ' +
        'const refireAfterLoad = G.round.trial.fireTwist(); ' +
        'G.tick(G.timer.deadline - 50000); ' +
        'const ghostAfterLoad = MYTEAM.members.find(p => G.round.trial.twistFor(p)); ' +
        'resetRoundUI(); render(); ' +
        'return { cards: G.round.trial.cardsFor(ME).length, board: JSON.stringify(G.round.trial.boardFor(MYTEAM)), ' +
        'notes: G.round.trial.notesFor(MYTEAM).length, twist: G.round.trial.twistFired, ' +
        'refireAfterLoad, sameGhostAfterLoad: !!(ghostAfterLoad && ghostAfterLoad.id === ' + JSON.stringify(twistInfo.ghostId) + ') }; })()'
      );
      await sleep(10);
      check(
        "Reload mid-trial restores cards, notes, board, and twist does not re-fire",
        restored.cards > 0 && restored.board === '["D","B"]' && restored.notes === twistInfo.notes && restored.twist &&
          !restored.refireAfterLoad && restored.sameGhostAfterLoad &&
          ($("#splitNotesLeft") || {}).textContent === "notes left: 0/3" &&
          ($("#splitNotesFeed") || {}).textContent.includes("Test note 1") &&
          ($("#splitBoard") || {}).textContent.includes("Build the dashboard")
      );

      // Post-twist Lock In freezes the board for the whole team
      if ($("#splitTwistOk")) { $("#splitTwistOk").click(); await sleep(5); }
      $("#splitLockBtn").click(); await sleep(10);
      const allBoardBtnsDisabled = $$("[data-sb-add], [data-sb-up], [data-sb-down], [data-sb-rem]").every(b => b.disabled);
      const mateBlocked = w.eval(
        '(() => { const mate = MYTEAM.members.find(p => p !== ME && p.isActive()); ' +
        'if (!mate) return false; ' +
        'const mv = SplitBriefView.screen({ game: G, me: mate, team: MYTEAM, state: { noteDraft: "", msg: "", confirmLock: false, twistDismissed: false }, onRender: () => {} }); ' +
        'const setRes = G.round.trial.setBoard(mate, ["A"]); ' +
        'return !setRes.ok && mv.html.includes("splitLockedMsg") && mv.html.includes("disabled"); })()'
      );
      check(
        "Lock In freezes the board for the whole team",
        w.eval('G.round.trial.isLocked(MYTEAM)') && !!$("#splitLockedMsg") && allBoardBtnsDisabled && mateBlocked
      );

      // Close trial by timer and verify score/rank
      const doneState = w.eval('(() => { const closed = G.tick(G.timer.deadline); afterClose(closed); return { done: G.didRun("runTrial"), hasTable: !!document.querySelector("table.levels") }; })()');
      await sleep(20);
      check("Split Brief closes on timer and shows team score and rank", doneState.done && doneState.hasTable && !$("#navNext").disabled);
    } else if (kind === "mirror") {
      const lobbyText0 = $("#stage").textContent;
      check(
        "Level 3 Lobby shows Presentation Day banner, 30s countdown, signal-grab tile, and no leaks",
        lobbyText0.includes("PRESENTATION DAY") &&
          ($("#lobbyCd") || {}).textContent === "30s" &&
          !!$("#mirrorSignalBtn") &&
          !!$("#mirrorSigCursor") &&
          !/bot/i.test(lobbyText0) &&
          !LEAK_RE.test(lobbyText0) &&
          noOkFlags()
      );
      const hostHiddenAtTrial = $("#facBtn").hidden && $("#fac").hidden;
      toggleHost(); await sleep(10);
      $("#facBtn").click(); await sleep(10);
      const lobbyPhaseOk = w.eval('G.mirrorPhase() === "lobby"');
      const lobbyScriptOk = $("#fac").textContent.includes("Doors open. Connect to the call in the next 30 seconds. Anyone left outside, the whole team fails.");

      // Step cursor to an out-of-band position and verify a miss does not connect and speeds up the tile
      const missBefore = w.eval('(() => { for (let i = 0; i < 60; i++) { const c = document.querySelector("#mirrorSigCursor"); if (c && !c.classList.contains("hot")) break; drawTimer(); } const p = G.mirrorLobbyTeam(MYTEAM).players.find(x => x.playerId === ME.id); return { misses: p.misses, speed: p.speed, hot: document.querySelector("#mirrorSigCursor").classList.contains("hot") }; })()');
      $("#mirrorSignalBtn").click(); await sleep(10);
      const missAfter = w.eval('(() => { const p = G.mirrorLobbyTeam(MYTEAM).players.find(x => x.playerId === ME.id); return { connected: p.connected, misses: p.misses, speed: p.speed, phase: G.mirrorPhase() }; })()');
      const missMsg = ($("#mirrorMsg") || {}).textContent || "";
      check(
        "Signal-grab miss does not connect, speeds up tile by +2, and shows wobble message",
        !missBefore.hot && !missAfter.connected && missAfter.misses === missBefore.misses + 1 &&
          missAfter.speed === Math.min(16, missBefore.speed + 2) && missAfter.phase === "lobby" &&
          missMsg.includes("lost the signal"),
        "speed " + missBefore.speed + " -> " + missAfter.speed
      );

      // Advance 16s via rules clock so all bots connect (3-15s) and countdown updates from rules Timer
      w.eval('window._mirSimNow += 16000; const closed = G.tick(); if (closed.length) afterClose(closed); else drawTimer();');
      await sleep(10);
      const botMates = $$('[data-lobby-player]');
      const allBotMatesConnected = botMates.length === 3 && botMates.every(el => el.classList.contains("in") && el.textContent.includes("IN THE CALL"));
      check(
        "Lobby countdown reads from rules timer and bots show as connected",
        ($("#lobbyCd") || {}).textContent === "14s" && allBotMatesConnected && !/bot/i.test($("#stage").textContent),
        ($("#lobbyCd") || {}).textContent + ", mates=" + botMates.length
      );

      // Step cursor into the green band and tap to connect, closing lobby into Crew Reveal
      const hitPrep = w.eval('(() => { for (let i = 0; i < 80; i++) { const c = document.querySelector("#mirrorSigCursor"); if (c && c.classList.contains("hot")) break; drawTimer(); } return document.querySelector("#mirrorSigCursor").classList.contains("hot"); })()');
      $("#mirrorSignalBtn").click(); await sleep(10);
      const revealState = w.eval('({ phase: G.mirrorPhase(), slots: G.mirrorSetupSlots(MYTEAM), crew: G.mirrorCrew(MYTEAM) })');
      const revealText = $("#stage").textContent;
      const revealSetupRows = $$('[data-setup-slot]');
      const revealDanceRows = $$('[data-dance-player]');
      const stepLabels = { cables: "Cables", sound: "Sound", mic: "Mic", deck: "Deck", qa: "Q&A" };
      const slotsMatch = revealState.slots.length === 2 &&
        revealSetupRows.length === 2 &&
        revealState.slots.every((sl, i) => revealSetupRows[i].textContent.includes(sl.name) && sl.steps.every(st => revealSetupRows[i].textContent.includes(stepLabels[st])));
      const dancersMatch = revealState.crew && revealState.crew.danceIds.length === 2 && revealDanceRows.length === 2;
      check(
        "Signal-grab hit connects player and opens Crew Reveal with setup step owners and dance crew",
        hitPrep && revealState.phase === "reveal" && revealText.includes("CREW LOCKED") && slotsMatch && dancersMatch &&
          !LEAK_RE.test(revealText) && noOkFlags()
      );

      // Advance past 1s mirrorReveal deadline into showtime
      w.eval('window._mirSimNow = G.timer.deadline; afterClose(G.tick());');
      await sleep(10);
      const showtimePhaseOk = w.eval('G.mirrorPhase() === "showtime"');
      const showtimeScriptOk = $("#fac").textContent.includes("Crews are locked. Setup, work your steps in order. Dancers, keep the room awake. Attention is draining. Go.");
      toggleHost(); await sleep(10);
      const hostRehiddenAtTrial = $("#facBtn").hidden && $("#fac").hidden;
      const showtimeText = $("#stage").textContent;
      check(
        "Level 3 Trial host script is hidden from non-host players and updates from lobby to showtime",
        hostHiddenAtTrial && lobbyPhaseOk && lobbyScriptOk && showtimePhaseOk && showtimeScriptOk && hostRehiddenAtTrial
      );
      check(
        "Crew Reveal advances into Step 6c-1 showtime frame without leaks",
        !!$("#attnBar") && !!$("#attnPct") && !!$("#mirrorSetupFrame") &&
          !/bot/i.test(showtimeText) && !LEAK_RE.test(showtimeText) && noOkFlags()
      );

      const lv3Role = w.eval("G.mirrorRole(ME)");
      if (lv3Role === "dance") {
        check(
          "Dance Crew player sees Step 6d rhythm lane during showtime",
          !!$("#mirrorDancePanel") && !!$("#lane") && !$("#mirrorDancePlaceholder")
        );
        for (let g = 0; g < 80 && !w.eval('G.didRun("runTrial")'); g++) {
          w.eval('window._mirSimNow += 1000; const cl = G.tick(); if (cl.length) afterClose(cl); else drawTimer();');
        }
        await sleep(10);
      } else {
        for (let g = 0; g < 500 && !w.eval('G.didRun("runTrial")'); g++) {
          const cur = w.eval('({ step: (G.mirrorSetupTeam(MYTEAM) || {}).currentStep, owner: (G.mirrorSetupTeam(MYTEAM) || {}).currentPlayerId, meId: ME.id })');
          if (cur.owner === cur.meId) {
            if (cur.step === "cables") {
              w.eval(`(() => {
                for (let k = 0; k < 25; k++) {
                  const hitEl = document.querySelector('[data-cable-item][data-in-frame="1"]');
                  if (hitEl) {
                    const port = hitEl.dataset.cableItem;
                    const btn = document.querySelector('[data-cable-port="' + port + '"]');
                    if (btn && !btn.disabled) { btn.click(); return; }
                  }
                  drawTimer();
                }
              })()`);
            } else if (cur.step === "sound") {
              w.eval(`(() => {
                const lvl = Number((document.querySelector("#soundVal") || {}).textContent || 45);
                if (lvl < 74) {
                  const b = document.querySelector('[data-sound-gain="' + (lvl <= 68 ? "10" : "5") + '"]');
                  if (b) b.click();
                } else if (lvl > 85) {
                  const b = document.querySelector('[data-sound-gain="-10"]');
                  if (b) b.click();
                }
                window._mirSimNow += 250;
                const cl = G.tick();
                if (cl.length) afterClose(cl); else drawTimer();
              })()`);
            } else if (cur.step === "mic") {
              w.eval(`(() => {
                for (let k = 0; k < 25; k++) {
                  const disp = document.querySelector("#micSeqDisp");
                  if (disp && disp.dataset.flashing === "0") break;
                  window._mirSimNow += 250;
                  const cl = G.tick();
                  if (cl.length) afterClose(cl); else drawTimer();
                }
                const st = G.mirrorSetupTeam(MYTEAM);
                if (st && st.currentStep === "mic" && st.mic.sequence) {
                  const micNum = st.mic.sequence[st.mic.index];
                  const b = document.querySelector('[data-mic="' + micNum + '"]');
                  if (b && !b.disabled) b.click();
                }
              })()`);
            } else if (cur.step === "deck") {
              w.eval(`(() => {
                const idx = EP.MirrorData.files.findIndex(f => f.correct);
                const b = document.querySelector('[data-file="' + idx + '"]');
                if (b && !b.disabled) b.click();
              })()`);
            } else if (cur.step === "qa") {
              w.eval(`(() => {
                const st = G.mirrorSetupTeam(MYTEAM);
                if (st && st.currentStep === "qa" && st.qa.order) {
                  const item = EP.MirrorData.qaItems[st.qa.order[st.qa.index]];
                  const b = document.querySelector('[data-qa="' + item.correctIndex + '"]');
                  if (b) b.click();
                }
              })()`);
            } else if (cur.step === "wrapUp" && $("#wrapUp")) {
              $("#wrapUp").click();
            }
          } else {
            w.eval('window._mirSimNow += 1000; const cl = G.tick(); if (cl.length) afterClose(cl); else drawTimer();');
          }
          await sleep(2);
        }
      }

      // Restore real clock before checking completion and advancing to Glitch Report
      w.eval('G._timer.clock = () => Date.now(); G.activity(ME);');
      await sleep(10);
      check("Level 3 Showtime finishes cleanly without leaks", w.eval('G.didRun("runTrial")') && !LEAK_RE.test($("#stage").textContent) && noOkFlags());
      const res3 = w.eval(`(() => {
        const rank = G.trialRanking();
        const rows = [...document.querySelectorAll("#mirrorRankTable tbody tr")];
        const rowsMatch = rows.length === rank.length && rank.every((r, i) => {
          const cells = [...rows[i].children].map(td => td.textContent);
          const attTxt = Math.abs(r.attention - Math.round(r.attention)) < 0.05
            ? String(Math.round(r.attention))
            : r.attention.toFixed(1);
          return cells[0] === String(r.place) &&
            cells[1].includes(r.team.name) &&
            cells[2].includes(attTxt + "%") &&
            cells[3].includes(r.base + " / 7") &&
            cells[4] === (r.won ? "Win" : "Loss");
        });
        const tieOk = (document.querySelector("#mirrorTieRule") || {}).textContent === "Ties: higher exact attention wins, then random.";
        const lt = G.mirrorLobbyTeam(MYTEAM);
        const st = G.mirrorSetupTeam(MYTEAM);
        const dc = G.mirrorDanceTeam(MYTEAM);
        const sumEl = document.querySelector("#mirrorTeamSummary");
        const sumLobby = (document.querySelector("#mirrorSumLobby") || {}).textContent || "";
        const sumSetup = (document.querySelector("#mirrorSumSetup") || {}).textContent || "";
        const sumDance = (document.querySelector("#mirrorSumDance") || {}).textContent || "";
        const hiccups = st ? st.botHiccups + st.cables.sparks + st.sound.feedbacks + st.mic.wrongs + st.deck.filesTried.length + st.qa.wrong + st.qa.timeouts : 0;
        const summaryOk = !!sumEl &&
          sumLobby.includes(lt.players.filter(p => p.connected).length + " of " + lt.players.length) &&
          (!st || (sumSetup.includes(st.completedSteps.length + " of 5 steps done") && sumSetup.includes(hiccups + " hiccup"))) &&
          (!dc || !dc.dancers.length || sumDance.includes(dc.dancers.length + " dancer"));
        const mine = rank.find(r => r.team === MYTEAM);
        const resTxt = (document.querySelector("#mirrorResult") || {}).textContent || "";
        const winLossOk = !!mine && resTxt.includes("Team " + (mine.won ? "WIN" : "LOSS") + ". Score " + mine.base + " of 7.");
        const stg = document.querySelector("#stage").textContent;
        return {
          rowsMatch,
          tieOk,
          summaryOk,
          winLossOk,
          costOk: resTxt.includes("Every player now pays 3 Focus"),
          clean: !/Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i.test(stg) && !/bot/i.test(stg),
        };
      })()`);
      check("Level 3 trial result screen shows rules score, attention, ranking, tie rule, and team summary", res3.rowsMatch && res3.tieOk && res3.summaryOk && res3.winLossOk && res3.costOk && res3.clean);
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
    $("#skipAcc").click(); await sleep(20); // -> Glitch Report saved
    finishTimedStep("glitchReport"); await sleep(20); // -> Gift Window
    finishTimedStep("giftWindow");
    await sleep(20); // Gift Window closed, auto-advanced to Stats Update
    check("Level " + lv + " Gift Window auto-advances All-Hands to Stats Update", w.eval('S.step === 9 && G.step === "statsUpdate"'));
    for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(b => !b.disabled); if (!b) break; b.click(); await sleep(2); }
    next(); await sleep(30); // Lock in points -> roundDone
    finishTimedStep("statsUpdate"); await sleep(30);
    if (lv === 2) {
      const s1 = w.eval('({ teams: G.teams.map(t => t.name), myTeam: MYTEAM.name, wins: MYTEAM.trialWins, lv2Win: !!MYTEAM.won, lv1Win: (MYTEAM.trialWins - (MYTEAM.won ? 1 : 0)) > 0, hearts: ME.hearts.count, glitches: ME.glitches, status: ME.boardStatus(), sortedWins: [...G.teams].sort((a, b) => b.trialWins - a.trialWins).map(t => t.trialWins) })');
      const s1Text = $("#stage").textContent;
      const statusOk = s1.status !== "OK" && s1Text.includes(s1.status) && !/\bOK\b/.test(s1Text);
      const attrPanel = $$("#stage .panel").find(p => p.textContent.includes("Your 5 attributes"));
      const attrText = attrPanel ? attrPanel.textContent : "";
      const attrIdx = ATTR_ORDER.map(n => attrText.indexOf(n));
      const attrOrderOk = attrIdx.every((p, i) => p >= 0 && (i === 0 || p > attrIdx[i - 1]));
      const resultsPanel = $$("#stage .panel").find(p => p.textContent.includes("Your trial results"));
      const resultsText = resultsPanel ? resultsPanel.textContent : "";
      const resultsOk = resultsText.includes(s1.lv1Win ? "WIN" : "LOSS") && resultsText.includes(s1.lv2Win ? "WIN" : "LOSS");
      const standingsWins = $$("#stage table.levels tbody tr").map(tr => parseInt(tr.children[2].textContent, 10));
      const rankedOk = standingsWins.length === s1.teams.length &&
        standingsWins.every((v, i) => i === 0 || v <= standingsWins[i - 1]) &&
        JSON.stringify(standingsWins) === JSON.stringify(s1.sortedWins);
      const hasSprint1 = s1Text.includes("Sprint 1 Complete") &&
        s1Text.includes("Level 1") && s1Text.includes("Level 2") && resultsOk &&
        s1Text.includes("Hearts: " + s1.hearts + "/3") &&
        s1Text.includes("Glitches: " + s1.glitches + "/2") &&
        statusOk && attrOrderOk &&
        s1Text.includes(s1.myTeam) && s1Text.includes(s1.wins + " / 2 trial wins") &&
        s1.teams.every(name => s1Text.includes(name)) && rankedOk &&
        !s1Text.includes("Level 3 locked") &&
        s1Text.includes("The Mirror") &&
        !!$("#nextLevel") && /Start Level 3/.test($("#nextLevel").textContent) &&
        !!$("#replay") && $("#replay").textContent.includes("Replay") &&
        !!$("#restart") && $("#restart").textContent.includes("Back to sign-in") &&
        !$("#navNext").disabled && /Start Level 3/.test($("#navNext").textContent);
      check("Sprint 1 Complete screen appears after Level 2 Stats Update with Start Level 3 unlocked", hasSprint1);
      const leaksTypeOrPath = LEAK_RE.test(s1Text);
      check("Sprint 1 Complete screen hides work style and secret path", !leaksTypeOrPath, leaksTypeOrPath ? "leaked" : "clean");
      const nextCardText = ($("#stage .locked") || {}).textContent || "";
      check("Sprint 1 Complete Level 3 card hides tested attribute before briefing", !/Focus/i.test(nextCardText));
      w.eval("ME.idle = true; render();");
      const idleText = $("#stage").textContent;
      check("Idle player shows Idle (not Active) on Sprint 1 Complete screen", idleText.includes("Idle") && !/\bActive\b/.test(idleText));
      w.eval("ME.idle = false; render();");
      if (!noOkFlags()) anyOkFlag = true;
      $("#nextLevel").click(); await sleep(30); // -> Level 3 Briefing
      check("Start Level 3 button moves into Level 3 Briefing", w.eval('G.level === 3 && G.step === "briefing" && S.step === 5'));
    } else if (lv === 3) {
      const p3 = w.eval('({ teams: G.teams.map(t => t.name), myTeam: MYTEAM.name, wins: MYTEAM.trialWins, trialResults: G.teamTrialResults(MYTEAM), standings: G.teamStandings().map(s => ({ name: s.team.name, wins: s.wins })), hearts: ME.hearts.count, glitches: ME.glitches, status: ME.boardStatus(), attrs: ["focus","collab","initiative","grit","composure"].map(k => ME.attrs[k]), total: ME.total() })');
      const p3Text = $("#stage").textContent;
      const statusOk = p3.status !== "OK" && p3Text.includes(p3.status) && !/\bOK\b/.test(p3Text);
      const attrPanel = $$("#stage .panel").find(p => p.textContent.includes("Your 5 attributes"));
      const attrText = attrPanel ? attrPanel.textContent : "";
      const attrIdx = ATTR_ORDER.map(n => attrText.indexOf(n));
      const attrOrderOk = attrIdx.every((p, i) => p >= 0 && (i === 0 || p > attrIdx[i - 1])) &&
        ATTR_ORDER.every((n, i) => attrText.includes(n) && attrText.includes(String(p3.attrs[i]))) &&
        attrText.includes("Total: " + p3.total);
      const resultsPanel = $$("#stage .panel").find(p => p.textContent.includes("Your trial results"));
      const resultRows = resultsPanel ? [...resultsPanel.querySelectorAll(".row")] : [];
      const resultsOk = resultRows.length === 3 &&
        [1, 2, 3].every((n, i) => resultRows[i].textContent.includes("Level " + n) &&
          resultRows[i].textContent.includes(p3.trialResults[n] ? "WIN" : "LOSS"));
      const standingsRows = $$("#stage table.levels tbody tr");
      const rankedOk = standingsRows.length === p3.standings.length &&
        standingsRows.every((tr, i) => tr.children[1].textContent.includes(p3.standings[i].name) &&
          tr.children[2].textContent.trim() === p3.standings[i].wins + " / 3");
      const lockedCardText = ($("#stage .locked") || {}).textContent || "";
      const hasPresComplete = p3Text.includes("Presentation Day Complete") &&
        $("#navMid").textContent === "Presentation Day Complete" &&
        $("#steps").textContent.includes("Presentation Day Complete") &&
        resultsOk &&
        p3Text.includes("Hearts: " + p3.hearts + "/3") &&
        p3Text.includes("Glitches: " + p3.glitches + "/2") &&
        statusOk && attrOrderOk &&
        p3Text.includes(p3.myTeam) && p3Text.includes(p3.wins + " / 3 trial wins") &&
        rankedOk &&
        lockedCardText.includes("Level 4 locked") &&
        !/Initiative/i.test(lockedCardText) &&
        !$("#nextLevel") &&
        !!$("#replay") && $("#replay").textContent.includes("Replay") &&
        !!$("#restart") && $("#restart").textContent.includes("Back to sign-in") &&
        $("#navNext").disabled && /Level 4 locked/.test($("#navNext").textContent);
      check("Presentation Day Complete screen appears after Level 3 Stats Update with Level 4 locked", hasPresComplete);
      const leaksTypeOrPath = LEAK_RE.test(p3Text);
      check("Presentation Day Complete screen hides work style and secret path", !leaksTypeOrPath, leaksTypeOrPath ? "leaked" : "clean");
      w.eval("ME.idle = true; render();");
      const idleText = $("#stage").textContent;
      check("Idle player shows Idle (not Active) on Presentation Day Complete screen", idleText.includes("Idle") && !/\bActive\b/.test(idleText));
      w.eval("ME.idle = false; render();");
      if (!noOkFlags()) anyOkFlag = true;
      w.eval("startNextLevel()"); await sleep(30); // -> Level 4 Briefing
    } else {
      if (!noOkFlags()) anyOkFlag = true;
      check("Level " + lv + " unlocks Level " + (lv + 1), new RegExp("Start Level " + (lv + 1)).test($("#navNext").textContent) && !$("#navNext").disabled);
      next(); await sleep(30); // -> Level lv+1 Briefing
    }
  }
  if (!noOkFlags()) anyOkFlag = true;
  check("no screen shows OK as a player status", !anyOkFlag);
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

async function mirrorStep6bCases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const STEP_LABELS = { cables: "Cables", sound: "Sound", mic: "Mic", deck: "Deck", qa: "Q&A" };
    const parseDoc = html => {
      const box = document.createElement("div");
      box.innerHTML = html;
      return {
        box,
        text: box.textContent || "",
        flags: [...box.querySelectorAll(".flag")].map(el => el.textContent.trim()),
        setupRows: [...box.querySelectorAll("[data-setup-slot]")],
        danceRows: [...box.querySelectorAll("[data-dance-player]")],
        lobbyMates: [...box.querySelectorAll("[data-lobby-player]")],
        signalBtn: box.querySelector("#mirrorSignalBtn"),
        inactiveNotice: box.querySelector("#mirrorInactiveNotice"),
        failedBox: box.querySelector("#mirrorLobbyFailed"),
      };
    };

    const advanceToLv3Trial = (game, onOpenFloor) => {
      for (let round = 1; round <= 2; round++) {
        game.startNextRound();
        game.advance(); // briefing -> openFloor
        game.advance(); // openFloor -> trial
        game.runTrial();
        game.endTrial(); // payTrialCosts -> glitchReport
        game.endGlitchReport();
        game.advance(); // glitchReport -> giftWindow
        game.advance(); // giftWindow -> lockIn
        game.lockIn();
        game.advance(); // lockIn -> statsUpdate
        game.computeEarnings();
        game.placeAllRemaining();
        game.finishRound();
      }
      game.startNextRound(); // level 3 briefing
      game.advance(); // openFloor
      if (onOpenFloor) onOpenFloor(game);
      game.advance(); // trial (starts MirrorLobby)
    };

    const makeTeam = (tid, size, { allHumans = false, startId = tid * 10 + 1 } = {}) => {
      const members = [];
      for (let i = 0; i < size; i++) {
        members.push(new EP.Player({
          id: startId + i,
          name: "T" + tid + "P" + (i + 1),
          type: "coop",
          spend: EP.Bots.typicalSpend("coop"),
          isBot: !allHumans && i > 0,
        }));
      }
      return new EP.Team({ id: tid, name: "Unit " + tid, members });
    };

    // 1a. Lobby deadline closes at 30s (2 human teams: Team 1 fails lobby, Team 2 passes) -> shown plainly on Reveal
    let tNow = 1000000;
    const t1 = makeTeam(1, 3, { allHumans: false });
    const t2 = makeTeam(2, 3, { allHumans: false });
    const t3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "Bot3_" + i, "indep")) });
    const t4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2].map(i => EP.Bots.makePlayer(41 + i, "Bot4_" + i, "contra")) });
    const gDeadline = new EP.Game({ teams: [t1, t2, t3, t4], rng: EP.Rng.seeded(101), clock: () => tNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gDeadline);
    gDeadline.start();
    // Connect Team 2's human at 1s; leave Team 1's human unconnected; advance to 29s (still open), then 30s (closed)
    tNow += 1000;
    gDeadline.tick();
    gDeadline.mirrorConnect(t2.members[0]);
    tNow += 28000; // 29s elapsed
    gDeadline.tick();
    const stillOpenAt29 = gDeadline.mirrorPhase() === "lobby";
    tNow += 1000; // exact 30s deadline
    gDeadline.tick();
    const closedAt30 = gDeadline.mirrorPhase() === "reveal" && gDeadline.mirrorFailReason(t1) === "lobby" && gDeadline.mirrorFailReason(t2) === null;
    const failRevealDom = parseDoc(MirrorView.screen({
      game: gDeadline, me: t1.members[0], team: t1, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "", onRender: () => {},
    }).html);
    const failRevealOk = !!failRevealDom.failedBox &&
      failRevealDom.text.includes("LOBBY FAILED") &&
      failRevealDom.text.includes("Score 0") &&
      failRevealDom.text.includes("doors closed with you still outside") &&
      !LEAK_RE.test(failRevealDom.text) &&
      failRevealDom.flags.every(f => f !== "OK");

    // 1b. Solo human team fails lobby at 30s deadline -> trial closes with score 0 and shows LOBBY FAILED plainly
    let sNow = 2000000;
    const st1 = makeTeam(1, 4, { allHumans: false });
    const st2 = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2, 3].map(i => EP.Bots.makePlayer(21 + i, "BotB_" + i, "coop")) });
    const st3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2, 3].map(i => EP.Bots.makePlayer(31 + i, "BotC_" + i, "indep")) });
    const st4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2, 3].map(i => EP.Bots.makePlayer(41 + i, "BotD_" + i, "contra")) });
    const gSoloFail = new EP.Game({ teams: [st1, st2, st3, st4], rng: EP.Rng.seeded(202), clock: () => sNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gSoloFail);
    gSoloFail.start();
    sNow += 30000;
    gSoloFail.tick();
    const soloFailDom = parseDoc(MirrorView.screen({
      game: gSoloFail, me: st1.members[0], team: st1, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "Cost hint", onRender: () => {},
    }).html);
    const soloFailOk = gSoloFail.didRun("runTrial") &&
      gSoloFail.mirrorFailReason(st1) === "lobby" &&
      !!soloFailDom.failedBox &&
      soloFailDom.text.includes("LOBBY FAILED") &&
      soloFailDom.text.includes("Score 0 of 7") &&
      !LEAK_RE.test(soloFailDom.text);

    // 2. Crew Reveal split and step owners for team sizes 3, 4, and 5
    const splitResults = {};
    for (const sz of [3, 4, 5]) {
      let cNow = 3000000;
      const teamA = makeTeam(1, sz, { allHumans: true });
      const teamB = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotX_" + i, "coop")) });
      const teamC = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotY_" + i, "indep")) });
      const gSz = new EP.Game({ teams: [teamA, teamB, teamC], rng: EP.Rng.seeded(300 + sz), clock: () => cNow, hooks: EP.Bots.hooks });
      advanceToLv3Trial(gSz);
      gSz.start();
      cNow += 16000;
      gSz.tick();
      for (const p of teamA.members) gSz.mirrorConnect(p);
      const view = MirrorView.screen({
        game: gSz, me: teamA.members[0], team: teamA, state: {}, attrName: "Focus",
        sabotageAlert: "", costHint: () => "", onRender: () => {},
      });
      const dom = parseDoc(view.html);
      const slots = gSz.mirrorSetupSlots(teamA);
      const crew = gSz.mirrorCrew(teamA);
      const setupNamesAndStepsOk = dom.setupRows.length === slots.length &&
        slots.every((sl, i) => {
          const rowText = dom.setupRows[i].textContent;
          const expectedSteps = sl.steps.map(k => STEP_LABELS[k]).join(", ");
          return rowText.includes(sl.name) && rowText.includes(expectedSteps);
        });
      const danceNamesOk = dom.danceRows.length === crew.danceIds.length &&
        crew.danceIds.every((pid, i) => {
          const pl = teamA.members.find(m => m.id === pid);
          return pl && dom.danceRows[i].textContent.includes(pl.name);
        });
      splitResults[sz] = {
        phase: gSz.mirrorPhase(),
        setupCount: dom.setupRows.length,
        danceCount: dom.danceRows.length,
        slotSteps: slots.map(s => s.steps.join("+")),
        setupNamesAndStepsOk,
        danceNamesOk,
        clean: !LEAK_RE.test(dom.text) && !/bot/i.test(dom.text) && dom.flags.every(f => f !== "OK"),
      };
    }

    // 3. Stuck and Idle teammates left out of lobby & reveal; boardStatus() shown (Active, At risk, Glitching)
    let fNow = 4000000;
    const fTeam = makeTeam(1, 5, { allHumans: true });
    const [pMe, pStuck, pIdle, pRisk, pGlitch] = fTeam.members;
    const fBotB = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotM_" + i, "coop")) });
    const fBotC = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotN_" + i, "contra")) });
    const gFilter = new EP.Game({ teams: [fTeam, fBotB, fBotC], rng: EP.Rng.seeded(404), clock: () => fNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gFilter, () => {
      pStuck.glitches = 2;
      pIdle.idle = true;
      pRisk.setAttrsForTest({ focus: 1, collab: 5, initiative: 5, grit: 5, composure: 5 });
      pRisk.hearts.empty();
      pGlitch.setAttrsForTest({ focus: -1, collab: 5, initiative: 5, grit: 5, composure: 5 });
    });
    gFilter.start();
    const lobbyDom = parseDoc(MirrorView.screen({
      game: gFilter, me: pMe, team: fTeam, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "", onRender: () => {},
    }).html);
    const lobbyExcludesInactive = !!lobbyDom.signalBtn &&
      lobbyDom.lobbyMates.length === 2 &&
      !lobbyDom.text.includes(pStuck.name) &&
      !lobbyDom.text.includes(pIdle.name) &&
      lobbyDom.text.includes(pRisk.name) &&
      lobbyDom.text.includes(pGlitch.name) &&
      lobbyDom.flags.includes("Active") &&
      lobbyDom.flags.includes("At risk") &&
      lobbyDom.flags.includes("Glitching") &&
      lobbyDom.flags.every(f => f !== "OK") &&
      !LEAK_RE.test(lobbyDom.text);

    fNow += 16000;
    gFilter.tick();
    gFilter.mirrorConnect(pMe);
    gFilter.mirrorConnect(pRisk);
    gFilter.mirrorConnect(pGlitch);
    const revealFilterDom = parseDoc(MirrorView.screen({
      game: gFilter, me: pMe, team: fTeam, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "", onRender: () => {},
    }).html);
    const revealExcludesInactive = gFilter.mirrorPhase() === "reveal" &&
      revealFilterDom.setupRows.length === 2 &&
      revealFilterDom.danceRows.length === 1 &&
      !revealFilterDom.text.includes(pStuck.name) &&
      !revealFilterDom.text.includes(pIdle.name) &&
      revealFilterDom.flags.includes("Active") &&
      revealFilterDom.flags.includes("At risk") &&
      revealFilterDom.flags.includes("Glitching") &&
      revealFilterDom.flags.every(f => f !== "OK") &&
      !LEAK_RE.test(revealFilterDom.text);

    // 4. Stuck ME gets no signal-grab tile and is excluded from lobby & reveal
    let msNow = 5000000;
    const msTeam = makeTeam(1, 4, { allHumans: true });
    const msMe = msTeam.members[0];
    const msBotB = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotP_" + i, "coop")) });
    const msBotC = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotQ_" + i, "indep")) });
    const gMeStuck = new EP.Game({ teams: [msTeam, msBotB, msBotC], rng: EP.Rng.seeded(505), clock: () => msNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gMeStuck, () => { msMe.glitches = 2; });
    gMeStuck.start();
    const meStuckLobbyDom = parseDoc(MirrorView.screen({
      game: gMeStuck, me: msMe, team: msTeam, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "", onRender: () => {},
    }).html);
    const meStuckLobbyOk = !meStuckLobbyDom.signalBtn &&
      !!meStuckLobbyDom.inactiveNotice &&
      meStuckLobbyDom.flags.includes("Stuck") &&
      meStuckLobbyDom.lobbyMates.length === 3 &&
      !meStuckLobbyDom.lobbyMates.some(el => el.textContent.includes(msMe.name)) &&
      !LEAK_RE.test(meStuckLobbyDom.text);
    msNow += 16000;
    gMeStuck.tick();
    for (const p of msTeam.members.slice(1)) gMeStuck.mirrorConnect(p);
    const meStuckRevealDom = parseDoc(MirrorView.screen({
      game: gMeStuck, me: msMe, team: msTeam, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "", onRender: () => {},
    }).html);
    const meStuckRevealOk = gMeStuck.mirrorPhase() === "reveal" &&
      meStuckRevealDom.setupRows.length === 2 &&
      meStuckRevealDom.danceRows.length === 1 &&
      !meStuckRevealDom.setupRows.some(el => el.textContent.includes(msMe.name)) &&
      !meStuckRevealDom.danceRows.some(el => el.textContent.includes(msMe.name)) &&
      meStuckRevealDom.text.includes("You are Stuck and not in the crews.") &&
      !LEAK_RE.test(meStuckRevealDom.text);

    return {
      stillOpenAt29,
      closedAt30,
      failRevealOk,
      soloFailOk,
      splitResults,
      lobbyExcludesInactive,
      revealExcludesInactive,
      meStuckLobbyOk,
      meStuckRevealOk,
    };
  })()`);

  check("Mirror lobby stays open before 30s and closes at 30s deadline", res.stillOpenAt29 && res.closedAt30);
  check("Lobby-failed team is shown plainly on Crew Reveal without leaks", res.failRevealOk);
  check("Solo team lobby fail at 30s deadline scores 0 and shows LOBBY FAILED plainly", res.soloFailOk);
  check(
    "Crew Reveal size 3 splits 2 Setup (Cables, Sound, Mic; Deck, Q&A) and 1 Dance",
    res.splitResults[3].phase === "reveal" && res.splitResults[3].setupCount === 2 && res.splitResults[3].danceCount === 1 &&
      JSON.stringify(res.splitResults[3].slotSteps) === '["cables+sound+mic","deck+qa"]' &&
      res.splitResults[3].setupNamesAndStepsOk && res.splitResults[3].danceNamesOk && res.splitResults[3].clean
  );
  check(
    "Crew Reveal size 4 splits 2 Setup (Cables, Sound, Mic; Deck, Q&A) and 2 Dance",
    res.splitResults[4].phase === "reveal" && res.splitResults[4].setupCount === 2 && res.splitResults[4].danceCount === 2 &&
      JSON.stringify(res.splitResults[4].slotSteps) === '["cables+sound+mic","deck+qa"]' &&
      res.splitResults[4].setupNamesAndStepsOk && res.splitResults[4].danceNamesOk && res.splitResults[4].clean
  );
  check(
    "Crew Reveal size 5 splits 3 Setup (Cables, Sound; Mic, Deck; Q&A) and 2 Dance",
    res.splitResults[5].phase === "reveal" && res.splitResults[5].setupCount === 3 && res.splitResults[5].danceCount === 2 &&
      JSON.stringify(res.splitResults[5].slotSteps) === '["cables+sound","mic+deck","qa"]' &&
      res.splitResults[5].setupNamesAndStepsOk && res.splitResults[5].danceNamesOk && res.splitResults[5].clean
  );
  check("Stuck and Idle teammates are excluded from Mirror lobby and boardStatus() shows", res.lobbyExcludesInactive);
  check("Stuck and Idle teammates are excluded from Crew Reveal and boardStatus() shows", res.revealExcludesInactive);
  check("Stuck player sees no signal-grab tile and is excluded from lobby and Crew Reveal", res.meStuckLobbyOk && res.meStuckRevealOk);
}

async function mirrorStep6c1Cases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const HARDCODED_TEAMS_RE = /Team Kestrel|Team Wren|Team Finch|Team Heron/i;

    const advanceToLv3Trial = (game, onOpenFloor) => {
      for (let round = 1; round <= 2; round++) {
        game.startNextRound();
        game.advance();
        game.advance();
        game.runTrial();
        game.endTrial();
        game.endGlitchReport();
        game.advance();
        game.advance();
        game.lockIn();
        game.advance();
        game.computeEarnings();
        game.placeAllRemaining();
        game.finishRound();
      }
      game.startNextRound();
      game.advance();
      if (onOpenFloor) onOpenFloor(game);
      game.advance();
    };

    const makeTeam = (tid, size, { allHumans = false, startId = tid * 10 + 1 } = {}) => {
      const members = [];
      for (let i = 0; i < size; i++) {
        members.push(new EP.Player({
          id: startId + i,
          name: "T" + tid + "P" + (i + 1),
          type: "coop",
          spend: EP.Bots.typicalSpend("coop"),
          isBot: !allHumans && i > 0,
        }));
      }
      return new EP.Team({ id: tid, name: "Unit " + tid, members });
    };

    const enterShowtime = (size, { allHumans = true, seed = 610 + size, onOpenFloor = null } = {}) => {
      let simNow = 7000000 + size * 10000;
      const t1 = makeTeam(1, size, { allHumans });
      const t2 = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotB_" + i, "coop")) });
      const t3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotC_" + i, "indep")) });
      const t4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2].map(i => EP.Bots.makePlayer(41 + i, "BotD_" + i, "contra")) });
      const game = new EP.Game({ teams: [t1, t2, t3, t4], rng: EP.Rng.seeded(seed), clock: () => simNow, hooks: EP.Bots.hooks });
      advanceToLv3Trial(game, onOpenFloor);
      game.start();
      simNow += 16000;
      game.tick();
      for (const p of t1.active()) game.mirrorConnect(p);
      simNow = game.timer.deadline;
      game.tick();
      return { game, team: t1, getNow: () => simNow, advanceMs: ms => { simNow += ms; game.tick(); } };
    };

    const mountView = (game, me, team, state = {}) => {
      const box = document.createElement("div");
      let curView = null;
      const renderMount = () => {
        if (curView && curView.cleanup) curView.cleanup();
        curView = MirrorView.screen({
          game, me, team, state, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost hint", onRender: renderMount,
        });
        box.innerHTML = curView.html;
        if (curView.bind) curView.bind(box);
      };
      renderMount();
      return {
        box,
        state,
        render: renderMount,
        tick: () => { if (curView && curView.tick) curView.tick(); },
        cleanup: () => { if (curView && curView.cleanup) curView.cleanup(); },
        text: () => box.textContent || "",
        q: s => box.querySelector(s),
        qa: s => [...box.querySelectorAll(s)],
        flags: () => [...box.querySelectorAll(".flag")].map(el => el.textContent.trim()),
      };
    };

    // 1. Setup Crew frame shows the right 5 steps & owners for 1, 2, and 3 Setup players + live team names
    const checkSplitFrame = (size, expectedCount, onOpenFloor = null) => {
      const ctx = enterShowtime(size, { allHumans: true, onOpenFloor });
      const slots = ctx.game.mirrorSetupSlots(ctx.team);
      const ownerPlayer = ctx.team.members.find(p => p.id === slots[0].playerId);
      const v = mountView(ctx.game, ownerPlayer, ctx.team);
      const rows = v.qa("[data-setup-step]");
      const stepOrder = rows.map(r => r.dataset.setupStep);
      const ownersMatch = rows.every(r => {
        const step = r.dataset.setupStep;
        const slot = slots.find(s => s.steps.includes(step));
        return slot && r.dataset.stepOwner === String(slot.playerId) && r.textContent.includes(slot.name);
      });
      const statesOk = rows[0].dataset.stepState === "live" && rows.slice(1).every(r => r.dataset.stepState === "waiting");
      const text = v.text();
      return {
        ctx,
        v,
        slots,
        ok: slots.length === expectedCount &&
          JSON.stringify(stepOrder) === '["cables","sound","mic","deck","qa"]' &&
          ownersMatch &&
          statesOk &&
          !HARDCODED_TEAMS_RE.test(text) &&
          !LEAK_RE.test(text) &&
          !/bot/i.test(text) &&
          v.flags().every(f => f !== "OK"),
      };
    };

    const split1 = checkSplitFrame(3, 1, g => {
      const m = g.teams[0].members;
      m[1].glitches = 2;
      m[2].glitches = 2;
    });
    const split1ZeroDancersOk = split1.v.text().includes("Dance Crew (0)");

    const split2 = checkSplitFrame(4, 2);
    const split2DanceOk = split2.v.text().includes("Dance Crew (2)");

    const split3 = checkSplitFrame(5, 3);
    const { game: g3, team: team3 } = split3.ctx;
    const slots3 = split3.slots;
    const s0 = team3.members.find(p => p.id === slots3[0].playerId);
    const s1 = team3.members.find(p => p.id === slots3[1].playerId);
    const s2 = team3.members.find(p => p.id === slots3[2].playerId);
    const d0 = team3.members.find(p => g3.mirrorRole(p) === "dance");

    // 2. Cables owner-only view + waiting view for non-owner
    const v0 = split3.v;
    const v1 = mountView(g3, s1, team3);
    const cablesOwnerGateOk = !!v0.q("#mirrorCablesStep") && !v0.q("#mirrorWaitingView") && !v0.q("#mirrorSoundStep") &&
      v0.qa("[data-cable-port]").every(btn => !HARDCODED_TEAMS_RE.test(btn.textContent));
    const cablesWaitGateOk = !v1.q("#mirrorCablesStep") && !v1.q("#mirrorSoundStep") && !!v1.q("#mirrorWaitingView") &&
      v1.q("#mirrorWaitingView").textContent.includes(s0.name) &&
      v1.q("#mirrorWaitingView").textContent.includes("Cables") &&
      v1.q("#mirrorWaitProgress").textContent.includes("0 of 4");

    // 3. Cables miss (spark) and hits report to rules, update waiting view & frame
    const attBeforeSpark = g3.mirrorAttention(team3);
    v0.q('[data-cable-port="HDMI"]').click();
    const stAfterSpark = g3.mirrorSetupTeam(team3);
    const attAfterSpark = g3.mirrorAttention(team3);
    const cablesMissOk = stAfterSpark.cables.sparks === 1 &&
      stAfterSpark.penalties === 3 &&
      attAfterSpark === attBeforeSpark - 3 &&
      v0.q("#mirrorMsg").textContent.includes("Spark") &&
      v0.q("#mirrorMsg").textContent.includes("3");

    let waitUpdatedOnFirstCable = false;
    for (let k = 0; k < 200; k++) {
      const st = g3.mirrorSetupTeam(team3);
      if (!st || st.currentStep !== "cables") break;
      const inFrame = v0.q('[data-cable-item][data-in-frame="1"]');
      if (inFrame) {
        const port = inFrame.dataset.cableItem;
        const btn = v0.q('[data-cable-port="' + port + '"]');
        if (btn && !btn.disabled) {
          btn.click();
          if (g3.mirrorSetupTeam(team3).cables.connected.length === 1) {
            v1.render();
            waitUpdatedOnFirstCable = v1.q("#mirrorWaitProgress").textContent.includes("1 of 4");
          }
          continue;
        }
      }
      v0.tick();
    }
    const stAfterCables = g3.mirrorSetupTeam(team3);
    const cablesDoneFrameOk = stAfterCables.completedSteps.includes("cables") &&
      stAfterCables.currentStep === "sound" &&
      stAfterCables.currentPlayerId === s0.id &&
      v0.q('[data-setup-step="cables"]').dataset.stepState === "done" &&
      v0.q('[data-setup-step="sound"]').dataset.stepState === "live" &&
      !v0.q("#mirrorCablesStep") &&
      !!v0.q("#mirrorSoundStep");

    // Sound owner-only & waiting view
    v1.render();
    const soundGateOk = !v1.q("#mirrorSoundStep") && !!v1.q("#mirrorWaitingView") &&
      v1.q("#mirrorWaitingView").textContent.includes(s0.name) &&
      v1.q("#mirrorWaitingView").textContent.includes("Sound");

    // 4. Sound feedback miss + 3s hold hit + handoff to Slot 1
    for (let k = 0; k < 10; k++) {
      if (g3.mirrorSetupTeam(team3).sound.feedbacks >= 1) break;
      v0.q('[data-sound-gain="10"]').click();
    }
    const stAfterFeedback = g3.mirrorSetupTeam(team3);
    const soundMissOk = stAfterFeedback.sound.feedbacks === 1 &&
      stAfterFeedback.penalties === 7 &&
      v0.q("#soundVal").textContent === "45" &&
      v0.q("#holdN").textContent.includes("0.0s") &&
      v0.q("#mirrorMsg").textContent.includes("FEEDBACK") &&
      v0.q("#mirrorMsg").textContent.includes("4");

    for (let k = 0; k < 400; k++) {
      const st = g3.mirrorSetupTeam(team3);
      if (!st || st.currentStep !== "sound") break;
      const lvl = Number((v0.q("#soundVal") || {}).textContent || 45);
      if (lvl < 74) {
        v0.q('[data-sound-gain="' + (lvl <= 68 ? "10" : "5") + '"]').click();
      } else if (lvl > 85) {
        v0.q('[data-sound-gain="-10"]').click();
      }
      split3.ctx.advanceMs(250);
      v0.tick();
    }
    const stAfterSound = g3.mirrorSetupTeam(team3);
    v0.render();
    v1.render();
    const soundDoneAndHandoffOk = stAfterSound.sound.locked === true &&
      stAfterSound.completedSteps.includes("sound") &&
      stAfterSound.currentStep === "mic" &&
      stAfterSound.currentPlayerId === s1.id &&
      !v0.q("#mirrorSoundStep") &&
      !!v0.q("#mirrorWaitingView") &&
      v0.q("#mirrorWaitingView").textContent.includes(s1.name) &&
      v0.q("#mirrorWaitingView").textContent.includes("Mic") &&
      v0.q('[data-setup-step="sound"]').dataset.stepState === "done" &&
      v0.q('[data-setup-step="mic"]').dataset.stepState === "live" &&
      !!v1.q('#mirrorMicStep');

    // Dance Crew sees Step 6d rhythm lane during showtime
    const vDance = mountView(g3, d0, team3);
    const danceLaneMountedOk = !!vDance.q("#mirrorDancePanel") &&
      !!vDance.q("#lane") &&
      !vDance.q("#mirrorDancePlaceholder") &&
      !!vDance.q("#attnBar") &&
      !!vDance.q("#mirrorSetupFrame") &&
      !vDance.q("#mirrorCablesStep") &&
      !vDance.q("#mirrorSoundStep") &&
      !vDance.q("#mirrorMicStep") &&
      !vDance.q("#mirrorDeckStep") &&
      !vDance.q("#mirrorQaStep") &&
      !vDance.q("#mirrorWrapUpStep") &&
      !LEAK_RE.test(vDance.text()) &&
      !/bot/i.test(vDance.text()) &&
      vDance.flags().every(f => f !== "OK");
    vDance.cleanup();

    // 5. Real mic, deck, Q&A, and wrapUp steps complete Level 3 across slots
    for (let k = 0; k < 100; k++) {
      const st = g3.mirrorSetupTeam(team3);
      if (!st || st.currentStep !== "mic") break;
      for (let f = 0; f < 25; f++) {
        const disp = v1.q("#micSeqDisp");
        if (disp && disp.dataset.flashing === "0") break;
        split3.ctx.advanceMs(250);
        v1.tick();
      }
      const curSt = g3.mirrorSetupTeam(team3);
      v1.q('[data-mic="' + curSt.mic.sequence[curSt.mic.index] + '"]').click();
    }
    const afterMicStep = g3.mirrorSetupTeam(team3).currentStep;
    const deckStepOk = afterMicStep === "deck" && !!v1.q("#mirrorDeckStep");
    const signedIdx = EP.MirrorData.files.findIndex(f => f.correct);
    v1.q('[data-file="' + signedIdx + '"]').click(); // deck -> qa (hands off to s2)
    const afterDeckSt = g3.mirrorSetupTeam(team3);
    const v2 = mountView(g3, s2, team3);
    const qaHandoffOk = afterDeckSt.currentStep === "qa" && afterDeckSt.currentPlayerId === s2.id &&
      !!v1.q("#mirrorWaitingView") && v1.q("#mirrorWaitingView").textContent.includes(s2.name) &&
      !!v2.q("#mirrorQaStep");
    for (let k = 0; k < 5; k++) {
      const st = g3.mirrorSetupTeam(team3);
      if (!st || st.currentStep !== "qa") break;
      const item = EP.MirrorData.qaItems[st.qa.order[st.qa.index]];
      v2.q('[data-qa="' + item.correctIndex + '"]').click();
    }
    const wrapStepOk = g3.mirrorSetupTeam(team3).currentStep === "wrapUp" && !!v2.q("#mirrorWrapUpStep") && !!v2.q("#wrapUp");
    v2.q("#wrapUp").click(); // wrapUp -> closes trial
    const placeholderFlowEndOk = g3.didRun("runTrial") &&
      /Score \\d+ of 7/.test(v2.text()) &&
      !LEAK_RE.test(v2.text()) &&
      !/bot/i.test(v2.text());

    // 6. Bot-owned step runs & bot hiccup shows its attention cost
    let botCase = null;
    for (let seed = 1; seed <= 80; seed++) {
      const ctx = enterShowtime(4, { allHumans: false, seed });
      const st0 = ctx.game.mirrorSetupTeam(ctx.team);
      const human = ctx.team.members[0];
      if (!st0 || st0.slots.length < 2 || !st0.slots[0].isBot || st0.slots[1].playerId !== human.id) continue;
      const probeGame = EP.Game.fromJSON(ctx.game.toJSON(), { clock: ctx.getNow, hooks: EP.Bots.hooks });
      ctx.advanceMs(4000);
      const stAt4 = ctx.game.mirrorSetupTeam(ctx.team);
      if (stAt4 && stAt4.completedSteps.includes("cables") && stAt4.botHiccups >= 1) {
        // Rewind to t=1s using probeGame so we can mount screen before t=4s and observe live tick()
        let pNow = ctx.getNow() - 4000;
        const pTeam = probeGame.teams[0];
        const pHuman = pTeam.members[0];
        probeGame._timer.clock = () => pNow;
        pNow += 1000;
        probeGame.tick();
        const vBotWait = mountView(probeGame, pHuman, pTeam);
        const beforeBotWaitOk = !!vBotWait.q("#mirrorWaitingView") &&
          vBotWait.q("#mirrorWaitingView").textContent.includes(st0.slots[0].name) &&
          vBotWait.q('[data-setup-step="cables"]').dataset.stepState === "live" &&
          !vBotWait.q("#mirrorSetupHiccups") &&
          !/bot/i.test(vBotWait.text());
        pNow += 3000;
        probeGame.tick();
        vBotWait.tick();
        const stAfterBot = probeGame.mirrorSetupTeam(pTeam);
        const botText = vBotWait.text();
        const hiccupEl = vBotWait.q("#mirrorSetupHiccups");
        const msgEl = vBotWait.q("#mirrorMsg");
        botCase = {
          beforeBotWaitOk,
          stepAdvanced: stAfterBot.completedSteps.includes("cables") && stAfterBot.currentStep === "sound",
          hiccupInRules: stAfterBot.botHiccups === 1 && stAfterBot.penalties === 3,
          frameUpdated: vBotWait.q('[data-setup-step="cables"]').dataset.stepState === "done" &&
            vBotWait.q('[data-setup-step="sound"]').dataset.stepState === "live",
          hiccupCostShown: !!hiccupEl && hiccupEl.textContent.includes("3") &&
            !!msgEl && msgEl.textContent.includes("after a hiccup") && msgEl.textContent.includes("3"),
          noBotWordOrLeaks: !/bot/i.test(botText) && !LEAK_RE.test(botText) && vBotWait.flags().every(f => f !== "OK"),
        };
        break;
      }
    }

    return {
      split1Ok: split1.ok && split1ZeroDancersOk,
      split2Ok: split2.ok && split2DanceOk,
      split3Ok: split3.ok,
      cablesOwnerGateOk,
      cablesWaitGateOk,
      cablesMissOk,
      waitUpdatedOnFirstCable,
      cablesDoneFrameOk,
      soundGateOk,
      soundMissOk,
      soundDoneAndHandoffOk,
      danceLaneMountedOk,
      deckStepOk,
      qaHandoffOk,
      wrapStepOk,
      placeholderFlowEndOk,
      botCase,
    };
  })()`);

  check("Setup Crew frame shows right 5 step owners for 1 Setup player without leaks or hardcoded teams", res.split1Ok);
  check("Setup Crew frame shows right 5 step owners for 2 Setup players without leaks or hardcoded teams", res.split2Ok);
  check("Setup Crew frame shows right 5 step owners for 3 Setup players without leaks or hardcoded teams", res.split3Ok);
  check("Cables screen shows only for its owner and non-owners see waiting view with progress", res.cablesOwnerGateOk && res.cablesWaitGateOk);
  check("Cables miss reports spark penalty to rules and updates attention bar", res.cablesMissOk);
  check("Cables hits report to rules, update waiting progress, and advance frame to Sound", res.waitUpdatedOnFirstCable && res.cablesDoneFrameOk);
  check("Sound screen shows only for its owner and non-owners see waiting view", res.soundGateOk);
  check("Sound feedback miss reports penalty to rules and resets hold timer", res.soundMissOk);
  check("Sound 3s hold reports lock to rules and hands off to next owner", res.soundDoneAndHandoffOk);
  check("Dance Crew player sees Step 6d rhythm lane during showtime without leaks", res.danceLaneMountedOk);
  check("Mic, deck, Q&A, and wrapUp steps keep Setup flow going to end of Level 3", res.deckStepOk && res.qaHandoffOk && res.wrapStepOk && res.placeholderFlowEndOk);
  check(
    "Bot-owned setup step runs on schedule and bot hiccup shows its attention cost without bot tag",
    !!res.botCase && res.botCase.beforeBotWaitOk && res.botCase.stepAdvanced && res.botCase.hiccupInRules &&
      res.botCase.frameUpdated && res.botCase.hiccupCostShown && res.botCase.noBotWordOrLeaks
  );
}

async function mirrorStep6c2Cases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const HARDCODED_TEAMS_RE = /Team Kestrel|Team Wren|Team Finch|Team Heron/i;

    const advanceToLv3Trial = (game, onOpenFloor) => {
      for (let round = 1; round <= 2; round++) {
        game.startNextRound();
        game.advance();
        game.advance();
        game.runTrial();
        game.endTrial();
        game.endGlitchReport();
        game.advance();
        game.advance();
        game.lockIn();
        game.advance();
        game.computeEarnings();
        game.placeAllRemaining();
        game.finishRound();
      }
      game.startNextRound();
      game.advance();
      if (onOpenFloor) onOpenFloor(game);
      game.advance();
    };

    const finishLv3Round = game => {
      game.endTrial();
      game.endGlitchReport();
      game.advance();
      game.advance();
      game.lockIn();
      game.advance();
      game.computeEarnings();
      game.placeAllRemaining();
      game.finishRound();
    };

    const makeTeam = (tid, size, { allHumans = false, startId = tid * 10 + 1 } = {}) => {
      const members = [];
      for (let i = 0; i < size; i++) {
        members.push(new EP.Player({
          id: startId + i,
          name: "T" + tid + "P" + (i + 1),
          type: "coop",
          spend: EP.Bots.typicalSpend("coop"),
          isBot: !allHumans && i > 0,
        }));
      }
      return new EP.Team({ id: tid, name: "Unit " + tid, members });
    };

    const enterShowtime = (size, { allHumans = true, seed = 620 + size, onOpenFloor = null } = {}) => {
      let simNow = 8000000 + size * 10000;
      const t1 = makeTeam(1, size, { allHumans });
      const t2 = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotB_" + i, "coop")) });
      const t3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotC_" + i, "indep")) });
      const t4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2].map(i => EP.Bots.makePlayer(41 + i, "BotD_" + i, "contra")) });
      const game = new EP.Game({ teams: [t1, t2, t3, t4], rng: EP.Rng.seeded(seed), clock: () => simNow, hooks: EP.Bots.hooks });
      advanceToLv3Trial(game, onOpenFloor);
      game.start();
      simNow += 16000;
      game.tick();
      for (const p of t1.active()) game.mirrorConnect(p);
      simNow = game.timer.deadline;
      game.tick();
      return { game, team: t1, getNow: () => simNow, advanceMs: ms => { simNow += ms; game.tick(); } };
    };

    const mountView = (game, me, team, state = {}) => {
      const box = document.createElement("div");
      let curView = null;
      const renderMount = () => {
        if (curView && curView.cleanup) curView.cleanup();
        curView = MirrorView.screen({
          game, me, team, state, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost hint", onRender: renderMount,
        });
        box.innerHTML = curView.html;
        if (curView.bind) curView.bind(box);
      };
      renderMount();
      return {
        box,
        state,
        render: renderMount,
        tick: () => { if (curView && curView.tick) curView.tick(); },
        cleanup: () => { if (curView && curView.cleanup) curView.cleanup(); },
        text: () => box.textContent || "",
        q: s => box.querySelector(s),
        qa: s => [...box.querySelectorAll(s)],
        flags: () => [...box.querySelectorAll(".flag")].map(el => el.textContent.trim()),
      };
    };

    const passCablesAndSoundViaRules = (game, team) => {
      const st0 = game.mirrorSetupTeam(team);
      const owner0 = team.members.find(p => p.id === st0.currentPlayerId);
      for (const port of EP.MirrorData.ports) game.mirrorCableHit(owner0, port);
      game.mirrorSoundHeld(owner0);
    };

    const passMicAndDeckViaRules = (game, team, ctx = null) => {
      for (let guard = 0; guard < 20; guard++) {
        const st = game.mirrorSetupTeam(team);
        if (!st || st.currentStep !== "mic") break;
        if (st.mic.flashing && ctx && st.mic.hideAt !== null) {
          ctx.advanceMs(Math.max(0, st.mic.hideAt - ctx.getNow()));
        }
        const owner = team.members.find(p => p.id === st.currentPlayerId);
        game.mirrorMicTap(owner, st.mic.sequence[st.mic.index]);
      }
      const stDeck = game.mirrorSetupTeam(team);
      if (stDeck && stDeck.currentStep === "deck") {
        const owner = team.members.find(p => p.id === stDeck.currentPlayerId);
        const signed = EP.MirrorData.files.findIndex(f => f.correct);
        game.mirrorPickFile(owner, signed);
      }
    };

    // 1. Seeded content determinism (same seed -> identical mic sequence, deck order & reshuffle, Q&A question & options)
    const ctxA = enterShowtime(4, { allHumans: true, seed: 777 });
    const ctxB = enterShowtime(4, { allHumans: true, seed: 777 });
    passCablesAndSoundViaRules(ctxA.game, ctxA.team);
    passCablesAndSoundViaRules(ctxB.game, ctxB.team);
    const slot0A = ctxA.team.members.find(p => p.id === ctxA.game.mirrorSetupTeam(ctxA.team).currentPlayerId);
    const slot0B = ctxB.team.members.find(p => p.id === ctxB.game.mirrorSetupTeam(ctxB.team).currentPlayerId);
    const vMicA = mountView(ctxA.game, slot0A, ctxA.team);
    const vMicB = mountView(ctxB.game, slot0B, ctxB.team);
    const stMicA = ctxA.game.mirrorSetupTeam(ctxA.team);
    const stMicB = ctxB.game.mirrorSetupTeam(ctxB.team);
    const seededMicMatchOk = vMicA.q("#micSeqDisp").textContent === vMicB.q("#micSeqDisp").textContent &&
      vMicA.q("#micSeqDisp").textContent === stMicA.mic.sequence.join(" · ") &&
      JSON.stringify(stMicA.mic.sequence) === JSON.stringify(stMicB.mic.sequence);

    const driveMicClean = (game, team, view, advanceMs) => {
      for (let guard = 0; guard < 120; guard++) {
        const st = game.mirrorSetupTeam(team);
        if (!st || st.currentStep !== "mic") break;
        for (let t = 0; t < 25; t++) {
          const disp = view.q("#micSeqDisp");
          if (disp && disp.dataset.flashing === "0") break;
          advanceMs(250);
          view.tick();
        }
        const cur = game.mirrorSetupTeam(team);
        view.q('[data-mic="' + cur.mic.sequence[cur.mic.index] + '"]').click();
      }
    };
    driveMicClean(ctxA.game, ctxA.team, vMicA, ctxA.advanceMs);
    driveMicClean(ctxB.game, ctxB.team, vMicB, ctxB.advanceMs);

    const slot1A = ctxA.team.members.find(p => p.id === ctxA.game.mirrorSetupTeam(ctxA.team).currentPlayerId);
    const slot1B = ctxB.team.members.find(p => p.id === ctxB.game.mirrorSetupTeam(ctxB.team).currentPlayerId);
    const vDeckA = mountView(ctxA.game, slot1A, ctxA.team);
    const vDeckB = mountView(ctxB.game, slot1B, ctxB.team);
    const domOrderA0 = vDeckA.qa("[data-file]").map(b => Number(b.dataset.file));
    const domOrderB0 = vDeckB.qa("[data-file]").map(b => Number(b.dataset.file));
    const stDeckA0 = ctxA.game.mirrorSetupTeam(ctxA.team);
    const stDeckB0 = ctxB.game.mirrorSetupTeam(ctxB.team);
    const deckInitialMatchOk = JSON.stringify(domOrderA0) === JSON.stringify(domOrderB0) &&
      JSON.stringify(domOrderA0) === JSON.stringify(stDeckA0.deck.fileOrder) &&
      JSON.stringify(stDeckA0.deck.fileOrder) === JSON.stringify(stDeckB0.deck.fileOrder) &&
      vDeckA.qa("[data-file]").every((b, idx) => b.textContent === EP.MirrorData.files[domOrderA0[idx]].name);

    for (let t = 0; t < EP.MirrorData.deck.reshuffleTicks; t++) {
      ctxA.advanceMs(250);
      vDeckA.tick();
      ctxB.advanceMs(250);
      vDeckB.tick();
    }
    const domOrderA1 = vDeckA.qa("[data-file]").map(b => Number(b.dataset.file));
    const domOrderB1 = vDeckB.qa("[data-file]").map(b => Number(b.dataset.file));
    const stDeckA1 = ctxA.game.mirrorSetupTeam(ctxA.team);
    const deckReshuffleMatchOk = stDeckA1.deck.reshuffles === 1 &&
      JSON.stringify(domOrderA1) === JSON.stringify(domOrderB1) &&
      JSON.stringify(domOrderA1) === JSON.stringify(stDeckA1.deck.fileOrder);

    const signedIdx = EP.MirrorData.files.findIndex(f => f.correct);
    vDeckA.q('[data-file="' + signedIdx + '"]').click();
    vDeckB.q('[data-file="' + signedIdx + '"]').click();
    const stQaA = ctxA.game.mirrorSetupTeam(ctxA.team);
    const stQaB = ctxB.game.mirrorSetupTeam(ctxB.team);
    const qaItem0 = EP.MirrorData.qaItems[stQaA.qa.order[0]];
    const qaMatchOk = JSON.stringify(stQaA.qa.order) === JSON.stringify(stQaB.qa.order) &&
      vDeckA.q("#qaQuestion").textContent === vDeckB.q("#qaQuestion").textContent &&
      vDeckA.q("#qaQuestion").textContent === qaItem0.question &&
      JSON.stringify(vDeckA.qa("[data-qa]").map(b => b.querySelector("span:last-child").textContent)) ===
        JSON.stringify(qaItem0.options);
    const seededContentOk = seededMicMatchOk && deckInitialMatchOk && deckReshuffleMatchOk && qaMatchOk;

    // 2. Detailed Mic, Deck, Q&A, Wrap Up behavior on a 3-Setup team (owner gating, penalties, recoveries, timers)
    const ctx3 = enterShowtime(5, { allHumans: true, seed: 825 });
    const g3 = ctx3.game, team3 = ctx3.team;
    g3.hooks = {};
    for (const p of team3.members) {
      if (g3.mirrorRole(p) === "dance") p.idle = true;
    }
    const slots3 = g3.mirrorSetupSlots(team3);
    const s0 = team3.members.find(p => p.id === slots3[0].playerId);
    const s1 = team3.members.find(p => p.id === slots3[1].playerId);
    const s2 = team3.members.find(p => p.id === slots3[2].playerId);
    const d0 = team3.members.find(p => g3.mirrorRole(p) === "dance");
    passCablesAndSoundViaRules(g3, team3);

    const v0 = mountView(g3, s0, team3);
    const v1 = mountView(g3, s1, team3);
    const v2 = mountView(g3, s2, team3);
    const vD = mountView(g3, d0, team3);

    const micOwnerGateOk = !!v1.q("#mirrorMicStep") && !v1.q("#mirrorWaitingView") &&
      !v0.q("#mirrorMicStep") && !!v0.q("#mirrorWaitingView") &&
      v0.q("#mirrorWaitingView").textContent.includes(s1.name) &&
      v0.q("#mirrorWaitingView").textContent.includes("Mic") &&
      !v2.q("#mirrorMicStep") && !!v2.q("#mirrorWaitingView") &&
      !!vD.q("#mirrorDancePanel") && !!vD.q("#lane") && !vD.q("#mirrorMicStep");
    vD.cleanup();

    // Flash lasts 9 ticks on round 1, then hides behind ? and enables buttons
    const seqR0 = g3.mirrorSetupTeam(team3).mic.sequence;
    const micFlashInitialOk = v1.q("#micSeqDisp").dataset.flashing === "1" &&
      v1.q("#micSeqDisp").textContent === seqR0.join(" · ") &&
      v1.qa("[data-mic]").every(b => b.disabled);
    for (let t = 0; t < EP.MirrorData.mic.flashRound1Ticks - 1; t++) { ctx3.advanceMs(250); v1.tick(); }
    const stillFlashingAt8 = v1.q("#micSeqDisp").dataset.flashing === "1" && v1.qa("[data-mic]").every(b => b.disabled);
    ctx3.advanceMs(250);
    v1.tick();
    const micHiddenAt9Ok = v1.q("#micSeqDisp").dataset.flashing === "0" &&
      v1.q("#micSeqDisp").textContent.includes("?") &&
      v1.qa("[data-mic]").every(b => !b.disabled);

    // Deliberate wrong mic tap (-4 attention, flashes new sequence for 6 + 3 = 9 ticks)
    const wrongMicNum = (seqR0[0] % EP.MirrorData.mic.count) + 1;
    const attBeforeMicMiss = g3.mirrorAttention(team3);
    v1.q('[data-mic="' + wrongMicNum + '"]').click();
    const stAfterMicMiss = g3.mirrorSetupTeam(team3);
    const attAfterMicMiss = g3.mirrorAttention(team3);
    const micWrongOk = stAfterMicMiss.mic.wrongs === 1 &&
      stAfterMicMiss.penalties === EP.MirrorData.mic.wrongPenalty &&
      attAfterMicMiss === attBeforeMicMiss - EP.MirrorData.mic.wrongPenalty &&
      v1.q("#attnPct").textContent === Math.round(attAfterMicMiss) + "%" &&
      v1.q("#micSeqDisp").dataset.flashing === "1" &&
      v1.qa("[data-mic]").every(b => b.disabled) &&
      v1.q("#mirrorMsg").textContent.includes("Feedback squeal") &&
      v1.q("#mirrorMsg").textContent.includes("4");

    // Retry flash duration is 6 + len (9 ticks)
    for (let t = 0; t < EP.MirrorData.mic.flashBaseTicks + 3 - 1; t++) { ctx3.advanceMs(250); v1.tick(); }
    const retryStillFlashing = v1.q("#micSeqDisp").dataset.flashing === "1";
    ctx3.advanceMs(250);
    v1.tick();
    const retryHiddenOk = v1.q("#micSeqDisp").dataset.flashing === "0";

    // Right first tap marks .done and updates waiting view
    const seqRetry = g3.mirrorSetupTeam(team3).mic.sequence;
    v1.q('[data-mic="' + seqRetry[0] + '"]').click();
    v0.render();
    const micHitAndWaitOk = g3.mirrorSetupTeam(team3).mic.index === 1 &&
      v1.q('[data-mic="' + seqRetry[0] + '"]').classList.contains("done") &&
      v1.q("#micProgress").textContent.includes("1 of 3") &&
      v0.q("#mirrorWaitProgress").textContent.includes("1 of 3");

    // Complete remaining mic rounds (lengths 3, 4, 5)
    driveMicClean(g3, team3, v1, ctx3.advanceMs);
    const stAfterMicDone = g3.mirrorSetupTeam(team3);
    v0.render();
    v2.render();
    const micDoneFrameOk = stAfterMicDone.completedSteps.includes("mic") &&
      stAfterMicDone.currentStep === "deck" &&
      stAfterMicDone.currentPlayerId === s1.id &&
      v1.q('[data-setup-step="mic"]').dataset.stepState === "done" &&
      v1.q('[data-setup-step="deck"]').dataset.stepState === "live" &&
      !!v1.q("#mirrorDeckStep") &&
      !v0.q("#mirrorDeckStep") && !!v0.q("#mirrorWaitingView") && v0.q("#mirrorWaitingView").textContent.includes("Deck") &&
      !v2.q("#mirrorDeckStep") && !!v2.q("#mirrorWaitingView");

    // Deck auto-reshuffle after 8 ticks, wrong file (-6 + 2-tick spite reshuffle), right file -> Q&A handoff to s2
    for (let t = 0; t < EP.MirrorData.deck.reshuffleTicks - 1; t++) { ctx3.advanceMs(250); v1.tick(); }
    const noReshuffleAt7 = g3.mirrorSetupTeam(team3).deck.reshuffles === 0;
    ctx3.advanceMs(250);
    v1.tick();
    const stAfterAutoShuffle = g3.mirrorSetupTeam(team3);
    const deckAutoShuffleOk = noReshuffleAt7 && stAfterAutoShuffle.deck.reshuffles === 1 &&
      JSON.stringify(v1.qa("[data-file]").map(b => Number(b.dataset.file))) === JSON.stringify(stAfterAutoShuffle.deck.fileOrder);

    const wrongFileIdx = EP.MirrorData.files.findIndex(f => !f.correct);
    const attBeforeDeckMiss = g3.mirrorAttention(team3);
    v1.q('[data-file="' + wrongFileIdx + '"]').click();
    const stAfterDeckMiss = g3.mirrorSetupTeam(team3);
    const attAfterDeckMiss = g3.mirrorAttention(team3);
    v0.render();
    const wrongBtn = v1.q('[data-file="' + wrongFileIdx + '"]');
    ctx3.advanceMs(250);
    v1.tick();
    const noSpiteShuffleAt1 = g3.mirrorSetupTeam(team3).deck.reshuffles === 1;
    ctx3.advanceMs(250);
    v1.tick();
    const stAfterSpite = g3.mirrorSetupTeam(team3);
    const deckWrongOk = stAfterDeckMiss.deck.filesTried.includes(wrongFileIdx) &&
      attAfterDeckMiss === attBeforeDeckMiss - EP.MirrorData.deck.wrongPenalty &&
      v1.q("#attnPct").textContent === Math.round(attAfterDeckMiss) + "%" &&
      !!wrongBtn && wrongBtn.disabled && wrongBtn.classList.contains("bad") &&
      v1.q("#mirrorMsg").textContent.includes(EP.MirrorData.files[wrongFileIdx].name) &&
      v1.q("#mirrorMsg").textContent.includes("6") &&
      v0.q("#mirrorWaitProgress").textContent.includes("1 wrong file ruled out") &&
      noSpiteShuffleAt1 && stAfterSpite.deck.reshuffles === 2 &&
      JSON.stringify(v1.qa("[data-file]").map(b => Number(b.dataset.file))) === JSON.stringify(stAfterSpite.deck.fileOrder);

    v1.q('[data-file="' + signedIdx + '"]').click();
    const stAfterDeckDone = g3.mirrorSetupTeam(team3);
    v0.render();
    v2.render();
    const deckDoneHandoffOk = stAfterDeckDone.deck.grabbed === true &&
      stAfterDeckDone.completedSteps.includes("deck") &&
      stAfterDeckDone.currentStep === "qa" &&
      stAfterDeckDone.currentPlayerId === s2.id &&
      !v1.q("#mirrorDeckStep") && !!v1.q("#mirrorWaitingView") && v1.q("#mirrorWaitingView").textContent.includes(s2.name) &&
      !v0.q("#mirrorQaStep") && !!v0.q("#mirrorWaitingView") &&
      !!v2.q("#mirrorQaStep") && !v2.q("#mirrorWaitingView") &&
      v2.q('[data-setup-step="deck"]').dataset.stepState === "done" &&
      v2.q('[data-setup-step="qa"]').dataset.stepState === "live";

    // Q&A: wrong answer (-5), timeout (-5 with .low warning bar), right answer (+5 recovery) -> Wrap up
    const qaOrder = stAfterDeckDone.qa.order;
    const q0 = EP.MirrorData.qaItems[qaOrder[0]];
    const attBeforeQaWrong = g3.mirrorAttention(team3);
    v2.q('[data-qa="' + ((q0.correctIndex + 1) % q0.options.length) + '"]').click();
    const stAfterQaWrong = g3.mirrorSetupTeam(team3);
    const attAfterQaWrong = g3.mirrorAttention(team3);
    const qaWrongOk = stAfterQaWrong.qa.wrong === 1 &&
      attAfterQaWrong === attBeforeQaWrong - EP.MirrorData.qa.wrongPenalty &&
      v2.q("#attnPct").textContent === Math.round(attAfterQaWrong) + "%" &&
      v2.q("#mirrorMsg").textContent.includes("The room cools.") &&
      v2.q("#mirrorMsg").textContent.includes(q0.why) &&
      v2.q("#qaCount").textContent === "Question 2 of 3";

    const barInitOk = v2.q("#qaCd").dataset.ticksLeft === String(EP.MirrorData.qa.countdownTicks) &&
      !v2.q("#qaCd i").classList.contains("low");
    const ticksToLow = EP.MirrorData.qa.countdownTicks - EP.MirrorData.qa.lowWarningTicks;
    for (let t = 0; t < ticksToLow; t++) { ctx3.advanceMs(250); v2.tick(); }
    const barLowOk = v2.q("#qaCd").dataset.ticksLeft === String(EP.MirrorData.qa.lowWarningTicks) &&
      v2.q("#qaCd i").classList.contains("low");
    const penBeforeQaTimeout = g3.mirrorSetupTeam(team3).penalties;
    const attBeforeQaTimeout = g3.mirrorAttention(team3);
    for (let t = 0; t < EP.MirrorData.qa.lowWarningTicks; t++) { ctx3.advanceMs(250); v2.tick(); }
    const stAfterQaTimeout = g3.mirrorSetupTeam(team3);
    const attAfterQaTimeout = g3.mirrorAttention(team3);
    const expectedQaDrain = (EP.MirrorData.qa.lowWarningTicks * EP.MirrorData.timers.tickMs / 1000) * (100 / EP.MirrorData.timers.showtimeSeconds);
    const qaTimeoutOk = barInitOk && barLowOk &&
      stAfterQaTimeout.qa.timeouts === 1 &&
      stAfterQaTimeout.penalties === penBeforeQaTimeout + EP.MirrorData.qa.wrongPenalty &&
      Math.abs((attBeforeQaTimeout - attAfterQaTimeout) - (EP.MirrorData.qa.wrongPenalty + expectedQaDrain)) < 0.01 &&
      v2.q("#attnPct").textContent === Math.round(attAfterQaTimeout) + "%" &&
      v2.q("#mirrorMsg").textContent.includes("You hesitate") &&
      v2.q("#mirrorMsg").textContent.includes("5") &&
      v2.q("#qaCount").textContent === "Question 3 of 3";

    const q2 = EP.MirrorData.qaItems[qaOrder[2]];
    const penBeforeQaRight = stAfterQaTimeout.penalties;
    const attBeforeQaRight = g3.mirrorAttention(team3);
    v2.q('[data-qa="' + q2.correctIndex + '"]').click();
    const stAfterQaRight = g3.mirrorSetupTeam(team3);
    const attAfterQaRight = g3.mirrorAttention(team3);
    v0.render();
    v1.render();
    const qaRightAndWrapGateOk = stAfterQaRight.qa.right === 1 &&
      stAfterQaRight.qaRecovered === EP.MirrorData.qa.rightRecover &&
      stAfterQaRight.penalties === penBeforeQaRight - EP.MirrorData.qa.rightRecover &&
      attAfterQaRight === attBeforeQaRight + EP.MirrorData.qa.rightRecover &&
      v2.q("#attnPct").textContent === Math.round(attAfterQaRight) + "%" &&
      v2.q("#mirrorMsg").textContent.includes("Land it.") &&
      v2.q("#mirrorMsg").textContent.includes(q2.why) &&
      stAfterQaRight.completedSteps.includes("qa") &&
      stAfterQaRight.currentStep === "wrapUp" &&
      v2.q('[data-setup-step="qa"]').dataset.stepState === "done" &&
      v2.q('[data-setup-step="wrapUp"]').dataset.stepState === "live" &&
      !!v2.q("#mirrorWrapUpStep") && !!v2.q("#wrapUp") &&
      !v0.q("#wrapUp") && !!v0.q("#mirrorWaitingView") && v0.q("#mirrorWaitingView").textContent.includes("Wrap up") &&
      !v1.q("#wrapUp") && !!v1.q("#mirrorWaitingView") && v1.q("#mirrorWaitingView").textContent.includes("Wrap up");

    v2.q("#wrapUp").click();
    const stAfterWrap = g3.mirrorSetupTeam(team3);
    const wrapText = v2.text();
    finishLv3Round(g3);
    const wrapAndEndLv3Ok = stAfterWrap.wrappedUp === true &&
      g3.didRun("runTrial") &&
      /Score \\d+ of 7/.test(wrapText) &&
      !LEAK_RE.test(wrapText) &&
      !HARDCODED_TEAMS_RE.test(wrapText) &&
      v2.flags().every(f => f !== "OK") &&
      g3.level === 3 && g3.step === "intermission";

    // 3. Full 5-step + wrap up handoff through real UI for 1, 2, and 3 Setup players
    const playAllSetupSteps = setupCount => {
      const size = setupCount === 1 ? 3 : setupCount === 2 ? 4 : 5;
      const onOpenFloor = setupCount === 1
        ? g => { g.teams[0].members[1].glitches = 2; g.teams[0].members[2].glitches = 2; }
        : null;
      const ctx = enterShowtime(size, { allHumans: true, seed: 910 + setupCount, onOpenFloor });
      const g = ctx.game, team = ctx.team;
      const slots = g.mirrorSetupSlots(team);
      if (slots.length !== setupCount) return false;
      const views = {};
      for (const sl of slots) {
        const pl = team.members.find(p => p.id === sl.playerId);
        views[sl.playerId] = mountView(g, pl, team);
      }
      const syncAllViews = () => { for (const sl of slots) views[sl.playerId].render(); };
      const checkGates = (expectedStep, expectedOwnerId) => {
        const stepId = {
          cables: "#mirrorCablesStep",
          sound: "#mirrorSoundStep",
          mic: "#mirrorMicStep",
          deck: "#mirrorDeckStep",
          qa: "#mirrorQaStep",
          wrapUp: "#mirrorWrapUpStep",
        }[expectedStep];
        for (const sl of slots) {
          const vw = views[sl.playerId];
          const text = vw.text();
          if (LEAK_RE.test(text) || HARDCODED_TEAMS_RE.test(text) || vw.flags().some(f => f === "OK")) return false;
          if (sl.playerId === expectedOwnerId) {
            if (!vw.q(stepId) || vw.q("#mirrorWaitingView")) return false;
          } else {
            if (vw.q(stepId) || !vw.q("#mirrorWaitingView")) return false;
          }
        }
        return true;
      };

      const seenSteps = [];
      for (let stepGuard = 0; stepGuard < 20 && !g.didRun("runTrial"); stepGuard++) {
        syncAllViews();
        const st = g.mirrorSetupTeam(team);
        const curStep = st.currentStep;
        const ownerId = st.currentPlayerId;
        const ownerSlot = slots.find(s => (curStep === "wrapUp" ? s.slotIndex === slots.length - 1 : s.steps.includes(curStep)));
        if (!ownerSlot || ownerSlot.playerId !== ownerId) return false;
        if (!checkGates(curStep, ownerId)) return false;
        seenSteps.push(curStep + ":" + ownerSlot.slotIndex);
        const ov = views[ownerId];

        if (curStep === "cables") {
          for (let k = 0; k < 200 && g.mirrorSetupTeam(team).currentStep === "cables"; k++) {
            const hit = ov.q('[data-cable-item][data-in-frame="1"]');
            if (hit) {
              const b = ov.q('[data-cable-port="' + hit.dataset.cableItem + '"]');
              if (b && !b.disabled) { b.click(); continue; }
            }
            ov.tick();
          }
        } else if (curStep === "sound") {
          for (let k = 0; k < 400 && g.mirrorSetupTeam(team).currentStep === "sound"; k++) {
            const lvl = Number((ov.q("#soundVal") || {}).textContent || 45);
            if (lvl < 74) ov.q('[data-sound-gain="' + (lvl <= 68 ? "10" : "5") + '"]').click();
            else if (lvl > 85) ov.q('[data-sound-gain="-10"]').click();
            ctx.advanceMs(250);
            ov.tick();
          }
        } else if (curStep === "mic") {
          driveMicClean(g, team, ov, ctx.advanceMs);
        } else if (curStep === "deck") {
          ov.q('[data-file="' + signedIdx + '"]').click();
        } else if (curStep === "qa") {
          for (let k = 0; k < 5 && g.mirrorSetupTeam(team).currentStep === "qa"; k++) {
            const qst = g.mirrorSetupTeam(team);
            const qItem = EP.MirrorData.qaItems[qst.qa.order[qst.qa.index]];
            ov.q('[data-qa="' + qItem.correctIndex + '"]').click();
          }
        } else if (curStep === "wrapUp") {
          ov.q("#wrapUp").click();
        }
      }

      const expectedSplit = setupCount === 1
        ? ["cables:0", "sound:0", "mic:0", "deck:0", "qa:0", "wrapUp:0"]
        : setupCount === 2
        ? ["cables:0", "sound:0", "mic:0", "deck:1", "qa:1", "wrapUp:1"]
        : ["cables:0", "sound:0", "mic:1", "deck:1", "qa:2", "wrapUp:2"];
      const lastView = views[slots[slots.length - 1].playerId];
      const endResultOk = g.didRun("runTrial") &&
        /Score \\d+ of 7/.test(lastView.text()) &&
        !LEAK_RE.test(lastView.text()) &&
        lastView.flags().every(f => f !== "OK");
      finishLv3Round(g);
      return JSON.stringify(seenSteps) === JSON.stringify(expectedSplit) &&
        endResultOk && g.level === 3 && g.step === "intermission";
    };

    const split1FullOk = playAllSetupSteps(1);
    const split2FullOk = playAllSetupSteps(2);
    const split3FullOk = playAllSetupSteps(3);

    // 4. Bot-owned mic, deck, and Q&A steps run on schedule with hiccups shown (plus bot automatic wrapUp)
    const testBotHiccupOnStep = targetStep => {
      for (let seed = 1; seed <= 120; seed++) {
        const ctx = enterShowtime(5, { allHumans: false, seed });
        const g = ctx.game, team = ctx.team;
        const human = team.members[0];
        const slots = g.mirrorSetupSlots(team);
        if (!slots || slots.length !== 3) continue;
        if (targetStep === "mic" || targetStep === "deck") {
          if (slots[0].playerId !== human.id || !slots[1].isBot) continue;
          passCablesAndSoundViaRules(g, team);
          if (targetStep === "deck") ctx.advanceMs(6000);
        } else {
          if (!slots[2].isBot) continue;
          if (slots[0].isBot) ctx.advanceMs(10000);
          else passCablesAndSoundViaRules(g, team);
          if (slots[1].isBot) ctx.advanceMs(12000);
          else passMicAndDeckViaRules(g, team, ctx);
        }
        const stBefore = g.mirrorSetupTeam(team);
        if (!stBefore || stBefore.currentStep !== targetStep || stBefore.currentPlayerId === human.id) continue;
        const snapBefore = g.toJSON();
        const savedNow = ctx.getNow();
        ctx.advanceMs(6000);
        const stProbe = g.mirrorSetupTeam(team);
        if (!stProbe || !stProbe.completedSteps.includes(targetStep) || stProbe.botHiccups !== stBefore.botHiccups + 1) continue;

        let pNow = savedNow;
        const pGame = EP.Game.fromJSON(snapBefore, { clock: () => pNow, hooks: EP.Bots.hooks });
        const pTeam = pGame.teams[0];
        const pHuman = pTeam.members[0];
        const botOwner = slots.find(s => s.steps.includes(targetStep));
        const vWait = mountView(pGame, pHuman, pTeam);
        const waitLabel = targetStep === "qa" ? "Q&A" : targetStep === "mic" ? "Mic" : "Deck";
        const beforeOk = !!vWait.q("#mirrorWaitingView") &&
          vWait.q("#mirrorWaitingView").textContent.includes(botOwner.name) &&
          vWait.q("#mirrorWaitingView").textContent.includes(waitLabel) &&
          vWait.q('[data-setup-step="' + targetStep + '"]').dataset.stepState === "live" &&
          !/bot/i.test(vWait.text());

        pNow += 6000;
        pGame.tick();
        vWait.tick();
        const stAfter = pGame.mirrorSetupTeam(pTeam);
        const afterText = vWait.text();
        const hiccupEl = vWait.q("#mirrorSetupHiccups");
        const msgEl = vWait.q("#mirrorMsg");
        const nextStep = targetStep === "mic" ? "deck" : targetStep === "deck" ? "qa" : "wrapUp";
        const expectedTotalHiccupCost = stAfter.botHiccups * EP.MirrorData.bots.setupHiccupPenalty;
        const afterOk = stAfter.completedSteps.includes(targetStep) &&
          stAfter.currentStep === nextStep &&
          stAfter.botHiccups === stBefore.botHiccups + 1 &&
          stAfter.penalties === stBefore.penalties + EP.MirrorData.bots.setupHiccupPenalty &&
          vWait.q('[data-setup-step="' + targetStep + '"]').dataset.stepState === "done" &&
          vWait.q('[data-setup-step="' + nextStep + '"]').dataset.stepState === "live" &&
          !!hiccupEl && hiccupEl.textContent.includes(String(expectedTotalHiccupCost)) &&
          !!msgEl && msgEl.textContent.includes("after a hiccup") && msgEl.textContent.includes("3") &&
          !/bot/i.test(afterText) && !LEAK_RE.test(afterText) && vWait.flags().every(f => f !== "OK");

        let botWrapEndOk = true;
        if (targetStep === "qa") {
          pNow += 6000;
          pGame.tick();
          vWait.tick();
          const endText = vWait.text();
          botWrapEndOk = pGame.didRun("runTrial") &&
            /Score \\d+ of 7/.test(endText) &&
            !/bot/i.test(endText) && !LEAK_RE.test(endText);
        }
        return { ok: beforeOk && afterOk && botWrapEndOk, seed };
      }
      return { ok: false, seed: null };
    };

    const botMicCase = testBotHiccupOnStep("mic");
    const botDeckCase = testBotHiccupOnStep("deck");
    const botQaCase = testBotHiccupOnStep("qa");

    return {
      seededContentOk,
      micOwnerGateOk,
      micFlashInitialOk,
      stillFlashingAt8,
      micHiddenAt9Ok,
      micWrongOk,
      retryStillFlashing,
      retryHiddenOk,
      micHitAndWaitOk,
      micDoneFrameOk,
      deckAutoShuffleOk,
      deckWrongOk,
      deckDoneHandoffOk,
      qaWrongOk,
      qaTimeoutOk,
      qaRightAndWrapGateOk,
      wrapAndEndLv3Ok,
      split1FullOk,
      split2FullOk,
      split3FullOk,
      botMicCase,
      botDeckCase,
      botQaCase,
    };
  })()`);

  check("Seeded mic sequence, deck file order/reshuffle, and Q&A content repeat deterministically for the same seed", res.seededContentOk);
  check("Mic screen shows only for its owner and non-owners see waiting view or Dance placeholder", res.micOwnerGateOk);
  check("Mic check flashes sequence for round 1 ticks, hides behind ?, and re-enables buttons", res.micFlashInitialOk && res.stillFlashingAt8 && res.micHiddenAt9Ok);
  check("Mic wrong tap reports -4 penalty, updates attention bar, re-flashes new order, and right taps update frame", res.micWrongOk && res.retryStillFlashing && res.retryHiddenOk && res.micHitAndWaitOk && res.micDoneFrameOk);
  check("Deck step auto-reshuffles on schedule, reports wrong file -6 with spite reshuffle, and hands off on signed deck", res.deckAutoShuffleOk && res.deckWrongOk && res.deckDoneHandoffOk);
  check("Q&A reports wrong (-5), countdown warning/timeout (-5), and right answer (+5 recovery) then opens wrap up for last slot", res.qaWrongOk && res.qaTimeoutOk && res.qaRightAndWrapGateOk);
  check("Wrap up shows only for last Setup owner, calls G.mirrorWrapUp, and finishes Level 3 cleanly without leaks", res.wrapAndEndLv3Ok);
  check("All 5 Setup steps and wrap up hand off cleanly for 1, 2, and 3 Setup players without leaks", res.split1FullOk && res.split2FullOk && res.split3FullOk);
  check("Bot-owned mic step runs on schedule with hiccup cost shown and no bot tag", res.botMicCase && res.botMicCase.ok);
  check("Bot-owned deck step runs on schedule with hiccup cost shown and no bot tag", res.botDeckCase && res.botDeckCase.ok);
  check("Bot-owned Q&A step runs with hiccup cost shown and bot wrap up finishes Level 3 cleanly", res.botQaCase && res.botQaCase.ok);
}

async function mirrorStep6dCases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const HARDCODED_TEAMS_RE = /Team Kestrel|Team Wren|Team Finch|Team Heron/i;
    const KEY_BY_DIR = { left: "ArrowLeft", up: "ArrowUp", right: "ArrowRight", down: "ArrowDown" };

    const advanceToLv3Trial = (game, onOpenFloor) => {
      for (let round = 1; round <= 2; round++) {
        game.startNextRound();
        game.advance();
        game.advance();
        game.runTrial();
        game.endTrial();
        game.endGlitchReport();
        game.advance();
        game.advance();
        game.lockIn();
        game.advance();
        game.computeEarnings();
        game.placeAllRemaining();
        game.finishRound();
      }
      game.startNextRound();
      game.advance();
      if (onOpenFloor) onOpenFloor(game);
      game.advance();
    };

    const finishLv3Round = game => {
      game.endTrial();
      game.endGlitchReport();
      game.advance();
      game.advance();
      game.lockIn();
      game.advance();
      game.computeEarnings();
      game.placeAllRemaining();
      game.finishRound();
    };

    const makeTeam = (tid, size, { allHumans = false, startId = tid * 10 + 1 } = {}) => {
      const members = [];
      for (let i = 0; i < size; i++) {
        members.push(new EP.Player({
          id: startId + i,
          name: "T" + tid + "P" + (i + 1),
          type: "coop",
          spend: EP.Bots.typicalSpend("coop"),
          isBot: !allHumans && i > 0,
        }));
      }
      return new EP.Team({ id: tid, name: "Unit " + tid, members });
    };

    const enterShowtime = (size, { allHumans = true, seed = 640 + size, onOpenFloor = null } = {}) => {
      let simNow = 9000000 + size * 10000;
      const t1 = makeTeam(1, size, { allHumans });
      const t2 = new EP.Team({ id: 2, name: "Unit 2", members: [0, 1, 2].map(i => EP.Bots.makePlayer(21 + i, "BotB_" + i, "coop")) });
      const t3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "BotC_" + i, "indep")) });
      const t4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2].map(i => EP.Bots.makePlayer(41 + i, "BotD_" + i, "contra")) });
      const game = new EP.Game({ teams: [t1, t2, t3, t4], rng: EP.Rng.seeded(seed), clock: () => simNow, hooks: EP.Bots.hooks });
      advanceToLv3Trial(game, onOpenFloor);
      game.start();
      simNow += 16000;
      game.tick();
      for (const p of t1.active()) game.mirrorConnect(p);
      simNow = game.timer.deadline;
      game.tick();
      return { game, team: t1, getNow: () => simNow, setNow: v => { simNow = v; }, advanceMs: ms => { simNow += ms; game.tick(); } };
    };

    const origRaf = window.requestAnimationFrame;
    const origCancel = window.cancelAnimationFrame;
    const prevRainOn = typeof rainOn === "boolean" ? rainOn : false;
    if (typeof rainOn === "boolean") rainOn = false;
    let nextRafId = 1;
    const rafQueue = new Map();
    let cancelCount = 0;

    window.requestAnimationFrame = cb => {
      if (cb && cb.name === "rainFrame") return 0;
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    };
    window.cancelAnimationFrame = id => {
      if (rafQueue.delete(id)) cancelCount += 1;
    };
    const flushRaf = ts => {
      const batch = [...rafQueue.entries()];
      rafQueue.clear();
      for (const [, cb] of batch) cb(ts);
    };

    const mountView = (game, me, team, state = {}) => {
      const box = document.createElement("div");
      let curView = null;
      const renderMount = () => {
        if (curView && curView.cleanup) curView.cleanup();
        curView = MirrorView.screen({
          game, me, team, state, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost hint", onRender: renderMount,
        });
        box.innerHTML = curView.html;
        if (curView.bind) curView.bind(box);
      };
      renderMount();
      return {
        box,
        state,
        view: () => curView,
        render: renderMount,
        tick: () => { if (curView && curView.tick) curView.tick(); },
        cleanup: () => { if (curView && curView.cleanup) curView.cleanup(); },
        text: () => box.textContent || "",
        q: s => box.querySelector(s),
        qa: s => [...box.querySelectorAll(s)],
        flags: () => [...box.querySelectorAll(".flag")].map(el => el.textContent.trim()),
      };
    };

    const drivePerfectHits = (view, count, advanceMs = null) => {
      let hits = 0;
      for (let t = 0; t < 400 && hits < count; t++) {
        const pNote = view.q('[data-note-zone="perfect"]');
        if (pNote) {
          view.view().handleInput(pNote.dataset.noteDir);
          hits += 1;
        } else {
          if (advanceMs) advanceMs(250);
          view.tick();
        }
      }
      return hits;
    };

    try {
      // 1. Role gating: Dance Crew sees rhythm lane, Setup Crew does not
      const ctx1 = enterShowtime(4, { allHumans: true, seed: 640 });
      const g1 = ctx1.game, t1 = ctx1.team;
      const d0 = t1.members.find(p => g1.mirrorRole(p) === "dance");
      const s0 = t1.members.find(p => g1.mirrorRole(p) === "setup");
      const vSetup1 = mountView(g1, s0, t1);
      const setupNoLaneOk = !vSetup1.q("#lane") && !vSetup1.q("#mirrorDancePanel") && !vSetup1.q("#dancePad") &&
        !!vSetup1.q("#mirrorSetupFrame") && rafQueue.size === 0;
      vSetup1.cleanup();

      const vDance1 = mountView(g1, d0, t1);
      const danceSeesLaneOk = !!vDance1.q("#mirrorDancePanel") && !!vDance1.q("#lane") &&
        !!vDance1.q("#dancePad") && !!vDance1.q("#danceAvatars") &&
        !!vDance1.q("#mirrorDanceRoster") && !!vDance1.q("#mirrorSetupFrame") &&
        !vDance1.q("#mirrorCablesStep") && !vDance1.q("#mirrorSoundStep") &&
        !vDance1.q("#mirrorDancePlaceholder") &&
        vDance1.qa("[data-dancer]").length === 2 &&
        vDance1.qa("[data-dancer] svg").length === 2 &&
        rafQueue.size === 1 && vDance1.view().isLoopRunning();

      // 2. Hits (keyboard PERFECT +3, button good +2), stray (-1), and miss (-2) report to rules and update UI
      const d1Idle = t1.members.find(p => g1.mirrorRole(p) === "dance" && p.id !== d0.id);
      if (d1Idle) d1Idle.idle = true;
      g1.hooks = {};
      flushRaf(1000); // initialize rAF draw loop at elapsed = 0
      for (let i = 1; i <= 10; i++) { ctx1.advanceMs(250); flushRaf(1000 + i * 250); } // tick = 10 -> note 1 in perfect zone
      const n1 = vDance1.q('[data-note-zone="perfect"]');
      const dir1 = n1 ? n1.dataset.noteDir : null;
      if (dir1) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: KEY_BY_DIR[dir1], bubbles: true, cancelable: true }));
      }
      const rAfterPerf = g1.mirrorDanceTeam(t1);
      const dAfterPerf = rAfterPerf.dancers.find(d => d.playerId === d0.id);
      const attAfterPerf = Math.round(g1.mirrorAttention(t1));
      const perfectHitOk = !!dir1 && dAfterPerf.perfects === 1 && dAfterPerf.boost === 3 && dAfterPerf.combo === 1 &&
        vDance1.q("#danceHits").textContent === "1" &&
        vDance1.q("#myDanceBoost").textContent.includes("+3 / 45") &&
        vDance1.q("#comboN").textContent === "combo ×1" &&
        vDance1.q("#teamDanceBoost").textContent === "1.5" &&
        vDance1.q("#attnPct").textContent === attAfterPerf + "%";

      for (let i = 11; i <= 14; i++) { ctx1.advanceMs(250); flushRaf(1000 + i * 250); } // tick = 14 -> note 2 (t0=6) in good zone
      const n2 = vDance1.q('[data-note-zone="good"]');
      const dir2 = n2 ? n2.dataset.noteDir : null;
      if (dir2) vDance1.q('[data-dance="' + dir2 + '"]').click();
      const dAfterGood = g1.mirrorDanceTeam(t1).dancers.find(d => d.playerId === d0.id);
      const goodHitOk = !!dir2 && dAfterGood.goods === 1 && dAfterGood.boost === 5 && dAfterGood.combo === 2 &&
        vDance1.q("#danceHits").textContent === "2" &&
        vDance1.q("#myDanceBoost").textContent.includes("+5 / 45") &&
        vDance1.q("#comboN").textContent === "combo ×2" &&
        vDance1.q("#teamDanceBoost").textContent === "2.5";

      // Stray press when no unjudged note is in the hit frame (note 3 at t0=12 has diff=8 at tick=14)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      const dAfterStray = g1.mirrorDanceTeam(t1).dancers.find(d => d.playerId === d0.id);
      const attAfterStray = Math.round(g1.mirrorAttention(t1));
      const strayOk = dAfterStray.strays === 1 && dAfterStray.penalties === 1 && dAfterStray.combo === 0 &&
        vDance1.q("#danceStrays").textContent === "1" &&
        vDance1.q("#comboN").textContent === "combo ×0" &&
        vDance1.q("#teamDancePen").textContent === "0.5" &&
        vDance1.q("#attnPct").textContent === attAfterStray + "%";

      // Miss note 3 (t0=12 -> misses once tick >= 25)
      for (let i = 15; i <= 25; i++) { ctx1.advanceMs(250); flushRaf(1000 + i * 250); }
      const dAfterMiss = g1.mirrorDanceTeam(t1).dancers.find(d => d.playerId === d0.id);
      const attAfterMiss = Math.round(g1.mirrorAttention(t1));
      const missOk = dAfterMiss.misses === 1 && dAfterMiss.penalties === 3 && dAfterMiss.combo === 0 &&
        vDance1.q("#danceMisses").textContent === "1" &&
        vDance1.q("#teamDancePen").textContent === "1.5" &&
        vDance1.q("#attnPct").textContent === attAfterMiss + "%" &&
        vDance1.q("#danceCam").textContent.includes("missed note") &&
        vDance1.q('[data-dancer="' + d0.id + '"]').classList.contains("stumble");
      vDance1.cleanup();

      // 3. Tempo ramp (6 -> 5 after 20 notes -> 4 after 40 notes) and max 2 identical arrows in a row
      const ctxTempo = enterShowtime(4, { allHumans: true, seed: 641 });
      ctxTempo.game.hooks = {};
      const dTempo = ctxTempo.team.members.find(p => ctxTempo.game.mirrorRole(p) === "dance");
      const vTempo = mountView(ctxTempo.game, dTempo, ctxTempo.team);
      const seenNotes = new Map();
      const recordTempoNotes = () => {
        const dv = ctxTempo.game.mirrorDanceView(dTempo);
        if (dv) for (const n of dv.notes) seenNotes.set(n.id, { t0: n.t0, dir: n.dir });
      };
      recordTempoNotes();
      for (let t = 0; t < 260 && !ctxTempo.game.didRun("runTrial"); t++) {
        const pNote = vTempo.q('[data-note-zone="perfect"]');
        if (pNote) vTempo.view().handleInput(pNote.dataset.noteDir);
        ctxTempo.advanceMs(250);
        vTempo.tick();
        recordTempoNotes();
      }
      const spawned = [...seenNotes.values()];
      const gaps = [];
      for (let i = 1; i < spawned.length; i++) gaps.push(spawned[i].t0 - spawned[i - 1].t0);
      let noTripleSame = true;
      for (let i = 2; i < spawned.length; i++) {
        if (spawned[i].dir === spawned[i - 1].dir && spawned[i - 1].dir === spawned[i - 2].dir) noTripleSame = false;
      }
      const tempoRampOk = spawned.length > 42 &&
        gaps[0] === EP.MirrorData.dance.gapInitialTicks &&
        gaps[20] === EP.MirrorData.dance.gapMidTicks &&
        gaps[40] === EP.MirrorData.dance.gapFastTicks &&
        noTripleSame;
      vTempo.cleanup();

      // 4. Boost cap at 45 and 1-dancer average match
      const ctxCap = enterShowtime(3, { allHumans: true, seed: 642 });
      const gCap = ctxCap.game, tCap = ctxCap.team;
      gCap.hooks = {};
      const dCap = tCap.members.find(p => gCap.mirrorRole(p) === "dance");
      const vCap = mountView(gCap, dCap, tCap);
      const hitsDriven = drivePerfectHits(vCap, 17, ctxCap.advanceMs); // 17 * 3 = 51 raw -> caps at 45
      const dcCap = gCap.mirrorDanceTeam(tCap);
      const boostCapOk = hitsDriven === 17 &&
        dcCap.dancers.length === 1 &&
        dcCap.dancers[0].boost === 45 &&
        dcCap.avgBoost === 45 &&
        vCap.q("#myDanceBoost").textContent.includes("+45 / 45") &&
        vCap.q('[data-dance-boost="' + dCap.id + '"]').textContent.includes("+45 / 45") &&
        vCap.q("#teamDanceBoost").textContent === "45";
      vCap.cleanup();

      // Team averaging for 1, 2, and 3 dancers
      const ctxAvg1 = enterShowtime(3, { allHumans: true, seed: 643 });
      const gA1 = ctxAvg1.game, tA1 = ctxAvg1.team;
      gA1.hooks = {};
      const dA1 = tA1.members.find(p => gA1.mirrorRole(p) === "dance");
      const vA1 = mountView(gA1, dA1, tA1);
      drivePerfectHits(vA1, 2, ctxAvg1.advanceMs); // +6
      gA1.mirrorDanceMiss(dA1); // +2 pen
      vA1.tick();
      const dcA1 = gA1.mirrorDanceTeam(tA1);
      const avg1Ok = dcA1.dancers.length === 1 && dcA1.avgBoost === 6 && dcA1.avgPenalties === 2 &&
        vA1.q("#teamDanceBoost").textContent === "6" &&
        vA1.q("#teamDancePen").textContent === "2" &&
        vA1.q("#attnPct").textContent === Math.round(gA1.mirrorAttention(tA1)) + "%";
      vA1.cleanup();

      const ctxAvg2 = enterShowtime(4, { allHumans: true, seed: 644 });
      const gA2 = ctxAvg2.game, tA2 = ctxAvg2.team;
      gA2.hooks = {};
      const dList2 = tA2.members.filter(p => gA2.mirrorRole(p) === "dance");
      const vA2_0 = mountView(gA2, dList2[0], tA2);
      const vA2_1 = mountView(gA2, dList2[1], tA2);
      for (let t = 1; t <= 10; t++) { ctxAvg2.advanceMs(250); vA2_0.tick(); vA2_1.tick(); }
      const p2a1 = vA2_0.q('[data-note-zone="perfect"]'); if (p2a1) vA2_0.view().handleInput(p2a1.dataset.noteDir); // +3
      const p2b1 = vA2_1.q('[data-note-zone="perfect"]'); if (p2b1) vA2_1.view().handleInput(p2b1.dataset.noteDir); // +3
      for (let t = 11; t <= 16; t++) { ctxAvg2.advanceMs(250); vA2_0.tick(); vA2_1.tick(); }
      const p2a2 = vA2_0.q('[data-note-zone="perfect"]'); if (p2a2) vA2_0.view().handleInput(p2a2.dataset.noteDir); // +6
      gA2.mirrorDanceMiss(dList2[1]); // +2 pen
      vA2_0.tick();
      vA2_1.tick();
      const dcA2 = gA2.mirrorDanceTeam(tA2);
      const avg2Ok = dcA2.dancers.length === 2 && dcA2.avgBoost === 4.5 && dcA2.avgPenalties === 1 &&
        vA2_0.q("#teamDanceBoost").textContent === "4.5" &&
        vA2_1.q("#teamDanceBoost").textContent === "4.5" &&
        vA2_0.q("#teamDancePen").textContent === "1" &&
        vA2_1.q("#teamDancePen").textContent === "1" &&
        vA2_0.q('[data-dance-boost="' + dList2[0].id + '"]').textContent.includes("+6 / 45") &&
        vA2_0.q('[data-dance-boost="' + dList2[1].id + '"]').textContent.includes("+3 / 45") &&
        vA2_0.q("#attnPct").textContent === Math.round(gA2.mirrorAttention(tA2)) + "%";
      vA2_0.cleanup();
      vA2_1.cleanup();

      const ctxAvg3 = enterShowtime(6, { allHumans: true, seed: 645 });
      const gA3 = ctxAvg3.game, tA3 = ctxAvg3.team;
      gA3.hooks = {};
      const dList3 = tA3.members.filter(p => gA3.mirrorRole(p) === "dance");
      const vA3_0 = mountView(gA3, dList3[0], tA3);
      const vA3_1 = mountView(gA3, dList3[1], tA3);
      const vA3_2 = mountView(gA3, dList3[2], tA3);
      drivePerfectHits(vA3_0, 1, ctxAvg3.advanceMs); // +3 at 2.5s before any miss at 3.25s
      gA3.mirrorDanceHit(dList3[1], "good"); // +2
      gA3.mirrorDanceMiss(dList3[2]); // +2 pen
      vA3_0.tick(); vA3_1.tick(); vA3_2.tick();
      const dcA3 = gA3.mirrorDanceTeam(tA3);
      const expB3 = (5 / 3).toFixed(1), expP3 = (2 / 3).toFixed(1);
      const avg3Ok = dcA3.dancers.length === 3 &&
        Math.abs(dcA3.avgBoost - 5 / 3) < 1e-9 &&
        Math.abs(dcA3.avgPenalties - 2 / 3) < 1e-9 &&
        vA3_0.q("#teamDanceBoost").textContent === expB3 &&
        vA3_1.q("#teamDanceBoost").textContent === expB3 &&
        vA3_2.q("#teamDanceBoost").textContent === expB3 &&
        vA3_0.q("#teamDancePen").textContent === expP3 &&
        vA3_2.q("#attnPct").textContent === Math.round(gA3.mirrorAttention(tA3)) + "%";
      vA3_0.cleanup(); vA3_1.cleanup(); vA3_2.cleanup();

      // 5. Bot dancers' progress updates in roster with avatars, boardStatus, and no "bot" tag
      let botProgressOk = false;
      for (let seed = 1; seed <= 40; seed++) {
        const ctxBot = enterShowtime(5, { allHumans: false, seed });
        const dc0 = ctxBot.game.mirrorDanceTeam(ctxBot.team);
        const hDancer = ctxBot.team.members.find(p => !p.isBot && ctxBot.game.mirrorRole(p) === "dance");
        const bDancerRec = dc0 && dc0.dancers.find(d => d.isBot);
        if (!hDancer || !bDancerRec) continue;
        const vBot = mountView(ctxBot.game, hDancer, ctxBot.team);
        ctxBot.advanceMs(6000);
        vBot.tick();
        const dc1 = ctxBot.game.mirrorDanceTeam(ctxBot.team);
        const bAfter = dc1.dancers.find(d => d.playerId === bDancerRec.playerId);
        const bEl = vBot.q('[data-dance-boost="' + bDancerRec.playerId + '"]');
        const txt = vBot.text();
        botProgressOk = bAfter.boost > 0 &&
          !!bEl && bEl.textContent.includes("+" + bAfter.boost + " / 45") &&
          !!vBot.q('[data-dancer="' + bDancerRec.playerId + '"] svg') &&
          !/bot/i.test(txt) && !LEAK_RE.test(txt) && vBot.flags().every(f => f !== "OK");
        vBot.cleanup();
        if (botProgressOk) break;
      }

      // 6. Team with 0 dancers shows no lane and Setup flow completes Level 3
      const ctxZero = enterShowtime(3, {
        allHumans: true,
        seed: 646,
        onOpenFloor: g => { g.teams[0].members[1].glitches = 2; g.teams[0].members[2].glitches = 2; },
      });
      const gZ = ctxZero.game, tZ = ctxZero.team;
      const pZ = tZ.active()[0];
      const vZ = mountView(gZ, pZ, tZ);
      const zeroNoLaneUI = gZ.mirrorDanceTeam(tZ).dancers.length === 0 &&
        !vZ.q("#lane") && !vZ.q("#mirrorDancePanel") &&
        vZ.text().includes("Dance Crew (0)") && rafQueue.size === 0;
      const directFallback = MirrorDanceView.screen({
        game: gZ, me: pZ, team: tZ, state: { msg: "" },
        headerHTML: "", attentionBarHTML: "", onRender: () => {},
      });
      const zeroDirectSafe = !directFallback.html.includes('id="lane"') && !directFallback.isLoopRunning();
      for (const port of EP.MirrorData.ports) gZ.mirrorCableHit(pZ, port);
      gZ.mirrorSoundHeld(pZ);
      while (gZ.mirrorSetupTeam(tZ).currentStep === "mic") {
        const st = gZ.mirrorSetupTeam(tZ);
        if (st.mic.flashing && st.mic.hideAt !== null) {
          ctxZero.setNow(st.mic.hideAt);
          gZ.tick();
        }
        gZ.mirrorMicTap(pZ, st.mic.sequence[st.mic.index]);
      }
      gZ.mirrorPickFile(pZ, EP.MirrorData.files.findIndex(f => f.correct));
      while (gZ.mirrorSetupTeam(tZ).currentStep === "qa") {
        const st = gZ.mirrorSetupTeam(tZ);
        gZ.mirrorAnswerQa(pZ, EP.MirrorData.qaItems[st.qa.order[st.qa.index]].correctIndex);
      }
      gZ.mirrorWrapUp(pZ);
      const zeroTrialDone = gZ.didRun("runTrial");
      finishLv3Round(gZ);
      vZ.cleanup();
      const zeroDancersFlowOk = zeroNoLaneUI && zeroDirectSafe && zeroTrialDone && gZ.level === 3 && gZ.step === "intermission";

      // 7. Showtime end in rules stops the lane (wrap up, showtime timer expire, and attention 0)
      const ctxWrapEnd = enterShowtime(4, { allHumans: true, seed: 647 });
      const gWE = ctxWrapEnd.game, tWE = ctxWrapEnd.team;
      const dWE = tWE.members.find(p => gWE.mirrorRole(p) === "dance");
      const vWE = mountView(gWE, dWE, tWE);
      const slotsWE = gWE.mirrorSetupSlots(tWE);
      const own0 = tWE.members.find(p => p.id === slotsWE[0].playerId);
      const own1 = tWE.members.find(p => p.id === slotsWE[slotsWE.length - 1].playerId);
      for (const port of EP.MirrorData.ports) gWE.mirrorCableHit(own0, port);
      gWE.mirrorSoundHeld(own0);
      while (gWE.mirrorSetupTeam(tWE).currentStep === "mic") {
        const st = gWE.mirrorSetupTeam(tWE);
        if (st.mic.flashing && st.mic.hideAt !== null) {
          ctxWrapEnd.setNow(st.mic.hideAt);
          gWE.tick();
        }
        gWE.mirrorMicTap(own0, st.mic.sequence[st.mic.index]);
      }
      gWE.mirrorPickFile(own1, EP.MirrorData.files.findIndex(f => f.correct));
      while (gWE.mirrorSetupTeam(tWE).currentStep === "qa") {
        const st = gWE.mirrorSetupTeam(tWE);
        gWE.mirrorAnswerQa(own1, EP.MirrorData.qaItems[st.qa.order[st.qa.index]].correctIndex);
      }
      const dViewWE = vWE.view();
      gWE.mirrorWrapUp(own1);
      vWE.tick();
      const wrapHitsBefore = gWE.mirrorDanceTeam(tWE).dancers.find(d => d.playerId === dWE.id).strays;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      const wrapHitsAfter = gWE.mirrorDanceTeam(tWE).dancers.find(d => d.playerId === dWE.id).strays;
      const wrapStopsLaneOk = !dViewWE.isLoopRunning() && rafQueue.size === 0 && !vWE.q("#lane") && wrapHitsBefore === wrapHitsAfter;
      vWE.cleanup();

      const ctxTimerEnd = enterShowtime(4, { allHumans: true, seed: 648 });
      const gTE = ctxTimerEnd.game, tTE = ctxTimerEnd.team;
      const dTE = tTE.members.find(p => gTE.mirrorRole(p) === "dance");
      const vTE = mountView(gTE, dTE, tTE);
      const dViewTE = vTE.view();
      ctxTimerEnd.setNow(gTE.timer.deadline);
      gTE.tick();
      vTE.tick();
      const timerStraysBefore = gTE.mirrorDanceTeam(tTE).dancers.find(d => d.playerId === dTE.id).strays;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      const timerStraysAfter = gTE.mirrorDanceTeam(tTE).dancers.find(d => d.playerId === dTE.id).strays;
      const timerStopsLaneOk = gTE.didRun("runTrial") && !dViewTE.isLoopRunning() && rafQueue.size === 0 && !vTE.q("#lane") && timerStraysBefore === timerStraysAfter;
      vTE.cleanup();

      const ctxAttEnd = enterShowtime(4, { allHumans: true, seed: 649 });
      const gAE = ctxAttEnd.game, tAE = ctxAttEnd.team;
      const dAE = tAE.members.find(p => gAE.mirrorRole(p) === "dance");
      const vAE = mountView(gAE, dAE, tAE);
      const dViewAE = vAE.view();
      ctxAttEnd.advanceMs(70000);
      for (let k = 0; k < 25 && !gAE.mirrorFailReason(tAE); k++) gAE.mirrorDanceMiss(dAE);
      vAE.tick();
      const attStraysBefore = gAE.mirrorDanceTeam(tAE).dancers.find(d => d.playerId === dAE.id).strays;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      const attStraysAfter = gAE.mirrorDanceTeam(tAE).dancers.find(d => d.playerId === dAE.id).strays;
      const attnZeroStopsLaneOk = gAE.mirrorFailReason(tAE) === "attention" &&
        !dViewAE.isLoopRunning() && rafQueue.size === 0 &&
        (!!vAE.q("#mirrorAttnFailed") || vAE.text().includes("Score 0 of 7")) &&
        !vAE.q("#lane") && attStraysBefore === attStraysAfter;
      vAE.cleanup();

      // 8. Leaving screen via game.js navigation stops rAF, removes keydown, blocks keys during Attendance popup,
      //    and finishes full Dance Crew flow to end of Level 3 without leaks
      let gameCtx = null;
      for (let seed = 1; seed <= 40; seed++) {
        let simNow = 9500000 + seed * 10000;
        const session = EP.Bots.soloGame({
          me: { name: "RunnerD", type: "coop", spend: EP.Bots.typicalSpend("coop") },
          myTeam: { name: "Team Kestrel", mates: TEAM.map(p => p.n) },
          others: OTHERS.map(o => ({ name: o.t, players: o.p })),
          rng: EP.Rng.seeded(seed),
          hooks: EP.Bots.hooks,
        });
        const g = session.game;
        g._timer.clock = () => simNow;
        advanceToLv3Trial(g);
        g.start();
        simNow += 16000;
        g.tick();
        for (const p of session.team.active()) g.mirrorConnect(p);
        simNow = g.timer.deadline;
        g.tick();
        if (g.mirrorRole(session.me) === "dance") {
          gameCtx = {
            game: g,
            me: session.me,
            team: session.team,
            getNow: () => simNow,
            setNow: v => { simNow = v; },
            advanceMs: ms => { simNow += ms; g.tick(); },
          };
          break;
        }
      }
      let navLeaveStopsLoopOk = false, attPopupBlockedKeyOk = false, fullDanceLv3EndOk = false;
      if (gameCtx) {
        const savedG = G, savedME = ME, savedMYTEAM = MYTEAM;
        const savedStep = S.step, savedMaxStep = S.maxStep, savedArrived = S.arrived, savedType = S.type, savedName = S.name;
        const savedTrialUI = S.trialUI;
        try {
          G = gameCtx.game;
          ME = gameCtx.me;
          MYTEAM = gameCtx.team;
          S.type = "coop";
          S.name = ME.name;
          S.arrived = true;
          S.step = 7;
          S.maxStep = 7;
          resetRoundUI();
          render();

          const loopStartedOnStage = !!document.querySelector("#lane") && rafQueue.size === 1 &&
            typeof S.trialUI.mirror._danceCleanup === "function";
          const danceLaneText = (document.querySelector("#stage") || {}).textContent || "";
          const danceLaneClean = !LEAK_RE.test(danceLaneText) && !/bot/i.test(danceLaneText) &&
            [...document.querySelectorAll("#stage .flag")].every(el => el.textContent.trim() !== "OK");

          // Attendance popup open: arrow key closes popup and never hits dance lane
          const attOv = [...document.querySelectorAll(".board-ov")].pop();
          const straysBeforePopup = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).strays;
          if (attOv) attOv.hidden = false;
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
          const straysAfterPopup = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).strays;
          attPopupBlockedKeyOk = !!attOv && attOv.hidden === true && straysBeforePopup === straysAfterPopup;

          // Navigate away from Trial screen -> cancels dance rAF and removes keydown listener
          const cancelsBeforeLeave = cancelCount;
          const danceRafId = [...rafQueue.keys()][0];
          go(6);
          const straysBeforeKeyAfterLeave = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).strays;
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
          const straysAfterKeyAfterLeave = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).strays;
          navLeaveStopsLoopOk = loopStartedOnStage &&
            cancelCount > cancelsBeforeLeave &&
            !rafQueue.has(danceRafId) &&
            !document.querySelector("#lane") &&
            S.trialUI.mirror._danceCleanup === null &&
            straysBeforeKeyAfterLeave === straysAfterKeyAfterLeave;

          // Return to Trial screen, land a hit, let bot Setup Crew finish showtime -> end of Level 3
          go(7);
          flushRaf(5000);
          for (let i = 1; i <= 10; i++) {
            gameCtx.advanceMs(250);
            flushRaf(5000 + i * 250);
          }
          const stageNote = document.querySelector('[data-note-zone="perfect"]');
          if (stageNote) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: KEY_BY_DIR[stageNote.dataset.noteDir], bubbles: true, cancelable: true }));
          }
          const stageHitCount = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).perfects;

          for (let sec = 0; sec < 50 && !G.didRun("runTrial"); sec++) {
            gameCtx.advanceMs(1000);
            drawTimer();
          }
          if (G.didRun("runTrial")) render();
          const trialEndText = (document.querySelector("#stage") || {}).textContent || "";
          const danceTrialEndedClean = G.didRun("runTrial") &&
            rafQueue.size === 0 &&
            !document.querySelector("#lane") &&
            /Score \\d+ of 7/.test(trialEndText) &&
            !LEAK_RE.test(trialEndText) &&
            !/bot/i.test(trialEndText);

          // Complete Level 3 Glitch Report -> Gift Window -> Stats Update -> Intermission
          goForward(); // -> Glitch Report (step 8)
          const skipBtn = document.querySelector("#skipAcc");
          if (skipBtn) skipBtn.click();
          if (G.timer && G.timer.name === "glitchReport") {
            gameCtx.setNow(G.timer.deadline);
            afterClose(G.tick());
          }
          if (G.timer && G.timer.name === "giftWindow") {
            gameCtx.setNow(G.timer.deadline);
            afterClose(G.tick());
          }
          const gwAutoAdvancedOk = S.step === 9 && G.step === "statsUpdate";
          for (let i = 0; i < 10; i++) {
            const pInc = document.querySelector("[data-pinc]:not([disabled])");
            if (!pInc) break;
            pInc.click();
          }
          goForward(); // -> lockPoints
          if (G.timer && G.timer.name === "statsUpdate") {
            gameCtx.setNow(G.timer.deadline);
            afterClose(G.tick());
          }
          fullDanceLv3EndOk = gwAutoAdvancedOk &&
            stageHitCount >= 1 &&
            danceLaneClean &&
            danceTrialEndedClean &&
            G.level === 3 &&
            G.step === "intermission" &&
            roundDone();
        } finally {
          if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
          G = savedG; ME = savedME; MYTEAM = savedMYTEAM;
          S.step = savedStep; S.maxStep = savedMaxStep; S.arrived = savedArrived; S.type = savedType; S.name = savedName;
          S.trialUI = savedTrialUI;
          render();
        }
      }

      return {
        setupNoLaneOk,
        danceSeesLaneOk,
        perfectHitOk,
        goodHitOk,
        strayOk,
        missOk,
        tempoRampOk,
        boostCapOk,
        avg1Ok,
        avg2Ok,
        avg3Ok,
        botProgressOk,
        zeroDancersFlowOk,
        wrapStopsLaneOk,
        timerStopsLaneOk,
        attnZeroStopsLaneOk,
        attPopupBlockedKeyOk,
        navLeaveStopsLoopOk,
        fullDanceLv3EndOk,
      };
    } finally {
      window.requestAnimationFrame = origRaf;
      window.cancelAnimationFrame = origCancel;
      if (typeof rainOn === "boolean") {
        rainOn = prevRainOn;
        if (prevRainOn && typeof origRaf === "function") origRaf(rainFrame);
      }
    }
  })()`);

  check("Dance Crew player sees rhythm lane and Setup Crew player does not", res.setupNoLaneOk && res.danceSeesLaneOk);
  check("Dance hit (keyboard PERFECT +3, pad good +2), stray (-1), and miss (-2) report to rules and update boost and attention", res.perfectHitOk && res.goodHitOk && res.strayOk && res.missOk);
  check("Rhythm lane ramps tempo at 20 and 40 notes and never spawns 3 identical arrows in a row", res.tempoRampOk);
  check("Dance boost stops at the rules cap of 45", res.boostCapOk);
  check("Team dance average and attention match the rules for 1, 2, and 3 dancers", res.avg1Ok && res.avg2Ok && res.avg3Ok);
  check("Bot dancers' progress updates live in the roster without any bot tag or leaks", res.botProgressOk);
  check("A team with 0 dancers shows no rhythm lane and completes Level 3 cleanly", res.zeroDancersFlowOk);
  check("Rhythm lane stops when showtime ends via wrap up, timer expiration, or attention 0", res.wrapStopsLaneOk && res.timerStopsLaneOk && res.attnZeroStopsLaneOk);
  check("Attendance popup swallows dance arrow keys before they reach the rhythm lane", res.attPopupBlockedKeyOk);
  check("Leaving the trial screen stops the animation loop and removes key listeners", res.navLeaveStopsLoopOk);
  check("Dance Crew flow reaches the end of Level 3 without work style or secret path leaks", res.fullDanceLv3EndOk);
}

async function mirrorStep6eCases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const HARDCODED_TEAMS_RE = /Team Kestrel|Team Wren|Team Finch|Team Heron/i;
    const ATTR_ORDER = ["Focus", "Collaboration", "Initiative", "Grit", "Composure"];
    const ATTR_KEYS = ["focus", "collab", "initiative", "grit", "composure"];

    const formatAtt = val => {
      const n = Math.max(0, Math.min(100, typeof val === "number" && Number.isFinite(val) ? val : 0));
      if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
      return n.toFixed(1);
    };
    const formatBoost = val => (Number.isInteger(val) ? String(val) : val.toFixed(1));

    const makeTeam = (tid, size, { allHumans = false, startId = tid * 10 + 1 } = {}) => {
      const members = [];
      for (let i = 0; i < size; i++) {
        const tp = i % 3 === 0 ? "coop" : i % 3 === 1 ? "indep" : "contra";
        members.push(new EP.Player({
          id: startId + i,
          name: "U" + tid + "P" + (i + 1),
          type: tp,
          spend: EP.Bots.typicalSpend(tp),
          isBot: !allHumans && i > 0,
        }));
      }
      return new EP.Team({ id: tid, name: "Unit " + tid, members });
    };

    const advanceToLv3Trial = game => {
      for (let round = 1; round <= 2; round++) {
        game.startNextRound();
        game.advance();
        game.advance();
        game.runTrial();
        game.endTrial();
        game.endGlitchReport();
        game.advance();
        game.advance();
        game.lockIn();
        game.advance();
        game.computeEarnings();
        game.placeAllRemaining();
        game.finishRound();
      }
      game.startNextRound();
      game.advance();
      game.advance();
    };

    const driveSetupAndWrap = (game, team, { extraMiss = false, secLeft = 50, advanceTo = null } = {}) => {
      const guardMax = 40;
      for (let i = 0; i < guardMax; i++) {
        const st = game.mirrorSetupTeam(team);
        if (!st || st.wrappedUp || game.didRun("runTrial")) break;
        const pid = st.currentPlayerId;
        const step = st.currentStep;
        if (step === "cables") {
          if (extraMiss && st.cables.sparks === 0) game.mirrorCableMiss(pid, EP.MirrorData.ports[0]);
          const rem = EP.MirrorData.ports.filter(p => !st.cables.connected.includes(p));
          if (rem.length) game.mirrorCableHit(pid, rem[0]);
        } else if (step === "sound") {
          game.mirrorSoundHeld(pid);
        } else if (step === "mic") {
          if (st.mic.flashing && advanceTo && st.mic.hideAt !== null) {
            advanceTo(st.mic.hideAt);
            game.tick();
          }
          const seq = st.mic.sequence;
          game.mirrorMicTap(pid, seq[st.mic.index]);
        } else if (step === "deck") {
          game.mirrorPickFile(pid, EP.MirrorData.files.find(f => f.correct).name);
        } else if (step === "qa") {
          const qa = game.round.trial.currentQaFor(team);
          game.mirrorAnswerQa(pid, qa.correctIndex);
        } else if (step === "wrapUp") {
          game.mirrorWrapUp(pid, { showtimeSecondsLeft: secLeft });
        }
      }
    };

    // A. Multi-team trial result screen: scores, attention, ranking, tie line, lobby-failed team, own team summary
    let simNow = 12000000;
    const tA1 = makeTeam(1, 4, { allHumans: true });
    const tA2 = makeTeam(2, 4, { allHumans: true });
    const tA3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2, 3].map(i => EP.Bots.makePlayer(31 + i, "Bot3_" + i, "coop")) });
    const tA4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2, 3].map(i => EP.Bots.makePlayer(41 + i, "Bot4_" + i, "indep")) });
    const gA = new EP.Game({ teams: [tA1, tA2, tA3, tA4], rng: EP.Rng.seeded(651), clock: () => simNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gA);
    gA.start();
    // Connect tA1 fully; leave tA2 incomplete so tA2 fails lobby at 30s
    for (const p of tA1.active()) gA.mirrorConnect(p);
    gA.mirrorConnect(tA2.active()[0]);
    simNow += 30000;
    gA.tick(); // closes lobby at 30s -> reveal; tA2 fails lobby
    simNow += 1000;
    gA.tick(); // closes reveal -> showtime
    simNow += 15000;
    gA.tick(); // 60s left in showtime

    // Dance hits and misses/strays on tA1 before wrapping up
    const dIdsA1 = gA.mirrorDanceTeam(tA1).dancers.map(d => d.playerId);
    for (const did of dIdsA1) {
      gA.mirrorDanceHit(did, "perfect");
      gA.mirrorDanceHit(did, "good");
    }
    if (dIdsA1.length) {
      gA.mirrorDanceMiss(dIdsA1[0]);
      gA.mirrorDanceStray(dIdsA1[dIdsA1.length - 1]);
    }
    driveSetupAndWrap(gA, tA1, { extraMiss: true, secLeft: 55, advanceTo: v => { simNow = v; } });

    const rankA = gA.trialRanking();
    const resA1View = MirrorView.screen({
      game: gA, me: tA1.members[0], team: tA1, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "Every player now pays 3 Focus.", onRender: () => {},
    });
    const boxA1 = document.createElement("div");
    boxA1.innerHTML = resA1View.html;
    const textA1 = boxA1.textContent || "";
    const rowsA1 = [...boxA1.querySelectorAll("#mirrorRankTable tbody tr")];
    const rankRowsMatch = rankA.length === 4 && rowsA1.length === 4 && rankA.every((r, i) => {
      const cells = [...rowsA1[i].children].map(td => td.textContent);
      return cells[0] === String(r.place) &&
        cells[1].includes(r.team.name) &&
        cells[2].includes(formatAtt(r.attention) + "%") &&
        cells[3] === r.base + " / 7" &&
        cells[4] === (r.won ? "Win" : "Loss");
    });
    const failedOtherRow = rowsA1.find(tr => Number(tr.dataset.teamId) === tA2.id);
    const failedOtherShownPlainly = !!failedOtherRow &&
      failedOtherRow.dataset.failReason === "lobby" &&
      failedOtherRow.textContent.includes("Failed lobby") &&
      failedOtherRow.textContent.includes("0%") &&
      failedOtherRow.textContent.includes("0 / 7");
    const tieLineOk = (boxA1.querySelector("#mirrorTieRule") || {}).textContent === "Ties: higher exact attention wins, then random.";
    const stA1 = gA.mirrorSetupTeam(tA1);
    const dcA1 = gA.mirrorDanceTeam(tA1);
    const ltA1 = gA.mirrorLobbyTeam(tA1);
    const sumA1Ok = !!boxA1.querySelector("#mirrorTeamSummary") &&
      boxA1.querySelector("#mirrorSumLobby").textContent.includes("Passed (" + ltA1.players.length + " of " + ltA1.players.length) &&
      boxA1.querySelector("#mirrorSumSetup").textContent.includes("5 of 5 steps done (wrapped up)") &&
      boxA1.querySelector("#mirrorSumSetup").textContent.includes("1 hiccup") &&
      boxA1.querySelector("#mirrorSumDance").textContent.includes(dcA1.dancers.length + " dancer") &&
      boxA1.querySelector("#mirrorSumDance").textContent.includes("+" + formatBoost(dcA1.avgBoost)) &&
      boxA1.querySelector("#mirrorSumDance").textContent.includes(formatBoost(dcA1.avgPenalties) + " penalty avg");
    const mineA1 = rankA.find(r => r.team === tA1);
    const winLossA1Ok = !!mineA1 &&
      textA1.includes("Team " + (mineA1.won ? "WIN" : "LOSS") + ". Score " + mineA1.base + " of 7.") &&
      !boxA1.querySelector("#mirrorLobbyFailed");
    const cleanA1 = !LEAK_RE.test(textA1) && !HARDCODED_TEAMS_RE.test(textA1) && !/bot/i.test(textA1) &&
      [...boxA1.querySelectorAll(".flag")].every(el => el.textContent.trim() !== "OK");

    // Own team failed lobby view
    const resA2View = MirrorView.screen({
      game: gA, me: tA2.members[0], team: tA2, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "Cost hint", onRender: () => {},
    });
    const boxA2 = document.createElement("div");
    boxA2.innerHTML = resA2View.html;
    const textA2 = boxA2.textContent || "";
    const mineA2 = rankA.find(r => r.team === tA2);
    const ownLobbyFailOk = !!mineA2 && !mineA2.won && !!boxA2.querySelector("#mirrorLobbyFailed") &&
      textA2.includes("LOBBY FAILED") &&
      textA2.includes("Team LOSS. Score 0 of 7.") &&
      boxA2.querySelector("#mirrorSumLobby").textContent.includes("Failed (1 of 4 connected before doors closed)") &&
      boxA2.querySelector("#mirrorSumSetup").textContent.includes("lobby failed") &&
      boxA2.querySelector("#mirrorSumDance").textContent.includes("lobby failed") &&
      (boxA2.querySelector("#mirrorTieRule") || {}).textContent === "Ties: higher exact attention wins, then random." &&
      !LEAK_RE.test(textA2) && !HARDCODED_TEAMS_RE.test(textA2) && !/bot/i.test(textA2);

    // B. Attention-0 failure result screen and 0-dancer team summary
    let bNow = 13000000;
    const tB1 = makeTeam(1, 3, { allHumans: true });
    tB1.members[1].glitches = 2;
    tB1.members[2].glitches = 2; // only 1 active player -> 1 setup, 0 dancers
    const tB2 = makeTeam(2, 4, { allHumans: true });
    const tB3 = new EP.Team({ id: 3, name: "Unit 3", members: [0, 1, 2].map(i => EP.Bots.makePlayer(31 + i, "Bot3_" + i, "coop")) });
    const tB4 = new EP.Team({ id: 4, name: "Unit 4", members: [0, 1, 2].map(i => EP.Bots.makePlayer(41 + i, "Bot4_" + i, "indep")) });
    const gB = new EP.Game({ teams: [tB1, tB2, tB3, tB4], rng: EP.Rng.seeded(652), clock: () => bNow, hooks: EP.Bots.hooks });
    advanceToLv3Trial(gB);
    gB.start();
    bNow += 16000;
    gB.tick(); // bot teams connect
    for (const p of tB1.active()) gB.mirrorConnect(p);
    for (const p of tB2.active()) gB.mirrorConnect(p);
    bNow = gB.timer.deadline;
    gB.tick(); // reveal -> showtime
    // tB1 wraps up cleanly with 0 dancers
    driveSetupAndWrap(gB, tB1, { secLeft: 65, advanceTo: v => { bNow = v; } });
    // tB2 drains attention to 0
    bNow = gB.timer.deadline - 5000;
    gB.tick();
    const sB2 = gB.mirrorSetupTeam(tB2).currentPlayerId;
    for (let i = 0; i < 6 && gB.mirrorFailReason(tB2) !== "attention"; i++) gB.mirrorCableMiss(sB2, "HDMI");

    const vB1 = MirrorView.screen({
      game: gB, me: tB1.members[0], team: tB1, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "Cost hint", onRender: () => {},
    });
    const boxB1 = document.createElement("div");
    boxB1.innerHTML = vB1.html;
    const zeroDancerSummaryOk = gB.didRun("runTrial") &&
      boxB1.querySelector("#mirrorSumDance b").textContent === "0 dancers · +0 boost avg · −0 penalty avg" &&
      !/NaN/.test(boxB1.textContent) &&
      !LEAK_RE.test(boxB1.textContent);

    const vB2 = MirrorView.screen({
      game: gB, me: tB2.members[0], team: tB2, state: {}, attrName: "Focus",
      sabotageAlert: "", costHint: () => "Cost hint", onRender: () => {},
    });
    const boxB2 = document.createElement("div");
    boxB2.innerHTML = vB2.html;
    const textB2 = boxB2.textContent || "";
    const attnZeroResultOk = !!boxB2.querySelector("#mirrorAttnFailed") &&
      textB2.includes("ROOM EMPTIED") &&
      textB2.includes("Score 0 of 7.") &&
      boxB2.querySelector('#mirrorRankTable tbody tr[data-team-id="' + tB2.id + '"]').textContent.includes("Attention 0%") &&
      (boxB2.querySelector("#mirrorTieRule") || {}).textContent === "Ties: higher exact attention wins, then random." &&
      !LEAK_RE.test(textB2);

    // C & D. Presentation Day Complete (exact L1-L3 history after save/load, boardStatus(), attributes order,
    //        standings, Level 4 locked, Replay & Back to sign-in buttons)
    const savedG = G, savedME = ME, savedMYTEAM = MYTEAM, savedS = S;
    let pdcCoreOk = false, pdcSaveOk = false, legacyNoTrialResultsOk = false, pdcStatusesOk = false, pdcNoLeakOk = false;
    let replayWorksOk = false, signOutWorksOk = false;

    try {
      let cNow = 14000000;
      const cTeams = [1, 2, 3, 4].map(tid => makeTeam(tid, 4, { allHumans: tid === 1 }));
      let gC = new EP.Game({ teams: cTeams, rng: EP.Rng.seeded(653), clock: () => cNow, hooks: EP.Bots.hooks });

      // Play Levels 1, 2, 3 with distinct outcomes for cTeams[0]: L1 WIN, L2 LOSS, L3 WIN (trialWins === 2)
      // Level 1: cTeams[0] scores 7, cTeams[1] scores 6, others lower -> cTeams[0] WIN
      gC.startNextRound(); gC.advance(); gC.advance();
      gC.setSopScore(cTeams[0], 7); gC.setSopScore(cTeams[1], 6); gC.setSopScore(cTeams[2], 1); gC.setSopScore(cTeams[3], 0);
      gC.runTrial();
      gC.endTrial(); gC.endGlitchReport(); gC.advance(); gC.advance(); gC.lockIn(); gC.advance();
      gC.computeEarnings(); gC.placeAllRemaining(); gC.finishRound();

      // Level 2: cTeams[0] empty board (0), cTeams[1..3] lock postTwistAnswer (5) -> cTeams[0] LOSS
      gC.startNextRound(); gC.advance(); gC.advance();
      const sb = gC.splitBrief();
      sb.fireTwist(cTeams);
      for (const tm of [cTeams[1], cTeams[2], cTeams[3]]) {
        sb.setBoard(tm.members[0], sb.postTwistAnswer);
        sb.lockIn(tm.members[0]);
      }
      gC.closeSplitBrief();
      gC.endTrial(); gC.endGlitchReport(); gC.advance(); gC.advance(); gC.lockIn(); gC.advance();
      gC.computeEarnings(); gC.placeAllRemaining(); gC.finishRound();

      // Level 3: cTeams[0] and cTeams[3] pass lobby while cTeams[1] and cTeams[2] fail lobby -> cTeams[0] WIN
      gC.startNextRound(); gC.advance(); gC.advance();
      gC.start();
      for (const p of cTeams[0].active()) gC.mirrorConnect(p);
      for (const p of cTeams[3].active()) gC.mirrorConnect(p);
      cNow += 30000;
      gC.tick(); // cTeams[1] fails lobby
      cNow += 1000;
      gC.tick(); // showtime
      driveSetupAndWrap(gC, cTeams[0], { secLeft: 65, advanceTo: v => { cNow = v; } });
      if (!gC.didRun("runTrial")) {
        cNow += 75000;
        gC.tick();
      }
      gC.endTrial(); gC.endGlitchReport(); gC.advance(); gC.advance(); gC.lockIn(); gC.advance();
      gC.computeEarnings(); gC.placeAllRemaining(); gC.finishRound();

      // Round-trip via toJSON/fromJSON and verify trialResults + teamStandings persist
      const expectedHistory = { 1: true, 2: false, 3: true };
      const gCReloaded = EP.Game.fromJSON(JSON.parse(JSON.stringify(gC.toJSON())), { clock: () => cNow, hooks: EP.Bots.hooks });
      const reloadedMe = gCReloaded.players.find(p => p.id === cTeams[0].members[0].id);
      const reloadedTeam = gCReloaded.teamOf(reloadedMe);
      const rHist = gCReloaded.teamTrialResults(reloadedTeam);
      pdcSaveOk = rHist[1] === true && rHist[2] === false && rHist[3] === true &&
        reloadedTeam.trialWins === 2 &&
        JSON.stringify(gCReloaded.teamStandings().map(s => [s.team.id, s.wins])) ===
          JSON.stringify(gC.teamStandings().map(s => [s.team.id, s.wins]));

      const legacyRaw = JSON.parse(JSON.stringify(gC.toJSON()));
      for (const t of legacyRaw.teams) delete t.trialResults;
      const legacyTeamDirect = EP.Team.fromJSON(legacyRaw.teams[0], new Map(gC.players.map(p => [p.id, p])));
      const legacyGame = EP.Game.fromJSON(legacyRaw, { clock: () => cNow, hooks: EP.Bots.hooks });
      legacyNoTrialResultsOk =
        !!legacyTeamDirect.trialResults &&
        typeof legacyTeamDirect.trialResults === "object" &&
        !Array.isArray(legacyTeamDirect.trialResults) &&
        Object.keys(legacyTeamDirect.trialResults).length === 0 &&
        legacyGame.teams.every(t => !!t.trialResults && typeof t.trialResults === "object" && !Array.isArray(t.trialResults) && Object.keys(t.trialResults).length === 0) &&
        Object.keys(legacyGame.teamTrialResults(legacyGame.teams[0])).length === 0 &&
        Object.keys(legacyTeamDirect.toJSON().trialResults).length === 0;

      const mountPdc = () => {
        G = gCReloaded;
        ME = reloadedMe;
        MYTEAM = reloadedTeam;
        S = {
          ...savedS,
          email: "pdc@icstars.org",
          code: "CYCLE60",
          name: ME.name,
          type: ME.type.key,
          arrived: true,
          step: 9,
          maxStep: 9,
          found: { L: 1 },
        };
        resetRoundUI();
        render();
      };
      mountPdc();

      const pdcText = document.querySelector("#stage").textContent;
      const resPanel = [...document.querySelectorAll("#stage .panel")].find(p => p.textContent.includes("Your trial results"));
      const resRows = resPanel ? [...resPanel.querySelectorAll(".row")] : [];
      const exactHistoryRendered = resRows.length === 3 &&
        resRows[0].textContent.includes("Level 1") && resRows[0].textContent.includes("WIN") &&
        resRows[1].textContent.includes("Level 2") && resRows[1].textContent.includes("LOSS") &&
        resRows[2].textContent.includes("Level 3") && resRows[2].textContent.includes("WIN");
      const attrPanel = [...document.querySelectorAll("#stage .panel")].find(p => p.textContent.includes("Your 5 attributes"));
      const attrTxt = attrPanel ? attrPanel.textContent : "";
      const attrIdx = ATTR_ORDER.map(n => attrTxt.indexOf(n));
      const attrsOrdered = attrIdx.every((p, i) => p >= 0 && (i === 0 || p > attrIdx[i - 1])) &&
        ATTR_KEYS.every((k, i) => attrTxt.includes(ATTR_ORDER[i]) && attrTxt.includes(String(ME.attrs[k])));
      const standings = gCReloaded.teamStandings();
      const sRows = [...document.querySelectorAll("#stage table.levels tbody tr")];
      const standingsOk = sRows.length === standings.length &&
        sRows.every((tr, i) => tr.children[0].textContent === String(standings[i].place) &&
          tr.children[1].textContent.includes(standings[i].team.name) &&
          tr.children[2].textContent.trim() === standings[i].wins + " / 3");
      const lockedBox = document.querySelector("#stage .locked");
      pdcCoreOk = pdcText.includes("Presentation Day Complete") &&
        exactHistoryRendered &&
        pdcText.includes("Hearts: " + ME.hearts.count + "/3") &&
        pdcText.includes("Glitches: " + ME.glitches + "/2") &&
        pdcText.includes(ME.boardStatus()) &&
        attrsOrdered &&
        pdcText.includes(MYTEAM.name) &&
        pdcText.includes("2 / 3 trial wins") &&
        standingsOk &&
        !!lockedBox && lockedBox.textContent.includes("Level 4 locked") && !/Initiative/i.test(lockedBox.textContent) &&
        !!document.querySelector("#replay") && !!document.querySelector("#restart") &&
        !document.querySelector("#nextLevel") &&
        document.querySelector("#navNext").disabled &&
        document.querySelector("#navNext").textContent.includes("Level 4 locked");
      pdcNoLeakOk = !LEAK_RE.test(pdcText) && !HARDCODED_TEAMS_RE.test(pdcText) && !/bot/i.test(pdcText);

      // Check every boardStatus() state renders cleanly (Active, At risk, Glitching, Idle, Stuck; never OK)
      const origGlitches = ME.glitches, origIdle = ME.idle, origAttrs = { ...ME.attrs }, origHearts = ME.hearts.count;
      const seenFlags = {};
      ME.glitches = 0; ME.idle = false; ME.setAttrsForTest({ focus: 4, collab: 4, initiative: 4, grit: 4, composure: 4 }); ME.hearts.refill(3); render();
      seenFlags.Active = document.querySelector("#stage .flag").textContent.trim();
      ME.setAttrsForTest({ focus: 1 }); ME.hearts.empty(); render();
      seenFlags.Risk = document.querySelector("#stage .flag").textContent.trim();
      ME.idle = true; render();
      seenFlags.Idle = document.querySelector("#stage .flag").textContent.trim();
      ME.setAttrsForTest({ focus: -1 }); ME.idle = false; render();
      seenFlags.Glitching = document.querySelector("#stage .flag").textContent.trim();
      ME.glitches = 2; render();
      seenFlags.Stuck = document.querySelector("#stage .flag").textContent.trim();
      ME.glitches = origGlitches; ME.idle = origIdle; ME.setAttrsForTest(origAttrs); ME.hearts.empty(); ME.hearts.refill(origHearts);
      pdcStatusesOk = seenFlags.Active === "Active" && seenFlags.Risk === "At risk" &&
        seenFlags.Idle === "Idle" && seenFlags.Glitching === "Glitching" && seenFlags.Stuck === "Stuck";

      // Test Replay button from Presentation Day Complete
      mountPdc();
      document.querySelector("#replay").click();
      replayWorksOk = G === null && S.step === 3 && S.name === reloadedMe.name && S.email === "pdc@icstars.org" &&
        Object.keys(S.found).length === 0 && !!document.querySelector('[data-type="coop"]');

      // Test Back to sign-in button from Presentation Day Complete
      mountPdc();
      document.querySelector("#restart").click();
      signOutWorksOk = G === null && S.step === 0 && !!document.querySelector("#signForm") &&
        savedName("pdc@icstars.org") === reloadedMe.name;
    } finally {
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      G = savedG; ME = savedME; MYTEAM = savedMYTEAM;
      S = savedS;
      render();
    }

    return {
      rankRowsMatch,
      failedOtherShownPlainly,
      tieLineOk,
      sumA1Ok,
      winLossA1Ok,
      cleanA1,
      ownLobbyFailOk,
      zeroDancerSummaryOk,
      attnZeroResultOk,
      pdcSaveOk,
      legacyNoTrialResultsOk,
      pdcCoreOk,
      pdcNoLeakOk,
      pdcStatusesOk,
      replayWorksOk,
      signOutWorksOk,
    };
  })()`);

  check("Level 3 result screen matches rules scores, exact attention, and ranking", res.rankRowsMatch && res.winLossA1Ok && res.cleanA1);
  check("Level 3 result screen shows tie rule line", res.tieLineOk);
  check("Level 3 result screen plainly shows lobby-failed teams (other and own)", res.failedOtherShownPlainly && res.ownLobbyFailOk);
  check("Level 3 result screen team summary matches rules lobby, setup hiccups, and dance averages", res.sumA1Ok && res.zeroDancerSummaryOk);
  check("Level 3 result screen shows ROOM EMPTIED when attention hits 0%", res.attnZeroResultOk);
  check("Presentation Day Complete preserves exact L1-L3 history across save/load and renders all required sections", res.pdcSaveOk && res.pdcCoreOk && res.pdcNoLeakOk);
  check("Team.fromJSON loads an older save without trialResults as empty", res.legacyNoTrialResultsOk);
  check("Presentation Day Complete shows boardStatus() (Active, At risk, Idle, Glitching, Stuck) and never OK", res.pdcStatusesOk);
  check("Presentation Day Complete Replay and Back to sign-in buttons reset session properly", res.replayWorksOk && res.signOutWorksOk);
}

/* Step 7: Dev jump (Ctrl+Shift+1 to 7) via DEV_JUMP flag, Game.jumpToLevel, and rules fast-forward. */
async function devJumpCases() {
  const sendJump = (n, opts = {}) => w.eval(
    `(() => { const ev = new KeyboardEvent("keydown", { key: String(${n}), code: "Digit${n}", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true, ...${JSON.stringify(opts)} }); const notCancelled = window.dispatchEvent(ev); return { notCancelled, defaultPrevented: ev.defaultPrevented }; })()`
  );
  const noScreenLeak = (lv, stageTxt, hudTxt) => {
    if (LEAK_RE.test(hudTxt || "")) return false;
    if (lv === 7) return !/Cooperative|Independent|Contrarian|Lifeline|Auditor|Exploit|Progress\s*\d+\s*\/\s*\d+/i.test(stageTxt);
    return !LEAK_RE.test(stageTxt);
  };

  try {
    // 1. Flag on by default and jump from Sign-in screen (G === null)
    check("DEV_JUMP flag is enabled in prototype", w.eval("DEV_JUMP === true"));
    w.eval('endSession(); S = fresh(); render();');
    await sleep(20);
    sendJump(3);
    await sleep(20);
    const fromLogin = w.eval('({ hasGame: !!G, level: G && G.level, gStep: G && G.step, sStep: S.step, name: S.name, isBot: ME && ME.isBot, idle: ME && ME.idle, running: G && G.running, timer: G && G.timer, stage: document.querySelector("#stage").textContent, hud: document.querySelector("#hud").textContent })');
    check(
      "Ctrl+Shift+3 from Sign-in creates session and lands on Level 3 Briefing",
      fromLogin.hasGame && fromLogin.level === 3 && fromLogin.gStep === "briefing" &&
        fromLogin.sStep === 5 && fromLogin.name === "Dev" && !fromLogin.isBot && !fromLogin.idle &&
        fromLogin.running && fromLogin.timer === null &&
        fromLogin.stage.includes("The Mirror: Presentation Day") &&
        noScreenLeak(3, fromLogin.stage, fromLogin.hud)
    );

    // 2. Every Ctrl+Shift+1 to 7 lands on a working screen for that level without leaks
    let allSevenLanded = true;
    let allSevenWorked = true;
    let level3IsMirrorLobby = false;
    let level5AutoSubmitted = false;
    let level7ReachedOver = false;
    let sevenDetail = "";

    for (let lv = 1; lv <= 7; lv++) {
      sendJump(lv);
      await sleep(20);
      const st = w.eval(`({ level: G.level, gStep: G.step, sStep: S.step, where: (document.querySelector("#where") || {}).textContent || "", stage: (document.querySelector("#stage") || {}).textContent || "", hud: (document.querySelector("#hud") || {}).textContent || "", navDis: document.querySelector("#navNext").disabled, hdr: BRIEFINGS[${lv}].header, title: BRIEFINGS[${lv}].title })`);
      const landed = st.level === lv && st.gStep === "briefing" && st.sStep === 5 &&
        st.where.includes("Level " + lv) &&
        st.stage.includes(st.hdr) && st.stage.includes(st.title) &&
        !st.navDis && noOkFlags() && noScreenLeak(lv, st.stage, st.hud);
      if (!landed) {
        allSevenLanded = false;
        sevenDetail += ` land${lv}`;
      }

      if (lv < 7) {
        next(); await sleep(15); // -> Open Floor
        const ofStep = w.eval('({ gStep: G.step, sStep: S.step, hasWorld: !!document.querySelector("#world") })');
        finishTimedStep("openFloor"); await sleep(15); // -> Trial
        const tr = w.eval('({ gStep: G.step, sStep: S.step, stage: (document.querySelector("#stage") || {}).textContent || "", hud: (document.querySelector("#hud") || {}).textContent || "", sop: !!document.querySelector("#check"), sb: !!document.querySelector("#splitBoard") && !!document.querySelector("#splitNotesFeed"), mirLobby: !!document.querySelector("#mirrorSignalBtn") && !!document.querySelector("#lobbyCd"), autoBtn: !!document.querySelector("#runAuto"), judged: !!(document.querySelector("#subDraft") || document.querySelector("#castVote")), sub5: G.board().submissions.some(s => s.level === 5) })');
        if (!ofStep.hasWorld || ofStep.gStep !== "openFloor" || tr.gStep !== "trial" || tr.sStep !== 7 || !noScreenLeak(lv, tr.stage, tr.hud)) {
          allSevenWorked = false;
          sevenDetail += ` step${lv}`;
        }
        if (lv === 1 && !tr.sop) { allSevenWorked = false; sevenDetail += " sop1"; }
        if (lv === 2 && !tr.sb) { allSevenWorked = false; sevenDetail += " sb2"; }
        if (lv === 3) {
          level3IsMirrorLobby = tr.mirLobby && tr.stage.includes("PRESENTATION DAY") &&
            !tr.autoBtn && !tr.stage.includes("coming in Step") &&
            w.eval('G.mirrorPhase() === "lobby"') && !/bot/i.test(tr.stage);
          if (!level3IsMirrorLobby) { allSevenWorked = false; sevenDetail += " mir3"; }
        }
        if (lv === 4) {
          if (!tr.autoBtn) { allSevenWorked = false; sevenDetail += " auto4"; }
          else {
            $("#runAuto").click(); await sleep(15);
            if (!w.eval('G.didRun("runTrial")') || $("#navNext").disabled) { allSevenWorked = false; sevenDetail += " run4"; }
          }
        }
        if (lv === 5 && !tr.judged) { allSevenWorked = false; sevenDetail += " judged5"; }
        if (lv === 6) {
          level5AutoSubmitted = tr.sub5;
          if (!tr.judged || !tr.sub5) { allSevenWorked = false; sevenDetail += " judged6"; }
        }
      } else {
        next(); await sleep(15); // -> Graduation
        const gradOk = w.eval('G.step === "graduation" && S.step === 9 && document.querySelector("#stage").textContent.includes("Final Performance Review")');
        for (let i = 0; i < 20; i++) { const b = $$("[data-pinc]").find(x => !x.disabled); if (!b) break; b.click(); await sleep(2); }
        next(); await sleep(15);
        finishTimedStep("graduation"); await sleep(15);
        level7ReachedOver = gradOk && w.eval('G.over === true') &&
          /You exited Floor 60|Contract renewed/.test($("#stage").textContent) &&
          !/Cooperative|Independent|Contrarian|Lifeline|Auditor|Exploit/i.test($("#stage").textContent.replace(/Secret path[\s\S]*?(?=Team standings)/, ""));
        if (!level7ReachedOver) { allSevenWorked = false; sevenDetail += " grad7"; }
      }
    }
    check("Ctrl+Shift+1 to 7 all land on target Briefing without leaks", allSevenLanded, sevenDetail || "1..7 ok");
    check("Ctrl+Shift+1 to 7 all advance onto working trial/graduation screens", allSevenWorked && level5AutoSubmitted && level7ReachedOver, sevenDetail || "1..7 ok");
    check("Jump into Level 3 shows Mirror lobby (not placeholder)", level3IsMirrorLobby);

    // 3. Forward jump keeps the same Game instance and fast-forwards through rules (including mid-Level 3 Showtime)
    sendJump(1); await sleep(15);
    w.eval('window._djG1 = G; window._djMe1 = ME; S.found.L = 1;');
    sendJump(3); await sleep(15);
    const fwd13 = w.eval('({ sameGame: G === window._djG1, sameMe: ME === window._djMe1, level: G.level, step: G.step, keptClue: S.found.L === 1, res1: typeof G.teamTrialResults(MYTEAM)[1] === "boolean", res2: typeof G.teamTrialResults(MYTEAM)[2] === "boolean" })');
    next(); await sleep(15); // Open Floor
    finishTimedStep("openFloor"); await sleep(15); // Mirror Lobby
    // Connect bots + human cleanly into Mirror Showtime via rules clock, then forward-jump to Level 5
    w.eval('(() => { const t0 = G.timer.deadline - 30000; G.tick(t0 + 16000); G.mirrorConnect(ME.id); if (G.timer && G.timer.name === "mirrorReveal") afterClose(G.tick(G.timer.deadline)); else render(); })()');
    await sleep(15);
    const inShowtimeBeforeJump = w.eval('G.mirrorPhase() === "showtime" && !!currentTrialView');
    sendJump(5); await sleep(15);
    const fwd35 = w.eval('({ sameGame: G === window._djG1, level: G.level, gStep: G.step, sStep: S.step, noView: currentTrialView === null, isBot: ME.isBot, idle: ME.idle, res3: typeof G.teamTrialResults(MYTEAM)[3] === "boolean", res4: typeof G.teamTrialResults(MYTEAM)[4] === "boolean" })');
    check(
      "Forward jump keeps same Game and fast-forwards rounds (including from mid-Level 3 Showtime)",
      fwd13.sameGame && fwd13.sameMe && fwd13.level === 3 && fwd13.step === "briefing" &&
        fwd13.keptClue && fwd13.res1 && fwd13.res2 &&
        inShowtimeBeforeJump && fwd35.sameGame && fwd35.level === 5 && fwd35.gStep === "briefing" &&
        fwd35.sStep === 5 && fwd35.noView && !fwd35.isBot && !fwd35.idle && fwd35.res3 && fwd35.res4
    );

    // 4. Same-level and backward jumps start a new Game and fast-forward; partial V[3] creation jump works
    w.eval('window._djG5 = G; S.found.L = 1;');
    sendJump(5); await sleep(15); // same-level jump 5 -> 5
    const sameLv = w.eval('({ newGame: G !== window._djG5, level: G.level, step: G.step, clearedClues: Object.keys(S.found).length === 0, r1: typeof G.teamTrialResults(MYTEAM)[1] === "boolean", r4: typeof G.teamTrialResults(MYTEAM)[4] === "boolean", r5: G.teamTrialResults(MYTEAM)[5] === undefined })');
    w.eval('window._djG5b = G;');
    sendJump(2); await sleep(15); // backward jump 5 -> 2
    const backLv = w.eval('({ newGame: G !== window._djG5b, level: G.level, step: G.step, r1: typeof G.teamTrialResults(MYTEAM)[1] === "boolean", r2: G.teamTrialResults(MYTEAM)[2] === undefined })');
    w.eval('endSession(); S = fresh(); S.email = "dj@icstars.org"; S.code = "CYCLE60"; S.name = "DjTest"; S.step = 3; S.maxStep = 3; S.type = "contra"; render();');
    await sleep(15);
    sendJump(3); await sleep(15);
    const partialCreationOk = w.eval('G.level === 3 && G.step === "briefing" && S.step === 5 && ME.type.key === "contra" && spendLeft() === 0 && JSON.stringify(S.spend) === JSON.stringify(EP.Bots.typicalSpend("contra")) && typeof G.teamTrialResults(MYTEAM)[1] === "boolean" && typeof G.teamTrialResults(MYTEAM)[2] === "boolean"');
    check(
      "Same-level and backward jumps start a new Game and fast-forward cleanly",
      sameLv.newGame && sameLv.level === 5 && sameLv.step === "briefing" && sameLv.clearedClues &&
        sameLv.r1 && sameLv.r4 && sameLv.r5 &&
        backLv.newGame && backLv.level === 2 && backLv.step === "briefing" &&
        backLv.r1 && backLv.r2 && partialCreationOk,
      JSON.stringify({ sameLv, backLv, partialCreationOk })
    );

    // 5. Save and load right after a jump, continue normally, and verify seeded EP.Rng determinism
    sendJump(3); await sleep(15);
    const saveCheck = w.eval(`(() => {
      const snap = JSON.stringify(G.toJSON());
      G = EP.Game.fromJSON(JSON.parse(snap), { hooks: EP.Bots.hooks });
      ME = G.players.find(p => p.id === ME.id);
      MYTEAM = G.teamOf(ME);
      const snapAfter = JSON.stringify(G.toJSON());
      const stateOk = snap === snapAfter && G.level === 3 && G.step === "briefing" && G.running === true && G.timer === null;
      resetRoundUI();
      render();
      return { stateOk };
    })()`);
    next(); await sleep(15); // Open Floor
    const afterLoadOf = w.eval('G.step === "openFloor" && G.timer && G.timer.name === "openFloor"');
    finishTimedStep("openFloor"); await sleep(15); // Mirror Lobby
    const afterLoadMir = w.eval('G.step === "trial" && G.mirrorPhase() === "lobby" && !!document.querySelector("#mirrorSignalBtn") && !!document.querySelector("#lobbyCd")');
    const detCheck = w.eval(`(() => {
      const mk = () => {
        const g = EP.Bots.soloGame({
          me: { name: "Det", type: "coop", spend: EP.Bots.typicalSpend("coop") },
          myTeam: { name: "Alpha", mates: ["M1", "M2", "M3"] },
          others: [{ name: "Beta", players: ["B1", "B2", "B3", "B4"] }, { name: "Gamma", players: ["C1", "C2", "C3", "C4"] }, { name: "Delta", players: ["D1", "D2", "D3", "D4"] }],
          rng: EP.Rng.seeded(999),
          hooks: EP.Bots.hooks,
        }).game;
        g._timer.clock = () => 100000;
        g.jumpToLevel(7);
        return JSON.stringify(g.toJSON());
      };
      const a = mk(), b = mk();
      const reloaded = EP.Game.fromJSON(JSON.parse(a), { clock: () => 100000, hooks: EP.Bots.hooks });
      return a === b && JSON.stringify(reloaded.toJSON()) === a && reloaded.level === 7 && reloaded.step === "briefing";
    })()`);
    check(
      "Save/load right after dev jump matches identically, continues normally, and uses seeded EP.Rng",
      saveCheck.stateOk && afterLoadOf && afterLoadMir && detCheck
    );

    // 6. With DEV_JUMP flag off, keys and devJump() do nothing
    sendJump(2); await sleep(15);
    w.eval('window._djKeep = G; DEV_JUMP = false;');
    const rOff3 = sendJump(3);
    await sleep(10);
    const rOff1 = sendJump(1);
    await sleep(10);
    w.eval('devJump(5);');
    await sleep(10);
    const offOk = w.eval('G === window._djKeep && G.level === 2 && G.step === "briefing" && S.step === 5') &&
      !rOff3.defaultPrevented && rOff3.notCancelled && !rOff1.defaultPrevented && rOff1.notCancelled;
    w.eval('DEV_JUMP = true;');
    check("With DEV_JUMP flag off, Ctrl+Shift+1..7 keys do nothing", offOk);

    // 7. Attendance popup swallows Ctrl+Shift+N while open (no sleep before keydown so 1s ATT.tick cannot close it first)
    next(); await sleep(10); // -> Open Floor (unpaused step)
    w.eval('ATT.show("popup", "<h2>Still there?</h2><p>Test</p>");');
    const attBefore = w.eval('ATT.isOpen()');
    const attKey = sendJump(4);
    await sleep(15);
    const attSwallowed = w.eval('!ATT.isOpen() && G === window._djKeep && G.level === 2 && G.step === "openFloor"');
    check(
      "Attendance popup swallows Ctrl+Shift+N without jumping",
      attBefore && attKey.defaultPrevented && !attKey.notCancelled && attSwallowed,
      JSON.stringify({ attBefore, attKey, attSwallowed, lv: w.eval("G.level"), step: w.eval("G.step") })
    );
  } finally {
    w.eval('DEV_JUMP = true; ATT.close(); delete window._djG1; delete window._djMe1; delete window._djG5; delete window._djG5b; delete window._djKeep; endSession(); S = fresh(); render();');
  }
}

/* Step 8: Level 3 mid-trial save/reload (lobby, reveal, reveal catch-up, Setup, Dance, showtime catch-up),
   live-stage lobby doors-close fail, and dev jump cleanup from mid-Level 3 Dance Showtime. */
async function mirrorStep8Cases() {
  const res = w.eval(`(() => {
    const LEAK_RE = /Cooperative|Independent|Contrarian|Secret path|Lifeline|Auditor|Exploit/i;
    const HARDCODED_TEAMS_RE = /Team Kestrel|Team Wren|Team Finch|Team Heron/i;
    const KEY_BY_DIR = { left: "ArrowLeft", up: "ArrowUp", right: "ArrowRight", down: "ArrowDown" };
    const formatAtt = val => {
      const n = Math.max(0, Math.min(100, typeof val === "number" && Number.isFinite(val) ? val : 0));
      return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
    };
    const noOk = () => [...document.querySelectorAll("#stage .flag")].every(el => el.textContent.trim() !== "OK");
    const stageClean = () => {
      const txt = (document.querySelector("#stage") || {}).textContent || "";
      return !LEAK_RE.test(txt) && !/bot/i.test(txt) && noOk();
    };
    const rankTableMatches = game => {
      const rank = game.trialRanking();
      const rows = [...document.querySelectorAll("#mirrorRankTable tbody tr")];
      return rank.length > 0 && rows.length === rank.length && rank.every((r, i) => {
        const c = [...rows[i].children].map(td => td.textContent);
        return c[0] === String(r.place) &&
          c[1].includes(r.team.name) &&
          c[2].includes(formatAtt(r.attention) + "%") &&
          c[3] === r.base + " / 7" &&
          c[4] === (r.won ? "Win" : "Loss");
      });
    };

    const makeLv3Session = (seed, getNow) => {
      const sess = EP.Bots.soloGame({
        me: { name: "Step8Me", type: "coop", spend: EP.Bots.typicalSpend("coop") },
        myTeam: { name: "Unit Alpha", mates: TEAM.map(p => p.n) },
        others: [
          { name: "Unit Beta", players: ["B1", "B2", "B3", "B4"] },
          { name: "Unit Gamma", players: ["C1", "C2", "C3", "C4"] },
          { name: "Unit Delta", players: ["D1", "D2", "D3", "D4"] },
        ],
        rng: EP.Rng.seeded(seed),
        hooks: EP.Bots.hooks,
      });
      const g = sess.game;
      g._timer.clock = getNow;
      for (let round = 1; round <= 2; round++) {
        g.startNextRound();
        g.advance();
        g.advance();
        g.runTrial();
        g.endTrial();
        g.endGlitchReport();
        g.advance();
        g.advance();
        g.lockIn();
        g.advance();
        g.computeEarnings();
        g.placeAllRemaining();
        g.finishRound();
      }
      g.startNextRound();
      g.advance();
      g.advance();
      g.start();
      return sess;
    };

    const mountStage = (game, me, team, step = 7) => {
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      G = game;
      ME = me;
      MYTEAM = team;
      S = {
        ...fresh(),
        email: "step8@icstars.org",
        code: "CYCLE60",
        name: ME.name,
        type: ME.type.key,
        spend: EP.Bots.typicalSpend(ME.type.key),
        arrived: true,
        step,
        maxStep: Math.max(5, step),
      };
      resetRoundUI();
      render();
    };

    const origRaf = window.requestAnimationFrame;
    const origCancel = window.cancelAnimationFrame;
    const prevRainOn = typeof rainOn === "boolean" ? rainOn : false;
    if (typeof rainOn === "boolean") rainOn = false;
    let nextRafId = 1;
    const rafQueue = new Map();
    window.requestAnimationFrame = cb => {
      if (cb && cb.name === "rainFrame") return 0;
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    };
    window.cancelAnimationFrame = id => { rafQueue.delete(id); };
    const flushRaf = ts => {
      const batch = [...rafQueue.entries()];
      rafQueue.clear();
      for (const [, cb] of batch) cb(ts);
    };

    const sendJump = n => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: String(n), code: "Digit" + n, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
    }));

    try {
      // 1. Mid-lobby save/reload restores countdown, miss speed, and connected bots on stage
      let simNow = 20000000;
      const lobbySess = makeLv3Session(801, () => simNow);
      mountStage(lobbySess.game, lobbySess.me, lobbySess.team, 7);
      for (let i = 0; i < 60; i++) {
        const cur = document.querySelector("#mirrorSigCursor");
        if (cur && !cur.classList.contains("hot")) break;
        drawTimer();
      }
      document.querySelector("#mirrorSignalBtn").click();
      const earliestBotSec = Math.min(...G.mirror().botConnectTimes(MYTEAM).map(b => b.seconds));
      simNow += earliestBotSec * 1000;
      let cl = G.tick();
      if (cl.length) afterClose(cl); else drawTimer();
      const preLobbySnap = JSON.parse(JSON.stringify(G.toJSON()));
      const preBtn = document.querySelector("#mirrorSignalBtn");
      const preBotConnectedIds = G.mirrorLobbyTeam(MYTEAM).players.filter(p => p.playerId !== ME.id && p.connected).map(p => p.playerId);
      const preSpeed = preBtn.dataset.speed;
      const preZone = preBtn.dataset.zone;
      const preSecsLeft = G.secondsLeft();

      const reloadedLobbyG = EP.Game.fromJSON(preLobbySnap, { clock: () => simNow, hooks: EP.Bots.hooks });
      const reloadedLobbyMe = reloadedLobbyG.players.find(p => p.id === lobbySess.me.id);
      const reloadedLobbyTeam = reloadedLobbyG.teamOf(reloadedLobbyMe);
      mountStage(reloadedLobbyG, reloadedLobbyMe, reloadedLobbyTeam, 7);
      const postBtn = document.querySelector("#mirrorSignalBtn");
      const postBotTilesOk = preBotConnectedIds.length >= 1 && preBotConnectedIds.every(id => {
        const el = document.querySelector('[data-lobby-player="' + id + '"]');
        return !!el && el.classList.contains("in");
      });
      const lobbyReloadRestoredOk = G.mirrorPhase() === "lobby" &&
        (document.querySelector("#lobbyCd") || {}).textContent === preSecsLeft + "s" &&
        !!postBtn && postBtn.dataset.misses === "1" &&
        postBtn.dataset.speed === preSpeed && postBtn.dataset.zone === preZone &&
        (document.querySelector("#mirrorLobbyCount") || {}).textContent === (preBotConnectedIds.length + " of " + MYTEAM.active().length + " connected") &&
        postBotTilesOk && stageClean();

      simNow += Math.max(0, 16 - earliestBotSec) * 1000;
      cl = G.tick();
      if (cl.length) afterClose(cl); else drawTimer();
      for (let i = 0; i < 80; i++) {
        const cur = document.querySelector("#mirrorSigCursor");
        if (cur && cur.classList.contains("hot")) break;
        drawTimer();
      }
      document.querySelector("#mirrorSignalBtn").click();
      const midLobbyOk = lobbyReloadRestoredOk && G.mirrorPhase() === "reveal";

      // 2. Mid-reveal save/reload restores Crew Reveal and catches up into Showtime past deadline
      const snapReveal = JSON.parse(JSON.stringify(G.toJSON()));
      const preSlots = JSON.stringify(G.mirrorSetupSlots(MYTEAM));
      const preCrew = JSON.stringify(G.mirrorCrew(MYTEAM));
      const revG = EP.Game.fromJSON(snapReveal, { clock: () => simNow, hooks: EP.Bots.hooks });
      const revMe = revG.players.find(p => p.id === reloadedLobbyMe.id);
      const revTeam = revG.teamOf(revMe);
      mountStage(revG, revMe, revTeam, 7);
      const revealRestoredOk = G.mirrorPhase() === "reveal" &&
        !!document.querySelector("#mirrorCrewReveal") &&
        document.querySelector("#stage").textContent.includes("CREW LOCKED") &&
        JSON.stringify(G.mirrorSetupSlots(MYTEAM)) === preSlots &&
        JSON.stringify(G.mirrorCrew(MYTEAM)) === preCrew &&
        document.querySelectorAll("[data-setup-slot]").length === JSON.parse(preSlots).length &&
        document.querySelectorAll("[data-dance-player]").length === JSON.parse(preCrew).danceIds.length &&
        stageClean();

      const lateRevNow = snapReveal.timer.deadline + 200;
      const lateRevG = EP.Game.fromJSON(snapReveal, { clock: () => lateRevNow, hooks: EP.Bots.hooks });
      const lateRevMe = lateRevG.players.find(p => p.id === reloadedLobbyMe.id);
      const lateRevTeam = lateRevG.teamOf(lateRevMe);
      mountStage(lateRevG, lateRevMe, lateRevTeam, 7);
      const revealCatchupOk = G.mirrorPhase() === "showtime" &&
        !document.querySelector("#mirrorCrewReveal") &&
        !!document.querySelector("#attnBar") &&
        !!document.querySelector("#mirrorSetupFrame") &&
        stageClean();
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();

      // 3. Mid-showtime Setup save/reload restores step, penalties, seeded deck state, and attention on stage
      let tNow = 21000000;
      let setupSess = null;
      for (let seed = 1; seed <= 40; seed++) {
        tNow = 21000000 + seed * 100000;
        const cand = makeLv3Session(seed, () => tNow);
        tNow += 16000;
        cand.game.tick();
        cand.game.mirrorConnect(cand.me);
        tNow = cand.game.timer.deadline;
        cand.game.tick();
        const slots = cand.game.mirrorSetupSlots(cand.team);
        if (slots.length === 2 && slots[1].playerId === cand.me.id) {
          setupSess = cand;
          break;
        }
      }
      mountStage(setupSess.game, setupSess.me, setupSess.team, 7);
      for (let sec = 0; sec < 30; sec++) {
        const st = G.mirrorSetupTeam(MYTEAM);
        if (st && st.currentStep === "deck") break;
        tNow += 1000;
        const c = G.tick();
        if (c.length) afterClose(c); else drawTimer();
      }
      const wrongFileIdx = EP.MirrorData.files.findIndex(f => !f.correct);
      document.querySelector('[data-file="' + wrongFileIdx + '"]').click();
      const stBeforeDeck = G.mirrorSetupTeam(MYTEAM);
      const attBeforeDeck = Math.round(G.mirrorAttention(MYTEAM));
      const snapSetup = JSON.parse(JSON.stringify(G.toJSON()));
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();

      const relSetupG = EP.Game.fromJSON(snapSetup, { clock: () => tNow, hooks: EP.Bots.hooks });
      const relSetupMe = relSetupG.players.find(p => p.id === setupSess.me.id);
      const relSetupTeam = relSetupG.teamOf(relSetupMe);
      mountStage(relSetupG, relSetupMe, relSetupTeam, 7);
      const stAfterDeck = G.mirrorSetupTeam(MYTEAM);
      const domOrderAfter = [...document.querySelectorAll("[data-file]")].map(b => Number(b.dataset.file));
      const wrongBtnAfter = document.querySelector('[data-file="' + wrongFileIdx + '"]');
      const midSetupReloadOk = G.mirrorPhase() === "showtime" &&
        !!document.querySelector("#mirrorDeckStep") &&
        JSON.stringify(domOrderAfter) === JSON.stringify(stBeforeDeck.deck.fileOrder) &&
        JSON.stringify(stAfterDeck.deck.fileOrder) === JSON.stringify(stBeforeDeck.deck.fileOrder) &&
        stAfterDeck.penalties === stBeforeDeck.penalties &&
        (document.querySelector("#attnPct") || {}).textContent === attBeforeDeck + "%" &&
        !!wrongBtnAfter && wrongBtnAfter.disabled && wrongBtnAfter.classList.contains("bad") &&
        ["cables", "sound", "mic"].every(k => document.querySelector('[data-setup-step="' + k + '"]').dataset.stepState === "done") &&
        document.querySelector('[data-setup-step="deck"]').dataset.stepState === "live" &&
        stageClean();

      // 4. Reloaded Setup flow completes deck, Q&A, wrap up, and reaches Presentation Day Complete without leaks
      const signedIdx = EP.MirrorData.files.findIndex(f => f.correct);
      document.querySelector('[data-file="' + signedIdx + '"]').click();
      for (let q = 0; q < EP.MirrorData.qaItems.length; q++) {
        const stQ = G.mirrorSetupTeam(MYTEAM);
        if (!stQ || stQ.currentStep !== "qa") break;
        const item = EP.MirrorData.qaItems[stQ.qa.order[stQ.qa.index]];
        document.querySelector('[data-qa="' + item.correctIndex + '"]').click();
      }
      document.querySelector("#wrapUp").click();
      const setupTrialResultOk = G.didRun("runTrial") &&
        !!document.querySelector("#mirrorResult") &&
        rankTableMatches(G) &&
        !document.querySelector("#navNext").disabled &&
        stageClean();

      goForward(); // -> Glitch Report (step 8)
      document.querySelector("#skipAcc").click();
      if (G.timer && G.timer.name === "glitchReport") {
        tNow = G.timer.deadline;
        afterClose(G.tick());
      }
      if (G.timer && G.timer.name === "giftWindow") {
        tNow = G.timer.deadline;
        afterClose(G.tick());
      }
      const gwAutoAdvancedOk = S.step === 9 && G.step === "statsUpdate";
      for (let i = 0; i < 15; i++) {
        const pInc = document.querySelector("[data-pinc]:not([disabled])");
        if (!pInc) break;
        pInc.click();
      }
      goForward(); // -> Presentation Day Complete
      if (G.timer && G.timer.name === "statsUpdate") {
        tNow = G.timer.deadline;
        afterClose(G.tick());
      }
      const pdcTxt = (document.querySelector("#stage") || {}).textContent || "";
      const resPanel = [...document.querySelectorAll("#stage .panel")].find(p => p.textContent.includes("Your trial results"));
      const resRows = resPanel ? [...resPanel.querySelectorAll(".row")] : [];
      const setupReachesPdcOk = setupTrialResultOk &&
        gwAutoAdvancedOk &&
        G.level === 3 && G.step === "intermission" && roundDone() &&
        pdcTxt.includes("Presentation Day Complete") &&
        resRows.length === 3 &&
        pdcTxt.includes("Level 4 locked") &&
        !!document.querySelector("#replay") &&
        !!document.querySelector("#restart") &&
        !HARDCODED_TEAMS_RE.test(pdcTxt) &&
        stageClean();

      // 5. Mid-showtime Dance Crew save/reload restores boost, penalties, and setup progress then finishes on bot wrap up
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();
      let dNow = 23000000;
      let danceSess = null;
      for (let seed = 1; seed <= 40; seed++) {
        dNow = 23000000 + seed * 100000;
        const cand = makeLv3Session(seed, () => dNow);
        dNow += 16000;
        cand.game.tick();
        cand.game.mirrorConnect(cand.me);
        dNow = cand.game.timer.deadline;
        cand.game.tick();
        if (cand.game.mirrorRole(cand.me) === "dance") {
          danceSess = cand;
          break;
        }
      }
      mountStage(danceSess.game, danceSess.me, danceSess.team, 7);
      flushRaf(1000);
      for (let i = 1; i <= 10; i++) {
        dNow += 250;
        G.tick();
        flushRaf(1000 + i * 250);
      }
      const perfNote = document.querySelector('[data-note-zone="perfect"]');
      if (perfNote) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: KEY_BY_DIR[perfNote.dataset.noteDir], bubbles: true, cancelable: true }));
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      dNow += 5000;
      const clD5 = G.tick();
      if (clD5.length) afterClose(clD5); else drawTimer();
      const preDanceAtt = Math.round(G.mirrorAttention(MYTEAM));
      const preDanceTeam = G.mirrorDanceTeam(MYTEAM);
      const preDanceBoostStr = (document.querySelector("#teamDanceBoost") || {}).textContent;
      const preDancePenStr = (document.querySelector("#teamDancePen") || {}).textContent;
      const snapDanceNow = dNow;
      const snapDance = JSON.parse(JSON.stringify(G.toJSON()));
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();

      let rNow = snapDanceNow;
      const relDanceG = EP.Game.fromJSON(snapDance, { clock: () => rNow, hooks: EP.Bots.hooks });
      const relDanceMe = relDanceG.players.find(p => p.id === danceSess.me.id);
      const relDanceTeam = relDanceG.teamOf(relDanceMe);
      mountStage(relDanceG, relDanceMe, relDanceTeam, 7);
      const danceReloadRestoredOk = !!document.querySelector("#mirrorDancePanel") &&
        !!document.querySelector("#lane") &&
        rafQueue.size === 1 &&
        (document.querySelector("#myDanceBoost") || {}).textContent.includes("+3 / 45") &&
        (document.querySelector("#danceHits") || {}).textContent === "1" &&
        (document.querySelector("#danceStrays") || {}).textContent === "1" &&
        (document.querySelector("#teamDanceBoost") || {}).textContent === preDanceBoostStr &&
        (document.querySelector("#teamDancePen") || {}).textContent === preDancePenStr &&
        (document.querySelector("#attnPct") || {}).textContent === preDanceAtt + "%" &&
        G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).boost === 3 &&
        preDanceTeam.dancers.length === G.mirrorDanceTeam(MYTEAM).dancers.length &&
        document.querySelector('[data-setup-step="cables"]').dataset.stepState === "done" &&
        stageClean();

      flushRaf(6000);
      for (let i = 1; i <= 10 && !document.querySelector('[data-note-zone="perfect"]'); i++) {
        rNow += 250;
        G.tick();
        flushRaf(6000 + i * 250);
      }
      const perfNote2 = document.querySelector('[data-note-zone="perfect"]');
      if (perfNote2) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: KEY_BY_DIR[perfNote2.dataset.noteDir], bubbles: true, cancelable: true }));
      }
      const boostAfter2ndHit = G.mirrorDanceTeam(MYTEAM).dancers.find(d => d.playerId === ME.id).boost;
      for (let s = 0; s < 45 && !G.didRun("runTrial"); s++) {
        rNow += 1000;
        const c = G.tick();
        if (c.length) afterClose(c); else drawTimer();
      }
      const danceFinishesOk = danceReloadRestoredOk &&
        boostAfter2ndHit === 6 &&
        G.didRun("runTrial") &&
        !document.querySelector("#lane") &&
        rafQueue.size === 0 &&
        !!document.querySelector("#mirrorResult") &&
        rankTableMatches(G) &&
        !document.querySelector("#navNext").disabled &&
        stageClean();

      // 6. Mid-showtime save/reload past deadline catches up to closed trial result on stage
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();
      const lateShowNow = snapDance.timer.deadline + 1000;
      const lateShowG = EP.Game.fromJSON(snapDance, { clock: () => lateShowNow, hooks: EP.Bots.hooks });
      const lateShowMe = lateShowG.players.find(p => p.id === danceSess.me.id);
      const lateShowTeam = lateShowG.teamOf(lateShowMe);
      mountStage(lateShowG, lateShowMe, lateShowTeam, 7);
      const showtimeCatchupOk = G.didRun("runTrial") &&
        !!document.querySelector("#mirrorResult") &&
        rankTableMatches(G) &&
        !document.querySelector("#navNext").disabled &&
        stageClean();

      // 7. Live-stage lobby doors-close fail scores 0, shows LOBBY FAILED, and unlocks All-hands
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();
      let failNow = 25000000;
      const failSess = makeLv3Session(809, () => failNow);
      mountStage(failSess.game, failSess.me, failSess.team, 7);
      failNow += 29000;
      const cl29 = G.tick();
      if (cl29.length) afterClose(cl29); else drawTimer();
      const openAt29Ok = G.mirrorPhase() === "lobby" &&
        (document.querySelector("#lobbyCd") || {}).textContent === "1s" &&
        document.querySelector("#navNext").disabled;
      failNow += 1000;
      const cl30 = G.tick();
      if (cl30.length) afterClose(cl30); else drawTimer();
      const failRank = G.trialRanking();
      const failMine = failRank.find(r => r.team === MYTEAM);
      const failRow = document.querySelector('#mirrorRankTable tbody tr[data-team-id="' + MYTEAM.id + '"]');
      const failResTxt = (document.querySelector("#mirrorResult") || {}).textContent || "";
      const lobbyFailStageOk = openAt29Ok &&
        G.didRun("runTrial") &&
        G.mirrorFailReason(MYTEAM) === "lobby" &&
        !!failMine && failMine.base === 0 && failMine.attention === 0 && failMine.failReason === "lobby" &&
        !!document.querySelector("#mirrorLobbyFailed") &&
        document.querySelector("#mirrorLobbyFailed").textContent.includes("LOBBY FAILED") &&
        failResTxt.includes("Score 0 of 7.") &&
        rankTableMatches(G) &&
        !!failRow && failRow.dataset.failReason === "lobby" &&
        failRow.textContent.includes("Failed lobby") && failRow.textContent.includes("0%") && failRow.textContent.includes("0 / 7") &&
        !document.querySelector("#navNext").disabled &&
        /All-hands/.test(document.querySelector("#navNext").textContent) &&
        stageClean();
      goForward();
      const lobbyFailAdvancesOk = lobbyFailStageOk && G.step === "glitchReport" && S.step === 8;

      // 8. Backward and same-level dev jump from mid-Level 3 Dance Showtime cleans up loop and starts fresh Game
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      currentTrialView = null;
      rafQueue.clear();
      const djDanceG = EP.Game.fromJSON(snapDance, { clock: () => snapDanceNow, hooks: EP.Bots.hooks });
      const djDanceMe = djDanceG.players.find(p => p.id === danceSess.me.id);
      const djDanceTeam = djDanceG.teamOf(djDanceMe);
      mountStage(djDanceG, djDanceMe, djDanceTeam, 7);
      const mountedDanceOk = !!document.querySelector("#lane") && rafQueue.size === 1;
      const oldG = G, oldTeam = MYTEAM, oldMe = ME;
      const oldStraysBefore = oldG.mirrorDanceTeam(oldTeam).dancers.find(d => d.playerId === oldMe.id).strays;

      sendJump(3); // same-level jump from mid-Level 3 Dance Showtime
      const jump3G = G;
      const sameLvCleanupOk = mountedDanceOk &&
        G !== oldG &&
        G.level === 3 && G.step === "briefing" && S.step === 5 &&
        currentTrialView === null &&
        rafQueue.size === 0 &&
        !document.querySelector("#lane") &&
        stageClean();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      const oldListenerRemovedOk = oldG.mirrorDanceTeam(oldTeam).dancers.find(d => d.playerId === oldMe.id).strays === oldStraysBefore;

      sendJump(1); // backward jump 3 -> 1
      const back1Ok = G !== oldG && G !== jump3G &&
        G.level === 1 && G.step === "briefing" && S.step === 5 &&
        document.querySelector("#stage").textContent.includes("Boot Up: Team Week") &&
        stageClean();

      return {
        midLobbyOk,
        revealRestoredOk,
        revealCatchupOk,
        midSetupReloadOk,
        setupReachesPdcOk,
        danceFinishesOk,
        showtimeCatchupOk,
        lobbyFailAdvancesOk,
        devJumpCleanupOk: sameLvCleanupOk && oldListenerRemovedOk && back1Ok,
      };
    } finally {
      window.requestAnimationFrame = origRaf;
      window.cancelAnimationFrame = origCancel;
      if (typeof rainOn === "boolean") {
        rainOn = prevRainOn;
        if (prevRainOn && typeof origRaf === "function") origRaf(rainFrame);
      }
      if (currentTrialView && currentTrialView.cleanup) currentTrialView.cleanup();
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Level 3 mid-lobby save/reload restores countdown, miss speed, and connected bots on stage", res.midLobbyOk);
  check("Level 3 mid-reveal save/reload restores Crew Reveal and catches up into Showtime past deadline", res.revealRestoredOk && res.revealCatchupOk);
  check("Level 3 mid-showtime Setup save/reload restores step, penalties, seeded deck state, and attention on stage", res.midSetupReloadOk);
  check("Reloaded Level 3 Setup flow completes deck, Q&A, wrap up, and reaches Presentation Day Complete without leaks", res.setupReachesPdcOk);
  check("Level 3 mid-showtime Dance Crew save/reload restores boost, penalties, and setup progress then finishes on bot wrap up", res.danceFinishesOk);
  check("Level 3 mid-showtime save/reload past deadline catches up to closed trial result on stage", res.showtimeCatchupOk);
  check("Level 3 live-stage lobby doors-close fail scores 0, shows LOBBY FAILED, and unlocks All-hands", res.lobbyFailAdvancesOk);
  check("Backward and same-level dev jump from mid-Level 3 Dance Showtime cleans up loop and starts fresh Game", res.devJumpCleanupOk);
}

/* Step 1: Attendance injected clock and server-ready tick (V-18, V-19). */
async function attendanceClockAndTickCases() {
  const attSrc = fs.readFileSync(path.join(repo, "attendance-view.js"), "utf8");
  check("attendance-view.js has no Date.now()", !/\bDate\.now\b/.test(attSrc));
  check("attendance-view.js has no setInterval", !/\bsetInterval\b/.test(attSrc));
  check("attendance-view.js uses performance.now() for mouse-move throttle", /\bperformance\.now\s*\(\)/.test(attSrc));

  const res = w.eval(`(() => {
    const origPerfNow = window.performance.now.bind(window.performance);
    const origPerfDesc = Object.getOwnPropertyDescriptor(window.performance, "now");
    let fakePerf = origPerfNow() + 2000;
    Object.defineProperty(window.performance, "now", { configurable: true, writable: true, value: () => fakePerf });
    try {
      let simNow = 10000000;
      const sess = EP.Bots.soloGame({
        me: { name: "AttMe", type: "coop", spend: EP.Bots.typicalSpend("coop") },
        myTeam: { name: "Team Kestrel", mates: TEAM.map(p => p.n) },
        others: OTHERS.map(o => ({ name: o.t, players: o.p })),
        rng: EP.Rng.seeded(105),
        hooks: EP.Bots.hooks,
      });
      const g = sess.game;
      g._timer.clock = () => simNow;
      const human2 = sess.team.members[1];
      human2.isBot = false;
      g.start();
      g.startNextRound();
      g.advance(); // -> openFloor (Attendance active for both humans)

      G = g;
      ME = sess.me;
      MYTEAM = sess.team;
      S = {
        ...fresh(),
        email: "att@icstars.org",
        code: "CYCLE60",
        name: ME.name,
        type: ME.type.key,
        spend: EP.Bots.typicalSpend(ME.type.key),
        arrived: true,
        step: 6,
        maxStep: 6,
      };
      resetRoundUI();
      render();

      simNow = 10059000;
      const before60 = G.checkAttendance();
      simNow = 10060000;
      const at60 = G.checkAttendance();
      const defaultClockPopupOk = before60.length === 0 &&
        at60.length === 2 &&
        at60.every(e => e.state === "popup" && e.msLeft === 15000);

      ATT.sync(at60);
      const syncShowOk = ATT.isOpen() &&
        ATT.kind() === "popup" &&
        (document.querySelector("#attSec") || {}).textContent === "15";

      simNow = 10065000;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA", bubbles: true, cancelable: true }));
      const keyUsesGameClockOk = !ATT.isOpen() && ME.lastActivity === 10065000;

      simNow = 10075000;
      const poll75 = G.pollAttendance();
      const h2Miss = poll75.find(e => e.player === human2);
      const closedTabOtherHumanMissedOk = !!h2Miss &&
        h2Miss.state === "missed" &&
        human2.idle === true &&
        human2.attendancePending === true &&
        !ME.idle &&
        !ME.attendancePending;

      simNow = 10125000;
      drawTimer();
      const popupAt15Ok = ATT.isOpen() &&
        ATT.kind() === "popup" &&
        (document.querySelector("#attSec") || {}).textContent === "15";

      simNow = 10130000;
      drawTimer();
      const popupCountdownOk = ATT.isOpen() &&
        ATT.kind() === "popup" &&
        (document.querySelector("#attSec") || {}).textContent === "10";

      simNow = 10140000;
      drawTimer();
      const missShownOk = ME.idle === true &&
        ME.attendancePending === true &&
        ATT.isOpen() &&
        ATT.kind() === "missed" &&
        ((document.querySelector("#attT") || {}).parentElement || {}).textContent.includes("You missed the check-in. You are Glitching.");

      document.querySelector("#attOk").click();
      const okClickClearsOk = !ATT.isOpen() && !ME.idle && ME.lastActivity === 10140000;

      simNow = 10145000;
      window.dispatchEvent(new Event("pointermove"));
      const move1Ok = ME.lastActivity === 10145000;

      simNow = 10146000;
      fakePerf += 500;
      window.dispatchEvent(new Event("pointermove"));
      const moveThrottledOk = ME.lastActivity === 10145000;

      fakePerf += 500;
      window.dispatchEvent(new Event("pointermove"));
      const moveAfterThrottleOk = ME.lastActivity === 10146000;

      simNow = 10206000;
      drawTimer();
      const openBeforePause = ATT.isOpen() && ATT.kind() === "popup";
      G.advance();
      G.runTrial();
      G.endTrial(); // -> glitchReport (paused step)
      drawTimer();
      const pauseClosesPopupOk = openBeforePause && !ATT.isOpen() && ME.attendancePaused === true;

      return {
        defaultClockPopupOk,
        syncShowOk,
        keyUsesGameClockOk,
        closedTabOtherHumanMissedOk,
        popupAt15Ok,
        popupCountdownOk,
        missShownOk,
        okClickClearsOk,
        moveThrottleOk: move1Ok && moveThrottledOk && moveAfterThrottleOk,
        pauseClosesPopupOk,
      };
    } finally {
      if (origPerfDesc) Object.defineProperty(window.performance, "now", origPerfDesc);
      else delete window.performance.now;
      ATT.close();
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Game.checkAttendance() defaults to Game clock and checks all human players", res.defaultClockPopupOk);
  check("AttendanceView.sync() displays popup from Game.pollAttendance() and key answer uses Game clock", res.syncShowOk && res.keyUsesGameClockOk);
  check("Game.pollAttendance() checks other human players even with no open tab", res.closedTabOtherHumanMissedOk);
  check("drawTimer() polls attendance, updates popup countdown, shows missed dialog, and OK clears idle", res.popupAt15Ok && res.popupCountdownOk && res.missShownOk && res.okClickClearsOk);
  check("attendance-view.js 1s mouse-move throttle uses performance.now() while Game.activity uses Game clock", res.moveThrottleOk);
  check("Entering a paused step closes open Attendance popup cleanly", res.pauseClosesPopupOk);
}

/* Step 2: Game clock sync, Gift Window auto-advance, and timer banner alignment (V-01, V-02, V-11). */
async function timerBannerAndSyncCases() {
  const res = w.eval(`(() => {
    try {
      endSession();
      S = fresh();
      S.email = "step2@icstars.org";
      S.code = "CYCLE60";
      S.name = "Step2Me";
      S.draft = "Step2Me";
      S.type = "coop";
      S.spend = EP.Bots.typicalSpend("coop");
      S.step = 3;
      S.maxStep = 3;
      render();

      // 1. Arrival cutscene does not start the game clock
      goForward(); // -> Step 4 arrival cutscene (elev)
      const elevNoClockOk = S.step === 4 && !S.arrived &&
        G.running === false &&
        G.timerView() === null &&
        document.querySelector("#banner").hidden === true;

      skipArrival(); // -> role briefing
      const roleLines = ROLE_BRIEF[S.type].lines.length;
      for (let i = 0; i < roleLines; i++) arrivalAdvance();
      if (!S.arrived) arrivalAdvance();
      const lobbyNoClockOk = S.step === 4 && S.arrived === true &&
        G.running === false &&
        G.timerView() === null &&
        document.querySelector("#banner").hidden === true;

      // Clicking Start Level 1 starts the game clock and enters Briefing (untimed)
      goForward();
      const startLevelStartsClockOk = S.step === 5 && G.level === 1 && G.step === "briefing" &&
        G.running === true &&
        G.timerView() === null &&
        document.querySelector("#banner").hidden === true;

      let simNow = 20000000;
      G._timer.clock = () => simNow;

      goForward(); // -> Open Floor (90s)
      const tvOpen = G.timerView();
      const openFloorBannerOk = S.step === 6 && G.step === "openFloor" &&
        !!tvOpen && tvOpen.name === "openFloor" && tvOpen.secondsLeft === 90 &&
        document.querySelector("#banner").hidden === false &&
        document.querySelector("#bannerT").textContent === "Open Floor" &&
        document.querySelector("#tmr").textContent === "1:30";

      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME); // -> SOP Trial
      G.setSopBoard(ME, EP.Trial.SopTrial.STEPS);
      render();
      document.querySelector("#check").click();
      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME);
      goForward(); // -> Glitch Report (30s)

      const tvGlitch0 = G.timerView();
      const glitchStartBannerOk = S.step === 8 && G.step === "glitchReport" &&
        !!tvGlitch0 && tvGlitch0.name === "glitchReport" && tvGlitch0.secondsLeft === 30 &&
        document.querySelector("#banner").hidden === false &&
        document.querySelector("#bannerT").textContent === "Glitch Report" &&
        document.querySelector("#tmr").textContent === "0:30" &&
        !document.querySelector("#gwTmr");

      // Mutating returned timerView object does not mutate Game state
      tvGlitch0.secondsLeft = 999;
      tvGlitch0.name = "bogus";
      const timerViewReadOnlyOk = G.timerView().name === "glitchReport" && G.timerView().secondsLeft === 30;

      simNow += 12000;
      drawTimer();
      const tvGlitch18 = G.timerView();
      const glitchTickBannerOk = !!tvGlitch18 && tvGlitch18.name === "glitchReport" && tvGlitch18.secondsLeft === 18 &&
        document.querySelector("#bannerT").textContent === "Glitch Report" &&
        document.querySelector("#tmr").textContent === "0:18";

      // Banner reads strictly from G.timerView(), never guessing from S.step (even if S.step lags)
      S.step = 7;
      render();
      const bannerIgnoresStaleStepOk = document.querySelector("#banner").hidden === false &&
        document.querySelector("#bannerT").textContent === "Glitch Report" &&
        document.querySelector("#tmr").textContent === "0:18";

      // Closing Glitch Report timer syncs S.step to G.step (8) and updates banner to Gift Window
      simNow += 18000;
      afterClose(G.tick());
      const tvGift0 = G.timerView();
      const glitchCloseSyncsOk = S.step === 8 && G.step === "giftWindow" &&
        !!tvGift0 && tvGift0.name === "giftWindow" && tvGift0.secondsLeft === 30 &&
        document.querySelector("#banner").hidden === false &&
        document.querySelector("#bannerT").textContent === "Gift Window" &&
        document.querySelector("#tmr").textContent === "0:30" &&
        (document.querySelector("#gwTmr") || {}).textContent === "0:30";

      simNow += 10000;
      drawTimer();
      const giftTickOk = G.timerView().secondsLeft === 20 &&
        document.querySelector("#bannerT").textContent === "Gift Window" &&
        document.querySelector("#tmr").textContent === "0:20" &&
        (document.querySelector("#gwTmr") || {}).textContent === "0:20";

      // Gift Window auto-advances All-Hands to Stats Update when it closes; banner matches G.timerView()
      simNow += 20000;
      afterClose(G.tick());
      const tvStats0 = G.timerView();
      const giftAutoAdvanceOk = S.step === 9 && G.step === "statsUpdate" &&
        !!tvStats0 && tvStats0.name === "statsUpdate" && tvStats0.secondsLeft === 30 &&
        document.querySelector("#banner").hidden === false &&
        document.querySelector("#bannerT").textContent === "Stats Update" &&
        document.querySelector("#tmr").textContent === "0:30" &&
        !document.querySelector("#gwTmr");

      simNow += 11000;
      drawTimer();
      const tvStats19 = G.timerView();
      const statsTickBannerOk = !!tvStats19 && tvStats19.name === "statsUpdate" && tvStats19.secondsLeft === 19 &&
        document.querySelector("#bannerT").textContent === "Stats Update" &&
        document.querySelector("#tmr").textContent === "0:19";

      // Stats Update close ends round (intermission) and hides banner
      simNow += 19000;
      afterClose(G.tick());
      const statsCloseBannerOk = S.step === 9 && G.step === "intermission" && roundDone() &&
        G.timerView() === null &&
        document.querySelector("#banner").hidden === true;

      return {
        arrivalNoClockOk: elevNoClockOk && lobbyNoClockOk && startLevelStartsClockOk,
        openFloorBannerOk,
        glitchBannerOk: glitchStartBannerOk && timerViewReadOnlyOk && glitchTickBannerOk && bannerIgnoresStaleStepOk,
        giftBannerAndSyncOk: glitchCloseSyncsOk && giftTickOk,
        giftAutoAdvanceAndStatsOk: giftAutoAdvanceOk && statsTickBannerOk && statsCloseBannerOk,
      };
    } finally {
      elevTimers.forEach(clearTimeout);
      elevTimers = [];
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Arrival cutscene does not start game clock until Start Level 1", res.arrivalNoClockOk);
  check("Open Floor banner reads label and countdown from Game.timerView()", res.openFloorBannerOk);
  check("Glitch Report banner label and seconds match Game.timerView() even if S.step lags", res.glitchBannerOk);
  check("Timer close syncs S.step to G.step and Gift Window banner matches Game.timerView()", res.giftBannerAndSyncOk);
  check("All-Hands auto-advances to Stats Update on Gift Window close and Stats Update banner matches Game.timerView()", res.giftAutoAdvanceAndStatsOk);
}

/* Step 3a: Level 3 seeds (Lobby cursor, Cables bag, Sound Check spikes and jitter) from MirrorTrial's seeded Rng (V-28, V-32, V-33). */
async function mirrorStep3aSeedCases() {
  const mvSrc = fs.readFileSync(path.join(repo, "mirror-view.js"), "utf8");
  check("mirror-view.js has no Math.random()", !/\bMath\.random\b/.test(mvSrc));
  check("mirror-view.js has no shuffleArr", !/\bshuffleArr\b/.test(mvSrc));

  const res = w.eval(`(() => {
    const startLv3 = (seed, getNow) => {
      const sess = EP.Bots.soloGame({
        me: { name: "Step3a", type: "coop", spend: EP.Bots.typicalSpend("coop") },
        myTeam: { name: "Team Kestrel", mates: TEAM.map(p => p.n) },
        others: OTHERS.map(o => ({ name: o.t, players: o.p })),
        rng: EP.Rng.seeded(seed),
        hooks: EP.Bots.hooks,
      });
      const g = sess.game;
      g._timer.clock = getNow;
      for (let round = 1; round <= 2; round++) {
        g.startNextRound();
        g.advance();
        g.advance();
        g.runTrial();
        g.endTrial();
        g.endGlitchReport();
        g.advance();
        g.advance();
        g.lockIn();
        g.advance();
        g.computeEarnings();
        g.placeAllRemaining();
        g.finishRound();
      }
      g.startNextRound();
      g.advance();
      g.advance();
      g.start();
      return sess;
    };

    const runTrace = seed => {
      let now = 30000000;
      const sess = startLv3(seed, () => now);
      const g = sess.game;
      let me = sess.me, team = sess.team;
      const rngBeforeLobby = g.rng.getState();

      const state = {};
      const box = document.createElement("div");
      let view = null;
      const remount = () => {
        if (view && view.cleanup) view.cleanup();
        view = MirrorView.screen({
          game: g, me, team, state, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost", onRender: remount,
        });
        box.innerHTML = view.html;
        if (view.bind) view.bind(box);
      };
      remount();

      const cursorStart = g.mirrorLobbyCursorStart(me);
      const btn0 = box.querySelector("#mirrorSignalBtn");
      const pos0 = btn0 ? Number(btn0.dataset.pos) : null;
      view.tick();
      const pos1 = btn0 ? Number(btn0.dataset.pos) : null;
      const rngAfterLobby = g.rng.getState();

      // Reload lobby and verify cursorStart stays identical
      const lobbySnap = JSON.parse(JSON.stringify(g.toJSON()));
      const gLobRel = EP.Game.fromJSON(lobbySnap, { clock: () => now, hooks: EP.Bots.hooks });
      const meLobRel = gLobRel.players.find(p => p.id === me.id);
      const cursorReload = gLobRel.mirrorLobbyCursorStart(meLobRel);

      // Connect all teammates -> reveal -> showtime, pick a Setup player for cables/sound
      now += 16000;
      g.tick();
      g.mirrorConnect(me);
      now = g.timer.deadline;
      g.tick();
      const slots = g.mirrorSetupSlots(team);
      const setupOwner = team.members.find(p => p.id === slots[0].playerId);
      me = setupOwner;
      const showState = {};
      let showView = null;
      const mountShow = (gameObj, playerObj, teamObj) => {
        if (showView && showView.cleanup) showView.cleanup();
        showView = MirrorView.screen({
          game: gameObj, me: playerObj, team: teamObj, state: showState, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost", onRender: () => mountShow(gameObj, playerObj, teamObj),
        });
        box.innerHTML = showView.html;
        if (showView.bind) showView.bind(box);
      };
      mountShow(g, setupOwner, team);

      const rngBeforeCables = g.rng.getState();
      const spawnedPorts = [];
      for (let t = 0; t < 30; t++) {
        showView.tick();
        const latest = showState.mirror && showState.mirror.cables.belt[showState.mirror.cables.belt.length - 1];
        if (latest && !spawnedPorts.some(x => x.id === latest.id)) {
          spawnedPorts.push({ id: latest.id, port: latest.port });
        }
      }
      const rngAfterCables = g.rng.getState();
      for (const port of EP.MirrorData.ports) g.mirrorCableHit(setupOwner, port);
      mountShow(g, setupOwner, team);

      const rngBeforeSound = g.rng.getState();
      const prevHooks = g.hooks;
      g.hooks = {};
      const soundLevels = [];
      const spikeMsgs = [];
      for (let t = 0; t < 25; t++) {
        now += 250;
        g.tick();
        showView.tick();
        soundLevels.push(Number((box.querySelector("#soundVal") || {}).textContent));
        const msgTxt = (box.querySelector("#mirrorMsg") || {}).textContent || "";
        if (msgTxt.includes("whoops")) spikeMsgs.push(t);
      }
      g.hooks = prevHooks;
      const rngAfterSound = g.rng.getState();
      if (showView && showView.cleanup) showView.cleanup();
      if (view && view.cleanup) view.cleanup();

      return {
        cursorStart,
        pos0,
        pos1,
        cursorReload,
        spawnedPorts: spawnedPorts.map(x => x.port),
        soundLevels,
        spikeMsgs,
        rngIsolated: rngBeforeLobby === rngAfterLobby &&
          rngBeforeCables === rngAfterCables &&
          rngBeforeSound === rngAfterSound,
      };
    };

    try {
      const a = runTrace(3102);
      const b = runTrace(3102);
      const c = runTrace(3109);

      // Verify mid-showtime Game save/reload continues exact nextCable and nextSoundSpike/Jitter via Game
      let nowS = 31000000;
      const sessS = startLv3(3105, () => nowS);
      const gS = sessS.game;
      nowS += 16000;
      gS.tick();
      gS.mirrorConnect(sessS.me);
      nowS = gS.timer.deadline;
      gS.tick();
      const tS = sessS.team;
      const ownerS = tS.members.find(p => p.id === gS.mirrorSetupSlots(tS)[0].playerId);
      gS.mirrorNextCable(tS);
      gS.mirrorReturnCable(tS, "VGA");
      const snapMidCab = JSON.parse(JSON.stringify(gS.toJSON()));
      const gCabLoad = EP.Game.fromJSON(snapMidCab, { clock: () => nowS, hooks: EP.Bots.hooks });
      const tCabLoad = gCabLoad.teamOf(gCabLoad.players.find(p => p.id === ownerS.id));
      const cabContA = [gS.mirrorNextCable(tS).port, gS.mirrorNextCable(tS).port, gS.mirrorNextCable(tS).port];
      const cabContB = [gCabLoad.mirrorNextCable(tCabLoad).port, gCabLoad.mirrorNextCable(tCabLoad).port, gCabLoad.mirrorNextCable(tCabLoad).port];

      for (const port of EP.MirrorData.ports) {
        gS.mirrorCableHit(ownerS, port);
        gCabLoad.mirrorCableHit(gCabLoad.players.find(p => p.id === ownerS.id), port);
      }
      gS.mirrorNextSoundSpike(tS);
      gCabLoad.mirrorNextSoundSpike(tCabLoad);
      const sndContA = [gS.mirrorNextSoundJitter(tS).jitter, gS.mirrorNextSoundSpike(tS), gS.mirrorNextSoundJitter(tS).jitter];
      const sndContB = [gCabLoad.mirrorNextSoundJitter(tCabLoad).jitter, gCabLoad.mirrorNextSoundSpike(tCabLoad), gCabLoad.mirrorNextSoundJitter(tCabLoad).jitter];

      return {
        cursorMatchOk: !!a.cursorStart &&
          a.pos0 === a.cursorStart.pos &&
          JSON.stringify(a.cursorStart) === JSON.stringify(a.cursorReload) &&
          JSON.stringify(a.cursorStart) === JSON.stringify(b.cursorStart) &&
          a.pos1 === b.pos1 &&
          (a.pos0 !== c.pos0 || a.cursorStart.dir !== c.cursorStart.dir),
        cablesMatchOk: a.spawnedPorts.length >= 4 &&
          JSON.stringify(a.spawnedPorts) === JSON.stringify(b.spawnedPorts),
        soundMatchOk: a.soundLevels.length === 25 &&
          JSON.stringify(a.soundLevels) === JSON.stringify(b.soundLevels) &&
          JSON.stringify(a.spikeMsgs) === JSON.stringify(b.spikeMsgs) &&
          a.spikeMsgs.length >= 1,
        rngIsolatedOk: a.rngIsolated && b.rngIsolated,
        saveContinueOk: JSON.stringify(cabContA) === JSON.stringify(cabContB) &&
          JSON.stringify(sndContA) === JSON.stringify(sndContB),
      };
    } finally {
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Same seed repeats Mirror lobby cursor start/motion via Game pass-through and preserves on reload", res.cursorMatchOk);
  check("Same seed repeats Mirror Cables spawn sequence via Game pass-through", res.cablesMatchOk);
  check("Same seed repeats Mirror Sound Check spikes and jitter via Game pass-through", res.soundMatchOk);
  check("Mirror lobby cursor, Cables bag, and Sound Check draws never advance Game.rng", res.rngIsolatedOk);
  check("Mid-trial save/reload continues identical Cables bag and Sound Check spike/jitter sequences", res.saveContinueOk);
}

/* Step 3b: Level 3 Setup deadlines owned by SetupCrew and checked in Game.tick() (V-27, V-29, V-30, V-31). */
async function mirrorStep3bDeadlineCases() {
  const mvSrc = fs.readFileSync(path.join(repo, "mirror-view.js"), "utf8");
  const mutCalls = /\bmirrorTimeoutQa\b|\bmirrorReshuffleDeck\b|\bmirrorSoundHeld\b|\bmirrorSoundFeedback\b/;
  const screenTickFields = /\bms\.qa\b|\bms\.deck\b|\bms\.mic\b|\bms\.sound\b/;
  check("mirror-view.js has no calls to mirrorTimeoutQa, mirrorReshuffleDeck, mirrorSoundHeld, or mirrorSoundFeedback", !mutCalls.test(mvSrc));
  check("mirror-view.js has no ms.qa, ms.deck, ms.mic, or ms.sound tick state", !screenTickFields.test(mvSrc));

  const res = w.eval(`(() => {
    try {
      let simNow = 35000000;
      const sess = EP.Bots.soloGame({
        me: { name: "Step3b", type: "coop", spend: EP.Bots.typicalSpend("coop") },
        myTeam: { name: "Team Kestrel", mates: TEAM.map(p => p.n) },
        others: OTHERS.map(o => ({ name: o.t, players: o.p })),
        rng: EP.Rng.seeded(3201),
        hooks: EP.Bots.hooks,
      });
      const g = sess.game;
      g._timer.clock = () => simNow;
      for (let round = 1; round <= 2; round++) {
        g.startNextRound();
        g.advance();
        g.advance();
        g.runTrial();
        g.endTrial();
        g.endGlitchReport();
        g.advance();
        g.advance();
        g.lockIn();
        g.advance();
        g.computeEarnings();
        g.placeAllRemaining();
        g.finishRound();
      }
      g.startNextRound();
      g.advance();
      g.advance();
      g.start();
      simNow += 16000;
      g.tick();
      g.mirrorConnect(sess.me);
      simNow = g.timer.deadline;
      g.tick();

      const team = sess.team;
      const slots = g.mirrorSetupSlots(team);
      const owner = team.members.find(p => p.id === slots[0].playerId);
      const box = document.createElement("div");
      const state = {};
      let view = null;
      const remount = () => {
        if (view && view.cleanup) view.cleanup();
        view = MirrorView.screen({
          game: g, me: owner, team, state, attrName: "Focus",
          sabotageAlert: "", costHint: () => "Cost", onRender: remount,
        });
        box.innerHTML = view.html;
        if (view.bind) view.bind(box);
      };
      remount();

      for (const port of EP.MirrorData.ports) g.mirrorCableHit(owner, port);
      remount();

      // Screen view.tick() alone without G.tick() does not advance Sound level or fire deadlines
      const lvl0 = Number((box.querySelector("#soundVal") || {}).textContent);
      for (let i = 0; i < 15; i++) view.tick();
      const viewTickOnlyNoChangeOk = Number((box.querySelector("#soundVal") || {}).textContent) === lvl0 &&
        g.mirrorSetupTeam(team).currentStep === "sound";

      // G.tick() drives Sound hold -> Mic -> Deck -> Q&A cleanly
      for (let i = 0; i < 80 && g.mirrorSetupTeam(team).currentStep === "sound"; i++) {
        const curLvl = Number((box.querySelector("#soundVal") || {}).textContent);
        if (curLvl < 74) box.querySelector('[data-sound-gain="' + (curLvl <= 68 ? "10" : "5") + '"]').click();
        else if (curLvl > 85) box.querySelector('[data-sound-gain="-10"]').click();
        simNow += 250;
        g.tick();
        view.tick();
      }
      const soundHeldByGameTickOk = g.mirrorSetupTeam(team).currentStep === "mic";

      // View.tick() alone does not hide Mic flash; G.tick() hides it
      for (let i = 0; i < 15; i++) view.tick();
      const micStillFlashingNoGameTick = box.querySelector("#micSeqDisp").dataset.flashing === "1";
      const micHideAt = g.mirrorSetupView(owner).mic.hideAt;
      simNow = micHideAt;
      g.tick();
      view.tick();
      const micHiddenByGameTickOk = box.querySelector("#micSeqDisp").dataset.flashing === "0";

      if (view && view.cleanup) view.cleanup();
      return {
        viewTickOnlyNoChangeOk,
        soundHeldByGameTickOk,
        micStillFlashingNoGameTick,
        micHiddenByGameTickOk,
      };
    } finally {
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("MirrorView tick() alone never mutates Sound level or hides Mic flash without Game.tick()", res.viewTickOnlyNoChangeOk && res.micStillFlashingNoGameTick);
  check("Game.tick() drives Sound hold and Mic flash hide into MirrorView via Game.mirrorSetupView()", res.soundHeldByGameTickOk && res.micHiddenByGameTickOk);
}

/* Step 4: Level 3 Dance Crew note chart, tempo seed, and miss/idle gating into DanceCrew / MirrorTrial (V-35, V-36, V-37). */
async function mirrorStep4DanceCases() {
  const mdSrc = fs.readFileSync(path.join(repo, "mirror-dance-view.js"), "utf8");
  const forbidden = /\bMath\.random\b|\bDate\.now\b|\bnew Date\b/;
  const screenJudges = /\bmirrorDanceHit\b|\bmirrorDanceMiss\b|\bmirrorDanceStray\b|\bstepMotion\b|\binitDanceState\b/;
  check("mirror-dance-view.js has no Math.random, Date.now, or new Date", !forbidden.test(mdSrc));
  check("mirror-dance-view.js has no mirrorDanceHit/Miss/Stray or screen note-chart helpers", !screenJudges.test(mdSrc));

  const res = w.eval(`(() => {
    try {
      const startShow = (seed, getNow) => {
        const sess = EP.Bots.soloGame({
          me: { name: "Step4D", type: "coop", spend: EP.Bots.typicalSpend("coop") },
          myTeam: { name: "Team Kestrel", mates: TEAM.map(p => p.n) },
          others: OTHERS.map(o => ({ name: o.t, players: o.p })),
          rng: EP.Rng.seeded(seed),
          hooks: EP.Bots.hooks,
        });
        const g = sess.game;
        g._timer.clock = getNow;
        for (let round = 1; round <= 2; round++) {
          g.startNextRound();
          g.advance();
          g.advance();
          g.runTrial();
          g.endTrial();
          g.endGlitchReport();
          g.advance();
          g.advance();
          g.lockIn();
          g.advance();
          g.computeEarnings();
          g.placeAllRemaining();
          g.finishRound();
        }
        g.startNextRound();
        g.advance();
        g.advance();
        g.start();
        return sess;
      };

      const findDanceSeed = start => {
        for (let s = start; s < start + 50; s++) {
          let n = 40000000;
          const sess = startShow(s, () => n);
          n += 16000; sess.game.tick();
          sess.game.mirrorConnect(sess.me);
          n = sess.game.timer.deadline; sess.game.tick();
          if (sess.game.mirrorRole(sess.me) === "dance") return s;
        }
        throw new Error("No dance seed");
      };

      const s1 = findDanceSeed(3300);
      const runSample = seed => {
        let now = 41000000;
        const sess = startShow(seed, () => now);
        const g = sess.game;
        now += 16000; g.tick();
        g.mirrorConnect(sess.me);
        now = g.timer.deadline; g.tick();
        const seq = [];
        for (let t = 0; t <= 40; t++) {
          const dv = g.mirrorDanceView(sess.me);
          if (dv) for (const note of dv.notes) if (!seq.some(x => x.id === note.id)) seq.push({ id: note.id, dir: note.dir, t0: note.t0 });
          now += 250; g.tick();
          const cur = g.mirrorDanceView(sess.me);
          const p = cur && cur.notes.find(x => x.zone === "perfect");
          if (p) g.mirrorDancePress(sess.me, p.dir);
        }
        return { seq, view: g.mirrorDanceView(sess.me) };
      };
      const rA = runSample(s1);
      const rB = runSample(s1);
      const sameSeedChartOk = rA.seq.length >= 6 && JSON.stringify(rA.seq) === JSON.stringify(rB.seq);

      // Mid-dance save/reload restores chart, spawnedCount, and tempo gapTicks identically
      let nowS = 42000000;
      const sessS = startShow(s1, () => nowS);
      const gS = sessS.game;
      nowS += 16000; gS.tick();
      gS.mirrorConnect(sessS.me);
      nowS = gS.timer.deadline; gS.tick();
      for (let t = 0; t < 30; t++) {
        nowS += 250; gS.tick();
        const p = gS.mirrorDanceView(sessS.me).notes.find(x => x.zone === "perfect");
        if (p) gS.mirrorDancePress(sessS.me, p.dir);
      }
      const viewPre = gS.mirrorDanceView(sessS.me);
      const snap = JSON.parse(JSON.stringify(gS.toJSON()));
      const gR = EP.Game.fromJSON(snap, { clock: () => nowS, hooks: EP.Bots.hooks });
      const viewPost = gR.mirrorDanceView(sessS.me.id);
      const saveRestoreOk = viewPre.spawnedCount === viewPost.spawnedCount &&
        viewPre.gapTicks === viewPost.gapTicks &&
        JSON.stringify(viewPre.notes) === JSON.stringify(viewPost.notes);

      // Idle dancer gets 0 misses and presses are rejected
      let nowI = 43000000;
      const sessI = startShow(s1, () => nowI);
      const gI = sessI.game;
      nowI += 16000; gI.tick();
      gI.mirrorConnect(sessI.me);
      nowI = gI.timer.deadline; gI.tick();
      sessI.me.idle = true;
      nowI += 10000;
      gI.tick();
      const idleView = gI.mirrorDanceView(sessI.me);
      const idleRej = gI.mirrorDancePress(sessI.me, "left");
      const idleGateOk = idleView.misses === 0 && idleView.penalties === 0 && !idleRej.ok;

      return { sameSeedChartOk, saveRestoreOk, idleGateOk };
    } finally {
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Same seed produces identical Mirror Dance chart via Game.mirrorDanceView()", res.sameSeedChartOk);
  check("Mid-dance save/reload restores chart, spawnedCount, and tempo via Game.mirrorDanceView()", res.saveRestoreOk);
  check("Idle human dancer gets 0 misses on Game.tick() and mirrorDancePress rejects idle players", res.idleGateOk);
}

/* Step 5: Back button locked on S.step >= 5 (V-04), human-to-bot gifts answered via Bots.hooks.onGift (V-05),
   and clicks never close timed steps early (V-03). */
async function step5CleanupCases() {
  const gameSrc = fs.readFileSync(path.join(repo, "game.js"), "utf8");
  const noDirectBotAnswer = !/\bBots\.answer\b/.test(gameSrc);
  const closeTimerLines = gameSrc.split(/\r?\n/).filter(l => /\bcloseTimer\b/.test(l));
  const onlyStartLevelClosesTimer = closeTimerLines.length === 1 && /function startLevel/.test(closeTimerLines[0]);
  check("game.js has no EP.Bots.answer call and calls closeTimer only in startLevel()", noDirectBotAnswer && onlyStartLevelClosesTimer);

  const res = w.eval(`(() => {
    try {
      endSession();
      S = fresh();
      S.email = "step5@icstars.org";
      S.code = "CYCLE60";
      S.name = "StepFive";
      S.draft = "StepFive";

      // 1. Pre-game Back works on steps 1..4 before entering live game
      S.step = 1; S.maxStep = 1; render();
      const back1Ok = canBack() && !document.querySelector("#navBack").disabled;
      S.step = 2; S.maxStep = 2; render();
      const back2Ok = canBack() && !document.querySelector("#navBack").disabled;
      S.step = 3; S.maxStep = 3; render();
      const back3Ok = canBack() && !document.querySelector("#navBack").disabled;
      S.type = "coop";
      S.spend = EP.Bots.typicalSpend("coop");
      goForward(); // -> step 4 arrival
      skipArrival();
      while (!S.arrived) arrivalAdvance();
      const back4Ok = canBack() && !document.querySelector("#navBack").disabled;

      // Start Level 1 (starts game clock) -> Briefing (step 5)
      goForward();
      let simNow = 60000000;
      G._timer.clock = () => simNow;
      G.activity(ME);

      const checkBackBlocked = expectedStep => {
        const beforeStep = S.step;
        const can = canBack();
        const dis = document.querySelector("#navBack").disabled;
        document.querySelector("#navBack").click();
        return beforeStep === expectedStep && !can && dis && S.step === expectedStep && S.step === stepForGame();
      };

      const back5Ok = checkBackBlocked(5);

      // 2. Open Floor (timed 90s): Back off, Forward disabled and does not close step until timer runs out
      goForward(); // -> Open Floor (step 6)
      const back6Ok = checkBackBlocked(6);
      const ofWaitBtn = document.querySelector("#navNext");
      const ofClicksBlocked = G.step === "openFloor" && ofWaitBtn.disabled && !fwd().ok;
      goForward();
      const ofStillOpen = G.step === "openFloor" && S.step === 6 && G.timerView().name === "openFloor";
      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME);

      // 3. SOP Trial (timed 60s): Back off, Submit SOP saves board + shows waiting state without closing timer
      const back7Ok = checkBackBlocked(7);
      for (const stepText of EP.Trial.SopTrial.STEPS) {
        const idx = sopPile().indexOf(stepText);
        if (idx >= 0) {
          const btn = document.querySelector('[data-pile="' + idx + '"]');
          if (btn) btn.click();
        }
      }
      document.querySelector("#check").click();
      const sopWaitOk = G.step === "trial" && !G.didRun("runTrial") &&
        G.timerView() && G.timerView().name === "sop" &&
        !document.querySelector("#banner").hidden &&
        !!document.querySelector("#sopWait") &&
        S.sop.submitted === true;
      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME);
      const sopClosedOnTimer = G.didRun("runTrial");

      // Advance untimed trial result -> Glitch Report (timed 30s)
      goForward(); // -> step 8
      const back8Ok = checkBackBlocked(8);

      // 4. Glitch Report: Skip saves choice + shows waiting state without closing timer
      document.querySelector("#skipAcc").click();
      const grWaitOk = G.step === "glitchReport" && !G.didRun("endGlitchReport") &&
        G.timerView() && G.timerView().name === "glitchReport" &&
        !document.querySelector("#banner").hidden &&
        !!document.querySelector("#accWait") &&
        S.acc.done === true;
      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME);
      render();

      // 5. Gift Window: UI human-to-bot gift is answered via Bots.hooks.onGift
      const botTarget = MYTEAM.mates(ME).find(m => m.isBot && !m.isStuck() && m.type.canAcceptGifts()) ||
        MYTEAM.mates(ME).find(m => m.isBot && !m.isStuck());
      const giftBtn = botTarget ? document.querySelector('[data-gift="' + botTarget.name + '"][data-pts="1"]') : null;
      let giftHookOk = false;
      if (giftBtn && !giftBtn.disabled) {
        giftBtn.click();
        const sentGift = G.round.gifts.find(x => x.giver === ME && x.receiver === botTarget);
        giftHookOk = !!sentGift && sentGift.status !== "pending";
      } else {
        const resG = G.gift(ME, botTarget, 1);
        giftHookOk = resG.ok && resG.gift.status !== "pending";
      }
      simNow = G.timer.deadline;
      afterClose(G.tick());
      G.activity(ME);

      // 6. Stats Update (timed 30s): Back off, Lock In saves picks + shows waiting state without closing timer
      const back9Ok = checkBackBlocked(9);
      for (let i = 0; i < 20; i++) {
        const b = document.querySelector("[data-pinc]:not([disabled])");
        if (!b) break;
        b.click();
      }
      goForward(); // Lock in points
      const statsWaitOk = G.step === "statsUpdate" && !G.didRun("finishRound") &&
        ME.earned === 0 && ME.placedThisRound > 0 &&
        G.timerView() && G.timerView().name === "statsUpdate" &&
        !document.querySelector("#banner").hidden &&
        !!document.querySelector("#statsWait");
      simNow = G.timer.deadline;
      afterClose(G.tick());
      const statsClosedOnTimer = G.step === "intermission" && roundDone();

      // 7. Accuse path in Glitch Report also waits for timer
      devJump(1);
      G._timer.clock = () => simNow;
      G.activity(ME);
      goForward(); // -> openFloor
      simNow = G.timer.deadline; afterClose(G.tick()); G.activity(ME); // -> trial
      simNow = G.timer.deadline; afterClose(G.tick()); G.activity(ME); // close sop
      goForward(); // -> glitchReport
      G.activity(ME);
      render();
      const mateOpt = document.querySelector("#accSel option[value]:not([value=''])") || [...document.querySelectorAll("#accSel option")].find(o => o.textContent && !o.textContent.includes("Choose"));
      if (mateOpt) document.querySelector("#accSel").value = mateOpt.textContent;
      document.querySelector("#accuse").click();
      const accWaitOk = G.step === "glitchReport" && !G.didRun("endGlitchReport") &&
        G.timerView() && G.timerView().name === "glitchReport" &&
        !!document.querySelector("#accWait") && S.acc.done === true;

      // 8. Graduation (timed 60s): Lock in final points saves picks + waits for timer
      devJump(7);
      G._timer.clock = () => simNow;
      G.activity(ME);
      goForward(); // -> graduation
      G.activity(ME);
      const backGradOk = checkBackBlocked(9);
      for (let i = 0; i < 20; i++) {
        const b = document.querySelector("[data-pinc]:not([disabled])");
        if (!b) break;
        b.click();
      }
      goForward(); // Lock in final points
      const gradWaitOk = G.step === "graduation" && !G.over &&
        ME.earned === 0 && ME.placedThisRound > 0 &&
        G.timerView() && G.timerView().name === "graduation" &&
        !document.querySelector("#banner").hidden &&
        !!document.querySelector("#gradWait");
      simNow = G.timer.deadline;
      afterClose(G.tick());
      const gradClosedOnTimer = G.over === true && G.step === "graduation";

      return {
        preGameBackOk: back1Ok && back2Ok && back3Ok && back4Ok,
        liveBackOffOk: back5Ok && back6Ok && back7Ok && back8Ok && back9Ok && backGradOk,
        openFloorWaitOk: ofClicksBlocked && ofStillOpen,
        sopWaitOk: sopWaitOk && sopClosedOnTimer,
        glitchReportWaitOk: grWaitOk && accWaitOk,
        giftHookOk,
        statsWaitOk: statsWaitOk && statsClosedOnTimer,
        gradWaitOk: gradWaitOk && gradClosedOnTimer,
      };
    } finally {
      elevTimers.forEach(clearTimeout);
      elevTimers = [];
      endSession();
      S = fresh();
      render();
    }
  })()`);

  check("Back button allowed on pre-game steps 1..4", res.preGameBackOk);
  check("Back button disabled and does not change S.step on live round steps 5..9", res.liveBackOffOk);
  check("Open Floor click does not close Open Floor before timer", res.openFloorWaitOk);
  check("Submit SOP saves board and waits for SOP timer", res.sopWaitOk);
  check("Glitch Report Accuse and Skip save choice and wait for timer", res.glitchReportWaitOk);
  check("Human-to-bot gift is answered via Bots.hooks.onGift", res.giftHookOk);
  check("Stats Update Lock In saves points and waits for timer", res.statsWaitOk);
  check("Graduation Lock In saves final points and waits for timer", res.gradWaitOk);
}

/* Step 6: Split Brief pass-throughs, player-scoped view privacy, and no G.round.trial in splitbrief-view.js. */
async function step6SplitBriefCleanupCases() {
  const res = w.eval(`(() => {
    const { Bots, Game, Rng, Team } = EP;
    const mkPlayers = () => Array.from({ length: 8 }, (_, i) => {
      const p = Bots.makePlayer(950 + i, "SB" + i, "coop");
      p.isBot = false;
      return p;
    });
    const ps = mkPlayers();
    const teams = [0, 1].map(i => new Team({ id: "sbT" + i, name: "SB Team " + i, members: ps.slice(i * 4, i * 4 + 4) }));
    const clock = { now: 1000000 };
    const g = new Game({ teams, rng: Rng.seeded(606), clock: () => clock.now });
    const [p0, p1] = teams[0].members;
    const q0 = teams[1].members[0];

    const rejectedOutside = expectNullView => {
      const r1 = g.splitBriefPostNote(p0, "Note");
      const r2 = g.splitBriefSetBoard(p0, ["A"]);
      const r3 = g.splitBriefLockIn(p0);
      const v = g.splitBriefView(p0);
      return r1.ok === false && !!r1.reason &&
        r2.ok === false && !!r2.reason &&
        r3.ok === false && !!r3.reason &&
        (!expectNullView || v === null);
    };

    const rejectIntermission = rejectedOutside(true);
    g.startNextRound(); // Level 1 briefing
    g.advance();        // Level 1 openFloor
    g.advance();        // Level 1 trial (SOP)
    const rejectLevel1Sop = rejectedOutside(true);
    g.closeSop();
    g.endTrial();       // glitchReport
    g.endGlitchReport(); g.advance(); g.advance(); g.lockIn(); g.advance();
    g.computeEarnings(); g.placeAllRemaining(); g.finishRound();

    g.startNextRound(); // Level 2 briefing
    const rejectBriefing = rejectedOutside(false);
    g.advance();        // Level 2 openFloor
    const rejectOpenFloor = rejectedOutside(false);
    g.advance();        // Level 2 trial (SplitBrief)
    g.start();

    const noteOk = g.splitBriefPostNote(p0, "Team0 secret");
    const noteOtherOk = g.splitBriefPostNote(q0, "Team1 secret");
    const board0Ok = g.splitBriefSetBoard(p0, ["D", "B"]);
    const board1Ok = g.splitBriefSetBoard(q0, ["A", "C"]);
    const lock1Ok = g.splitBriefLockIn(q0);

    clock.now += 95000;
    g.tick(clock.now);

    const v0 = g.splitBriefView(p0);
    const v1 = g.splitBriefView(p1);
    const v0Ids = new Set(v0.cards.map(c => c.id));
    const v1Ids = new Set(v1.cards.map(c => c.id));
    const cardsDisjoint = v0.cards.length > 0 && v1.cards.length > 0 &&
      v0.cards.every(c => !v1Ids.has(c.id)) &&
      v1.cards.every(c => !v0Ids.has(c.id)) &&
      v0.cards.every(c => !("botNote" in c));

    const t0Views = teams[0].members.map(m => g.splitBriefView(m));
    const twistHoldersT0 = t0Views.filter(v => v && v.twistCard !== null);
    const v0Json = JSON.stringify(v0);
    const hidesOtherTeam = JSON.stringify(v0.board) === '["D","B"]' &&
      v0.locked === false &&
      v0.notes.some(n => n.text === "Team0 secret") &&
      !v0Json.includes("Team1 secret") &&
      !v0Json.includes('["A","C"]');
    const preCloseHidden = v0.done === false &&
      v0.postTwistAnswer === null &&
      v0.boardScore === null &&
      v0.ranking === null &&
      twistHoldersT0.length === 1;

    g.closeSplitBrief();
    const vClosed = g.splitBriefView(p0);
    const postCloseShown = vClosed.done === true &&
      Array.isArray(vClosed.postTwistAnswer) && vClosed.postTwistAnswer.length === 2 &&
      typeof vClosed.boardScore === "number" &&
      Array.isArray(vClosed.ranking) &&
      vClosed.ranking.length === 2 &&
      vClosed.ranking.every(r => typeof r.place === "number" && typeof r.teamName === "string" && typeof r.isMine === "boolean" && typeof r.score === "number" && typeof r.won === "boolean" && !("team" in r));

    g.endTrial(); // -> Level 2 glitchReport
    const rejectAfterClose = rejectedOutside(false);

    return {
      rejectOutsideOk: rejectIntermission && rejectLevel1Sop && rejectBriefing && rejectOpenFloor && rejectAfterClose,
      actionsOk: noteOk.ok && noteOk.notesLeft === 2 && noteOtherOk.ok && board0Ok.ok && board1Ok.ok && lock1Ok.ok && lock1Ok.lockOrder === 1,
      privacyOk: cardsDisjoint && hidesOtherTeam && preCloseHidden && postCloseShown,
    };
  })()`);

  const sbSrc = fs.readFileSync(path.join(repo, "splitbrief-view.js"), "utf8");
  const noDirectTrial = !sbSrc.includes("G.round.trial") && !/\btrial\.(postNote|setBoard|lockIn)\b/.test(sbSrc);

  check("Game Split Brief pass-throughs reject calls outside Split Brief trial step", res.rejectOutsideOk && res.actionsOk);
  check("Game.splitBriefView(p) hides other players' cards, other teams' notes/boards, and pre-close answers", res.privacyOk);
  check("splitbrief-view.js contains no G.round.trial or direct trial calls", noDirectTrial);
}

w.addEventListener("load", async () => {
  try {
    w.EP.Rng.randomSeed = () => 2026;
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
    log("run 6: Mirror Step 6b lobby and crew reveal edge cases");
    await mirrorStep6bCases();
    log("run 7: Mirror Step 6c-1 Setup Crew frame, cables, and sound");
    await mirrorStep6c1Cases();
    log("run 8: Mirror Step 6c-2 mic, deck, Q&A, and wrap up");
    await mirrorStep6c2Cases();
    log("run 9: Mirror Step 6d Dance Crew rhythm lane");
    await mirrorStep6dCases();
    log("run 10: Mirror Step 6e trial result and Presentation Day Complete");
    await mirrorStep6eCases();
    log("run 11: Step 7 dev jump (Ctrl+Shift+1..7)");
    await devJumpCases();
    log("run 12: Step 8 Level 3 mid-trial save/reload and live-stage flows");
    await mirrorStep8Cases();
    log("run 13: Step 1 attendance injected clock and server-ready tick");
    await attendanceClockAndTickCases();
    log("run 14: Step 2 timer banner alignment, gift window auto-advance, and arrival clock");
    await timerBannerAndSyncCases();
    log("run 15: Step 3a Level 3 seeded lobby cursor, cables bag, and sound spikes/jitter");
    await mirrorStep3aSeedCases();
    log("run 16: Step 3b Level 3 Setup deadlines owned by SetupCrew and checked in Game.tick");
    await mirrorStep3bDeadlineCases();
    log("run 17: Step 4 Level 3 Dance Crew note chart, judging, miss deadlines, and idle gating");
    await mirrorStep4DanceCases();
    log("run 18: Step 5 Back lock, onGift hook, and timed steps wait for timer");
    await step5CleanupCases();
    log("run 19: Step 6 Split Brief Game pass-throughs and player-scoped view");
    await step6SplitBriefCleanupCases();
  } catch (e) { errors.push(String(e.message || e)); }
  check("no console errors", !errors.length, errors.length ? [...new Set(errors)].join(" | ") : "none");
  console.log("");
  console.log(passed + " passed, " + (errors.length ? [...new Set(errors)].length : 0) + " failed");
  process.exit(errors.length ? 1 : 0);
});
