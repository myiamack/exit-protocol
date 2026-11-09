# Base44 Build Prompt: Level 1 (Boot Up)
Game: Performance_Review: Exit_ProtocoL
Visual reference: the Level 1 prototype on claude.ai (match its look and flow)

---

Build a multiplayer web game called "Performance_Review: Exit_ProtocoL" (spoken "Performance Review: Exit Protocol"). Keep the capital L at the end of the title exactly as written. It is a deliberate clue, do not correct it.

## Concept
Players think they are starting a normal 14-week tech internship at a company called "Nexus Workforce Systems." The app should look like a clean, slightly too-perfect corporate onboarding portal. Small glitches hint that it is actually a simulation. Each level is one phase of a real 14-week program. Build ONLY Level 1 for now, but structure data so Levels 2-7 can reuse the same round template.

## Roles
- Player: joins from their own device with a game code.
- System Admin (facilitator): creates the game, sees all players, advances phases for everyone, and sees a script panel for each phase.

## Data
- Game: code, current_level (1), current_phase (0-6), phase_timer_seconds.
- Player: game_code, character_name, skin_tone (0-11), traits (max 3), fun_fact, likes, dislikes, meters {tech, business, leadership, wellness} each 0-10 starting at 5, anomalies_found (list of clue ids), glitch_count (0), level1_tasks (2 ids), sop_score, sop_decoy_removed, sop_on_time.

## Always-visible HUD (players)
Four meter bars: Tech, Business, Leadership, Wellness (x/10). An "Anomalies x / 5" counter with a dashed magenta border. A progress row of the 7 phases.

## Level 1 phases (System Admin advances each one)
0. Login / Title screen: big title "Performance_Review: Exit_ProtocoL". The final L flickers slightly every few seconds. If a player taps the L, add anomaly "L" (kind ERROR). Fake system log: "loading workforce_profile ... ok", "assigning cohort: CYCLE_60 ... ok", "checking exit_conditions ... NOT FOUND" (in magenta).
1. Profile (Know Your Lens): character name (original, not their real name), 12 skin-tone swatches, simple avatar, pick up to 3 traits (Builder, Listener, Planner, Connector, Problem-solver, Storyteller, Calm under pressure, Detail-minded, Big-picture, Encourager, Fast learner, Risk-taker), fun fact, likes, dislikes. The badge shows "ID 060-### · ATTEMPT 02" and "ATTEMPT 02" flickers. Tapping it adds anomaly "id" (kind WATCHER).
2. System Briefing: memo "Boot Up: Team Week". Welcome to Nexus; you've been placed on a project team; your first client (a national medical supply company) sent a Request for Proposal; agree on how your team works before Sprint 1 starts Sep 8. Show facts: Weeks 1-2, early September; Team Week, teams formed, RFP received, SOP challenge; workshops LW2A, LW2B, BW2B, W2B.
3. Open Floor (timer, default 3 min): pick exactly 2 of 4 tasks. Each gives +2 to one meter:
   - LW2B Write the Team Agreement → Leadership
   - BW2B Back-plan the Medline RFP → Business
   - BOOT Set up your workstation → Tech
   - W2B Take a Financial Snapshot → Wellness
   If time runs out, auto-fill remaining picks.
4. The Trial: SOP Challenge (timer, default 1 min). Shuffle these 7 cards; player taps them into order:
   1 Fill the reservoir with cold water / 2 Place a paper filter in the basket / 3 Add 2 tablespoons of ground coffee per cup / 4 Close the lid and press Start / 5 Wait until brewing finishes / 6 Pour into a mug and serve.
   Decoy card: "Repeat step 1 until performance is satisfactory". Instruction: "Leave out anything that doesn't belong." On check, mark each placed step green/red. If decoy left out, add anomaly "loop" (kind LOOP).
5. Glitch Report: monospace "SYSTEM NOTICE: irregularities detected in your environment" panel with a short shake animation. List the 3 anomalies; found ones show their kind tag and explanation, missed ones show "???" and a hint. End with "Match 5 of the same kind to unlock a piece of the truth" and "please continue working normally."
6. Stats Update: show each meter before → after with reason. Rules: chosen tasks +2; perfect SOP with decoy removed: Tech +1; SOP finished on time: Business +1; any meter not touched this round: -1. Clamp 0-10. If any meter is 2 or below, show a warning: reaching 0 = glitch (reboot next round with a penalty); glitch twice = stuck. Show "Level 2: Sprint 1, Prioritize under pressure" as LOCKED.

## System Admin view
Dashboard with game code, player list (name, meters, anomalies), buttons: Start, Next phase, Pause/extend timer. A script panel per phase, e.g. Phase 0: "Do NOT mention a simulation. If anyone asks about the capital L, say: 'Please report any issues to IT.'" Phase 5: "Read the report in a flat system voice. Ask: 'Did anyone else notice anything strange?'"

## Style
Light and dark mode. Cool off-white background, white panels, deep teal accent (#1d5c6b). Magenta (#c4166f) and cyan (#0a8fa6) only for glitch/system elements. Fonts: Bricolage Grotesque (headings), Hanken Grotesk (body), JetBrains Mono (system text, labels). Must work on phones.

## Test first
Before building more levels, test that 16-24 players can join one game and that phase changes push to every device in real time.
