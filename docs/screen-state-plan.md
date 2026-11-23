# Screen State Cleanup Plan

After each step: run `npm run build`, then `npm test` (fixed-seed baseline compare; outputs must match exactly unless a step fixes a listed bug, in which case explain the expected diff before saving). Run `npm run test:screens` for every step that touches screen files. Run commands one at a time in PowerShell 5.1.

Reference audit: `docs/screen-state-audit.md` (42 violations: V-01 through V-42).
No rules, balance numbers, timer lengths, copy, or features are redesigned in this plan.
Balance checks are not part of npm test. Run npm run test:balance only at the checkpoints listed in CLAUDE.md.

## Checklist

- [x] **Step 0:** Add Screen State Rule and doc cleanup to `CLAUDE.md` and `AGENTS.md` (done)
- [x] **Step 1:** Attendance injected clock and server-ready tick (`V-18, V-19`)
- [x] **Step 2:** Game clock sync, Gift Window auto-advance, and timer banner alignment (`V-01, V-02, V-11`)
- [x] **Step 3a:** Level 3 seeds (Lobby cursor, Cables bag, Sound Check spikes and jitter) from `MirrorTrial`'s seeded `Rng` (`V-28, V-32, V-33`)
- [ ] **Step 3b:** Level 3 Setup deadlines (Q&A timeout, deck reshuffle, mic flash hide, sound hold) owned by `SetupCrew` and checked in `Game.tick` (`V-27, V-29, V-30, V-31`)
- [ ] **Step 4:** Level 3 Dance Crew note chart, tempo seed, and miss/idle gating into `DanceCrew` / `MirrorTrial` (`V-35, V-36, V-37`)
- [ ] **Step 5:** Lock screen navigation to `Game.step`, move bot gift answers into hooks, and stop clicks from closing timed steps early (`V-03, V-04, V-05`)
- [ ] **Step 6:** Route Split Brief actions and player-scoped reads through `Game` (`V-20, V-23`)
- [ ] **Step 7 (BLOCKED):** Remove render-time mutations and direct `Vote`/`Bots` calls from `judged-view.js` and `pages/vote-test.js` (`V-24, V-25, V-26, V-40, V-41, V-42`) — blocked until Ben decides when the Levels 5-6 vote closes (Q10)
- [ ] **Step 8:** Draft-aware player reads and remove stale round copies (`S.pay`, `S.acc`, `S.gw`, `S.sop.inTime`, `S.prog`) (`V-07, V-08, V-09, V-16, V-39`)
- [ ] **Step 9:** Move anomaly tracking (`S.found`) into `Player` / `Game` save state (`V-06, V-38`)
- [ ] **Step 10:** Enforce rule checks in rules (empty Split Brief Lock In, idle Mirror Setup actions, SOP/sign-in rules) (`V-14, V-21, V-34`)
- [ ] **Step 11:** Remove scoring, ranking, and tie-break math from screen code (`V-12, V-13, V-22`)
- [ ] **Step 12:** Clean up SOP pile randomness, `localStorage`, and session/dev-jump bootstrap (`V-10, V-15, V-17`)
- [ ] **Step 13:** Add automated guard test `Tests/check_screen_rules.js` (using `// cosmetic-ok` markers)

---

## Detailed Steps (Ordered by Dependency)

### Phase 0: Rules and Docs

#### Step 0: Add Screen State Rule and cleanup to `CLAUDE.md` and `AGENTS.md` — DONE
- **Violations covered:** Permanent engineering rule for all future agents.
- **Files touched:** `CLAUDE.md`, `AGENTS.md`
- **Where logic moves:** Added **Screen State Rule**, **Current work**, and moved rules from finished-history sections in `CLAUDE.md`; updated `AGENTS.md` startup docs and Screen State Rule; rewrote the Level 3 code-split line so rules own all Level 3 deadlines, timeouts, penalties, content picks, randomness, and scoring.
- **Checks:** `npm test` (docs-only, confirms clean 19/19 pass).

---

### Phase 1: Timers and Deadlines

#### Step 1: Attendance injected clock and server-ready tick — DONE
- **Violations covered:** `V-18, V-19`
- **Files touched:** `rules/Game.js`, `rules/rules.bundle.js`, `attendance-view.js`, `game.js`, `pages/vote-test.js`, `Tests/check_screens.js`
- **Where logic moves:** Existing `Game` (`rules/Game.js`) and `Attendance` (`rules/Attendance.js`). Default `now = this.now()` in `Game.checkAttendance(now = this.now())` (matching `Game.activity`), and run attendance checks from `Game`'s own tick path (or a single `Game.pollAttendance()` call using `this.now()`) so screens never pass `Date.now()` into rules and Base44 actor wakes check all players even when a tab is closed. Keep the 1s mouse-move throttle in `attendance-view.js` on `performance.now()` (pure input debounce) rather than passing wall-clock time to rules.
- **QA bugs fixed:** None (fixes clock skew and closed-tab idle bypass for multiplayer).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

#### Step 2: Game clock sync, Gift Window auto-advance, and timer banner alignment — DONE
- **Violations covered:** `V-01, V-02, V-11`
- **Files touched:** `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `Tests/check_screens.js`
- **Where logic moves:** Existing `Timer` (`rules/Timer.js`) and `Game` (`rules/Game.js`). Add a read-only `Game.timerView()` pass-through returning `{ name, secondsLeft }` so `game.js` renders the banner label and countdown strictly from `G.timer` (never guessing from `S.step`). In `game.js`: add `giftWindow` -> `go(9)` to `afterClose()` so All-Hands auto-advances when the gift window closes; sync `S.step` to `G.step` on timer close; limit the `G.start()` change to "the elevator cutscene no longer starts the game clock" (no lobby work); use the banner timer only from `Game.timerView()` (no inline countdown in Glitch Report or Stats Update panels; answers Q8).
- **QA bugs fixed:** **Bug 4** (All-Hands advances automatically after the gift window), **Bug 5** (Glitch Report and Stats Update timers match their text and banner).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

#### Step 3a: Level 3 seeds (Lobby cursor, Cables bag, Sound Check spikes and jitter) from `MirrorTrial`'s seeded `Rng` — DONE
- **Violations covered:** `V-28, V-32, V-33`
- **Files touched:** `rules/MirrorParts.js`, `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `mirror-view.js`, `Tests/check_mirror_lobby.js`, `Tests/check_mirror_setup.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `MirrorLobby` and `SetupCrew` (`rules/MirrorParts.js`), coordinated through `MirrorTrial` (`rules/Trial.js`) and `Game` pass-throughs (`rules/Game.js`). Seed Lobby cursor initial `pos`/`dir`, Cables bag order, and Sound Check spikes and jitter from `MirrorTrial`'s seeded `Rng` (persisted in `MirrorLobby`/`SetupCrew` `toJSON`/`fromJSON`), so `mirror-view.js` has zero `Math.random()` calls and reload restores exact seeded sequences.
- **QA bugs fixed:** None from Level 2 QA (fixes Level 3 QA Step 10 #4).
- **Done notes:** Implemented Option A: `MirrorTrial`, `MirrorLobby`, and `SetupCrew` keep existing Level 3 draws on `Game.rng` and use a private `#seedRng` seeded from `(Game.rng.getState() ^ 0x9E3779B9) >>> 0` with 0 extra draws on `Game.rng` (plus a test-only 1-draw fallback for non-saveable RNGs). `seedRngState` saves and restores in `toJSON`/`fromJSON` while older saves missing `seedRngState` or cursor fields still load cleanly, and `mirror-view.js` has zero `Math.random()` calls.
- **Checks:** `npm run build`, `npm test` (note: explain any diff in `check_mirror_*` / `check_save` baselines if new seeded draws or JSON fields are added; verify Level 1 and Level 2 snapshots are unchanged; no baseline save without explaining diffs), `npm run test:screens`.

#### Step 3b: Level 3 Setup deadlines (Q&A timeout, deck reshuffle, mic flash hide, sound hold) owned by `SetupCrew` and checked in `Game.tick`
- **Violations covered:** `V-27, V-29, V-30, V-31`
- **Files touched:** `rules/MirrorParts.js`, `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `mirror-view.js`, `Tests/check_mirror_setup.js`, `Tests/check_mirror_timing.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `SetupCrew` (`rules/MirrorParts.js`), coordinated through `MirrorTrial` (`rules/Trial.js`) and `Game` pass-throughs (`rules/Game.js`). Move Q&A timeout, deck reshuffle, mic flash hide, and sound hold deadlines into `SetupCrew` (using `Game.now()` / showtime elapsed seconds and evaluated in `Game.tick()`), persisted in `SetupCrew.toJSON`/`fromJSON`. Keep smooth visual rendering in `mirror-view.js` (screens draw motion from rules data and report player input), while rules own all deadlines, timeouts, reshuffles, and penalties (answers Q5).
- **QA bugs fixed:** None from Level 2 QA (fixes Q&A/deck/mic/sound reload and Back exploits).
- **Checks:** `npm run build`, `npm test` (note: explain any diff in `check_mirror_*` / `check_save` baselines if new deadlines or JSON fields are added; verify Level 1 and Level 2 snapshots are unchanged; no baseline save without explaining diffs), `npm run test:screens`.

#### Step 4: Level 3 Dance Crew note chart, tempo seed, and miss/idle gating into `DanceCrew` / `MirrorTrial`
- **Violations covered:** `V-35, V-36, V-37`
- **Files touched:** `rules/MirrorParts.js`, `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `mirror-dance-view.js`, `Tests/check_mirror_dance.js`, `Tests/check_mirror_bots.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `DanceCrew` (`rules/MirrorParts.js`) via `MirrorTrial` (`rules/Trial.js`) and `Game` pass-throughs (`rules/Game.js`).
  - Generate each dancer's deterministic note sequence/schedule in `DanceCrew` using `MirrorTrial`'s seeded `Rng` (saved in `DanceCrew.toJSON`/`fromJSON`), removing `Math.random()` from `mirror-dance-view.js:53`.
  - Reject `noteMiss` / `noteHit` / `strayPress` when the dancer is idle (matching `CLAUDE.md`), and advance expired unhit notes on `Game.tick()` (skipping idle dancers so bots auto-pilot them cleanly without charging `-2` misses).
  - `mirror-dance-view.js` uses `requestAnimationFrame` strictly to draw note positions from the rules-owned chart and elapsed showtime, and forwards key/pad presses to `Game`.
- **QA bugs fixed:** None from Level 2 QA (fixes Level 3 QA Step 10 #1 and #4).
- **Checks:** `npm run build`, `npm test` (explain any diff in `check_mirror_dance` / `check_save` baselines; Level 1 and Level 2 snapshots unchanged), `npm run test:screens`.

---

### Phase 2: Step and Phase Flow

#### Step 5: Lock screen navigation to `Game.step`, move bot gift answers into hooks, and stop clicks from closing timed steps early
- **Violations covered:** `V-03, V-04, V-05`
- **Files touched:** `rules/Game.js`, `rules/bots.js`, `rules/rules.bundle.js`, `game.js`, `Tests/check_steps.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `Game` (`rules/Game.js`) and `Bots.hooks` (`rules/bots.js`).
  - Disable `◀ Back` in `game.js:296` whenever a live round step is active (`S.step >= 5`, keeping Back only for pre-game screens `1..4` and menu navigation) so `S.step` cannot desync from `G.step`.
  - Add an `onGift(game, gift)` hook in `Bots.hooks` (invoked from `Game.gift()` if present) and delete the direct `EP.Bots.answer(G, r.gift, G.rng)` call from `game.js:596`.
  - Timed steps (`SOP`, `Glitch Report`, `Stats Update`, `Graduation`) close only when their timer runs out. One player's click never closes a timed step for others. Only Levels 5-6 writing and Split Brief close early (answers Q4). Replace raw `G.closeTimer()`, `G.placeAllRemaining()`, `G.finishRound()`, and `G.results()` clicks in `game.js` with player-action methods (`G.submitSop(p)` / saving draft picks) that never close timed steps early.
- **QA bugs fixed:** Reinforces **Bug 5** (eliminates Back-button timer desync) and fixes Level 3 QA Step 10 #2.
- **Checks:** `npm run build`, `npm test` (explain any baseline diff if bot games change before saving a new baseline), `npm run test:screens`.

#### Step 6: Route Split Brief actions and player-scoped reads through `Game`
- **Violations covered:** `V-20, V-23`
- **Files touched:** `rules/Game.js`, `rules/rules.bundle.js`, `splitbrief-view.js`, `Tests/check_steps.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `Game` (`rules/Game.js`) delegating to `SplitBriefTrial` (`rules/Trial.js`). Add thin one-line pass-throughs on `Game`: `splitBriefPostNote(p, text)`, `splitBriefSetBoard(p, taskIds)`, `splitBriefLockIn(p)`, and player-scoped read `splitBriefView(p)` (returning only `p`'s cards, `p`'s twist card if holder, team notes, team board, lock status, tasks, and result when closed). Update `splitbrief-view.js` to call only `Game` methods and never touch `G.round.trial`.
- **QA bugs fixed:** Prerequisite for **Bug 1** and **Bug 7**; enforces Base44 player-scoped privacy (`CLAUDE.md`).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

#### Step 7: Remove render-time mutations and direct `Vote`/`Bots` calls from `judged-view.js` and `pages/vote-test.js` — BLOCKED
- **Status:** BLOCKED until Ben decides when the Levels 5-6 vote closes (Open Question #10).
- **Violations covered:** `V-24, V-25, V-26, V-40, V-41, V-42`
- **Files touched:** `rules/Game.js`, `rules/Trial.js`, `rules/bots.js`, `rules/rules.bundle.js`, `judged-view.js`, `pages/vote-test.js`, `Tests/check_steps.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `Game` (`rules/Game.js`), `JudgedTrial` (`rules/Trial.js`), `Vote` (`rules/Vote.js`), and `Bots.hooks` (`rules/bots.js`).
  - Auto-open writing in `Game.advance()` when entering a `JudgedTrial` step with `!this.host` (matching how `advance()` deals `SplitBriefTrial` and starts `MirrorTrial` lobby), and auto-open voting inside `closeWriting()` / early submit close.
  - Trigger `Bots.submit` via `Bots.hooks.onStart("writing")` and `Bots.vote` via a `Bots.hooks` vote callback when voting opens.
  - Add `Game.castVote(voter, targetIds)` (vote closing behavior pending Open Question #10) and read-only `Game.judgedView(p)` pass-throughs.
  - Update `judged-view.js` to call only `Game` methods with zero render-time mutations; simplify `pages/vote-test.js` to use `EP.Bots.hooks`, `G.jumpToLevel(5)`, and `Game` pass-throughs (removing `ME.earned = ...`, `ME.placePoints(...)`, and manual round/vote loops).
- **QA bugs fixed:** None (fixes render-time state mutation, direct `Vote.cast`, and single-voter trial close in Levels 5-6).
- **Checks:** `npm run build`, `npm test` (exact baseline match; if `check_steps` or `check_save` adds new `castVote` assertions, explain the diff), `npm run test:screens`.

---

### Phase 3: Player Data Reads

#### Step 8: Draft-aware player reads and remove stale round copies
- **Violations covered:** `V-07, V-08, V-09, V-16, V-39`
- **Files touched:** `rules/Attributes.js`, `rules/Player.js`, `rules/Round.js`, `rules/Economy.js`, `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `world-map.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `Attributes` (`rules/Attributes.js`), `Player` (`rules/Player.js`), `Round` (`rules/Round.js`), `Economy` (`rules/Economy.js`), and `Game` (`rules/Game.js`).
  - Allow `Attributes.abilityLines(draft = null)` / `Player.abilityLines(draft = null)` to preview `attrs + draft` during Stats Update and Graduation (default `null` keeps existing tests identical).
  - Persist per-player trial payments (`round.trialPayments`) and SOP timeout flag (`round.sopTimedOut`) in `Round` (`toJSON`/`fromJSON`), and record `safe` on `round.accusations` entries.
  - Add player-scoped read pass-throughs on `Game` (`playerState(p)`, `roundSummary(p)`, `sabotageOptions(p)`, `giftOptions(p)`, `answerGiftByIndex(p, index, accept)`) so `game.js` and `world-map.js` delete `S.pay`, `S.acc`, `S.gw.sent`, `S.sop.inTime`, `S.prog`, dummy `new EP.Round(1)`, and direct `G.round.*` / `EP.Gift.*` / `EP.Sabotage.*` accesses.
- **QA bugs fixed:** **Bug 6** (Level 1 Stats Update ability text updates live as draft points are added/removed before Lock In).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

#### Step 9: Move anomaly tracking (`S.found`) into `Player` / `Game` save state
- **Violations covered:** `V-06, V-38`
- **Files touched:** `rules/Player.js`, `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `world-map.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`
- **Where logic moves:** Existing `Player` (`rules/Player.js`) and `Game` (`rules/Game.js`). Store found anomaly IDs (`["L", "id", "loop"]`) on `Player` (saved in `Player.toJSON`/`fromJSON`, defaulting to `[]` for older saves; no new class needed). Add `Game.recordAnomaly(p, id)` and `Game.anomaliesFor(p)` pass-throughs (auto-recording `"loop"` inside `SopTrial.closeSop` when `endlessOut` is true). Per Q3, `WATCHER` counts once, from the `ATTEMPT 02` badge printed at Reception check-in (any second trigger is a bug). Remove `S.found` from `game.js` and `world-map.js`.
- **QA bugs fixed:** None (fixes save/load loss of `ANOMALIES` and duplicate `WATCHER` trigger).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

---

### Phase 4: Rule Checks and Scoring

#### Step 10: Enforce rule checks in rules (empty Split Brief Lock In, idle Mirror Setup actions, SOP/sign-in rules)
- **Violations covered:** `V-14, V-21, V-34`
- **Files touched:** `rules/Trial.js`, `rules/MirrorParts.js`, `rules/Game.js`, `rules/rules.bundle.js`, `splitbrief-view.js`, `mirror-view.js`, `game.js`, `Tests/check_split_brief.js`, `Tests/check_mirror_setup.js`, `Tests/check_screens.js`
- **Where logic moves:** Existing `SplitBriefTrial` (`rules/Trial.js`), `SetupCrew` (`rules/MirrorParts.js`), `SopTrial` (`rules/Trial.js`), and `Game` (`rules/Game.js`).
  - In `SplitBriefTrial.lockIn(player)`: reject locking in an empty board (`board.length === 0`, or `< 2` pending Ben's answer to Open Question #2), and disable `#splitLockBtn` in `splitbrief-view.js` to match. Fix `restoreFocus` in `splitbrief-view.js:127-130` so posting the 3rd note moves focus to an Add/board control or safe heading instead of `#splitLockBtn`.
  - In `SetupCrew` (`rules/MirrorParts.js`) and `Game._mirrorCall`: reject human Setup actions (`soundFeedback`, `timeoutQa`, etc.) when the player is `idle` (auto-pilot calls pass through `Bots.mirror`).
  - Add static rule validation helpers on `Game` (`Game.checkEmail(email)`, `Game.checkJoinCode(code, expected)`) and align SOP empty-submit validation between `SopTrial` and `game.js`.
- **QA bugs fixed:** **Bug 1** (empty board cannot be locked in rules or UI; 3rd note no longer opens Lock In warning by accident) and Level 3 QA Step 10 #1 (idle Setup actions rejected).
- **Checks:** `npm run build`, `npm test` (explain expected `check_split_brief` / `check_mirror_setup` assertion additions; simulation baselines unchanged), `npm run test:screens`.

#### Step 11: Remove scoring, ranking, and tie-break math from screen code
- **Violations covered:** `V-12, V-13, V-22`
- **Files touched:** `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `splitbrief-view.js`, `judged-view.js`, `Tests/check_screens.js`
- **Where logic moves:** Existing `Trial` subclasses (`rules/Trial.js`), `Attributes` (`rules/Attributes.js`), and `Game` (`rules/Game.js`).
  - Expose precomputed display score (`shownScore`), per-step SOP correctness flags, Split Brief raw board score, and a `tieRule` text property from `Trial` / `Game` (`G.trialResultView(team)`), plus `Attributes.TIE_ORDER` formatted label from `Game`.
  - Replace `finalResultsScreen()`'s manual team sort in `game.js:614` with `G.teamStandings()`.
  - Display the rules-supplied tie-break text on Split Brief results (`splitbrief-view.js:55`), SOP/Auto results (`game.js:483`), Vote results (`judged-view.js:38`), Gift/Accusation hints (`game.js:568, 588`), and Team Standings (`game.js:621, 645`).
- **QA bugs fixed:** **Bug 7** (tie order explained on screen from rules).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

---

### Phase 5: Everything Else

#### Step 12: Clean up SOP pile randomness, `localStorage`, and session/dev-jump bootstrap
- **Violations covered:** `V-10, V-15, V-17`
- **Files touched:** `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `Tests/check_save.js`, `Tests/check_screens.js`
- **Where logic moves:** Existing `SopTrial` (`rules/Trial.js`) and `Game` (`rules/Game.js`).
  - Provide deterministic SOP step display order from `SopTrial` (derived via a pure hash of `round.n` and seed state so it is reproducible and requires zero extra `Rng` draws, keeping Level 1 fixed-seed baselines 100% identical) and remove `shuffle()`'s `Math.random()` from `game.js:264`.
  - Keep `localStorage["ep.names"]` display-name memory (`game.js:243-244`) behind a prototype-only helper until Base44 login replaces it (answers Q6).
  - Move `devJump()` default build fill (`EP.Bots.typicalSpend`) into `Game.jumpToLevel` / `Bots` bootstrap and remove dead `ghostHop` `setInterval` (`world-map.js:201-202`).
- **QA bugs fixed:** None (cleanup for deterministic replays and Base44 handoff).
- **Checks:** `npm run build`, `npm test` (exact baseline match), `npm run test:screens`.

---

### Phase 6: Automated Guard Test

#### Step 13: Add automated screen-rule guard test (`Tests/check_screen_rules.js`)
- **Violations covered:** Enforces all categories `1-8` going forward across all 11 screen files (`game.js`, `world-map.js`, `pixel-art.js`, `board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `judged-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `pages/vote-test.js`).
- **Files touched:** `Tests/check_screen_rules.js` (new), `tools/baseline.js`
- **Where logic moves:** New Node test script `Tests/check_screen_rules.js` registered in `tools/baseline.js` (pass/fail like `check_bundle`, no snapshot file needed) so `npm test` fails automatically if any screen file:
  1. Calls `Math.random()` on lines not marked with `// cosmetic-ok` (for allowed cosmetic randomness such as code rain canvas and pre-game avatar randomize; no line-number allowlists).
  2. Calls `Date.now()` or `new Date`.
  3. Calls `setTimeout`, `setInterval`, or `requestAnimationFrame` whose body references `G.`, `EP.`, `trial.`, or mutates game objects.
  4. Writes directly to `G.*`, `ME.*`, `MYTEAM.*`, `trial.*`, `round.*`, or calls mutating methods on `G.round.trial.*`, `v.cast`, `ME.placePoints`, or `EP.Bots.*` (outside session bootstrap).
  5. Calls `localStorage` or `sessionStorage` outside the prototype-only display-name helper (until Base44 login replaces it).
- **QA bugs fixed:** None (automated regression guard).
- **Checks:** `npm run build`, `npm test` (now 17/17 checks passing), `node Tests/check_screen_rules.js`.

---

## Open Questions for Ben

### Still Open
- **Q1. Open Floor position:** Is player `(x, y)` / room position on Floor 60 game state (shared on Base44 so players see teammates move, and saved on reload) or local UI state only?
- **Q2. Empty Split Brief Lock In (Bug 1):** Should `SplitBriefTrial.lockIn()` require at least 1 task on the board, or require all 2 slots filled?
- **Q7. Team standings ties (Bug 7):** On `Sprint 1 Complete`, `Presentation Day Complete`, and `Final Results`, should teams tied on `trialWins` share the same place number (e.g. `1, 1, 3, 4`) or show a tie note?
- **Q9. Open Floor tap speed (Bug 3):** For tapped movement keys on Floor 60, do you prefer a longer tap impulse (e.g. ~80-100px per tap) or grid-step movement?
- **Q10. When the Levels 5-6 vote closes (blocks Step 7):** When should the Levels 5-6 player vote close (e.g. when all active voters cast, on a timer, or both)?

### Answered
- **Q3. Reception `WATCHER` anomaly — ANSWERED:** `WATCHER` counts once, from the `ATTEMPT 02` badge printed at Reception check-in. Any second trigger is a bug (see Step 9).
- **Q4. Multiplayer early phase close — ANSWERED:** Timed steps (`SOP`, `Glitch Report`, `Stats Update`, `Graduation`) close only when their timer runs out. One player's click never closes a timed step for others. Only Levels 5-6 writing and Split Brief close early (see Step 5).
- **Q5. Level 3 action authority on Base44 — ANSWERED:** Rules own Level 3 deadlines (new Screen State Rule): rules own all Level 3 deadlines, timeouts, penalties, content picks, randomness, and scoring; screens draw motion from rules data and report player input (see Steps 3a, 3b, 4).
- **Q6. Display name `localStorage` (`ep.names`) — ANSWERED:** Keep `localStorage` display-name memory behind a prototype-only helper until Base44 login (see Step 12).
- **Q8. Timer copy on Glitch Report and Stats Update (Bug 5) — ANSWERED:** Banner timer only; no inline countdown in Glitch Report or Stats Update panels (see Step 2).

---

## Pure UI Bugs (Separate From State Steps)

Fix these independently as small UI commits; do not mix them into the state refactor steps above:

- **Bug 2 (`splitbrief-view.js:93, 171-175`):** Notes cut off at 80 characters with no counter. Add a live `N / 80` character counter next to `#splitNoteIn` (matching `judged-view.js:52-64`).
- **Bug 3 (`world-map.js:137, 157-163, 197`):** Open Floor movement slow with tapped keys. Tune `TAP_MS` / tap step distance (per Open Question #9) and align the `keydown` timestamp with the `requestAnimationFrame` clock.
- **Bug 8 (`splitbrief-view.js:79`, `styles.css:352`):** Up/Down/Remove buttons wrap differently on task 2. Prevent the button `.row` inside `.sb-slot` from wrapping unevenly (e.g. `flex-wrap: nowrap; flex-shrink: 0` on the action group, or fixed two-row layout).
- **Bug 9 (`splitbrief-view.js:287`, `game.js:341-342`):** Footer still says "wait for the split brief timer" after Lock In. Return a locked-specific `waitHint` (e.g. `"Board locked in. Waiting for the timer or other teams."`) when `locked` is `true`.
