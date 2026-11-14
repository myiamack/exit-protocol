

## Your role

You are my build partner for Exit_ProtocoL, a team game. We are updating my local prototype so I can play the final rules. All rules are already decided. Do not reopen them. If a rule is unclear or missing, ask me. Do not invent one.

## How to work with me

- Give me **one instruction per message**. Wait for me to confirm before the next one.
- Use simple, plain language. Explain any technical term in one short sentence.
- No em dashes. No filler.
- I use **VS Code** on Windows. Give keyboard shortcuts when useful.
- Simplest option wins. If one option is materially harder to build, take the simpler one.
- Stay close to the original concept. Change something only with a good reason.
- Do not limit player choice unless necessary.
- When a step builds a useful skill (data, tech, people), point it out in one line.

## Where the code lives

- Repo: `C:\Users\shcop\projects\exit-protocol`
- Branch: **ben-ooad**. Never merge to main. Never push to main.
- Word documents stay off GitHub.
- Balance simulation already in the repo: `Tests\v2_balance\` (Python). It is the reference for checking our rules code.

## Already done (do not redo)

- Pixel font replaced with a readable mono font (`--px:var(--mono);` in styles.css and pages/character-system.html). Committed on ben-ooad.
- Checkpoint commit "Checkpoint before OOAD refactor" on ben-ooad. Every file is saved; the working tree is clean except untracked docs.
- A `rules/` folder already exists in the repo. It may hold earlier refactor work. Read it before creating anything.

## Screen fixes queued (do after the refactor, step 4)

- Points screen: show one number per stat, with the type bonus already applied. Bonus stats start at 3. Every stat can reach 10; weak stat max 4.
- Use one name for hearts everywhere. Done: "hearts" (code, screen text, this file).
- Each type briefing shows the type's real drawback: Cooperative Empathy, Independent cannot accept gifts, Contrarian caught rules.

## Build path (decided)

1. Update the exit-protocol prototype first. No Base44 credits.
2. Base44 later, for multiplayer only. Rule classes will move there through Base44's Code tab.
3. The prototype is single player with bot teammates. That is fine for now.

## Code structure (decided): lean OOAD, 8 classes

Rule classes must contain **no screen code**. They only change numbers and return results. No DOM, no buttons, no `document`. This lets the same files run in the prototype, in a Node test script, and later in Base44.

| Class | Owns |
|---|---|
| Player | Type, 5 attributes, hearts (a Hearts object), glitch count, flags, second-path progress. Methods: pay trial cost, cover shortfall with hearts, take points from highest, reboot, place earned points, status flags. |
| Team | Members, trial result for the round. |
| Round | Level number, trial attribute, cost, judged or auto-scored, step order. |
| Sabotage | Cost, drain, Composure shield, target rules. |
| Accusation | One per player per round, correct or wrong, point effects. |
| Gift | Cost by type, Independent refusal and refund, overflow refund, Lifeline credit. |
| Vote | Ranked top 3, team totals, top half wins (rounded up), tie rule. |
| Trial | Base class. Takes the round and the teams, returns a ranked list (best first). Top half win, rounded up: 4 teams 2 win, 5 teams 3, 7 teams 4. Subclasses: SopTrial (Level 1), AutoTrial (Levels 2 to 4, random order for now), JudgedTrial (Levels 5 and 6, uses Vote). Ties: judged = more first places, then random; others = random. |
| Game | Runs rounds in step order, applies all rules, Stuck, graduation check, endings, host or no-host mode. |
| CharacterType | Base class with 3 subclasses: Cooperative, Independent, Contrarian. Each answers: bonus, penalty, max, giftCost, giftRefundPerPoint, canAcceptGifts, canSabotage, path name and goal, plus hasEmpathy, hasCashOut, hasSkim and which event counts for its second path. No `type === "coop"/"indep"/"contra"` checks anywhere else: other code asks the type. |
| Hearts | The heart count (start 3, cap 3). Only its methods change it: spend, refill, refund, lose, empty. Nothing else touches the number. |

Player.type is a CharacterType object, not a string. Its `key` ("coop", "indep", "contra") is only for lookups and saved data.

Small things (single attributes, flags) are fields and methods inside these classes, not their own classes. Add a class later only if one gets too crowded.

## Final rules

These are rules v2 from my OOAD Class Reference v2, plus changes decided after balance testing. Where this list and the v2 doc disagree, **this list wins**.

### Character creation
- 5 attributes: Focus, Initiative, Collaboration, Composure, Grit.
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

### Levels (Package A order; trial activities stay in their original levels)
| Level | Trial activity | Attribute | Cost | Scored by |
|---|---|---|---|---|
| 1 Boot Up | SOP mini-game | Grit | 2 | SopTrial: SOP score |
| 2 Sprint 1 | Prioritize against a timer | Collaboration | 3 | AutoTrial (random for now) |
| 3 The Mirror | Q&A gauntlet | Focus | 3 | AutoTrial (random for now; later set answers) |
| 4 Geek Week | Testing challenge | Initiative | 4 | AutoTrial (random for now) |
| 5 Sprint 2 | Fix the broken team | Composure | 4 | JudgedTrial: player vote |
| 6 Sprint 3 | Final build and dream speech | Grit | 6 | JudgedTrial: player vote |
| 7 Graduation | Crack the simulation | All five | none | Graduation check |

If game.js scores any trial differently, show me and ask before changing it.

Every trial ranks the teams. **Top half win, rounded up** (5 teams: 3 win; 7 teams: 4 win).

SOP score (Level 1, decided in Part 3): 1 point per step in the right place (0 to 6), +1 if the endless step is left out (max 7). Placing nothing does not count as leaving it out. Higher score ranks higher; ties random. Bot teams get a random score from 0 to 7. The old pass mark (5 right and endless step out) is gone.

### Round step order (levels 1 to 6)
1. **Open Floor:** Contrarians may sabotage. Any player may gift a teammate.
2. **Trial:** every non-Stuck player pays the cost from the tested attribute. **Glitching players pay too.** Hearts cover any shortfall.
3. **Glitch Report:** accusations.
4. **Gift window** (about 30 seconds): gifts to any teammate (see Gifts).
5. **Lock-in:** any player still below 0 glitches. Reboot. Empathy.
6. **Stats Update:** earn points, place them, refill hearts by 1.

### Glitch, reboot, Stuck
- Glitching: any attribute below 0. Exactly 0 is safe.
- A gift that brings the attribute to 0 or more cancels the glitch.
- Lock-in: glitch count +1. Reboot: take points evenly from the other attributes until the glitched one reaches 1. Any shortfall the others cannot cover is forgiven. Hearts set to 0.
- Second locked glitch: **Stuck**. Spectator for the rest of the game. Cannot be sabotaged.
- At risk flag: shown if any attribute, plus the hearts that could cover it, cannot pay a cost of 3. The check is fixed at 3 for every level (was 4, changed after playtest round 2). It is not the next trial's cost. The flag updates live, after every change.
- Other players see only flags (Glitching, At risk, Stuck), not numbers.

### Sabotage (Contrarian only)
- Teammates only. Not Stuck targets.
- Cost: 1 heart for the first in a round, 2 for each extra in the same round.
- Drain: 2 points from the target's trial attribute for this round. Composure x 10% chance it is only 1 (Part 4b; replaces the old "Composure 6 or more" rule).
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
- Lifeline counts only a gift that cancels a glitch (the receiver was Glitching before the gift and is not after it).

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

## Bot behavior for the prototype

Use the same assumptions as the balance simulation (`Tests\v2_balance\sim_v2.py`):
- Contrarian bots sabotage in 50% of rounds if able, once per round, targeting At risk teammates first.
- After a sabotage on their team: the victim accuses 90% of the time, each other teammate 25%. No sabotage: each player 5%.
- Cooperative bots always gift to Glitching teammates if they can afford it; other types 25% of the time. Gift 2 if affordable, else 1.
- Bots accept 80% of gifts, and answer at once. Tests use a fixed random seed so results repeat run to run.
- Independent bots Cash Out at the first Stats Update with full hearts.
- In round 7, bots raise any attribute below 2 first.
- Bot votes: rank 3 players from other teams at random.

## Build order

Do these in order. Finish and test each before starting the next.

1. **Read first, change nothing.** Read game.js, index.html, styles.css, README.md, and everything in the `rules/` folder. Tell me in plain words how the code is organized, how a round runs, and where the rules live. Then propose a short plan.
2. **Create or finish the 8 rule classes** in the `rules/` folder as JavaScript modules. Reuse what is already there if it fits. No screen code.
3. **Check the classes against the simulation.** Write a small Node script that plays 1,000 bot games with 16 players (8 Cooperative, 5 Independent, 3 Contrarian), 4 teams of 4, 50% trial win rate, random guessing (accusers pick the saboteur 1 time in 3). The simulation got about 78% to 80% overall graduation for typical players, with types within 1 to 3 points (type gap target). If our results are far off, find out why before moving on.
4. **Connect the classes to the existing screens,** replacing the old rule logic. Keep the current look.
5. **Add the vote screen** for levels 5 and 6.
6. **Playtest checklist:** a short list of what I should watch for when I play.

After each step: tell me what changed, then give me the exact git commands to commit it to the ben-ooad branch.

## Refactor queue (Parts 1 to 13, decided)

One part at a time. After each: run Tests/check_rules.js, check_steps.js, check_gifts.js, show results, give commit commands, wait for confirmation. After any rule change, also run check_cheese.js and check_balance.js.

1. Done. Rename backup to hearts everywhere. Hearts class owns the count; only spend, refill, refund, lose, empty change it.
2. Done. CharacterType base class with Cooperative, Independent, Contrarian subclasses. No type name checks outside them.
3. Done. Trial base class (see Trial in the class table). Vote uses Math.ceil.
4. Caught Contrarian: a caught sabotage does not count toward Exploit. A Contrarian cannot sabotage while on a team that caught them; switching teams allows sabotage again. Exploit is never lost. Replace sabotageLocked and pathLost with a list of team ids that caught the player. Skim stays: +1 per uncaught sabotage round, max 2 per game.
4b. Stat abilities. Each uses the stat's value at that moment (negative counts as 0, max 10). All chances use the game's seeded rng so tests repeat.
   - Focus (Accusation): a wrong accusation has a Focus x 10% chance to cost nothing.
   - Collaboration (Gift): a sent gift that is not refused has a Collaboration x 10% chance to cost 1 heart less. Every gift costs at least 1 heart (changed after playtest; was "costs 0 hearts"). An overflow refund never returns more than the giver paid.
   - Initiative (Vote): each voter's ranking points (3/2/1) are multiplied by 1 + Initiative / 10. The ability line says "applies in Levels 5 and 6".
   - Grit (end of round, after the normal refill): Grit x 5% chance of +1 heart, capped at the max.
   - Composure (Sabotage.drain): Composure x 10% chance the drain is 1 instead of 2. Replaces the old "Composure 6 or more" rule.
   - Light influence (Trial base class, Levels 1 to 4 only): team score += 0.5 x (team's average in the tested attribute, active players only, minus the average of all teams). Judged levels unchanged. Base score for Levels 2 to 4: a random whole number 0 to 7 (same range as SOP), plus the influence.
   - The tested attribute for a level stays hidden on screen until that level's briefing.
   - Show each ability's chance on the player's own screen (for example "Focus 6: 60% safe accusation"). Never show other players' chances.
4c. Done. Tests/check_balance.js. For each setting run 2,000 seeded bot games.
   - Headcounts: 16 (4 teams of 4), 20 (5 of 4), 24 (three of 4 and four of 3).
   - Type mix: random. In each game, every player's type is picked at random with equal odds.
   - Spending: typical (current bot rule) and aware (bots put half their earned points, rounded up, into the next level's attribute; the rest the typical way).
   - Report per setting: graduation %, win % by type, graduation % by type, type gap, second path % by type, Stuck %, percent of sabotages caught, and how often Level 1 winners win later trials versus Level 1 losers.
   - Group games by Contrarian count and show the type gap for each group, so extreme mixes do not hide in the average. Groups under 50 games are marked "few games".
   - Target check: type gap of 1 to 3 points, labeled PASS or FAIL, overall and by player count. This is the goal. Use it in every balance report.
   - No match check (the old expected numbers came from a fixed mix).
5. Done. Team switching in Open Floor. Teams stay 3 to 5 members; refuse a switch that would break that. A player who sabotaged this round cannot switch that round.
5b. Done (closed). Tuning. Goal: find and close cheese strategies, not exact balance across mixes. A cheese is a strategy that wins clearly more than normal play. Tests/check_cheese.js has bots play each one on purpose and compares them to normal play. Report each one before changing any rule. Strategies to test:
   1. Never pay trial costs with points; let hearts cover them.
   2. A Contrarian who switches teams after every catch.
   3. Everyone picks the same type.
   4. Players form as many 3-person teams as possible to farm the small-team heart (Part 6).
   First results: 1 not a cheese (-2 to -3). 2 cheese (+3.6 to +10.6). 3 all Cooperative is a cheese (+23 to +28). 4 not a cheese (small teams lose); but odd team counts lift win rates (rounding up), and the player vote favors bigger teams (Levels 5-6: 4-person teams win 73%, 3-person 45%).
   Fix (a), switcher, try 1 (undone): caught = lose 1 point from highest. Switcher edge +9.1 / +6.3 / +1.4 (16 / 20 / 24); all Contrarians weaker (type gap 17.7 typical).
   Fix (a), try 2 (current): after any catch, no sabotage on any team next round (see Accusations). Wrong accusation ties now use the usual order. Switcher edge +7.5 / +6.5 / +0.5. Still a cheese at 16 and 20 (Exploit 21% vs 15%). check_balance.js unchanged from Part 4c (type gap 10.5 typical, 15.8 aware), because bots that do not switch were already blocked on their own team.
   Fix (c), vote favors big teams: team vote total divided by active players (see Judged trials). Levels 5-6 now favor small teams instead: 3-person vs 4-person 60% / 54% (24 players), 62% / 50% (16); 3-person vs 5-person 54% / 30% (20). Cause: a player cannot be ranked by their own team, so a bigger team has fewer possible voters per member. Switcher edge now +3.9 / +3.6 / +2.5. Type gap 10.1 typical, 15.8 aware.
   Fix (c), try 2 (current): also divide by active players not on that team. Levels 5-6 by size: 3 vs 4-person 57% / 57% (24 players), 60% / 60% (16); 3 vs 5-person 51% / 45 to 47% (20). Cheese (c) closed; a small 5-person gap remains. Switcher edge +3.9 / +5.3 / +2.3 (16 / 20 / 24): cheese (a) still open at 16 and 20. Type gap 10.2 typical, 15.8 aware.
   Tests/check_balance.js stays as a general check (type gap 1 to 3 under random mixes, typical and aware). Known issues it shows:
   1. Aware spending finishes lower than typical, because free heart refills make paying trial costs with hearts cheaper than with points. Careful play must not lose to careless play.
   2. Independents lead because Auditor gets easier as Contrarians increase. The gap grows from 1.6 at 2 Contrarians to 13.3 at 6 (16 players, typical spending).
   Final status:
   - Closed: (c) vote favoring big teams.
   - Accepted: (a) Contrarian switcher. Edge +3.9 at 16 players (+5.3 at 20, +2.3 at 24), kept on purpose as the reward for switching.
   - Parked, not fixed: (b) all-Cooperative lobby; odd team counts at 20 players; aware play not paying off; the small 5-person vote gap.
   - Standing checks: Tests/check_cheese.js and Tests/check_balance.js. Run both after any rule change.
   - Tested, not adopted: Cooperative heart cap 4 (start 3). Type gap 12.5 typical / 16.2 aware (cap 3: 12.8 / 16.0). Cooperative Lifeline falls from about 15% to 5%; all-Cooperative lobby is no longer a cheese (Lifeline 0%, nobody glitches).
6. Quiet heart buff. At the start of each round, every non-Stuck player on a team with 3 or fewer active players (not Stuck, not idle) gets +1 heart, capped at the normal max. Not shown on screen. Logged for the host only.
7. Attendance class. Any key, click or touch resets a 60-second timer. At 60 seconds, a popup with a 15-second countdown. No input before it ends: +1 glitch count, attributes unchanged. Max 1 Attendance glitch per player per round. Two glitches of any kind = Stuck. Idle time, popup time and the per-round max are settings (host dials).
8. Idle auto-pilot. Missing an Attendance check makes a player idle until their next input. Idle players take no optional actions (no gifts, accusations, sabotage, votes). Gifts to them expire. Trial costs are paid as normal. Points are auto-placed by the bot placement rule. Idle at Graduation: ending is Contract renewed.
9. Move all rule math out of game.js (checkSop, payCost, lockPoints and any other). game.js only draws screens and calls the rules classes. Remove global rule state that duplicates Game.
10. Full screen button on the game screens.
11. Tests/check_teams.js: 1,000 games each at 16 players (4 teams of 4), 20 players (5 teams of 4), 24 players (7 teams: three of 4, four of 3). Report graduation, win by type, type gap, win by team size.
12. Convert every file in rules/ to ES modules (export class / import). Browser prototype keeps working (script type="module"); all Node tests keep passing.
13. Save and load. Game.toJSON() returns the whole state as plain data (players, teams, hearts, glitches, round, step, gifts, sabotages, accusations, votes, attendance, idle flags, rng state), with players and teams referenced by id. Game.fromJSON(data) rebuilds an identical game. Tests/check_save.js plays random bot games, saves and reloads after every step, and confirms final results match games that never reload. Reason: Base44 Actors sleep after about 10 seconds of quiet and lose anything not saved.

## Not in this build (parked)

- Base44 build and real multiplayer.
- Host mode controls.
- Difficulty dials (round 6 cost 7, graduation total 23).
- Clue system and special abilities.
- Engine auto-dials.
- Trial mini-games for levels 2 to 4. For now AutoTrial ranks teams in random order (top half win) with an on-screen placeholder note.
- Levels 5-6 vote redesign (not built yet). Players write a short named submission to a prompt. Others rank submissions using the current vote rules. Prompts are a fixed, reviewed list in the rules code. Host picks or writes one; with no host, the engine picks one at random. Open: prompt rules sign-off, pool size, submission length, timer, no-submit rule, writing the prompts.

## Known limits (do not try to fix now)

- Balance depends on trial win rate, guessing skill, and how players spend points. Package A meets 1 to 3 points only at about a 50% win rate with random guessing.
- With 0 Contrarians, Independents cannot complete Auditor.
- Sabotage victims graduate much less often than others. Known and accepted for now.
