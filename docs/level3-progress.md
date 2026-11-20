# Level 3 Build Plan (The Mirror: Presentation Day)

Designer credit: Hannah Ziegler (`cdf3eff` on `backup/Level3`, reference only via `git show cdf3eff:<path>`, never merge, rebase, or cherry-pick).
Branch: `level3` (made from `level2-split-brief`). Note: the 9 open Level 2 QA bugs stay on `level2-split-brief` and will be carried into `level3` later.

After each step: `npm run build`, then `npm test`. Run `npm run test:screens` only for steps that touch screen code (`game.js`, `mirror-view.js`, `world-map.js`, `pixel-art.js`, `board.js`, `index.html`, `styles.css`). Update this file at the end of every step.

## Steps

### Step 0: Setup & Docs (Effort: Low) - DONE
- **Goal:** Write the approved Level 3 rules and exact copy into `CLAUDE.md`, create this build plan, point `AGENTS.md` to Level 3 docs, commit with `docs/level3-report.md`, and push to `origin` and `backup`. No game code, rules code, tests, or baseline changes.
- **Done when:** `npm test` passes against the existing baseline, `git status` is clean, the commit exists on `level3`, and both pushes succeed.
- **Tests:** `npm test`
- **Files changed:** `CLAUDE.md`, `docs/level3-progress.md`, `AGENTS.md`, `docs/level3-report.md`.
- **Test results:** `npm test` passed 12/12 checks (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`) against the unchanged baseline.
- **Open issues:** The 9 open Level 2 QA bugs stay on `level2-split-brief` and will be carried into `level3` later.

### Step 1: Level 3 data module (Effort: Low) - TODO
- **Goal:** Create `rules/mirrorData.js` (exported via `rules/index.js`) holding plain Level 3 constants and content: 4 cable ports (`HDMI`, `USB-C`, `AirLink`, `VGA`) with no hardcoded team names, 6 deck files, 3 Medline Q&A items, setup split tables for 1/2/3 setup slots, Hannah's timing/penalty/boost numbers, and flavor lines, plus `Tests/check_mirror_data.js` registered in `tools/baseline.js`.
- **Done when:** Data module exports clean plain data with zero hardcoded team names and the data-shape test + baseline tests pass.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_data.js`

### Step 2: `MirrorTrial` core rules (Effort: High) - TODO
- **Goal:** Implement `MirrorTrial` in `rules/Trial.js` (not wired into `Round.LEVELS` yet): lobby state (`Team.active()` only, signal-grab connect/miss speed-up, score-0 fail if any active player is left out at doors close), seeded crew deal (Setup Crew half rounded up max 3, rest Dance Crew, 1s reveal), seeded setup slot order and sequential 5-step split (1 player: all 5; 2 players: cables/sound/mic then deck/Q&A; 3 players: cables/sound, mic/deck, Q&A), rules-owned step actions and seeded content picks (cables, sound 70-85 hold / 100 feedback, mic rounds 3/4/5, deck reshuffle/grab, 3 Q&A with up to 5 penalty points restored on right answer, last-slot wrap-up), per-dancer rhythm boost (cap 45) and dancer penalties averaged across dancers (0 dancers = 0 boost and 0 dance penalty), attention formula (`base + baseBoost + avgDanceBoost - setupPenalties - avgDancePenalties`, clamped 0..100, attention 0 ends trial with score 0), score `Math.round(attention / 100 * 7)`, bot-only random attention 0..100, ranking with light Focus influence and tie-break by higher exact attention then random, and `toJSON`/`fromJSON` capturing full mid-trial state.
- **Done when:** `MirrorTrial` handles all lobby, crew, setup, dance, scoring, tie-break, and save/load rules deterministically with seeded `Rng`, and existing baselines stay untouched.
- **Tests:** `npm run build`, `npm test`

### Step 3: Level 3 timers and `Game` integration (Effort: Medium) - TODO
- **Goal:** Add deadline-based Level 3 timers in `rules/Game.js` (`mirrorLobby`: 30s, `mirrorReveal`: 1s, `mirrorShowtime`: 75s) so attention drains only during showtime; add `Game` pass-through methods for `MirrorTrial` lobby/setup/dance/wrap-up actions and mid-trial save/load catch-up; prepare `Round.toJSON`/`fromJSON` for `mirrorResults` (keeping `Round.LEVELS` row 3 on `auto` until Step 5).
- **Done when:** Timer transitions (30s lobby -> 1s reveal -> 75s showtime -> close) and mid-trial save/load work deterministically and existing baselines still pass.
- **Tests:** `npm run build`, `npm test`

### Step 4: Level 3 bots and idle auto-pilot (Effort: Medium) - TODO
- **Goal:** Add Level 3 bot logic in `rules/bots.js` connected only through `Game` hooks (`onStart`, `onTick`, `beforeClose`): bots connect in lobby after a seeded random 3 to 15 seconds; bot setup slots finish each step after a set time with a 30% hiccup costing 3 attention and automatic wrap-up in the last slot; bot dancers gain +1 boost every 1.5 to 2.5 seconds up to 45 with no misses; bot-only teams roll a random attention 0 to 100 and score from it; idle humans follow the existing idle auto-pilot rule (bot rule plays their part).
- **Done when:** All bot and idle-human behaviors run cleanly via `Game` hooks with seeded `Rng` and existing baselines remain unchanged.
- **Tests:** `npm run build`, `npm test`

### Step 5: Rule tests, wire Level 3 into `Round.LEVELS`, and baseline update (Effort: Medium) - TODO
- **Goal:** Add `Tests/check_mirror.js`, `Tests/check_mirror_timing.js`, and `Tests/check_mirror_bots.js` (registered in `tools/baseline.js`), update `Tests/check_save.js` to exercise mid-trial Level 3 actions and timers, switch `Round.LEVELS` row 3 to `trialName: "Presentation Day"`, `trialKind: "mirror"` (Focus, cost 3), verify Level 1 and Level 2 snapshots do not change, explain Level 3+ baseline diffs, and run `npm run baseline`.
- **Done when:** All new Level 3 rule/timing/bot/save checks and the full baseline suite pass with explained diffs.
- **Tests:** `npm run build`, `npm test` (after `npm run baseline`)

### Step 6a: Screens - Level 3 flow, Briefing, Host Script, Hint Table, and Sprint 1 Complete unlock (Effort: Medium) - TODO
- **Goal:** Update `game.js` with the exact Level 3 `BRIEFINGS[3]`, `LEVEL_HINTS[3]` (ghost hints and tea guest story), and `FAC_BY_LEVEL[3]` (Briefing, Trial lobby, Trial showtime); replace "Level 3 locked" on Sprint 1 Complete with a "Start Level 3" button and wire Level 2 -> Level 3 progression; register `mirror` in `TRIAL_SCREENS`; ensure zero hardcoded team names.
- **Done when:** Player can advance from Sprint 1 Complete into Level 3 Briefing and Open Floor and see the exact Level 3 hints, memo, and host script lines.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 6b: Screens - Presentation Day Lobby and Crew Reveal (`mirror-view.js`) (Effort: Medium) - TODO
- **Goal:** Create `mirror-view.js` (loaded in `index.html`) and add styles in `styles.css` for the Presentation Day header, sabotage alert, 30-second lobby countdown, active-player signal-grab tile (moving sweep 0 to 100, green band width 14, miss wobble and speed-up), live bot connects, doors-close fail state, and 1-second `CREW LOCKED` reveal showing Setup Crew slot order and Dance Crew rosters. Wire `mirror-view.js` into `game.js` 250ms tick.
- **Done when:** Active human can connect via signal grab, bots connect at 3 to 15s, doors-close fail triggers score 0, and `CREW LOCKED` transitions into showtime.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 6c: Screens - Setup Crew steps (Effort: High) - TODO
- **Goal:** Build all 5 Setup Crew steps in `mirror-view.js` and `styles.css`: Audience Attention bar, live step checklist for waiting Setup players, Step 1 moving cable belt & live team machines (no hardcoded team names), Step 2 sound mixer (`-10/+5/+10`, green zone 70-85 for 3s, 100 feedback reset), Step 3 mic memory (3/4/5 flash and `?`), Step 4 6-file reshuffling grid, Step 5 rapid-fire Q&A with countdown bar and "Wrap up the presentation" button for the last Setup player, plus live Dance Crew readout panel.
- **Done when:** Setup players play only their assigned slot steps in order, waiting players see the checklist, all penalties and recoveries route through `G`, and Wrap up ends the trial.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 6d: Screens - Dance Crew rhythm lane (Effort: Medium) - TODO
- **Goal:** Build the Dance Crew rhythm lane in `mirror-view.js` and `styles.css`: sliding arrow notes, hit frame (PERFECT +3 / good +2), arrow key and pad button input (respecting Attendance popup focus/key rules), combo and boost (cap 45) display, animated dancer avatars from the live roster, and live Setup Crew status checklist.
- **Done when:** Dance Crew players can hit notes via keyboard or buttons, misses and stray presses apply averaged dancer penalties via `G`, and trial ends when Setup Crew wraps up or attention hits 0.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 6e: Screens - Trial result and Presentation Day Complete end screen (Effort: Medium) - TODO
- **Goal:** Build the Presentation Day trial result panel in `mirror-view.js` (attention %, fail note if locked out or attention 0%, team WIN/LOSS, score 0-7, full ranking, Focus cost reminder) and add "Presentation Day Complete" (`END_SCREENS[3]`) in `game.js` matching Sprint 1 Complete format (Levels 1-3 results, hearts, `x/2` glitches, `boardStatus()`, 5 attributes in canonical order, team wins out of 3, ranked teams, "Level 4 locked" with Replay/Sign-out; no work styles or secret paths).
- **Done when:** Completing Level 3 Stats Update shows the Presentation Day Complete screen accurately with zero leaked work-style or secret-path info.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 7: Dev jump (`Ctrl+Shift+1` to `7`) (Effort: Low) - TODO
- **Goal:** Add `Ctrl+Shift+1` to `7` dev jump in `game.js`, always on in the prototype: jumping forward fast-forwards rounds to that level's briefing; jumping to the current or an earlier level starts a new game and fast-forwards to that level; resets round UI and timers cleanly.
- **Done when:** `Ctrl+Shift+1` through `7` land cleanly on the target level's Briefing from any screen, both forward and backward/same-level, with no stale step state.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 8: Screen tests (`Tests/check_screens.js`) (Effort: Medium) - TODO
- **Goal:** Extend `Tests/check_screens.js` to cover Sprint 1 Complete "Start Level 3", Level 3 briefing & hints, lobby signal grab + miss + bot connect + doors-close fail, Crew Reveal, Setup Crew all 5 steps + wrap up, Dance Crew rhythm lane + bot setup wrap up, mid-trial save/reload, Presentation Day Complete screen (no work styles or secret paths), and dev jump forward and backward (`Ctrl+Shift+1..7`).
- **Done when:** `npm run test:screens` passes all assertions with zero console errors.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 9: Class diagram, README, and docs sync (Effort: Low) - TODO
- **Goal:** Update `docs/class-diagram.md` with `MirrorTrial` and the commit hash it was built from, update `README.md` (Level 3 overview, `mirror-view.js`, dev jump note, Hannah Ziegler credit), update `docs/Game_Index.md`, and sync `CLAUDE.md` file map and test commands list.
- **Done when:** All docs accurately reflect the final Level 3 implementation.
- **Tests:** `npm run build`, `npm test`

### Step 10: QA run and manual playtest (Effort: Medium) - TODO
- **Goal:** Run the full automated suite and complete a manual browser QA pass (lobby fail, 1/2/3 Setup splits, Dance Crew lane, Stuck/Idle exclusion, attention 0 fail, Presentation Day Complete, dev jump forward/backward). Carry forward or resolve any remaining Level 2 QA bugs only when explicitly scheduled.
- **Done when:** All automated checks pass and Ben confirms manual QA checks pass.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`, manual browser playtest.
