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

      // Advance past 1s mirrorReveal deadline into showtime placeholder
      w.eval('window._mirSimNow = G.timer.deadline; afterClose(G.tick());');
      await sleep(10);
      const showtimePhaseOk = w.eval('G.mirrorPhase() === "showtime"');
      const showtimeScriptOk = $("#fac").textContent.includes("Crews are locked. Setup, work your steps in order. Dancers, keep the room awake. Attention is draining. Go.");
      toggleHost(); await sleep(10);
      const hostRehiddenAtTrial = $("#facBtn").hidden && $("#fac").hidden;
      const placeholderText = $("#stage").textContent;
      check(
        "Level 3 Trial host script is hidden from non-host players and updates from lobby to showtime",
        hostHiddenAtTrial && lobbyPhaseOk && lobbyScriptOk && showtimePhaseOk && showtimeScriptOk && hostRehiddenAtTrial
      );
      check(
        "Crew Reveal advances into Step 6b showtime placeholder without leaks",
        placeholderText.includes("Setup and Dance: coming in Steps 6c and 6d") &&
          !!$("#finishMirrorPlaceholder") && !LEAK_RE.test(placeholderText)
      );

      // Restore real clock before finishing trial and advancing to Glitch Report
      w.eval('G._timer.clock = () => Date.now(); G.activity(ME);');
      $("#finishMirrorPlaceholder").click(); await sleep(20);
      check("Level 3 Trial placeholder finishes cleanly without leaks", w.eval('G.didRun("runTrial")') && !LEAK_RE.test($("#stage").textContent));
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
  } catch (e) { errors.push(String(e.message || e)); }
  check("no console errors", !errors.length, errors.length ? [...new Set(errors)].join(" | ") : "none");
  console.log("");
  console.log(passed + " passed, " + (errors.length ? [...new Set(errors)].length : 0) + " failed");
  process.exit(errors.length ? 1 : 0);
});
