# Level 3 Code Report (commit `cdf3eff` on `backup/Level3`)

This report reviews Hannah's Level 3 commit `cdf3eff` ("Add Level 3: Presentation Day trial, dev jump added with ctrl+shift+3"). It was branched from `9912e34` (the merge of `ben-ooad`, right after common ancestor `862d9fa`), not from `level2-split-brief`. All findings below come from reading the git commit and diffs only.

---

## 1. What Level 3 is for the player

### Goal
Level 3 is **The Mirror: Presentation Day**. Your team must connect to the Medline client call, complete your assigned crew's mini-game, and keep the Audience Attention meter as high as possible until the presentation ends. If you miss the lobby deadline or Audience Attention hits 0%, the room empties and the trial fails with a score of 0.

### Steps in order
1. **Step 0: Connect the team (Lobby, `phase === 0`).**
   - Each teammate has a tile with a moving signal bar and a green target band (width 14 out of 100).
   - Tap a teammate's tile when their cursor is inside the green band to bring them into the call.
   - A missed tap adds a glitch reason message and raises that tile's speed by +2 (up to 16).
   - The lobby ends when everyone is in, or when the 30-second doors countdown runs out.
   - Any teammate still outside misses the presentation. If **you** are still outside when doors close, the trial fails on the spot.
2. **Crew Reveal (`phase === 2`).**
   - Everyone who made the call is shuffled at random and split into two crews.
   - Presentation Setup gets half the players, rounded up (`Math.ceil(pool.length / 2)`). Dance Crew gets the rest.
   - A "CREW LOCKED" panel shows which crew you drew for 1 second, then showtime starts (`phase === 1`) and resets the attention meter display to 100%.
3. **Showtime (`phase === 1`).** You play only the crew you drew.
   - **If you draw Presentation Setup (5 sequential steps):**
     1. *Patch the rack:* Cables (`HDMI`, `USB-C`, `AirLink`, `VGA`) slide across a moving belt toward a plug frame. Click the matching team machine (`Team Kestrel` HDMI, `Team Wren` USB-C, `Team Finch` AirLink, `Team Heron` VGA) while its cable is in the frame (within 2 ticks). Wrong clicks spark and cost 3 attention. Missed cables return to the belt. The belt speeds up as machines connect.
     2. *Sound check:* Sound starts at 45, drifts back toward 45 every tick, and spikes up (+8 to +17) when the crowd whoops. Use `-10`, `+5`, and `+10` buttons to hold the level in the green zone (70 to 85) for 3.0 straight seconds. Hitting 100 or higher causes feedback, resets sound to 45, resets the hold timer, and costs 4 attention.
     3. *Mic check:* Three memory rounds of lengths 3, 4, and 5 across `MIC 1` to `MIC 4`. The order flashes, hides behind `?`, and you tap it back. A wrong tap costs 4 attention and flashes a new sequence for that round.
     4. *Grab the deck:* Six files appear in a grid that reshuffles every 2 seconds. Click `MEDLINE_deck_v3_CLIENT_SIGNED.pptx`. Clicking a wrong file costs 6 attention and triggers an extra reshuffle.
     5. *Rapid-fire Q&A:* Three Medline multiple-choice questions, one at a time, each with a countdown bar. A right answer restores 5 lost attention penalty points. A wrong answer or timeout costs 5 attention. After question 3, press **Wrap up the presentation** to end the trial.
   - **If you draw the Dance Crew (rhythm lane):**
     - Arrow notes (`←`, `↑`, `→`, `↓`) slide left across a lane toward a hit frame.
     - Press the matching arrow key or click the pad button as the note crosses the frame. Inner band (within 1 tick) is PERFECT (+3 boost). Outer band (within 2 ticks) is good (+2 boost). Total dance boost caps at +45.
     - A stray press costs 1 attention and resets combo. A missed note costs 2 attention and resets combo. Note tempo gets faster after 20 notes and again after 40 notes.
     - The trial ends automatically when the bot setup crew reaches its final milestone, or earlier if attention hits 0% or the main trial timer expires.

### Timers
- **Engine trial timer (`rules/Game.js`):** 75 seconds (`mirrorTrial: 75`). Starts as soon as the Trial step opens, including lobby time. When it hits 0, `Game` closes the trial and scores the room as it stands.
- **Screen update loop (`game.js`):** Runs every 250 ms (4 ticks per second).
- **Lobby doors countdown:** 120 ticks (30 seconds).
- **Crew reveal pause:** 4 ticks (1 second).
- **Sound check hold target:** 12 straight ticks (3.0 seconds).
- **Sound crowd spike interval:** Every 12 to 20 ticks (3.0 to 5.0 seconds).
- **Mic flash time:** 9 ticks (2.25 seconds) on round 1; `6 + length` ticks on later or retry rounds (2.25 to 2.75 seconds).
- **Drive reshuffle interval:** Every 8 ticks (2.0 seconds), or 2 ticks (0.5 seconds) after clicking a wrong file.
- **Q&A countdown:** 29 ticks (7.25 seconds) per question.
- **Rhythm note travel / rack cable travel:** 10 ticks (2.5 seconds) for dance notes; 11 ticks (2.75 seconds) for rack cables.
- **Bot setup crew full run (when you dance):** 136 ticks (34 seconds) of showtime across 6 milestones (ticks 16, 40, 64, 88, 112, 136).

### Scoring and ties
- Audience Attention is `0` to `100`: `base (secondsLeft / 75 * 100) + baseBoost + danceBoost - pen`, clamped to `0..100`.
- During showtime, every action and every 250 ms tick pushes the current attention to `G.setMirrorScore(MYTEAM, mirAtt())`.
- `MirrorTrial.score(attention)` converts 0 to 100 into a whole score from 0 to 7 using `Math.round(attention / 100 * 7)`.
- Teams are ranked by `base + light Focus influence` (`0.5 * (team active Focus average - all teams active Focus average)`). Top half of teams win (`Math.ceil(teams / 2)`).
- **Ties:** Broken at random by `Trial.sortBy` using `this.rng()`. There is no custom Level 3 tie-breaker.

### Attribute cost
- Level 3 tests **Focus** and costs **3 Focus** for every non-Stuck player (unchanged in `Round.LEVELS`).
- Paid when moving from Trial to Glitch Report, with hearts covering any shortfall as normal.

### What bots do
- **Other teams (bot-only teams):** `MirrorTrial.rank()` assigns any team without a set score a random integer from 0 to 7 (`this.randomBase()`). `rules/bots.js` has no Level 3 logic.
- **Your bot teammates in the lobby:** They do nothing on their own. The human player must click every teammate's signal tile to connect them.
- **Your bot teammates if you draw Setup:** Bot dancers follow a random 64-move sequence and passively add +1 to `danceBoost` (up to +45) every `Math.max(6, 12 - 2 * hype.length)` ticks (1.5 to 2.5 seconds).
- **Your bot teammates if you draw Dance Crew:** Bot setup teammates step through 6 timed milestones over 34 seconds. Each of the first 5 steps has a 30% chance of a hiccup that costs 3 attention. On step 6 ("wrapped up"), they end the trial automatically.

---

## 2. Screens

Hannah did not add separate modal popups or new view files. All new UI lives inside `game.js` (mostly `V[7]`) and `styles.css`.

1. **Per-level Briefing (`V[5]` using `BRIEFINGS[1..3]`):**
   - Header chip (`System Briefing · Level N`), level title (`Sprint 1: Against the Timer` for Level 2, `The Mirror: Presentation Day` for Level 3), Interoffice memo addressed to the player and `Team Kestrel`, 3 stat cards (tested attribute, cost, your stat with bonus tag and cover hint), plus Real phase and Workshops panels.
2. **Stand-in Auto Trial (`autoView` in `V[7]`):**
   - Used for Levels 2 and 4 (`trialKind === "auto"`). Shows trial header, optional sabotage alert, placeholder message, a **Run the trial** button (`#runTrial`), and the shared `trialResult` panel after clicking it.
3. **Presentation Day: Lobby (`mirrorView`, `phase === 0`):**
   - Flickering `PRESENTATION DAY` banner, level subtitle, optional sabotage alert, 30-second doors countdown (`#lobbyCd`), warning that you fail if locked out, and the "Step 0 · Connect the team" panel with one sweeper tile per teammate (`data-login`), plus a status line (`.mmsg`).
4. **Presentation Day: Crew Reveal (`mirrorView`, `phase === 2`):**
   - Same header plus a centered pulsing `CREW LOCKED` panel showing your drawn crew, both crew rosters, a one-line role summary, and `Showtime in a second…`.
5. **Presentation Day: Setup Crew (`mirrorView`, `phase === 1`, on setup):**
   - Header, Audience Attention bar (`#attnBar`, `#attnPct`), Roles summary panel, and 5 progressive task panels (Rack belt + 4 team machine buttons, Sound mixer + `-10/+5/+10` buttons + hold readout, Mic check sequence + 4 mic buttons, Shuffling 6-file grid, Rapid-fire Q&A box + timer bar + 3 answers + **Wrap up the presentation** button).
   - Also includes a live Dance Crew panel showing bot dancers' current/next arrows, animated avatars, dance cam text, and boost counter (or an empty-crew notice).
6. **Presentation Day: Dance Crew (`mirrorView`, `phase === 1`, on dance):**
   - Header, Audience Attention bar, Roles summary panel, Rhythm Lane panel (`#lane` with hit frame, 4 arrow pad buttons, combo counter, boost counter, animated dancer avatars, dance cam text, instructions), and a 6-step Setup Crew live status checklist (`.bstep`).
7. **Presentation Day: Trial Result (`mirrorView`, after trial closes):**
   - Header, final Audience Attention bar, optional red `TRIAL FAILED` line (if locked out or attention hit 0%), attention left %, team WIN/LOSS, score out of 7, full team ranking, and cost reminder.
8. **Stats Update Next Card (`V[9]`):**
   - Updated so completed rounds below `BUILT_LEVELS` (3) show a green-bordered `UNLOCKED` card with `Start Level N ▶`, while Level 4 stays `LOCKED`. The replay button label changed to `Replay from Level 1`.
9. **Host Script (`#fac` via `facLines`):**
   - Generates per-level host lines for Briefing (step 5) and Trial (step 7: SOP, Presentation Day, or stand-in trial).

---

## 3. Rules code changes

### `rules/Game.js`
- **`STEP_SECONDS` (new Level 3 logic):** Added `mirrorTrial: 75`. Other keys are unchanged.
- **`TIMER_SECONDS` (shared structure updated for Level 3):** Added `mirror: STEP_SECONDS.mirrorTrial`. This adds a new key to `Game.TIMER_SECONDS` (which `check_save.js` enumerates), without changing other timers.
- **`timerName()` (change to shared timer dispatch):** Added `if (t instanceof Trial.MirrorTrial && !this.didRun("runTrial")) return "mirror";` inside the `trial` step branch. Only fires for `MirrorTrial`.
- **`_closeTimerPhase(name)` (change to shared timer-close switch):** Added `case "mirror": this.closeMirror(); break;`. Only runs when the `"mirror"` timer closes.
- **`mirror()`, `setMirrorScore(team, attention)`, `closeMirror()` (new Level 3 logic):** New pass-through methods on `Game` to validate step/trial kind, record attention score, and close/rank the Level 3 trial.

### `rules/Round.js`
- **`LEVELS` row 3 (new Level 3 logic in shared table):** Changed Level 3 `trialName` from `"Q&A gauntlet"` to `"Presentation Day"` and `trialKind` from `"auto"` to `"mirror"`. Kept `attr: "focus"` and `cost: 3`.
- **`toJSON()` and `fromJSON()` (change to shared Round serialization):** Added `"mirrorResults"` to the copied round fields array `["sopBoards", "sopResults", "mirrorResults", "earnings", "done"]`. Only serializes `mirrorResults` when defined, so other levels' saves stay unchanged.

### `rules/Trial.js`
- **`Trial.forRound(round, rng)` (change to shared factory):** Added `if (round.trialKind === "mirror") return new MirrorTrial(rng);`. Only matches Level 3.
- **`Trial.fromJSON(data, ...)` (change to shared deserialization):** Expanded the `"sop"` branch to `data.kind === "sop" || data.kind === "mirror"` so saved `MirrorTrial` objects rebuild with their `scores` map. Existing `"sop"` behavior is unchanged.
- **`MirrorTrial` class and `Trial.MirrorTrial` export (new Level 3 logic):** New `Trial` subclass with `MAX_SCORE = 7`, `score(attention)`, `setScore`, `setMirrorScore`, `closeMirror` (keeps human teams' last score or 0, stores `round.mirrorResults`, calls `runTrial`), `rank` (gives unset/bot teams `this.randomBase()`, then calls `rankWithInfluence`), `kind` (`"mirror"`), and `toJSON`.

*(Note: `rules/rules.bundle.js` was rebuilt from those three files with matching changes.)*

---

## 4. Baselines and impact on other levels

### Current branch check (`level2-split-brief`)
- `npm run build`: passed (`Wrote rules\rules.bundle.js from 21 modules.`).
- `npm test`: passed all 12 baseline checks (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`).

### Why `Tests/baseline/check_save.txt` changed
- Hannah did not edit `Tests/check_save.js`, but `check_save.js` dynamically reads `Object.keys(Game.TIMER_SECONDS)` and samples up to 6 passed-deadline saves per timer.
- Adding the `"mirror"` timer caused `"mirror"` to appear in the list of saved/tested timers and raised the passed-deadline save count from `48 saves` (8 timers x 6) to `54 saves` (9 timers x 6).
- The total action saves in part 1 (`5492 saves`) stayed identical, and the final run-time text changed (`4.2 s` to `3.2 s`) due to normal machine timing.

### Why `Tests/baseline/check_teams.txt` changed
- Only the last line changed: `Full run time: 1.3 seconds.` became `Full run time: 1.8 seconds.`.
- Every game number in the file (graduation %, win % by type, type gap, and team-size splits) stayed identical.
- In all-bot games, `MirrorTrial.rank()` calls `this.randomBase()` once per team in team order and then calls `rankWithInfluence()`, consuming the exact same RNG draws and producing the exact same scores as `AutoTrial.rank()`.

### Would her changes alter game results for Levels 1, 5, 6, or 7?
- **Level 1:** No. Level 1 happens before Level 3 and uses `SopTrial`. None of her edits touch Level 1 rules, math, or RNG calls.
- **Levels 5, 6, and 7 in all-bot simulations:** No. Because `MirrorTrial.rank()` matches `AutoTrial.rank()` draw-for-draw when no human scores are set, bot-only games produce the exact same states through Levels 5, 6, and 7.
- **Levels 5, 6, and 7 in games with human players:** Not directly (she did not change `JudgedTrial`, `Vote`, or `Graduation`), but **indirectly yes**. Replacing Level 3's random roll with a real human score changes whether the human team wins Level 3 (4 vs 2 points earned, changing later stats), and skips one `rng()` draw per scored human team in Level 3, which shifts later seeded RNG outcomes in Levels 4 to 7.

---

## 5. Tests (`Tests/check_screens.js`)

Hannah added 194 lines to `Tests/check_screens.js` to test Levels 1 to 3 end to end in jsdom:

- **Updated `level1()`:** Changed the final check from `Level 2 locked` to `Start Level 2`.
- **Added `level2()` (Run 1, after Level 1):** Checks the Level 2 briefing (`Sprint 1`), clicks `#runTrial` on the stand-in trial screen, confirms `Score \d of 7`, skips the accusation, fast-forwards the gift window with `G.closeTimer()`, places all points, and confirms `Start Level 3` unlocks.
- **Added `level3()` (Run 1, Setup Crew path):**
  - Checks the Level 3 briefing (`Presentation Day`) and `PRESENTATION DAY` trial banner.
  - Tests the lobby: full team tile count, `"not a real login"` label, `#lobbyCd` countdown, one deliberate out-of-band miss (`lost the signal`), and grabbing all teammates in parallel until everyone is in.
  - Checks `CREW LOCKED` reveal, samples `mirRoles()` 14 times to confirm the crew deal is random, then pins the player onto Setup Crew (`crew: [ME, mt[0]], hype: mt.slice(1)`).
  - Checks even split with majority on setup, full member partition, random choreography array, `#attnPct` meter, and `[data-dancer]` count.
  - Tests every Setup step: deliberate wrong cable click (`Spark`) then connecting all 4 machines; slamming `+10` to trigger feedback reset then holding sound in the green until `soundOk`; waiting out the mic flash, triggering one wrong tap (`squeal`), then finishing all 3 memory rounds; waiting for `fileOrder` to reshuffle on its own, clicking a wrong file to verify attention drops, then grabbing `MEDLINE_deck_v3_CLIENT_SIGNED.pptx`; verifying 3 Q&A options and `#qaCd`, forcing a timeout on question 1 (`hesitate`), answering questions 2 and 3 right, and clicking `#wrapUp` (`Score \d of 7`).
  - Finishes Glitch Report, Gift Window, and Stats Update, and checks that `Level 4 locked` stays locked.
- **Added `danceCrew()` (Run 4, Dance Crew path):**
  - Uses `devJump(3)` to jump straight to Level 3, pins `S.mirror.roles` so the player draws Dance Crew (`hype: [ME, mt[2]]`), connects the team in the lobby, and waits for showtime.
  - Checks the rhythm lane (`#lane`) and bot setup checklist (`.bstep`, at least 5 steps).
  - Fires a real arrow `KeyboardEvent` inside the perfect window (checks `combo >= 1` and `danceBoost` rises) and a stray arrow key with no matching note (checks `combo === 0` and `pen` rises).
  - Waits for the bot setup crew to advance (`bsetup >= 2`) and wrap up the trial automatically (`sopDone()` and `Score \d of 7`).
- **Not tested:** She did not add any rule unit test file for `MirrorTrial`, and did not update `Tests/check_save.js` to call `setMirrorScore()` or `closeMirror()`.

---

## 6. Dev jump (`Ctrl+Shift+3`)

### How it works
- A global `keydown` listener at the bottom of `game.js` checks `e.ctrlKey && e.shiftKey && /^Digit([2-7])$/.exec(e.code || "")`. It handles `Ctrl+Shift+2` through `Ctrl+Shift+7`, not only `3`.
- Pressing the shortcut calls `devJump(n)`:
  1. Fills defaults if missing: `S.name = "Dev"`, `S.type = "coop"`, `S.spend = EP.Bots.typicalSpend("coop")`, and calls `newSession()` if `G` is null.
  2. Loops while `G.level < n && G.level < 7`: calls `fastForwardRound()` (steps through the active round using `G.advance()`, `EP.Bots.trial()`, `G.payTrialCosts()`, `G.closeGlitchReport()`, `G.closeGiftWindow()`, `G.placeAllRemaining()`, and `G.finishRound()` with no timers) and then calls `G.startNextRound()`.
  3. Starts timers (`G.start()`) if not running, resets round UI (`resetRoundScreen()`), marks `S.arrived = true`, updates badge progress (`S.prog`), and jumps to `go(5)` (Briefing).

### Could it reach players?
- **Yes.** The listener is always active in `game.js` with no environment flag, no URL flag, and no host check. It is also listed in `README.md`.
- Any player opening `index.html` (locally, on GitHub Pages, or in a deployed frontend) can press `Ctrl+Shift+2` through `Ctrl+Shift+7` at any point, even on the Sign-in screen before entering an `@icstars.org` email or join code.
- It also has a state bug if pressed for the current or an earlier level (`G.level >= n`): the loop does not run, but `devJump` still calls `resetRoundScreen()` and `go(5)`, putting the UI on Briefing while `G.step` is still in a later step.

---

## 7. Clashes with `level2-split-brief`

Both branches forked from the same parent line (`862d9fa`) and edited 9 of the same 10 files. Here is every shared file, function, and section where they clash:

### `rules/Round.js`
- **`LEVELS` array:** `level2-split-brief` changed row 2 (`trialKind: "splitBrief"`); `cdf3eff` changed row 3 (`trialName: "Presentation Day"`, `trialKind: "mirror"`).
- **`toJSON()` / `fromJSON()`:** `cdf3eff` added `"mirrorResults"` to the serialized round keys list.

### `rules/Game.js`
- **`TIMER_SECONDS`:** `level2-split-brief` added `splitBrief`; `cdf3eff` added `mirror` on the same line block.
- **`timerName()`:** Both added a `Trial.*` check inside the `s === "trial"` block.
- **`_closeTimerPhase(name)`:** Both added a `case` right after `case "sop"`.
- **Trial helper methods (right after `closeSop()`):** `level2-split-brief` added `splitBrief()` and `closeSplitBrief()`; `cdf3eff` added `mirror()`, `setMirrorScore()`, and `closeMirror()` in the exact same location.

### `rules/Trial.js`
- **File header comments:** Both edited the subclass list at the top of the file.
- **`Trial.forRound()` and `Trial.fromJSON()`:** Both added branches for their new trial kind (`"splitBrief"` vs `"mirror"`).
- **Class area after `AutoTrial`:** `level2-split-brief` added `SplitBriefTrial` (plus `import { Scenarios }`); `cdf3eff` added `MirrorTrial` right after `AutoTrial`.
- **Bottom exports:** Both added their subclass to `Trial.*` right next to `Trial.AutoTrial`.

### `rules/rules.bundle.js`
- Rebuilt bundle file clashes across all `Round`, `Trial`, and `Game` regions (must be regenerated with `npm run build`).

### `game.js` (largest clash)
- **Top data tables:** `level2-split-brief` added `level: 1` to `CLUES`, full 7-level `BRIEFINGS`, `LEVEL_HINTS`, `FAC_BY_LEVEL`, and `facLines(step, level)`. `cdf3eff` added `MIR_*` constants, `BUILT_LEVELS`, a 3-level `BRIEFINGS` (different field names: `shops` vs `workshops`, no `header`), and a 1-arg `facLines(step)`.
- **`fresh()` state:** `level2-split-brief` added `trialUI`; `cdf3eff` added `mirror: freshMirror()`.
- **Level progression helpers:** `level2-split-brief` added `resetRoundUI()` and `startNextLevel()`; `cdf3eff` added `nextLevel()`, `canStartNext()`, `resetRoundScreen()`, and a different `startNextLevel()`.
- **`drawTimer()`, `afterClose()`, and 250 ms `setInterval`:** `level2-split-brief` updated `drawTimer()` for `#floorTmr`/`#gwTmr`/`currentTrialView.tick` and added `writing`/`graduation` to `afterClose()`. `cdf3eff` hid `#tmr` when null, added `mirror` to `afterClose()`, and added `mirrorTick()` to `setInterval`.
- **`fwd()`, `goForward()`, `updateNav()`, `chrome()`:** `level2-split-brief` renamed `sopDone()` to `trialDone()`, added Graduation, Sprint 1 Complete, Final Results, and `facLines(S.step, R().n)`. `cdf3eff` kept `sopDone()`, `BUILT_LEVELS`, `canStartNext()`, and `facLines(S.step)`.
- **`V[5]` (Briefing):** Both replaced the hardcoded Level 1 briefing with `BRIEFINGS[R().n]` using incompatible object shapes.
- **`V[7]` (Trial) and `bind()` step 7:** `level2-split-brief` uses a `TRIAL_SCREENS` dispatch map (`{ html, bind, tick, waitHint }`) with separate view files (`splitbrief-view.js`, `judged-view.js`). `cdf3eff` uses an inline ternary (`sopView`, `mirrorView`, `autoView`) and inline click handlers inside `bind()`.
- **`V[9]` (Stats Update / End screen):** `level2-split-brief` added `END_SCREENS`, `sprint1CompleteScreen()`, `finalResultsScreen()`, `pointBuyHTML()`, and Graduation mode. `cdf3eff` edited the older single-card `.locked` block at the bottom of `V[9]`.
- **Menu version string (`V[1]`):** `cdf3eff` changed `v0.6 · cycle_60 · build 060-02` to `v1.1 · cycle_60 · build 060-10`.

### `styles.css`, `Tests/check_screens.js`, `README.md`, and baselines
- **`styles.css`:** Both appended new trial CSS at the very end of the file (Split Brief `.sb-*` vs Level 3 Presentation Day classes).
- **`Tests/check_screens.js`:** Both changed `level1()`'s final check (`Start Level 2`), added new test functions right after `level1()`, and added Run 4 in the `load` handler.
- **`README.md`:** Both edited the intro paragraph, "What's here" table, and `test:screens` bullet.
- **`Tests/baseline/check_save.txt` and `check_teams.txt`:** Both branches regenerated these snapshots for different rule sets.

---

## 8. Rule conflicts with `CLAUDE.md`

- **Level-to-attribute mapping and trial activity:**
  - Attribute (`focus`) and cost (`3`) match `CLAUDE.md`.
  - Trial activity conflicts: `CLAUDE.md` defines Level 3 ("The Mirror") as **Q&A gauntlet** (`AutoTrial` for now, later set answers). `cdf3eff` renamed it in `Round.LEVELS` to **Presentation Day** and turned it into a 6-part real-time arcade mini-game where players who draw the Dance Crew never see Q&A at all.
  - Her `BRIEFINGS[2]` text (title, memo, weeks, workshops) also disagrees with the Level 2 briefing spec in `CLAUDE.md`.
- **Open Floor ghost and tea guest hints:**
  - `CLAUDE.md` requires ghost (`USER_???`, `ATTEMPT_01`, `NULL`) and High Tea guest text to come from a per-level hint table, not hardcoded text.
  - `cdf3eff` did not update `world-map.js` or add a hint table. Players in Level 2 and Level 3 still see hardcoded Level 1 coffee-SOP hints.
- **Save and load (and OOAD / seeded RNG rules):**
  - `CLAUDE.md` requires all rule state and rule math to live in `rules/`, all randomness to use the seeded `Rng`, and `Game.toJSON()` / `Game.fromJSON()` to capture the full game state.
  - Almost all Presentation Day state and math live in `game.js` (`S.mirror`), not `rules/Trial.js`. `MirrorTrial.toJSON()` saves only `scores` and `ranking`, so reloading mid-trial loses the lobby, crew deal, step progress, penalties, and dance boost.
  - All Presentation Day randomness (lobby positions/speeds, crew shuffle, cable bag, sound spikes, mic sequences, file reshuffles, rhythm notes, bot setup 30% hiccups) uses `Math.random()` instead of `G.rng`.
- **Attendance (and Stuck/Idle handling):**
  - `CLAUDE.md` states that Stuck and Idle players are not active (`Team.active()`) and take no optional actions.
  - `mirRoles()` deals from `MYTEAM.members` instead of `MYTEAM.active()`, and none of the Level 3 click/key handlers check `ME.isStuck()` or `ME.idle`. A Stuck or Idle player is still required to connect in the lobby (or else the whole team fails) and can still play cables, mixer, mic, files, Q&A, or dance keys.
- **Status order and labels:**
  - `CLAUDE.md` specifies status order: **Stuck, Glitching, Idle, At risk, Active**.
  - `cdf3eff` still calls `ME.flag()` / `p.flag()` in `game.js` and `world-map.js`, which displays `"OK"` instead of `"Active"` and never shows `"Idle"`.
- **Attribute order:**
  - `CLAUDE.md` specifies attribute order: **Focus, Collaboration, Initiative, Grit, Composure**.
  - `cdf3eff` still has `A` in the old order: **Focus, Initiative, Collaboration, Composure, Grit**.
- **Other `CLAUDE.md` rules:**
  - **Anomalies on later levels:** `V[8]` renders all 3 Level 1 `CLUES` on every level, so Level 3's Glitch Report still displays Level 1 coffee-SOP clues.
  - **Hardcoded 4 teams:** `MIR_TEAMS` hardcodes `Team Kestrel`, `Team Wren`, `Team Finch`, `Team Heron` and `V[5]` hardcodes `Team Kestrel`, which breaks with 5-team (20-player) or 7-team (24-player) games and after team switches.
  - **Class diagram:** `CLAUDE.md` requires updating `docs/class-diagram.md` in the same commit whenever a class in `rules/` changes. `MirrorTrial` was not added to `docs/class-diagram.md`.

---

## 9. Missing pieces

- **Save and load support:**
  - Mid-trial Level 3 state (`S.mirror`) is not stored in `MirrorTrial` and cannot be saved or restored.
  - `Tests/check_save.js` was not updated to call `setMirrorScore()` or `closeMirror()`, so `MirrorTrial` scores and `round.mirrorResults` are never exercised by the save/load test.
  - Client-side `baseBoost` (computed when `phase` switches from `2` to `1`) is not saved, so a reload during showtime would change the attention math.
- **Hint table entries:**
  - No per-level hint table, no Level 3 ghost hints, and no Level 3 High Tea guest story.
- **Bot behavior:**
  - `rules/bots.js` has no Level 3 bot logic or `Bots.hooks` handling for `"mirror"`.
  - Bot-only teams receive a flat random 0 to 7 score.
  - On the human's team, bots cannot connect themselves in the lobby, and their dance/setup actions live in `game.js` using `Math.random()` without checking whether a bot is Stuck or Idle.
- **End screen and later briefings:**
  - No dedicated Level 3 completion screen (just the generic `Level 4 locked` card in `V[9]`).
  - `BRIEFINGS` stops at Level 3; Levels 4 to 7 fall back to generic one-line placeholders.
- **Multiplayer / server authority:**
  - `setMirrorScore(team, attention)` trusts a raw number from the client rather than validating trial actions inside `rules/Trial.js`.
  - Single-player only; multiple human players on the same team have no shared rule state for lobby joins, crew deal, setup steps, or dance boost.
- **Dead code and leftovers (no literal `TODO` comments were left):**
  - Unused constant `MIR_CABLES` in `game.js`.
  - Unused CSS rules in `styles.css` left from an earlier draft (`.twofa`, `.faopts`, `.cables`, `.cable.sel`, `.ltile.sel`, `.dkey.now`, `.dkey.hit`, `.mvg.used`).
  - No unit test file in `Tests/` for `MirrorTrial`.
  - Minor comment mismatches (`MIR_TRAVEL = 10` says `2 s` but is `2.5 s` at 250 ms/tick; `styles.css` has a `Level 1.0` comment header).
  - `docs/class-diagram.md` not updated.

---

## 10. Open questions for the design team

1. Should Level 3 stay the **Q&A gauntlet** described in `CLAUDE.md`, become Hannah's **Presentation Day** multi-stage mini-game, or use a smaller hybrid (for example, lobby + Q&A gauntlet)?
2. If we keep the random Setup Crew vs. Dance Crew split, how should it work in real multiplayer on Base44 when 3 to 5 human players share one team?
3. If we keep the 30-second lobby signal grab, should one player failing to connect fail the whole team in multiplayer, or only lock out that player?
4. Should Stuck and Idle players be excluded from the Level 3 lobby, crew split, and actions (matching `Team.active()` and `CLAUDE.md`)?
5. Should the 75-second trial timer include the 30-second lobby and 1-second reveal (leaving as little as 44 seconds for 5 setup steps), or should the lobby have its own separate phase/timer?
6. Should Level 3 score on a 0 to 7 scale with random ties (like SOP), or use a different scale or skill tie-breaker (such as earliest wrap-up or Q&A accuracy)?
7. Level 3 tests **Focus** (cost 3). Do the arcade reflex games (signal grab, moving cable belt, arrow rhythm lane) fit Focus, or should the tasks lean more toward Q&A, memory, and detail?
8. What are the final Level 3 ghost hints (`USER_???`, `ATTEMPT_01`, `NULL`), High Tea guest story, briefing copy, and host script lines so we can put them in our per-level tables?
9. What should the Level 3 end screen show once Level 3 Stats Update finishes (a milestone summary screen like Level 2's Sprint 1 Complete, or a direct button to Level 4)?
10. Do we want a dev-jump shortcut (`Ctrl+Shift+2..7`) in our rebuild, and if so, should it be hidden behind a dev-only flag (like `?dev=1`) so players cannot trigger it in a real game?

---

## Step 2b: SetupCrew (branch `level3-mirror`)

- **What was built:** Added `SetupCrew` inside `rules/MirrorParts.js` (with private `#` fields only) and wired it as private `#setup` on `MirrorTrial` in `rules/Trial.js` with `startShowtime()`, results-based action pass-throughs, read-only queries, and `toJSON`/`fromJSON` support.
- **Crew and step splits:** Supports active players only (`Team.active()`, excluding Stuck and Idle). Setup Crew gets half the team's active players rounded up, max 3, with extras on Dance Crew. Assigns sequential steps (`cables`, `sound`, `mic`, `deck`, `qa`) across 1, 2, or 3 Setup slots and enforces turn handoff as each step completes through last-slot `wrapUp`.
- **Results-based rules and seeded content:** Accepts reported hit/miss outcomes (`cableHit`, `cableMiss`, `soundHeld`, `soundFeedback`, `micTap`, `pickFile`, `reshuffleDeck`, `answerQa`, `timeoutQa`, `wrapUp`) with zero per-tick motion. Uses the injected seeded `EP.Rng` for slot order, mic memory sequences (lengths 3, 4, 5), 6-file drive order and reshuffles, Q&A item order, and bot setup milestone timing (`4, 10, 16, 22, 28, 34` seconds) with a 30% hiccup chance costing 3 attention.
- **Verification:** Rebuilt `rules/rules.bundle.js` (23 modules). Added `Tests/check_mirror_setup.js` (29/29 assertions passing) and registered it in `tools/baseline.js`. `npm test` passed 15/15 checks with all 14 existing baselines unchanged.

## Step 2c: DanceCrew (branch `level3-mirror`)

- **What was built:** Added `DanceCrew` inside `rules/MirrorParts.js` (with `#` private fields only) and wired it as private `#dance` on `MirrorTrial` in `rules/Trial.js`, along with showtime-only attention calculation, bot-only random attention, and three-part `toJSON`/`fromJSON` support.
- **Roster and averaging:** Reads the dancer roster straight from `SetupCrew.danceIdsFor()` (no duplicate crew split logic) across team sizes 3-6 and Stuck/Idle exclusions. Averages per-dancer boost (capped at 45) and penalties across active dancers (`0` dancers gives `0` boost and `0` dance penalty).
- **Results-based actions and bot timing:** Accepts screen-reported outcomes (`noteHit` perfect +3 / good +2, `noteMiss` +2 penalty, `strayPress` +1 penalty, zero per-tick motion). Uses seeded `EP.Rng` for bot dancer boosts (`+1` every 1.5 to 2.5 seconds, zero misses, cap 45) and idle human auto-pilot (`advanceBotDance`).
- **Attention and gating:** Gates all dance actions to unclosed showtime on `MirrorTrial`. Enforces attention (`100` in lobby/reveal so attention drains only during the 75-second showtime; `0` for lobby-locked teams; clamped `0..100` formula for active teams; seeded integer `0..100` for bot-only teams). Trial scoring/ranking stays deferred to the next step.
- **Verification:** Rebuilt `rules/rules.bundle.js` (23 modules). Added `Tests/check_mirror_dance.js` (23/23 assertions passing) and registered it in `tools/baseline.js`. `npm test` passed 16/16 checks with all 15 existing baselines unchanged.

## Step 2d: MirrorTrial scoring (branch `level3-mirror`)

- **What was built:** Completed `MirrorTrial` scoring in `rules/Trial.js` reading lobby, setup, and dance results through `#lobby`, `#setup`, and `#dance` public methods (`MirrorTrial.MAX_SCORE`, `MirrorTrial.score`, `scoreFor`, `lockedAttentionFor`, `failReasonOf`, `checkAttention`, `finishTeam`, `closeMirror`, `rank`), plus `toJSON`/`fromJSON` persistence of `#lockedAttention` and `#failReasons`.
- **Scoring and failure locks:** Converts clamped `0..100` attention to whole scores `0..7` (`Math.round((attention / 100) * 7)`). Lobby-failed teams score `0` with `failReason: "lobby"`, showtime attention hitting `0` locks failure at `0` with `failReason: "attention"` and blocks later actions, and wrap-up/finish locks exact attention against later clock ticks. Teams with `0` dancers score cleanly using setup penalties alone.
- **Ranking and tie-breaks:** Uses `Trial.rankWithInfluence` for light Focus influence (`0.5 * (team active Focus avg - all teams active Focus avg)`) with top-half winners (`Trial.winners`), breaks ties on final score by higher exact attention first (`0..100`), and breaks full ties randomly using `EP.Rng` (no `Math.random`). Bot-only teams reuse the Step 2c seeded random `0..100` attention.
- **Verification:** Rebuilt `rules/rules.bundle.js` (23 modules). Added `Tests/check_mirror_score.js` (15/15 assertions passing) with `Tests/baseline/check_mirror_score.txt` wired into `tools/baseline.js`. `npm test` passed 17/17 checks with all 16 existing baselines unchanged.

## Step 3: Timers and Game integration (branch `level3-mirror`)

- **Rule decision recorded:** Updated `CLAUDE.md` Level 3 scoring rules to record that a lobby-failed team's score of `0` still goes through `rankWithInfluence`, matching Levels 1 and 2 (already built in Step 2d).
- **What was built:** Added `MirrorTrial` timer constants (`LOBBY_SECONDS = 30`, `REVEAL_SECONDS = 1`, `SHOWTIME_SECONDS = 75`) and `round.mirrorResults` population in `rules/Trial.js`, serialized `mirrorResults` in `rules/Round.js` (keeping `LEVELS` row 3 on `auto` until Step 5), and integrated `mirrorLobby`, `mirrorReveal`, and `mirrorShowtime` deadline timers plus `MirrorTrial` coordinator pass-throughs and mid-trial save/load catch-up into `rules/Game.js` (including a `_closingPhase` re-entrancy guard and clock-drain check).
- **Save-check guard until Step 5:** Added a `hasMirror` filter to `Tests/check_save.js` so `ALL_TIMERS` only requires `mirrorLobby`, `mirrorReveal`, and `mirrorShowtime` once `Round.LEVELS` row 3 uses `"mirror"` in Step 5.
- **Verification:** Rebuilt `rules/rules.bundle.js` (23 modules). Added `Tests/check_mirror_timing.js` (21/21 assertions passing) and `Tests/baseline/check_mirror_timing.txt` registered in `tools/baseline.js`. `npm test` passed 18/18 checks with all 17 existing baselines unchanged.

## Step 4: Mirror bot hooks (branch `level3-mirror`)

- **What was built:** Added `Bots.mirror(game, now)` in `rules/bots.js` and wired `"mirrorLobby"` and `"mirrorShowtime"` into `Bots.hooks` (`onStart`, `onTick`, `beforeClose`) with zero `Game`-to-`Bots` coupling and no duplicated timing rules (`Bots.mirror` calls `MirrorTrial` and `Game` pass-throughs only).
- **Bot & idle behavior:** In lobby, bots connect at their seeded 3 to 15 s times (`botConnectTimes` / `mirrorConnect`), and humans who go idle mid-lobby auto-connect as auto-pilot so they do not lock out their team. In showtime, non-bot-only teams step in strict chronological order across `advanceBotDance` (+1 every 1.5 to 2.5 s, cap 45, zero misses) and `advanceBotSetup` (`botStepDueAt`, ~30% hiccup costing 3 attention, automatic wrap-up), checking 0-attention failure before each step so catch-up jumps never resurrect failed teams and match 250 ms/1 s runs identically. Bot-only teams stay skipped during setup/dance so they keep their `startShowtime()` seeded random 0 to 100 attention. Idle humans (`!isBot && !isStuck() && idle`) are primed via `advanceBotDance(..., 0)` when entering idle mid-showtime and follow bot setup/dance rules until `activity()` clears `idle`.
- **Verification:** Rebuilt `rules/rules.bundle.js` (23 modules). Added `Tests/check_mirror_bots.js` (20/20 assertions passing across lobby timing, early close, `beforeClose` catch-up, ordered setup & 100-seed hiccup rate, 250 ms dancer schedule & cap 45, bot-only random attention, mixed human/bot turns, idle auto-pilot + Attendance miss + activity return, mid-showtime save/load twins, and fixed-seed repeatability) and `Tests/baseline/check_mirror_bots.txt` registered in `tools/baseline.js`. `npm test` passed 19/19 checks with all 18 existing baselines unchanged.

## Step 5: Wire Level 3 into Round.LEVELS and save/load update (branch `level3-mirror`)

- **What was built:** Switched `Round.LEVELS` row 3 in `rules/Round.js` from `"auto"` (`"Q&A gauntlet"`) to `"mirror"` (`"Presentation Day"`), keeping Focus and cost 3 unchanged and making no changes to `rules/Game.js`, `rules/bots.js`, `game.js`, or screen files. Added the `mirrorLobby` wake-up rule to `CLAUDE.md`, removed the temporary `hasMirror` filter from `Tests/check_save.js`, added Mirror action driving and Part 4 (fixed-seed Level 1 to 7 full game with Level 3 Mirror and mid-Level 3 save/load match) to `Tests/check_save.js` with a `mirrorLobby` active-human sampling guard for Part 2, and updated the 6 temporary `Round.LEVELS[2]` guard assertions in `Tests/check_mirror_*.js` to expect `"mirror"`.
- **Invariance and baseline diffs:** Fixed-clock SHA-256 snapshots at the end of Level 1 and Level 2 across seeds `[1, 2, 3, 7, 11]` matched identically before and after switching row 3. Level 1/2 baselines (`check_gifts`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`) and `check_mirror_data` had zero diffs. The 6 `check_mirror_*` baselines changed only on their single `Round.LEVELS[2]` guard line. Full-game simulation baselines (`check_rules`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`) changed because Level 3 now runs `MirrorTrial` (0 to 100 random bot attention mapped to 0 to 7 with exact-attention tie-breaks instead of `AutoTrial`'s uniform 0 to 7), shifting Level 3 winners and downstream RNG draws in Levels 3 to 7. `check_save` changed to cover all 12 timers (72 passed-deadline saves, 6099 action saves, 15 passed assertions).
- **Balance before vs. after (`Tests/check_balance.js`, 2000 seeded games per setting):**
  - **Typical 16p:** Graduation `61.1%` -> `61.0%`; Win by type: Coop `69.6%` -> `70.7%`, Indep `73.3%` -> `73.1%`, Contra `71.8%` -> `71.7%` (gap `3.7` FAIL -> `2.4` PASS).
  - **Typical 20p:** Graduation `72.8%` -> `72.9%`; Win by type: Coop `81.1%` -> `81.0%`, Indep `80.5%` -> `81.5%`, Contra `80.0%` -> `80.4%` (gap `1.0` PASS -> `1.2` PASS).
  - **Typical 24p:** Graduation `69.7%` -> `69.3%`; Win by type: Coop `76.8%` -> `76.1%`, Indep `80.2%` -> `79.9%`, Contra `76.8%` -> `77.0%` (gap `3.3` FAIL -> `3.8` FAIL).
  - **Typical all:** Graduation `68.4%` -> `68.3%` (gap `2.1` PASS -> `2.3` PASS).
  - **Aware all:** Graduation `62.9%` -> `62.6%` (16p `54.7%` -> `54.1%`, 20p `68.1%` -> `68.1%`, 24p `63.9%` -> `63.6%`; Coop `67.6%/79.4%/75.2%` -> `68.0%/79.8%/75.1%`, Indep `59.5%/71.3%/68.3%` -> `58.0%/71.6%/68.2%`, Contra `70.9%/78.2%/74.0%` -> `69.8%/78.2%/73.6%`; overall gap `7.6` -> `8.2` FAIL).
- **Verification:** `npm run build` (23 modules) and `npm test` (19/19 checks passed against updated baselines).

## Step 6a: Level 3 flow, Briefing, Host Script, Hint Table, and Sprint 1 Complete unlock (branch `level3-mirror`)

- **What was built:** Added two read-only one-line pass-throughs on `Game` (`mirrorPhase()` and `trialRanking()`) in `rules/Game.js` and rebuilt `rules/rules.bundle.js` (23 modules). Updated `game.js` with exact approved `CLAUDE.md` copy for `BRIEFINGS[3]`, `LEVEL_HINTS[3]` (`USER_???`, `ATTEMPT_01`, `NULL`, and High Tea guest story), and `FAC_BY_LEVEL[3]` (Briefing, Trial `lobby`, and Trial `showtime` via phase-aware `facLines()`), keeping Host Script hidden from non-host players (`Ctrl+Shift+H` toggle). Replaced `"Level 3 locked"` on `sprint1CompleteScreen()` with `"Start Level 3 ▶"` (`#nextLevel`, hiding Focus until the briefing), unlocked Level 2 -> Level 3 navigation in `fwd()` and `goForward()`, removed the hardcoded `"Team Kestrel"` fallback in `V[5]`, and added a temporary Step 6a placeholder `trialMirrorScreen()` (`"Presentation Day: coming in Step 6b."`) in `TRIAL_SCREENS.mirror`.
- **Verification:** Extended `Tests/check_screens.js` to cover Sprint 1 Complete unlock, Level 3 Briefing exact copy and Focus cards, host-only Host Script visibility on Briefing and Trial lobby/showtime, Level 3 ghost and High Tea hint panels, Step 6a Trial placeholder completion, and zero work-style or secret-path leaks. `npm run build` (23 modules), `npm test` (19/19 checks passed, zero baseline diffs), and `npm run test:screens` (76 passed, 0 failed, 0 console errors) all passed.

## Step 6b: Presentation Day lobby and crew reveal (branch `level3-mirror`)

- **What was built:** Added five read-only one-line pass-throughs on `Game` (`mirrorLobbyTeam`, `mirrorCrew`, `mirrorSetupSlots`, `mirrorRole`, `mirrorFailReason`) in `rules/Game.js` and rebuilt `rules/rules.bundle.js` (23 modules). Created `mirror-view.js` (loaded in `index.html`, styled in `styles.css`, and routed from `trialMirrorScreen()` in `game.js`) implementing the Presentation Day Lobby (30-second countdown from the rules timer, active-player signal-grab tile with moving sweep, width-14 green band, miss wobble, and +2 speed-up up to 16, plus live teammate and bot connection tiles using `boardStatus()` with zero bot tags), Crew Reveal (`CREW LOCKED` showing Setup Crew slot order and step owners plus Dance Crew roster, or `LOBBY FAILED` with score 0 when a team misses the doors), the post-reveal showtime placeholder (`"Setup and Dance: coming in Steps 6c and 6d."` with a Finish trial button), and the closed-trial result view.
- **Verification:** Extended `Tests/check_screens.js` (inside `fullSevenLevelGame()` and Run 6 `mirrorStep6bCases()`) covering lobby countdown, signal-grab hit and miss speed-up, bot connections, 30s deadline close, lobby-failed team reveal (multi-team and solo-team cases), Crew Reveal splits and step owners for team sizes 3, 4, and 5, Stuck/Idle exclusion, `boardStatus()` flags, and zero work-style or secret-path leaks. `npm run build` (23 modules), `npm test` (19/19 checks passed, zero baseline diffs), and `npm run test:screens` (89 passed, 0 failed, 0 console errors) all passed.

## Step 6c-1: Setup Crew frame, cables and sound steps (branch `level3-mirror`)

- **What was built:** Added two read-only one-line pass-throughs on `Game` (`mirrorSetupTeam`, `mirrorDanceTeam`) in `rules/Game.js` and rebuilt `rules/rules.bundle.js` (23 modules). Updated `mirror-view.js` and `styles.css` for Level 3 showtime: Audience Attention bar driven by rules attention and `mirrorShowtime` timer, Setup Crew 5-step checklist frame (cables, sound, mic, deck, Q&A) with live owners (`boardStatus()`), live/done states, and setup hiccup attention cost (no bot tag), Dance Crew readout panel, Cables moving belt bound to live teams (`G.teams`, zero hardcoded team names) reporting hits and spark misses through `Game`, Sound check (`-10/+5/+10`, drift, jitter, crowd spikes, 100 feedback reset, and 3s green-zone hold reporting through `Game`), non-owner waiting view with step progress and turn handoff, Step 6c-2 placeholders (mic, deck, Q&A, wrap-up) routing through `Game`, and the Step 6d Dance Crew placeholder (`"Dance lane: coming in Step 6d"`).
- **Verification:** Updated `fullSevenLevelGame()` and added Run 7 `mirrorStep6c1Cases()` in `Tests/check_screens.js` covering 1/2/3 Setup splits, owner-only cables/sound gating, waiting views, hit/miss rule reporting and frame updates, turn handoff, bot step and hiccup cost display without bot tags, Dance Crew placeholder, Step 6c-2 placeholder flow to Level 3 completion, and zero work-style, secret-path, or hardcoded team leaks. `npm run build` (23 modules), `npm test` (19/19 checks passed, zero baseline diffs), and `npm run test:screens` (102 passed, 0 failed, 0 console errors) all passed.

## Step 6c-2: Setup Crew mic, deck, Q&A, and wrap up (branch `level3-mirror`)

- **What was built:** Added zero new `Game` pass-throughs (reused existing `mirrorSetupTeam`, `mirrorMicTap`, `mirrorPickFile`, `mirrorReshuffleDeck`, `mirrorAnswerQa`, `mirrorTimeoutQa`, and `mirrorWrapUp`). Replaced the Step 6c-1 Setup Crew placeholders in `mirror-view.js` and `styles.css` with Mic check (3/4/5 memory rounds flashing from seeded rules sequences, hiding behind `?`, reporting right/wrong taps), Grab the deck (6-file grid reading `EP.MirrorData.files` in seeded `fileOrder` with 8-tick auto-reshuffles and 2-tick wrong-file spite reshuffles), Rapid-fire Q&A (reading `EP.MirrorData.qaItems` in seeded `qa.order` with a 29-tick countdown bar, 8-tick low warning, timeout reporting, and +5 penalty recovery / -5 penalty), and Wrap up (`#wrapUp` shown only for the last Setup slot owner and calling `G.mirrorWrapUp`), all integrated into the existing Setup Crew checklist frame and waiting view (`boardStatus()` only, zero `game.js` changes, Dance Crew kept on its Step 6d placeholder).
- **Verification:** Updated `fullSevenLevelGame()` and `mirrorStep6c1Cases()` and added Run 8 `mirrorStep6c2Cases()` in `Tests/check_screens.js` covering seeded content determinism, owner-only gating, penalties/recoveries/countdowns, 1/2/3 Setup slot handoffs through Level 3 completion, bot-owned mic/deck/Q&A hiccups and automatic wrap up without bot tags, and zero work-style or secret-path leaks. `npm run build` (23 modules), `npm test` (19/19 checks passed, zero baseline diffs), and `npm run test:screens` (113 passed, 0 failed, 0 console errors) all passed.
