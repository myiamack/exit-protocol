# Exit_ProtocoL

A digital board game about the full i.c.stars Cycle 60 journey: Boot Up → Sprint 1 → The Mirror → Geek Week → Sprint 2 → Sprint 3 → Graduation.

Players are Pixel Interns who wake up on Floor 60 of an office simulation. Each player picks a secret work style (Cooperative, Independent or Contrarian). Then they get through seven reviews, send points to teammates, catch saboteurs, and try to graduate before they glitch. Players who don't make it get "contract renewed."

## Play it
- **Online:** turn on GitHub Pages for this repo (see below), then open the Pages link.
- **On your computer:** download the repo and double-click `index.html` (Chrome or Edge). You need internet for the fonts.
- **Demo sign-in:** any `@icstars.org` email, join code `CYCLE60`.

This prototype is single-player with sample teammates. It covers sign-in, menu, wardrobe, work style, the elevator arrival, the walkable Floor 60, Level 1, Level 2 (Split Brief), and Level 3 (The Mirror: Presentation Day). Real multiplayer (16–24 players plus a host) is planned later using the Base44 backend service.

## Level 2: Split Brief
- **What it is:** Level 2 (*Sprint 1: Back-Plan the Demo*, tests Collaboration, cost 3) deals 5 private brief cards round-robin to each team's active players, with per-game shuffled task letters (`A`–`D`) and card order. Teammates share up to 3 named notes per player (80 characters max), pick and order 2 of 4 backlog tasks on a shared board, and face a *Ghosted Teammate* twist card at 90 seconds before Lock In or the 180-second timer ends. Teams score 0–5 against the post-twist key (plus light Collaboration influence), ties break to earliest Lock In after the twist then random, and Stats Update leads to the *Sprint 1 Complete* screen.
- **How to reach it in the browser:** Open `index.html`, sign in with any `@icstars.org` email and join code `CYCLE60`, create your character, play through Level 1 (Boot Up) and its Stats Update, and click **Continue** to enter Level 2.
- **Test commands:** `npm run build` (rebuild `rules/rules.bundle.js`), `npm test` (run all 19 baseline checks), and `npm run test:screens` (run jsdom screen tests including Level 2 and Sprint 1 Complete).

## Level 3: The Mirror (Presentation Day)
- **What it is:** Level 3 (*The Mirror: Presentation Day*, tests Focus, cost 3; designed by Hannah Ziegler) starts with a 30-second lobby where each active teammate connects with a signal-grab tile (bots connect in 3 to 15 seconds; anyone left out when doors close fails the team with score 0). Active players split by seeded RNG into Setup Crew (half rounded up, max 3) and Dance Crew (the rest), followed by a 1-second Crew Reveal and a 75-second showtime where Audience Attention drains from 100%. Setup Crew runs 5 steps in order (cables, sound check, mic check, grab the deck, rapid-fire Q&A) and clicks Wrap up; Dance Crew plays an arrow rhythm lane to add an averaged boost (cap 45). Teams score 0 to 7 from final attention (`Math.round(attention / 100 * 7)` plus light Focus influence), ties break to higher exact attention then random, and Stats Update leads to the *Presentation Day Complete* screen.
- **How to reach it in the browser:** Finish Level 2 and click **Start Level 3** on *Sprint 1 Complete*, or press `Ctrl+Shift+3` using the prototype dev jump.
- **Dev jump (`Ctrl+Shift+1` to `7`):** Enabled in the prototype behind the `DEV_JUMP` flag in `game.js` (backed by `Game.jumpToLevel` in `rules/Game.js` and `Bots.hooks.onFastForward` in `rules/bots.js`). Jumping forward fast-forwards rounds to that level's Briefing; jumping to the current or an earlier level starts a fresh game and fast-forwards. It stays behind `DEV_JUMP`: flag off in the real game, on in a test copy.
- **Files added for Level 3:**
  - Rules: `rules/mirrorData.js`, `rules/MirrorParts.js` (`MirrorLobby`, `SetupCrew`, `DanceCrew`, coordinated by `MirrorTrial` in `rules/Trial.js`).
  - Screens: `mirror-view.js`, `mirror-dance-view.js`.
  - Tests: `Tests/check_mirror_data.js`, `Tests/check_mirror_lobby.js`, `Tests/check_mirror_setup.js`, `Tests/check_mirror_dance.js`, `Tests/check_mirror_score.js`, `Tests/check_mirror_timing.js`, `Tests/check_mirror_bots.js` (plus matching `Tests/baseline/check_mirror_*.txt` files and Level 3 runs in `Tests/check_screens.js`).
  - Docs: `docs/level3-progress.md`, `docs/level3-report.md`.

## What's here
| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `game.js`, `pixel-art.js`, `world-map.js` | The playable prototype (split into pixel art, Floor 60 map, and game/screen flow) |
| `board.js`, `attendance-view.js`, `fullscreen-view.js`, `splitbrief-view.js`, `mirror-view.js`, `mirror-dance-view.js`, `judged-view.js` | Shared screen components and trial views used by `index.html` and `pages/vote-test.html` |
| `rules/` | OOAD rule classes (ES modules, no screen code) and `rules/rules.bundle.js` for the browser |
| `tools/` | `build-rules.js` (builds `rules/rules.bundle.js`) and `baseline.js` (runs/checks test baselines) |
| `Tests/` | Automated rule, balance, cheese, save/load, and screen checks |
| `pages/character-system.html` | Pixel Intern builder, instructors, tools, cursor, holograms and ghosts |
| `pages/character-concepts.html` | The six original character directions |
| `pages/vote-test.html`, `pages/vote-test.js` | Test page for Levels 5–6 submissions and voting |
| `docs/Game_Index.md` | One-page overview: rounds, design decisions, open items |
| `docs/class-diagram.md` | Mermaid class diagrams for the `rules/` classes |
| `docs/design/` | Build notes, Floor 60 room checklist, trial question bank |
| `docs/research/` | Cycle 60 timeline research, cohort journey interview plan |
| `docs/ben-coppage/` | Ben Coppage's first brainstorm for the game |

## Running tests
First install dev dependencies once (`npm install`, needed for `jsdom` in the screen test). On Windows PowerShell 5.1, run commands one at a time (do not use `&&`).
- `npm run build`: rebuild `rules/rules.bundle.js` after editing any file in `rules/`.
- `npm test`: run all 19 baseline checks (`tools/baseline.js check`; currently 19/19 passing across rule, team, balance, cheese, bundle, save/load, Split Brief, and Mirror suites).
- `npm run baseline`: save a new fixed-seed baseline snapshot.
- `npm run test:screens`: run `Tests/check_screens.js` in jsdom (currently 154 passed across Runs 1 to 12, covering Levels 1 to 3, Presentation Day Complete, mid-trial save/reload, dev jump, Floor 60 map/UI, and `pages/vote-test.html`).

## Turn on GitHub Pages
Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save. The game will be live at `https://<username>.github.io/exit-protocol/`.

## Credits
- **Myia Mack:** game concept, UI, art direction, the Pixel Intern character system, instructors, Floor 60, and the playable prototype.
- **Ben Coppage:** game rules, points economy and balance testing. That includes the Character Proposal (Nov 4), the Economy Fix Proposal (Nov 4) and the Rules and Testing doc (Nov 5), which tuned the game to about 71% graduation. He also came up with the original title, *Performance_Review: Exit_ProtocoL*, and wrote the first brainstorm (`docs/ben-coppage/`).
- **Hannah Ziegler:** Level 3 (*The Mirror: Presentation Day*) design and original prototype, rebuilt into the OOAD rules and screen structure.
- **The Cycle 60 board game team:** design reviews and playtesting.
- All art is original. The story is inspired by *Death Parade* and *Severance*, but nothing is copied from them.

## Contributing
Collaborators: make a branch for your change and open a pull request into `main`.
