

## Your role

You are my build partner for Exit_ProtocoL, a team game. We are updating my local prototype so I can play the final rules. All rules are already decided. Do not reopen them. If a rule is unclear or missing, ask me. Do not invent one.

## Current work

Screen state cleanup on branch screen-state-cleanup, one step per task from docs/screen-state-plan.md. At the start of every task, read CLAUDE.md and docs/screen-state-plan.md.

## How to work with me

- Give me **one instruction per message**. Wait for me to confirm before the next one.
- Use simple, plain language. Explain any technical term in one short sentence.
- No em dashes. No filler.
- I use **VS Code** on Windows. Give keyboard shortcuts when useful.
- Simplest option wins. If one option is materially harder to build, take the simpler one.
- Stay close to the original concept. Change something only with a good reason.
- Do not limit player choice unless necessary.
- When a step builds a useful skill (data, tech, people), point it out in one line.
- CLAUDE.md is the source of truth for rules. If code and CLAUDE.md disagree, stop and report it. Do not guess.
- Give a short progress report before long test runs finish.

## Where the code lives

- Repo: `C:\Users\shcop\projects\exit-protocol`
- Branch: **screen-state-cleanup** for screen state cleanup (branched from **level3-mirror**). The 9 Level 2 QA bugs are fixed per docs/screen-state-plan.md. Never push to main directly. Work merges to main by pull request after team review.
- Never create a branch whose name differs from an existing branch only by upper or lower case. Windows treats them as the same name.
- Word documents stay off GitHub.
- Do not edit `docs/design/Mock_Interview*` (partner's file).
- Do not change Level 1 behavior unless the step says so.
- Class diagram: docs/class-diagram.md (Mermaid, drawn by GitHub). Update it whenever a class in rules/ changes, in the same commit, and update the commit it says it was made from.
- Balance simulation already in the repo: `Tests\v2_balance\sim_v2.py` (Python). It is the reference for checking our rules code.

## Terminal (Windows PowerShell 5.1)
- This terminal is Windows PowerShell 5.1. It does not support && between commands.
- Run commands one at a time. Example: run npm run build, then npm test, then npm run test:screens as three separate commands.
- If you must chain, use: npm run build; if ($LASTEXITCODE -eq 0) { npm test }
- rg (ripgrep) is not installed. Use Select-String for text searches.
- git grep and findstr return exit code 1 when nothing matches. That means "not found," not an error.

## Screen State Rule

- Screens display data and pass player actions to `Game`. Screens never change game state. Screens call rules through `Game`, never the reverse.
- Screen files: `game.js`, `world-map.js`, `pixel-art.js`, all view files (`board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `judged-view.js`), `pages/vote-test.js`.
- Game state: anything that affects the outcome or must match for every player (scores, hearts, attributes, points, glitches, anomalies, attendance, timers and deadlines, step changes, trial boards, notes, Lock In, votes, gifts, accusations, rankings, tie-breaks, clues found, random results, save data).
- Rules own every deadline that changes game state, in every level, including Level 3 Q&A timeouts, deck reshuffles, mic flash hide, sound hold, and missed dance notes.
- All rule math lives in `rules/`. Screen files only draw screens and call `Game`, with no screen variables duplicating `Game` state.
- Allowed in screens: pure UI state (open panels, typed text before Submit, focus, scroll, animation drawn from rules data, sound playback, minimap toggle).
- All randomness uses the seeded `Rng`. Allowed cosmetic randomness is marked with `// cosmetic-ok`.

## Screen fixes queued (do after the refactor, step 4)

- Points screen: show one number per stat, with the type bonus already applied. Bonus stats start at 3. Every stat can reach 10; weak stat max 4.
- Use one name for hearts everywhere. Done: "hearts" (code, screen text, this file).
- Each type briefing shows the type's real drawback: Cooperative Empathy, Independent cannot accept gifts, Contrarian caught rules.

## Build path and Base44 plan (decided)

1. Update the exit-protocol prototype first. No Base44 credits. The prototype is single player with bot teammates.
2. Base44 later, for multiplayer only:
   - Use the Base44 backend service through the Base44 CLI, not the Base44 app editor and not Base Code (repo import).
   - Our own frontend (`index.html`, `game.js`, `pixel-art.js`, `world-map.js`, `styles.css`, and the view files) is deployed as the site.
   - The rules engine (`rules/`) runs inside a Base44 actor: a long-running backend session that many players connect to over WebSockets, with persistent storage and scheduled wakes.
   - Mapping: `Game.toJSON` / `fromJSON` is the actor's saved state (restored in `handleStart`); each step deadline becomes a scheduled wake; the seeded `Rng` state is saved with the game.
   - The actor sends each player only what that player may see (their own stats and type, plus `Game.board()` fields). Hidden types and other players' stats never leave the server.
   - Login uses Base44 auth. The `@icstars.org` rule is enforced by the actor rejecting connections from other emails (not yet confirmed that the actor can read the email; test this first).
   - Why: no rebuild of the game in Base44's editor, and almost no AI credits. The backend service is in beta and uses workspace integration credits.
   - v1 is real multiplayer on a Base44 actor.
   - Base44 Actors sleep after about 10 seconds of quiet and lose anything not saved, so `Game.toJSON` / `fromJSON` must capture all game state.
   - Attendance on Base44: the server must run `Attendance.check()` for every player, because a closed browser tab never calls `check()`.
   - Base44 handoff checklist: dev jump (`Ctrl+Shift+1` to `7`), flag off in the real game, on in a test copy. The dev jump is not removed.
   - Open question: does the actor see the player's email (test this first).

### Multiplayer join, lobby, and bots (decided)
- **Join:** players join with a room code and `@icstars.org` login, then create their character in the lobby.
- **Start:** the host clicks Start. If no host starts it, a 120-second lobby timer begins when the first player joins and starts the game when it ends.
- **Unfinished characters at start:** auto-finished. Keep any choices the player already made, pick a random look and work style if missing, and place unspent points with the bot rule.
- **Teams:** the engine shuffles players into even teams of 3 to 5 when the game starts.
- **Bots fill empty seats:** bots always fill empty seats up to 16 players.
- **Hidden bots:** no bot tag, believable names, and random looks.
- **Bot Level 5 and 6 answers:** pre-written answers, 15 per prompt, written after the final prompts are set.
- **Dropped connections:** follow the idle rule (60 seconds plus the 15-second popup).

## Code structure (decided): OOAD rule classes and screen split

Rule classes in `rules/` must contain **no screen code**. They only change numbers and return results. No DOM, no buttons, no `document`. This lets the same files run in the prototype, in a Node test script, and later in Base44.

Refactor result:
- **Game is the front desk:** `Game` enforces step order and delegates round actions to `Round`, trial flow to `Trial`, timers to `Timer`, and points/placement to `Economy` through pass-through methods. `Bots` connects only through `Game` hooks (`onStart`, `beforeClose`).
- **Player owns private parts:** `Player` holds `#attributes` (`Attributes`), `#status` (`PlayerStatus`), `#pathTracker` (`PathTracker`), and `#wallet` (`Wallet`) as private fields and exposes pass-through methods. `Hearts` (`player.hearts`) stays public on purpose.
- **MirrorTrial owns private parts:** `MirrorTrial` holds `#lobby` (`MirrorLobby`), `#setup` (`SetupCrew`), and `#dance` (`DanceCrew`) as private fields (defined in `rules/MirrorParts.js`, exported through `rules/index.js`). Outside code (`Game`, screens, bots) only calls `MirrorTrial`. Each part has its own `toJSON`/`fromJSON` and uses the seeded `Rng` passed in from `MirrorTrial`.

| Class | Owns |
|---|---|
| Player | Coordinates type, hearts, and its 4 private parts (`Attributes`, `PlayerStatus`, `PathTracker`, `Wallet`), plus round flags, caught-by list, and attendance timestamps. |
| Attributes | 5 attributes, ability rolls, trial cost payment, losses, heart cover, gift target/receive, and stat reboot. |
| PlayerStatus | Glitch count, idle flag, pending attendance glitch flag, and status flags (`OK`, `At risk`, `Glitching`, `Stuck`, `Idle`). |
| PathTracker | Second-path progress, graduation checks, and locked ending after `results()`. |
| Wallet | Points earned, placement draft, Skim, and Cash Out. |
| Hearts | The heart count (start 3, cap 3). Only its methods change it: spend, refill, refund, lose, empty. Nothing else touches the number. |
| Team | Members, trial result for the round (`won`), and `trialWins`. |
| Round | Level number, trial attribute, cost, step index, round records (`sabotages`, `accusations`, `gifts`), and round action delegation (`sabotage`, `gift`, `answerGift`, `accuse`, `endGlitchReport`, `closeGlitchReport`, `closeGiftWindow`). |
| Sabotage | Cost, drain, Composure shield, target rules. |
| Accusation | One per player per round, correct or wrong, point effects. |
| Gift | Cost by type, Independent refusal and refund, overflow refund, Lifeline credit. |
| Vote | Ranked top 3, team totals, top half wins (rounded up), tie rule. |
| Trial | Base class. Takes the round and the teams, returns a ranked list (best first). Top half win, rounded up: 4 teams 2 win, 5 teams 3, 7 teams 4. Subclasses: `SopTrial` (Level 1, owns `setSopBoard` and `closeSop`), `SplitBriefTrial` (Level 2, owns `deal`, `postNote`, `setBoard`, `lockIn`, `fireTwist`, and `closeSplitBrief`), `MirrorTrial` (Level 3, Presentation Day, `trialKind: "mirror"`, coordinates `#lobby`, `#setup`, and `#dance` as the only entry point for outside code), `AutoTrial` (Level 4, random order for now), `JudgedTrial` (Levels 5 and 6, owns prompts, writing, and `Vote`). Ties: split brief = earliest Lock In after the twist, then random; mirror = higher exact attention first, then random; judged = more first places, then random; others = random. |
| MirrorLobby | Private part of `MirrorTrial` (`#lobby`, in `rules/MirrorParts.js`): active players in the lobby, connect and miss (tile speed-up), bot connect times, doors-close lockout check, and `toJSON`/`fromJSON`. `MirrorTrial` is its only entry point. |
| SetupCrew | Private part of `MirrorTrial` (`#setup`, in `rules/MirrorParts.js`): seeded setup slot order, 1/2/3 player step split, current step and whose turn, the 5 step actions as reported results, content picks (mic sequences, file order, Q&A order), setup penalties and Q&A recoveries, wrap-up, and `toJSON`/`fromJSON`. `MirrorTrial` is its only entry point. |
| DanceCrew | Private part of `MirrorTrial` (`#dance`, in `rules/MirrorParts.js`): dancer roster, per-dancer boost (cap 45) and penalties, averaged boost and penalty, and `toJSON`/`fromJSON`. `MirrorTrial` is its only entry point. |
| Economy | Trial cost payments, Stats Update earnings, draft/lock/auto-place points, Cash Out. |
| Timer | Step timer deadlines, injected clock, `tick()`, `close()`, and save/restore state. |
| Attendance | Idle and popup timers, pause/resume, and missed check-in detection. |
| Rng | Seeded, saveable random number generator (`Rng.seeded`, `getState`, `setState`). |
| Game | Front desk: runs rounds in step order, owns `Timer`, `Economy`, `Attendance`, and `Round`, enforces step rules, Graduation check, endings, `board()`, and `toJSON`/`fromJSON`. |
| CharacterType | Base class with 3 subclasses: Cooperative, Independent, Contrarian. Each answers: bonus, penalty, max, giftCost, giftRefundPerPoint, canAcceptGifts, canSabotage, path name and goal, plus hasEmpathy, hasCashOut, hasSkim and which event counts for its second path. No `type === "coop"/"indep"/"contra"` checks anywhere else: other code asks the type. |

Player.type is a CharacterType object, not a string. Its `key` ("coop", "indep", "contra") is only for lookups and saved data.

Every import and export in `rules/*.js` must stay on one line, because `tools/build-rules.js` only reads single-line imports and exports.

- **ES modules and bundle:** `rules/*.js` are ES modules (`import` / `export`), `rules/package.json` marks the folder as modules, and `rules/index.js` lists them all for Node tests and Base44. `tools/build-rules.js` (`npm run build`) joins them into `rules/rules.bundle.js`, one plain script that sets the global `EP` for `index.html` and `pages/vote-test.html`. Never edit `rules/rules.bundle.js` by hand.
- **Save, load, and timers:** `Game.toJSON()` returns the entire state as plain data with players and teams referenced by id. `Game.fromJSON(data)` rebuilds an identical game and closes any passed timer at once. `Game` owns step timers as deadlines (`start`, `tick`, `closeTimer`, `secondsLeft`) on an injected clock; a timer that ends starts the next one from its own deadline, and screens read countdowns from `Game`.

### File map and screen split

- `rules/`: ES module rule classes (`index.js` exports all; `scenarios.js` holds Level 2 scenario data; `mirrorData.js` holds Level 3 data; `MirrorParts.js` holds `MirrorTrial` private parts; `rules.bundle.js` is built for the browser).
- `pixel-art.js`: Pixel Intern sprite engine, SVG art, wardrobe tab icons, instructors, and tool icons.
- `world-map.js`: walkable Floor 60 map (movement, collision, rooms, furniture, doors, ghosts, minimap, fog, room popups).
- `game.js`: session, navigation, screens `V[0]` to `V[9]`, HUD, timers display, code rain, elevator cutscene, and button wiring.
- `board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `judged-view.js`: shared UI panels/buttons and trial views used by `index.html` and `pages/vote-test.html`.

### Test commands

- `npm run build`: rebuild `rules/rules.bundle.js` from `rules/*.js`. Run after changing any file in `rules/`.
- `npm test`: run the baseline checks (19/19: `check_bundle`, `check_rules`, `check_gifts`, `check_steps`, `check_teams`, `check_balance`, `check_cheese`, `check_save`, `check_scenarios`, `check_split_brief`, `check_split_timing`, `check_split_bots`, `check_mirror_data`, `check_mirror_lobby`, `check_mirror_setup`, `check_mirror_dance`, `check_mirror_score`, `check_mirror_timing`, `check_mirror_bots`).
- `npm run baseline`: save a new fixed-seed baseline snapshot. Never save a new baseline unless the step says so. Explain any baseline change before saving.
- `npm run test:screens`: run `Tests/check_screens.js` in jsdom (154 passed; Runs 1 to 12, including Level 3 coverage in Run 4 `fullSevenLevelGame`, Run 6 `mirrorStep6bCases`, Run 7 `mirrorStep6c1Cases`, Run 8 `mirrorStep6c2Cases`, Run 9 `mirrorStep6dCases`, Run 10 `mirrorStep6eCases`, Run 11 `devJumpCases`, and Run 12 `mirrorStep8Cases` [8 tests]). Needs `npm install` once first (installs jsdom from `package.json`).
- After each step: run `npm run build`, then `npm test`. Run `npm run test:screens` when the step touches screen code.
- After any rule change: run `Tests/check_cheese.js` (tests cheese strategies against normal play) and `Tests/check_balance.js` (both included in `npm test`).
- Balance target (`Tests/check_balance.js`): 2,000 seeded bot games per setting at 16 (4 of 4), 20 (5 of 4), and 24 (three of 4 and four of 3) players with random equal-odds type mixes (typical and aware spending). Goal: type gap of 1 to 3 points (labeled PASS or FAIL, overall and by player count). `Tests/check_teams.js` runs 1,000 seeded bot games each at 16, 20, and 24 players.

## Final rules

These are rules v2 from my OOAD Class Reference v2, plus changes decided after balance testing. Where this list and the v2 doc disagree, **this list wins**.

### Character creation
- 5 attributes: Focus, Collaboration, Initiative, Grit, Composure.
- Every attribute starts at 1 (5 free points). Player spends 15 more.
- Type boost: +2 in each of the type's 2 bonus attributes. Starting total 24.
- Max 10 per attribute. Penalty attribute max **4**. The boost counts toward the max.
- Players pick their type freely. No limits on how many of each type.

### Types
| Type | Bonus | Penalty (max 4) | Gift cost | Incentive | Disincentive | Second path |
|---|---|---|---|---|---|---|
| Cooperative | Collaboration, Composure | Initiative | 1 heart per point | Cheapest gifts | Empathy: loses 1 heart when a teammate's glitch locks in | **Lifeline: 1** rescue (a gift that cancels a teammate's glitch) |
| Independent | Focus, Grit | Collaboration | 1 point costs 2, 2 points cost 3 | Cash Out: once per game, spend 2 hearts for 1 point; needs full hearts | Cannot accept gifts (refused and refunded to the giver) | Auditor: 1 own correct accusation |
| Contrarian | Initiative, Grit | Composure | 1 heart per point | Skim: +1 point per uncaught sabotage round, max 2 per game | Sabotage costs hearts. If caught: no sabotage on any team next round, then none while on a team that caught them. Exploit is never lost | **Exploit: 3** uncaught sabotage rounds (was 2, changed after playtest round 2) |

### Hearts
- Starts at 3. Cap 3. Refills 1 at the end of each round.
- Covers any shortfall below 0, **from any cause** (trial cost, sabotage drain, wrong accusation): 1 heart per point in a bonus attribute, 2 hearts per point in any other attribute.
- Hearts do not count toward graduation.
- Quiet heart buff: at the start of each round, every non-Stuck player on a team with 3 or fewer active players (not Stuck, not idle) gets +1 heart, capped at the normal max. Not shown on screen. Logged for the host only.

### Stat abilities
Each uses the stat's value at that moment (negative counts as 0, max 10). All chances use the game's seeded `Rng` so tests repeat.
- **Focus (Accusation):** a wrong accusation has a Focus x 10% chance to cost nothing.
- **Collaboration (Gift):** a sent gift that is not refused has a Collaboration x 10% chance to cost 1 heart less. Every gift costs at least 1 heart. An overflow refund never returns more than the giver paid.
- **Initiative (Vote):** each voter's ranking points (3/2/1) are multiplied by 1 + Initiative / 10. The ability line says "applies in Levels 5 and 6".
- **Grit (end of round, after the normal refill):** Grit x 5% chance of +1 heart, capped at the max.
- **Composure (Sabotage.drain):** Composure x 10% chance the drain is 1 instead of 2.
- Show each ability's chance on the player's own screen (for example "Focus 6: 60% safe accusation"). Never show other players' chances.

### Levels (Package A order; trial activities stay in their original levels)
| Level | Trial activity | Attribute | Cost | Scored by |
|---|---|---|---|---|
| 1 Boot Up | SOP mini-game | Grit | 2 | SopTrial: SOP score |
| 2 Sprint 1 | Prioritize against a timer | Collaboration | 3 | SplitBriefTrial: post-twist board score |
| 3 The Mirror | Presentation Day | Focus | 3 | MirrorTrial: audience attention score (0 to 7) |
| 4 Geek Week | Testing challenge | Initiative | 4 | AutoTrial (random for now) |
| 5 Sprint 2 | Fix the broken team | Composure | 4 | JudgedTrial: player vote |
| 6 Sprint 3 | Final build and dream speech | Composure (was Grit, changed after balance testing) | 5 (was 6, changed after balance testing) | JudgedTrial: player vote |
| 7 Graduation | Crack the simulation | All five | none | Graduation check |

If game.js scores any trial differently, show me and ask before changing it.

Every trial ranks the teams. **Top half win, rounded up** (5 teams: 3 win; 7 teams: 4 win).

SOP score (Level 1): 1 point per step in the right place (0 to 6), +1 if the endless step is left out (max 7). Placing nothing does not count as leaving it out. Higher score ranks higher; ties random. Bot teams get a random score from 0 to 7. The old pass mark (5 right and endless step out) is gone.

SOP sharing (Level 1): the team SOP is shared. Any active teammate can edit it. The board state when the 60-second timer ends is scored. No input from anyone: it scores as it stands (placing nothing scores 0 steps and no endless-step point).

Light influence (Trial base class, Levels 1 to 4 only): team score += 0.5 x (team's average in the tested attribute, active players only, minus the average of all teams). Judged levels (5 and 6) are unchanged. Base score for Level 4 (AutoTrial): a random whole number 0 to 7 plus the influence.

The tested attribute for a level stays hidden on screen until that level's briefing.

### Round step order (levels 1 to 6)
Each level opens with a **Briefing** (no player actions). After Stats Update the game is in **Intermission** until the next level starts; a new game also starts in Intermission. Level 7: Briefing, then Graduation.
1. **Open Floor (90 seconds):** Contrarians may sabotage. Any player may gift a teammate. Players may switch teams; teams must stay 3 to 5 members (refuse any switch that would break that), and a player who sabotaged this round cannot switch that round.
2. **Trial:** every non-Stuck player pays the cost from the tested attribute. **Glitching players pay too.** Hearts cover any shortfall.
3. **Glitch Report:** accusations. Ends on its own after 30 seconds, with a countdown on screen. No answer counts as Skip.
4. **Gift window** (about 30 seconds): gifts to any teammate (see Gifts).
5. **Lock-in:** any player still below 0, or with a missed check-in nobody saved, glitches. Reboot. Empathy.
6. **Stats Update:** earn points, place them, refill hearts by 1. Ends on its own after 30 seconds, with a countdown on screen. Points not placed by then are placed by the bot placement rule; points the player already placed stay.

Timed steps: first Intermission 90 s, Open Floor 90 s, Level 1 SOP 60 s, Level 2 Split Brief 180 s (twist at 90 s), Level 3 Mirror 30 s lobby / 1 s reveal / 75 s showtime, Levels 5-6 writing 180 s, Glitch Report 30 s, gift window 30 s, Stats Update 30 s, Graduation 60 s.

Untimed steps: Briefing, Level 4 AutoTrial, Levels 5-6 vote, Intermission after Level 1.

The Stats Update timer starts when the gift window closes (when Game enters Stats Update), not when the player opens the Stats Update screen.

### Glitch, reboot, Stuck
- Glitching: any attribute below 0. Exactly 0 is safe. A missed Attendance check-in before the gift window closes also sets Glitching (see Attendance and idle).
- A gift that brings the attribute to 0 or more cancels the glitch.
- Attendance glitch (a missed check-in, see Attendance and idle):
  - Before the gift window closes: the player is Glitching. Teammates see Glitching on the Board. Nothing locks in yet.
  - Any accepted gift to that player during the gift window cancels the pending attendance glitch. Normal gift costs. Points go to the lowest attribute (normal tie order), or to the glitching attribute if one is below 0. It counts for Lifeline.
  - If not saved when the gift window closes, it locks in: glitch count +1, glitched this round, status Glitched, reboot.
  - A miss after the gift window closed locks in at once, with the same reboot.
  - Reboot for an attendance glitch: hearts to 0, 1 point that round, Empathy. No attribute refill.
  - An attendance glitch and an attribute glitch in the same round count as one glitch.
  - Message on a miss before the window closes: "You missed the check-in. You are Glitching. A teammate's gift can save you before the gift window closes." Button: "OK".
  - Message on a miss after the window closed: "You missed the check-in. +1 glitch (x/2)." Button: "OK".
- HUD (owner only): "GLITCHES x/2" next to hearts. Counts all locked glitches of any kind. ANOMALIES stays as it is and never counts glitches.
- Gift window message: never show "No glitch for you this round" if the player has a pending or locked glitch this round. Open window: show that they are Glitching and a gift can save them. Closed window: show the locked glitch (for an attendance glitch: hearts set to 0, attributes unchanged).
- Lock-in: glitch count +1. Reboot: take points evenly from the other attributes until the glitched one reaches 1. Any shortfall the others cannot cover is forgiven. Hearts set to 0.
- Second locked glitch: **Stuck**. Spectator for the rest of the game. Cannot be sabotaged.
- At risk flag: shown if any attribute, plus the hearts that could cover it, cannot pay a cost of 3. The check is fixed at 3 for every level (was 4, changed after playtest round 2). It is not the next trial's cost. The flag updates live, after every change.
- Other players see only flags (Glitching, At risk, Stuck), not numbers.

### Attendance and idle
- Any input resets a 60-second timer: key press, click, touch, mouse movement, and scrolling. Mouse movement counts at most once per second. At 60 seconds, a popup opens with a 15-second countdown ("Still there?" countdown always shows in full before any glitch). No input before it ends is a missed check-in. Idle time, popup time, and the per-round max are settings (host dials).
- Max 1 attendance glitch per player per round. A miss saved by a gift still uses the cap. A second miss in the same round adds no glitch, but still sets idle.
- Popup keys: while the check-in popup is open, a key press only closes it and never reaches any other element. Opening the popup clears focus from the footer button. Space or Enter never advances the game.
- Attendance runs on every input screen, including the Levels 5-6 submission screen and the Vote screen (`pages/vote-test.html` and `pages/vote-test.js`). It is paused on screens that do not need player input: the intro (starting Intermission), every Briefing, every Intermission, every Glitch Report, and every Stats Update. While paused, nothing opens a popup or adds a glitch; pausing closes any open popup with no glitch; resuming starts a fresh 60-second clock from the resume time. The pause decision lives in `rules/Game.js`, not in screen code.
- Graduation: the timer runs for a player only until they have placed all Round 7 points (a player with 0 points to place is paused from the start of Graduation). Everyone is paused after `results()`. Lives in `rules/Game.js`.
- Shared popup UI lives in `attendance-view.js` (used by `index.html` and `pages/vote-test.html`). Rules stay in `rules/Attendance.js` and `rules/Game.js`.
- Idle auto-pilot: any missed check-in sets idle until the player's next input (including misses over the per-round cap). Any input clears idle, on any screen (paused screens too).
- Active players = not Stuck and not idle (`Team.active()`). Used by vote math, light influence, early close of Level 5-6 writing, and Level 3 lobby/crews.
- Idle players cannot give, accept or decline gifts, accuse, sabotage, or vote. Their Glitch Report counts as Skip.
- Gifts to an idle player can be sent; they expire at the end of the step (Open Floor or the gift window) and the giver is refunded. A player who returns before then can still answer.
- Trial costs are paid as normal while idle. Unplaced points are placed by the bot placement rule when the timer ends (Stats Update 30 seconds, Graduation 60 seconds).
- Vote: idle players cannot be ranked. A ballot cast before the voter went idle stays.
- Not blocked while idle: Cash Out, team switching, being sabotaged.
- Graduation: idle when `results()` runs gives Contract renewed, even with graduating stats. A completed second path still wins.

### Sabotage (Contrarian only)
- Teammates only. Not Stuck targets.
- Cost: 1 heart for the first in a round, 2 for each extra in the same round.
- Drain: 2 points from the target's trial attribute for this round. Composure x 10% chance it is only 1 (see Stat abilities).
- Hearts cover a drain below 0, same as any shortfall.
- The victim is told privately.

### Gifts
- Any player can gift any teammate during Open Floor or the gift window, whatever the receiver's status (OK, At risk or Glitching). Every teammate gets a gift button.
- Every gift costs at least 1 heart. A player with too few hearts for the cost cannot gift (the button is disabled).
- Receiver Glitching: points go to the glitching attribute. Receiver not Glitching: points go to their lowest attribute.
- Ties go in this order: Focus, Collaboration, Initiative, Grit, Composure.
- Maxed attribute: if the lowest attribute is at its max, the points go to the lowest attribute that still has room (same tie order). If every attribute is at its max, the giver is refunded.
- The receiver does not pick the attribute.
- The receiver sees "Gift from [name]: Accept or Decline." The giver pays when sending.
- Accept: points land using the rules above. Decline: the points (hearts) return to the giver.
- No answer: the gift is declined and refunded when the current step ends (Open Floor or the gift window).
- Stuck players cannot give or receive gifts.
- An Independent's automatic refusal shows to the giver as a normal decline: "[Name] declined your gift. Your hearts came back." Never mention the type. Gift buttons stay for every teammate.
- Cost by type, Independent refusal and refund, and overflow refund are unchanged (see Types).
- Lifeline counts only a gift that cancels a glitch (the receiver was Glitching before the gift and is not after it). This includes a gift-window gift that cancels a pending attendance glitch.
- Bots treat a teammate with a pending attendance glitch as Glitching (same as the Board).

### Accusations
- One per player per round, against a teammate.
- Every round the all-hands asks: "Suspect a teammate? Accuse or Skip." Never say or imply that sabotage happened. Victims still get their private notice.
- Correct: +1 point, added at Stats Update. Counts toward Auditor for Independents.
- Wrong: accuser loses 1 point from their highest attribute. Can cause a glitch.
- Wrong accusation ties (highest attribute): Focus, Collaboration, Initiative, Grit, Composure.
- A Contrarian caught by a correct accusation loses 0 points. That round's sabotage does not count toward Exploit or Skim. After any catch, on any team, they cannot sabotage on any team for the next round. After that, they cannot sabotage while on a team that caught them; switching teams allows sabotage again. Exploit is never lost.
- Blocked sabotage: the Contrarian sees the sabotage buttons disabled with a short reason. Only they see it.

### Sign in and sign out
- Sign out keeps the display name only. It returns on the next sign-in with the same email. Look, tool and progress reset.

### Anomalies
- There are 3 anomalies: ERROR (the capital L on the sign-in screen), WATCHER (the badge says ATTEMPT 02), LOOP (leaving the endless step out of the SOP).
- The HUD shows anomalies found out of 3. The HUD and the Glitch Report use the same count.
- An attendance glitch never changes ANOMALIES. ANOMALIES counts clues only.
- Ghosts (USER_???, ATTEMPT_01, NULL) give hints only. They do not count as anomalies.

### Points
- Team wins trial: 4. Team loses: 2. Glitched that round: 1.
- Bonuses: correct accusation +1, Skim, Cash Out.
- Round 7: 3 points.

### Judged trials: player vote (used when there is no host)
- Each player ranks their **top 3 players from other teams**. Never themselves, never their own team.
- Points: 1st = 3, 2nd = 2, 3rd = 1, times the voter's Initiative weight. Each player's points go to their team.
- Each team's total is divided by its number of active players (not Stuck, not idle) and by the number of active players who could rank that team's members (active players not on that team), before ranking. If either number is 0, the team scores 0.
- **Top half of teams win, rounded up.** Ties at the cutoff: the team with more first-place ranks wins. Still tied: random.

### Host
- Host is optional. The System Administrator stays as a story role.
- Only the host sees the Host Script button. For solo testing, Ctrl+Shift+H shows or hides it.
- Host present: host does every host duty (starts rounds, runs timers, enters trial results, leads the debrief).
- No host: the engine does them. Judged trials use the player vote.
- **Build no-host mode first.** It is required either way.

### Graduation (round 7)
- Stats Update hides the graduation check until Level 7.
- Graduate: total of all 5 attributes 24 or more (was 22, changed after playtest round 2), every attribute 2 or more, not Stuck.
- A second path completed at any point also counts as a win.
- Placement timer: 60 seconds, with a countdown on screen. Points not placed when it ends are placed by the bot placement rule; points the player already placed stay.
- Idle when results() runs: ending is Contract renewed, even with graduating stats. An idle player with a completed second path still wins.
- Each player's ending is locked when results() runs. No later change can alter it.

## Bot behavior for the prototype

Use the same assumptions as the balance simulation (`Tests\v2_balance\sim_v2.py`):
- Contrarian bots sabotage in 50% of rounds if able, once per round, targeting At risk teammates first.
- After a sabotage on their team: the victim accuses 90% of the time, each other teammate 25%. No sabotage: each player 5%.
- Cooperative bots always gift to Glitching teammates if they can afford it; other types 25% of the time. Gift 2 if affordable, else 1.
- Bots accept 80% of gifts, and answer at once. Tests use a fixed random seed so results repeat run to run.
- Independent bots Cash Out at the first Stats Update with full hearts.
- In round 7, bots raise any attribute below 2 first.
- Bot votes: rank 3 players from other teams at random.

## Levels 5-6 submissions and vote
- Each active player writes one named submission to a prompt, max 300 characters.
- Writing timer: 3 minutes. Closes early when every active player has submitted.
- Typing counts as activity for the Attendance check. Attendance runs on the submission screen and the Vote screen.
- No submission: player cannot be ranked, but can still vote.
- Vote rules stay as they are: rank top 3 players from other teams, Stuck players cannot vote or be ranked, if fewer than 3 can be ranked, rank as many as exist, points divided by active players and by possible voters, Initiative weight applies first.
- Voters see each submission with the writer's name and team.
- Prompts: fixed list of 10 per level in the rules code (placeholders below, team may change). Host picks one or types a custom prompt (max 200 characters, not empty; custom prompt saved on that game's record, not added to the list). No host: engine picks one at random.
- Bots submit the text "Bot answer" so tests still run the vote.

Level 5 prompts (Sprint 2, fixing problems):
1. Halfway through the sprint, you find a bug that breaks the main feature. Fix it now or finish the planned work first? Why?
2. A teammate keeps missing standups and their tasks are falling behind. What do you do first?
3. The client changed a requirement after you built it. How do you respond?
4. Two teammates disagree on a fix and work has stopped. How do you get it moving?
5. Your code passed testing, but a teammate says it is hard to read. Rewrite it or move on? Why?
6. A task will take twice as long as planned. What do you tell the client?
7. You find a mistake in work a teammate already marked done. How do you raise it?
8. The backlog has more fixes than time. How do you decide what to drop?
9. A fix you made broke something else. What is your next step?
10. Your team hits the same problem every sprint. What one change would you make?

Level 6 prompts (Sprint 3, finishing and delivering):
1. The deadline is tomorrow and one feature is not done. Cut it or ask for more time? Why?
2. You have five minutes to demo to the client. What do you show first?
3. The client asks for one more feature the day before delivery. What do you say?
4. The product works but the documentation is thin. What is the minimum you write before handoff?
5. A teammate wants to keep polishing. The rest want to ship. How do you decide?
6. Final testing finds a small bug most users will never see. Ship or fix? Why?
7. What one thing should the client know before using what you built?
8. Your team finished a day early. How should you use the extra time?
9. The client dislikes the final design, but it matches what they approved. How do you handle it?
10. What would your team do differently on the next project?

## Progress board
- Open to all players at any time, including during voting.
- Shows per player: name, team, status (Active, At risk, Glitching, Stuck, Idle). At risk uses the same rule as elsewhere in the game. If more than one status applies, show the first in this order: Stuck, Glitching, Idle, At risk, Active.
- Shows per team: trial wins so far.
- Shows past Level 5 and 6 submissions with name and level.
- Never shows: type, attributes, attribute total, hearts, gifts given or received, Skim, Cash Out, or anything else that could reveal a type.
- Read-only. Uses data the game already stores, plus submissions.

## Not in this build (parked)

- Host mode controls.
- Difficulty dials (round 6 cost 7, graduation total 23).
- Clue system and special abilities.
- Engine auto-dials.
- Trial mini-game for level 4. For now AutoTrial ranks teams in random order (top half win) with an on-screen placeholder note.
- No-repeat prompts across games (Levels 5-6).
- Ollama prompt generation (Levels 5-6).

## Known limits (do not try to fix now)

- Balance depends on trial win rate, guessing skill, and how players spend points. Package A meets 1 to 3 points only at about a 50% win rate with random guessing.
- With 0 Contrarians, Independents cannot complete Auditor.
- Sabotage victims graduate much less often than others. Known and accepted for now.
- Accepted on purpose: Contrarian switcher edge (+3.9 at 16 players, +5.3 at 20, +2.3 at 24), kept as the reward for switching.
- Parked balance issues: all-Cooperative lobby, odd team counts at 20 players, aware spending finishing lower than typical (free heart refills make paying trial costs with hearts cheaper than with points), Independents leading as Contrarian count rises, and the small 5-person vote gap.

## Level 2 trial: Split Brief

- Level 2 uses a new trial kind, Split Brief. Cost 3, paid in Collaboration (already in `Round.LEVELS`). Same light stat influence as other trials (`rankWithInfluence`).
- Every team gets the same scenario. The brief has 5 cards, dealt round-robin to the team's active players (not Stuck, not idle). Small teams hold extra cards.
- Shuffle per game: at deal time, `game.rng` shuffles which letter (A, B, C, D) each backlog task gets and the order the brief cards are dealt and shown; answer keys, bot notes, and the screen follow the mapping (saved in `toJSON`/`fromJSON`).
- Cards are private. Only the holder sees them.
- Talking out loud is allowed. Team notes exist for remote players and bots.
- Team notes: active players can post to their own team's feed. 80 characters max per note. 3 notes per player per trial, with a "notes left" counter. Notes show the poster's name. Only that team sees its feed.
- Board: 4 backlog tasks. The team picks 2 and orders them (slot 1, slot 2). Any active teammate can edit.
- Lock In: any active player can lock their team's board. Lock In is final; the board freezes for the whole team. Early lock-in is allowed.
- Ghosted Teammate twist: at the 90 second mark, one random active player on each team gets the twist card as a popup ("Breaking news. Only you got this."). Only that player sees it. It still fires for teams that already locked in.
- Timer: 180 seconds. The trial closes early when every team has locked in. The board at lock-in or timer end is scored.
- Scoring, against the post-twist answer key: +2 per correct task picked, +1 if both tasks are correct and in the correct order. Max 5. An empty board scores 0.
- A team with only bots gets a random base score from 0 to 5 (same idea as Level 1).
- Ranking: score after influence, then earliest Lock In after the twist fired (teams that locked in before the twist, or never locked in, have no lock-in time for this step and rank below teams that have one), then random using `game.rng`. Top half win (`Trial.winners`).
- Bots: post an accurate pre-written note for each card they hold at a random time in the first 30 seconds, but keep 1 note in reserve until the Ghosted Teammate twist fires, then post it. A bot holding the twist posts it as a note within 10 seconds. Bots never edit the board or lock in. Bot notes count toward the 3-note cap.

### Scenario: Medline Sprint 1 Demo
- **Tasks:**
  - **A** Build the login page (3 days).
  - **B** Write the client status report (1 day).
  - **C** Import Medline data (2 days).
  - **D** Build the dashboard (2 days).
- **Cards:**
  1. **Deadline:** "Demo is in 4 work days. Only finished tasks count."
  2. **Must-have:** "Client: 'We must see the dashboard at the demo.'"
  3. **Blocker:** "The dashboard needs real data. Data import must finish first."
  4. **Scope:** "Login is not in scope for Sprint 1."
  5. **Red herring:** "Marketing loves long status reports. Do one if you can."
- **Pre-twist answer:** C then D.
- **Twist card:** "Data vendor is down. Import can't start this sprint. Client will accept the dashboard with sample data. Send them a status report after the dashboard explaining the change."
- **Post-twist answer (scored):** D then B.

## Per-level clues, briefing, and end screen

- Ghosts and the tea guest give clues during the Lobby and Open Floor, same as Level 1 (walk up, Listen or Network, only that player sees it, text only, no rule effect). Their text comes from a per-level hint table, not hardcoded text. Level 1 text stays exactly as it is now.
- Level 2 hints:
  - `ATTEMPT_01`: "We locked our plan in early. Then the client changed everything."
  - `NULL`: "Not every note is true. Check who wrote it."
  - `USER_???`: "The news comes halfway through. Only one of you hears it first."
  - Tea guest: "On my first sprint, we committed to a plan on day one. Halfway through, our vendor went down and the plan was dead. Now I wait for the news before I commit. And whoever hears it first tells everyone."
- Level 2 briefing:
  - Header: "System Briefing · Level 2"
  - Title: "Sprint 1: Back-Plan the Demo"
  - Tests: Collaboration, cost 3
  - Memo: "Medline wants a demo in 4 days. Your team has more work than time. Each of you holds part of the client brief. Share what you know, pick the 2 tasks that matter, and put them in order. Plans change. Stay alert."
  - Weeks: Weeks 2–4 (Sep 8 – Sep 25)
  - Workshops: LW3A Perception vs. Intent · LW3B Roles + Handoff · BW3B Prioritize Under Pressure · W3A 14-Week Budget · BW4A Credibility in Writing · BW4B Tell the Story · LW4A Act on Purpose Under Pressure · W4A Emotional Patterns Map
- The host script (`FAC`) gets per-level entries. Level 2 entries say: Collaboration, cost 3, Split Brief.
- After Level 1's Stats Update, the browser continues to Level 2 (`G.startNextRound`, then the Briefing screen).
- After Level 2's Stats Update, show a "Sprint 1 Complete" screen: your Level 1 and Level 2 trial results (win/loss), hearts left, glitch count (`x/2`), status, your 5 attributes; your team name and trial wins out of 2; all teams ranked by trial wins; a "Start Level 3" button (replacing the old "Level 3 locked" card) with Replay and Back to sign-in buttons. Never show work styles or secret path progress on this screen.

## Level 3 work rules (for every agent)

- Level 3 is built one step at a time from `docs/level3-progress.md` on branch `level3-mirror`. Do one step per task, then stop.
- At the start of every task, read `CLAUDE.md`, `docs/level3-progress.md`, and `docs/level3-report.md`.
- Hannah Ziegler is the Level 3 designer. Her first version of Level 3 lives in commit `cdf3eff` on `backup/Level3`. Her code is a reference only: read it with `git show cdf3eff:<path>` or `git show hz-level3:<path>` (same commit as `cdf3eff`). Never merge, rebase, or cherry-pick it.
- CLAUDE.md is the source of truth for rules. If code and CLAUDE.md disagree, stop and report it. Do not guess.
- After each step: `npm run build`, then `npm test`. Run `npm run test:screens` only when the step touches screen code (`game.js`, `mirror-view.js`, `mirror-dance-view.js`, `world-map.js`, `pixel-art.js`, `board.js`, `index.html`, `styles.css`).
- Never save a new baseline unless the step says so. Explain any baseline change before saving.
- At the end of every step: update `docs/level3-progress.md` (mark the step done, list files changed, test results, any open issues), commit on `level3-mirror`, and push to `origin` and `backup`.
- The 9 Level 2 QA bugs are fixed per `docs/screen-state-plan.md`.
- Do not edit `docs/design/Mock_Interview*` (partner's file).

## Level 3 trial: The Mirror: Presentation Day

- **Designer:** Hannah Ziegler (original prototype in `cdf3eff` on `backup/Level3`; rebuilt in our OOAD rules and screen structure).
- **Name, class, cost:** Name is **The Mirror: Presentation Day**. `trialKind` is `"mirror"`, class `MirrorTrial`. Tests Focus, costs 3 (unchanged in `Round.LEVELS`).
- **Lobby:** Its own 30-second timer. Each active player connects themselves with Hannah's signal-grab tile (moving cursor 0 to 100, start speed 7 to 10, green band width 14; tap when the moving cursor is in the green band; a miss wobbles the line and speeds up that tile by +2 up to 16, her numbers from `cdf3eff`). Stuck and Idle players are not in the lobby or the crews (`Team.active()` only). If any active player is still out when the doors close, the team's trial fails with score 0. Bots always connect after a random 3 to 15 seconds.
  After a sleep, a missed mirrorLobby deadline closes at the deadline, not at the last bot's connect time (same as the save/load wake-up rule). Live play and slept play can differ by a few seconds; there is only one game copy, so players never see different timelines.
- **Crew deal and reveal:** Seeded `Rng`, active players only. Setup Crew gets half rounded up, max 3 (`Math.min(3, Math.ceil(activeCount / 2))`). The rest are Dance Crew. Then a 1-second `CREW LOCKED` reveal before showtime starts.
- **Setup split and turn order:** Setup Crew works the 5 steps in order, each turn starting when the previous Setup player finishes:
  - 1 Setup player: does all 5 steps (cables, sound, mic, deck, Q&A).
  - 2 Setup players: P1 does cables, sound, mic; P2 does deck, Q&A.
  - 3 Setup players: P1 does cables, sound; P2 does mic, deck; P3 does Q&A.
  - Slot order is dealt by seeded `Rng`. Waiting Setup players see the live step checklist. The last Setup player presses "Wrap up the presentation" to end the trial.
- **Setup steps and penalties (Hannah's rules and numbers from `cdf3eff`; see `docs/level3-report.md` section 1):**
  1. **Cables (Patch the rack):** 4 ports (`HDMI`, `USB-C`, `AirLink`, `VGA`) slide across a moving belt toward a plug frame (travel 11 ticks / 2.75 s, spawn gap speeds up 6 -> 5 -> 4 as machines connect). Click the matching machine while its cable is in the frame (within 2 ticks). Wrong clicks spark and cost 3 attention. Missed cables return to the belt.
  2. **Sound check:** Starts at 45, drifts toward 45 every tick (with slight jitter), and spikes +8 to +17 every 12 to 20 ticks (3 to 5 s) when the crowd whoops. Controls `-10`, `+5`, `+10`. Hold the level in the green zone (70 to 85) for 3 straight seconds (12 ticks). Hitting 100 or higher causes feedback, resets sound to 45 and hold timer to 0, and costs 4 attention.
  3. **Mic check:** Three memory rounds of lengths 3, 4, and 5 across `MIC 1` to `MIC 4`. The sequence flashes (9 ticks on round 1; `6 + length` ticks on later or retry rounds), hides behind `?`, and the player taps it back. A wrong tap costs 4 attention and flashes a new sequence for that round.
  4. **Grab the deck:** Six files (`MEDLINE_deck_v1_draft.pptx`, `MEDLINE_deck_v2_client_comments.pptx`, `MEDLINE_deck_v3_CLIENT_SIGNED.pptx` [correct], `MEDLINE_budget_v3.xlsx`, `team_retro_cat_video.mp4`, `DO_NOT_OPEN.exe`) reshuffle every 2 seconds (8 ticks). Clicking a wrong file costs 6 attention and triggers an extra reshuffle (2 ticks / 0.5 s).
  5. **Rapid-fire Q&A:** 3 Medline multiple-choice questions, one at a time, each with a 29-tick (7.25 s) countdown bar. A right answer restores up to 5 penalty points (`Math.max(0, pen - 5)`). A wrong answer or timeout costs 5 attention. After question 3, the last Setup player presses "Wrap up the presentation" to end the trial.
- **Dance Crew:** Each dancer plays their own rhythm lane with Hannah's rules and numbers from `cdf3eff` (arrow notes `left/up/right/down` with no 3 identical in a row, travel 10 ticks / 2.5 s, note gap 6 -> 5 after 20 notes -> 4 after 40 notes; inner band within 1 tick = PERFECT +3 boost, outer band within 2 ticks = good +2 boost; stray press costs 1 attention and resets combo; missed note costs 2 attention and resets combo). Each dancer's boost caps at 45. Dancer boosts and dancer penalties are averaged across dancers. 0 dancers means no dance boost (and 0 dance penalty).
- **Showtime:** Its own 75-second timer. Attention drains only during showtime.
- **Attention:** `base (showtime seconds left / 75 * 100) + average dancer boost - setup penalties - average dancer penalties`, clamped 0 to 100. Attention 0 ends the trial with score 0.
- **Score, ranking, and ties:** Score is `Math.round(attention / 100 * 7)`, 0 to 7. Ranking adds the usual light Focus influence (`rankWithInfluence`). Top half of teams win (`Trial.winners`), same as other trials. Ties break by higher exact attention first, then random (`Rng`).
  A lobby-failed team's score of 0 still goes through `rankWithInfluence`, same as a 0 in Levels 1 and 2.
- **Bots and Idle humans:**
  - Lobby: bots always connect after a random 3 to 15 seconds.
  - Setup slots: bot setup slots finish each step after a set time; each step has a 30% hiccup costing 3 attention; a bot in the last slot wraps up automatically.
  - Dance Crew: bot dancers gain +1 boost every 1.5 to 2.5 seconds up to 45, no misses.
  - Bot-only teams: roll a random attention 0 to 100 and score from it (`Math.round(attention / 100 * 7)`).
  - Idle humans: follow the existing idle auto-pilot rule (bot rule plays their part).
- **Multiplayer and code split:** Each player plays their own part on their own device. Screens draw motion from rules data and report player input. The rules own all Level 3 deadlines, timeouts, penalties, content picks, randomness and scoring. The rules engine holds all Level 3 state, step order, and boosts. All randomness uses the seeded `Rng`. `Game.toJSON` and `Game.fromJSON` must capture mid-trial Level 3 state.
- **Class split:** `MirrorTrial` coordinates three private parts (`#lobby`: `MirrorLobby`, `#setup`: `SetupCrew`, `#dance`: `DanceCrew`) defined in `rules/MirrorParts.js` (exported through `rules/index.js`, following the one-line import/export rule). Outside code (`Game`, screens, bots) only calls `MirrorTrial`. Each part has its own `toJSON`/`fromJSON` and uses the seeded `Rng` passed in from `MirrorTrial`.
- **No hardcoded team names:** Never hardcode team names anywhere in Level 3.

### Level 3 clues, briefing, host script, end screen, and dev jump

- **Ghost hints (per-level hint table, Level 3):**
  - `USER_???`: "The doors closed with one of us still outside. They don't wait for stragglers. Neither does the client."
  - `ATTEMPT_01`: "I grabbed the first deck I saw. Draft. Wrong version. The client only trusts what they signed."
  - `NULL`: "Seventy to eighty-five. Louder is not better. When the crowd roars, pull the sound down."
- **Tea guest story (Level 3):**
  - "My first client demo, the projector cable didn't fit. We had tested everything except the room. Now I check the setup first, I keep the signed version of the deck in one place, and I know the client's problem cold before anyone asks me a question. A presentation fails in the setup long before it fails on stage."
- **Level 3 briefing:**
  - Header: "System Briefing · Level 3"
  - Title: "The Mirror: Presentation Day"
  - Memo (to `{name}` and `{team}`): "Today you present to Medline. The call opens in 30 seconds. Every active member must connect before the doors close, or the room empties and your team scores zero. Once you're in, crews are drawn at random. Setup Crew runs the steps in order: cables, sound, mic, deck, Q&A. Dance Crew keeps the audience awake. Attention drains from the moment showtime starts. Finish fast and finish clean."
  - Stat cards: same format as Level 2 (tests Focus, costs 3, your Focus).
- **Host script (`FAC`):**
  - Briefing: "Level 3. Presentation Day. Read the memo. You present to the Medline client today."
  - Trial lobby: "Doors open. Connect to the call in the next 30 seconds. Anyone left outside, the whole team fails."
  - Trial showtime: "Crews are locked. Setup, work your steps in order. Dancers, keep the room awake. Attention is draining. Go."
- **End screen:** After Level 3 Stats Update, show a "Presentation Day Complete" screen in the same format as Sprint 1 Complete (no work styles or secret paths). Sprint 1 Complete gets a "Start Level 3" button.
- **Dev jump:** `Ctrl+Shift+1` to `7`, always on in the prototype. Jumping forward fast-forwards rounds. Jumping to the current or an earlier level starts a new game and fast-forwards to that level. For Base44 handoff: flag off in the real game, on in a test copy. The dev jump is not removed.
