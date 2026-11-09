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

The .html copies are snapshots from Nov 8, 2026. Open a file in a browser to run it.

## Rules and build prompts (Base44)
- `Base44 Prompt 1 - Characters`: 3 hidden types (Cooperative, Independent, Contrarian), 5 attributes (Focus, Initiative, Collaboration, Composure, Grit), character creation.
- `Base44 Prompt 2 - Economy`: round costs, backup pool, gifts, status flags, glitch and reboot.
- `Base44 Prompt 3 - Rules and Round Flow`: round steps, sabotage, accusations, win conditions (71% typical graduation).
- Run them in order 1 → 2 → 3.

## Round map
| Round | Name | Attribute | Cost |
|---|---|---|---|
| 1 | Boot Up | Initiative | 2 |
| 2 | Sprint 1 | Focus | 3 |
| 3 | The Mirror | Composure | 3 |
| 4 | Geek Week | Focus | 4 |
| 5 | Sprint 2 | Collaboration | 4 |
| 6 | Sprint 3 | Grit | 6 |
| 7 | Graduation | none | 0 |

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
