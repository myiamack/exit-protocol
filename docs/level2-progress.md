# Level 2 Build Plan (Split Brief)

After each step: `npm run build`, then `npm test`. Run `npm run test:screens` only for steps that touch screen code (`game.js`, `world-map.js`, `pixel-art.js`, `board.js`, `index.html`, `styles.css`). Update this file at the end of every step.

## Steps

### Step 0: Setup (Effort: Low) — DONE
- **Goal:** Create `level2-split-brief` branch, add Level 2 work rules, Split Brief rules, and per-level clue/briefing/end-screen specs to `CLAUDE.md`, create this plan, add `docs/Game_Index.md` entries, and create `AGENTS.md`.
- **Done when:** `npm run build` and `npm test` pass against the current baseline without saving a new baseline.
- **Tests:** `npm run build`, `npm test`
- **Files changed:** `CLAUDE.md`, `docs/level2-progress.md`, `docs/Game_Index.md`, `AGENTS.md`, `docs/game-report.md` (created prior to Step 0).
- **Test results:** `npm run build` and `npm test` (8/8 checks passed against existing baseline).
- **Open issues:** `docs/design/Mock_Interview_Question_Bank.md` has pre-existing uncommitted partner edits in the working tree (untouched).

### Step 1: Scenario data (Effort: Low) — DONE
- **Goal:** Create one data file in `rules/` with the 5 cards, 4 tasks, twist card, pre/post answer keys, and bot notes, plus a data-shape test. No behavior change.
- **Done when:** Data file exports clean plain data and the data-shape test + baseline tests pass.
- **Tests:** `npm run build`, `npm test`, and the new data-shape test.
- **Files changed:** `rules/scenarios.js`, `rules/index.js`, `rules/rules.bundle.js`, `Tests/check_scenarios.js`, `Tests/baseline/check_scenarios.txt`, `tools/baseline.js`, `docs/level2-progress.md`.
- **Test results:** `npm run build` (21 modules) and `npm test` (9/9 checks passed: `check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`; 9/9 assertions in `check_scenarios.js`).
- **Open issues:** None.

### Step 2: SplitBriefTrial class (Effort: High) — DONE
- **Goal:** New `Trial` subclass with round-robin dealing, private cards, team notes (80 chars, 3 per player, named), 2-slot board, final Lock In, twist card, scoring (0-5), bot-only random 0-5, ranking ties (score -> earliest lock-in -> random), and `toJSON`/`fromJSON`. Not wired into `Game` yet.
- **Done when:** Unit tests cover dealing, notes cap/length, board edits, Lock In, twist, scoring, tie-breaking, and save/load.
- **Tests:** `npm run build`, `npm test`, and new unit tests.
- **Files changed:** `rules/Trial.js`, `rules/rules.bundle.js`, `Tests/check_split_brief.js`, `Tests/baseline/check_split_brief.txt`, `tools/baseline.js`, `docs/level2-progress.md`.
- **Test results:** `npm run build` (21 modules) and `npm test` (10/10 checks passed: `check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`; 47/47 assertions in `check_split_brief.js`).
- **Open issues:** None.

### Step 3: Timer and twist timing (Effort: Medium) — DONE
- **Goal:** 180s trial timer, twist at 90s, early close when all teams lock in, deadlines saved per the save/load rule.
- **Done when:** Timer and mid-trial save/load tests pass, including caught-up twist and trial close deadlines.
- **Tests:** `npm run build`, `npm test` (including `check_save`).
- **Files changed:** `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `Tests/check_split_timing.js`, `Tests/baseline/check_split_timing.txt`, `Tests/check_save.js`, `tools/baseline.js`, `docs/level2-progress.md`.
- **Test results:** `npm run build` (21 modules) and `npm test` (11/11 checks passed: `check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`; 19/19 assertions in `check_split_timing.js`).
- **Open issues:** None.

### Step 4: Bots (Effort: Medium) — DONE
- **Goal:** Connect bots via `Game` hooks only (no `Game`-to-`Bots` link): post card notes at random times in the first 30s, post twist note within 10s, never edit the board or lock in.
- **Done when:** Bot behavior tests verify timing, note accuracy, and 3-note cap.
- **Tests:** `npm run build`, `npm test`.
- **Files changed:** `rules/Game.js`, `rules/bots.js`, `rules/rules.bundle.js`, `Tests/check_split_bots.js`, `Tests/baseline/check_split_bots.txt`, `tools/baseline.js`, `docs/level2-progress.md`.
- **Test results:** `npm run build` (21 modules) and `npm test` (12/12 checks passed: `check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`; 13/13 assertions in `check_split_bots.js`).
- **Open issues:** None.

### Step 5: Wire into Game (Effort: Medium) — DONE
- **Goal:** Level 2 uses `SplitBriefTrial` instead of `AutoTrial`. Run fixed-seed tests, explain the baseline change, then save the new baseline (`npm run baseline`).
- **Done when:** All rule tests pass and the new baseline is explained and saved.
- **Tests:** `npm run build`, `npm test` (after `npm run baseline`).
- **Files changed:** `rules/bots.js`, `rules/Round.js`, `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `Tests/check_split_bots.js`, `Tests/check_save.js`, `Tests/baseline/check_rules.txt`, `Tests/baseline/check_steps.txt`, `Tests/baseline/check_teams.txt`, `Tests/baseline/check_balance.txt`, `Tests/baseline/check_cheese.txt`, `Tests/baseline/check_save.txt`, `docs/level2-progress.md`.
- **Test results:** Step 0.5 fixes passed `npm run build` (21 modules) and `npm test` (12/12 checks, zero baseline changes). After wiring Level 2: temporary Step 5 checks (`output.txt`, `full_bot_game.js`, and `level1_snapshot.js` were temporary Step 5 checks and were not kept) confirmed Level 1 end-state snapshots (seeds 1, 2, 3, 7, 11) matched identically, pre-baseline diffs verified Level 2+ changes only, new baselines saved (`npm run baseline`), `npm test` passed 12/12 (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save` [5769 saves, 54 deadline cases, `splitBrief` timer covered], `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`), and a fixed-seed full 7-level bot game (seed 42) run twice matched identically.
- **Open issues:** In `check_cheese`, the 16-player Contrarian switcher diff shifted from `+2.7 ok` to `+3.5 CHEESE?` due to Level 2 RNG/score range (`0-5` vs `0-7`) variance around the `3.0` threshold (`CLAUDE.md` notes the switcher edge is accepted). Screen and `game.js` changes remain deferred to Step 6.

### Step 6a: Browser continues past Level 1 (Effort: Medium) — DONE
- **Goal:** Add per-level briefing, host script (`FAC`), and ghost/tea hint table; update `V[9]` to continue to Level 2; add a placeholder trial screen for non-SOP trials; remove the Level-1-only blockers listed in `docs/game-report.md` section 5.
- **Done when:** Player can finish Level 1 and enter Level 2 in the browser.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.
- **Files changed:** `game.js`, `world-map.js`, `styles.css`, `Tests/check_screens.js`, `docs/level2-progress.md` (no `rules/` or `Tests/baseline/` files changed).
- **Test results:** `npm run build` (21 modules, `rules/rules.bundle.js` unchanged), `npm test` (12/12 checks passed with zero baseline diffs), and `npm run test:screens` (43 passed, 0 failed, zero console errors across Level 1, replay, Contrarian Breakout Room check, and a full 7-level run through Final Results).
- **Open issues:** None. Level 2 uses the Step 6a placeholder trial screen until Step 6b, and the Level 2 end screen continues straight to Level 3 until the Sprint 1 Complete screen in Step 6c.

- **Cleanup (before Step 6b) — DONE:** Removed Level 1 hint fallbacks in `world-map.js` (`GHOSTS[].line`, `hightea`, `ghostPanel`, static click), unused static office map (`ROOMS`, `SPOTS`, `furniture`, `officeMap`, `teamMarkers`) and its `.room.click` handler/CSS, unused CSS (`.flag.Glitched`, `ol.flow`, `.dash`, `.popup`), dead `game.js` helpers (`sopDone`, `total`, `ATT`, stale comment, duplicate SOP result & `V[9]` point-buy markup), and dead expressions in `pixel-art.js`. Extracted the shared Level 5-6 writing/voting/result screen into `judged-view.js`, wired `game.js` (`TRIAL_SCREENS.judged`) and `pages/vote-test.js` to use it, loaded `judged-view.js` in `index.html` and `pages/vote-test.html`, and added `pages/vote-test.html` coverage to `Tests/check_screens.js`. `npm run build`, `npm test` (12/12), and `npm run test:screens` (46/46, 0 console errors) all pass.

### Step 6b: Split Brief trial screen (Effort: High) — DONE
- **Goal:** Build the Level 2 Split Brief trial screen: private cards, team notes feed with "notes left" counter and poster names, 2-slot backlog board, Lock In button, twist popup, and 180s timer.
- **Done when:** Human player can view cards, post notes, edit the board, receive the twist popup at 90s, and Lock In.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.
- **Files changed:** `splitbrief-view.js`, `index.html`, `styles.css`, `game.js`, `Tests/check_screens.js`, `docs/level2-progress.md` (no `rules/` or `Tests/baseline/` files changed).
- **Test results:** `npm run build` (21 modules, `rules/rules.bundle.js` unchanged), `npm test` (12/12 checks passed with zero baseline diffs), and `npm run test:screens` (58 passed, 0 failed, 0 console errors: covers Level 1, replay, Contrarian Breakout Room, Split Brief note posting/counter, board Add/Up/Down/Remove, pre-twist Lock In warning, 90s twist popup for ghosted player only, mid-trial save/reload restore, Lock In freeze, timer close/score/rank, full 7-level run to Final Results, and `pages/vote-test.html`).
- **Open issues:** None. Level 2 still continues to Level 3 after Stats Update until the Sprint 1 Complete screen is built in Step 6c.

- **Split Brief label & card-order shuffle (after Step 6b) — DONE:** In `rules/Trial.js` (`SplitBriefTrial`), `deal()` now uses `game.rng` to shuffle task letters (`#letterMap`: original A–D -> shuffled A–D) and brief card deal order (`#cardOrder`), remapping `tasks`, `preTwistAnswer`, `postTwistAnswer`, `cardsFor()`, and `twistFor()` (including `botNote`s) without modifying `rules/scenarios.js`. Saved `letterMap` and `cardOrder` in `toJSON`/`fromJSON`. Updated `splitbrief-view.js` to read `trial.tasks` and `trial.postTwistAnswer`. Added shuffle, scoring, save/load, and bot-note tests in `Tests/check_split_brief.js` (55/55 passing). Updated `CLAUDE.md` and saved new Level 2+ baselines (`npm run baseline`, Level 1 output verified unchanged).
  - **Files changed:** `rules/Trial.js`, `rules/rules.bundle.js`, `splitbrief-view.js`, `Tests/check_split_brief.js`, `Tests/baseline/check_*.txt` (8 updated baseline files), `CLAUDE.md`, `docs/level2-progress.md`.
  - **Test results:** `npm run build` (21 modules), `npm test` (12/12 checks passed after `npm run baseline`), `npm run test:screens` (58 passed, 0 failed, 0 console errors).

### Step 6c: Sprint 1 Complete screen (Effort: Medium) — TODO
- **Goal:** Build the "Sprint 1 Complete" end screen after Level 2's Stats Update as specified in `CLAUDE.md`.
- **Done when:** Screen shows Level 1 & 2 results, hearts, glitches, status, 5 attributes, team wins, ranked teams, and "Level 3 locked" with Replay/Sign-out (no work styles or secret path).
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.

### Step 7: Screen tests (Effort: Low) — TODO
- **Goal:** Extend `Tests/check_screens.js` to cover Level 1 to Level 2 flow, twist popup, notes cap, and Sprint 1 Complete screen.
- **Done when:** `npm run test:screens` passes all assertions with zero console errors.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.

### Step 8: Docs (Effort: Low) — TODO
- **Goal:** Update `CLAUDE.md`, `docs/class-diagram.md`, `README.md`, and `docs/Game_Index.md` to match the final Level 2 code.
- **Done when:** All docs accurately reflect the implemented classes, files, and rules.
- **Tests:** `npm run build`, `npm test`.

### Step 9: Manual playtest (Ben) — TODO
- **Goal:** Playtest in browser: cards show privately, notes post with cap, twist fires once at 90s, scoring matches key, and Sprint 1 Complete screen is accurate.
- **Done when:** Ben confirms all playtest checks pass.
- **Tests:** Manual browser playtest.
