# Exit_ProtocoL Prototype Report (for Level 2 Planning)

- **Branch read:** `ben-ooad`
- **Scope:** Read-only summary of how the current prototype works, where rules and screen code live, and what stops the browser game after Level 1.

---

## 1. Project map

### Source files

**Rules (`rules/`, ES modules)**
- `rules/index.js`: Re-exports all 20 rule/bot modules in bundle load order.
- `rules/Rng.js`: Seeded, saveable mulberry32 random number generator.
- `rules/Hearts.js`: Owns a player's heart count (start 3, cap 3) and its mutations.
- `rules/CharacterType.js`: Base `CharacterType` and `Cooperative`, `Independent`, `Contrarian` subclasses.
- `rules/Wallet.js`: Earned points, placement draft, Skim, and Cash Out.
- `rules/PlayerStatus.js`: Glitch count, idle flag, pending attendance glitch, and status flags.
- `rules/Attributes.js`: Five stats, ability rolls, trial cost payment, losses, gifts, and stat reboot.
- `rules/PathTracker.js`: Second-path progress, graduation checks, and locked ending.
- `rules/Player.js`: Coordinates type, hearts, and its 4 private parts (`Attributes`, `PlayerStatus`, `PathTracker`, `Wallet`).
- `rules/Team.js`: Team members, active filter, round win flag, and `trialWins`.
- `rules/Sabotage.js`: Contrarian-only sabotage rules, heart cost, and Composure-scaled drain.
- `rules/Accusation.js`: Once-per-round accusation check, Focus save roll, and caught tracking.
- `rules/Gift.js`: Gift cost, Collaboration discount, Independent refusal, overflow refund, and Lifeline credit.
- `rules/Round.js`: Level table (`LEVELS`), step order (`STEPS`), round records, and round action delegation.
- `rules/Vote.js`: Judged-trial ranked-choice ballots, Initiative weighting, and normalized team tally.
- `rules/Trial.js`: `Trial` base class plus `SopTrial` (Level 1), `AutoTrial` (Levels 2-4), and `JudgedTrial` (Levels 5-6).
- `rules/Attendance.js`: Idle and "Still there?" popup timers and missed check-in detection.
- `rules/Timer.js`: Step timer deadlines, injected clock, `tick()`, `close()`, and JSON save/restore.
- `rules/Economy.js`: Trial cost collection, Stats Update earnings, point placement, and Cash Out.
- `rules/Game.js`: Front-desk engine enforcing step order, timers, attendance, board view, and `toJSON`/`fromJSON`.
- `rules/bots.js`: Bot decision logic and `Bots.hooks` (`onStart`, `beforeClose`) for prototype/tests.
- `rules/rules.bundle.js`: Generated single-script browser bundle exposing `globalThis.EP`.

**Screens and UI (`/` and `pages/`)**
- `index.html`: Main prototype shell loading `rules.bundle.js`, shared views, and `game.js`.
- `game.js`: Session setup, step navigation (`V[0]`-`V[9]`), HUD, code rain, elevator intro, and button wiring.
- `world-map.js`: Static office preview map, walkable Floor 60 map, collision, rooms, ghosts, tea guest, and minimap.
- `pixel-art.js`: Pixel Intern SVG sprite engine, wardrobe items, tools, and instructor dialogs.
- `board.js`: Shared read-only Progress board modal (`BoardView`) fed by `Game.board()`.
- `attendance-view.js`: Shared "Still there?" popup and activity listener (`AttendanceView`).
- `fullscreen-view.js`: Shared full-screen toggle button (`FullscreenView`).
- `styles.css`: Layout, palette, readable mono font (`--px:var(--mono)`), and component styles.
- `pages/vote-test.html` & `pages/vote-test.js`: Standalone test UI for Levels 5-6 writing and voting.
- `pages/character-concepts.html` & `pages/character-system.html`: Static character concept and system reference pages.

**Build and tests (`tools/`, `Tests/`)**
- `tools/build-rules.js`: Concatenates `rules/*.js` (using `rules/index.js`) into `rules/rules.bundle.js`.
- `tools/baseline.js`: Runs 8 rule tests and compares or saves output snapshots in `Tests/baseline/`.
- `Tests/check_bundle.js`: Verifies `rules/rules.bundle.js` matches `rules/*.js`.
- `Tests/check_rules.js`: Runs 1,000 seeded bot games for overall graduation and type-gap sanity.
- `Tests/check_gifts.js`: Unit tests for gift sending, accepting, declining, overflow, and Independent refusal.
- `Tests/check_steps.js`: Unit tests verifying `Game` rejects calls made in the wrong step.
- `Tests/check_teams.js`: Runs 1,000 bot games each at 16, 20, and 24 players to check team-size fairness.
- `Tests/check_balance.js`: Runs 2,000 bot games per setting (16/20/24 players, typical/aware spending).
- `Tests/check_cheese.js`: Tests 4 exploit strategies (hearts-first, switcher, same-type, small-teams) vs normal play.
- `Tests/check_save.js`: Verifies `Game.toJSON`/`fromJSON` round-trips every step and catches up passed deadlines.
- `Tests/check_screens.js`: Runs Level 1 in jsdom twice (`Replay Level 1`), checking timers, console errors, and Contrarian UI.
- `Tests/v2_balance/sim_v2.py`: Python reference simulation for game balance.

### Classes
- `Rng` (`rules/Rng.js`): Seeded PRNG with `getState()` and `setState()`.
- `Hearts` (`rules/Hearts.js`): Encapsulates heart count (0-3) with `spend`, `refill`, `refund`, `lose`, `empty`.
- `CharacterType`, `Cooperative`, `Independent`, `Contrarian` (`rules/CharacterType.js`): Type bonuses, penalties, gift costs, abilities, and second-path rules.
- `Wallet` (`rules/Wallet.js`): Tracks `earned`, `draft`, `placedThisRound`, `skimUsed`, and `cashOutUsed`.
- `PlayerStatus` (`rules/PlayerStatus.js`): Tracks `glitches`, `idle`, `attendancePending`, and status labels.
- `Attributes` (`rules/Attributes.js`): Manages the 5 attributes, ability rolls, shortfalls, gifts, and reboot.
- `PathTracker` (`rules/PathTracker.js`): Tracks second-path progress and locks graduation/ending at `results()`.
- `Player` (`rules/Player.js`): Public facade for a single intern, delegating to its 4 private sub-objects.
- `Team` (`rules/Team.js`): Holds team members, `won`, and `trialWins`.
- `Sabotage` (`rules/Sabotage.js`): Validates and applies sabotage heart cost and attribute drain.
- `Accusation` (`rules/Accusation.js`): Validates and resolves teammate accusations and caught status.
- `Gift` (`rules/Gift.js`): Validates and resolves gifts, discounts, refusals, expirations, and rescues.
- `Round` (`rules/Round.js`): Holds level config, step index, round logs, and delegates round actions.
- `Vote` (`rules/Vote.js`): Collects top-3 other-team ballots and tallies normalized Initiative-weighted scores.
- `Trial`, `SopTrial`, `AutoTrial`, `JudgedTrial` (`rules/Trial.js`): Ranks teams per round and marks top half as winners.
- `Attendance` (`rules/Attendance.js`): Tracks idle time and check-in popup countdown per player.
- `Timer` (`rules/Timer.js`): Manages active phase deadline, `secondsLeft()`, and `tick()` catch-up.
- `Economy` (`rules/Economy.js`): Computes trial cost payments, round earnings, Cash Out, and point placement.
- `Game` (`rules/Game.js`): Orchestrates round progression, step enforcement, attendance, timers, and serialization.

---

## 2. Round flow

- **Exact order (Levels 1-6)** (`Round.STEPS` in `rules/Round.js:19`):
  1. `briefing` (no player actions)
  2. `openFloor` (sabotage, gift, answerGift, switchTeam)
  3. `trial` (SOP / Auto / Writing + Vote, then `runTrial` and `payTrialCosts`)
  4. `glitchReport` (accuse, `endGlitchReport` / `closeGlitchReport`)
  5. `giftWindow` (gift, answerGift, `closeGiftWindow` runs `lockIn` and `computeEarnings`)
  6. `lockIn` (internal step executed inside `closeGiftWindow()` -> `lockIn()`)
  7. `statsUpdate` (`computeEarnings`, `cashOut`, `draftPoint`/`lockPoints`, `finishRound`)
  8. `intermission` (state between rounds when `finishRound` is in `round.completed`, or before Level 1 when `round === null`)
- **Level 7 order** (`Round.FINAL_STEPS` in `rules/Round.js:20`): `briefing` -> `graduation` (place points, `results()`).
- **Where enforced:** `Game` (`rules/Game.js:229-260`) via `wrongStep()`, `mustBe()`, `once()`, `REQUIRED` (`trial: "payTrialCosts"`, `glitchReport: "endGlitchReport"`, `lockIn: "lockIn"`), and `advance()`.
- **Timed steps and durations** (`TIMER_SECONDS` in `rules/Game.js:45-73`):
  - `intermission` (Level 0 before Level 1 only): **90s**
  - `openFloor`: **90s**
  - `sop` (Level 1 trial, until `runTrial`): **60s**
  - `writing` (Levels 5-6 `JudgedTrial.WRITING_SECONDS`): **180s**
  - `glitchReport`: **30s**
  - `giftWindow`: **30s**
  - `statsUpdate`: **30s**
  - `graduation` (Level 7): **60s**
  - Untimed steps: `briefing`, `trial` in Levels 2-4, `vote` in Levels 5-6, and `intermission` after Level 1+.

---

## 3. Level 1, screen by screen

All screens are `V[0]` through `V[9]` in `game.js`:
1. **`V[0]` Sign in (`game.js:199-209`)**: Enter `@icstars.org` email and join code (`CYCLE60`). Clicking the capital `L` in `EXIT_PROTOCOL` (`#theL`) logs the `ERROR` anomaly.
2. **`V[1]` Menu (`game.js:211-251`)**: Choose `Play`, `How to play` (4 instructor dialogs + onboarding packet), `Wardrobe`, or side tabs (`Office map` preview with hopping ghosts, `Memos`, `My badge` where clicking `ATTEMPT 02` logs `WATCHER`).
3. **`V[2]` Wardrobe (`game.js:255-269`)**: Customize body, skin, hair, outfit, accessories, office tool (cosmetic only today), and display name (2-16 chars).
4. **`V[3]` Work style (`game.js:271-279`)**: Pick secret type (`Cooperative`, `Independent`, `Contrarian`) and spend 15 attribute points. Confirming calls `newSession()` (`Bots.soloGame`).
5. **`V[4]` Arrival & Lobby (`game.js:282-288, 385-439`)**: Elevator cutscene (`elev`) -> `ADMIN_0` dialogue (`admin`) -> type lead briefing (`role`) -> spawn (`spawn`) -> walkable Floor 60 lobby (90s `intermission` timer starts). Player can walk rooms, talk to ghosts/Rook/tea guest, and click `Start Level 1`.
6. **`V[5]` Briefing (`game.js:294-297`)**: Reveals Level 1 (`Boot Up: Team Week`), tests `Grit`, cost `2`. Untimed. Clicking `Open the floor` advances to `openFloor`.
7. **`V[6]` Open Floor (`game.js:299-300`)**: Walkable Floor 60 map (90s timer). Player can walk to Kitchen (gift teammates), Breakout Room (Contrarians can sabotage teammates), High Tea (read guest story), Reception (logs `WATCHER` anomaly), Conference Room, Wellness Room, All Skate, or listen to ghosts / talk to Rook.
8. **`V[7]` The Trial (`game.js:302-308`)**: Coffee SOP mini-game (60s timer). Tap available steps onto the shared Team SOP board, reorder/remove, `Reset`, or `Submit SOP`. Shows team score (0-7), team ranking, and WIN/LOSS. Clicking `All-hands` pays trial cost and advances to `glitchReport`.
9. **`V[8]` Glitch Report & Gift Window (`game.js:310-327`)**:
   - First shows Glitch Report (30s timer): trial result, cost paid, sabotage drain notice if hit, 3 anomaly clues (`ERROR`, `WATCHER`, `LOOP` or `???` hints), and `Accuse` / `Skip` dropdown.
   - Once accusations resolve, opens Gift Window (30s timer): shows caught notices, incoming gifts (`Accept`/`Decline`), and teammate gift buttons. When the 30s timer expires, `closeGiftWindow()` locks in glitches, runs reboot/Empathy, computes earnings, and moves to `statsUpdate`.
10. **`V[9]` Stats Update (`game.js:360-372`)**: Shows earned points breakdown, `Cash Out` button (Independents with full hearts), point placement `+`/`-` UI (30s timer), Status (`At risk` check), own ability chances, and secret path progress. Clicking `Lock in points` calls `G.lockPoints(ME)` and `G.closeTimer()`.

---

## 4. Ghosts and tea guests

### Where they are defined
- **Ghosts:** `const GHOSTS` in `world-map.js:2-5` (array of 3 objects). Fields: `n` (name), `a` (avatar object), `line` (hint string). Static map spots: `GSPOTS` (`world-map.js:6`). Walkable map spots: `W.ghostPos` (`world-map.js:207, 231`), picking from `WROOMS[i].spots`.
- **Tea guest:** Drawn inline in `worldSVG()` (`world-map.js:151`) at `(1790, 520)` labeled `Guest · Sponsor`. Text is hardcoded in `roomPanel()` (`world-map.js:185`) when `r === "hightea"`. (Note: one non-ghost hallway NPC, `ROOK` from Team Wren at `{x:1690, y:745}` in `world-map.js:152, 192-193`, says `"Same trial as you this round. Good luck in there."`.)

### Every ghost and tea guest
- **`USER_???`**: `"Did you read your badge? Read it again."` (`world-map.js:3`)
- **`ATTEMPT_01`**: `"The coffee step that never ends... leave it out."` (`world-map.js:4`)
- **`NULL`**: `"Someone on Team Wren keeps slipping into the Breakout Room."` (`world-map.js:5`)
- **`Guest · Sponsor` (High Tea)**: `"When I wrote my first SOP, I put in a step that never ended. A good procedure has no step that sends you in circles. If a step never ends, it doesn't belong."` (`world-map.js:151, 185`)

### How clues are triggered, who sees them, and when
- **Triggering:**
  - *Static Office Map (`V[1]`)*: `ghostHop()` (`world-map.js:260-261`) fades `.gwalk` ghosts in/out at random `GSPOTS` every 2600 ms. Clicking a visible ghost triggers `#whisper` toast (`world-map.js:262`) for 6 seconds.
  - *Walkable Floor 60 (`V[4]` Lobby, `V[6]` Open Floor)*: `initWorld()` (`world-map.js:231-232`) toggles `W.ghostPos` every 2800 ms. Walking within 120 px of a visible ghost sets `USE` / `E` to `"Listen"` (`useAction()`, `world-map.js:241`), opening `ghostPanel()` (`world-map.js:194`). Walking >140 px away closes it.
  - *Tea guest (`V[4]` Lobby, `V[6]` Open Floor)*: Entering `hightea` sets `USE` / `E` to `"Network"` (`useAction()`, `world-map.js:248`), opening `roomPanel()` (`world-map.js:185`). Leaving the room closes it.
- **Visibility & randomness:** Only the local human player sees them. Clue text is fixed; ghost visibility and spawn positions are random.
- **Rule/score impact:** **Text only.** Ghosts and tea guests do not change any rule, attribute, heart, or `ANOMALIES` count (`game.js:46`: `Ghosts give hints only`).
- **Code location:** **Screen code only** (`world-map.js` and `game.js`). Not found in `rules/`.

---

## 5. Where the browser game stops

After Level 1's Stats Update (`roundDone()` is true), `V[9]` (`game.js:372`) displays a `LOCKED` card for Level 2 and `Replay Level 1` / `Back to sign-in` buttons, while `fwd()` (`game.js:143`) disables the footer Next button:
```js
case 9:return{label:roundDone()?`Level ${R().n+1} locked`:"Lock in points",ok:!roundDone()&&placeLeft()===0,cls:roundDone()?"soft":"green"};
```

**Level-1-only code blocking Level 2:**
- `game.js:138` (`fwd` case 4): Hardcodes `"Start Level 1 ▶"`.
- `game.js:141, 166, 186` (`fwd` case 7, `updateNav`, `chrome`): Uses `sopDone()` and `"Submit your SOP first"`.
- `game.js:143, 148-159, 372` (`fwd`, `goForward`, `V[9]`): `V[9]` has no path to `G.startNextRound()` + `go(5)`; it only offers `#replay` (which calls `endSession()` and restarts at `S.step = 3`).
- `game.js:294-297` (`V[5]` Briefing): Hardcodes `"System Briefing · Level 1"`, `"Boot Up: Team Week"`, Medline RFP memo, `"Weeks 1–2"`, and `"LW2A/LW2B"` workshops.
- `game.js:302-308, 446, 498-503` (`V[7]` Trial, `render`, `bind`): Hardcodes coffee `SOP`, `DECOY`, `G.sopBoard`, and `G.round.sopResults`.
- `game.js:49` (`FAC`): Host script entries `FAC[5]`-`FAC[7]` hardcode Grit, cost 2, and SOP.
- `world-map.js:80` (`LOCKS`): Visual-only barriers labeled `ACCESS · LVL 3` and `LVL 4` (decorative, not enforced by `walkable()`).

---

## 6. Trials

- **`Trial` base class (`rules/Trial.js:13-116`):**
  - Provides `run(round, teams)`, `runTrial(round, teams)`, `sortBy(entries, keys)`, `rankWithInfluence(round, teams, baseOf)`, `randomBase()`, `static winners(nTeams)`, `static influence(round, teams)`, `static forRound(round, rng)`, `toJSON()`, and `static fromJSON()`.
  - A new subclass must implement `rank(round, teams)` returning `[{ team, ...details }]` sorted best-first, plus a `kind` getter and `toJSON()`/`fromJSON()` handling if it holds state.
- **`SopTrial` (`rules/Trial.js:119-182`):**
  - Any non-Stuck player on the team can overwrite `round.sopBoards[team.id]` via `setSopBoard(round, p, team, built)` (validates steps against `SopTrial.STEPS` + `SopTrial.ENDLESS` and no duplicates).
  - At timer end, `closeSop(round, teams)` scores each human team's board (`SopTrial.score`: 1 per step in right index 0-5, +1 if non-empty and `ENDLESS` is omitted, max 7) and calls `runTrial()`. Bot-only teams get `randomBase()` (0-7). Then `rankWithInfluence()` adds `0.5 * (teamAvg - allTeamsAvg)`.
  - A new Level 2 trial could reuse the `round.sopBoards` pattern (or a generalized `boardState` on a new `Trial` subclass), but `SopTrial.setSopBoard` currently validates against coffee `SopTrial.STEPS` and `SopTrial.ENDLESS`.
- **`AutoTrial` (`rules/Trial.js:191-193`):**
  - Used for Levels 2-4 (`Round.LEVELS` `trialKind: "auto"`). Calls `rankWithInfluence(round, teams, () => this.randomBase())` (random 0-7 plus light influence).
- **`JudgedTrial` (`rules/Trial.js:227-337`):**
  - Used for Levels 5-6; manages prompt selection, 180s timed writing submissions (max 300 chars, early close when all active players submit), and `Vote` tallying.
- **Rankings to wins (`rules/Trial.js:25-35`):**
  - `Trial.winners(nTeams)` = `Math.ceil(nTeams / 2)` (e.g., 4 teams -> 2 win; 5 -> 3; 7 -> 4). `run()` sets `r.team.won = i < w` and increments `r.team.trialWins` for winners.

---

## 7. Communication

- **Not found** in `rules/` or screen code (`game.js`, `world-map.js`, `board.js`). There is no player-to-player chat, notes, or messaging system today. Only `#whisper` (ghost clicks on static map) and `Game.board()` (read-only status/wins/Level 5-6 submissions) exist.

---

## 8. Supporting systems

- **Timer (`rules/Timer.js`, `rules/Game.js:98-148`):** `Game._makeTimer(clock)` wraps `Timer` with `TIMER_SECONDS`. `Timer.refresh()` checks `Game.timerName()`; when entering a timed phase, it stores `this.current = { name, key, deadline: this.now() + durations[name] * 1000 }` (never stores seconds left). `Game.tick()` closes expired timers in order from each timer's own deadline.
- **Bots (`rules/bots.js`):** Bots connect only via `Game` `hooks`: `beforeClose(game, name)` runs `Bots.openFloor` (50% Contrarian sabotage, At-risk targets first) and `Bots.accusations` (90% victim / 25% mate / 5% idle, 1/3 pick saboteur), while `onStart(game, name)` runs `Bots.gifts` (Coop 100%, others 25% to Glitching mates, 80% accept), `Bots.statsUpdate` (Independent Cash Out + `Economy.allocate`), and `Bots.graduation`. `Bots.trial` handles Level 5-6 bot submissions (`"Bot answer"`) and random 3-player votes.
- **Save and load (`rules/Game.js:544-582`, `rules/Trial.js:90-115, 181, 331-336`):** `Trial.toJSON()` saves `{ kind, ranking }` (teams by id), plus `scores` for `SopTrial`, and `level, prompt, writing, submissions, vote.ballots` for `JudgedTrial`. `Round.toJSON()` saves `sopBoards`, `sopResults`, `earnings`, `done`, and `trialState`. `Game.fromJSON()` rebuilds all objects, restores `Rng` and `Timer`, and calls `tick()` to catch up passed deadlines.
- **Attendance (`rules/Attendance.js`, `rules/Game.js:41, 159-172`):** `Game.PAUSED_STEPS` pauses attendance during `briefing`, `intermission`, `glitchReport`, and `statsUpdate`, and in `graduation` once `over || p.earned === 0`. `Game.syncAttendance()` runs on step changes and before `checkAttendance()`, giving a fresh 60s clock on resume.
- **Level-to-attribute and cost table (`rules/Round.js:8-16`):**
  1. Boot Up: `grit`, cost `2` (`sop`)
  2. Sprint 1: `collab`, cost `3` (`auto`) — **matches** Collaboration, cost 3
  3. The Mirror: `focus`, cost `3` (`auto`)
  4. Geek Week: `initiative`, cost `4` (`auto`)
  5. Sprint 2: `composure`, cost `4` (`judged`)
  6. Sprint 3: `composure`, cost `5` (`judged`)
  7. Graduation: `null`, cost `0` (`null`)

---

## 9. Tests

- **npm scripts (`package.json:5-10`):**
  - `npm run build`: Runs `node tools/build-rules.js` to regenerate `rules/rules.bundle.js`.
  - `npm run baseline`: Runs `node tools/baseline.js save` to write `Tests/baseline/*.txt`.
  - `npm test`: Runs `node tools/baseline.js check` to run 8 tests (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`) and diff against `Tests/baseline/`.
  - `npm run test:screens`: Runs `node Tests/check_screens.js` (jsdom browser test of Level 1 + replay).
- **Fixed-seed baseline:** `tools/baseline.js save` executes each `Tests/check_*.js` (except `check_bundle`) with fixed seeds (`Rng.seeded`) and writes stdout to `Tests/baseline/<name>.txt`.

---

## 10. Mismatches

1. **Points screen (`CLAUDE.md:34` vs `game.js:277-279`):** `CLAUDE.md` says "show one number per stat, with the type bonus already applied." `V[3]` in `game.js` still displays both `P.START_EACH + S.spend[a.k]` in the stepper and `final ${P.startValue(...)}` beside it.
2. **SOP active-player check (`CLAUDE.md:151` vs `rules/Trial.js:152-154`):** `CLAUDE.md` says "Any active teammate can edit it." `SopTrial.setSopBoard` blocks `p.isStuck()` but does not check `p.idle`.
3. **WATCHER anomaly trigger (`CLAUDE.md:217` vs `world-map.js:255`):** `CLAUDE.md` describes `WATCHER` as the badge (`ATTEMPT 02`), which `game.js:470` logs on `V[1]`; `world-map.js:255` also logs `S.found.id = 1` when checking in at Reception on Floor 60.
4. **Comment path (`rules/bots.js:2`):** Comment references `Tests/sim_v2.py`; actual file is `Tests/v2_balance/sim_v2.py`.

---

## 11. Risks for adding Level 2

1. **`game.js` navigation and `V[9]` hardcode a 1-level loop:** `V[9]` locks Level 2 and `fwd()`/`goForward()` have no "Next Level" transition to call `G.startNextRound()` and `go(5)`.
2. **`V[5]` Briefing and `FAC` script are Level-1-only:** `V[5]` has no per-level data table for Level 2's briefing text, phase dates, or workshops.
3. **`V[7]` Trial assumes `SopTrial`:** `chrome()`, `fwd()`, `updateNav()`, `render()`, and `bind()` call `sopDone()` and `G.sopBoard()`, which will throw or misbehave on `AutoTrial` (or a new Level 2 `Trial` subclass).
4. **Ghosts/tea guest are static to Level 1:** `GHOSTS` and `hightea` in `world-map.js` only contain Level 1 SOP/Team Wren hints and have no per-level hint table.
5. **No Level 2 mini-game UI or `Trial` subclass yet:** `AutoTrial` returns a random 0-7 score + influence with no interactive screen; replacing it requires a new `Trial` subclass, `Timer` phase (if timed), `toJSON`/`fromJSON` support, and `Tests/check_save.js` / `Tests/baseline/` updates.
