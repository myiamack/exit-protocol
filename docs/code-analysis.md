# Exit_ProtocoL Code Analysis (Step 14)

- **Commit audited:** `86342f7` (`Add automated screen-rule guard test (Step 13)`) on branch `screen-state-cleanup`
- **Role:** Read-only code audit. No source, test, baseline, Git setting, or remote was modified.

## Test Results

| Command | Result | Expected | Failures |
|---|---|---|---|
| `npm test` | **17 of 17 PASS** | 17 of 17 | 0 |
| `npm run test:screens` | **229 of 229 PASS** (`no console errors -> none`) | 229 of 229 | 0 |
| `node Tests/check_screen_rules.js` | **31 of 31 PASS** | 31 of 31 | 0 |

---

## Hannah Readiness Verdict

**One-line verdict:** Not quite ready for an unblocked start; fix 3 small prep items first (shared-file boundaries, the `rules/` guard test, and `judgedView` hidden-math cleanup) before Hannah cuts commits on `levels-4-6`.

### Must-Fix List Before Hannah Starts

1. Update `CLAUDE.md` lines 13-17 so the shared-file boundaries match the real touchpoints Levels 4-6 need (`index.html`, `styles.css`, `rules/bots.js`, `tools/baseline.js`, `docs/class-diagram.md`, `Tests/check_save.js`, `Tests/check_screens.js`, `rules/Game.js` trial hooks, and `game.js` `TIMER_LABELS`/copy/Level 4 unlock).
2. Add a small automated guard test in `Tests/` (registered as `NO_SNAPSHOT` in `tools/baseline.js`) that scans all `rules/*.js` files (except `rules.bundle.js`) for `Math.random`, `Date.now`, `new Date`, `document`, `window`, `setTimeout`, `setInterval`, and multi-line `import`/`export` statements.
3. Strip `total`, exact `score`, and `firsts` from `Game.judgedView` (`rules/Game.js:1213-1215`) and `judged-view.js:35-39` (finding **A-09**) so Levels 5-6 work does not lock in hidden-math leaks.

---

## Findings Table

Risk key: **High** breaks multiplayer or save/load. **Medium** is a visible bug or weakens the `Game` front desk. **Low** is cleanup only.

| ID | Area | File and line | What | Risk | One-line fix |
|---|---:|---|---|---|---|
| A-01 | 1 | `rules/Game.js:624, 631, 1477`; `rules/Trial.js:198-207`; `game.js:517` | `submitSop()` writes one round-wide `"submitSop"` flag, so one team submitting clears `sopTimedOut` for every team and locks other teams' SOP buttons, while `SopTrial.setSopBoard` still allows post-submit edits. | High | Track SOP submission per team (`submitSop:<teamId>`), block edits in `setSopBoard` after submit, and compute `sopTimedOut` per team. |
| A-02 | 1 | `mirror-view.js:115, 591-601, 887-936, 1122-1150`; `rules/MirrorParts.js:639-694` | **V-32 partially remains:** Level 3 Cables belt clock (`ms.cables`) runs unsaved on `game.js`'s 250ms client interval, calls mutating `G.mirrorNextCable`/`G.mirrorReturnCable` from the screen tick, and judges hit vs spark (`-3`) locally; reload drops belt cables and resets belt time. | High | Move Cables belt schedule, expiry, and hit-window validation into `SetupCrew` on `Game`'s clock, expose read-only belt state in `mirrorSetupView`, and judge hits inside `cableHit`. |
| A-03 | 1 | `mirror-view.js:145-152, 343-361, 394-409`; `rules/MirrorParts.js:86-125` | **V-33 partially remains:** Level 3 Lobby signal cursor (`ms.pos`, `ms.dir`) sweeps unsaved on the client 250ms tick and judges `inBand` locally before calling `G.mirrorConnect`/`G.mirrorMiss`; reload resets cursor position and rules never verify band timing. | High | Derive Lobby cursor position from `MirrorLobby` plus elapsed lobby time on `Game`'s clock and validate `inBand` inside one `Game.mirrorLobbyTap(player)` method. |
| A-04 | 1 | `game.js:38, 212, 430, 494, 620`; `world-map.js:91, 124, 129` | Roster and avatar code hardcode solo `TEAM` (`Juno`, `Dex`, `Mara`) and `"Team Kestrel"`; unguarded `TEAM.find(x => x.n === q.name).av` calls (`game.js:620`, `world-map.js:124`) throw `TypeError` for non-solo player names or after `switchTeam()`; player avatar `S.av` is not saved in `Game.toJSON()`. | High | Store cosmetic avatar data on `Player` (saved in `toJSON`/`fromJSON`), expose public team/avatar views from `Game`, and add safe fallbacks in roster/map rendering. |
| A-05 | 1 | `game.js:255-261, 354-358, 549, 873-876`; `rules/Game.js:214, 336, 372, 1222, 1235` | Single-player one-click controls (`startLevel`, Briefing `G.advance()`, AutoTrial `G.runTrial()`, All-hands `G.endTrial()`, `startNextLevel`) start or advance phases for the whole game on one player's click with no host or actor authority check. | High | Gate engine/phase-advancing calls to host or server-actor authority and replace `startLevel` clock start with Host Start or the 120s lobby timer. |
| A-06 | 2 | `rules/Game.js:134-166, 188-213, 263-282`; `rules/Trial.js:289, 866-892`; `rules/Attendance.js:64-85` | `Game` exposes only `this.timer.deadline` (the 12 step timers) and no unified next-wake timestamp covering `SplitBriefTrial.twistDeadline` (90s), `MirrorTrial.nextShowtimeEventAt` (Setup/Dance deadlines), or per-human `Attendance` popup/miss deadlines; a sleeping Base44 actor waking only on `G.timer.deadline` misses mid-step events. | High | Add `Game.nextWakeAt()` returning the earliest pending timestamp across `Timer`, `SplitBriefTrial.twistDeadline`, `MirrorTrial.nextShowtimeEventAt`, and active `Attendance` deadlines. |
| A-07 | 3 | `rules/Game.js:1548-1558`; `rules/Gift.js:37-38` | `giftOptions(p).sent` leaks Independent type: automatic refusal records `cost: 0` (versus `1`-`3` for normal human declines) and exposes `cost: 0` in the payload while skipping `"pending"` immediately on send (`CLAUDE.md:63, 161`). | High | Omit `cost` on declined/refused `sent` gift entries (or report nominal `Gift.cost(pl, pts)`) and delay/mask Independent refusal in multiplayer to match a human decline. |
| A-08 | 3 | `rules/Game.js:995, 1001, 1014, 1016, 1051-1058, 1625`; `rules/MirrorParts.js:64-75, 1604-1660, 2419, 2452-2455` | Mirror state getters called by screens (`mirrorLobbyTeam`, `mirrorSetupTeam`, `mirrorDanceTeam`, plus `isBot` on `mirrorDanceView`) leak hidden bot flags/schedules (`isBot`, `botConnectAt`, `botBoosts`, `nextBotBoostAt`) and Setup internals (`mic.sequence` while hidden, `sound.spikeAt`, `cables.bag`, `qa.order`); `trialRanking`, `teamStandings`, and `results` return live `Team`/`Player` objects. | High | Replace raw team/trial getters on the player screen surface with sanitized player-scoped views stripping `isBot`, bot schedules, hidden Setup fields, and live class instances. |
| A-09 | 3 | `rules/Game.js:682-683, 1213-1215, 1484-1485`; `judged-view.js:35-39` | `judgedView(p)` exposes `total` (Initiative-weighted points leaking voters' hidden Initiative), exact `score`, and tie-break `firsts`, and `judged-view.js:39` renders `r.score.toFixed(3)` and `1st places` on player screens; `splitBriefView(p)` and `roundSummary(p)` also expose raw `base` and exact `score` (leaking hidden influence `score - base`). | High | Remove `base`, unrounded `score`, `total`, and `firsts` from player-scoped views (`judgedView`, `splitBriefView`, `roundSummary`) and display rounded scores only in `judged-view.js`. |
| A-10 | 1 | `rules/Trial.js:198-207`; `rules/Game.js:602-606, 966-978, 1067-1074` | Missing active/actor checks in rules: `SopTrial.setSopBoard` and `Game.mirrorMiss` do not reject `idle` players (`CLAUDE.md:139, 157`), and team-scoped Mirror mutators (`mirrorNextCable`, `mirrorReturnCable`, `mirrorReshuffleDeck`, `mirrorNextSoundSpike`, `mirrorNextSoundJitter`, `mirrorFinishTeam`) accept any `teamOrId` without checking an authorized active actor. | High | Reject `p.idle` in `SopTrial.setSopBoard` and `Game.mirrorMiss`, and require an authorized active player (or internal-only path) on all Mirror mutators. |
| A-11 | 1 | `game.js:225, 275, 325, 820, 839, 843`; `rules/Player.js:38-64` | `game.js` targets players by display name (`MATE(n) = G.players.find(p => p.name === n)`), while `rules/Player.js` enforces neither display-name format (`cleanName` 2-16 chars is screen-only) nor uniqueness, misrouting gifts, sabotage, and accusations if two players share a name. | High | Pass player `id` (not display name) in `data-gift`, `data-sab`, and `#accSel` actions, and enforce display-name format and uniqueness in `rules/Player.js` and `Game`. |
| A-12 | 1 | `game.js:216, 516-517, 529, 870, 872` | `S.sop.submitted` duplicates `rs.sopSubmitted` in screen state, and `S.sop.pile` mutates on card removal so tile order diverges from `G.sopOrder()` on reload. | Medium | Delete `S.sop.submitted` and compute the available SOP pile directly from `G.sopOrder()` minus `G.sopBoard(MYTEAM)`. |
| A-13 | 1 | `game.js:224, 399-400, 494-504, 595-617, 638, 645-716, 866`; `judged-view.js:26`; `mirror-view.js:17, 179`; `pages/vote-test.js:74, 92, 95, 118` | Screens read live `ME.*`, `MYTEAM.*`, `G.players`, `G.teams`, and `G.round.name` directly instead of player-scoped `Game` views; `HUD`, `gradChecks()`, and `status()` on `V[9]` also ignore `ME.draft` until Lock In. | Medium | Route screen reads through `Game.playerState(ME)` and `judgedView` (adding `roundName` and draft-aware `gradChecks`) and drop direct `ME`/`MYTEAM`/`G.round` property reads. |
| A-14 | 2 | `rules/MirrorParts.js:433-487, 1222-1223, 1416-1525` | `SetupCrew` arms `sound.nextTickAt`/`spikeAt`, `mic.hideAt`, `deck.nextReshuffleAt`, and `qa.itemDeadlineAt` without tracking idle windows, so a human returning from idle mid-step fires all accumulated catch-up ticks in one burst. | Medium | Track `wasIdle` in `SetupCrew` (like `DanceCrew.#resumeChartFromIdle`) and re-anchor active step deadlines to `now` when a human resumes. |
| A-15 | 3 | `mirror-view.js:86-90, 213, 225, 244, 284`; `splitbrief-view.js:57`; `pages/vote-test.js:87, 102` | Hidden math visible on player screens (`CLAUDE.md:138`): `mirror-view.js` displays 1-decimal exact `attention%` (Mirror's tie-break metric) for all teams and uninfluenced `r.base`, `splitbrief-view.js:57` shows raw `Board score` next to rounded `Score` (revealing influence delta), and `pages/vote-test.js` shows `Vote points` and the vote formula. | Medium | Render `mirror-view.js` results via `G.trialResultView`, hide or round opponent attention decimals, and remove raw `Board score` beside influenced `Score` on player screens. |
| A-16 | 4 | `rules/Attributes.js:5, 66-74`; `rules/PlayerStatus.js:5`; `rules/Wallet.js:5`; `rules/Economy.js:79-94` | `KEYS` in `rules/` still uses the old attribute order (`focus, initiative, collab, composure, grit`) instead of `CLAUDE.md:113` (`Focus, Collaboration, Initiative, Grit, Composure`), causing `abilityLines()` on `V[9]` and `Economy.allocate` ties to follow the old order. | Medium | Order `abilityLines()` by `Attributes.TIE_ORDER` and align `KEYS` with `CLAUDE.md:113` (updating balance snapshots if `allocate` tie order changes). |
| A-17 | 4 | `game.js:224, 507`; `world-map.js:121-130` | `CLAUDE.md:143` includes team switching during Open Floor (`Game.switchTeam` exists at `rules/Game.js:561-575`), but `game.js` and `world-map.js` have no team-switch UI and `game.js` caches `MYTEAM` without refreshing on team switch. | Medium | Add an Open Floor team-switch UI calling `G.switchTeam()` and read the player's current team dynamically via `G.teamOf(ME)` / `playerState`. |
| A-18 | 4 | `mirror-dance-view.js:68`; `rules/MirrorParts.js:2395`; `mirror-view.js:596`; `styles.css:409-413, 449` | Level 3 Step 10 #3 hit-frame visual mismatch remains: `leftPct = (1 - progress) * 100` places exact-hit time (`progress = 1`) at `left: 0%` (clipped by `.lane`) instead of centered in `.hitframe`, so notes visually inside `.hitframe` at `22%` score as stray (`-1`). | Medium | Map `progress = 1` to the visual center of `.hitframe` / `.hitframe.plug` so rendered note and cable positions match the hit windows. |
| A-19 | 4 | `mirror-view.js:305, 449, 810` | Level 3 Step 10 #5 bug remains: a player excluded from Mirror at lobby start for being `idle` clears `ME.idle` on any click/move and then sees contradictory `"You are Active and not in the lobby or crews."` / `"You are Active and watching Presentation Day."`. | Medium | Show a neutral message (`"You were not active when Presentation Day started, so you are watching this trial."`) whenever `!myRec` / `!myRole`. |
| A-20 | 4 | `rules/bots.js:279-287` | Level 3 Step 10 #6 bug remains: mid-lobby idle humans auto-connect immediately at `elapsed = 0s` instead of following the `3-15s` bot connect schedule (`CLAUDE.md:186`). | Medium | Assign idle humans a seeded `3-15s` auto-pilot connect time in `MirrorLobby` / `Bots.mirror` instead of connecting at `0s`. |
| A-21 | 4 | `mirror-view.js:114`; `mirror-dance-view.js:51-63, 126` | `resetShowtimeState` clears obsolete `m.dance = null` instead of `m.danceUI = null`, leaving stale Dance Crew UI diff state (`lastMateBoosts`, `lastMisses`, `camMsg`) if showtime resets on the same `trialKey`. | Medium | Change `m.dance = null` to `m.danceUI = null` in `mirror-view.js:114`. |
| A-22 | 4 | `splitbrief-view.js:81, 95, 172-181, 297`; `world-map.js:136, 156-163, 195`; `styles.css:31, 352` | All 4 pure UI bugs remain open: Bug 2 (no `N / 80` char counter on `#splitNoteIn`), Bug 3 (slow Open Floor tap step `TAP_MS = 110` plus `performance.now()` vs `rAF` `t`), Bug 8 (`.sb-slot` button `.row` wraps unevenly), Bug 9 (`waitHint` still says wait for timer after Lock In). | Medium | Fix Bugs 2, 3, 8, and 9 in pure UI commits (counter on `#splitNoteIn`, align `TAP_MS`/clock per Q9, `flex-wrap: nowrap` on `.sb-slot .row`, locked-specific `waitHint`). |
| A-23 | 5 | `rules/Game.js:92`; `rules/Trial.js:20`; `rules/Vote.js:11`; `rules/bots.js:76`; `rules/Player.js:109` | Step 13 `rules/` scan gap: 4 constructors still default to `rng = Math.random` (creating unsaveable objects if `rng` is omitted), and `Player.markActive(now = Date.now())` defaults directly to `Date.now()`, bypassing `Game`'s injected clock. | Medium | Default omitted RNGs to `Rng.seeded(Rng.randomSeed())` (or require `rng`), require `now` in `Player.markActive`, and add a `rules/` guard test. |
| A-24 | 6 | `CLAUDE.md:13-17`; `index.html:34-44`; `styles.css`; `rules/bots.js`; `rules/Game.js`; `game.js:339, 358, 683` | Hannah's shared-file boundaries in `CLAUDE.md:13-17` do not match the real code: they omit `index.html`, `styles.css`, `rules/bots.js`, `docs/class-diagram.md`, `tools/baseline.js`, `Tests/check_save.js`, and `Tests/check_screens.js`, and understate `rules/Game.js` (9 trial touchpoints) and `game.js` (copy tables plus 3 Level 4 locks). | Medium | Update `CLAUDE.md:13-17` to list every real shared touchpoint and add the automated `rules/` guard test before `levels-4-6` begins. |
| A-25 | 7 | `Tests/check_save.js:77-95, 115-149`; `Tests/check_steps.js`; `Tests/check_screens.js` | Critical multiplayer and save/load test gaps: zero multi-human same-team tests (SOP, Split Brief, Mirror Setup/Dance, human-to-human gifts); `check_save.js` calls direct `SplitBriefTrial` and legacy Mirror methods instead of `Game` player APIs; no tests for `pollAttendance` after actor sleep, privacy/hidden-math payloads, or Step 6-12 `Game` APIs inside `npm test`. | Medium | Add multi-human, privacy-payload, and actor-wake save/load tests in `Tests/check_save.js` and `Tests/check_steps.js`, driving real `Game` player methods. |
| A-26 | 4 | `rules/Round.js:10`; `game.js:208, 485-488`; `pixel-art.js:127-141` | Minor copy/spec mismatches: `Round.LEVELS[1].trialName` is `"Prioritize against a timer"` instead of `"Split Brief"` (`CLAUDE.md:129`); `facLines(7, 3, "failed")` returns lobby+showtime lines combined; queued `CLAUDE.md:56-57` Points screen and drawback copy fixes remain pending. | Low | Align `Round.LEVELS[1].trialName`, handle `"failed"` in `facLines`, and apply the queued `CLAUDE.md:56-57` screen copy updates. |
| A-27 | 1 | `game.js:211, 230, 409, 805` | Pre-session `ERROR` anomaly flag `S.pendingL` lives in memory only until `newSession()`, so reloading before character creation loses it and Base44 lobby join must forward it. | Low | Forward `pendingL` in the Base44 lobby character-creation payload so `"L"` transfers to `Player`. |
| A-28 | 9 | `game.js:40-41, 786, 911`; `world-map.js:6, 198-199`; `index.html:26`; `styles.css:76, 111, 132, 276, 280-282, 438` | Dead screen code and leftover static-map code: unused `SOP`/`DECOY`, unused `GSPOTS`, unreachable `.gwalk`/`#whisper` click handler and DOM, and 6 unused CSS selectors. | Low | Delete the unused constants, dead `.gwalk`/`#whisper` leftovers, and unreferenced CSS selectors. |
| A-29 | 9 | `rules/Attributes.js:7, 49-50`; `rules/Player.js:95-96, 113`; `rules/PlayerStatus.js:34-39`; `rules/Game.js:585-594, 971-972, 974-975, 978, 980, 983-985`; `rules/Trial.js:188-192, 1016, 1026`; `rules/mirrorData.js:65, 67, 159, 197, 200-201` | Dead or legacy-only rules code: zero-caller `highestKey`, `lowestKey`, `scoreSop`, `setupState`, `danceState`, `GIFT_TIE_ORDER`, 6 unused `mirrorData` fields, and 9 pre-Step-3b/4 `Game.mirror*` + `Player.flag()` wrappers kept only by old tests. | Low | Remove zero-caller helpers and migrate legacy tests off obsolete `Game.mirror*` and `Player.flag()` methods. |
| A-30 | 9 | `rules/Game.js` (1,666 lines); `game.js` (924 lines) | `rules/Game.js` grew from 1,041 to 1,666 lines (+60%) mixing step orchestration with view projections, dev jump, and 30+ Mirror wrappers; `game.js` (924 lines) bundles copy tables, arrival cutscene, code rain, SOP, and end screens. | Low | Split `rules/Game.js` and `game.js` along the module boundaries listed in Area 9 after multiplayer blockers are cleared. |

---

## Totals

### Totals by Risk

| Risk | Count | Finding IDs |
|---|---:|---|
| High | **11** | A-01, A-02, A-03, A-04, A-05, A-06, A-07, A-08, A-09, A-10, A-11 |
| Medium | **14** | A-12, A-13, A-14, A-15, A-16, A-17, A-18, A-19, A-20, A-21, A-22, A-23, A-24, A-25 |
| Low | **5** | A-26, A-27, A-28, A-29, A-30 |
| **Total** | **30** | |

### Totals by Area

| Area | Topic | High | Medium | Low | Total |
|---:|---|---:|---:|---:|---:|
| 1 | Screen State Rule | 7 | 2 | 1 | **10** |
| 2 | Save Completeness for Base44 Actor | 1 | 1 | 0 | **2** |
| 3 | Player Privacy & Hidden Math | 3 | 1 | 0 | **4** |
| 4 | Code vs `CLAUDE.md` Final Rules | 0 | 7 | 1 | **8** |
| 5 | `rules/` Scan (Step 13 Gap) | 0 | 1 | 0 | **1** |
| 6 | Hannah Readiness (Levels 4-6) | 0 | 1 | 0 | **1** |
| 7 | Test Gaps | 0 | 1 | 0 | **1** |
| 8 | Carry-Forward Verdicts (a-p table below; issues cross-referenced above) | 0 | 0 | 0 | **0** |
| 9 | Size and Dead Code | 0 | 0 | 3 | **3** |
| **Total** | | **11** | **14** | **5** | **30** |

---

## Carry-Forward Verdicts (Area 8)

| Item | Topic | Verdict | Reason |
|---|---|---|---|
| a | Base44 actor calls `G.tick()` and `G.pollAttendance()` on every wake; pages may run a `setInterval` calling only those two | **Risk** | The two-call wake contract is clean, but `Game` lacks `nextWakeAt()` for sub-step and Attendance deadlines (A-06) and `game.js`'s interval still mutates Mirror Cables via `drawTimer()` -> `mirror-view.js:1131, 1141` (A-02). |
| b | Game clock starts on Start Level click; Host Start or lobby timer replaces it in multiplayer | **Must fix before multiplayer** | Solo `startLevel()` (`game.js:255`) starts the clock and closes/skips the 90s first Intermission on one client click; Base44 must replace it with Host Start or the 120s lobby timer (`CLAUDE.md:65`). |
| c | New Level 3 randomness that must not shift `Game.rng` uses private `#seedRng` | **OK** | `#seedRng` derives deterministically from `Game.rng`, persists as one shared RNG across `MirrorTrial.toJSON`/`fromJSON`, and keeps Level 1-3 baselines intact. |
| d | Timed steps close only when their timer runs out; bots act only through `Bots.hooks` | **OK** | Enforced across all gameplay timed steps and hooks in `index.html` (the first-intermission `startLevel` exception is tracked under item b). |
| e | Step 8: `sopTimedOut` means "did anyone submit," not per player | **Must fix before multiplayer** | `round.completed.add("submitSop")` (`rules/Game.js:624`) is round-wide, so one team submitting clears `sopTimedOut` for every team and locks other teams' SOP UI (`game.js:517`, A-01). |
| f | Step 9: `ERROR` anomaly uses screen flag `S.pendingL` until `ME` exists | **Risk** | Works in solo once `newSession()` runs, but reloading before character creation drops `S.pendingL` and multiplayer lobby creation must forward it to `Player` (A-27). |
| g | Step 11: `judged-view.js` reads `G.round.name` directly | **Risk** | Weakens the `Game` front desk (`judged-view.js:26`, plus `pages/vote-test.js:74, 92, 95, 118`) and breaks on a thin Base44 client that only receives `judgedView(p)` (A-13). |
| h | Step 12: `pages/vote-test.js` calls `EP.Bots.typicalSpend` and `EP.Bots.soloGame` for its own bootstrap | **OK** | Isolated to the standalone Levels 5-6 test page (`pages/vote-test.js:26-36`), explicitly allowlisted in `Tests/check_screen_rules.js`, and outside the multiplayer app. |
| i | Step 12: SOP `pileSeed` is the `Rng` state at `SopTrial` creation | **OK** | `SopTrial.#pileSeed` snapshots `rng.getState()` with zero `Rng` draws, persists cleanly in `toJSON`/`fromJSON`, and never exposes the raw seed to player screens. |
| j | Step 13: `pages/vote-test.js` writes `G.host = S.host` (allowed by name) | **OK** | Standalone test-page bootstrap (`pages/vote-test.js:39`), explicitly allowlisted in `Tests/check_screen_rules.js`; passing `host` into `Bots.soloGame` is optional cleanup. |
| k | Step 13: `pages/vote-test.js` page clock reads `G.round` directly (allowed) | **OK** | Read-only null guard (`if (!G \|\| !G.round) return;`, `pages/vote-test.js:52`) inside the standalone test page, explicitly allowlisted by the guard. |
| l | Step 13: `git add`, `git commit`, and `git push` exited 1 on first try then succeeded on retry | **Risk** | Confirmed: `core.autocrlf=true` causes `git add` CRLF warnings on `stderr` and `git push` always writes normal progress to `stderr`, which PowerShell 5.1 turns into `ErrorRecord`s under `Stop`/strict wrappers (plus possible transient `.git/index.lock` from VS Code). One-line fix: keep `$ErrorActionPreference = 'Continue'` and check `$LASTEXITCODE` (or pass `-q` / set `GIT_REDIRECT_STDERR='2>&1'` / use PowerShell 7). |
| m | Dance notes still miss while Progress Board is open | **OK** | Rules clock must not pause for a local UI overlay in multiplayer (pausing would let players freeze showtime); adding a short hint when opening Board during Dance is optional UX polish. |
| n | Open questions Q1 (Open Floor position), Q9 (tap speed), Q11 (one-click untimed buttons in multiplayer) | **Must fix before multiplayer** | Q11 blocks multiplayer until host/actor ownership is decided; Q1 affects Base44 actor state schema if shared; Q9 is pure UI (exact touched-code lists in Area 8 details below). |
| o | Pure UI bugs still open: 2 (note counter), 3 (tap speed), 8 (button wrap), 9 (footer after Lock In) | **Risk** | All 4 confirmed still present and still pure UI (visible UX polish bugs; none affect multiplayer state or save/load; details in Area 8 below). |
| p | Remotes: `origin` has two push URLs; `backup` points to `bcoppage-IC/Exit_ProtocoL` so pushing `backup` after `origin` does nothing | **OK** | Confirmed via `git remote -v`: `origin` pushes to both `myiamack/exit-protocol.git` and `bcoppage-IC/Exit_ProtocoL.git`, so a subsequent `git push backup` is a harmless no-op. |

---

## Detailed Audit Notes (Areas 1 to 9)

### Area 1: Screen State Rule

- **Base guard check:** `node Tests/check_screen_rules.js` passes **31 of 31** checks across all 11 screen files.
- **What the guard cannot see:**
  - **Category 4 (stale copies of game data in screen variables):**
    - `mirror-view.js:115, 591-601, 1122-1150`: `ms.cables` (`tick`, `active`, `nextSpawn`) duplicates unsaved Cables belt state and calls mutating `G.mirrorNextCable` / `G.mirrorReturnCable` from the screen tick (**A-02**).
    - `mirror-view.js:145-152, 394-409`: `ms.pos` and `ms.dir` sweep the Lobby signal cursor locally without saving to `Game` (**A-03**).
    - `game.js:216, 516-517, 529, 870, 872`: `S.sop.submitted` duplicates `rs.sopSubmitted` and `S.sop.pile` mutates locally when removing placed steps (**A-12**).
    - `game.js:38, 212, 224, 430, 494, 620` and `world-map.js:91, 124, 129`: `TEAM` (`Juno`, `Dex`, `Mara`), `"Team Kestrel"`, cached `MYTEAM`, and `S.av` are hardcoded or cached outside `Game` (**A-04**, **A-13**).
    - `game.js:211, 230, 409, 805`: `S.pendingL` holds the pre-session `ERROR` anomaly in memory until `newSession()` (**A-27**).
    - `game.js:399-400, 498-499, 690-716`: `HUD`, `gradChecks()`, and `status()` read committed `ME.attrs` without `ME.draft` while drafting points on `V[9]` (**A-13**).
  - **Category 5 (rule checks only in screens, or missing in rules):**
    - `rules/Game.js:624, 631, 1477` and `rules/Trial.js:198-207`: `SopTrial.setSopBoard` does not reject `p.idle` or edits after submission, and `submitSop()` stores one round-wide `"submitSop"` flag rather than per-team (**A-01**, **A-10**).
    - `rules/Game.js:966-978, 1067-1074`: `mirrorMiss` does not reject `idle` players, and team-scoped Mirror mutators (`mirrorNextCable`, `mirrorReturnCable`, `mirrorReshuffleDeck`, `mirrorNextSoundSpike`, `mirrorNextSoundJitter`, `mirrorFinishTeam`) do not check an active actor (**A-10**).
    - `game.js:275, 325, 820` and `rules/Player.js:38-64`: display-name rules (2-16 chars, `[A-Za-z0-9 ]`) exist only in `cleanName()` in `game.js`, and neither screen nor rules enforce unique display names while `MATE(n)` resolves targets by name (**A-11**).
    - `game.js:255-261, 354-358, 549, 873-876`: one-click untimed/start controls have no host or actor gate (**A-05**).
  - **Category 6 (scoring, ranking, or tie-break math in screens):**
    - `mirror-view.js:887-936`: Cables hit-window check (`p.pos <= hitWin`) and hit-vs-spark judging run in screen code (**A-02**).
    - `mirror-view.js:343-361`: Lobby `inBand` signal-grab judging runs in screen code (**A-03**).
    - `mirror-view.js:284`: results table displays uninfluenced `r.base` and 1-decimal exact `attention` directly instead of calling `G.trialResultView` (**A-15**).
    - `judged-view.js:35-39`: renders `r.total.toFixed(1)`, `r.score.toFixed(3)`, and `r.firsts` directly (**A-09**).
- **Status of V-01 to V-42 from `docs/screen-state-audit.md`:**
  - **Gone (39):** V-01, V-02, V-03 *(timed steps fixed; untimed clicks tracked in Q11 / A-05)*, V-04, V-05, V-06, V-07, V-08 *(remaining redundant `S.sop.submitted` and round-wide `submitSop` tracked in A-01 / A-12)*, V-09 *(Bug 6 `abilityLines` fixed; HUD/`gradChecks` draft note in A-13)*, V-10, V-11, V-12, V-13, V-14 *(email/joinCode/SOP fixed; display name still screen-only in A-11)*, V-15 *(isolated to `protoNameStore`)*, V-16 *(direct `G.round`/`Gift`/`Sabotage` removed; direct `ME`/`MYTEAM` reads noted in A-13)*, V-17 *(dev jump gated by `DEV_JUMP` + `Bots.devBuild`)*, V-18, V-19, V-20, V-21, V-22, V-23, V-24, V-25, V-27, V-28, V-29, V-30, V-31, V-34 *(Setup idle checks fixed; `SopTrial.setSopBoard` and `mirrorMiss`/team mutators noted in A-10)*, V-35, V-36, V-37, V-38, V-39, V-40, V-41, V-42.
  - **Partially remaining (3):**
    - **V-26** (`judged-view.js:26, 39`): reads `G.round.name` directly at line 26, and displays exact 3-decimal `score` and `1st places` at line 39 (A-09, A-13).
    - **V-32** (`mirror-view.js:115, 591-601, 887-936, 1122-1150`): `Math.random()` removed from cable bag, but unsaved local belt clock (`ms.cables`), client-tick `G.mirrorNextCable`/`G.mirrorReturnCable` calls, and local hit-vs-spark judging remain (A-02).
    - **V-33** (`mirror-view.js:145-152, 343-361, 394-409`): `Math.random()` removed from initial cursor, but unsaved 250ms cursor sweep (`ms.pos`, `ms.dir`) and local `inBand` hit judging remain (A-03).

---

### Area 2: Save Completeness for the Base44 Actor

- **`Game.toJSON` / `fromJSON` across every round step and mid-trial (Levels 1-3):**
  - **Round steps:** `intermission`, `briefing`, `openFloor`, `trial`, `glitchReport`, `giftWindow`, `lockIn`, `statsUpdate`, and `graduation` (including locked endings, `Player` private parts, `Hearts`, `Team`, `Round.completed`, `sabotages`, `accusations`, `gifts`, `trialPayments`, `earnings`, `prompts`, `submissions`, `Attendance` timestamps/settings, `Rng` state, and `Timer` deadline) round-trip cleanly in `rules/Game.js:1382-1423`.
  - **Mid-trial Level 1 (`SopTrial`):** `#scores`, `#pileSeed`, `round.sopBoards`, `round.sopResults`, `round.sopTimedOut`, and `round.completed` save/restore cleanly. **Gap:** `"submitSop"` is stored once per round rather than per team (**A-01**).
  - **Mid-trial Level 2 (`SplitBriefTrial`):** `scenarioId`, `taskOrder`, `cards`, `boards`, `notes`, `notesUsed`, `lockOrder`, `lockedAfterTwist`, `twistFired`, `twistDeadline`, `twistHolders`, and `ranking` save/restore cleanly, and `fromJSON` re-wires `onAllLocked` (`rules/Game.js:1419`).
  - **Mid-trial Level 3 (`MirrorTrial`):** `phase`, `#seedRng`, `showtimeStartAt`, `MirrorLobby` (including `cursorPos`/`cursorDir`), `SetupCrew` (all 5 step states, `sound.nextTickAt`/`spikeAt`, `mic.hideAt`, `deck.nextReshuffleAt`, `qa.itemDeadlineAt`), `DanceCrew` (note chart, `spawnedCount`, `nextNoteTick`, `wasIdle`, `stumbleUntilTick`), `failedTeams`, `lockedAttention`, and `ranking` save/restore cleanly. **Gaps:** live Cables belt (`ms.cables`) and live Lobby cursor position (`ms.pos`/`ms.dir`) are lost on reload because they live in `mirror-view.js` (**A-02**, **A-03**); `SetupCrew` lacks idle-window re-anchoring on return (**A-14**).
  - **Mid-trial Levels 5-6 (`JudgedTrial`):** `prompt`, `writing`, `submissions`, `vote` (`ballots`, `ranking`), and `ranking` save/restore cleanly.
- **Game or session state stored outside `Game`:**
  - `mirror-view.js`: `ms.cables` (`tick`, `active`, `nextSpawn`) and `ms.pos`/`ms.dir` (**A-02**, **A-03**).
  - `game.js`: `S.av` (player look/avatar, **A-04**), `S.sop.submitted` and mutated `S.sop.pile` (**A-12**), `S.pendingL` before `newSession()` (**A-27**), `S.pos`/`S.wroom`/`S.room`/`S.visited` (Open Floor position, tracked in Q1), and prototype-only `NAMES`/`localStorage["ep.names"]` (`game.js:241-249`, replaced by Base44 login).
  - `rules/Game.js`: `this.hooks` is intentionally not saved and must be re-passed to `fromJSON`. `Game.toJSON()` throws if `rng` is unseeded (`Math.random`, **A-23**).
- **Scheduled-wake readiness of every deadline:**
  - All 12 step timers live as epoch timestamps on `Game._timer` (`rules/Game.js:76-84`) and catch up in order when `G.tick(now)` runs.
  - All Level 2 twist (`SplitBriefTrial.twistDeadline`), Level 3 Setup/Dance (`SetupCrew` deadlines, `DanceCrew` note misses), and `Attendance` (`lastActivity + idleMs`, `attendancePopupAt + popupMs`) deadlines live on `Game`'s injected clock (`this.now()`).
  - **Missing actor interface (A-06):** `Game` exposes only `G.timer.deadline`, not a combined `nextWakeAt()` covering `twistDeadline`, `MirrorTrial.nextShowtimeEventAt`, and `Attendance` popup/miss times. A Base44 actor that sleeps after ~10s and schedules alarms only from `G.timer.deadline` will wake late for the 90s Split Brief twist, Mirror Setup/Dance events, and Attendance popups/misses.
  - **Still on client timers:** Mirror Cables belt (`mirror-view.js:1122-1150`, **A-02**) and Lobby cursor sweep (`mirror-view.js:394-409`, **A-03**).

---

### Area 3: Player Privacy and Hidden Math

#### Per-Method Review (all 10 player-scoped methods)

| Method (`rules/Game.js`) | Verdict | Leaks or Hidden Math Found |
|---|---|---|
| `playerState(p)` (`1426-1457`) | Clean for owner | Returns only `p`'s own stats, draft, hearts, glitches, status, earnings, path progress, graduation checks, and ability lines. Does not expose `type` key or other players' data. |
| `roundSummary(p)` (`1458-1495`) | **Leak / Hidden Math** | Exposes `ranking[].base` and exact unrounded `ranking[].score` (`1484-1485`), revealing hidden influence (`score - base`) and exact scores (`CLAUDE.md:138`, **A-09**). Other fields (`trialPayment`, `drainOn`, `caughtOn`, `accusation`, `earnings`) are properly scoped to `p` and public caught notices. |
| `splitBriefView(p)` (`666-707`) | **Leak / Hidden Math** | Cards and `twistCard` are strictly scoped to `pl`, and `notes` are scoped to `pl`'s team. However, `ranking[]` exposes raw `base` and exact unrounded `score` (`682-683`, **A-09**), and `splitbrief-view.js:57` renders raw `boardScore` right beside rounded `shownScore` (**A-15**). |
| `judgedView(p)` (`1163-1220`) | **Leak / Hidden Math** | Other players' ballots are hidden (`myBallot` is owner-only), and submissions appear only after writing closes. However, `ranking[]` exposes `total` (Initiative-weighted vote points leaking voters' hidden Initiative), exact `score`, and tie-break `firsts` (`1213-1215`), and `judged-view.js:35-39` displays them (**A-09**). |
| `mirrorSetupView(p)` (`1002-1013`) | Clean (scope note) | Properly hides `mic.sequence` when `!isFlashing`, `sound.spikeAt`, `cables.bag`, `qa.order`, and `botHiccups`. Note: accepts any `teamOrId` as well as a player, so the Base44 actor must pass only the requesting player's id. |
| `mirrorDanceView(p)` (`1015`) | **Minor leak** | Returns `isBot: rec.isBot` (`rules/MirrorParts.js:2419`, **A-08**). Safe only if the actor passes the requesting human player's own id and strips `isBot`; never expose for another player. |
| `giftOptions(p)` (`1524-1579`) | **Leak** | `targets` only exposes public `status`/`isStuck`, and `incoming` hides `"refused"` gifts. However, `sent[]` exposes `cost: g.cost` (`1553`), which is `0` on Independent auto-refusal vs `1`-`3` on a normal decline (`rules/Gift.js:37-38`), and skips `"pending"` immediately, revealing that the teammate is Independent (**A-07**). |
| `sabotageOptions(p)` (`1496-1523`) | Clean | Exposes only `p`'s own `canRole`, `cost`, `blockedThisRound`, `caughtByTeam`, and teammates' public `status`/`isStuck` plus eligibility reason (never reveals targets' stats, Composure, or hearts). |
| `anomaliesFor(p)` (`1600-1603`) | Clean | Returns a fresh array copy of `p`'s own found anomaly ids (`"L"`, `"id"`, `"loop"`). Never exposed on `board()`. |
| `board()` (`1607-1613`) | Clean | Returns fresh plain objects containing only player `name`, `team`, `status` (priority `Stuck > Glitching > Idle > At risk > Active`), team `name`/`wins`, and past L5-6 `submissions` (`level`, `name`, `text`). Zero leaks of type, stats, hearts, gifts, Skim, or Cash Out. |

#### Additional Privacy & Hidden-Math Surface Findings

- **Raw Mirror getters and ranking methods called by screens (A-08):**
  - `G.mirrorLobbyTeam(MYTEAM)` (`rules/Game.js:995`, `rules/MirrorParts.js:64-75`) leaks `isBot` and `botConnectAt` for teammates (violating hidden bots, `CLAUDE.md:65`).
  - `G.mirrorSetupTeam(MYTEAM)` (`rules/Game.js:1001`, `rules/MirrorParts.js:1604-1660`) leaks `mic.sequence` even when hidden, `sound.spikeAt`/`spikeBoost`, `cables.bag`, `qa.order`, and `botHiccups`.
  - `G.mirrorDanceTeam(MYTEAM)` (`rules/Game.js:1014`, `rules/MirrorParts.js:2452-2455`) leaks `isBot`, `botBoosts`, `nextBotBoostAt`, and full teammate charts.
  - `G.trialRanking()` (`1016`), `G.teamStandings()` (`1051-1058`), and `G.results()` (`1625`) return live `Team`/`Player` class instances (and `botOnly` flags on Mirror rankings).
- **Hidden math on player screens (`CLAUDE.md:138`, A-09, A-15):**
  - `judged-view.js:35-39`: prints `r.score.toFixed(3)` and `1st places` (tie-break metric) on every player screen, plus `Vote points` when `showVotePoints: true` (`pages/vote-test.js:87, 102`).
  - `mirror-view.js:86-90, 213, 225, 244, 284`: prints 1-decimal exact `attention%` (Mirror's tie-break metric) for all teams and renders uninfluenced `r.base` instead of rounded `r.score`.
  - `splitbrief-view.js:57`: prints raw `Board score: X of 5` right under influenced `Score Y of 5`, exposing when light Collaboration influence shifted the score.
  - Host-only `FAC_BY_LEVEL` lines (`game.js:172-204`, e.g., line 179 Split Brief tie rule and line 190 AutoTrial influence) are explicitly allowed by `CLAUDE.md:138`.

---

### Area 4: Code vs `CLAUDE.md` Final Rules

Every mismatch found is listed neutrally with file and line; this report does not decide which side is right.

| # | `CLAUDE.md` rule | Actual code (file and line) |
|---|---|---|
| 1 | `CLAUDE.md:113`: 5 attributes listed in order `Focus, Collaboration, Initiative, Grit, Composure`. | `rules/Attributes.js:5, 66-74`, `rules/PlayerStatus.js:5`, `rules/Wallet.js:5`, `rules/Economy.js:79-94`: `KEYS` is `["focus", "initiative", "collab", "composure", "grit"]`, so `abilityLines()` on `V[9]` and `Economy.allocate` ties use the old order (while `TIE_ORDER` at `Attributes.js:6` and `game.js:26` use the canonical order) (**A-16**). |
| 2 | `CLAUDE.md:129`: Level 2 Trial name is `Split Brief`. | `rules/Round.js:10`: `LEVELS[1].trialName` is `"Prioritize against a timer"` (**A-26**). |
| 3 | `CLAUDE.md:138`: Player screens show rounded scores only; no trial tie rules, exact scores, or influence bonus appear on any player screen. | `judged-view.js:39` shows `r.score.toFixed(3)` and `1st places`; `mirror-view.js:284` shows 1-decimal exact `attention%` and uninfluenced `r.base`; `splitbrief-view.js:57` shows raw `Board score` next to rounded `Score`; `pages/vote-test.js:87, 102` shows `Vote points` and the vote formula (**A-09**, **A-15**). |
| 4 | `CLAUDE.md:139, 157`: Level 1 SOP shared team board edited by active teammates; idle players cannot take optional trial actions. | `rules/Trial.js:198-207`: `SopTrial.setSopBoard` blocks Stuck players only, not `idle` players, and does not block edits after `submitSop()`. `rules/Game.js:624, 631` tracks `"submitSop"` round-wide instead of per team (**A-01**, **A-10**). |
| 5 | `CLAUDE.md:143`: Open Floor includes team switching (teams 3-5, blocked if player sabotaged this round). | `rules/Game.js:561-575` implements `switchTeam()`, but `game.js:507` and `world-map.js:121-130` expose no team-switch UI and `game.js:224` caches `MYTEAM` without updating on switch (**A-17**). |
| 6 | `CLAUDE.md:157`: Idle players cannot act in optional trial interactions. | `rules/Game.js:966`: `mirrorMiss` does not reject `idle` players (unlike `mirrorConnect`? Note `MirrorLobby.connect` checks lobby membership, not live `p.idle`) (**A-10**). |
| 7 | `CLAUDE.md:161`: Independent gift refusal displays identically to a normal decline and never reveals type. | `rules/Gift.js:37-38` sets `cost: 0` on Independent refusal and `rules/Game.js:1548-1558` sends `cost: 0` with immediate `"declined"` status in `giftOptions(p).sent` (**A-07**). |
| 8 | `CLAUDE.md:186`: Idle humans in Level 3 Mirror follow bot auto-pilot timings from `rules/mirrorData.js` (3-15s lobby connect). | `rules/bots.js:279-287`: mid-lobby idle humans auto-connect at `elapsed = 0s` (`L3 Step 10 #6`, **A-20**). |
| 9 | `CLAUDE.md:49, 182-186`: Rules own every deadline and outcome-affecting randomness in Level 3; `Game.toJSON`/`fromJSON` captures mid-trial state. | `mirror-view.js:115, 145-152, 343-361, 394-409, 591-601, 887-936, 1122-1150`: Lobby cursor sweep/judging and Cables belt clock/judging still run unsaved in `mirror-view.js` (**A-02**, **A-03**). |
| 10 | `CLAUDE.md:56-57` (queued screen fixes): Points screen shows one number per stat with bonus applied; each type briefing shows its real drawback. | `game.js:485-488` still shows base spend + separate `final X`; `game.js:29-32` (`TYPE_TEXT`) and `pixel-art.js:127-141` (`DIALOGS`) still omit the real type drawbacks (queued, **A-26**). |
| 11 | `CLAUDE.md:65`: Multiplayer lobby starts via Host Start or 120s timer from first join, with hidden bots (no bot tag/leak). | `game.js:255` starts the clock on `Start Level` click (`A-05`, item b); `mirrorLobbyTeam` / `mirrorDanceTeam` / `mirrorDanceView` expose `isBot` (**A-08**). |
| 12 | `CLAUDE.md:184-186` / Level 3 visuals & host script: visual hit frame matches rhythm/cable hit windows; excluded idle players get coherent status; `facLines` handles Mirror phases cleanly. | `rules/MirrorParts.js:2395` + `mirror-dance-view.js:68` + `styles.css:409-413` place exact-hit time at `left: 0%` (**A-18**); `mirror-view.js:305, 449, 810` shows contradictory `"You are Active and not in the lobby..."` (**A-19**); `mirror-view.js:114` resets `m.dance` instead of `m.danceUI` (**A-21**); `game.js:208` returns lobby+showtime combined when `phase === "failed"` (**A-26**). |

---

### Area 5: `rules/` Scan (Step 13 Gap)

Scanned all 24 files in `rules/*.js` (excluding `rules/rules.bundle.js`) with case-sensitive `Select-String` for: `Math.random`, `Date.now`, `new Date`, `document`, `window`, `setTimeout`, `setInterval`.

- Zero code hits for `new Date`, `document`, `window`, `setTimeout`, `setInterval`.
- Comment-only mentions of `Math.random` at `rules/Rng.js:3`, `rules/Trial.js:134`, `rules/bots.js:18` (harmless documentation).

| File and line | Pattern | Code | Verdict | One-line reason |
|---|---|---|---|---|
| `rules/Game.js:92` | `Math.random` | `rng = Math.random` | **Problem** | Defaulting to `Math.random` creates an unsaveable `Game` (`toJSON()` throws) if a caller omits `rng`. |
| `rules/Game.js:92` | `Date.now` | `clock = () => Date.now()` | **Allowed** | Default live wall-clock injector; tests and actors pass a controlled `clock` function. |
| `rules/Game.js:1402` | `Date.now` | `clock = () => Date.now()` | **Allowed** | Default live wall-clock injector on `Game.fromJSON`; overridden by tests and actor. |
| `rules/Player.js:109` | `Date.now` | `markActive(now = Date.now())` | **Problem** | Direct `Date.now()` default bypasses `Game`'s injected clock if called without `now`. |
| `rules/Rng.js:21` | `Date.now` & `Math.random` | `((Date.now() ^ ((Math.random() * 0x100000000) >>> 0)) >>> 0)` | **Allowed** | One-time initial seed generator (`Rng.randomSeed()`); all gameplay draws use the saved seeded `Rng`. |
| `rules/Timer.js:6` | `Date.now` | `clock = () => Date.now()` | **Allowed** | Default live wall-clock injector on `Timer`; `Game` always forwards its own injected `clock`. |
| `rules/Trial.js:20` | `Math.random` | `constructor(rng = Math.random)` | **Problem** | Base `Trial` allows unseeded `SopTrial`/`AutoTrial`/`JudgedTrial` instances if `rng` is omitted. |
| `rules/Vote.js:11` | `Math.random` | `constructor(teams, rng = Math.random, ...)` | **Problem** | Allows unseeded vote tie-breaks if constructed outside `Game` without a seeded `Rng`. |
| `rules/bots.js:76` | `Math.random` | `soloGame({ ..., rng = Math.random, ... })` | **Problem** | Creates an unsaveable solo game if caller omits `rng`. |

---

### Area 6: Hannah Readiness (Levels 4, 5, 6)

#### 1. Shared-file boundaries in `CLAUDE.md:13-17` vs real codebase

`CLAUDE.md:15` currently allows Hannah to edit only:
`rules/Game.js` (one-line pass-throughs), `rules/index.js` (exports), `rules/Round.js` (`LEVELS` entries), `rules/Trial.js` (new `Trial` subclass registration only), and `game.js` (show her screen).

Real touchpoints required to add Level 4 (and replace/extend Levels 5-6):

| File | Listed in `CLAUDE.md:15`? | Actual touchpoints needed |
|---|---|---|
| `rules/Game.js` | Listed as "one-line pass-throughs" only | Actually has **9** trial-dispatch sites: `TIMER_SECONDS` (`76-84`), `_makeTimer` `onStart`/`onClose` (`115-128`), `timerName()` (`143-155`), `tick()` (`188-213`), `_closeTimerPhase()` (`216-231`), `advance()` (`344-353`), `setTrialForTest()` (`358-370`), `jumpToLevel()` (`437-489`), `trialResultView()` (`1017-1049`), plus new view/action methods. |
| `rules/index.js` | Listed | Matches real code (single-line imports/exports + `EP` namespace object). |
| `rules/Round.js` | Listed (`LEVELS`) | Matches real code (`LEVELS` entries for `trialName`, `trialKind`, `attr`, `cost`). |
| `rules/Trial.js` | Listed (registration only) | Matches if new trial classes live in `rules/Level4Parts.js` (etc.) and register in `Trial.forRound` and `Trial.fromJSON`, though Level 3 (`MirrorTrial`) itself currently lives inside `rules/Trial.js`. |
| `game.js` | Listed ("show her screen") | Actually requires: `TRIAL_SCREENS` (`575-581`), `TIMER_LABELS` (`376-380`), `BRIEFINGS`/`LEVEL_HINTS`/`FAC_BY_LEVEL` (`63-204`), `END_SCREENS` (`680-688`), and **3 hardcoded Level 4 locks** (`339`, `358`, `683`). |
| `index.html` | **Omitted** | Must add `<script src="level4-view.js">` (etc.) before `game.js` (`index.html:34-44`). |
| `styles.css` | **Omitted** | Must add CSS for new Level 4-6 trial screens (as Level 2 `.sb-*` and Level 3 `.mirror-*` did). |
| `rules/bots.js` | **Omitted** | Must add bot behavior and `Bots.hooks` calls for new trials so solo play and `jumpToLevel` work. |
| `tools/baseline.js` | **Omitted** | Must register new `Tests/check_level4_*.js` scripts in `TESTS` / `NO_SNAPSHOT`. |
| `docs/class-diagram.md` | **Omitted** | Required by `CLAUDE.md:35` whenever any class in `rules/` changes. |
| `Tests/check_save.js` & `Tests/check_screens.js` | **Omitted** | Must add mid-trial save/load coverage for Levels 4-6 and update screen tests when Level 4 unlocks. |

#### 2. Shared rule changes Levels 4-6 will likely need (listed only; not designed)

- **Multi-phase or mid-trial timers inside `Game`:** If Level 4, 5, or 6 uses sub-phases (like Mirror lobby/reveal/showtime) or mid-trial events (like Split Brief twist), `Game` will need generalized trial timer/tick/wake hooks instead of more hardcoded `instanceof` branches in `Game.js`.
- **Level 4 Geek Week replacing `AutoTrial`:** Switching Level 4 from untimed `AutoTrial` to a real timed trial changes `Round.LEVELS[3].trialKind`, `TIMER_SECONDS`, `jumpToLevel(5+)` fast-forward, and `Tests/baseline.json` (plus `pages/vote-test.js`, which fast-forwards Levels 1-4).
- **Level 5-6 Bots and Prompts:** `CLAUDE.md:65` specifies 15 pre-written bot answers per prompt for Levels 5-6 (replacing `"Bot answer"` in `rules/bots.js`), and if Level 5 or 6 adds interactive gameplay before/alongside `JudgedTrial`, `JudgedTrial` and `pages/vote-test.js` will be affected.
- **Hidden math & player views:** Any new trial results screen must use `Game.trialResultView` (rounded scores only) and `Game` player-scoped views, never direct `G.round.trial` or `ME`/`MYTEAM` reads.

#### 3. Simplest way to cover the guard gap (not built)

- **Choose a small automated test** (`Tests/check_rules_guard.js`, registered as `NO_SNAPSHOT` in `tools/baseline.js` so `npm test` runs it automatically on every commit):
  - Scans every `rules/*.js` (excluding `rules.bundle.js`) for forbidden tokens (`Math.random`, `Date.now`, `new Date`, `document`, `window`, `setTimeout`, `setInterval` with a tiny exact allowlist for `Rng.randomSeed` and the 3 default clock injectors) plus the single-line `import`/`export` rule required by `tools/build-rules.js`.
  - Scans every new `*-view.js` automatically (glob instead of hardcoded list in `Tests/check_screen_rules.js`) so Hannah's new `level4-view.js`..`level6-view.js` are guarded on day one without editing the test list.
  - Pair it with a **1-line PR checklist command** (`git diff --name-only screen-state-cleanup...HEAD`) for Hannah's shared-file boundaries, since branch diff boundaries belong at PR review rather than inside unit tests.

---

### Area 7: Test Gaps

| # | Missing test | Affects Multiplayer? | Affects Save/Load? | Notes |
|---:|---|---|---|---|
| 1 | Multi-human same-team interaction tests (2+ humans editing Level 1 SOP, submitting SOP independently, editing/locking Level 2 Split Brief, sharing Level 3 Setup/Dance, human-to-human open/pending/declined/expired gifts) | **Yes** | **Yes** | All current tests use 1 human + bots or all-bot teams; would have immediately caught **A-01** (`submitSop` round-wide lock) and **A-04** (`TEAM.find` crash). |
| 2 | `Tests/check_save.js` driving real `Game` player APIs (`splitBriefPostNote`, `splitBriefSetBoard`, `splitBriefLockIn`, `submitSop`, `skipAccusation`, `answerGiftByIndex`, `mirrorSoundAdjust`, `mirrorDancePress`) across mid-trial reloads | **Yes** | **Yes** | Currently `check_save.js:77-95, 115-149` calls direct `SplitBriefTrial` methods and legacy `mirrorSoundHeld`/`mirrorDanceHit` wrappers instead of live player methods. |
| 3 | Sleeping Base44 actor wake test (`toJSON` -> sleep past `twistDeadline`, Mirror Setup/Dance deadlines, and `Attendance` popup/miss -> `fromJSON` -> `tick()` + `pollAttendance()`) | **Yes** | **Yes** | No test verifies combined `tick()` + `pollAttendance()` catch-up after an actor wakes from sleep (**A-06**). |
| 4 | Player privacy and hidden-math contract test (asserting `playerState`, `roundSummary`, `splitBriefView`, `judgedView`, `mirrorSetupView`, `mirrorDanceView`, `giftOptions`, `sabotageOptions`, `board` never contain `isBot`, other players' stats/types/hearts, `cost: 0` on Independent refusal, raw `base`, unrounded `score`, `total`, or `firsts`) | **Yes** | No | Would have immediately caught **A-07**, **A-08**, **A-09**, and **A-15**. |
| 5 | Idle-player refusal tests across all actions (`setSopBoard`, `submitSop`, `mirrorMiss`, `mirrorConnect`, Setup/Dance actions, `skipAccusation`, `castVote`, `switchTeam`) and SetupCrew idle-return catch-up | **Yes** | **Yes** | Would have caught **A-10** and **A-14**. |
| 6 | Duplicate display names and `switchTeam()` UI/session tests (gifts, sabotage, accusations, rosters, and `world-map.js` after team switch or non-solo names) | **Yes** | **Yes** | Would have caught **A-04** and **A-11**. |
| 7 | Unit tests in fast `npm test` for Step 6-12 `Game` APIs (`checkEmail`, `checkJoinCode`, `anomaliesFor`/`recordAnomaly`, `playerState`, `roundSummary`, `giftOptions`, `sabotageOptions`, `answerGiftByIndex`, `trialResultView`, `teamStandings`, `judgedView`, `castVote`, `skipAccusation`, `submitSop`) | **Yes** | **Yes** | Currently covered mostly in jsdom `test:screens`, not in fast `rules/` unit tests (`check_steps.js`/`check_save.js`). |
| 8 | `rules/*.js` guard test (no `Math.random`/`Date.now`/DOM/timers, single-line `import`/`export`, auto-discovering new `*-view.js` files) | **Yes** | **Yes** | Covers the Step 13 gap (**A-23**, Area 6). |
| 9 | Level 3 visual hit-frame alignment test (checking rendered `leftPct` at `progress = 1` falls inside `.hitframe` geometry) and excluded-idle screen copy test | No | No | Would have caught **A-18** and **A-19**. |

---

### Area 8: Carry-Forward Details (Items l, n, o, p)

#### Item l: Git exit code 1 on first try in Windows PowerShell 5.1

- **Read-only checks performed:**
  - `git config --list --show-origin` shows `core.autocrlf=true` in `C:/Program Files/Git/etc/gitconfig` (repo `.gitattributes` does not exist).
  - `Get-ChildItem .git\hooks` shows only `.sample` files (no active Git hooks).
  - PowerShell version is `5.1.26100.9818` (`$ErrorActionPreference = Continue` in interactive shell).
- **Likely cause:**
  1. Git writes normal non-error output to `stderr`: `git add` emits `warning: in the working copy of '...', LF will be replaced by CRLF` under `core.autocrlf=true`, and `git push` always writes remote progress/branch updates (`To https://...`) to `stderr`.
  2. In Windows PowerShell 5.1, any native command writing to `stderr` produces PowerShell `ErrorRecord` objects; under `$ErrorActionPreference = 'Stop'` (or any tool wrapper that treats non-empty `stderr` / `$? = $false` as failure), PowerShell aborts with exit code 1 even when Git's own `$LASTEXITCODE` is `0`. On retry, `git add` has already normalized the index entry (no new warning) and `git push` prints `"Everything up-to-date"` (or succeeds cleanly once the warning/lock clears). A secondary transient cause for `add`/`commit` in VS Code on Windows is `.git/index.lock` held briefly by VS Code's background Git auto-fetch.
- **One-line fix:** Keep `$ErrorActionPreference = 'Continue'` and judge Git success strictly by `$LASTEXITCODE` (or pass `-q` / set `$env:GIT_REDIRECT_STDERR = '2>&1'` / use PowerShell 7).

#### Item n: Code touched by Open Questions Q1, Q9, Q11 (questions not answered)

- **Q1 (Open Floor position as game state or pure UI):**
  - `game.js:214` (`S.pos`, `S.visited`, `S.wroom`, `S.room`), `game.js:852` (Replay preserves `S.visited`).
  - `world-map.js:23-39` (`walkable`, `blocked`, `canStand`, `roomAt`), `95` (`#wme`), `107` (`#mmme`), `113` (`#wroom`), `145-179` (`initWorld` `rAF` loop, collision, room transitions, ghost proximity), `194-196` (`keydown`/`keyup`, `doUse`).
  - If promoted to game state: `rules/Player.js`, `rules/Game.js`, `Tests/check_save.js`, `Tests/check_screens.js`, `docs/class-diagram.md`.
- **Q9 (Open Floor tap speed, Bug 3):**
  - `world-map.js:136` (`TAP_MS = 110`).
  - `world-map.js:156-163` (`frame(t)` reading `held()` and applying `sp = 300`).
  - `world-map.js:195` (`keydown` setting `tap[k] = performance.now() + TAP_MS` vs `rAF` timestamp `t`).
- **Q11 (Owner of one-click untimed buttons in multiplayer):**
  - `game.js:255-261` (`startLevel`, `startNextLevel`), `327-331, 341, 354-358` (`fwd`/`goForward` for Intermission, Briefing, AutoTrial, All-hands, Next Level), `549` (`#runAuto`), `873-876` (`payCost` -> `G.endTrial()`).
  - `pages/vote-test.js:43-49` (`openJudgedTrial`), `104-108` (`onEndNow`, `onResultNext`).
  - `rules/Game.js:137` (`start`), `214` (`closeTimer`), `336` (`advance`), `372` (`startNextRound`), `1222` (`runTrial`), `1235` (`endTrial`), `1617` (`results`).
  - `Tests/check_steps.js`, `Tests/check_screens.js`.

#### Item o: Pure UI Bugs Still Open (2, 3, 8, 9)

All 4 bugs are confirmed **still present** and **still pure UI** (no rule or save/load state involved):
- **Bug 2 (note counter):** `splitbrief-view.js:95, 172-181`. `#splitNoteIn` has `maxlength="80"` and label `Post a note (max 80 chars)`, with no live `N / 80` character counter element or update in the `input` listener.
- **Bug 3 (tap speed):** `world-map.js:136, 156-163, 195`. `TAP_MS = 110` moves ~33px per tap at `300 px/s` across a 2300px map, and `keydown` writes `performance.now() + TAP_MS` while `held()` compares against `rAF` `t`.
- **Bug 8 (button wrap):** `splitbrief-view.js:81`; `styles.css:31, 352`. `.sb-slot` and `.row` both use `flex-wrap: wrap`, so longer task names wrap the 3 Up/Down/Remove buttons inconsistently between slots 1 and 2.
- **Bug 9 (footer after Lock In):** `splitbrief-view.js:297`; `game.js:369, 372`. `SplitBriefView.screen` always returns `waitHint: "Wait for the Split Brief timer to finish"` even when `locked === true`.

#### Item p: Git Remotes (`git remote -v`)

Confirmed exact output of `git remote -v`:
```text
backup  https://github.com/bcoppage-IC/Exit_ProtocoL.git (fetch)
backup  https://github.com/bcoppage-IC/Exit_ProtocoL.git (push)
origin  https://github.com/myiamack/exit-protocol.git (fetch)
origin  https://github.com/myiamack/exit-protocol.git (push)
origin  https://github.com/bcoppage-IC/Exit_ProtocoL.git (push)
```
`origin` already pushes to both `myiamack/exit-protocol.git` and `bcoppage-IC/Exit_ProtocoL.git`, so running `git push backup` right after `git push origin` pushes to an already-updated remote and is a no-op. No remotes were changed.

---

### Area 9: Size and Dead Code

#### Line Counts

- `rules/Game.js`: **1,666 lines** (up from 1,041 lines before Steps 3-12).
- `game.js`: **924 lines**.

#### Split Plans (not executed)

**`rules/Game.js` (1,666 lines -> core ~750-800 lines):**
1. **`rules/GameViews.js` (~350 lines):** Read-only player/public view projections (`playerState`, `roundSummary`, `splitBriefView`, `judgedView`, `trialResultView`, `sabotageOptions`, `giftOptions`, `teamStandings`, `teamTrialResults`, `board`, `statTieOrderLabel`, `roundDisplayScore`).
2. **`rules/DevJump.js` (~145 lines):** Prototype-only `jumpToLevel()` fast-forward runner (`rules/Game.js:391-531`).
3. **`rules/MirrorAdapter.js` or generic `trialAction`/`trialView` dispatch (~320 lines):** Moves the 30+ Mirror wrappers and `_advanceMirrorShowtime` / `_mirrorCall` (`rules/Game.js:708-1074`) out of `Game.js` so Levels 4-6 do not repeat this growth pattern.
4. **`rules/LobbyRules.js` or static helper (~45 lines):** `checkEmail`, `checkJoinCode`, `quietHeartBuff`, and `switchTeam` validation helpers.

**`game.js` (924 lines -> core ~470 lines):**
1. **`level-copy.js` (~220 lines):** Pure static text/display tables (`TYPE_TEXT`, `FAC`, `MEMOS`, `BRIEFINGS`, `LEVEL_HINTS`, `FAC_BY_LEVEL`, `CLUES`, `ADMIN_LINES`, `ROLE_BRIEF`, `ghostHint`, `teaHint`, `facLines`).
2. **`arrival-view.js` (~85 lines):** Elevator cutscene SVG, `adminFig`, `leadInDoor`, `vnBox`, `roleBrief`, `runElevator`, `skipArrival`, `arrivalAdvance` (`game.js:719-784`).
3. **`end-screens.js` (~80 lines):** `nextLevelCard`, `finalResultsScreen`, `milestoneCompleteScreen`, `END_SCREENS` (`game.js:639-688`).
4. **`sop-view.js` (~45 lines):** `trialSopScreen`, `sopPress`, `checkSop`, `sopPile` (`game.js:515-533, 858-872`), matching `splitbrief-view.js`, `mirror-view.js`, and `judged-view.js`.
5. **`code-rain.js` (~25 lines):** Background canvas matrix rain (`game.js:1-23`).

#### Dead Code List

**Screen files, HTML, and CSS (A-28):**
- `game.js:40-41`: `SOP` and `DECOY` constants (never referenced after Step 12 moved SOP checking to `Game.trialResultView`).
- `world-map.js:6`: `GSPOTS` constant (unused leftover from the old static map).
- `world-map.js:198-199`: `addEventListener("click", ...)` handler for `.gwalk` elements and `#whisper` popup (no `.gwalk` elements are rendered anywhere in the DOM).
- `index.html:26`: `<div class="whisper" id="whisper" hidden></div>` (only ever hidden on `Escape` at `game.js:786` and `devJump` at `game.js:911`, never opened).
- `mirror-view.js:114`: `m.dance = null;` (obsolete key; `mirror-dance-view.js` uses `state.danceUI`, **A-21**).
- `styles.css:76`: `.flag.OK` (never used; statuses are `Active`, `risk`, `Glitching`, `Stuck`, `Idle`).
- `styles.css:111`: `.field .lab` (never referenced in HTML or JS).
- `styles.css:132`: `.small .badge` (never referenced in HTML or JS).
- `styles.css:276`: `.gwalk` (leftover static-map ghost class).
- `styles.css:280-282`: `.whisper`, `.whisper b`, `.whisper p` (leftover static-map whisper box styles).
- `styles.css:438`: `.mfile.ok` (never toggled by `mirror-view.js`).

**`rules/` files (A-29):**
- `rules/Attributes.js:7`: `GIFT_TIE_ORDER` (zero callers; alias of `TIE_ORDER`).
- `rules/Attributes.js:49-50`: `highestKey()` and `lowestKey()` (zero callers; `highest()` and `lowest()` are used instead).
- `rules/Player.js:95-96`: `highestKey()` and `lowestKey()` pass-throughs (zero callers).
- `rules/Player.js:113` & `rules/PlayerStatus.js:34-39`: `Player.flag()` / `PlayerStatus.flag()` (zero screen callers; kept only by older unit tests; screens use `boardStatus()`).
- `rules/Game.js:585-594` & `rules/Trial.js:188-192`: `Game.setSopScore` / `Game.scoreSop` / `SopTrial.scoreSop` (zero screen callers; `scoreSop` has zero callers anywhere in code or tests).
- `rules/Trial.js:1016, 1026`: `MirrorTrial.setupState()` and `MirrorTrial.danceState()` (zero callers).
- `rules/Game.js:971-972, 974-975, 978, 980, 983-985`: 9 legacy pre-Step-3b/4 `Game.mirror*` pass-throughs (`mirrorNextSoundSpike`, `mirrorNextSoundJitter`, `mirrorSoundHeld`, `mirrorSoundFeedback`, `mirrorReshuffleDeck`, `mirrorTimeoutQa`, `mirrorDanceHit`, `mirrorDanceMiss`, `mirrorDanceStray`) that have zero screen callers and remain only for older unit tests.
- `rules/mirrorData.js:65, 67, 159, 197, 200-201`: 6 unused data entries (`timers.lobbyTicks`, `timers.revealTicks`, `dance.choreoLength`, `flavor.statusMessages.lobbyAllIn`, `doorsPartial`, `doorsAllIn`).
