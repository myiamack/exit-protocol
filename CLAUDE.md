## Your role

Build partner for Exit_ProtocoL, a team game. We are updating the local prototype to play the final rules. All rules are decided. Do not reopen or invent them; ask if any rule is unclear or missing.

## Current work

At the start of every task, read `CLAUDE.md` and `docs/screen-state-plan.md`.

Two parallel tracks:
- Ben: screen state cleanup on `screen-state-cleanup`, one step per task from `docs/screen-state-plan.md`.
- Hannah: Levels 4, 5 and 6 on `levels-4-6` (branched from `screen-state-cleanup`). Hannah's designs are final for those levels. She also owns plan Step 7 (Levels 5-6 vote cleanup).

Hannah's file boundaries:
- New files for each level: rules (for example `rules/Level4Parts.js`), data (for example `rules/level4Data.js`), and screen (for example `level4-view.js`). Same pattern as Level 3.
- Shared files she may edit, with small, listed changes only: `rules/Game.js` (one-line pass-throughs), `rules/index.js` (exports), `rules/Round.js` (`LEVELS` entries), `rules/Trial.js` (new `Trial` subclass registration only), `game.js` (show her screen), `judged-view.js` and `pages/vote-test.js` (Step 7).
- If a design needs a change to a shared rule (hearts, step order, costs, glitch, gifts, accusations, vote math), stop and report it. Do not build it.
- Every commit on `levels-4-6` must pass `npm run build`, `npm test`, `npm run test:screens`, and the new-files guard test.

## How to work with me

- One instruction per message; wait for confirmation before the next.
- Simple, plain language. Explain any technical term in one short sentence. No em dashes, no filler.
- I use **VS Code** on Windows; give keyboard shortcuts when useful.
- Simplest option wins. Stay close to the original concept; change only with a good reason. Do not limit player choice unless necessary.
- When a step builds a useful skill (data, tech, people), point it out in one line.
- `CLAUDE.md` is the source of truth for rules. If code and `CLAUDE.md` disagree, stop and report it; do not guess.
- Give a short progress report before long test runs finish.

## Where the code lives

- Repo: `C:\Users\shcop\projects\exit-protocol`.
- Branch: `screen-state-cleanup` (from `level3-mirror`). The 9 Level 2 QA bugs are fixed per `docs/screen-state-plan.md`. Never push to `main` directly; merge by PR after team review. Never create a branch differing from an existing one only by letter case.
- Word documents stay off GitHub. Do not edit `docs/design/Mock_Interview*` (partner's file).
- Do not change Level 1 behavior unless the step says so.
- Update `docs/class-diagram.md` (Mermaid) in the same commit whenever a class in `rules/` changes, including the commit it was made from.
- Balance simulation reference: `Tests\v2_balance\sim_v2.py`.
- Level 3 is finished. Hannah Ziegler's reference Level 3 lives in commit `cdf3eff` (`backup/Level3` / `hz-level3`); read with `git show` only, never merge, rebase, or cherry-pick.

## Terminal (Windows PowerShell 5.1)

- PowerShell 5.1 does not support `&&`. Run commands one at a time, or chain with `cmd1; if ($LASTEXITCODE -eq 0) { cmd2 }`.
- `rg` is not installed; use `Select-String`. `git grep` and `findstr` exit 1 when nothing matches (not an error).

## Screen State Rule

- Screens display data and pass player actions to `Game`. Screens never change game state. Screens call rules through `Game`, never the reverse.
- Screen files: `game.js`, `world-map.js`, `pixel-art.js`, all view files (`board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `judged-view.js`), `pages/vote-test.js`.
- Game state: anything that affects the outcome or must match for every player (scores, hearts, attributes, points, glitches, anomalies, attendance, timers and deadlines, step changes, trial boards, notes, Lock In, votes, gifts, accusations, rankings, tie-breaks, clues found, random results, save data).
- Rules own every deadline that changes game state, in every level, including Level 3 Q&A timeouts, deck reshuffles, mic flash hide, sound hold, and missed dance notes.
- All rule math lives in `rules/`. Screen files only draw screens and call `Game`, with no screen variables duplicating `Game` state.
- Allowed in screens: pure UI state (open panels, typed text before Submit, focus, scroll, animation drawn from rules data, sound playback, minimap toggle).
- All randomness uses the seeded `Rng`. Allowed cosmetic randomness is marked with `// cosmetic-ok`.

## Screen fixes queued (after refactor)

- Points screen: show one number per stat with the type bonus already applied (bonus starts at 3, max 10, weak stat max 4).
- Use "hearts" everywhere. Each type briefing shows that type's real drawback (Cooperative Empathy, Independent gift refusal, Contrarian caught rules).

## Base44 plan and multiplayer (decided)

- Build the single-player prototype with bots first (no Base44 credits). v1 is multiplayer via the Base44 backend CLI (not the app editor or Base Code): deploy our frontend files and run `rules/` inside a Base44 actor over WebSockets.
- `Game.toJSON` / `fromJSON` is the actor's saved state (must capture all state because actors sleep after ~10 s); step deadlines become scheduled wakes; seeded `Rng` saves with the game.
- Actor sends each player only their own stats/type plus `Game.board()` fields; hidden types and other players' stats never leave the server.
- Login uses Base44 auth (`@icstars.org` enforced by actor; open question: confirm actor can read player email first). Server must run `Attendance.check()` for every player. Dev jump (`Ctrl+Shift+1` to `7`): flag off in real game, on in test copy, never removed.
- **Lobby and bots:** join with room code and `@icstars.org`, then create character. Host clicks Start, else a 120 s timer from first join auto-starts. Unfinished characters auto-finish (keep choices made, random missing look/style, bot-place unspent points). Shuffle into even teams of 3 to 5; hidden bots (no tag, believable names, random looks) fill empty seats up to 16. Bot Levels 5-6 answers: 15 pre-written per prompt after final prompts are set. Dropped connections follow the idle rule (60 s + 15 s popup).

## Code structure and file map

- `rules/*.js` are ES modules (`rules/package.json`) with no DOM or screen code. Keep every `import` and `export` on one line (`tools/build-rules.js`). `npm run build` joins them into `rules/rules.bundle.js` (global `EP`); never edit `rules.bundle.js` by hand.
- `Game` is the front desk (`Bots` connects only via `onStart`/`beforeClose` hooks). `Player` owns `#attributes`, `#status`, `#pathTracker`, `#wallet` privately (`player.hearts` stays public). `MirrorTrial` owns `#lobby`, `#setup`, `#dance` privately (`rules/MirrorParts.js`, exported via `rules/index.js`); outside code calls only `MirrorTrial`.
- `Player.type` is a `CharacterType` object (`key` only for lookups/saves); never check `type === "coop"/"indep"/"contra"` outside `CharacterType`.
- `Game.toJSON()` / `fromJSON()` save/restore full state (players/teams by id) and close passed timers at once. `Game` owns step timers as deadlines on an injected clock; expired timers start the next from their own deadline.

| Class | Owns |
|---|---|
| `Player` | Type, public `Hearts`, 4 private parts, round flags, caught-by list, attendance timestamps. |
| `Attributes` | 5 stats, ability rolls, trial payment, losses, heart cover, gift routing, stat reboot. |
| `PlayerStatus` | Glitch count, idle/pending-attendance flags, status (`OK`, `At risk`, `Glitching`, `Stuck`, `Idle`). |
| `PathTracker` | Second-path progress, graduation checks, locked ending after `results()`. |
| `Wallet` | Points earned, placement draft, Skim, Cash Out. |
| `Hearts` | Heart count (start 3, cap 3); mutated only via `spend`, `refill`, `refund`, `lose`, `empty`. |
| `Team` | Members, round `won`, `trialWins`. |
| `Round` | Level, trial attribute, cost, step index, round records (`sabotages`, `accusations`, `gifts`), round action delegation. |
| `Sabotage` | Cost, drain, Composure shield, target checks. |
| `Accusation` | One per player/round, correct/wrong effects. |
| `Gift` | Type cost, Independent refusal/refund, overflow refund, Lifeline credit. |
| `Vote` | Ranked top 3, normalized team totals, top-half winners, tie-break. |
| `Trial` | Base ranking (top half win, rounded up) and subclasses `SopTrial` (L1), `SplitBriefTrial` (L2), `MirrorTrial` (L3), `AutoTrial` (L4), `JudgedTrial` (L5-6). |
| `MirrorLobby` | Private `#lobby` (`MirrorParts.js`): active players, connect/miss, bot times, doors-close lockout. |
| `SetupCrew` | Private `#setup` (`MirrorParts.js`): slot order, 1/2/3 split, 5 sequential steps, content picks, penalties/recoveries, wrap-up. |
| `DanceCrew` | Private `#dance` (`MirrorParts.js`): dancer roster, per-dancer boost (cap 45) and penalties, averaged team values. |
| `Economy` | Trial payments, Stats Update earnings, draft/lock/auto-place, Cash Out. |
| `Timer` | Step deadlines, injected clock, `tick()`, `close()`, save/restore. |
| `Attendance` | Idle/popup timers, pause/resume, missed check-in detection. |
| `Rng` | Seeded, saveable RNG (`Rng.seeded`, `getState`, `setState`). |
| `Game` | Front desk enforcing step order, owning `Timer`, `Economy`, `Attendance`, `Round`, graduation, `board()`, `toJSON`/`fromJSON`. |
| `CharacterType` | Base class + `Cooperative`, `Independent`, `Contrarian` (bonus, penalty, max, gift cost/refund, abilities, path). |

- **File map:** `rules/` (ES module rules, `index.js`, `scenarios.js`, `mirrorData.js`, `MirrorParts.js`, built `rules.bundle.js`); `pixel-art.js` (sprites, SVG art, icons); `world-map.js` (Floor 60 map, collision, doors, ghosts, minimap, room popups); `game.js` (session, nav, `V[0]`-`V[9]`, HUD, wiring); view files (`board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `judged-view.js`) shared by `index.html` and `pages/vote-test.html`.

## Test commands

- `npm run build`: rebuild `rules/rules.bundle.js`; run after any change in `rules/`.
- `npm test`: run all 16 baseline checks (`check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`, `check_mirror_data`, `check_mirror_lobby`, `check_mirror_setup`, `check_mirror_dance`, `check_mirror_score`, `check_mirror_timing`, `check_mirror_bots`); run after every step.
- `npm run test:balance`: run the 3 balance checks (`check_balance`, `check_cheese`, `check_teams`). Not part of `npm test`. Run only at balance checkpoints: before a PR into `main`, after `levels-4-6` merges into `screen-state-cleanup`, and when the team asks. Results are information only; a FAIL never blocks a step.
- `npm run test:screens`: run `Tests/check_screens.js` in jsdom (requires `npm install` once); run when a step touches screen code.
- `npm run baseline`: save fixed-seed baseline snapshot; never run unless the step says so, and explain any diff first.
- `Tests/check_balance.js` (type gap target 1 to 3 points), `Tests/check_cheese.js` (cheese strategies), `Tests/check_teams.js` (team-size wins): balance checks, run only through `npm run test:balance`.

## Final rules

### Character creation and types
- 5 attributes: Focus, Collaboration, Initiative, Grit, Composure. Each starts at 1 (5 free), player spends 15 more, +2 in each of type's 2 bonus stats (starting total 24). Max 10 per stat; penalty stat max 4 (boost counts toward max). Free type choice, no limits per type.

| Type | Bonus (+2) | Penalty (max 4) | Gift cost | Incentive | Disincentive | Second path |
|---|---|---|---|---|---|---|
| Cooperative | Collaboration, Composure | Initiative | 1 heart/pt | Cheapest gifts | Empathy: -1 heart when a teammate's glitch locks in | Lifeline: 1 rescue (gift cancels a teammate's glitch) |
| Independent | Focus, Grit | Collaboration | 1 pt = 2, 2 pts = 3 | Cash Out: 1/game at full hearts, spend 2 hearts for +1 pt | Cannot accept gifts (refused and refunded) | Auditor: 1 own correct accusation |
| Contrarian | Initiative, Grit | Composure | 1 heart/pt | Skim: +1 pt/uncaught sabotage round (max 2/game) | Sabotage costs hearts; caught blocks sabotage next round anywhere and later on catching team; Exploit never lost | Exploit: 3 uncaught sabotage rounds |

### Hearts and stat abilities
- **Hearts:** Start 3, cap 3, +1 refill at end of round. Cover any attribute shortfall below 0 from any cause (trial, sabotage, wrong accusation): 1 heart/pt in a bonus stat, 2 hearts/pt in any other. Do not count toward graduation. Quiet heart buff: at round start, every non-Stuck player on a team with 3 or fewer active players gets +1 heart (capped at 3), hidden on screen, host log only.
- **Stat abilities:** Formulas live in `rules/Attributes.js` (`ABILITY`, `abilityChance`, `voteWeight`, `abilityLines`), clamped 0 to 10, using seeded `Rng` (applied in `Accusation.js`, `Gift.js`, `Vote.js`, `Game.js`, `Sabotage.js`). Edge rules: Collaboration skips refused gifts, min gift cost 1 heart, overflow refund never exceeds paid; Grit fires after normal round-end refill (capped). Show each ability's chance on the player's own screen only; never show other players' chances.

### Levels and trials (Package A order)
| Lv | Name | Trial | Attr | Cost | Scored by |
|---|---|---|---|---|---|
| 1 | Boot Up | SOP mini-game | Grit | 2 | `SopTrial`: SOP score (0-7) |
| 2 | Sprint 1 | Split Brief | Collaboration | 3 | `SplitBriefTrial`: post-twist board score (0-5) |
| 3 | The Mirror | Presentation Day | Focus | 3 | `MirrorTrial`: attention score (0-7) |
| 4 | Geek Week | Testing challenge | Initiative | 4 | `AutoTrial`: random 0-7 (placeholder) |
| 5 | Sprint 2 | Fix the broken team | Composure | 4 | `JudgedTrial`: player vote |
| 6 | Sprint 3 | Final build and dream speech | Composure | 5 | `JudgedTrial`: player vote |
| 7 | Graduation | Crack the simulation | All 5 | 0 | Graduation check |

- If `game.js` scores any trial differently, report and ask before changing. Tested attribute stays hidden on screen until that level's Briefing.
- **Ranking:** Top half of teams win, rounded up (`ceil(n/2)`). Light influence (L1-4 only): `score += 0.5 * (team active avg in tested attr - all-teams avg)`. Ties: Split Brief = earliest post-twist Lock In then `Rng`; Mirror = higher exact attention then `Rng`; Judged = more 1st places then `Rng`; others = `Rng`.
- **Level 1 SOP:** Shared team board (any active teammate edits), scored when 60 s timer ends. 1 pt/step in right place (0-6), +1 if endless step left out (max 7; empty board scores 0 and no endless-step pt). Bot teams roll 0-7.

### Round step order and timers
- New game starts in Intermission; each level opens with Briefing (no actions) and returns to Intermission after Stats Update. Level 7: Briefing, then Graduation.
  1. **Open Floor (90 s):** sabotage, gifts, team switches (must keep teams 3 to 5; a player who sabotaged this round cannot switch).
  2. **Trial:** every non-Stuck player (including Glitching) pays cost from tested attr; hearts cover shortfalls.
  3. **Glitch Report (30 s, countdown):** accusations; no answer = Skip.
  4. **Gift window (30 s):** teammate gifts.
  5. **Lock-in:** any player still below 0, or with an unsaved missed check-in, glitches -> Reboot -> Empathy.
  6. **Stats Update (30 s, starts when gift window closes, countdown):** earn/place points, +1 heart refill; unplaced points auto-place by bot rule while player-placed points stay.
- **Timed steps:** first Intermission 90 s, Open Floor 90 s, L1 SOP 60 s, L2 Split Brief 180 s (twist at 90 s), L3 Mirror 30 s lobby / 1 s reveal / 75 s showtime, L5-6 writing 180 s, Glitch Report 30 s, Gift window 30 s, Stats Update 30 s, Graduation 60 s. **Untimed:** Briefing, L4 AutoTrial, L5-6 vote, Intermission after L1.

### Glitch, reboot, Stuck, Attendance, and idle
- **Glitching:** any stat below 0 (0 is safe) or pending missed Attendance check-in before gift window closes. A gift bringing the stat to 0+ (or any accepted gift-window gift for attendance) cancels it and counts for Lifeline.
- **Attendance glitch:** before gift window closes -> Glitching on Board, any accepted gift-window gift saves it (points follow normal gift rules); unsaved at close -> locks in (+1 glitch, status Glitched, reboot: hearts to 0, 1 pt earned, Empathy, no stat refill). Miss after gift window closes locks in immediately with same reboot. Attribute + attendance glitch in one round count as 1 glitch. Messages: before close `"You missed the check-in. You are Glitching. A teammate's gift can save you before the gift window closes."` (`OK`); after close `"You missed the check-in. +1 glitch (x/2)."` (`OK`).
- **Attribute lock-in:** +1 glitch; Reboot drains other stats evenly until glitched stat reaches 1 (unpayable shortfall forgiven), hearts to 0. Second locked glitch = **Stuck** (spectator, cannot be sabotaged).
- **At risk and HUD:** At risk = any stat plus covering hearts cannot pay a fixed cost of 3 (updates live). HUD (owner only) shows `GLITCHES x/2` next to hearts; `ANOMALIES` counts clues only. Gift window never says `"No glitch for you this round"` while a glitch is pending or locked this round. Other players see flags only, never numbers.
- **Attendance:** any input (key/click/touch/scroll, mouse move <=1/s) resets 60 s timer -> 15 s `"Still there?"` popup (shows in full before glitch; popup keys only close it, clear footer focus, never advance game). Idle/popup/cap are host dials. Max 1 attendance glitch/player/round (saved miss uses cap; 2nd miss adds no glitch, still sets idle). Runs on all input screens (including L5-6 writing and Vote in `pages/vote-test.js`); paused on intro, Briefings, Intermissions, Glitch Reports, Stats Updates, Graduation after placing L7 points (or with 0 pts), and after `results()`. Pause closes open popup cleanly; resume starts fresh 60 s clock. Pause logic lives in `rules/Game.js`; popup UI in `attendance-view.js`.
- **Idle:** any missed check-in sets idle until next input on any screen. Active = not Stuck and not idle (`Team.active()`). Idle players cannot give/answer gifts, accuse, sabotage, vote, or be ranked (prior ballot stays; Glitch Report = Skip; gifts to idle expire/refund at step end unless they return). Trial costs still pay; unplaced points auto-place at timer end. Not blocked while idle: Cash Out, team switch, being sabotaged. Idle at `results()` -> Contract renewed unless second path is complete.

### Sabotage, gifts, accusations, points, anomalies, and host
- **Sabotage (Contrarian):** teammates only, not Stuck. Cost 1 heart first in round, 2 each extra. Drains 2 from target's round trial attr (Composure shield -> 1); hearts cover <0. Victim told privately.
- **Gifts:** any non-Stuck active player may gift any non-Stuck teammate during Open Floor or gift window (buttons for all; disabled if too few hearts; min cost 1 heart). Target: glitching stat if Glitching, else lowest stat with room; tie order `Focus, Collaboration, Initiative, Grit, Composure` (receiver does not pick; all maxed -> refund). Giver pays on send; receiver sees `"Gift from [name]: Accept or Decline."`; decline or no answer at step end refunds giver. Independent refusal displays as normal decline (`"[Name] declined your gift. Your hearts came back."`), never mentioning type. Lifeline counts only gifts cancelling a glitch (including pending attendance); bots treat pending attendance as Glitching.
- **Accusations:** 1/player/round vs teammate. Prompt always `"Suspect a teammate? Accuse or Skip."` (never imply sabotage). Correct: +1 pt at Stats Update, Auditor credit; caught Contrarian loses 0 pts, loses that round's Exploit/Skim, cannot sabotage next round on any team or later on catching team (switching allows again; Exploit never lost; disabled buttons show private reason). Wrong: accuser loses 1 from highest stat (tie order `Focus, Collaboration, Initiative, Grit, Composure`; Focus may negate; can glitch).
- **Points:** Win 4, Loss 2, Glitched 1; bonuses: correct accusation +1, Skim, Cash Out. Round 7: 3 pts.
- **Sign in/out and Anomalies:** Sign out keeps display name only (restored on next login with same email; look/tool/progress reset). 3 anomalies only: `ERROR` (capital L on sign-in), `WATCHER` (`ATTEMPT 02` badge), `LOOP` (SOP endless step left out). HUD and Glitch Report share count out of 3; ghosts (`USER_???`, `ATTEMPT_01`, `NULL`) give hints only and never count.
- **Host:** optional (System Administrator stays as story role). Build no-host mode first. Host Script button visible to host only (`Ctrl+Shift+H` toggles in solo). Host present runs duties; no host = engine + player vote.
- **Graduation (Round 7):** hidden on Stats Update until L7. Graduate if total >= 24, every stat >= 2, and not Stuck, OR any completed second path. 60 s placement timer (unplaced auto-placed). Endings lock on `results()`.

### Levels 5-6 submissions and player vote
- Active players write 1 named submission (max 300 chars) in 3 min (closes early if all active submit; typing counts as activity; no submission = cannot be ranked, can still vote). Prompts (10/level) live in `rules/Trial.js` (`PROMPTS`); host picks or writes custom (max 200 chars, non-empty, saved on game record only); no host = random. Bots submit `"Bot answer"`.
- Voters see each submission with writer name and team, and rank top 3 active players from other teams (or fewer if <3 exist). Points (3/2/1 times voter Initiative weight) go to ranked players' teams, divided by team active count and possible voters (0 if either is 0).

### Level 2 trial: Split Brief
- Scenario data (tasks, cards, pre/post answers, twist) lives in `rules/scenarios.js` (`Scenarios.MEDLINE_SPRINT_1`).
- 5 private cards dealt round-robin to active teammates (small teams hold extras); per-game seeded shuffle remaps task letters A-D and card deal order (saved in `toJSON`/`fromJSON`).
- Talking allowed; team notes for remote/bots (active only, max 80 chars, 3/player with counter, poster name, team-only feed).
- Shared board: pick and order 2 of 4 tasks (any active teammate edits). Any active player may Lock In (final, freezes board; early lock-in allowed).
- Twist at 90 s: 1 random active player per team gets private popup (`"Breaking news. Only you got this."`), even if already locked in.
- 180 s timer (closes early when all teams lock in). Post-twist scoring: +2 per correct task, +1 if both correct and in order (max 5; empty = 0); bot-only teams roll 0-5.
- Bots post an accurate pre-written note per card at random times in first 30 s, reserving 1 note until the twist; twist holder posts within 10 s; never edit board or lock in; counts toward 3-note cap.

### Level 3 trial: The Mirror: Presentation Day
- `MirrorTrial` (`trialKind: "mirror"`, Focus, cost 3). All step numbers, timings, penalties, ports, file names, Q&A items, and bot timings live in `rules/mirrorData.js`. Never hardcode team names.
- **Lobby (30 s):** `Team.active()` connects via signal-grab tile (miss speeds tile up). Any active player left out at doors-close fails the team with score 0 (still passes through `rankWithInfluence`). A sleep-missed lobby deadline closes at the deadline, not last bot connect.
- **Crews and showtime (75 s):** Seeded `Rng` deals `min(3, ceil(active/2))` to Setup Crew and rest to Dance Crew, followed by a 1 s `CREW LOCKED` reveal. Setup runs 5 sequential steps (`cables`, `sound`, `mic`, `deck`, `qa`) in seeded slot order (1/2/3 splits in `rules/mirrorData.js`); waiting Setup sees live checklist; last Setup presses `"Wrap up the presentation"` to end trial. Dance Crew plays per-dancer rhythm lanes (boost cap 45); boosts and penalties average across dancers (0 dancers = 0 boost/penalty).
- **Attention and score:** Drains only during showtime: `clamp(0..100, showtimeLeft/75*100 + avgDanceBoost - setupPenalties - avgDancePenalties)`. Attention 0 ends trial with score 0. Score = `round(attention/100 * 7)` (0-7) + light Focus influence.
- **Bots, idle, and save:** Bot timings/hiccups live in `rules/mirrorData.js` (last bot wraps up); bot-only teams roll random attention 0-100; idle humans follow bot auto-pilot. Each player plays their own part; `Game.toJSON`/`fromJSON` captures mid-trial state.

### Per-level clues, briefings, host script, end screens, dev jump
- Ghost hints and tea guest stories live in `game.js` (`LEVEL_HINTS`; Lobby and Open Floor, text-only, no rule effect, L1 unchanged). Briefings live in `game.js` (`BRIEFINGS`). Host scripts live in `game.js` (`FAC`, `FAC_BY_LEVEL`).
- After L1 Stats Update, continue to L2 (`G.startNextRound` -> Briefing). After L2 ("Sprint 1 Complete", with "Start Level 3" button) and L3 ("Presentation Day Complete"), show trial results, hearts, glitches (`x/2`), status, 5 stats, team wins, all-team standings, Replay, and Back to sign-in. Never show work styles or secret paths.
- Dev jump: `Ctrl+Shift+1` to `7`, always on in prototype (forward fast-forwards; current/earlier starts a new game and fast-forwards).

### Progress board
- Read-only, open anytime (including voting), driven by `Game.board()`.
- Shows: per-player name, team, status (priority: `Stuck > Glitching > Idle > At risk > Active`), per-team trial wins, past L5-6 submissions (name and level). Never shows type, stats/total, hearts, gifts, Skim, Cash Out, or anything revealing type.

## Bot behavior

Matches `Tests\v2_balance\sim_v2.py` (fixed seed for repeatable tests): Contrarians sabotage 50% of rounds if able (1/round, At risk first). After team sabotage: victim accuses 90%, other teammates 25%; no sabotage: 5%. Cooperatives always gift Glitching teammates if affordable, others 25% (gift 2 if affordable, else 1). Bots accept 80% of gifts at once. Independents Cash Out at first Stats Update with full hearts. Round 7: raise any stat below 2 first. Votes: 3 random players from other teams.

## Parked (not in this build)

- Host mode controls; difficulty dials (R6 cost 7, graduation 23); clue system and special abilities; engine auto-dials; no-repeat prompts across games (L5-6); Ollama prompt generation (L5-6).

## Known limits (do not try to fix now)

- Balance depends on trial win rate, guessing skill, and point spending; Package A meets the target only near even win rates with random guessing.
- With no Contrarians, Independents cannot complete Auditor.
- Sabotage victims graduate less often (known and accepted).
- Contrarian switcher edge is kept intentionally as the reward for switching.
- Parked balance issues: all-Cooperative lobby, odd team counts, aware spending trailing typical, Independents leading at high Contrarian counts, and small team-size vote gap.
