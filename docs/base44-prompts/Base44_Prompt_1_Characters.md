BASE44 PROMPT 1 OF 3: CHARACTERS

Rules credit: Ben Coppage.

Source: Character Proposal (Ben Coppage, Nov 4), with numbers updated to the Nov 5 Rules and Testing doc.

Build order: run this prompt first. Then Prompt 2 (Economy), then Prompt 3 (Rules and Round Flow).

How to use: copy everything below the line and paste it into Base44 as one prompt.

--------------------------------------------------

Build the foundation for a multiplayer web game called "Performance_Review: Exit_ProtocoL". Keep the capital L at the end of the title exactly as written. It is on purpose.

GAME SETUP

- 16 to 24 players, each on their own device. A human host (the System Administrator) creates the game and shares a join code. The host is not a player.
- Players join with a display name and the join code. No login needed.
- Players are placed in teams of 4. The host can move players between teams.

DATA TO STORE

- Game: join code, status (lobby, in progress, finished), current round (1 to 7).
- Team: name, game, list of players (max 4).
- Player: display name, game, team, character type (hidden), five attribute values, backup pool, status, glitch count.
- Character type: name, two bonus attributes, one penalty attribute.

THE FIVE ATTRIBUTES

Focus, Initiative, Collaboration, Composure, Grit.

CHARACTER TYPES (hidden from other players)

- Cooperative: bonus Collaboration and Composure. Penalty Initiative.
- Independent: bonus Focus and Grit. Penalty Collaboration.
- Contrarian: bonus Initiative and Grit. Penalty Composure.

CHARACTER CREATION SCREEN

1. Player picks a type.
2. Every attribute starts at 1 (5 free points).
3. Player spends 15 more points across the five attributes using plus and minus buttons.
4. The app adds +2 to each of the type's two bonus attributes.
5. Max per attribute is 10, including the bonus. The penalty attribute max is 7.
6. Starting total must equal 24. Disable the Confirm button until all 15 points are spent and no max is broken.
7. Backup pool starts at 3.

Show a live counter of points left and the current value of each attribute.

PRIVACY RULES

- A player sees their own numbers and type.
- Other players see only each player's name, team, and a status flag. Never numbers. Never type.
- The host sees everything.

SCREENS IN THIS PROMPT

- Start screen: Host a game or Join a game.
- Lobby: player list grouped by team. Host has a Start button.
- Character creation (above).
- Player dashboard: my five attributes, my backup pool, my status, my team, and every other player's name and status flag.
- Host dashboard: all players with full numbers and types.

Do not build rounds, trials, gifts, sabotage, or scoring yet. Those come in later prompts.
