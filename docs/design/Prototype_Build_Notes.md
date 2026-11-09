# Prototype build notes (updated Nov 8, 2026)

Title in use: **Exit_ProtocoL** (shortened from Performance_Review: Exit_ProtocoL; "Nexus Workforce Systems" dropped).

## Links
- Playable prototype (start + Level 1): https://claude.ai/artifact/24Vef8qcmejfTufk1CCcD3
- Character concepts (6 directions): https://claude.ai/artifact/RzYThjbpPVeRSHqhfVXmsc
- Character system (Pixel Intern builder, instructors, tools, cursor, holograms + ghosts): https://claude.ai/artifact/KmNvHPM9t5TCwa4N3cqBNZ
- Repo copies: `index.html` + `styles.css` + `game.js` (playable game), `pages/` (character pages).
- Older Base44 prompts (docs/base44-prompts): Base44_Prompt_0_Start_Login_Avatar (avatar section outdated; see 0b MODERN), Base44_Level1_Prompt (older 4-meter version).

## Design direction (Myia) — DECIDED
- Keep as is: code-rain intro, red/blue EXIT_PROTOCOL logo, ID-badge login ("school + employee" feel).
- Menus/wardrobe inspired by Among Us, OFFICE setting. Original art only. Red + blue + gold; avoid purple/mint/teal portfolio palette.
- **Story/feel influences:** Death Parade (arrive via elevator, a host greets you, you don't remember how you got here) and Severance (long stark white hallways; people who agreed to something they don't remember; "in here you are an intern, out there someone else"). Inspired by, never copied.
- Back/Next on every screen; Intermission banner with timer.
- **Player character = Pixel Intern**: Masculine (original intern outline) or Feminine (defined waist/hips). High-contrast option tiles.
- **Instructors (How to Play):** SYS-ADMIN 01 (Screen-Head) = glitches; SYS-ADMIN 02 (Screen-Head) = Contrarian; TEAM LEAD MEEP (Meeple) = Cooperative; PROJECTION_IND (Hologram) = Independent. **ADMIN_0** = main host (Screen-Head in a black suit) who greets everyone on arrival.
- **Red glitch cursor = menus only.**
- **Holograms:** glitching/stuck players + three wandering ghosts (USER_???, ATTEMPT_01, NULL) that appear at random and whisper hints. Code names only (privacy).
- **Office objects = pixel tools** (one per player; abilities still being playtested).

## Gameplay structure (built Nov 8)
- After work style: **Arrival** = first-person elevator ride to Floor 60 → doors open → ADMIN_0 intro (5 lines) → role instructor briefing with a dossier (strengths, weakness, gift cost, secret path, watch for) → spawn (hologram → solid).
- **Walkable floor:** large office map (camera follows player), joystick circle bottom-right + arrow keys/WASD, minimap bottom-left with fog of war (rooms reveal when visited), USE button (Gift / Sabotage / Hint / Huddle / Listen to ghost; E key).
- **Levels = floors.** Rooms for later levels are visible but locked ("ACCESS · LVL 3" Client Suite, "LVL 4" Testing Lab) and unlock as levels progress. Plan: elevator ride between levels.
- Lobby (intermission 90s) and Open Floor both use the walkable floor.

## Waiting on
- Ben: blueprint/floor layout. Myia: interior photos of the i.c.stars studio. Then redraw Floor 60 to match and assign what happens in each room.

## Proposed tool abilities (not approved; need playtest vs 71% graduation target)
Coffee Mug (refill 1 heart, 1 use), Sticky Note (peek next trial attribute, 2), Stapler (protect one attribute from sabotage for a round, 1), Desk Plant (+10s team gift window, 2), Rubber Duck (next wrong accusation costs nothing, 1), USB Backup (first glitch keeps hearts, 1).

## Level 1 rules in prototype (follow Base44 Prompts 1–3)
Initiative cost 2; backup covers shortfall (bonus 1:1, other 2:1); gifts cost hearts by type; Contrarian sabotage −2 (−1 if Composure 6+); one team accusation; 30s gift window (20s demo); glitch + reboot; earn 4 win / 2 loss / 1 glitched (+1 correct accusation); place points; backup +1; status vs next cost.
