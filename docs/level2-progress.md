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

### Step 1: Scenario data (Effort: Low) — TODO
- **Goal:** Create one data file in `rules/` with the 5 cards, 4 tasks, twist card, pre/post answer keys, and bot notes, plus a data-shape test. No behavior change.
- **Done when:** Data file exports clean plain data and the data-shape test + baseline tests pass.
- **Tests:** `npm run build`, `npm test`, and the new data-shape test.

### Step 2: SplitBriefTrial class (Effort: High) — TODO
- **Goal:** New `Trial` subclass with round-robin dealing, private cards, team notes (80 chars, 3 per player, named), 2-slot board, final Lock In, twist card, scoring (0-5), bot-only random 0-5, ranking ties (score -> earliest lock-in -> random), and `toJSON`/`fromJSON`. Not wired into `Game` yet.
- **Done when:** Unit tests cover dealing, notes cap/length, board edits, Lock In, twist, scoring, tie-breaking, and save/load.
- **Tests:** `npm run build`, `npm test`, and new unit tests.

### Step 3: Timer and twist timing (Effort: Medium) — TODO
- **Goal:** 180s trial timer, twist at 90s, early close when all teams lock in, deadlines saved per the save/load rule.
- **Done when:** Timer and mid-trial save/load tests pass, including caught-up twist and trial close deadlines.
- **Tests:** `npm run build`, `npm test` (including `check_save`).

### Step 4: Bots (Effort: Medium) — TODO
- **Goal:** Connect bots via `Game` hooks only (no `Game`-to-`Bots` link): post card notes at random times in the first 30s, post twist note within 10s, never edit the board or lock in.
- **Done when:** Bot behavior tests verify timing, note accuracy, and 3-note cap.
- **Tests:** `npm run build`, `npm test`.

### Step 5: Wire into Game (Effort: Medium) — TODO
- **Goal:** Level 2 uses `SplitBriefTrial` instead of `AutoTrial`. Run fixed-seed tests, explain the baseline change, then save the new baseline (`npm run baseline`).
- **Done when:** All rule tests pass and the new baseline is explained and saved.
- **Tests:** `npm run build`, `npm test` (after `npm run baseline`).

### Step 6a: Browser continues past Level 1 (Effort: Medium) — TODO
- **Goal:** Add per-level briefing, host script (`FAC`), and ghost/tea hint table; update `V[9]` to continue to Level 2; add a placeholder trial screen for non-SOP trials; remove the Level-1-only blockers listed in `docs/game-report.md` section 5.
- **Done when:** Player can finish Level 1 and enter Level 2 in the browser.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.

### Step 6b: Split Brief trial screen (Effort: High) — TODO
- **Goal:** Build the Level 2 Split Brief trial screen: private cards, team notes feed with "notes left" counter and poster names, 2-slot backlog board, Lock In button, twist popup, and 180s timer.
- **Done when:** Human player can view cards, post notes, edit the board, receive the twist popup at 90s, and Lock In.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`.

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
