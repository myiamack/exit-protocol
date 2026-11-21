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
      w.eval('window._mirSimNow = Date.now(); G._timer.clock = () => window._mirSimNow;');
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
                drawTimer();
              })()`);
            } else if (cur.step === "mic") {
              w.eval(`(() => {
                for (let k = 0; k < 25; k++) {
                  const disp = document.querySelector("#micSeqDisp");
                  if (disp && disp.dataset.flashing === "0") break;
                  drawTimer();
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

    const passMicAndDeckViaRules = (game, team) => {
      for (let guard = 0; guard < 20; guard++) {
        const st = game.mirrorSetupTeam(team);
        if (!st || st.currentStep !== "mic") break;
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

    const driveMicClean = (game, team, view) => {
      for (let guard = 0; guard < 120; guard++) {
        const st = game.mirrorSetupTeam(team);
        if (!st || st.currentStep !== "mic") break;
        for (let t = 0; t < 25; t++) {
          const disp = view.q("#micSeqDisp");
          if (disp && disp.dataset.flashing === "0") break;
          view.tick();
        }
        const cur = game.mirrorSetupTeam(team);
        view.q('[data-mic="' + cur.mic.sequence[cur.mic.index] + '"]').click();
      }
    };
    driveMicClean(ctxA.game, ctxA.team, vMicA);
    driveMicClean(ctxB.game, ctxB.team, vMicB);

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
      vDeckA.tick();
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
    for (let t = 0; t < EP.MirrorData.mic.flashRound1Ticks - 1; t++) v1.tick();
    const stillFlashingAt8 = v1.q("#micSeqDisp").dataset.flashing === "1" && v1.qa("[data-mic]").every(b => b.disabled);
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
    for (let t = 0; t < EP.MirrorData.mic.flashBaseTicks + 3 - 1; t++) v1.tick();
    const retryStillFlashing = v1.q("#micSeqDisp").dataset.flashing === "1";
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
    driveMicClean(g3, team3, v1);
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
    for (let t = 0; t < EP.MirrorData.deck.reshuffleTicks - 1; t++) v1.tick();
    const noReshuffleAt7 = g3.mirrorSetupTeam(team3).deck.reshuffles === 0;
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
    v1.tick();
    const noSpiteShuffleAt1 = g3.mirrorSetupTeam(team3).deck.reshuffles === 1;
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
    for (let t = 0; t < ticksToLow; t++) v2.tick();
    const barLowOk = v2.q("#qaCd").dataset.ticksLeft === String(EP.MirrorData.qa.lowWarningTicks) &&
      v2.q("#qaCd i").classList.contains("low");
    const attBeforeQaTimeout = g3.mirrorAttention(team3);
    for (let t = 0; t < EP.MirrorData.qa.lowWarningTicks; t++) v2.tick();
    const stAfterQaTimeout = g3.mirrorSetupTeam(team3);
    const attAfterQaTimeout = g3.mirrorAttention(team3);
    const qaTimeoutOk = barInitOk && barLowOk &&
      stAfterQaTimeout.qa.timeouts === 1 &&
      attAfterQaTimeout === attBeforeQaTimeout - EP.MirrorData.qa.wrongPenalty &&
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
            ov.tick();
          }
        } else if (curStep === "mic") {
          driveMicClean(g, team, ov);
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
          else passMicAndDeckViaRules(g, team);
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

    const drivePerfectHits = (view, count) => {
      let hits = 0;
      for (let t = 0; t < 400 && hits < count; t++) {
        const pNote = view.q('[data-note-zone="perfect"]');
        if (pNote) {
          view.view().handleInput(pNote.dataset.noteDir);
          hits += 1;
        } else {
          view.view().stepMotion(1);
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
      flushRaf(1000); // initialize rAF timestamp at ds.tick = 0
      for (let i = 1; i <= 10; i++) flushRaf(1000 + i * 250); // ds.tick = 10 -> note 1 in perfect zone
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

      for (let i = 11; i <= 14; i++) flushRaf(1000 + i * 250); // ds.tick = 14 -> note 2 (t0=6) in good zone
      const n2 = vDance1.q('[data-note-zone="good"]');
      const dir2 = n2 ? n2.dataset.noteDir : null;
      if (dir2) vDance1.q('[data-dance="' + dir2 + '"]').click();
      const dAfterGood = g1.mirrorDanceTeam(t1).dancers.find(d => d.playerId === d0.id);
      const goodHitOk = !!dir2 && dAfterGood.goods === 1 && dAfterGood.boost === 5 && dAfterGood.combo === 2 &&
        vDance1.q("#danceHits").textContent === "2" &&
        vDance1.q("#myDanceBoost").textContent.includes("+5 / 45") &&
        vDance1.q("#comboN").textContent === "combo ×2" &&
        vDance1.q("#teamDanceBoost").textContent === "2.5";

      // Stray press when no unjudged note is in the hit frame (note 3 at t0=12 has diff=8 at ds.tick=14)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      const dAfterStray = g1.mirrorDanceTeam(t1).dancers.find(d => d.playerId === d0.id);
      const attAfterStray = Math.round(g1.mirrorAttention(t1));
      const strayOk = dAfterStray.strays === 1 && dAfterStray.penalties === 1 && dAfterStray.combo === 0 &&
        vDance1.q("#danceStrays").textContent === "1" &&
        vDance1.q("#comboN").textContent === "combo ×0" &&
        vDance1.q("#teamDancePen").textContent === "0.5" &&
        vDance1.q("#attnPct").textContent === attAfterStray + "%";

      // Miss note 3 (t0=12 -> misses once ds.tick > 24)
      for (let i = 15; i <= 25; i++) flushRaf(1000 + i * 250);
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
      const vTempo = mountView(ctxTempo.game, ctxTempo.team.members.find(p => ctxTempo.game.mirrorRole(p) === "dance"), ctxTempo.team);
      const seenNotes = new Map();
      for (const n of vTempo.state.mirror.dance.notes) seenNotes.set(n.id, { t0: n.t0, dir: n.dir });
      for (let t = 0; t < 260; t++) {
        vTempo.view().stepMotion(1);
        for (const n of vTempo.state.mirror.dance.notes) {
          if (!seenNotes.has(n.id)) seenNotes.set(n.id, { t0: n.t0, dir: n.dir });
        }
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
      const dCap = tCap.members.find(p => gCap.mirrorRole(p) === "dance");
      const vCap = mountView(gCap, dCap, tCap);
      const hitsDriven = drivePerfectHits(vCap, 17); // 17 * 3 = 51 raw -> caps at 45
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
      const dA1 = tA1.members.find(p => gA1.mirrorRole(p) === "dance");
      const vA1 = mountView(gA1, dA1, tA1);
      drivePerfectHits(vA1, 2); // +6
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
      const dList2 = tA2.members.filter(p => gA2.mirrorRole(p) === "dance");
      const vA2_0 = mountView(gA2, dList2[0], tA2);
      const vA2_1 = mountView(gA2, dList2[1], tA2);
      drivePerfectHits(vA2_0, 2); // +6
      drivePerfectHits(vA2_1, 1); // +3
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
      const dList3 = tA3.members.filter(p => gA3.mirrorRole(p) === "dance");
      const vA3_0 = mountView(gA3, dList3[0], tA3);
      const vA3_1 = mountView(gA3, dList3[1], tA3);
      const vA3_2 = mountView(gA3, dList3[2], tA3);
      drivePerfectHits(vA3_0, 1); // +3
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
          for (let i = 1; i <= 10; i++) flushRaf(5000 + i * 250);
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
          if (G.timer && G.timer.name === "giftWindow") {
            gameCtx.setNow(G.timer.deadline);
            afterClose(G.tick());
          }
          goForward(); // -> Stats Update (step 9)
          for (let i = 0; i < 10; i++) {
            const pInc = document.querySelector("[data-pinc]:not([disabled])");
            if (!pInc) break;
            pInc.click();
          }
          goForward(); // -> lockPoints
          fullDanceLv3EndOk = stageHitCount >= 1 &&
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
  } catch (e) { errors.push(String(e.message || e)); }
  check("no console errors", !errors.length, errors.length ? [...new Set(errors)].join(" | ") : "none");
  console.log("");
  console.log(passed + " passed, " + (errors.length ? [...new Set(errors)].length : 0) + " failed");
  process.exit(errors.length ? 1 : 0);
});
