Before any task, read CLAUDE.md and docs/level2-progress.md. CLAUDE.md is the source of truth.
For Level 3 work, also read docs/level3-progress.md and docs/level3-report.md.

## Terminal (Windows PowerShell 5.1)
- This terminal is Windows PowerShell 5.1. It does not support && between commands.
- Run commands one at a time. Example: run npm run build, then npm test, then npm run test:screens as three separate commands.
- If you must chain, use: npm run build; if ($LASTEXITCODE -eq 0) { npm test }
- rg (ripgrep) is not installed. Use Select-String for text searches.
- git grep and findstr return exit code 1 when nothing matches. That means "not found," not an error.
