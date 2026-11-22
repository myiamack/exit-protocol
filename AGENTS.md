Before any task, read CLAUDE.md and docs/screen-state-plan.md. CLAUDE.md is the source of truth.
For Level 3 work, also read docs/level3-progress.md and docs/level3-report.md.

## Screen State Rule
- Screens display data and pass player actions to `Game`. Screens never change game state.
- Screen files: `game.js`, `world-map.js`, `pixel-art.js`, all view files, `pages/vote-test.js`.
- Rules own all game state, every deadline that changes game state (including Level 3 Q&A timeouts, deck reshuffles, mic flash hide, sound hold, and missed dance notes), and all outcome-affecting randomness (using seeded `Rng`).
- Allowed in screens: pure UI state (open panels, typed text before Submit, focus, scroll, animation drawn from rules data, sound playback, minimap toggle). Mark allowed cosmetic randomness with `// cosmetic-ok`.

## Terminal (Windows PowerShell 5.1)
- This terminal is Windows PowerShell 5.1. It does not support && between commands.
- Run commands one at a time. Example: run npm run build, then npm test, then npm run test:screens as three separate commands.
- If you must chain, use: npm run build; if ($LASTEXITCODE -eq 0) { npm test }
- rg (ripgrep) is not installed. Use Select-String for text searches.
- git grep and findstr return exit code 1 when nothing matches. That means "not found," not an error.
