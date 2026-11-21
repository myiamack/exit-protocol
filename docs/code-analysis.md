# Exit_ProtocoL Whole-Game Code Analysis (Read-Only)

Branch: `level3-mirror` (read-only audit; no code, test, data, or other doc files modified).
Scope: `rules/`, all 11 screen files (`game.js`, `mirror-view.js`, `mirror-dance-view.js`, `splitbrief-view.js`, `judged-view.js`, `world-map.js`, `pixel-art.js`, `board.js`, `attendance-view.js`, `fullscreen-view.js`, `pages/vote-test.js`), and `Tests/`.

---

## A. Screen code that runs the game on its own clock (HIGHEST PRIORITY)

Note on bug numbers: Only Bug `54` (cable belt shuffle) is explicitly mapped in the task prompt (Section F). The external bug tracker definitions for IDs `4`, `5`, `17`, `51`, `52`, and `53` are not stored in this repository, so Step 10 findings whose exact tracker number cannot be confirmed from the repo are marked `UNCONFIRMED` rather than guessed, and findings not covered in Step 10 are marked `new`.

### Gameplay-affecting screen clocks, step advancers, penalties, and `Math.random()`

| File:lines | What it does | Why it breaks sync or save/load | Which rules class should own it | Related bug number |
|---|---|---|---|---|
| `mirror-dance-view.js:355-397`, `mirror-dance-view.js:477-491`, `mirror-dance-view.js:468-470` | Runs a `requestAnimationFrame` clock (`ds.tick += dtMs / 250`) spawning arrow notes and automatically calling `G.mirrorDanceMiss(ME)` (`375`) for every unhit note (`-2` penalty, resets combo, can trigger 0% attention failure at `381-385`). Keeps charging misses while `ME.idle === true` and while the Progress Board (`.board-ov`) blocks arrow keys (`469`). | Runs on client browser `rAF` instead of server/game clock. Closing the tab, lagging, or clicking Back stops misses completely (exploit); keeping the tab open while idle or viewing the Board piles up `-2` penalties alongside bot boosts; reloading resets `ds.tick`, `ds.notes`, and `ds.spawnedCount` (resets tempo ramp `6 -> 5 -> 4` back to `6`). | `DanceCrew` (`rules/MirrorParts.js`, via `MirrorTrial` in `rules/Trial.js`) | UNCONFIRMED (Step 10 #1; candidate from 4, 5, 17, 51, 52, 53; tracker not in repo) |
| `mirror-dance-view.js:51-60`, `mirror-dance-view.js:62-98`, `mirror-dance-view.js:399-453` | `nextArrowDir` rolls `Math.random()` (`53`) to pick arrow directions; `initDanceState`/`spawnNoteOn` schedules notes locally; `handleInput` judges `perfect`/`good`/`stray` against the unsaved client note clock and calls `G.mirrorDanceHit`/`G.mirrorDanceStray`. | Non-seeded randomness cannot reproduce from `G.rng`; reloading generates a different note chart; client is authoritative over hit/stray scoring. | `DanceCrew` (`rules/MirrorParts.js`, via `MirrorTrial`) | UNCONFIRMED (Step 10 #4; candidate from 4, 5, 17, 51, 52, 53; tracker not in repo) |
| `mirror-view.js:544-555`, `mirror-view.js:1223-1248` | Runs a screen-side 29-tick (7.25s) countdown (`ms.qa.tick`, `ms.qa.deadline`) for each Rapid-fire Q&A question. At 0, calls `G.mirrorTimeoutQa(ME)` (`1238`), charging `-5` attention and advancing `qa.index` (or advancing the setup step to `wrapUp`). | Unsaved in `Game.toJSON()`. Reloading or waking a Base44 actor resets the 7.25s question timer to full (infinite time exploit); clicking Back freezes `ms.qa.tick` indefinitely; a closed browser tab never times out; an idle human's open tab still fires `-5` timeouts. | `SetupCrew` (`rules/MirrorParts.js`, via `MirrorTrial` and `Game`/`Timer` deadline) | UNCONFIRMED (Step 10 #2; candidate from 4, 5, 17, 51, 52, 53; tracker not in repo) |
| `mirror-view.js:29-36`, `mirror-view.js:1128-1164`, `mirror-view.js:894-943` | `shuffleArr` calls `Math.random()` (`32`) to shuffle the cable spawn bag (`1137`, `1144`). `tick` runs an unsaved local belt clock (`ms.cables.tick`, `belt`, `bag`, `nextSpawn`) and `[data-cable-port]` click handler judges cable hit vs spark (`-3` penalty) locally (`907-940`). | Uses `Math.random()` instead of `G.rng` (breaks seed reproducibility and can delay a needed port). Unsaved belt resets to tick 0 on reload or Back; client decides hit vs spark locally. | `SetupCrew` (`rules/MirrorParts.js`, via `MirrorTrial`) | 54 |
| `mirror-view.js:1165-1209`, `mirror-view.js:945-969` | Runs Sound Check simulation on the client 250ms tick with 4 `Math.random()` calls (`1170`, `1173`, `1174`, `1178`: spike schedule, +8..+17 boost, jitter). Passively triggers `G.mirrorSoundFeedback(ME)` (`-4` penalty, `1181`) without user input when a crowd spike hits 100, and runs a 12-tick (3.0s) local hold timer that advances the setup step via `G.mirrorSoundHeld(ME)` (`1192`). | Unsaved `ms.sound` (`level`, `holdTicks`, `spikeAt`) resets to 45 and 0s on reload or Back; `Math.random()` breaks seed determinism; passive feedback charges `-4` even if `ME` is idle; closed tab freezes spikes and never advances. | `SetupCrew` (`rules/MirrorParts.js`, via `MirrorTrial`) | UNCONFIRMED for `Math.random()` (Step 10 #4; candidate from 4, 5, 17, 51-53) and new for screen hold timer and passive feedback penalty |
| `mirror-view.js:512-530`, `mirror-view.js:976`, `mirror-view.js:1210-1215` | Runs a screen-side tick timer (`ms.mic.tick`, `ms.mic.hideAt`) controlling how long the Mic Check memory sequence flashes before hiding behind `?` and enabling taps (`976`). | Unsaved in `Game.toJSON()`. Reloading or navigating Back and returning clears `ms.mic.flashKey`, re-flashing the secret sequence for free whenever `st.mic.index === 0`. | `SetupCrew` (`rules/MirrorParts.js`, via `MirrorTrial` using deadline timestamps) | new |
| `mirror-view.js:532-542`, `mirror-view.js:1027`, `mirror-view.js:1215-1222` | Runs a screen-side tick timer (`ms.deck.tick`, `ms.deck.shuffleAt`: every 8 ticks / 2.0s, or 2 ticks / 0.5s spite reshuffle after wrong file at `1027`) that calls `G.mirrorReshuffleDeck(MYTEAM)` (`1219`). | Calling `G.mirrorReshuffleDeck` from a client timer consumes `G.rng` draws on the client's local tick schedule rather than server time, desyncing RNG across sleep/reload or multiple clients; navigating Back freezes reshuffles; reloading resets the 2s timer. | `SetupCrew` (`rules/MirrorParts.js`, via `MirrorTrial` and `Game`/`Timer` deadline) | new |
| `mirror-view.js:155-156`, `mirror-view.js:351-369`, `mirror-view.js:401-417` | Rolls `Math.random()` (`155-156`) for lobby signal cursor initial `pos` and `dir`; sweeps cursor on local 250ms tick (`404-406`) and locally decides `hit = inBand(...)` (`351`) before calling `G.mirrorConnect` or `G.mirrorMiss`. | `Math.random()` breaks seed reproducibility; reload randomizes cursor position/direction; client decides connect vs miss without rules verifying cursor timing. | `MirrorLobby` (`rules/MirrorParts.js`, via `MirrorTrial`) | UNCONFIRMED (Step 10 #4 for `155-156`; candidate from 4, 5, 17, 51-53; tracker not in repo) |
| `game.js:296`, `game.js:756`, `game.js:871` | `canBack()` returns `true` during `S.step === 7` (`trial`), so clicking `#navBack` leaves Trial to Open Floor (`V[6]`), causing `render()` (`756`) to tear down `currentTrialView`. | Stops Dance Crew `rAF` (0 misses while away) and freezes Setup Crew Q&A countdown, sound spikes, and deck reshuffles while `G.step === "trial"` keeps running in the background. | `Game` / screen nav guard (`game.js` should disable Back during active trial; rules must own trial clocks) | UNCONFIRMED (Step 10 #2; candidate from 4, 5, 17, 51, 52, 53; tracker not in repo) |
| `game.js:251-258`, `game.js:327-330`, `game.js:518`, `game.js:810-811`, `game.js:831-862` | Single-player UI buttons directly advance/close steps for the entire game: `startLevel` (`251`, `G.closeTimer`/`startNextRound`), `goForward` (`327`, `G.advance`), `applyOpenFloorEnd` (`845`, `G.closeTimer`), `checkSop` (`848`, `G.closeTimer`), `#runAuto` (`518`, `G.runTrial`), `payCost` (`854`, `G.endTrial`), `endAccusations` (`860`, `G.closeTimer`), `lockPoints` (`835, 840`, `G.closeTimer`/`placeAllRemaining`/`finishRound`/`results`), `startNextLevel` (`255`, `G.startNextRound`). | Any single human clicking Next/Submit/Lock In immediately closes Open Floor, SOP, Glitch Report, Stats Update, or Graduation for every other player in multiplayer, auto-placing their points or skipping their accusations/edits. | `Game` (`rules/Game.js`: timer deadlines, host-only controls, or all-active-ready gates) | new (or UNCONFIRMED if tracked under 4, 5, 17) |
| `game.js:293` | Client-side `setInterval(..., 250)` calls `G.tick()` to expire step timers and run `onTick` bot hooks. | A closed or throttled browser tab never ticks `Game`; multiple clients ticking independently would race on Base44. Base44 actor scheduled wakes must drive `G.tick()`. | `Game` + `Timer` (`rules/Game.js`, `rules/Timer.js`, driven by Base44 actor wake) | new |
| `game.js:742`, `game.js:747-748`, `game.js:801` | Elevator and spawn cutscene `setTimeout`s (`742`: 1800ms, `747-748`: 500ms + 90ms steps + 700ms) gate `S.arrived = true`, which finally triggers `G.start()` at `801` (starting the first 90s Intermission timer). | Each player finishes the intro cutscene at a different wall-clock time (or skips it), so a client cutscene cannot own when the game clock starts in multiplayer. | `Game` (`rules/Game.js`, started by host or 120s lobby timer on Base44) | new |
| `attendance-view.js:15`, `attendance-view.js:34`, `attendance-view.js:67`, `attendance-view.js:73` | Runs a client-side `setInterval(api.tick, 1000)` (`73`) passing client `Date.now()` into `G.checkAttendance(Date.now())` (`34`) and `G.activity(l.ME, Date.now())` (`15`). | A closed tab never runs `checkAttendance()`, so disconnected players never go idle or take attendance glitches; trusting client `Date.now()` allows clock skew or spoofing. | `Attendance` + `Game` (`rules/Attendance.js`, `rules/Game.js`, running on Base44 server clock) | new |
| `judged-view.js:26-27`, `judged-view.js:73`, `judged-view.js:113` | Mutates game state during screen render (`26`: calls `G.startWriting()` and `EP.Bots.submit(G)`; `27`: calls `G.startVote()`), and `#castVote` (`113`) calls `EP.Bots.vote(G, v, G.rng); G.runTrial()`, ending the Level 5-6 trial on one player's vote. | Render-time mutations consume `G.rng` and race across clients; first human voter immediately closes the vote and ranks all teams before other humans can vote. | `Game` + `JudgedTrial` (`rules/Game.js`, `rules/Trial.js`, `rules/bots.js` hooks) | new |
| `game.js:264`, `game.js:486`, `game.js:499` | `shuffle()` uses `Math.random()` (`264`) to shuffle the Level 1 SOP step pile on initial render (`486`) and on "Start over" (`499`). Also `S.sop.inTime` (`216, 287, 493`) is unsaved screen state. | Not seeded from `G.rng` (display order only, does not change SOP score, but resets on reload and differs across replays of the same seed). | `SopTrial` (`rules/Trial.js`) if seeded order is wanted, or keep display-only | UNCONFIRMED (candidate from 4, 5, 17, 51-53 for `Math.random()` in screens; tracker not in repo) |
| `pages/vote-test.js:39-40`, `pages/vote-test.js:43-83`, `pages/vote-test.js:120-122`, `pages/vote-test.js:145` | Standalone Level 5-6 test page runs its own 1000ms `setInterval` (`75-80`) calling `G.tick()` and auto-transitioning `toVote()` (`G.startVote()`), directly mutates `ME.earned` and calls `ME.placePoints()` (`39-40`), and drives bot rounds directly. | Test harness only (not loaded by `index.html`), but bypasses `Game` timers and `Economy` encapsulation. | `Game` (`rules/Game.js`, e.g. `jumpToLevel(5)`) | new (test page only) |

### Cosmetic-only screen timers and `Math.random()` (audited; do not affect rules, sync, or save/load)

| File:lines | What it does | Impact note |
|---|---|---|
| `game.js:4-21` | Background canvas code-rain `requestAnimationFrame` loop and 6 `Math.random()` calls (`4, 5, 13, 15, 16, 18`). | Purely visual background. No rule or sync impact. |
| `game.js:792` | Wardrobe `#rand` button uses `Math.random()` to pick cosmetic avatar parts (`S.av`) before `Game` starts. | Purely cosmetic pre-game UI. (Server lobby auto-finish per `CLAUDE.md:64` will need seeded `Rng` on Base44.) |
| `game.js:765, 782, 869-870` | Visual-only `setTimeout`s: elevator doors CSS flag (1600ms), input focus delay (50ms), menu glitch cursor CSS class (220ms). | Purely visual/focus UX. No rule impact. |
| `mirror-dance-view.js:331` | `hitTimer` 150ms `setTimeout` removing `.hit` highlight class from dance pad buttons. | Purely visual feedback. No rule impact. |
| `world-map.js:172` | `initWorld()` `rAF` loop uses `Math.random()` every 2.8s to toggle wandering ghosts and pick random room spots. | Visual/flavor only (`CLAUDE.md:481`: ghosts give text hints only, no rule effect). |
| `world-map.js:201-203` | Legacy `setInterval(ghostHop, 2600)` + `setTimeout` using `Math.random()` to hop `.gwalk` elements on the removed static office map, plus 6s whisper auto-hide timeout. | Dead timer (`world-map.js` no longer renders `.gwalk` elements); safe to remove, no rule impact. |

---

## B. Whole-game map

Labels:
- `RULE`: game logic, scoring, validation, state queries/mutations
- `TIMER`: time-based logic, deadlines, ticks, countdowns, schedules
- `PASS-THROUGH`: one-line (or thin front-desk) call delegating to another class
- `COORDINATION`: moves the game between steps/phases, lifecycle, serialization, orchestration
- `SCREEN`: drawing, DOM wiring, layout, input capture, display copy only

### `rules/Game.js` (1,041 lines)

| File:lines | Label | Short description | Where it should live | Lines saved if moved (estimate) |
|---|---|---|---|---|
| `rules/Game.js:1-30` | COORDINATION | Header comments and ES module imports | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:31-42` | RULE | Core constants (`QUIET_HEART_TEAM_MAX`, `STEP_NAME`, `PAUSED_STEPS`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:43-53` | TIMER | Step timer constants (`AUTO_ADVANCE_SECONDS`, `GRADUATION_PLACE_SECONDS`, `STEP_SECONDS`) | `rules/Timer.js` | 11 |
| `rules/Game.js:54-56` | COORDINATION | `REQUIRED` step completion gate table | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:57-82` | TIMER | `TIMER_SECONDS` master duration table and timer docs | `rules/Timer.js` | 26 |
| `rules/Game.js:83-106` | COORDINATION | `Game` constructor initializing teams, players, rng, attendance, economy, timer | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:107-128` | TIMER | `_makeTimer(clock)` wiring timer callbacks (`onStart`, `onClose`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:129-133` | PASS-THROUGH | `timer`, `running`, `now()`, `start()` one-line `Timer` delegates | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:134-156` | TIMER | `timerName()` resolving active timer phase from step and trial state | Delegate trial sub-phases to `Trial.timerName()` | 10 |
| `rules/Game.js:157-158` | PASS-THROUGH | `refreshTimer()`, `secondsLeft()` one-line `Timer` delegates | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:159-179` | TIMER | Split Brief twist deadline and `onAllLocked` glue (`_startSplitBrief`, `_wireSplitBrief`, `_checkTwist`) | `rules/Trial.js` (`SplitBriefTrial`) | 18 |
| `rules/Game.js:180-188` | TIMER | `tick(now)` advancing timer, twist check, `onTick` hook, Mirror showtime check | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:189-190` | PASS-THROUGH | `closeTimer()`, `closeTimerAt()` one-line `Timer` delegates | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:191-206` | COORDINATION | `_closeTimerPhase(name)` switch dispatching expired timers to phase closers | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:207-211` | PASS-THROUGH | `placeAllRemaining()` delegate to `Economy` | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:212-231` | TIMER | Attendance pause/resume schedule (`attendancePausedFor`, `syncAttendance`) | `rules/Attendance.js` (keep thin call in `Game`) | 15 |
| `rules/Game.js:232-234` | PASS-THROUGH | `activity(p, now)` one-line delegate to `Attendance` | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:235-281` | RULE | Attendance miss handling and Empathy (`checkAttendance`, `attendanceCanWait`, `attendanceMiss`, `empathy`) | `rules/Attendance.js` and `rules/Round.js` | 35 |
| `rules/Game.js:282-338` | COORDINATION | Step enforcement and transitions (`teamOf`, `over`, `step`, `stepName`, `didRun`, `wrongStep`, `mustBe`, `once`, `advance`, `setTrialForTest`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:339-355` | COORDINATION | `startNextRound()` creating next `Round`/`Trial` and resetting round flags | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:356-499` | COORDINATION | `jumpToLevel(targetLevel)` dev fast-forward across all 7 levels (Bug 27) | Own file `rules/devJump.js` (or `rules/DevTools.js`) | 140 |
| `rules/Game.js:500-517` | RULE | `quietHeartBuff()` small-team +1 heart rule (<=3 active players) | `rules/Round.js` or `rules/Economy.js` | 16 |
| `rules/Game.js:518-524` | PASS-THROUGH | `sabotage(actor, target)` step guard + `Round.sabotage` delegate | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:525-543` | RULE | `switchTeam(p, to)` Open Floor team switching rules (size 3-5, sabotage lock) | `rules/Team.js` or `rules/Round.js` | 15 |
| `rules/Game.js:544-590` | PASS-THROUGH | SOP and Split Brief front-desk guards/delegates (`sop`..`closeSplitBrief`) | Keep thin or generic trial action router | 20 |
| `rules/Game.js:591-629` | TIMER | Mirror elapsed/seconds-left helpers (`_mirrorWhy`, `mirrorLobbyElapsed`, `mirrorShowtimeSecondsLeft`, `mirrorShowtimeElapsed`, `_mirrorElapsedOpts`, `_mirrorLeftOpts`) | `rules/Trial.js` (`MirrorTrial`) | 35 |
| `rules/Game.js:630-686` | COORDINATION | Mirror showtime early-close and attention-fail coordinator (`_allHumanMirrorTeamsDone`, `_maybeCloseMirrorShowtime`, `_checkMirrorShowtime`, `_afterMirrorAction`, `_mirrorCall`) | `rules/Trial.js` (`MirrorTrial`) | 45 |
| `rules/Game.js:687-715` | COORDINATION | Mirror phase lifecycle guards (`mirror`, `closeMirrorLobby`, `startMirrorShowtime`, `closeMirror`) | Keep thin wrapper in `Game`, move details to `MirrorTrial` | 10 |
| `rules/Game.js:716-729` | COORDINATION | `mirrorConnect()` with all-connected early lobby close | `rules/Trial.js` (`MirrorTrial` callback) | 10 |
| `rules/Game.js:730-760` | PASS-THROUGH | 26 one-line Mirror/Trial pass-throughs (`mirrorMiss`..`mirrorDanceStray`, `mirrorAttention`..`trialRanking`) | Generic `trialAction`/`trialQuery` or keep thin actor surface | 25 |
| `rules/Game.js:761-762` | RULE | `teamTrialResults`, `teamStandings` standings projection | `rules/Team.js` | 2 |
| `rules/Game.js:763-777` | COORDINATION | `mirrorCheckAttention`, `mirrorFinishTeam` wrappers with early close | `rules/Trial.js` (`MirrorTrial`) | 10 |
| `rules/Game.js:778-822` | PASS-THROUGH | JudgedTrial and `runTrial` pass-throughs (`judged`, `setPrompt`..`runTrial`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:823-835` | COORDINATION | `payTrialCosts` and `endTrial` (pay costs + advance) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:836-869` | PASS-THROUGH | Glitch Report and Gift pass-throughs (`accuse`..`answerGift`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:870-883` | RULE | `lockIn()` locking glitches and applying Empathy | `rules/Round.js` | 10 |
| `rules/Game.js:884-893` | PASS-THROUGH | `closeGiftWindow()` delegate to `Round.closeGiftWindow` | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:894-940` | PASS-THROUGH | Stats Update / Economy pass-throughs (`computeEarnings`..`autoPlacePoints`) | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:941-959` | RULE | `finishRound()` verifying placement, heart refill, Grit bonus roll | `rules/Round.js` or `rules/Economy.js` | 12 |
| `rules/Game.js:960-1005` | COORDINATION | `toJSON()` and `static fromJSON()` full save/restore | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:1006-1015` | RULE | `board()` read-only Progress Board privacy boundary | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:1016-1028` | RULE | `results()` Level 7 ending lock and attendance pause | Stays in `rules/Game.js` | 0 |
| `rules/Game.js:1029-1041` | PASS-THROUGH | `static get POINTS()`, static constant exports, module export | Stays in `rules/Game.js` | 0 |

### `rules/Trial.js` (1,296 lines)

| File:lines | Label | Short description | Where it should live | Lines saved if moved (estimate) |
|---|---|---|---|---|
| `rules/Trial.js:1-17` | COORDINATION | Header comments and ES module imports | Stays in `rules/Trial.js` | 0 |
| `rules/Trial.js:18-90` | RULE | `Trial` base class (`winners`, `run`, `runTrial`, `sortBy`, `influence`, `rankWithInfluence`, `randomBase`) | Stays in `rules/Trial.js` | 0 |
| `rules/Trial.js:91-131` | COORDINATION | `Trial.forRound` factory and `toJSON`/`fromJSON` polymorphic dispatch | Stays in `rules/Trial.js` | 0 |
| `rules/Trial.js:132-204` | RULE | `SopTrial` subclass (Level 1 SOP scoring, board validation, ranking, constants, JSON) | Optional split: `rules/SopTrial.js` | 70 |
| `rules/Trial.js:205-209` | RULE | `AutoTrial` subclass (Level 4 placeholder random 0-7 + influence) | Stays in `rules/Trial.js` | 0 |
| `rules/Trial.js:210-255` | RULE | `SplitBriefTrial` setup, fields, constructor, getters, scenario lookup | Optional split: `rules/SplitBriefTrial.js` | 46 |
| `rules/Trial.js:256-257` | TIMER | `SplitBriefTrial.setTwistDeadline(at)` deadline setter | Optional split: `rules/SplitBriefTrial.js` | 2 |
| `rules/Trial.js:258-470` | RULE | `SplitBriefTrial` deal, cards, notes, board, Lock In, twist, scoring, tie-break ranking | Optional split: `rules/SplitBriefTrial.js` | 213 |
| `rules/Trial.js:471-513` | COORDINATION | `SplitBriefTrial.toJSON` / `fromJSON` serialization | Optional split: `rules/SplitBriefTrial.js` | 43 |
| `rules/Trial.js:514-539` | COORDINATION | `MirrorTrial` private fields (`#lobby`, `#setup`, `#dance`) and constructor | Optional split: `rules/MirrorTrial.js` | 26 |
| `rules/Trial.js:540-551` | RULE | `MirrorTrial.MAX_SCORE` and `score(attention)` (0..100 to 0..7) | Optional split: `rules/MirrorTrial.js` | 12 |
| `rules/Trial.js:552-563` | PASS-THROUGH | `MirrorTrial` status getters (`kind`, `phase`, `lobbyStarted`..`setupCrewSize`) | Optional split: `rules/MirrorTrial.js` | 12 |
| `rules/Trial.js:564-689` | RULE | `MirrorTrial` private guards, bot-only attention, attention lock, team result resolver | Optional split: `rules/MirrorTrial.js` | 126 |
| `rules/Trial.js:690-703` | COORDINATION | `MirrorTrial.startLobby(teams)` phase transition and lobby start | Optional split: `rules/MirrorTrial.js` | 14 |
| `rules/Trial.js:704-712` | PASS-THROUGH | 8 one-line `#lobby` pass-through methods (`connect`..`allConnected`) | Optional split: `rules/MirrorTrial.js` | 9 |
| `rules/Trial.js:713-757` | COORDINATION | `MirrorTrial.closeDoors()` and `startShowtime()` (crew deal, part startup, bot rolls) | Optional split: `rules/MirrorTrial.js` | 45 |
| `rules/Trial.js:758-793` | PASS-THROUGH | 9 guarded `#setup` pass-throughs (`cableHit`..`timeoutQa`) | Optional split: `rules/MirrorTrial.js` | 36 |
| `rules/Trial.js:794-854` | COORDINATION | `wrapUp`, `completeBotSetupStep`, `advanceBotSetup` (delegate + lock team attention) | Optional split: `rules/MirrorTrial.js` | 61 |
| `rules/Trial.js:855-875` | PASS-THROUGH | 5 guarded `#dance` pass-throughs (`danceHit`..`advanceBotDance`) | Optional split: `rules/MirrorTrial.js` | 21 |
| `rules/Trial.js:876-905` | PASS-THROUGH | 24 one-line `#setup`/`#dance`/bot read pass-throughs (`setupSlots`..`botAttentionFor`) | Optional split: `rules/MirrorTrial.js` | 30 |
| `rules/Trial.js:906-1053` | RULE | `MirrorTrial` attention formula, 0% fail lock, `finishTeam`, `closeMirror`, Focus-influence ranking | Optional split: `rules/MirrorTrial.js` | 148 |
| `rules/Trial.js:1054-1083` | COORDINATION | Team failure and crew lookup helpers (`isTeamFailed`..`roleOf`) | Optional split: `rules/MirrorTrial.js` | 30 |
| `rules/Trial.js:1084-1130` | COORDINATION | `MirrorTrial.toJSON` / `fromJSON` 3-part serialization | Optional split: `rules/MirrorTrial.js` | 47 |
| `rules/Trial.js:1131-1158` | RULE | Level 5-6 `PROMPTS` fixed prompt bank | `rules/prompts.js` (data file) | 28 |
| `rules/Trial.js:1159-1266` | RULE | `JudgedTrial` subclass (prompts, writing, submission checks, `startVote`, `rank`) | Optional split: `rules/JudgedTrial.js` | 108 |
| `rules/Trial.js:1267-1274` | COORDINATION | `JudgedTrial.kind` and `toJSON` serialization | Optional split: `rules/JudgedTrial.js` | 8 |
| `rules/Trial.js:1275-1296` | COORDINATION | Static constants (including timer constants on lines 1281-1285, 1288) and subclass exports | Stays in `rules/Trial.js` | 0 |

### `rules/MirrorParts.js` (1,604 lines)

| File:lines | Label | Short description | Where it should live | Lines saved if moved (estimate) |
|---|---|---|---|---|
| `rules/MirrorParts.js:1-7` | COORDINATION | Header, `MirrorData` import, `idOf` helper | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:8-139` | RULE | `MirrorLobby` core rules (constructor, active-player `start`, `connect`, `miss` speed-up, `closeDoors`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:140-231` | RULE | `MirrorLobby` state and bot-connect queries (`playerState`..`state`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:232-271` | COORDINATION | `MirrorLobby.toJSON` / `fromJSON` serialization | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:272-298` | RULE | `SetupCrew` fields, constructor, `crewSize`, `splitSteps` | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:299-310` | TIMER | `SetupCrew.botStepDuration` and `botMilestoneLabel` timing lookup | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:311-469` | RULE | `SetupCrew` turn guards, seeded content picks (`mic`, `deck`, `qa`), step advance, `start` | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:470-841` | RULE | `SetupCrew` 5 step action handlers (`cableHit`..`timeoutQa`) and `wrapUp` | Stays in `rules/MirrorParts.js` (also needs idle guard + deadlines) | 0 |
| `rules/MirrorParts.js:842-949` | TIMER | `SetupCrew` timed bot/auto-pilot progression (`completeBotStep`, `advanceBotSetup`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:950-1030` | RULE | `SetupCrew` read-only queries (`slotsFor`..`currentQaFor`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1031-1039` | TIMER | `SetupCrew.botStepDueAt` milestone timestamp helper | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1040-1089` | RULE | `SetupCrew.teamState` and `state` snapshot builders | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1090-1199` | COORDINATION | `SetupCrew.toJSON` / `fromJSON` serialization | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1200-1223` | RULE | `DanceCrew` fields, constructor, `#lookupPlayer` | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1224-1230` | TIMER | `DanceCrew.#rollBotInterval()` (1.5-2.5s bot boost schedule) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1231-1400` | RULE | `DanceCrew` init and hit/miss/stray handlers (`start`, `noteHit`, `noteMiss`, `strayPress`) | Stays in `rules/MirrorParts.js` (needs idle guard) | 0 |
| `rules/MirrorParts.js:1401-1473` | TIMER | `DanceCrew` timed bot/auto-pilot boosts (`applyBotBoost`, `advanceBotDance`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1474-1518` | RULE | `DanceCrew` roster, boost, and average penalty queries | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1519-1537` | TIMER | `DanceCrew` bot schedule queries (`botNextBoostAt`, `botNextBoostsFor`) | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1538-1557` | RULE | `DanceCrew.teamState` and `state` snapshot builders | Stays in `rules/MirrorParts.js` | 0 |
| `rules/MirrorParts.js:1558-1604` | COORDINATION | `DanceCrew.toJSON` / `fromJSON` and `MirrorParts` export | Stays in `rules/MirrorParts.js` | 0 |

### Screen files (11 files, 3,844 lines)

| File:lines | Label | Short description | Where it should live | Lines saved if moved (estimate) |
|---|---|---|---|---|
| `game.js:1-24` | SCREEN | Code-rain canvas background animation (`WORDS`, `sizeRain`, `rainFrame`, `staticRain`, `setRain`) | Stays in `game.js` | 0 |
| `game.js:25-61` | SCREEN | Display tables (`A`, `AN`, `TYPE_TEXT`, `TYPES`, `ROUNDS`, `TEAM`, `OTHERS`, `CLUES`, `STEPS`, `FAC`, `MEMOS`) | Move static copy tables (`TYPE_TEXT`, `CLUES`, `FAC`, `MEMOS`) to data file | 30 |
| `game.js:62-113` | SCREEN | `BRIEFINGS` per-level memo/workshop copy (Levels 1-7) | Move to data file (`data/level-copy.js`) | 52 |
| `game.js:114-171` | SCREEN | `LEVEL_HINTS` ghost and High Tea hint table (Levels 1-7, Bug 19) | Move to data file (`data/hints.js`) | 58 |
| `game.js:172-209` | SCREEN | `FAC_BY_LEVEL` host script copy and lookup helpers (`currentLevel`, `ghostHint`, `teaHint`, `facLines`) | Move `FAC_BY_LEVEL` to data file (keep helpers) | 33 |
| `game.js:210-221` | SCREEN | UI state `fresh()` and `S` | Stays in `game.js` | 0 |
| `game.js:222-260` | COORDINATION | Session setup, name persistence, and level transitions (`newSession`, `endSession`, `signOut`, `resetRoundUI`, `startLevel`, `startNextLevel`, `R`) | Actor owns session/level transitions (`startLevel`, `startNextLevel`); keep UI reset | 18 |
| `game.js:261-275` | SCREEN | DOM/format helpers (`$`, `$$`, `esc`, `shuffle` [`Math.random()`], `T`, `fmt`, `cleanName`, `status`, `flag`, `HEART`) | Stays in `game.js` (remove `Math.random()` `shuffle` if SOP order moves) | 1 |
| `game.js:276-294` | TIMER | `drawTimer`, `afterClose`, and 250ms `setInterval` driving `G.tick()` | Move `G.tick()` loop to Base44 actor wake; keep `drawTimer` | 10 |
| `game.js:295-344` | COORDINATION | Navigation guards and forward dispatch (`canBack`, `fwd`, `goForward`, `milestoneTitle`, `updateNav`) | Move step-advancing logic to `Game`/actor; keep button labels | 20 |
| `game.js:345-373` | SCREEN | Top bar, banner, HUD, step bar (`chrome`), and `go(n)` | Stays in `game.js` | 0 |
| `game.js:374-479` | SCREEN | Views `V[0]` to `V[6]` (sign-in, menu, badge, packet, wardrobe, work style, arrival/lobby, briefing, open floor) | Stays in `game.js` | 0 |
| `game.js:480-554` | SCREEN | `V[7]` trial wrappers (`trialSopScreen`, `trialSplitBriefScreen`, `trialAutoScreen`, `trialMirrorScreen`, `trialJudgedScreen`, `TRIAL_SCREENS`) | Optional: extract `sop-view.js` | 20 |
| `game.js:555-606` | SCREEN | `V[8]` Glitch Report, Accusation, Gift Window UI and bindings (line 596 calls `EP.Bots.answer` directly) | Move `EP.Bots.answer` trigger to `Game` hook | 1 |
| `game.js:607-683` | SCREEN | `V[9]` Stats Update, Graduation, `milestoneCompleteScreen`, `finalResultsScreen`, `END_SCREENS`, `pointBuyHTML` (line 614 re-sorts standings) | Use `G.teamStandings()` at 614; rest stays in `game.js` | 1 |
| `game.js:684-749` | SCREEN | Arrival elevator cutscene SVG, `ADMIN_LINES`, `ROLE_BRIEF`, `vnBox`, `roleBrief`, `skipArrival`, `arrivalAdvance`, `runElevator` | Move `ADMIN_LINES`/`ROLE_BRIEF` copy to data file | 50 |
| `game.js:750-828` | SCREEN | Escape listener, `render()`, `bind()` for steps 0-9 (line 801 calls `G.start()`, line 772 checks `@icstars.org`), `sopPress` | Move `G.start()` and email enforcement to actor | 4 |
| `game.js:829-863` | COORDINATION | Single-player step-closing triggers (`lockPoints`, `applyOpenFloorEnd`, `checkSop`, `sopPile`, `sopScored`, `payCost`, `endAccusations`) | Move step-closing logic to `Game`/actor; keep `sopPile`/`sopScored` | 28 |
| `game.js:864-884` | SCREEN | Glitch cursor, nav button bindings, `BoardView`, `FullscreenView`, Host Script toggle, `AttendanceView` mount | Stays in `game.js` | 0 |
| `game.js:885-912` | COORDINATION | `DEV_JUMP`, `devJumpLevel`, `devJump`, keydown listener, initial `render()` | Gate behind server/test config + `Game` flag (Bug 21) | 15 |
| `mirror-view.js:1-28` | SCREEN | Formatters, `STEP_LABELS`, `playerById`, `statusBadge`, `inBand` | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:29-36` | RULE | `shuffleArr` using `Math.random()` for cable bag (Bug 54) | `rules/MirrorParts.js` (`SetupCrew` using `#rng`) | 8 |
| `mirror-view.js:37-106` | SCREEN | Display helpers (`milestoneLabel`, `ownerSlotFor`, `stepProgressText`, `setupProgressSig`, `formatBoost`, `formatAtt`, `countSetupHiccups`) | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:107-126` | TIMER | `resetShowtimeState` initializing local cables/sound/mic/deck/Q&A clocks | Move step clocks/state to `SetupCrew` | 10 |
| `mirror-view.js:127-168` | SCREEN | `screen(opts)` setup, `G.mirror*` reads, lobby cursor init (`155-156` uses `Math.random()`) | Seed cursor start in `MirrorLobby` | 2 |
| `mirror-view.js:169-194` | SCREEN | `lobbySecs`, `showtimeSecs`, `teamAttentionPct`, `rackMachines` helpers | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:195-301` | SCREEN | Header, lobby-failed banner, and trial result HTML builders | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:302-422` | SCREEN | Lobby phase HTML, signal-grab click handler, 250ms cursor sweep `tick` | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:423-487` | SCREEN | Crew Reveal / Failed phase HTML, `bind`, phase-change `tick` | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:488-511` | COORDINATION | Showtime snapshot init and local step-change cleanup | Shrinks once step timers move to `SetupCrew` | 10 |
| `mirror-view.js:512-556` | TIMER | `ensureMicFlash`, `ensureDeckTimer`, `ensureQaTimer` screen timer initializers | `rules/MirrorParts.js` (`SetupCrew` deadlines) | 45 |
| `mirror-view.js:557-753` | SCREEN | Showtime HTML renderers (attention bar, setup frame, dance readout, waiting view, all 5 setup steps, wrap-up) | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:754-791` | COORDINATION | `syncSetupSnapshots` and `checkSetupChange` polling rules state for updates | Stays in `mirror-view.js` (actor push on Base44) | 0 |
| `mirror-view.js:792-837` | SCREEN | Showtime view routing (failed, wrapped, `MirrorDanceView` handoff, setup owner/waiting, inactive) | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:838-890` | SCREEN | Incremental DOM updaters (`updateMsgEl`, `updateSoundUI`, `updateMicUI`, `updateDeckOrderUI`) | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:891-944` | RULE | Cables click handler judging hit vs spark (`-3`) against local belt clock | Move belt/hit validation to `SetupCrew` | 25 |
| `mirror-view.js:945-970` | RULE | Sound click handler mutating local `snd.level` and triggering `G.mirrorSoundFeedback` | `rules/MirrorParts.js` (`SetupCrew`) | 15 |
| `mirror-view.js:971-1074` | SCREEN | Mic, Deck (line 1027 spite-reshuffle timer), Q&A, and Wrap-up click handlers | Move line 1027 spite timer to `SetupCrew` | 3 |
| `mirror-view.js:1075-1126` | SCREEN | Showtime `tick` updating attention bar, timer, setup changes, and dance readout | Stays in `mirror-view.js` | 0 |
| `mirror-view.js:1127-1164` | TIMER | Cables belt 250ms spawner, `Math.random()` shuffle, missed-cable re-queue | `rules/MirrorParts.js` (`SetupCrew` using `#rng`) | 32 |
| `mirror-view.js:1165-1209` | TIMER | Sound check 250ms simulation (`Math.random()` spikes/jitter, drift, passive `-4` feedback, 3s hold step advance) | `rules/MirrorParts.js` (`SetupCrew` using `#rng`) | 40 |
| `mirror-view.js:1210-1249` | TIMER | Mic flash-hide timer, Deck reshuffle timer (`G.mirrorReshuffleDeck`), Q&A 29-tick timeout (`G.mirrorTimeoutQa`) | `rules/MirrorParts.js` (`SetupCrew` + `Game`/`Timer` deadlines) | 35 |
| `mirror-view.js:1250-1256` | SCREEN | Return object and `MirrorView` export | Stays in `mirror-view.js` | 0 |
| `mirror-dance-view.js:1-50` | SCREEN | Formatters, `statusBadge`, `fallbackAvatar`, `dancerAvatarHTML` | Stays in `mirror-dance-view.js` | 0 |
| `mirror-dance-view.js:51-60` | RULE | `nextArrowDir` rolling `Math.random()` with max-2-same rule | `rules/MirrorParts.js` (`DanceCrew` using `#rng`) | 10 |
| `mirror-dance-view.js:61-99` | TIMER | `initDanceState`, `noteGapTicks` tempo ramp, `spawnNoteOn` note scheduler | `rules/MirrorParts.js` (`DanceCrew` seeded chart) | 30 |
| `mirror-dance-view.js:100-118` | RULE | `noteZone` window classifier (`perfect`/`good`/`incoming`) + `laneHTML` | Align window logic with `DanceCrew`; keep `laneHTML` | 6 |
| `mirror-dance-view.js:119-245` | SCREEN | `screen(opts)` setup, 0-dancer fallback, dancer/roster/lane HTML builders | Stays in `mirror-dance-view.js` | 0 |
| `mirror-dance-view.js:246-354` | SCREEN | DOM sync helpers (`updateAttentionAndTimerDOM`, `syncAvatarsDOM`, `syncDanceDOM`, `flashKey`, `cleanup`) | Stays in `mirror-dance-view.js` | 0 |
| `mirror-dance-view.js:355-398` | TIMER | `stepMotion` advancing note clock and charging `-2` misses via `G.mirrorDanceMiss(ME)` | `rules/MirrorParts.js` (`DanceCrew`) | 30 |
| `mirror-dance-view.js:399-454` | RULE | `handleInput` judging perfect/good/stray against local note clock | Validate/score in `DanceCrew`; keep input sender | 25 |
| `mirror-dance-view.js:455-476` | SCREEN | Arrow-key `onKey` listener (blocks keys while `.board-ov` is open) | Stays in `mirror-dance-view.js` | 0 |
| `mirror-dance-view.js:477-492` | TIMER | `frame(ts)` `requestAnimationFrame` loop driving `stepMotion` | Keep for visual animation only (not miss scoring) | 6 |
| `mirror-dance-view.js:493-560` | SCREEN | `bind`, `tick`, return object, `MirrorDanceView` export | Stays in `mirror-dance-view.js` | 0 |
| `splitbrief-view.js:1-291` | SCREEN | Complete Split Brief UI (cards, notes, board, Lock In confirm, twist popup, focus restore, `tick`). Note: mutates `G.round.trial` directly instead of calling `Game` (see Section C). | Stays in `splitbrief-view.js` (rewire calls through `Game`) | 0 |
| `judged-view.js:1-25` | SCREEN | Formatters and `screen(opts)` setup | Stays in `judged-view.js` | 0 |
| `judged-view.js:26-28` | COORDINATION | Render-time `G.startWriting()`, `EP.Bots.submit(G)`, and `G.startVote()` | `rules/Game.js` (`advance()` / `Bots.hooks`) | 3 |
| `judged-view.js:29-95` | SCREEN | Result table, writing box, and vote form HTML | Stays in `judged-view.js` | 0 |
| `judged-view.js:96-111` | SCREEN | Vote select and `#castVote` binding (calls `v.cast()` directly; see Section C) | Stays in `judged-view.js` (route `v.cast` through `Game`) | 0 |
| `judged-view.js:112-116` | COORDINATION | Post-vote `EP.Bots.vote(G, v, G.rng); G.runTrial()` closing trial on one vote | `rules/Game.js` (`Bots.hooks` + vote close rule) | 4 |
| `judged-view.js:117-121` | SCREEN | Return object and `JudgedView` export | Stays in `judged-view.js` | 0 |
| `world-map.js:1-199` | SCREEN | Floor 60 geometry, collision, SVG map/minimap, room/NPC/ghost panels, `rAF` movement (cosmetic `Math.random()` at 172), keyboard/joystick controls | Stays in `world-map.js` | 0 |
| `world-map.js:200-203` | TIMER | Dead `ghostHop` `setInterval(2600)` + `Math.random()` for removed `.gwalk` elements + whisper auto-hide | Remove dead `ghostHop` timer | 4 |
| `pixel-art.js:1-120` | SCREEN | Palettes, pixel intern `sprite`/`pix` SVG engine, `TOOLS` icons, `avatarSVG`, instructor SVGs | Stays in `pixel-art.js` | 0 |
| `pixel-art.js:121-146` | SCREEN | `DIALOGS` instructor onboarding copy, `DPOS`, `dialogsHTML` | Optional: move `DIALOGS` copy to data file | 20 |
| `pixel-art.js:147-162` | SCREEN | UI icons `IC` and `tabIcon` | Stays in `pixel-art.js` | 0 |
| `board.js:1-52` | SCREEN | Read-only Progress Board modal reading only `Game.board()` | Stays in `board.js` | 0 |
| `attendance-view.js:1-30` | SCREEN | Overlay DOM, `input()` reporter (sends `Date.now()`), `show`/`close` popup UI | Stays in `attendance-view.js` (drop client `Date.now()`) | 0 |
| `attendance-view.js:31-44` | TIMER | `tick()` calling `G.checkAttendance(Date.now())` and rendering popup/miss | Run `checkAttendance` on Base44 actor; client listens to events | 10 |
| `attendance-view.js:45-75` | SCREEN | Capture-phase key swallow, input listeners, throttled `pointermove`, 1s `setInterval` (line 73) | Remove client `setInterval` on Base44; keep input + key swallow | 1 |
| `attendance-view.js:76-86` | SCREEN | `missedText` formatter and `AttendanceView` export | Stays in `attendance-view.js` | 0 |
| `fullscreen-view.js:1-38` | SCREEN | Fullscreen toggle button and `fullscreenchange` listener | Stays in `fullscreen-view.js` | 0 |
| `pages/vote-test.js:1-22` | SCREEN | Standalone test page helpers, mounts, UI state | Stays in `pages/vote-test.js` | 0 |
| `pages/vote-test.js:23-67` | COORDINATION | `newGame`, `placeMine` (mutates `ME` directly), bot round loop for Levels 1-4 | Replace with `Game.jumpToLevel(5)` + `Bots.hooks` | 35 |
| `pages/vote-test.js:68-84` | TIMER | 1s `setInterval` calling `G.tick()` and auto-transitioning `toVote()` | Replace with shared page tick or `Game` timer hook | 10 |
| `pages/vote-test.js:85-163` | SCREEN | Setup, prompt, `JudgedView` wrapper, done screen, `render`, `bind` | Stays in `pages/vote-test.js` | 0 |

### Section B Summary: Lines per label per file

| File | RULE | TIMER | PASS-THROUGH | COORDINATION | SCREEN | Total | Movable out (est.) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `rules/Game.js` | 154 | 171 | 251 | 465 | 0 | 1,041 | 465 |
| `rules/Trial.js` | 832 | 2 | 108 | 354 | 0 | 1,296 | 1,143 (optional split) |
| `rules/MirrorParts.js` | 1,172 | 228 | 0 | 204 | 0 | 1,604 | 0 |
| **Subtotal rules mapped (3 files)** | **2,158** | **401** | **359** | **1,023** | **0** | **3,941** | **465 (`Game.js`)** |
| `game.js` | 0 | 19 | 0 | 152 | 741 | 912 | 341 |
| `mirror-view.js` | 88 | 188 | 0 | 62 | 918 | 1,256 | 225 |
| `mirror-dance-view.js` | 85 | 99 | 0 | 0 | 376 | 560 | 107 |
| `splitbrief-view.js` | 0 | 0 | 0 | 0 | 291 | 291 | 0 |
| `judged-view.js` | 0 | 0 | 0 | 8 | 113 | 121 | 7 |
| `world-map.js` | 0 | 4 | 0 | 0 | 199 | 203 | 4 |
| `pixel-art.js` | 0 | 0 | 0 | 0 | 162 | 162 | 20 |
| `board.js` | 0 | 0 | 0 | 0 | 52 | 52 | 0 |
| `attendance-view.js` | 0 | 14 | 0 | 0 | 72 | 86 | 11 |
| `fullscreen-view.js` | 0 | 0 | 0 | 0 | 38 | 38 | 0 |
| `pages/vote-test.js` | 0 | 17 | 0 | 45 | 101 | 163 | 45 |
| **Subtotal screen files (11 files)** | **173** | **341** | **0** | **267** | **3,063** | **3,844** | **760** |
| **Total `Game.js` + screen files** | **327** | **512** | **251** | **732** | **3,063** | **4,885** | **1,225** |

Summary of movable lines:
- Out of `rules/Game.js`: **~465 lines** (140 `jumpToLevel`, ~155 Mirror timer/coordination/pass-through glue, ~85 timer tables/Split Brief/Attendance schedule, ~85 rules in `Attendance`/`Round`/`Team`/`Economy`).
- Out of screen files: **~760 lines** total (~517 lines of gameplay RULE/TIMER/COORDINATION/dead timer code plus ~243 lines of static copy tables such as `BRIEFINGS`, `LEVEL_HINTS`, `FAC_BY_LEVEL`, `ADMIN_LINES`, `ROLE_BRIEF`, `CLUES`, `MEMOS`, `DIALOGS`).
- Combined (`Game.js` + all 11 screen files): **~1,225 lines** (~982 lines excluding static copy tables).

---

## C. Game methods the screens call

Total distinct `Game` methods called from screen code: **64** (**58** called by the main app `index.html` screens, plus **6** called only by the standalone test page `pages/vote-test.js`: `closeWriting`, `computeEarnings`, `endGlitchReport`, `lockIn`, `payTrialCosts`, `setPrompt`). Breakdown: **18** read-only, **46** state-changing (including `results` which locks endings on its first call and `typeSubmission` which records Attendance activity).

| Game method | Called from (file:line) | Reads only or changes state | Notes |
|---|---|---|---|
| `accuse` | `game.js:810` | Changes state | Glitch Report accusation (`G.accuse(ME, target)`). |
| `activity` | `attendance-view.js:15`, `judged-view.js:107`, `mirror-dance-view.js:405`, `mirror-view.js:346, 896, 947, 973, 1007, 1039, 1063`, `splitbrief-view.js:162, 172, 184, 194, 206, 218, 229, 237` | Changes state | Resets Attendance timer and clears `idle`. `attendance-view.js:15` passes client `Date.now()`; Base44 actor should stamp server time. |
| `advance` | `game.js:327`, `pages/vote-test.js:44, 45, 46, 47, 54, 55, 62, 63` | Changes state | Advances round step. Server/host-owned on Base44 (not a player call). |
| `answerGift` | `game.js:603` | Changes state | Accepts/declines pending gift. Currently passes a live `Gift` object from `G.round.gifts`; Base44 needs a gift ID. |
| `board` | `game.js:874`, `pages/vote-test.js:15` | Reads only | Safe public Progress Board snapshot (no hidden stats or types). |
| `cashOut` | `game.js:817` | Changes state | Independent once-per-game 2 hearts for +1 point at Stats Update. |
| `checkAttendance` | `attendance-view.js:34` | Changes state | Sets `idle`, `attendancePending`, or locks attendance glitch + Empathy. Must run on Base44 server, not from client `Date.now()`. |
| `closeTimer` | `game.js:251, 835, 840, 845, 848, 860` | Changes state | Force-closes active timer for the whole game. Single-player shortcut; must NOT be a player actor call on Base44. |
| `closeWriting` | `pages/vote-test.js:120` | Changes state | Test page only ("Test: end the timer now"). Host/timer-only on Base44. |
| `computeEarnings` | `pages/vote-test.js:48` | Changes state | Test page only (`vote-test.js` bot loop). Server-only on Base44. |
| `didRun` | `game.js:234, 235, 236, 237, 853`, `judged-view.js:25`, `mirror-dance-view.js:132`, `mirror-view.js:138, 377, 481, 897, 948, 974, 1008, 1040, 1064, 1077`, `splitbrief-view.js:43`, `pages/vote-test.js:83` | Reads only | Checks round action completion flags (`runTrial`, `endGlitchReport`, `lockIn`, `finishRound`, `payTrialCosts`). |
| `draftPoint` | `game.js:815, 816` | Changes state | Adds (+1) or removes (-1) a draft point at Stats Update or Graduation. |
| `endGlitchReport` | `pages/vote-test.js:45` | Changes state | Test page only (`vote-test.js` bot loop). Server-only on Base44. |
| `endTrial` | `game.js:854` | Changes state | Pays trial costs for all players and advances to Glitch Report. Server/host-only on Base44. |
| `finishRound` | `game.js:840`, `pages/vote-test.js:50` | Changes state | Refills hearts, rolls Grit bonus, moves to Intermission. Server-only on Base44. |
| `gift` | `game.js:596` | Changes state | Sends 1 or 2 gift points to a teammate in Open Floor or Gift Window. |
| `jumpToLevel` | `game.js:904` | Changes state | Dev jump (`Ctrl+Shift+1..7`). Must be disabled/gated in production Base44 actor (Bug 21). |
| `lockIn` | `pages/vote-test.js:47` | Changes state | Test page only (`vote-test.js` bot loop). Server-only on Base44. |
| `lockPoints` | `game.js:833, 838` | Changes state | Commits player's draft points during Stats Update or Graduation. |
| `mirrorAnswerQa` | `mirror-view.js:1046` | Changes state | Submits Level 3 Q&A answer (may recover 5 or cost 5 and trigger 0% close). |
| `mirrorAttention` | `mirror-view.js:182, 226`, `mirror-dance-view.js:147` | Reads only | Current/final team Audience Attention (0..100). |
| `mirrorCableHit` | `mirror-view.js:914` | Changes state | Records Level 3 cable port connected. |
| `mirrorCableMiss` | `mirror-view.js:933` | Changes state | Records Level 3 cable spark (-3 attention, checks 0% fail). |
| `mirrorConnect` | `mirror-view.js:353` | Changes state | Records Level 3 lobby signal connect (may close lobby early). |
| `mirrorCrew` | `mirror-view.js:143` | Reads only | Returns team's `{ setupIds, danceIds }`. |
| `mirrorDanceHit` | `mirror-dance-view.js:426` | Changes state | Records Level 3 dancer note hit (`perfect` +3 or `good` +2, cap 45). |
| `mirrorDanceMiss` | `mirror-dance-view.js:375` | Changes state | Records Level 3 dancer missed note (-2 penalty, checks 0% fail). Currently fired by client `rAF` clock. |
| `mirrorDanceStray` | `mirror-dance-view.js:439` | Changes state | Records Level 3 dancer off-beat key press (-1 penalty, checks 0% fail). |
| `mirrorDanceTeam` | `mirror-view.js:274, 489, 1098`, `mirror-dance-view.js:128, 283, 394` | Reads only | Returns team Dance Crew snapshot (`dancers`, `avgBoost`, `avgPenalties`). |
| `mirrorFailReason` | `mirror-view.js:146, 1077`, `mirror-dance-view.js:134` | Reads only | Returns `"lobby"`, `"attention"`, or `null`. |
| `mirrorLobbyTeam` | `mirror-view.js:140, 348, 387` | Reads only | Returns team lobby snapshot (`players`, `connected`, `speed`, `zone`, `failed`, `allConnected`). |
| `mirrorMicTap` | `mirror-view.js:981` | Changes state | Records Level 3 mic memory tap (advances round/step or charges -4). |
| `mirrorMiss` | `mirror-view.js:362` | Changes state | Records Level 3 lobby signal miss (+2 speed up to 16, rolls glitch reason). |
| `mirrorPhase` | `game.js:208`, `mirror-view.js:139, 347, 377, 481, 897, 948, 974, 1008, 1040, 1064, 1077`, `mirror-dance-view.js:133` | Reads only | Returns `"idle"`, `"lobby"`, `"reveal"`, `"showtime"`, `"failed"`, or `null`. |
| `mirrorPickFile` | `mirror-view.js:1015` | Changes state | Records Level 3 deck file click (advances step or charges -6). |
| `mirrorReshuffleDeck` | `mirror-view.js:1219` | Changes state | Reshuffles deck file order via `G.rng`. Currently fired by client 250ms tick. |
| `mirrorRole` | `mirror-view.js:145` | Reads only | Returns `"setup"`, `"dance"`, or `null` for `ME`. |
| `mirrorSetupSlots` | `mirror-view.js:144` | Reads only | Returns team Setup Crew slot assignments and steps. |
| `mirrorSetupTeam` | `mirror-view.js:263, 488, 898, 918, 935, 949, 962, 975, 983, 1009, 1017, 1041, 1048, 1065, 1069, 1097, 1184, 1194, 1240`, `mirror-dance-view.js:127, 135, 529` | Reads only | Returns full team Setup Crew snapshot. On Base44, scope `mic.sequence` to the active Setup owner only. |
| `mirrorShowtimeSecondsLeft` | `mirror-view.js:177`, `mirror-dance-view.js:142` | Reads only | Fallback remaining showtime seconds. |
| `mirrorSoundFeedback` | `mirror-view.js:959, 1181` | Changes state | Records Level 3 sound overshoot (-4 penalty, checks 0% fail). Line 1181 fires passively from client tick. |
| `mirrorSoundHeld` | `mirror-view.js:1192` | Changes state | Records Level 3 sound 3s hold complete (advances step). Fired from client tick. |
| `mirrorTimeoutQa` | `mirror-view.js:1238` | Changes state | Records Level 3 Q&A timeout (-5 penalty, advances Q&A). Fired from client tick. |
| `mirrorWrapUp` | `mirror-view.js:1067` | Changes state | Last Setup player locks team attention and may close showtime early. |
| `payTrialCosts` | `pages/vote-test.js:44` | Changes state | Test page only (`vote-test.js` bot loop). Server-only on Base44. |
| `placeAllRemaining` | `game.js:835, 840` | Changes state | Auto-places all unplaced points when no timer is running. Server-only on Base44. |
| `results` | `game.js:613, 835` | Changes state (1st call) / Reads only (later) | First call locks all Level 7 endings and pauses Attendance; later calls return locked endings. Line 613 calls it during render. |
| `runTrial` | `game.js:518`, `judged-view.js:113`, `pages/vote-test.js:121` | Changes state | Finalizes and ranks the trial for all teams. Server/timer/all-voted owned on Base44. |
| `sabotage` | `game.js:806` | Changes state | Contrarian Open Floor sabotage action. |
| `secondsLeft` | `game.js:279, 477, 569`, `mirror-view.js:170, 175`, `mirror-dance-view.js:140`, `splitbrief-view.js:90`, `pages/vote-test.js:77, 113` | Reads only | Whole seconds remaining on active step timer. |
| `setPrompt` | `pages/vote-test.js:153` | Changes state | Test page only (host-only Level 5-6 prompt selector). |
| `setSopBoard` | `game.js:497, 498, 499` | Changes state | Updates team's shared Level 1 SOP board. |
| `sopBoard` | `game.js:487, 496, 850` | Reads only | Returns team's Level 1 SOP board steps. |
| `start` | `game.js:801`, `pages/vote-test.js:145` | Changes state | Starts the step timer engine. Server/host/lobby-timer owned on Base44. |
| `startNextRound` | `game.js:251, 255`, `pages/vote-test.js:54, 62` | Changes state | Starts next level's Briefing. Server/host-owned on Base44. |
| `startVote` | `judged-view.js:27, 73`, `pages/vote-test.js:83` | Changes state | Opens Level 5-6 Vote phase. Server-owned on Base44. |
| `startWriting` | `judged-view.js:26`, `pages/vote-test.js:66, 155` | Changes state | Opens Level 5-6 writing phase and rolls prompt if no host. Server-owned on Base44. |
| `submit` | `judged-view.js:70` | Changes state | Submits Level 5-6 written response (may close writing early when all active submit). |
| `teamOf` | `game.js:471, 622, 905`, `judged-view.js:84`, `pages/vote-test.js:34` | Reads only | Looks up a player's `Team`. |
| `teamStandings` | `game.js:631` | Reads only | Returns teams sorted by `trialWins`. |
| `teamTrialResults` | `game.js:626` | Reads only | Returns `{ [level]: won }` copy for a team. |
| `tick` | `game.js:293`, `pages/vote-test.js:76` | Changes state | Advances timers, twist deadline, bot hooks, and Mirror attention check. Server scheduled wake on Base44. |
| `trialRanking` | `mirror-view.js:221` | Reads only | Returns current trial's `ranking` array. |
| `typeSubmission` | `judged-view.js:58` | Changes state (calls `activity`) | Validates submission character count and records Attendance activity on input. |

### Flagged: Screen code that reads or writes rules objects directly (bypassing `Game`)

1. **Direct writes / mutations bypassing `Game` (CRITICAL for Base44):**
   - `splitbrief-view.js:163` (`trial.postNote(ME, noteIn.value)`): writes team notes directly on `SplitBriefTrial` without a `Game` method (`Game` has no Split Brief action pass-throughs).
   - `splitbrief-view.js:186, 198, 210, 221` (`trial.setBoard(ME, ...)`): mutates team board directly on `SplitBriefTrial`.
   - `splitbrief-view.js:230` (`trial.lockIn(ME)`): locks team board (and can close the trial via `onAllLocked`) directly on `SplitBriefTrial`.
   - `judged-view.js:108` (`v.cast(ME, ...)`): casts Level 5-6 ballot directly on `Vote` (`G.round.trial.vote`), bypassing `Game` (`Game` has no `castVote` method).
   - `judged-view.js:26, 113` (`EP.Bots.submit(G)`, `EP.Bots.vote(G, v, G.rng)`): screen calls `Bots` directly to mutate trial/vote state and advance `G.rng`.
   - `game.js:596` (`EP.Bots.answer(G, r.gift, G.rng)`): screen calls `Bots` directly to answer gifts and advance `G.rng`.
   - `pages/vote-test.js:39-40` (`ME.earned = Math.min(ME.earned, ME.roomLeft()); ME.placePoints(...)`): directly writes `Player.earned` and mutates `Player` points bypassing `Game`/`Economy`.
   - `pages/vote-test.js:26, 30-32, 45-46, 49, 55-56, 63, 70, 121`: directly instantiates `EP.Player`/`EP.Team`/`EP.Game` and invokes `EP.Bots.*` (test harness).

2. **Direct reads of `Game` internal properties and sub-objects (breaks server-to-client privacy boundary on Base44):**
   - `G.players`, `G.teams`, `G.rng`: `game.js:226, 596, 614`, `judged-view.js:48, 83, 89, 108, 113`, `mirror-view.js:187` (gives screen code direct references to every player's secret `type`, `attrs`, `hearts`, `caughtBy`, and `G.rng`).
   - `G.round` and its internals (`G.round.drainOn`, `G.round.gifts`, `G.round.caughtOn`, `G.round.sopResults`, `G.round.earnings`, `G.round.trial`): `game.js:205, 251, 259, 480, 487, 513, 558, 598, 603, 605, 673, 851`, `splitbrief-view.js:42`, `judged-view.js:25, 29`, `attendance-view.js:14`, `pages/vote-test.js:72, 79, 83, 99, 113, 115, 121, 132`. Notably `G.round.gifts` (`game.js:598`) and `G.round.earnings` (`game.js:673`) expose all players' records, and `game.js:487, 513` reads `G.round.trial.ranking` instead of `G.trialRanking()`.
   - Direct `SplitBriefTrial` reads: `splitbrief-view.js:47, 51-53, 59-65, 68, 85, 90, 186, 195, 207, 219, 238, 257, 267, 273, 277` (`trial.ranking`, `boardFor`, `postTwistAnswer`, `cardsFor`, `twistFired`, `twistFor`, `notesFor`, `notesLeft`, `isLocked`, `tasks`, `scenario`). Note: reading `trial.postTwistAnswer` before trial close must never be sent to clients on Base44.
   - Direct `JudgedTrial` and `Vote` reads: `judged-view.js:25-27, 33, 46-50, 73, 82-83, 87, 89, 91` and `pages/vote-test.js:72, 79, 83, 115, 121` (`writing`, `vote`, `ranking`, `submissions`, `prompt`, `choicesFor`, `slotsFor`).
   - Direct `Player` and `Team` object reads: `game.js` (`273, 310, 367-368, 462-463, 468, 473-474, 482-483, 557-589, 606, 614-681, 833, 838`), `world-map.js:124-125, 130, 188`, `splitbrief-view.js:55, 66, 93`, `judged-view.js:38, 48, 82-89, 94`, `mirror-view.js:17, 21, 224, 285, 313, 457, 832`, `mirror-dance-view.js:9, 13`, `attendance-view.js:80`, `pages/vote-test.js:38-40, 116`.
   - Direct `EP.*` rule-helper calls (beyond static display constants): `world-map.js:124, 125, 188` (`EP.Sabotage.cost`, `EP.Sabotage.check`), `game.js:589` (`EP.Gift.cost`, `EP.Gift.check`), `game.js:259` (`new EP.Round(1)`), `game.js:270, 455-456, 798-799` (`EP.Player.spendLeft/canRaise/canLower/startValue`), `splitbrief-view.js:52` (`SBT.score`). On Base44, live per-player state and action eligibility should come from a `Game.playerView(playerId)` projection instead of direct `Player`/`Team`/`Round`/`Trial` object access.


---

## D. Code checks

### D.1 Flaky screen tests (Bug 18)

| File:lines | Test / Run | Dependency type | Cause |
|---|---|---|---|
| `Tests/check_screens.js:82, 88-91, 3652, 3658, 3660` | Runs 1-2 (`level1`, `waitForGift`) | Timing | Uses real wall-clock `Date.now()` and `sleep(1000)` polling up to 40s for the live 30s Gift Window (`secs < 35`), plus fixed `sleep(12000)` and `sleep(10000)`. CPU/CI load or timer jitter can push `secs >= 35`. |
| `Tests/check_screens.js:76` | `creation` helper | Timing | Polls `for (let i = 0; i < 40; i++) { next(); await sleep(200); }` against real `setTimeout` elevator steps (`game.js:747-748`) and 1800ms spawn delay (`game.js:742`). |
| `Tests/check_screens.js:658-688` | Run 3 (`walk` / `breakoutLabel`) | Timing + Random | Walks via live `requestAnimationFrame` (`world-map.js:157`) with `await sleep(10)` polling and a 300ms real-time stall cutoff (`still >= 300`). Slow jsdom frames can halt the walk before reaching Breakout Room (`x >= 1628`, `y <= 712`). Line `674` manually neutralizes ghosts to dodge random `ghostHop` (`world-map.js:202`). |
| `Tests/check_screens.js:347, 371, 3276, 3312` | Run 4 (`fullSevenLevelGame`) and Run 12 (`mirrorStep8Cases`) | Random | Mirror lobby cursor `pos` and `dir` start with unseeded `Math.random()` (`mirror-view.js:155-156`) and are probed with bounded loops (`60` and `80` ticks). |
| `Tests/check_screens.js:210, 341-485` | Run 4 (`fullSevenLevelGame`) | Timing + Random | Swaps `G._timer.clock = () => window._mirSimNow` while `game.js:293`'s real 250ms `setInterval` keeps running across `await sleep(10)` and `sleep(2)` pauses, advancing `mirror-view.js` ticks asynchronously mid-test. Bounded loops at `422` (25-tick cable frame) and `432-443` (sound) also depend on unseeded `Math.random()` (`mirror-view.js:32, 1170-1178`). |
| `Tests/check_screens.js:1149, 1195, 1783, 1792` | Runs 7-8 (Mirror Setup Crew) | Random | 200-tick cable loops (`1149, 1783`) and 400-tick sound loops (`1195, 1792`) rely on unseeded `Math.random()` in cable bag shuffle (`mirror-view.js:32`) and sound bar jumps (`mirror-view.js:1170-1178`). |
| `Tests/check_screens.js:2073, 2162` | Run 9 (Mirror Dance Crew) | Random | Dance note loops rely on unseeded `Math.random()` lane selection in `mirror-dance-view.js:53`. |
| `Tests/check_screens.js:690-719` | Run 5 (`voteTestPage`) | Random + Timing | Creates a separate `JSDOM` for `pages/vote-test.html` without pinning `EP.Rng.randomSeed`, so `pages/vote-test.js:10, 25` seeds from `Date.now() ^ Math.random()` (non-deterministic game every run); also uses `await sleep(100)` and `sleep(50)`. |
| `Tests/check_screens.js:21-38, 3145, 3642-3683` | Runs 1-4 and 6-12 | Order + Timing | All runs except Run 5 share a single `JSDOM` window (`w`), one 250ms `setInterval` (`game.js:293`), one 1000ms `setInterval(api.tick, 1000)` (`attendance-view.js:73`), and one 2600ms `setInterval(ghostHop, 2600)` (`world-map.js:202`). Run 2 depends on Run 1 clicking `#replay` (`3654`); Run 3 depends on Run 2 clicking `#replay` (`3661`); `w.EP.Rng.randomSeed = () => 2026` is set only once at `3644`; and line `3145` explicitly races `attendance-view.js`'s 1s `ATT.tick` ("no sleep before keydown so 1s ATT.tick cannot close it first"). |

### D.2 `LEVEL_HINTS` (Bug 19)

- **Location and size:** `game.js:114-171` (58 lines; 7 entries for Levels `1` through `7`, each defining `ghosts: { "USER_???", "ATTEMPT_01", "NULL" }` and `tea`).
- **Direct readers:** `ghostHint(name)` at `game.js:206`, `teaHint()` at `game.js:207`, and one test eval in `Tests/check_screens.js:123` (`LEVEL_HINTS[1].ghosts["ATTEMPT_01"]` and `LEVEL_HINTS[1].tea`). `world-map.js:126, 135, 203` calls `teaHint()` / `ghostHint()`, not `LEVEL_HINTS` directly.
- **What a move to a data file would take:**
  1. Move `LEVEL_HINTS` into a dedicated data file: either `data/level-hints.js` defining global `LEVEL_HINTS` and loaded via `<script src="data/level-hints.js">` in `index.html` right before `game.js:44` (zero caller changes), OR `rules/levelHints.js` exported via `rules/index.js` as `EP.LEVEL_HINTS`, rebuilt into `rules/rules.bundle.js`, and read via `EP.LEVEL_HINTS` (with a 1-line alias in `game.js` to keep `Tests/check_screens.js:123` working).
  2. Delete `game.js:114-171` (saves 58 lines in `game.js`). Minimal migration risk.

### D.3 Hint rows for Levels 4 to 7 (Bug 20)

- **Do they exist?** Yes. Placeholder rows exist at `game.js:139-170`: Level 4 (`139-146`), Level 5 (`147-154`), Level 6 (`155-162`), Level 7 (`163-170`), each containing all 3 ghosts (`USER_???`, `ATTEMPT_01`, `NULL`) and a `tea` string.
- **What is missing:**
  1. **Approved design copy in `CLAUDE.md`:** `CLAUDE.md` specifies approved ghost and tea hints only for Levels 1, 2 (`CLAUDE.md:482-486`), and 3 (`CLAUDE.md:545-550`). Levels 4 to 7 in `game.js:139-170` are unapproved placeholder copy added in Level 2 Step 6a, and Level 4's real mini-game is not designed yet (`AutoTrial`).
  2. **Reachability for Level 7:** `game.js:163-170` is dead/unreachable in normal play because Level 7 skips Open Floor and moves straight from Briefing (`V[5]`) to Graduation (`V[9]`) at `game.js:327` (`go(R().isFinal?9:6)`).
  3. **Screen test coverage:** `Tests/check_screens.js` verifies hints only for Levels 1 (`123-124`), 2 (`130-136`), and 3 (`166-190`), not Levels 4 to 7.
  4. **Attribute mentions in placeholders:** `game.js:143` ("Initiative"), `150` ("Composure"), and `158` ("Five points... Composure") name the tested attribute, which is shown in Open Floor after Briefing (no pre-briefing leak, though Level 4-6 copy remains unapproved placeholder text).

### D.4 Dev jump (Bug 21)

- **Where the flag is read:** `game.js:886` declares `var DEV_JUMP = true;` (a mutable global `var`). It is checked only in `devJump(n)` (`game.js:893`) and the `keydown` handler (`game.js:911`).
- **Does the rules engine refuse a jump when the flag is off?** **No.** `Game.jumpToLevel(targetLevel)` (`rules/Game.js:358-498`) has no flag, constructor option, or permission check. Calling `G.jumpToLevel(n)` directly (e.g. from DevTools console or a Base44 actor call) succeeds even when `DEV_JUMP = false`. (`Tests/check_screens.js:3119` also calls `g.jumpToLevel(7)` directly with no flag.) For Base44, `Game` (or the actor wrapper) must store an explicit dev/test flag defaulting to `false` and refuse `jumpToLevel` when off.

### D.5 `Game.jumpToLevel` (Bug 27)

- **Exact line range:** `rules/Game.js:358-498` (141 lines; `356-498` with doc comment = 143 lines).
- **Coupling analysis:**
  - Uses public `Game` members/methods: `level`, `step`, `running`, `start()`, `players`, `teams`, `round`, `rng`, `hooks` (`onFastForward`, `beforeClose`), `now()`, `didRun()`, `advance()`, `startNextRound()`, `closeMirrorLobby()`, `startMirrorShowtime()`, `closeMirror()`, `closeSop()`, `closeSplitBrief()`, `setPrompt()`, `startWriting()`, `closeWriting()`, `startVote()`, `runTrial()`, `endTrial()`, `closeGlitchReport()`, `closeGiftWindow()`, `lockIn()`, `computeEarnings()`, `placeAllRemaining()`, `finishRound()`, `syncAttendance()`, `refreshTimer()`, plus `Round.LEVELS` and `Trial.*`.
  - Only private/internal access: `this._timer.current` and `this._timer.closeAt(...)` at `rules/Game.js:384, 393, 399, 410-411, 423, 426, 441, 459, 469, 476`.
- **What a move to its own file (e.g. `rules/devJump.js`) would take:**
  1. Replace `this._timer.current` and `this._timer.closeAt(...)` with existing public `game.timer` (`rules/Game.js:130`) and `game.closeTimerAt(...)` (`rules/Game.js:190`).
  2. Create `rules/devJump.js` exporting `jumpToLevel(game, targetLevel)` importing `Round` and `Trial` (following single-line imports/exports per `CLAUDE.md:107`).
  3. Keep a guarded 1-line wrapper `jumpToLevel(targetLevel)` on `Game` (enforcing the Bug 21 dev flag) or export from `rules/index.js`, rebuild `rules/rules.bundle.js` (`npm run build`), and update `docs/class-diagram.md`. Existing callers (`game.js:904`, `Tests/check_screens.js:3119`) remain compatible. Saves ~140 lines from `rules/Game.js`.

---

## E. Bug 30 and ranking (Hannah's code at hz-level3)

### E.1 Can a player patch another team's machine? Does it count toward a score?

- **Answer:** **Yes, the player must patch all 4 teams' machines**, and it counts **only toward the player's own team (`MYTEAM`)** Step 1 completion and attention score, never toward any other team's score.
- **Exact quotes from `hz-level3`:**
  - `hz-level3:game.js:48-52`:
    ```js
    const MIR_TEAMS=[{id:"kestrel",n:"Team Kestrel",port:"HDMI",me:true},{id:"wren",n:"Team Wren",port:"USB-C"},{id:"finch",n:"Team Finch",port:"AirLink"},{id:"heron",n:"Team Heron",port:"VGA"}];
    ```
  - `hz-level3:game.js:488-498`:
    ```js
    function plugCable(id){const m=S.mirror;
      if(S.step!==7||!G||!G.round||R().trialKind!=="mirror"||sopDone()||m.phase!==1||!meOnSetup())return;
      const t=MIR_TEAMS.find(x=>x.id===id);
      if(!t||m.links[id])return;
      let best=null,bd=99;
      for(const c of m.rack){if(c.j||c.type!==t.port)continue;const d=Math.abs(m.t-(c.t0+MIR_PLUG_TRAVEL));if(d<bd){bd=d;best=c}}
      if(best&&bd<=2){best.j="plug";best.jT=m.t;m.links[id]=t.port;
        const left=MIR_TEAMS.filter(x=>!m.links[x.id]).length;
        m.msg=t.n+" is on the projector. "+(left?left+" to go.":"Every machine is live. Sound check next.")}
      else{m.pen+=3;m.msg="Spark. "+t.n+" takes "+t.port+" and there is no "+t.port+" cable in the frame (attention \u22123)."}
      afterMirrorAction()}
    ```
  - `hz-level3:game.js:524` and `609`:
    ```js
    const rackDone=MIR_TEAMS.every(t2=>m.links[t2.id]);
    ```
    ```js
    const allLinked=MIR_TEAMS.every(t=>m.links[t.id]);
    ```
  - `hz-level3:game.js:430`:
    ```js
    function pushMirrorScore(){... G.setMirrorScore(MYTEAM,mirAtt())}
    ```
  - Bot teams' scores are untouched by `plugCable`; they receive `this.randomBase()` (0 to 7) at `hz-level3:rules/Trial.js:231`.

### E.2 How Hannah's ranking sorts

- **Sort order:** `score = base + influence` descending, then random `this.rng()` tie-break (`a.roll - b.roll`). No exact-attention tie-break.
- **Exact quotes from `hz-level3:rules/Trial.js`:**
  - `hz-level3:rules/Trial.js:48-54` (`Trial.sortBy`):
    ```js
    sortBy(entries, keys) {
      entries.forEach(e => { e.roll = this.rng(); });
      return entries.sort((a, b) => {
        for (const k of keys) { const d = k(b) - k(a); if (d) return d; }
        return a.roll - b.roll;
      });
    }
    ```
  - `hz-level3:rules/Trial.js:71-78` (`Trial.rankWithInfluence`):
    ```js
    rankWithInfluence(round, teams, baseOf) {
      const inf = Trial.influence(round, teams);
      const entries = teams.map(team => {
        const base = baseOf(team);
        return { team, base, influence: inf.get(team), score: base + inf.get(team) };
      });
      return this.sortBy(entries, [e => e.score]);
    }
    ```
  - `hz-level3:rules/Trial.js:204-207, 230-233` (`MirrorTrial.score` and `MirrorTrial.rank`):
    ```js
    static score(attention) {
      const a = Math.max(0, Math.min(100, Number(attention) || 0));
      return Math.max(0, Math.min(MirrorTrial.MAX_SCORE, Math.round(a / 100 * MirrorTrial.MAX_SCORE)));
    }
    rank(round, teams) {
      for (const t of teams) if (!this.scores.has(t)) this.scores.set(t, this.randomBase());
      return this.rankWithInfluence(round, teams, t => this.scores.get(t));
    }
    ```
  - Result display at `hz-level3:game.js:399-401` renders `shownScore(x.score)` (rounded `base + influence`, clamped `0..7`).

### E.3 Comparison to current code

- **Patching other teams' machines:** **SAME mechanic, dynamic team labels.** Current code (`mirror-view.js:186-193, 653-668, 894-943`; `rules/MirrorParts.js:471-525`) binds `EP.MirrorData.ports` (`HDMI`, `USB-C`, `AirLink`, `VGA`) dynamically to `[MYTEAM, ...otherTeams]` instead of hardcoded `MIR_TEAMS`, still requires patching all 4 ports labeled with other teams' names to finish Step 1, and records hits/sparks only on the acting player's own team (`ts.cables.connected`, `ts.penalties`) with zero effect on other teams' scores.
- **Ranking sort:** **DIFFERENT in 3 ways (plus standings note):**
  1. **Exact-attention tie-break added:** Current `rules/Trial.js:79-86, 1033-1052` sorts by `score = base + influence` descending, then higher exact `attention` (`0..100`) descending, then random `this.rng()` roll.
  2. **Bot-only scores:** Hannah rolled uniform integer `0..7` (`randomBase()`, `hz-level3:rules/Trial.js:231`); current `rules/Trial.js:604-611, 665-675` (`#ensureBotAttention`) rolls uniform integer `0..100` attention and maps via `Math.round(att / 100 * 7)`.
  3. **Result display mismatch:** Hannah (`hz-level3:game.js:401`) showed `shownScore(x.score)` (`base + influence` rounded); current `mirror-view.js:252` sorts by `G.trialRanking()` (`base + influence`) while printing `r.base / 7` (pre-influence score) with no influence column, so a lower displayed `r.base / 7` can appear ranked above a higher one. Also `Game.teamStandings()` (`rules/Game.js:762`) sorts cumulative `trialWins` descending with sequential `place: i + 1` in team-array order on ties.

---

## F. Bug 29: cable timing

- **Code constants (`rules/mirrorData.js:6, 63, 90-97`; `mirror-view.js:120, 187-192, 641-650, 1128-1164`):**
  - Ports: `["HDMI", "USB-C", "AirLink", "VGA"]` (`MYTEAM` is always mapped to `HDMI` at `mirror-view.js:187-192`).
  - `tickMs = 250` ms (0.25 s/tick); showtime window = 75 s (300 ticks).
  - `travelTicks = 11` (2.75 s to frame center); `hitWindowTicks = 2` (`|tick - (t0 + 11)| <= 2`).
  - A cable spawned at tick `t0`:
    - First enters hit frame at `t0 + 9` (2.25 s after spawn).
    - Reaches frame center at `t0 + 11` (2.75 s after spawn).
    - Last valid hit tick at `t0 + 13` (3.25 s after spawn).
    - Marked `"past"` and returned to `c.bag` via `c.bag.push(item.port)` at `t0 + 14` (3.50 s after spawn; `mirror-view.js:1151-1156`).
  - Spawn gaps: `spawnGapInitial = 6` ticks (1.50 s, 0 connected), `spawnGapMid = 5` ticks (1.25 s, 1-2 connected), `spawnGapFast = 4` ticks (1.00 s, 3 connected).
  - Bag initialization (`mirror-view.js:1138-1140`): `c.bag = shuffleArr(needed.concat(needed))` (8 items, 2 copies of each port), drawn with `c.bag.pop()`. Initial `c = { tick: 0, belt: [], bag: [], nextSpawn: 0 }`, so Spawn #1 happens on `tick = 1` (0.25 s).

- **Spawn arrival schedule (0 connected, gap = 6 ticks = 1.50 s):**

| Spawn # | Spawn tick `t0` (time) | First enters hit frame (`t0 + 9`) | Center (`t0 + 11`) | Exits window (`t0 + 13`) | Marked missed & re-pushed (`t0 + 14`) |
|---|---|---|---|---|---|
| #1 | tick `1` (0.25 s) | tick `10` (**2.50 s**) | tick `12` (3.00 s) | tick `14` (3.50 s) | tick `15` (3.75 s) |
| #2 | tick `7` (1.75 s) | tick `16` (**4.00 s**) | tick `18` (4.50 s) | tick `20` (5.00 s) | tick `21` (5.25 s) |
| #3 | tick `13` (3.25 s) | tick `22` (**5.50 s**) | tick `24` (6.00 s) | tick `26` (6.50 s) | tick `27` (6.75 s) |
| #4 | tick `19` (4.75 s) | tick `28` (**7.00 s**) | tick `30` (7.50 s) | tick `32` (8.00 s) | tick `33` (8.25 s), OR re-pops #1 if #1 missed |

- **Critical LIFO 3-cable lock finding (Bug 29 + Bug 54 + Bug 30 interaction):**
  - Both `c.bag.push(item.port)` (`mirror-view.js:1155`) and `c.bag.pop()` (`mirror-view.js:1140`) operate on the same end of `c.bag` (LIFO stack).
  - Because Spawn #1 goes `"past"` at tick `15` (4 ticks before Spawn #4 pops at tick `19`), Spawn #4 always re-pops Spawn #1's missed port; Spawn #5 (tick `25`) re-pops Spawn #2 (pushed at tick `21`); Spawn #6 (tick `31`) re-pops Spawn #3 (pushed at tick `27`).
  - Therefore, if the player does not plug any of the first 3 spawned cables (e.g. waiting for their own team's `HDMI` without plugging other teams' machines), those same 3 cables loop indefinitely and the remaining 5 entries buried in `c.bag` never spawn during the entire 75 s showtime.
  - Exact analytical probability that any given port (including `HDMI`) is absent from the first 3 pops of the 8-item bag (2 copies of target, 6 copies of others): `P = (6/8) * (5/7) * (4/6) = 120/336 = 5/14 = 35.71%`.

- **50,000-trial simulation results (replicating `mirror-view.js:1128-1160`):**
  - **Active play (player plugs every port on first entry into hit frame, shrinking gap 6 -> 5 -> 4):** Symmetric across all 4 ports (`HDMI`, `USB-C`, `AirLink`, `VGA`):
    - Min first reach: **2.50 s** (Spawn #1)
    - Median first reach: **5.50 s**
    - Mean first reach: **5.05 s to 5.07 s**
    - 95th percentile first reach: **8.00 s**
    - Worst-case max first reach: **10.50 s** (bag order `[A, A, B, B, C, C, target, target]`, probability `1/28 = 3.57%`: Spawns 1-6 at ticks `1, 7, 13, 18, 23, 28`, Spawn #7 at `t0 = 33`, enters hit frame at tick `42 = 10.50 s`; all 4 ports connected in `6.75 s` min / `8.00 s` median / `9.25 s` p95 / `10.50 s` max).
  - **Passive / selective play (player waits for one port without plugging other ports):**
    - `HDMI`: never reaches hit frame in 75 s in **35.84%** of runs (exact theoretical **35.71%**); when present in the first 3 draws (`64.29%`), arrives at `2.50 s` (`25.0%`), `4.00 s` (`21.4%`), or `5.50 s` (`17.9%`), median `4.00 s`, mean `3.84 s`.
    - `USB-C` (`35.52%` never), `AirLink` (`35.70%` never), `VGA` (`35.66%` never): identical theoretical `5/14 = 35.71%`.

- **Can the shuffle (Bug 54) delay HDMI past a normal play window?**
  - Under **active play** (plugging every port as it arrives): **No** (max `10.50 s`, well inside the 75 s showtime, though `6.75 s` to `10.50 s` is slower than the 4 s bot milestone).
  - Under **selective or missed play** (trying to plug `HDMI` first without patching other teams' ports, or missing the first 3 cables): **Yes, catastrophically.** Bug 54's shuffle combined with LIFO `c.bag.push()` + `c.bag.pop()` delays `HDMI` past the entire 75 s showtime in **35.71% (`5/14`)** of games.

---

## G. Bug 50: KEYS order vs TIE_ORDER

- **Definitions:**
  - `KEYS = ["focus", "initiative", "collab", "composure", "grit"]` (`rules/Attributes.js:5`, `rules/PlayerStatus.js:5`, `rules/Wallet.js:5`, re-exported via `rules/Player.js:11, 63`).
  - `TIE_ORDER = ["focus", "collab", "initiative", "grit", "composure"]` (`rules/Attributes.js:6`, `rules/Player.js:12, 244`; `GIFT_TIE_ORDER = TIE_ORDER` at `rules/Attributes.js:7`).
- **Verdict:** **No, `KEYS` order is NOT only storage order (save format).** It affects display, tie-breaks, and gameplay results in 4 runtime places (plus 1 test):
  1. **Display (`rules/Attributes.js:66-72`, `abilityLines()`, rendered at `game.js:680`):** Iterates `KEYS`, so the Stats Update "Your abilities" panel displays attributes in `Focus, Initiative, Collaboration, Composure, Grit` order instead of canonical `Focus, Collaboration, Initiative, Grit, Composure`.
  2. **Tie-breaks (`rules/Attributes.js:49-50`, `highestKey()` and `lowestKey()`):** Both reduce over `KEYS`, breaking ties toward `initiative` over `collab` and `composure` over `grit`. (Wrong accusations at `rules/Attributes.js:100` use `highestKeyIn(TIE_ORDER)` and gifts at `rules/Attributes.js:111` use `GIFT_TIE_ORDER`, so those two already follow `TIE_ORDER`.)
  3. **Results - Reboot donor tie-breaks (`rules/Attributes.js:133-149`, `reboot()`):** Iterates glitched attributes in `KEYS` order (`134`) and builds `donors = KEYS.filter(...).sort((a, b) => attrs[b] - attrs[a])` (`139-140`). Because JS `Array.prototype.sort` is stable, tied highest donors lose points in `KEYS` order (`initiative` drained before `collab`, `composure` before `grit`), altering post-reboot stats and graduation outcomes.
  4. **Results - Auto-placement and bot allocation (`rules/Economy.js:74-89`, `Economy.allocate()`):** Line `78` raises `< 2` attributes at Round 7 Graduation in `KEYS` order when points are scarce; lines `81, 85` (`open = KEYS.filter(...)`, `pool.reduce(...)`) break all non-bonus lowest-attribute ties in `KEYS` order for every bot and every auto-placed human point on timer close.
  5. **Test RNG draw order (`Tests/check_save.js:182`):** `any(EP.Player.KEYS, d)` indexes into `KEYS`, so reordering `KEYS` shifts save-test RNG choices.
- **Verified non-impacts:** `Bots.typicalSpend` (`rules/bots.js:56-59`) produces the same 2-element `others` order under both `KEYS` and `TIE_ORDER` for all 3 types (`coop: focus, grit`; `indep: initiative, composure`; `contra: focus, collab`). `PlayerStatus.isGlitching`/`isAtRisk` (`rules/PlayerStatus.js:27, 30`), `Wallet.placePoints`/`placeLeft`/`roomLeft` (`rules/Wallet.js:61-76`), and `Attributes.total`/`lowest` (`rules/Attributes.js:47-48`) are order-independent.

---

## H. Full class list

### Exact name confirmations
- Class in `rules/Attributes.js`: **`Attributes`** (`rules/Attributes.js:22-157`)
- Split Brief trial subclass: **`SplitBriefTrial`** (`extends Trial`, `rules/Trial.js:216-512`)
- Judged trial subclass: **`JudgedTrial`** (`extends Trial`, `rules/Trial.js:1163-1273`)

### All 30 classes in `rules/`

| # | Class | File:lines | Parent class | Methods (excl. ctor) | Explicit constructor |
|---:|---|---|---|---:|---:|
| 1 | `Accusation` | `rules/Accusation.js:5-38` | (none) | 2 | 0 |
| 2 | `Attendance` | `rules/Attendance.js:16-86` | (none) | 7 | 1 |
| 3 | `Attributes` | `rules/Attributes.js:22-157` | (none) | 24 | 1 |
| 4 | `CharacterType` | `rules/CharacterType.js:11-51` | (none) | 15 | 1 |
| 5 | `Cooperative` | `rules/CharacterType.js:53-59` | `CharacterType` | 1 | 1 |
| 6 | `Independent` | `rules/CharacterType.js:61-70` | `CharacterType` | 4 | 1 |
| 7 | `Contrarian` | `rules/CharacterType.js:72-79` | `CharacterType` | 2 | 1 |
| 8 | `Economy` | `rules/Economy.js:8-109` | (none) | 9 | 0 |
| 9 | `Game` | `rules/Game.js:83-1030` | (none) | 120 | 1 |
| 10 | `Gift` | `rules/Gift.js:12-87` | (none) | 8 | 0 |
| 11 | `Hearts` | `rules/Hearts.js:8-33` | (none) | 10 | 1 |
| 12 | `MirrorLobby` | `rules/MirrorParts.js:10-270` | (none) | 24 | 1 |
| 13 | `SetupCrew` | `rules/MirrorParts.js:275-1198` | (none) | 48 | 1 |
| 14 | `DanceCrew` | `rules/MirrorParts.js:1204-1600` | (none) | 26 | 1 |
| 15 | `PathTracker` | `rules/PathTracker.js:6-73` | (none) | 12 | 1 |
| 16 | `Player` | `rules/Player.js:28-241` | (none) | 81 | 1 |
| 17 | `PlayerStatus` | `rules/PlayerStatus.js:9-59` | (none) | 16 | 1 |
| 18 | `Rng` | `rules/Rng.js:7-24` | (none) | 3 | 0 |
| 19 | `Round` | `rules/Round.js:22-110` | (none) | 17 | 1 |
| 20 | `Sabotage` | `rules/Sabotage.js:3-38` | (none) | 4 | 0 |
| 21 | `Team` | `rules/Team.js:3-31` | (none) | 9 | 1 |
| 22 | `Timer` | `rules/Timer.js:5-65` | (none) | 9 | 1 |
| 23 | `Trial` | `rules/Trial.js:18-131` | (none) | 12 | 1 |
| 24 | `SopTrial` | `rules/Trial.js:134-197` | `Trial` | 12 | 1 |
| 25 | `AutoTrial` | `rules/Trial.js:206-208` | `Trial` | 1 | 0 |
| 26 | `SplitBriefTrial` | `rules/Trial.js:216-512` | `Trial` | 39 | 1 |
| 27 | `MirrorTrial` | `rules/Trial.js:518-1129` | `Trial` | 85 | 1 |
| 28 | `JudgedTrial` | `rules/Trial.js:1163-1273` | `Trial` | 15 | 1 |
| 29 | `Vote` | `rules/Vote.js:9-79` | (none) | 6 | 1 |
| 30 | `Wallet` | `rules/Wallet.js:8-98` | (none) | 19 | 1 |

- **Non-class modules in `rules/`:** `bots.js` (plain object `Bots` + `Bots.hooks`), `index.js`, `mirrorData.js`, `scenarios.js` (generated `rules.bundle.js` excluded).
- **Totals vs reference (`30 classes, 8 subclasses, 640 methods`):**
  - **Classes:** 30 (matches 30).
  - **Subclasses:** 8 (`Cooperative`, `Independent`, `Contrarian` extending `CharacterType`; `SopTrial`, `AutoTrial`, `SplitBriefTrial`, `MirrorTrial`, `JudgedTrial` extending `Trial`) (matches 8).
  - **Methods:** 640 excluding the 24 explicit `constructor` definitions (matches 640; 664 if constructors are included). Zero mismatches flagged.

---

## I. Summary

1. Single-player UI clicks close shared steps, end trials, or close votes for the whole room (`game.js:251-258, 327-330, 518, 810-811, 831-862`; `judged-view.js:26-27, 73, 113` - Sections A, C).
2. Screen code mutates rules objects directly instead of going through `Game` (`splitbrief-view.js:163, 186, 198, 210, 221, 230`; `judged-view.js:26, 108, 113`; `game.js:596`; `pages/vote-test.js:39-40` - Section C).
3. Screen code reads full mutable `Game`/`Player`/`Round`/`Trial` internals directly with no per-player privacy boundary (`game.js:226, 598, 673`; `splitbrief-view.js:42-90`; `judged-view.js:25-91`; `mirror-view.js:187` - Section C).
4. Client-side `setInterval` loops and `Date.now()` clocks drive `Game.tick()`, `Attendance`, and spawn/elevator timing (`game.js:293, 742, 747-748, 801`; `attendance-view.js:15, 34, 73` - Sections A, C).
5. Dance Crew runs on a client `requestAnimationFrame` clock that spawns notes with unseeded `Math.random()`, charges `-2` misses on idle/Board-blocked players, and stops on tab close or Back (`mirror-dance-view.js:51-60, 355-397, 468-470, 477-491`; `game.js:296, 756, 871` - Section A).
6. Setup Crew Q&A, Sound, Mic, and Deck run unsaved screen-side timers and unseeded `Math.random()` that charge penalties, advance steps, or consume `G.rng` on client ticks (`mirror-view.js:512-555, 945-969, 1027, 1165-1248` - Section A).
7. Cable belt unseeded `Math.random()` shuffle plus LIFO `push()`/`pop()` traps missed cables in an infinite 3-cable loop, blocking `HDMI` for the entire 75s showtime in 35.71% of runs if other ports are not plugged first (`mirror-view.js:29-36, 1128-1164` - Sections A, E, F).
8. `Game.jumpToLevel` has no rules-side dev flag check (`DEV_JUMP` is enforced only in `game.js`), allowing any direct actor call to jump levels (`rules/Game.js:358-498`; `game.js:886-911` - Sections C, D).
9. Screen `canBack()` stays enabled during active trials, tearing down trial views and freezing screen-side timers while `Game` keeps running (`game.js:296, 756, 871` - Sections A, B).
10. `KEYS` order diverges from `TIE_ORDER` in display (`abilityLines`), reboot donor ties (`reboot`), and auto-placement/bot allocation (`Economy.allocate`) (`rules/Attributes.js:5-6, 49-50, 66-72, 133-149`; `rules/Economy.js:74-89` - Section G).
