# Exit_ProtocoL

A digital board game about the full i.c.stars Cycle 60 journey: Boot Up → Sprint 1 → The Mirror → Geek Week → Sprint 2 → Sprint 3 → Graduation.

Players are Pixel Interns who wake up on Floor 60 of an office simulation. Each player picks a secret work style (Cooperative, Independent or Contrarian). Then they get through seven reviews, send points to teammates, catch saboteurs, and try to graduate before they glitch. Players who don't make it get "contract renewed."

## Play it
- **Online:** turn on GitHub Pages for this repo (see below), then open the Pages link.
- **On your computer:** download the repo and double-click `index.html` (Chrome or Edge). You need internet for the fonts.
- **Demo sign-in:** any `@icstars.org` email, join code `CYCLE60`.

This prototype is single-player with sample teammates. It covers sign-in, menu, wardrobe, work style, the elevator arrival, the walkable Floor 60 and Level 1. Real multiplayer (16–24 players plus a host) is what the Base44 prompts in `docs/base44-prompts/` build.

## What's here
| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `game.js` | The playable prototype |
| `pages/character-system.html` | Pixel Intern builder, instructors, tools, cursor, holograms and ghosts |
| `pages/character-concepts.html` | The six original character directions |
| `docs/Game_Index.md` | One-page overview: rounds, design decisions, open items |
| `docs/base44-prompts/` | Build prompts: 0 (start/login/avatar), 1 Characters, 2 Economy, 3 Rules & Round Flow |
| `docs/design/` | Build notes, Floor 60 room checklist, trial question bank |
| `docs/research/` | Cycle 60 timeline research, cohort journey interview plan |
| `docs/ben-coppage/` | Ben Coppage's first brainstorm for the game |

## Turn on GitHub Pages
Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save. The game will be live at `https://<username>.github.io/exit-protocol/`.

## Credits
- **Myia Mack:** game concept, UI, art direction, the Pixel Intern character system, instructors, Floor 60, and the playable prototype.
- **Ben Coppage:** game rules, points economy and balance testing. That includes the Character Proposal (Nov 4), the Economy Fix Proposal (Nov 4) and the Rules and Testing doc (Nov 5), which tuned the game to about 71% graduation. Base44 Prompts 1–3 are built from his work. He also came up with the original title, *Performance_Review: Exit_ProtocoL*, and wrote the first brainstorm (`docs/ben-coppage/`).
- **The Cycle 60 board game team:** design reviews and playtesting.
- All art is original. The story is inspired by *Death Parade* and *Severance*, but nothing is copied from them.

## Contributing
Collaborators: make a branch for your change and open a pull request into `main`.
