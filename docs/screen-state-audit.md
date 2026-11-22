# Screen State Audit

- **Branch audited:** `level3-mirror` (read-only audit; no code changed)
- **Scope:** All 11 screen JS files (`game.js`, `world-map.js`, `pixel-art.js`, `board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `judged-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `pages/vote-test.js`) plus `index.html`, `pages/vote-test.html`, and `styles.css`.
- **The Rule:** Screens display data and pass player actions to `Game`. Screens never change game state. Screens call rules through `Game`, never the reverse.

## Rule Categories

1. `setTimeout`, `setInterval`, or `requestAnimationFrame` loops that end a step, move the game forward, or count down a game timer.
2. `Math.random`, `Date.now`, or `new Date` used for anything that affects an outcome (rules must use seeded `Rng` and injected clock).
3. Direct writes to `Game`, `Round`, `Team`, `Player`, or trial objects instead of calling a `Game` method.
4. Copies of game data kept in screen variables that can go stale.
5. Rule checks done only in the screen (or missing in rules).
6. Scoring, ranking, tie-break, or penalty math in screen code.
7. `localStorage` or save writes outside the Part 13 save system.
8. Anything else that would break save/load or give two players different results on a shared Base44 actor.

## Risk Levels

- **High:** Breaks multiplayer or save/load.
- **Medium:** Causes visible bugs or weakens the `Game` front desk.
- **Low:** Cleanup only.

---

## Violations Table

| ID | File | Lines | What the code does | Cat | State changed | Linked QA bug | Risk |
|---|---|---|---|---:|---|---|---|
| V-01 | `game.js` | 283-293 | `setInterval(..., 250)` drives `G.tick()` from the browser; `afterClose()` advances `S.step` for `intermission` and `openFloor` but omits `giftWindow`, leaving the player on All-Hands while the 30s `statsUpdate` timer runs invisibly. | 1 | Step timers, phase transitions, `S.step` vs `G.step` sync | Bug 4, Bug 5 | High |
| V-02 | `game.js` | 742, 747-748, 801 | Arrival cutscene `setTimeout`s (`500ms`/`90ms`/`700ms`/`1800ms`) set `S.arrived = true`, which triggers `G.start()` at line 801, starting the game's first 90s Intermission deadline on one client's cutscene clock. | 1 | `Game._timer.running`, `intermission` deadline | None | High |
| V-03 | `game.js` | 251-258, 327-330, 518, 810-811, 831-862 | Single-player UI buttons (`startLevel`, `goForward`, `#runAuto`, `lockPoints`, `applyOpenFloorEnd`, `checkSop`, `payCost`, `endAccusations`, `startNextLevel`) directly call `G.closeTimer()`, `G.advance()`, `G.runTrial()`, `G.endTrial()`, `G.placeAllRemaining()`, `G.finishRound()`, `G.results()`, and `G.startNextRound()`, closing phases for the whole game on one player's click. | 8 | `Game.step`, `Round.stepIndex`, `Timer.current`, trial results, costs, earnings, placements, endings | Bug 5 | High |
| V-04 | `game.js` | 296, 337, 756, 871 | `canBack()` returns `true` during active `Trial` (`S.step === 7`), `All-Hands` (`S.step === 8`), and `Stats Update` (`S.step === 9`); clicking `#navBack` desyncs `S.step` from `G.step`, tears down `currentTrialView` (freezing Level 3 screen timers and Dance misses), and hides the running countdown banner. | 8 | `S.step` vs `G.step` sync, active trial loops/timers, banner visibility | Bug 5 (also L3 QA #2) | High |
| V-05 | `game.js` | 596 | `bindGifts()` calls `EP.Bots.answer(G, r.gift, G.rng)` directly from screen code after `G.gift()`, instead of bots acting only through `Game` hooks. | 3 | `Round.gifts` status, receiver attributes, giver hearts, `Rng` state | None | High |
| V-06 | `game.js` | 47, 211, 770, 781, 851 | Anomaly clues (`S.found.L`, `S.found.id`, `S.found.loop`) are stored only in screen variable `S.found` and never in `Game` or `Game.toJSON()`, so anomalies are lost on save/reload. | 4 | Anomalies found (`ERROR`, `WATCHER`, `LOOP`) | None | High |
| V-07 | `game.js` | 215, 251, 256, 290, 399, 834, 839, 908 | Badge progress (`S.prog.level`, `S.prog.done`) is tracked manually in screen variable `S.prog` instead of read from `Game`, going stale on save/reload. | 4 | Player level / XP progress (`S.prog`) | None | Medium |
| V-08 | `game.js` | 216, 218, 287, 289, 493, 555-560, 566, 572, 810-812, 854 | Round outcomes are copied into screen variables (`S.pay`, `S.acc`, `S.gw.sent`, `S.sop.inTime`) instead of read from `Game`/`Round`, going stale or blank after save/reload or timer auto-close. | 4 | Displayed trial cost report, accusation outcome, gift feedback, SOP timeout flag | None | High |
| V-09 | `game.js` | 367, 468, 679, 680 | Stats Update renders `ME.abilityLines()` (plus HUD `ME.attrs`, `gradChecks()`, `status()`) using committed attributes without `ME.draft`, so ability text stays stale while drafting points until Lock In. | 4 | Displayed ability chances / stat preview vs `Player.draft` | Bug 6 | Medium |
| V-10 | `game.js` | 264, 486, 499 | `shuffle()` uses `Math.random()` to order the Level 1 SOP step pile (`S.sop.pile`), which is unsaved and not seeded from `Game.rng`. | 2 | `S.sop.pile` display order | None | Low |
| V-11 | `game.js` | 279, 361-364, 568, 573, 677 | `#banner` / `#tmr` derives its title from `S.step` while `drawTimer()` blindly prints `G.secondsLeft()` for whichever `G.timer` is active; Glitch Report (`568`) and Stats Update (`677`) show static or out-of-sync timer copy when `S.step` lags `G.step`. | 4 | Countdown banner label and timer text alignment | Bug 5 | Medium |
| V-12 | `game.js` | 467, 483, 492 | Screen checks per-step SOP correctness (`SOP[i] === t`, line 492) and computes rounded trial scores (`shownScore`, lines 467, 483), and omits tie-break info in `trialResultHTML`. | 6 | Displayed SOP step correctness and rounded score | Bug 7 | Low |
| V-13 | `game.js` | 614, 621 | `finalResultsScreen()` sorts `[...G.teams].sort((a,b) => b.trialWins - a.trialWins)` and computes `place = i + 1` in screen code instead of calling `G.teamStandings()`, and omits tie explanation. | 6 | Final team standings order / places | Bug 7 | Low |
| V-14 | `game.js` | 494, 772-773 | Screen-only rule checks: SOP Submit button is disabled when empty (`494`) while `closeSop()` allows empty boards; `@icstars.org` email and `CYCLE60` join code checks live only in `game.js:772-773`. | 5 | Sign-in gating, SOP submit gating | None | Medium |
| V-15 | `game.js` | 243-244 | `savedName()` and `saveName()` read and write `localStorage["ep.names"]` outside the Part 13 save system. | 7 | Browser `localStorage["ep.names"]` | None | Low |
| V-16 | `game.js` | 259, 487, 513, 558, 589, 598, 603, 605, 673 | Screen reaches directly into `G.round.*` (`sopResults`, `trial.ranking`, `drainOn`, `gifts`, `caughtOn`, `earnings`), passes gift object references (`603`), calls `EP.Gift.cost`/`check` directly (`589`), and constructs a dummy `new EP.Round(1)` (`259`) instead of calling `Game` methods. | 8 | Read boundary / actor payload encapsulation | None | Medium |
| V-17 | `game.js` | 228-230, 886-911 | Client screen boots `EP.Bots.soloGame` directly (`228`) and exposes `DEV_JUMP = true` (`886-911`, calling `EP.Bots.typicalSpend` and `G.jumpToLevel`) without environment gating. | 8 | Session creation and fast-forward across levels | None | Low |
| V-18 | `attendance-view.js` | 15, 34, 67 | Passes client browser `Date.now()` into `G.activity(l.ME, Date.now())` (`15`) and `G.checkAttendance(Date.now())` (`34`), overriding `Game`'s injected clock (`Game.now()`); line 67 uses `Date.now()` for the mouse-move throttle that gates `G.activity`. | 2 | `Player.lastActivity`, `Player.idle`, `attendancePopupAt`, `attendancePending`, `glitches` | None | High |
| V-19 | `attendance-view.js` | 31-42, 73 | Client-side `setInterval(api.tick, 1000)` drives `G.checkAttendance(...)`, which sets `p.idle`, adds attendance glitches, triggers Empathy, and can mark a player Stuck; a closed tab never triggers attendance checks. | 1 | `Player.idle`, `attendancePending`, `glitches`, `Hearts` (Empathy) | None | High |
| V-20 | `splitbrief-view.js` | 163, 186, 198, 210, 221, 230 | Calls mutating methods directly on `G.round.trial` (`trial.postNote`, `trial.setBoard`, `trial.lockIn`) instead of calling `Game` pass-through methods, bypassing `Game` step enforcement. | 3 | `SplitBriefTrial` `#notes`, `#notesUsed`, `#boards`, `#lockOrder`, `#lockedAfterTwist`, trial close | Bug 1 | High |
| V-21 | `splitbrief-view.js` | 87, 228-240 | Empty-board Lock In is not blocked in `SplitBriefTrial.lockIn()` (`rules/Trial.js:382-388`) or on `#splitLockBtn` (`87`), letting a player lock an empty board (compounded by `restoreFocus` focusing `#splitLockBtn` after the 3rd note at lines 127-130). | 5 | `SplitBriefTrial.#lockOrder` (permanent lock on empty board) | Bug 1 | Medium |
| V-22 | `splitbrief-view.js` | 50-53, 55 | Computes `SBT.score(board, trial.postTwistAnswer)` and rounded display scores (`shown(...)`) directly in screen code instead of reading precomputed scores and tie-break text from `Game`. | 6 | Displayed board score, rounded score, tie explanation | Bug 7 | Low |
| V-23 | `splitbrief-view.js` | 42, 47, 51, 59-68, 257, 267, 273, 277 | Reads `G.round.trial` directly (`cardsFor`, `twistFor`, `notesFor`, `notesLeft`, `boardFor`, `isLocked`, `tasks`, `postTwistAnswer`, `twistFired`, `ranking`) instead of player-scoped `Game` pass-throughs, exposing full trial internals containing other players' cards and twist holder. | 8 | Read boundary / multiplayer privacy | None | Medium |
| V-24 | `judged-view.js` | 26-27, 73 | Mutates game state during `screen()` render (`G.startWriting()`, `EP.Bots.submit(G)`, `G.startVote()`) and opens voting in the `#subBtn` click handler (`73`) instead of `Game` owning writing/vote transitions and bot hooks. | 8 | `JudgedTrial.writing`, `prompt`, `submissions`, `vote`, `Game.prompts`, `Game.timer`, `Rng` | None | High |
| V-25 | `judged-view.js` | 108, 113 | Calls `v.cast(ME, ...)` directly on `G.round.trial.vote` (bypassing `Game` step checks), then calls `EP.Bots.vote(G, v, G.rng)` and `G.runTrial()`, ending the vote for all players as soon as one player votes. | 3 | `Vote.ballots`, `Trial.ranking`, `Team.won`, `Team.trialWins`, `Team.trialResults`, `Rng` | None | High |
| V-26 | `judged-view.js` | 25, 33, 38, 47-48, 82-89 | Reaches directly into `G.round.trial` and `G.round.trial.vote` for state reads and omits vote tie-break explanation in the result table (`38`). | 8 | Read boundary / actor payload encapsulation | Bug 7 | Low |
| V-27 | `mirror-view.js` | 945-969, 1165-1209 | Runs Sound Check simulation on the client 250ms tick (`ms.sound.tick`, `level`, `holdTicks`, `spikeAt`); passively calls `G.mirrorSoundFeedback(ME)` (`-4` attention, `1181`) and runs a 12-tick (3.0s) local hold timer calling `G.mirrorSoundHeld(ME)` (`1192`); unsaved state resets on reload or `◀ Back`. | 1 | `SetupCrew` sound locked state, step advance, penalties, Audience Attention | None (L3 QA #1, #2) | High |
| V-28 | `mirror-view.js` | 1170, 1173, 1174, 1178 | Calls `Math.random()` four times per Sound Check loop to schedule crowd spikes, roll +8..+17 boost, and add jitter, affecting feedback penalties and hold completion. | 2 | Sound Check level, feedback penalties, step completion timing | None (L3 QA #4) | High |
| V-29 | `mirror-view.js` | 544-555, 1223-1248 | Runs a screen-side 29-tick (7.25s) countdown (`ms.qa.tick`, `ms.qa.deadline`) for each Q&A item and calls `G.mirrorTimeoutQa(ME)` (`-5` attention, advances `qa.index`/step) at 0; resets on reload, freezes on `◀ Back`, and never fires on a closed tab. | 1 | `SetupCrew` `qa.index`, `qa.timeouts`, penalties, Audience Attention, step advance | None (L3 QA #1, #2) | High |
| V-30 | `mirror-view.js` | 532-542, 1027, 1215-1222 | Runs a screen-side tick timer (`ms.deck.tick`, `ms.deck.shuffleAt`, 8 ticks or 2 ticks after wrong file) that calls `G.mirrorReshuffleDeck(MYTEAM)` (`1219`), consuming `Game.rng` on client tick timing instead of server deadlines. | 1 | `SetupCrew` `deck.fileOrder`, `Game.rng` state | None | High |
| V-31 | `mirror-view.js` | 512-530, 976, 1210-1215 | Runs a screen-side tick timer (`ms.mic.tick`, `ms.mic.hideAt`) controlling Mic Check sequence flash duration and gating taps (`976`); unsaved, so reload or `◀ Back` re-flashes the sequence for free. | 1 | Mic Check visibility and tap gating | None | High |
| V-32 | `mirror-view.js` | 29-36, 894-943, 1128-1164 | `shuffleArr()` calls `Math.random()` (`32`) to shuffle the Cables spawn bag (`1137, 1144`), runs an unsaved local belt clock (`ms.cables`), and locally judges hit vs spark (`907-940`) before calling `G.mirrorCableHit`/`G.mirrorCableMiss` (`-3` attention). | 2 | Cable spawn order, `SetupCrew` connected cables, sparks, penalties, Audience Attention | None (L3 QA #4) | High |
| V-33 | `mirror-view.js` | 155-156, 351-369, 401-417 | Calls `Math.random()` (`155-156`) for Lobby signal cursor initial `pos` and `dir`, sweeps cursor on client 250ms tick (`404-406`), and locally decides `hit = inBand(...)` (`351`) before calling `G.mirrorConnect`/`G.mirrorMiss`. | 2 | `MirrorLobby` connect/miss/speed, lobby fail outcome | None (L3 QA #4) | High |
| V-34 | `mirror-view.js` | 900, 950, 976, 1011, 1042, 1066, 1127, 1181, 1238 | Setup handlers and passive ticks check `st.currentPlayerId === ME.id` without checking `ME.isActive()` / `!ME.idle`, and rules (`SetupCrew.soundFeedback`, `SetupCrew.timeoutQa`) accept idle players, allowing open tabs to penalize idle humans alongside bot auto-pilot. | 5 | `SetupCrew` penalties, timeouts, Audience Attention | None (L3 QA #1) | High |
| V-35 | `mirror-dance-view.js` | 355-397, 468-470, 477-491 | `requestAnimationFrame` loop (`frame` -> `stepMotion`) spawns notes and calls `G.mirrorDanceMiss(ME)` (`375`, `-2` attention, resets combo, can trigger 0% attention fail) even while `ME.idle` or while Progress Board (`.board-ov`) blocks arrow keys (`469`); closing the tab or clicking Back stops misses. | 1 | `DanceCrew` `misses`, `penalties`, `combo`, Audience Attention, trial fail/close | None (L3 QA #1, #2) | High |
| V-36 | `mirror-dance-view.js` | 51-60 | `nextArrowDir()` calls `Math.random()` (`53`) to pick sliding arrow note directions instead of seeded `Game.rng`. | 2 | Dance Crew note sequence (affects hits, misses, boost) | None (L3 QA #4) | High |
| V-37 | `mirror-dance-view.js` | 62-98, 399-453 | Stores active note chart, spawn counter, and tempo ramp (`ds.tick`, `ds.notes`, `ds.spawnedCount`, `ds.nextNote`, `ds.lastN`) in unsaved screen state and judges `perfect`/`good`/`stray` locally (`412-444`); reload resets tempo ramp (`6 -> 5 -> 4` back to `6`) and chart. | 4 | Dance tempo ramp, active notes, `DanceCrew` boost/penalties | None | High |
| V-38 | `world-map.js` | 196 | `doUse()` writes `S.found.id = 1` when checking in at Reception, storing the `WATCHER` anomaly in unsaved screen state instead of calling a `Game` method. | 4 | `S.found.id` (`WATCHER` anomaly) | None | Medium |
| V-39 | `world-map.js` | 124-125, 188 | Calls `EP.Sabotage.cost(ME)` and `EP.Sabotage.check(ME, p, MYTEAM)` directly instead of asking `Game`. | 8 | Read boundary (`Game` front desk) | None | Low |
| V-40 | `pages/vote-test.js` | 37-41 | `placeMine()` directly writes `ME.earned = Math.min(ME.earned, ME.roomLeft())` and calls `ME.placePoints(...)`, bypassing `Game` and `Economy`. | 3 | `Player.earned`, `Player.attrs`, `Player.placedThisRound` | None | Medium |
| V-41 | `pages/vote-test.js` | 75-83 | Runs its own `setInterval(..., 1000)` calling `G.tick()` and transitioning `toVote()` (`G.startVote()`) when `G.round.trial.writing !== "open"`. | 1 | `Game.timer`, `JudgedTrial.writing`, `JudgedTrial.vote` | None | Medium |
| V-42 | `pages/vote-test.js` | 24-33, 43-70, 115, 120-122 | Screen drives bot rounds directly (`EP.Bots.openFloor`, `trial`, `accusations`, `gifts`, `statsUpdate`, `submit`, `vote`) without `Bots.hooks` and reaches directly into `G.round.trial.vote`. | 8 | Full Levels 1-6 round state, `Vote.ballots`, `Trial.ranking` | None | Low |

---

## Clean Screen Files and Allowed Pure-UI Code

Checked and confirmed clean (0 violations):
- `pixel-art.js`: pure SVG sprite/icon rendering (`DPOS` is pure UI tutorial dialog index; reads `S.av` for wardrobe icons).
- `board.js`: read-only modal drawing `Game.board()`.
- `fullscreen-view.js`: pure browser Fullscreen API button.
- `index.html`, `pages/vote-test.html`: markup and script tags only, no inline scripts.

Allowed pure-UI timers and `Math.random()` checked in other files (change no game outcome):
- `game.js:4-21`: background canvas code rain (`requestAnimationFrame` + `Math.random()`).
- `game.js:765, 782, 869-870`: elevator door CSS flag `setTimeout(1600)`, input focus `setTimeout(50)`, menu glitch cursor CSS `setTimeout(220)`.
- `game.js:792`: pre-game cosmetic wardrobe `#rand` avatar button (`Math.random()`).
- `mirror-dance-view.js:331`: 150ms button `.hit` flash `setTimeout`.
- `world-map.js:172, 201-203`: visual-only wandering ghost hints (`Math.random()`, `setTimeout`; lines `201-202` are also a dead `setInterval` for the removed static map's `.gwalk` elements and can be deleted during cleanup).

---

## Open Floor Movement, Ghost Contact, and Tea Guest Contact (Question for Ben)

Per task rules, this audit lists where each piece is handled without deciding whether player position is game state (flagged as an Open Question for Ben in `docs/screen-state-plan.md`):

- **Player position (`S.pos`, `S.wroom`, `S.room`, `S.visited`):**
  - State initialized in `game.js:214` (`pos:{x:100,y:710}`, `visited:{elevator:true}`, `wroom:"elevator"`, `room:"studio"`); `S.visited` kept across Replay in `game.js:819`.
  - Rendered on Floor 60 SVG in `world-map.js:95` (`#wme`), minimap in `world-map.js:107` (`#mmme`), and room label in `world-map.js:113` (`#wroom`).
  - Movement loop in `world-map.js:146-180` (`initWorld()` `requestAnimationFrame`): touch joystick (`152-154`), keyboard `held()` (`159-160`), speed `sp = 300` (`161`), collision `walkable`/`blocked`/`canStand` (`23-38, 162-163`), camera pan (`166-168`), room change detection `roomAt()` (`39, 170`).
  - Keyboard listeners in `world-map.js:197-198` (`keydown`/`keyup`, `TAP_MS = 110` at `137`).
- **Ghost contact:**
  - Ghost definitions in `world-map.js:2-6` (`GHOSTS`, `GSPOTS`); per-level hint text in `game.js:114-171, 206` (`LEVEL_HINTS`, `ghostHint()`).
  - Random appearance/teleport every 2800ms inside `initWorld()` in `world-map.js:148-149, 172`.
  - Proximity check (`< 120px`) in `world-map.js:173` (`W.near`, `S.nearGhost`); auto-close popup at `> 140px` in `world-map.js:175`.
  - Interaction prompt `"Listen"` in `world-map.js:182` (`useAction()`), open panel in `world-map.js:196` (`doUse()`), panel markup in `world-map.js:135` (`ghostPanel()`).
  - Legacy static map whisper click in `world-map.js:201-203`.
- **Tea guest contact (and hallway NPC Rook):**
  - High Tea room polygon in `world-map.js:17` (`WROOMS` `"hightea"`); `Guest · Sponsor` sprite at `(1790, 520)` in `world-map.js:92`.
  - Room detection in `world-map.js:39, 170` (`roomAt` -> `S.wroom === "hightea"`, `S.room = "hightea"`); auto-close popup when leaving room in `world-map.js:175`.
  - Interaction prompt `"Network"` in `world-map.js:189` (`useAction()`), open panel in `world-map.js:196` (`doUse()`), panel markup in `world-map.js:126` (`roomPanel()` calling `teaHint()` from `game.js:207`).
  - Hallway NPC `ROOK` at `(1690, 745)` in `world-map.js:93, 133-134, 183, 196` (proximity `< 90px` -> `"Talk"`).

---

## Known QA Bugs Mapped (Level 2 QA, Nov 20)

| # | Known QA Bug | Cause type | File and line numbers | Notes / Audit IDs |
|---:|---|---|---|---|
| 1 | Lock In warning opens by accident after the 3rd note; an empty board could be locked. | **Both** (Rule violation + Pure UI) | `splitbrief-view.js:87, 127-130, 160-178, 228-240`; `rules/Trial.js:382-388` | **UI:** after the 3rd note disables `#splitNoteIn`, `restoreFocus` (`127-130`) falls back straight to `#splitLockBtn`. **Rule (V-20, V-21):** neither `SplitBriefTrial.lockIn()` nor `#splitLockBtn` blocks locking an empty board, and screen calls `trial.lockIn(ME)` directly. |
| 2 | Notes cut off at 80 characters with no counter. | **Pure UI** | `splitbrief-view.js:93, 171-175` | `rules/Trial.js:339-341` already enforces `MAX_NOTE_CHARS = 80`. Screen `<input maxlength="80">` has no live `N / 80` counter. |
| 3 | Open Floor movement slow with tapped keys. | **Pure UI** | `world-map.js:137, 157-163, 197` | `TAP_MS = 110` at `300 px/s` moves only ~33px per tap across a 2300px map (plus `performance.now()` vs `rAF` `t` check). |
| 4 | All-Hands does not advance on its own after the gift window. | **Rule violation** | `game.js:283-292` | `afterClose(closed)` handles `intermission` and `openFloor` navigation, but has no `giftWindow` -> `go(9)` branch (V-01). |
| 5 | Level 1 Glitch Report and Stats Update timers do not match their text. | **Both** (Rule violation + Pure UI) | `game.js:279, 283-292, 296, 361-364, 568, 573, 677` | **Rule (V-01, V-03, V-04, V-11):** missing `giftWindow` auto-advance leaves `#banner` hidden on `V[8]` while the 30s `statsUpdate` timer runs down; `canBack()` lets `S.step` desync from `G.step`; `drawTimer()` prints `G.secondsLeft()` regardless of `S.step`. **UI:** static `"in 30 seconds"` text (`568`) with no inline Glitch Report timer and no duration stated on Stats Update (`677`). |
| 6 | Level 1 Stats Update ability text stale until lock. | **Rule violation** | `game.js:657, 680`; `rules/Attributes.js:66-72`; `rules/Player.js:117` | `pointBuyHTML` (`657`) adds `ME.draft`, but `ME.abilityLines()` (`680`) reads committed `ME.attrs` only, ignoring `ME.draft` until `G.lockPoints()` (V-09). |
| 7 | Tie order not explained on screen. | **Both** (Rule violation + Pure UI) | `game.js:483, 568, 588, 614, 621, 645`; `splitbrief-view.js:55`; `judged-view.js:38` | **Rule (V-12, V-13, V-22, V-26):** `finalResultsScreen` sorts teams in screen code instead of using `G.teamStandings()`, and trials/attributes do not expose tie-break text to screens. **UI:** Split Brief, SOP/Auto, Vote, Gift/Accusation hints, and Team Standings omit tie-order copy. |
| 8 | Up/Down/Remove buttons wrap differently on task 2. | **Pure UI** | `splitbrief-view.js:79`; `styles.css:352` | `.sb-slot` and its inner `.row` both allow `flex-wrap: wrap`, so task titles of different lengths wrap the 3 buttons inconsistently between slot 1 and slot 2. |
| 9 | Footer still says "wait for the split brief timer" after Lock In. | **Pure UI** | `splitbrief-view.js:287`; `game.js:341-342` | `waitHint` is hardcoded to `"Wait for the Split Brief timer to finish"` even when `locked` is `true`. |

---

## Totals

### Totals by File

| File | High | Medium | Low | Total |
|---|---:|---:|---:|---:|
| `game.js` | 7 | 5 | 5 | 17 |
| `mirror-view.js` | 8 | 0 | 0 | 8 |
| `splitbrief-view.js` | 1 | 2 | 1 | 4 |
| `judged-view.js` | 2 | 0 | 1 | 3 |
| `mirror-dance-view.js` | 3 | 0 | 0 | 3 |
| `pages/vote-test.js` | 0 | 2 | 1 | 3 |
| `attendance-view.js` | 2 | 0 | 0 | 2 |
| `world-map.js` | 0 | 1 | 1 | 2 |
| `pixel-art.js` | 0 | 0 | 0 | 0 |
| `board.js` | 0 | 0 | 0 | 0 |
| `fullscreen-view.js` | 0 | 0 | 0 | 0 |
| **Total** | **23** | **10** | **9** | **42** |

### Totals by Risk

| Risk | Count |
|---|---:|
| High | 23 |
| Medium | 10 |
| Low | 9 |
| **Total** | **42** |

### Totals by Category

| Category | Description | Count |
|---:|---|---:|
| 1 | Timers / `rAF` advancing game or changing state | 9 |
| 2 | `Math.random` / `Date.now` affecting outcomes | 6 |
| 3 | Direct writes to game/trial/player objects | 4 |
| 4 | Stale copies of game data in screen variables | 7 |
| 5 | Rule checks only in screen (or missing in rules) | 3 |
| 6 | Scoring, ranking, or tie-break math in screen | 3 |
| 7 | `localStorage` outside Part 13 save system | 1 |
| 8 | Other save/load or Base44 multiplayer breaks | 9 |
| **Total** | | **42** |
