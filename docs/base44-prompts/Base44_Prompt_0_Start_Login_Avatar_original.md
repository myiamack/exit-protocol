# Base44 Prompt 0: Start, Login, Wardrobe, Arrival
Game: Exit_ProtocoL · updated Nov 8, 2026 (replaces the earlier version)
Run BEFORE Prompt 1 (Characters). Replaces Prompt 1's "No login needed."
Visual reference: Exit_ProtocoL Game Prototype (claude.ai link in exit_protocol/README.md)

--------------------------------------------------

Build the start of a multiplayer web game called "Exit_ProtocoL". Keep the capital L at the end exactly as written. It is a deliberate clue. Never correct it.

STYLE ANCHOR
- Player characters are 16-bit retro pixel-art sprites: a 16 x 27 pixel grid scaled up with crisp, square pixels (CSS image-rendering: pixelated or SVG shape-rendering: crispEdges), a 1-pixel dark outline (#0b0e13) around the whole sprite, flat colors with at most one darker shade per color.
- UI is a cartoon game client: dark slate panels (#2a3140) with thick 4px near-black outlines (#0b0e13), rounded corners, striped menu buttons, condensed uppercase headings (Barlow Condensed), body text in Barlow, system text in Share Tech Mono / VT323, logo and numbers in Pixelify Sans.
- Palette: crimson red #e0394d, royal blue #3a74ff, sky #a8d8ff, gold #f2b84b, green #4fe08a for success, pink #ff4fa3 only for glitch effects. Background #141922.

EXPLICIT BANS
- NOT 3D, NOT vinyl-toy, NOT soft gradients or blur on characters, no anti-aliased pixel edges.
- NOT teal, mint or purple as theme colors.
- Do not copy any existing game's characters, logos or UI (no Among Us crewmates).
- No real names or photos of cohort members anywhere.

SCREEN 1: SIGN IN
- Full-screen "code rain": tech words (JavaScript, Python, HTML, CSS, React, SQL, Git, API, JSON, Agile, Sprint, Debug, Deploy, console.log, Base44...) falling letter by letter in blue with occasional red letters.
- Logo "EXIT_" in red over "PROTOCOL" in blue (Pixelify Sans, dark outline). The final L flickers; tapping it logs anomaly "L" (kind ERROR).
- Boot log: "loading employee_profile ... ok", "assigning cohort CYCLE_60 ... ok", "checking exit_conditions ... NOT FOUND" (red).
- ID-card login panel with a red header strip "EMPLOYEE ACCESS · i.c.stars only", fields for i.c.stars email and join code (Share Tech Mono inputs), red "CLOCK IN" button, barcode stripe.
- Only emails ending in @icstars.org may enter. Otherwise: "This game is for the i.c.stars community only." Wrong code: "That join code doesn't match an open game. Check with your host."

SCREEN 2: MAIN MENU
- Left panel: logo, big striped buttons PLAY (red), HOW TO PLAY (sky), WARDROBE (sky); small buttons OFFICE MAP, MEMOS, MY BADGE, SETTINGS (disabled).
- Right "screen" panel shows the selected view. Office Map shows the floor plan with every room as "?" until visited.
- Red glitch cursor on sign-in, menu and wardrobe ONLY: a red arrow cursor that flashes a pink/cyan split for 0.2s on every click, then returns to red. Gameplay screens use the normal cursor.

HOW TO PLAY: INSTRUCTORS
Four dialog boxes (portrait + pixel-font speech + Next button + progress dots):
- SYS-ADMIN 01 (monitor-head figure, blue): explains glitches. On its last line the portrait glitches (shake + pink/cyan split) and the text corrupts.
- SYS-ADMIN 02 (monitor-head, red): explains the Contrarian and sabotage.
- TEAM LEAD MEEP (green board-game meeple): explains the Cooperative.
- PROJECTION_IND (cyan wireframe hologram): explains the Independent.

SCREEN 3: WARDROBE (Pixel Intern builder)
Layout: tab bar with a small preview icon per tab (CHARACTER, HAIR, OUTFIT, ACCESSORIES, TOOL), option grid on the left, big sprite on a lit neutral stage on the right with the item name and "EQUIPPED".
- Character: Masculine (original broad-shoulder outline) or Feminine (narrower waist, hips, softer chin). Any option works on either.
- Skin tone: 10 swatches from light to deep.
- Hair: Short, Buzz, Curly, Afro, Puffs, Bob, Long, Ponytail, Bun, Braids, Head wrap, None. Hair color: 10.
- Outfit: Top (Tee, Blazer, Hoodie, Cardigan, Polo) + color; Bottoms (Pants, Skirt, Shorts) + color.
- Accessories: Hats (None, Cap, Beanie, Headphones, Bow, Crown, Hard hat); Extras (None, Glasses, Lashes, Earrings, Lanyard, Freckles); accessory color.
- Tool: Coffee Mug, Sticky Note, Stapler, Desk Plant, Rubber Duck, USB Backup as pixel icons with rarity and ability text. Show "Abilities are being playtested." No gameplay effect yet.

CONTRAST RULES (option cards)
- Every option is a card showing a 60px preview of THE PLAYER'S CURRENT AVATAR wearing that option.
- Unselected card: light background #dfe6ee, dark text #141922, 3px #0b0e13 outline. Hover: white background, lift 2px.
- Selected card: background #ffe08a, 4px gold #f2b84b ring, green check badge in the top-right corner.
- Color swatches: 38px squares, 3px dark outline plus a light 2px halo; selected = gold ring + scale 1.08 + check badge.
- All text meets WCAG AA contrast.

DISPLAY NAME RULES
2 to 16 characters, letters, numbers and single spaces only. Strip anything else as typed and show "Letters, numbers and spaces only. Special characters were removed." Unique within a game. Tip: "Use a character name, not your real one."

SCREEN 4: ARRIVAL (after work style is chosen in Prompt 1)
- First-person elevator: side walls in perspective, a floor counter climbing ▲01 to ▲60, then the doors slide open onto a dim office.
- ADMIN_0 (tall monitor-head host in a black suit, red tie) greets the player in a visual-novel dialog box:
  1. "Welcome to Floor 60. You don't remember the elevator ride. No one ever does."
  2. "You agreed to all of this. You signed. You just don't remember signing."
  3. "Out there, you are someone else. In here, you are an intern. The two of you will not meet."
  4. "This is a 14-week internship. Seven floors. Every floor ends in a review, and every review costs you something."
  5. "Pass all seven and the exit opens. Fail, and your contract is renewed. Indefinitely."
  6. "You'll see things on this floor that aren't on the org chart. Don't follow them. Listen to them."
  7. "Your work style has been assigned. Your orientation lead will brief you now."
- Then the instructor for the player's secret work style gives 4 lines and a dossier: strengths, weakness, gift cost, secret path, what to watch for.
- Spawn: the player's sprite materializes (cyan hologram to solid) with "SPAWNING [NAME] · FLOOR 60".

DATA
Player: email (host only), display_name, avatar {body, skin, hair, hair_color, top_style, top_color, bottom_style, bottom_color, hat, extra, accessory_color, tool}.
Others see avatar, name, team and status only.

After Arrival, players enter the walkable floor (Prompt 4, to be written once the studio layout is in).
