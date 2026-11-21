# Level 3 Build Plan (The Mirror: Presentation Day)

Designer credit: Hannah Ziegler (`cdf3eff` on `backup/Level3`, reference only via `git show cdf3eff:<path>` or `git show hz-level3:<path>`, same commit as `cdf3eff`; never merge, rebase, or cherry-pick).
Branch: `level3-mirror` (made from `level2-split-brief`). Note: the 9 open Level 2 QA bugs stay on `level2-split-brief` and will be carried into `level3-mirror` later.

After each step: `npm run build`, then `npm test`. Run `npm run test:screens` only for steps that touch screen code (`game.js`, `mirror-view.js`, `world-map.js`, `pixel-art.js`, `board.js`, `index.html`, `styles.css`). Update this file at the end of every step.

## Steps

### Step 0: Setup & Docs (Effort: Low) - DONE
- **Goal:** Write the approved Level 3 rules and exact copy into `CLAUDE.md`, create this build plan, point `AGENTS.md` to Level 3 docs, commit with `docs/level3-report.md`, and push to `origin` and `backup`. No game code, rules code, tests, or baseline changes.
- **Done when:** `npm test` passes against the existing baseline, `git status` is clean, the commit exists on `level3-mirror`, and both pushes succeed.
- **Tests:** `npm test`
- **Files changed:** `CLAUDE.md`, `docs/level3-progress.md`, `AGENTS.md`, `docs/level3-report.md`.
- **Test results:** `npm test` passed 12/12 checks (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`) against the unchanged baseline.
- **Open issues:** The 9 open Level 2 QA bugs stay on `level2-split-brief` and will be carried into `level3-mirror` later.

### Step 1: Level 3 data module (Effort: Low) - DONE
- **Goal:** Create `rules/mirrorData.js` (exported via `rules/index.js`) holding plain Level 3 constants and content: 4 cable ports (`HDMI`, `USB-C`, `AirLink`, `VGA`) with no hardcoded team names, 6 deck files, 3 Medline Q&A items, setup split tables for 1/2/3 setup slots, Hannah's timing/penalty/boost numbers, and flavor lines, plus `Tests/check_mirror_data.js` registered in `tools/baseline.js`.
- **Done when:** Data module exports clean plain data with zero hardcoded team names and the data-shape test + baseline tests pass.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_data.js`
- **Files changed:** `rules/mirrorData.js`, `rules/index.js`, `rules/rules.bundle.js`, `Tests/check_mirror_data.js`, `Tests/baseline/check_mirror_data.txt`, `tools/baseline.js`, `CLAUDE.md`, `docs/level3-progress.md`.
- **Test results:** `npm run build` (22 modules), `npm test` (13/13 checks passed; zero changes to existing baselines), and `node Tests/check_mirror_data.js` (24/24 assertions passed).
- **Open issues:** `baseBoost` in Hannah's `cdf3eff` depended on a single shared 75-second timer across lobby, reveal, and showtime; in our separate-timer structure (30s lobby, 1s reveal, fresh 75s showtime), that shared timer no longer exists (no replacement invented; confirm handling in Step 2c). (Resolved in Step 2a: `baseBoost` dropped because showtime uses its own fresh 75-second timer.)

### Step 2a: `MirrorLobby` and `MirrorTrial` crew deal (Effort: Medium) - DONE
- **Goal:** Create `rules/MirrorParts.js` (exported through `rules/index.js`, following the one-line import/export rule) with `MirrorLobby` (active players via `Team.active()`, connect and miss tile speed-up, bot connect times, doors-close lockout check, seeded `Rng` passed in from `MirrorTrial`, own `toJSON`/`fromJSON`), and build `MirrorTrial` in `rules/Trial.js` as the coordinator holding `#lobby` as a private field (outside code - `Game`, screens, bots - only calls `MirrorTrial`), owning the seeded crew deal (Setup Crew half rounded up max 3, rest Dance Crew, 1s reveal) and `toJSON`/`fromJSON` saving and restoring `#lobby` and crew deal state (not wired into `Round.LEVELS` yet). Add `Tests/check_mirror_lobby.js` (testing `MirrorLobby` directly and through `MirrorTrial`) and register it in `tools/baseline.js`.
- **Done when:** `MirrorLobby`, `MirrorTrial` crew deal, and save/load of that state work deterministically with seeded `Rng`, `Tests/check_mirror_lobby.js` passes both direct and coordinator tests, and existing baselines remain unchanged.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_lobby.js`
- **Files changed:** `CLAUDE.md`, `docs/level3-progress.md`, `rules/mirrorData.js`, `rules/MirrorParts.js`, `rules/index.js`, `rules/Trial.js`, `rules/rules.bundle.js`, `Tests/check_mirror_lobby.js`, `Tests/baseline/check_mirror_lobby.txt`, `tools/baseline.js`.
- **Test results:** `npm run build` (23 modules), `npm test` (14/14 checks passed; zero changes to existing baselines), and `node Tests/check_mirror_lobby.js` (24/24 assertions passed).
- **Open issues:** None.

### Step 2b: `SetupCrew` step actions and seeded content picks (Effort: Medium) - DONE
- **Built:** Added private-field `SetupCrew` in `rules/MirrorParts.js` (crew splits, 1/2/3 player step splits, sequential turns, results-based step actions, seeded mic/deck/Q&A picks, penalties and Q&A recovery, bot setup timing with 30% hiccup cost, wrap-up, and `toJSON`/`fromJSON`), wired `#setup` into `MirrorTrial`, and added `Tests/check_mirror_setup.js` (29/29 assertions).
- **Goal:** Add `SetupCrew` in `rules/MirrorParts.js` (exported through `rules/index.js`, private field `#setup` on `MirrorTrial`, outside code only calls `MirrorTrial`, seeded `Rng` passed in from `MirrorTrial`, own `toJSON`/`fromJSON` wired into `MirrorTrial.toJSON`/`fromJSON`): seeded setup slot order, 1/2/3 player step split (1 player: all 5; 2 players: cables/sound/mic then deck/Q&A; 3 players: cables/sound, mic/deck, Q&A), current step and whose turn, the 5 step actions as reported results, seeded content picks (mic sequences for rounds 3/4/5, file order and reshuffle, Q&A order), setup penalties and Q&A recoveries (up to 5 penalty points restored on right answer), and last-slot wrap-up. The rules accept RESULTS reported by the screen (examples: cable hit, wrong cable, sound held 3 seconds, feedback, mic tap right or wrong, file grabbed, Q&A answer or timeout, note perfect, note good, note missed, stray press). The rules do not run moving parts or per-tick motion. The screen handles motion and timing; the rules handle state, order, penalties, boosts, content picks, and scoring. Add `Tests/check_mirror_setup.js` (testing `SetupCrew` directly and through `MirrorTrial`) and register it in `tools/baseline.js`.
- **Done when:** `SetupCrew` (all 5 setup steps, slot split, turn order, penalties/recoveries, seeded content picks, wrap-up, and save/load of that state) passes both directly and through `MirrorTrial` in `Tests/check_mirror_setup.js` with existing baselines unchanged.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_setup.js`
- **Files changed:** `rules/MirrorParts.js`, `rules/Trial.js`, `rules/rules.bundle.js`, `Tests/check_mirror_setup.js`, `Tests/baseline/check_mirror_setup.txt`, `tools/baseline.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (15/15 checks passed; zero changes to the 14 existing baselines), and `node Tests/check_mirror_setup.js` (29/29 assertions passed).
- **Open issues:** None.

### Step 2c: `DanceCrew`, attention formula, and bot-only attention (Effort: Medium) - DONE
- **Built:** `DanceCrew` only (`rules/MirrorParts.js` private `#dance` field on `MirrorTrial`, dancer roster from `SetupCrew.danceIdsFor()`, boost cap 45, 0-dancer averaging, bot +1 per 1.5 to 2.5s, showtime-only 75s attention formula, bot-only random attention 0..100, three-part `toJSON`/`fromJSON`, and `Tests/check_mirror_dance.js`); commit `7b41b1f`.
- **Goal:** Add `DanceCrew` in `rules/MirrorParts.js` (exported through `rules/index.js`, private field `#dance` on `MirrorTrial`, outside code only calls `MirrorTrial`, seeded `Rng` passed in from `MirrorTrial`, own `toJSON`/`fromJSON` wired into `MirrorTrial.toJSON`/`fromJSON`): dancer roster, per-dancer boost (cap 45) and penalties, averaged boost and penalty (0 dancers = 0 boost and 0 dance penalty), showtime-only attention formula, and bot-only random attention 0..100. Add `Tests/check_mirror_dance.js` and register it in `tools/baseline.js`.
- **Done when:** `DanceCrew` and `MirrorTrial` attention formula, bot-only random attention, and three-part save/load pass in `Tests/check_mirror_dance.js` with existing baselines unchanged.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_dance.js`
- **Files changed:** `rules/MirrorParts.js`, `rules/Trial.js`, `rules/rules.bundle.js`, `Tests/check_mirror_dance.js`, `Tests/baseline/check_mirror_dance.txt`, `tools/baseline.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (16/16 checks passed; zero changes to the 15 existing baselines), and `node Tests/check_mirror_dance.js` (23/23 assertions passed).
- **Open issues:** None (trial scoring, Focus ranking, and tie-breaks moved to Step 2d).

### Step 2d: `MirrorTrial` scoring, Focus ranking, and tie-breaks (Effort: Medium) - DONE
- **Built:** Added `MirrorTrial` 0 to 7 scoring, lobby and attention-0 failure locking, `rankWithInfluence` Focus ranking with exact-attention and `EP.Rng` tie-breaks, bot-only scoring, save/load, and `Tests/check_mirror_score.js` (15/15 assertions).
- **Goal:** Complete `MirrorTrial` scoring in `rules/Trial.js` reading lobby, setup, and dance results through `#lobby`, `#setup`, and `#dance` public methods: 0 to 7 score (`Math.round(attention / 100 * 7)`), lobby failure (score 0), attention 0 fail with locked 0 score (`checkAttention`, `finishTeam`), wrap-up attention locking, `closeMirror`, ranking with light Focus influence (`rankWithInfluence`), tie-break by higher exact attention then `EP.Rng`, bot-only teams using Step 2c random attention, and `toJSON`/`fromJSON` persistence of locked attention and fail reasons. Add `Tests/check_mirror_score.js` and register it in `tools/baseline.js`.
- **Done when:** Score 0 to 7 edge cases, lobby and attention-0 failures, setup/dance results feeding score, 0-dancer teams, Focus influence, exact-attention and random tie-breaks, bot-only teams, and full save/load pass in `Tests/check_mirror_score.js` with all existing baselines unchanged.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_score.js`
- **Files changed:** `rules/Trial.js`, `rules/rules.bundle.js`, `Tests/check_mirror_score.js`, `Tests/baseline/check_mirror_score.txt`, `tools/baseline.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (17/17 checks passed; zero changes to the 16 existing baselines), and `node Tests/check_mirror_score.js` (15/15 assertions passed).
- **Open issues:** None.

### Step 3: Level 3 timers and `Game` integration (Effort: Medium) - DONE
- **Built:** Added deadline-based Level 3 timers (`mirrorLobby` 30s, `mirrorReveal` 1s, `mirrorShowtime` 75s), `Game` pass-throughs, `Round` `mirrorResults` persistence, `CLAUDE.md` lobby-fail ranking rule note, and `Tests/check_mirror_timing.js` (21/21 assertions).
- **Goal:** Add deadline-based Level 3 timers in `rules/Game.js` (`mirrorLobby`: 30s, `mirrorReveal`: 1s, `mirrorShowtime`: 75s) so attention drains only during showtime; add `Game` pass-through methods for `MirrorTrial` lobby/setup/dance/wrap-up actions and mid-trial save/load catch-up; prepare `Round.toJSON`/`fromJSON` for `mirrorResults` (keeping `Round.LEVELS` row 3 on `auto` until Step 5). Add `Tests/check_mirror_timing.js` and register it in `tools/baseline.js`.
- **Done when:** Timer transitions (30s lobby -> 1s reveal -> 75s showtime -> close) and mid-trial save/load work deterministically, `Tests/check_mirror_timing.js` passes, and existing baselines still pass.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_timing.js`
- **Files changed:** `CLAUDE.md`, `rules/Trial.js`, `rules/Round.js`, `rules/Game.js`, `rules/rules.bundle.js`, `Tests/check_save.js`, `Tests/check_mirror_timing.js`, `Tests/baseline/check_mirror_timing.txt`, `tools/baseline.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (18/18 checks passed; zero changes to the 17 existing baselines), and `node Tests/check_mirror_timing.js` (21/21 assertions passed).
- **Open issues:** None (`Tests/check_save.js` temporarily excludes `mirrorLobby`/`mirrorReveal`/`mirrorShowtime` from `ALL_TIMERS` until Step 5 switches `Round.LEVELS` row 3 to `"mirror"`).

### Step 4: Level 3 bots and idle auto-pilot (Effort: Medium) - DONE
- **Built:** Added `Bots.mirror` in `rules/bots.js` wired through `Bots.hooks` (`onStart`, `onTick`, `beforeClose`) calling `MirrorTrial` and `Game` pass-throughs chronologically (lobby 3 to 15s connects, bot setup milestones with ~30% -3 hiccups and wrap-up, bot dancer +1 boosts every 1.5 to 2.5s up to 45 with zero misses, bot-only random attention untouched, and idle human auto-pilot), plus `Tests/check_mirror_bots.js` (20/20 assertions).
- **Goal:** Add Level 3 bot logic in `rules/bots.js` connected only through `Game` hooks (`onStart`, `onTick`, `beforeClose`): bots connect in lobby after a seeded random 3 to 15 seconds; bot setup slots finish each step after a set time with a 30% hiccup costing 3 attention and automatic wrap-up in the last slot; bot dancers gain +1 boost every 1.5 to 2.5 seconds up to 45 with no misses; bot-only teams roll a random attention 0 to 100 and score from it; idle humans follow the existing idle auto-pilot rule (bot rule plays their part). Add `Tests/check_mirror_bots.js` and register it in `tools/baseline.js`.
- **Note:** `bots.js` hooks call the bot timing methods in `MirrorLobby`, `SetupCrew`, and `DanceCrew`. Do not duplicate the timing logic.
- **Done when:** All bot and idle-human behaviors run cleanly via `Game` hooks with seeded `Rng`, `Tests/check_mirror_bots.js` passes, and existing baselines remain unchanged.
- **Tests:** `npm run build`, `npm test`, `node Tests/check_mirror_bots.js`
- **Files changed:** `rules/bots.js`, `rules/rules.bundle.js`, `Tests/check_mirror_bots.js`, `Tests/baseline/check_mirror_bots.txt`, `tools/baseline.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed; zero changes to the 18 existing baselines), and `node Tests/check_mirror_bots.js` (20/20 assertions passed).
- **Open issues:** None.

### Step 5: Save/load update, wire Level 3 into `Round.LEVELS`, and baseline update (Effort: Medium) - DONE
- **Built:** Switched `Round.LEVELS` row 3 to `Presentation Day` / `mirror` (Focus, cost 3), documented `mirrorLobby` wake-up behavior in `CLAUDE.md`, extended `Tests/check_save.js` for Mirror actions, all 12 timers, and Part 4 full-game and mid-Level 3 reload, updated the 6 temporary `Round.LEVELS[2]` guards in `Tests/check_mirror_*.js`, and saved updated baselines.
- **Goal:** Update `Tests/check_save.js` for mid-trial Level 3, switch `Round.LEVELS` row 3 to `trialName: "Presentation Day"`, `trialKind: "mirror"` (Focus, cost 3), confirm Level 1 and Level 2 snapshots do not change, explain Level 3+ baseline diffs, and run `npm run baseline`. No new rule test files in Step 5.
- **Done when:** `Tests/check_save.js` covers mid-trial Level 3, Level 1 and Level 2 snapshots are unchanged, Level 3+ baseline diffs are explained, and the full baseline suite passes after `npm run baseline`.
- **Tests:** `npm run build`, `npm test` (after `npm run baseline`)
- **Files changed:** `rules/Round.js`, `rules/rules.bundle.js`, `CLAUDE.md`, `Tests/check_save.js`, `Tests/check_mirror_lobby.js`, `Tests/check_mirror_setup.js`, `Tests/check_mirror_dance.js`, `Tests/check_mirror_score.js`, `Tests/check_mirror_timing.js`, `Tests/check_mirror_bots.js`, `Tests/baseline/check_rules.txt`, `Tests/baseline/check_steps.txt`, `Tests/baseline/check_teams.txt`, `Tests/baseline/check_balance.txt`, `Tests/baseline/check_cheese.txt`, `Tests/baseline/check_save.txt`, `Tests/baseline/check_mirror_lobby.txt`, `Tests/baseline/check_mirror_setup.txt`, `Tests/baseline/check_mirror_dance.txt`, `Tests/baseline/check_mirror_score.txt`, `Tests/baseline/check_mirror_timing.txt`, `Tests/baseline/check_mirror_bots.txt`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed, 604 assertions across 14 assertion suites plus `check_bundle` and 4 simulation checks), and fixed-clock SHA-256 snapshots at Level 1 and Level 2 matched identically across seeds `[1, 2, 3, 7, 11]`.
- **Open issues:** None (Step 6a begins screen wiring in `game.js`).

### Step 6a: Screens - Level 3 flow, Briefing, Host Script, Hint Table, and Sprint 1 Complete unlock (Effort: Medium) - DONE
- **Built:** Added read-only `Game.mirrorPhase()` and `Game.trialRanking()` pass-throughs in `rules/Game.js` (rebuilt `rules/rules.bundle.js`); updated `BRIEFINGS[3]`, `LEVEL_HINTS[3]`, and phase-aware `FAC_BY_LEVEL[3]` / `facLines()` in `game.js` with exact approved `CLAUDE.md` text; unlocked `Sprint 1 Complete` -> `Start Level 3 ▶` (`#nextLevel`, `fwd()`, `goForward()`); removed hardcoded `"Team Kestrel"` fallback in `V[5]`; added Step 6a placeholder `trialMirrorScreen()` (`"Presentation Day: coming in Step 6b."`) registered under `TRIAL_SCREENS.mirror`; extended `Tests/check_screens.js` to verify all Step 6a screens, Host Script host-only visibility, hint panels, and no work-style/secret-path leaks.
- **Goal:** Update `game.js` with the exact Level 3 `BRIEFINGS[3]`, `LEVEL_HINTS[3]` (ghost hints and tea guest story), and `FAC_BY_LEVEL[3]` (Briefing, Trial lobby, Trial showtime); replace "Level 3 locked" on Sprint 1 Complete with a "Start Level 3" button and wire Level 2 -> Level 3 progression; register `mirror` in `TRIAL_SCREENS`; ensure zero hardcoded team names.
- **Done when:** Player can advance from Sprint 1 Complete into Level 3 Briefing and Open Floor and see the exact Level 3 hints, memo, and host script lines.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `rules/Game.js`, `rules/rules.bundle.js`, `game.js`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (76 passed, 0 failed, 0 console errors).
- **Open issues:** `trialMirrorScreen()` uses a plain `"Presentation Day: coming in Step 6b."` placeholder until `mirror-view.js` is built in Steps 6b–6e.

### Step 6b: Screens - Presentation Day Lobby and Crew Reveal (`mirror-view.js`) (Effort: Medium) - DONE
- **Built:** Added 5 read-only one-line pass-throughs on `Game` (`mirrorLobbyTeam`, `mirrorCrew`, `mirrorSetupSlots`, `mirrorRole`, `mirrorFailReason`) in `rules/Game.js` and rebuilt `rules/rules.bundle.js`; created `mirror-view.js` (loaded in `index.html`, styled in `styles.css`, routed from `trialMirrorScreen()` in `game.js`) with Presentation Day Lobby (30s rules-timer countdown, signal-grab tile with moving cursor/green band and miss wobble +2 speed-up, bot/teammate connection tiles using `boardStatus()`), Crew Reveal (`CREW LOCKED` showing Setup Crew slot owners/steps and Dance Crew roster, plus `LOBBY FAILED` for failed teams), Step 6b showtime placeholder (`"Setup and Dance: coming in Steps 6c and 6d."`), and trial result view; extended `Tests/check_screens.js` for all Step 6b flows and edge cases.
- **Goal:** Create `mirror-view.js` (loaded in `index.html`) and add styles in `styles.css` for the Presentation Day header, sabotage alert, 30-second lobby countdown, active-player signal-grab tile (moving sweep 0 to 100, green band width 14, miss wobble and speed-up), live bot connects, doors-close fail state, and 1-second `CREW LOCKED` reveal showing Setup Crew slot order and Dance Crew rosters. Wire `mirror-view.js` into `game.js` 250ms tick.
- **Done when:** Active human can connect via signal grab, bots connect at 3 to 15s, doors-close fail triggers score 0, and `CREW LOCKED` transitions into showtime.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `rules/Game.js`, `rules/rules.bundle.js`, `mirror-view.js`, `index.html`, `game.js`, `styles.css`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (89 passed, 0 failed, 0 console errors).
- **Open issues:** Showtime uses the Step 6b placeholder (`"Setup and Dance: coming in Steps 6c and 6d."`) until Setup Crew and Dance Crew screens are built in Steps 6c to 6e.

### Step 6c-1: Screens - Setup Crew frame, cables, and sound steps (Effort: Medium) - DONE
- **Built:** Added two read-only one-line pass-throughs on `Game` (`mirrorSetupTeam`, `mirrorDanceTeam`) in `rules/Game.js` and rebuilt `rules/rules.bundle.js`; built Step 6c-1 showtime views in `mirror-view.js` and `styles.css` (Audience Attention bar with rules countdown, Setup Crew 5-step checklist frame with owners/live/done states and bot hiccup cost without bot tags, Dance Crew readout panel, Cables moving belt with live team names and spark/hit reporting, Sound check drift/spikes/feedback and 3s hold, non-owner waiting view with live step progress, Step 6c-2 placeholders for mic/deck/Q&A/wrap-up, and Step 6d Dance Crew placeholder), and extended `Tests/check_screens.js`.
- **Goal:** Build the Setup Crew showtime shell and first two steps in `mirror-view.js` and `styles.css`: Audience Attention bar, live step checklist for waiting Setup players, Dance Crew readout panel, cables step (moving belt and machines, no hardcoded team names), and sound step (`-10/+5/+10`, green zone 70-85 for 3s, 100 feedback reset). Screen handles motion and timing and reports results to `G`.
- **Done when:** Waiting Setup players see the live checklist and Dance Crew readout, active Setup players can complete cables and sound with results routed through `G`, and no hardcoded team names appear.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `rules/Game.js`, `rules/rules.bundle.js`, `mirror-view.js`, `styles.css`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (102 passed, 0 failed, 0 console errors).
- **Open issues:** Mic, deck, Q&A, and wrap-up use plain Step 6c-2 placeholders and Dance Crew uses the Step 6d placeholder until those steps are built.

### Step 6c-2: Screens - Setup Crew mic, deck, Q&A, and Wrap up (Effort: Medium) - DONE
- **Built:** Replaced the Step 6c-1 Setup Crew placeholders in `mirror-view.js` and `styles.css` with Mic check (3/4/5 memory rounds with flash/hide timing and `-4` wrong tap reporting via `G.mirrorMicTap`), Grab the deck (6-file grid driven by seeded `fileOrder` with 8-tick auto-reshuffles and 2-tick spite reshuffles via `G.mirrorPickFile` / `G.mirrorReshuffleDeck`), Rapid-fire Q&A (seeded `qaItems` with 29-tick countdown bar, 8-tick `.low` warning, timeout via `G.mirrorTimeoutQa`, and right-answer recovery/wrong-answer penalty via `G.mirrorAnswerQa`), and Wrap up (`#wrapUp` calling `G.mirrorWrapUp` for the last Setup slot owner), all plugged into the Step 6c-1 frame and waiting view; updated `Tests/check_screens.js` (Run 4 + Run 7 + Run 8 `mirrorStep6c2Cases`).
- **Goal:** Build the remaining Setup Crew steps and wrap-up in `mirror-view.js` and `styles.css`: mic step (3/4/5 memory rounds with flash and `?`), deck step (6-file reshuffling grid), Q&A step (3 rapid-fire questions with countdown bar), and the "Wrap up the presentation" button for the last Setup player. Screen handles display timing and reports results to `G`.
- **Done when:** Setup players complete mic, deck, and Q&A in assigned slot order with penalties and recoveries routed through `G`, and the last Setup player's Wrap up button ends the trial.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `mirror-view.js`, `styles.css`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md` (no `game.js`, `rules/`, or `Tests/baseline/` files changed).
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (113 passed, 0 failed, 0 console errors).
- **Open issues:** Dance Crew keeps its Step 6d placeholder (`"Dance lane: coming in Step 6d."`) until Step 6d.

### Step 6d: Screens - Dance Crew rhythm lane (Effort: Medium) - DONE
- **Built:** Created `mirror-dance-view.js` (loaded in `index.html`, styled in `styles.css`, routed from `mirror-view.js` with `cleanup` hooks in `game.js`, zero new `Game` pass-throughs) implementing Hannah's sliding arrow rhythm lane (`requestAnimationFrame` motion with cleanup on leave or showtime end, arrow keys and pad buttons respecting Attendance popups, hits/misses/strays/combo/boost/team averages/attention from rules, live teammate and bot dancer progress via `boardStatus()`, animated avatars, Setup Crew checklist, and 0-dancer fallback).
- **Goal:** Build the Dance Crew rhythm lane in `mirror-view.js` and `styles.css`: sliding arrow notes, hit frame (PERFECT +3 / good +2), arrow key and pad button input (respecting Attendance popup focus/key rules), combo and boost (cap 45) display, animated dancer avatars from the live roster, and live Setup Crew status checklist.
- **Done when:** Dance Crew players can hit notes via keyboard or buttons, misses and stray presses apply averaged dancer penalties via `G`, and trial ends when Setup Crew wraps up or attention hits 0.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `mirror-dance-view.js`, `index.html`, `mirror-view.js`, `game.js`, `styles.css`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md` (no `rules/` or `Tests/baseline/` files changed).
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (124 passed, 0 failed, 0 console errors).
- **Open issues:** Trial result detail tweaks and the "Presentation Day Complete" end screen remain deferred to Step 6e.

### Step 6e: Screens - Trial result and Presentation Day Complete end screen (Effort: Medium) - DONE
- **Built:** Added `Team.trialResults` (recorded in `Trial.run()`, saved in `Team.toJSON()`/`fromJSON()` defaulting older saves to `{}`), read-only `Game.teamTrialResults(teamOrId)` and `Game.teamStandings()`, Presentation Day trial result screen in `mirror-view.js` (`renderResultHTML`, styled in `styles.css`), and shared `milestoneCompleteScreen()` in `game.js` for Sprint 1 Complete and Presentation Day Complete (`END_SCREENS[3]`), plus Run 10 tests in `Tests/check_screens.js`.
- **Goal:** Build the Presentation Day trial result panel in `mirror-view.js` (attention %, fail note if locked out or attention 0%, team WIN/LOSS, score 0-7, full ranking, Focus cost reminder) and add "Presentation Day Complete" (`END_SCREENS[3]`) in `game.js` matching Sprint 1 Complete format (Levels 1-3 results, hearts, `x/2` glitches, `boardStatus()`, 5 attributes in canonical order, team wins out of 3, ranked teams, "Level 4 locked" with Replay/Sign-out; no work styles or secret paths).
- **Done when:** Completing Level 3 Stats Update shows the Presentation Day Complete screen accurately with zero leaked work-style or secret-path info.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `rules/Team.js`, `rules/Trial.js`, `rules/Game.js`, `rules/rules.bundle.js`, `mirror-view.js`, `game.js`, `styles.css`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (136 passed, 0 failed, 0 console errors).
- **Open issues:** None.

### Step 7: Dev jump (`Ctrl+Shift+1` to `7`) (Effort: Low) - DONE
- **Built:** Added rules-first `Game.jumpToLevel(targetLevel)` in `rules/Game.js` and `Bots.hooks.onFastForward` (plus idempotency guards) in `rules/bots.js` (rebuilt `rules/rules.bundle.js`), gated `Ctrl+Shift+1` to `7` behind one `DEV_JUMP = true` flag (`"remove or gate before Base44"`) in `game.js`, and added Run 11 (`devJumpCases()`) in `Tests/check_screens.js`.
- **Goal:** Add `Ctrl+Shift+1` to `7` dev jump in `game.js`, always on in the prototype: jumping forward fast-forwards rounds to that level's briefing; jumping to the current or an earlier level starts a new game and fast-forwards to that level; resets round UI and timers cleanly.
- **Done when:** `Ctrl+Shift+1` through `7` land cleanly on the target level's Briefing from any screen, both forward and backward/same-level, with no stale step state.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`
- **Files changed:** `rules/Game.js`, `rules/bots.js`, `rules/rules.bundle.js`, `game.js`, `Tests/check_screens.js`, `docs/level3-progress.md`, `docs/level3-report.md`.
- **Test results:** `npm run build` (23 modules), `npm test` (19/19 checks passed with zero baseline diffs), and `npm run test:screens` (146 passed, 0 failed, 0 console errors).
- **Open issues:** None.

### Step 8: Screen tests (`Tests/check_screens.js`) (Effort: Medium) - TODO
- **Goal:** Extend `Tests/check_screens.js` to cover Sprint 1 Complete "Start Level 3", Level 3 briefing & hints, lobby signal grab + miss + bot connect + doors-close fail, Crew Reveal, Setup Crew all 5 steps + wrap up, Dance Crew rhythm lane + bot setup wrap up, mid-trial save/reload, Presentation Day Complete screen (no work styles or secret paths), and dev jump forward and backward (`Ctrl+Shift+1..7`).
- **Done when:** `npm run test:screens` passes all assertions with zero console errors.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`

### Step 9: Class diagram, README, and docs sync (Effort: Low) - TODO
- **Goal:** Update `docs/class-diagram.md` with `MirrorTrial`, `MirrorLobby`, `SetupCrew`, and `DanceCrew` and the commit hash it was built from, update `README.md` (Level 3 overview, `mirror-view.js`, dev jump note, Hannah Ziegler credit), update `docs/Game_Index.md`, and sync `CLAUDE.md` file map and test commands list.
- **Done when:** All docs accurately reflect the final Level 3 implementation.
- **Tests:** `npm run build`, `npm test`

### Step 10: QA run and manual playtest (Effort: Medium) - TODO
- **Goal:** Run the full automated suite and complete a manual browser QA pass (lobby fail, 1/2/3 Setup splits, Dance Crew lane, Stuck/Idle exclusion, attention 0 fail, Presentation Day Complete, dev jump forward/backward). Carry forward or resolve any remaining Level 2 QA bugs only when explicitly scheduled.
- **Done when:** All automated checks pass and Ben confirms manual QA checks pass.
- **Tests:** `npm run build`, `npm test`, `npm run test:screens`, manual browser playtest.
