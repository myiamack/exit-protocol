# Exit_ProtocoL: game index (start here)

Updated Nov 8, 2026. One place that points to everything about the game. Game deadline: **Nov 23, 2026**.

## What the game is
"Performance_Review: Exit_ProtocoL" (title in use: **Exit_ProtocoL**, capital L on purpose). A multiplayer web game for 16–24 players in teams of 4, run by a non-playing host (the System Administrator). Players are Pixel Interns trapped in an office simulation on Floor 60. Seven rounds follow the Cycle 60 journey: Boot Up → Sprint 1 → The Mirror → Geek Week → Sprint 2 → Sprint 3 → Graduation. Players graduate (exit) or get "contract renewed."

## Live prototypes (always the newest version)
| What | Live link | In this repo |
|---|---|---|
| Playable prototype (start, login, menu, arrival, Level 1, walkable floor) | https://claude.ai/artifact/24Vef8qcmejfTufk1CCcD3 | `index.html` |
| Character system (Pixel Intern builder, instructors, tools, cursor, holograms + ghosts) | https://claude.ai/artifact/KmNvHPM9t5TCwa4N3cqBNZ | `pages/character-system.html` |
| Character concepts (6 original directions) | https://claude.ai/artifact/RzYThjbpPVeRSHqhfVXmsc | `pages/character-concepts.html` |

## Level 2 & architecture docs
- `docs/game-report.md`: High-level report on how Level 1, rules, ghosts/tea guests, and trials work today.
- `docs/level2-progress.md`: Step-by-step build plan and progress tracker for Level 2 (Split Brief).
- `AGENTS.md`: Agent startup and Windows PowerShell 5.1 terminal rules.
- `rules/scenarios.js`: Level 2 Split Brief scenario data (4 tasks, 5 cards, twist card, pre/post answer keys, and bot notes).
- `splitbrief-view.js`: Level 2 Split Brief trial screen (private cards, team notes feed, 2-slot board, Lock In, and twist popup).
- `judged-view.js`: Shared Levels 5–6 writing, voting, and result screen extracted during Level 2 cleanup.
- `Tests/check_scenarios.js`: Data-shape tests for `rules/scenarios.js` (`Tests/baseline/check_scenarios.txt`).
- `Tests/check_split_brief.js`: Unit tests for `SplitBriefTrial` dealing, shuffling, notes, board, Lock In, twist, scoring, tie-break, and save/load (`Tests/baseline/check_split_brief.txt`).
- `Tests/check_split_timing.js`: Timer and mid-trial save/load tests for 180s trial, 90s twist, and early close (`Tests/baseline/check_split_timing.txt`).
- `Tests/check_split_bots.js`: Bot note-timing, 1-note reserve, and 3-note cap tests for Split Brief (`Tests/baseline/check_split_bots.txt`).

## Level 3 (The Mirror: Presentation Day)
- **Docs:**
  - `docs/level3-progress.md`: Step-by-step build plan and progress tracker for Level 3 (The Mirror: Presentation Day; designed by Hannah Ziegler).
  - `docs/level3-report.md`: Code report on Hannah Ziegler's `cdf3eff` prototype plus Step 2b to Step 9 summaries, portfolio counts, and `rules/Game.js` pass-through watch.
  - `docs/class-diagram.md`: Updated in Step 9 (commit `ce6661f`, branch `level3-mirror`) with `MirrorTrial`, `MirrorLobby`, `SetupCrew`, `DanceCrew`, `MirrorData`, and updated `Game`, `Team`, `Round`, `Bots`, and `Trial`.
- **Rules files and classes:**
  - `rules/mirrorData.js` (229 lines): `MirrorData` plain data module (4 cable ports, 6 deck files, 3 Medline Q&A items, 1/2/3 setup splits, timing/penalty/boost constants).
  - `rules/MirrorParts.js` (3 classes, 98 methods, 1 standalone function, 1,604 lines): private parts coordinated by `MirrorTrial`:
    - `MirrorLobby`: active-player lobby connects, miss speed-up, bot connect times, doors-close lockout check, `toJSON`/`fromJSON`.
    - `SetupCrew`: seeded slot order, 1/2/3 player step splits, sequential 5 steps as reported results, seeded mic/deck/Q&A content picks, penalties/recoveries, wrap-up, `toJSON`/`fromJSON`.
    - `DanceCrew`: dancer roster, per-dancer boost (cap 45) and penalties, averaged boost and penalty, `toJSON`/`fromJSON`.
  - `rules/Trial.js` (6 classes, 5 subclasses, 164 methods, 2 standalone functions, 1,296 lines): adds `MirrorTrial` (extends `Trial`, `trialKind: "mirror"`), the only entry point for outside code (`Game`, screens, bots); holds `#lobby`, `#setup`, and `#dance` as private fields and scores 0 to 7 with Focus influence and exact-attention tie-breaks.
  - Also updated for Level 3: `rules/Round.js`, `rules/Game.js` (120 methods, 1,041 lines; Level 3 timers, pass-throughs, standings, `jumpToLevel`), `rules/Team.js` (`trialResults`), `rules/bots.js` (`Bots.mirror`, `onTick`, `onFastForward`), `rules/index.js`, and generated `rules/rules.bundle.js` (6,147 lines).
- **Screen files:**
  - `mirror-view.js` (16 standalone functions, 1,256 lines): Presentation Day Lobby, Crew Reveal, Setup Crew 5-step views, and trial result screen.
  - `mirror-dance-view.js` (15 standalone functions, 560 lines): Dance Crew sliding-arrow rhythm lane.
  - `game.js` (105 standalone functions, 912 lines): Level 3 Briefing, Host Script, hint table, Presentation Day Complete end screen, and `DEV_JUMP` (`Ctrl+Shift+1` to `7`).
- **Tests:**
  - `Tests/check_mirror_data.js` (165 lines; `Tests/baseline/check_mirror_data.txt`): data-shape checks for `rules/mirrorData.js`.
  - `Tests/check_mirror_lobby.js` (402 lines; `Tests/baseline/check_mirror_lobby.txt`): `MirrorLobby` and `MirrorTrial` crew deal and save/load tests.
  - `Tests/check_mirror_setup.js` (542 lines; `Tests/baseline/check_mirror_setup.txt`): `SetupCrew` slot splits, 5 steps, penalties/recoveries, seeded content picks, wrap-up, and save/load tests.
  - `Tests/check_mirror_dance.js` (540 lines; `Tests/baseline/check_mirror_dance.txt`): `DanceCrew` results, boost cap 45, averaging, attention formula, bot-only random attention, and save/load tests.
  - `Tests/check_mirror_score.js` (569 lines; `Tests/baseline/check_mirror_score.txt`): `MirrorTrial` 0 to 7 scoring, lobby/attention-0 failures, Focus influence ranking, tie-breaks, and save/load tests.
  - `Tests/check_mirror_timing.js` (712 lines; `Tests/baseline/check_mirror_timing.txt`): 30s lobby, 1s reveal, 75s showtime timers, `Game` pass-throughs, and mid-trial save/load catch-up tests.
  - `Tests/check_mirror_bots.js` (748 lines; `Tests/baseline/check_mirror_bots.txt`): `Bots.mirror` lobby connects, setup hiccups/wrap-up, dancer boosts, bot-only teams, and idle auto-pilot tests.
  - `Tests/check_screens.js` (3,688 lines): jsdom screen suite covering Levels 1 to 3, Presentation Day Complete, mid-trial save/reload, dev jump, Floor 60 map/UI, and `pages/vote-test.html` (154 passed across Runs 1 to 12).
- **Repo counts (source: Step 9 portfolio table in `docs/level3-report.md`):**
  - `rules/`: 24 JS files, 30 classes (8 subclasses), 640 methods, 8 standalone functions, 6,134 lines (excludes generated `rules/rules.bundle.js` at 6,147 lines).
  - Screen files: 11 JS files, 202 standalone functions, 3,844 lines.
  - `Tests/`: 20 JS files, 112 standalone functions, 10,690 lines (`npm test`: 19/19 baseline checks; `npm run test:screens`: 154 passed).
  - Grand total: 55 JS files, 30 classes (8 subclasses), 640 methods, 322 standalone functions, 20,668 lines.

The .html copies are snapshots from Nov 8, 2026. Open a file in a browser to run it.

## Rules summary
Updated Nov 21, 2026.
- **Characters:** 3 hidden work styles picked freely with no type cap (`rules/CharacterType.js`, `CLAUDE.md`): **Cooperative** (bonus Collaboration and Composure, penalty Initiative max 4, gift cost 1 heart/pt, Empathy loses 1 heart when a teammate's glitch locks in, second path **Lifeline**: 1 rescue), **Independent** (bonus Focus and Grit, penalty Collaboration max 4, gift cost 2 hearts for 1 pt / 3 for 2 pts, cannot accept gifts, Cash Out once per game: 2 hearts for +1 pt at full hearts, second path **Auditor**: 1 own correct accusation), and **Contrarian** (bonus Initiative and Grit, penalty Composure max 4, gift cost 1 heart/pt, can sabotage, Skim +1 pt per uncaught sabotage round max 2 per game, second path **Exploit**: 3 uncaught sabotage rounds). 5 attributes in canonical order: **Focus, Collaboration, Initiative, Grit, Composure** (`rules/Attributes.js`, `CLAUDE.md`). Creation: each starts at 1, spend 15, +2 in each bonus attribute (starting total 24; max 10, penalty max 4). Stat abilities: Focus x 10% safe wrong accusation, Collaboration x 10% gift costs 1 heart less (min 1), Initiative vote weight `1 + Initiative / 10` (Levels 5 to 6), Grit x 5% extra heart at round end, Composure x 10% sabotage drains 1 instead of 2.
- **Economy:** **Hearts** (`rules/Hearts.js`) replace the old backup pool: start 3, cap 3, refill +1 at round end, plus quiet heart buff (+1 heart at round start for teams with 3 or fewer active players, `rules/Game.js`). Hearts cover shortfalls below 0 from any cause (1 heart/pt in bonus attributes, 2 hearts/pt in others) and do not count toward graduation. Points earned at Stats Update (`rules/Economy.js`): team wins trial 4, team loses 2, glitched that round 1, correct accusation +1, plus Skim/Cash Out; Round 7 awards 3 points. Gifts (`rules/Gift.js`): 1 or 2 points to any non-Stuck teammate during Open Floor or the gift window (min cost 1 heart); accepted points go to a glitching attribute first or else lowest attribute with room (tie order: Focus, Collaboration, Initiative, Grit, Composure), and declined/expired/overflow/Independent-refused gifts refund hearts. Status flags (`rules/PlayerStatus.js`): shown in order **Stuck, Glitching, Idle, At risk, Active** (other players see flags only; At risk = any attribute plus heart cover cannot pay a fixed cost of 3). Glitch and reboot (`rules/Player.js`, `rules/Attendance.js`): any attribute below 0 (0 is safe) or a pending missed Attendance check-in (60s idle + 15s popup, max 1 counted miss per round) sets Glitching; if still below 0 or an unsaved attendance miss remains when the gift window closes (or a check-in is missed after it closes), lock-in adds +1 glitch, reboots glitched attributes to 1 from other attributes evenly (shortfall forgiven), empties hearts to 0, and triggers Empathy. Two locked glitches = **Stuck** (spectator).
- **Rules and Round Flow:** Levels 1 to 6 steps (`rules/Round.js`, `rules/Game.js`): Briefing, Open Floor (90s; sabotage, gifts, team switches keeping teams at 3 to 5 members), Trial (Level 1 SOP 60s, Level 2 Split Brief 180s with 90s twist, Level 3 Mirror 30s lobby + 1s reveal + 75s showtime, Level 4 AutoTrial, Levels 5 to 6 Judged writing 180s + ranked top-3 player vote with no host), Glitch Report (30s; 1 accusation per player per round), Gift window (30s), Lock-in, Stats Update (30s; place points, Cash Out, heart refill), and Intermission (90s before Level 1). Level 7: Briefing, then Graduation (60s placement, then locked results). Every trial ranks teams and top half win, rounded up (`rules/Trial.js`, `rules/Vote.js`); Levels 1 to 4 add light tested-attribute influence (`0.5 x (team active avg - all teams avg)`). Sabotage (`rules/Sabotage.js`): Contrarians only, teammates only, not Stuck; costs 1 heart first then 2 per extra in a round, drains 2 from trial attribute (Composure x 10% drains 1); if caught, 0 points lost, round does not count for Exploit or Skim, no sabotage on any team next round, and none while on a team that caught them (Exploit is never lost). Accusations (`rules/Accusation.js`): correct gives +1 point and Auditor credit; wrong loses 1 from highest attribute (tie order: Focus, Collaboration, Initiative, Grit, Composure; Focus x 10% safe). Win conditions (`rules/PathTracker.js`): **Graduated** (all 5 attributes total >= 24, every attribute >= 2, not Stuck, not Idle at `results()`) or completing your type's second path at any point; otherwise **Contract renewed**. Current balance baseline (`Tests/baseline/check_balance.txt`, typical spending across random mixes): **68.3%** overall graduation (61.0% at 16 players, 72.9% at 20 players, 69.3% at 24 players; overall type gap 2.3 points, PASS).

## Round map
Updated Nov 21, 2026.
| Round | Name | Trial | Tested attribute | Cost |
|---|---|---|---|---|
| 1 | Boot Up | SOP mini-game | Grit | 2 |
| 2 | Sprint 1 | Prioritize against a timer | Collaboration | 3 |
| 3 | The Mirror | Presentation Day | Focus | 3 |
| 4 | Geek Week | Testing challenge | Initiative | 4 |
| 5 | Sprint 2 | Fix the broken team | Composure | 4 |
| 6 | Sprint 3 | Final build and dream speech | Composure | 5 |
| 7 | Graduation | Crack the simulation | None (all five checked) | 0 |

## Design decisions (from Prototype_Build_Notes.md)
- Code-rain intro, red/blue EXIT_PROTOCOL logo, ID-badge login.
- Among Us–inspired menus and wardrobe, office setting, original art only. Red + blue + gold.
- Story influences: Death Parade (elevator arrival, a host greets you) and Severance (stark white hallways). Inspired by, never copied.
- Player character = Pixel Intern (Masculine or Feminine base, mix anything).
- Instructors: SYS-ADMIN 01 (glitches), SYS-ADMIN 02 (Contrarian), TEAM LEAD MEEP (Cooperative), PROJECTION_IND (Independent). ADMIN_0 = main host who greets on arrival.
- Red glitch cursor on menus only.
- Holograms = glitched players + three wandering ghosts (USER_???, ATTEMPT_01, NULL). Code names only.
- Levels = floors; locked rooms open as levels progress.

## Open items for the game
- [ ] Ben: blueprint / floor layout. Myia: studio room photos. Then redraw Floor 60.
- [ ] Approve tool abilities (playtest against the 71% graduation target).
- [ ] Decide who hosts (a staff member or mentor, so all interns can play).
- [ ] Soft cap of ~4 Contrarians; ask Ben to re-test if more.
- [ ] Decide if the Proficient Card replaces or guides host judgment.
- [ ] Send the journey form Monday; fold answers into trial cards, ghost lines and the Graduation screen.
