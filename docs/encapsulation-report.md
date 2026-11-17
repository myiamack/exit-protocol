# Encapsulation Report

Read-only audit of `rules/`, `game.js`, `pixel-art.js`, `world-map.js`, `pages/vote-test.js`, and `Tests/` at commit `6be32c6`.

---

## 1. Setters on `Player` and its parts

`Hearts` has no setters. `Player` delegates its getters/setters to `Attributes`, `PlayerStatus`, `Wallet`, and `PathTracker`.

| Setter | Where defined | Callers | Risk |
|---|---|---|---|
| `Player.attrs` -> `Attributes.attrs` | `rules/Player.js:85`, `rules/Attributes.js:41` | `Tests/check_gifts.js:23`, `Tests/check_steps.js:162`, `Tests/check_steps.js:729` | **High** — replaces `#attrs` from outside with no validation or bounds check. |
| `Player.glitches` -> `PlayerStatus.glitches` | `rules/Player.js:97`, `rules/PlayerStatus.js:18` | `Tests/check_gifts.js:138`, `Tests/check_steps.js:281,329,333,336,338,402,479,488,935,936,1115` | **Medium** — lets external code set glitch count directly, bypassing `addGlitch()` and `lockIn()`. |
| `Player.idle` -> `PlayerStatus.idle` | `rules/Player.js:99`, `rules/PlayerStatus.js:20` | `rules/Game.js:187`, `rules/Attendance.js:34`, `Tests/check_steps.js:480,488,568,573,993,995,1011,1012,1014,1036,1049,1055,1089,1100,1114` | **Low** — `PlayerStatus` coerces to boolean (`!!v`), and `Game`/`Attendance` own the idle lifecycle. |
| `Player.attendancePending` -> `PlayerStatus.attendancePending` | `rules/Player.js:101`, `rules/PlayerStatus.js:22` | `rules/Player.js:202`, `rules/Game.js:212`, `rules/Gift.js:67`, `Tests/check_steps.js:568,575` | **Medium** — allows skipping `Game.attendanceMiss()` and `Gift.accept()` state transitions. |
| `Player.earned` -> `Wallet.earned` | `rules/Player.js:213`, `rules/Wallet.js:20` | `rules/Game.js:270`, `rules/Economy.js:33,94`, `rules/bots.js:140`, `pages/vote-test.js:39`, `Tests/check_balance.js:42`, `Tests/check_cheese.js:82` | **Medium** — multiple callers clamp/write `p.earned` directly instead of calling a `Wallet` method. |
| `Player.draft` -> `Wallet.draft` | `rules/Player.js:215`, `rules/Wallet.js:22` | No external callers (mutations edit keys on the returned object). | **Low** — unused setter, though removing it would prevent full replacement. |
| `Player.placedThisRound` -> `Wallet.placedThisRound` | `rules/Player.js:217`, `rules/Wallet.placedThisRound` (`rules/Wallet.js:24`) | No external callers. | **Low** — unused setter; only `Wallet` updates `#placedThisRound`. |
| `Player.pathProgress` -> `PathTracker.pathProgress` | `rules/Player.js:233`, `rules/PathTracker.js:15` | No external callers. | **Low** — unused setter; `creditPath()` is used everywhere. |
| `Player.pathDone` -> `PathTracker.pathDone` | `rules/Player.js:235`, `rules/PathTracker.js:17` | `Tests/check_steps.js:936,1089` | **Low** — only used by tests to force a completed second path. |
| `Player.locked` -> `PathTracker.locked` | `rules/Player.js:237`, `rules/PathTracker.js:19` | No external callers. | **Medium** — if called, could overwrite a locked ending after `Game.results()`. |

---

## 2. Direct writes to another class's data

### Writing to `Player` fields
- `rules/Team.js:12` (`p.teamId = this.id`): **Low** — `Team.add()` keeps `teamId` in sync with `Team.members`.
- `rules/Attendance.js:39-40, 44-46, 70, 75, 80-81, 83` (`p.attendancePaused`, `p.attendancePopupAt`, `p.attendanceResumeAt`, `p.attendanceMissAt`, `p.attendanceMissesThisRound`): **Low** — `Attendance` is the dedicated owner of attendance timestamps on `Player`.
- `rules/Sabotage.js:30, 33` (`actor.sabotagesThisRound += 1`, `target.wasSabotagedThisRound = true`): **Medium** — `Sabotage` mutates `Player` round flags directly instead of calling a `Player` method.
- `rules/Accusation.js:24, 27` (`accuser.accusedThisRound = true`, `accuser.correctAccusation = true`): **Medium** — `Accusation` mutates `Player` round flags directly instead of calling a `Player` method.
- `rules/Economy.js:54-55` (`p.draft[k] = ...; delete p.draft[k]`): **Medium** — `Economy` mutates `Wallet.#draft` in place through the getter instead of a `Wallet` method.
- `Tests/check_steps.js:488, 575, 936, 1036` (`p.attrs[k] = ...`): **High** — mutates `Attributes.#attrs` directly, bypassing caps and validation (tests only).

### Writing to `Round` fields
- `rules/Game.js:266, 291, 536, 600` (`this.round.trial`, `this.round.quietHearts`, `this.round.gritBonus`, `this.round.done`): **Low** — `Game` owns round lifecycle and host-only log fields on `Round`.
- `rules/Trial.js:41` (`round.completed.add("runTrial")`): **Medium** — `Trial.runTrial` mutates `Round.completed` directly instead of `Game.once()`.
- `rules/Trial.js:156, 164, 169` (`round.sopBoards[team.id]`, `round.sopResults`): **Low** — `SopTrial` owns SOP board and result storage on `Round`.
- `rules/Economy.js:37` (`round.earnings = ...`): **Low** — `Economy` owns the earnings summary stored on `Round`.
- `rules/Sabotage.js:35`, `rules/Accusation.js:35`, `rules/Gift.js:48, 61-70, 78-79` (`round.sabotages`, `round.accusations`, `round.gifts`): **Low** — `Round` delegates these actions to `Sabotage`, `Accusation`, and `Gift`.

### Writing to `Team` fields
- `rules/Trial.js:30-31` (`r.team.won = i < w`, `r.team.trialWins += 1`): **Medium** — `Trial.run` mutates `Team.won` and `Team.trialWins` directly instead of a `Team` method.
- `rules/Vote.js:76` (`t.won = i < winners`): **Medium** — `Vote.tally` mutates `Team.won` directly, duplicating `Trial.run` ownership.

### Writing to `Trial` / `Vote` fields
- `rules/Trial.js:100, 103-105, 108, 113` (`t.scores`, `t.prompt`, `t.writing`, `t.submissions`, `v.ballots`, `t.ranking`): **Low** — internal `Trial.fromJSON` deserialization.

---

## 3. Getters that expose mutable internal objects

- `Player.attrs` (`rules/Player.js:84`) / `Attributes.attrs` (`rules/Attributes.js:40`): returns `this.#attrs` directly without copying. **High** — any caller can mutate attribute numbers in place (`player.attrs.focus = 99`), bypassing `Attributes` bounds and glitch checks.
- `Player.draft` (`rules/Player.js:214`) / `Wallet.draft` (`rules/Wallet.js:21`): returns `this.#draft` directly without copying. **Medium** — `Economy.draftPoint()` relies on this to mutate `#draft`, and screen code could also alter it without validation.
- `Game.timer` (`rules/Game.js:112`): returns `this._timer.current` (`{ name, key, deadline }`) directly without copying. **Medium** — external code could mutate `game.timer.deadline` and corrupt step timers.

(Safe getters: `Attendance.DEFAULTS` returns `{ ...DEFAULTS }`, `PathTracker.locked` returns a frozen object, and `Game.board()` returns fresh plain objects.)

---

## 4. Globals exposed when `game.js` lost its IIFE wrapper

Removing the outer `(function(){ ... })();` from `game.js` and loading `pixel-art.js`, `world-map.js`, and `game.js` as plain scripts placed their top-level bindings in the global scope:

- **`game.js` globals**:
  - Mutable state & engine refs: `S`, `G`, `ME`, `MYTEAM`, `NAMES`, `elevTimers`, `sopDownAt`, `cols`, `rainOn`, `FS`, `lastT`, `sized`, `BOARD`, `ATT`
  - Constants, views & helpers: `WORDS`, `cv`, `cx`, `A`, `AN`, `TYPE_TEXT`, `TYPES`, `ROUNDS`, `TEAM`, `OTHERS`, `SOP`, `DECOY`, `CLUES`, `STEPS`, `FAC`, `MEMOS`, `BANNER`, `V`, `ADMIN_LINES`, `ROLE_BRIEF`, `GIFT_RULE`, `curRed`, `curGl`, `$`, `$$`, `esc`, `render`, `go`, `bind`, `chrome`, `newSession`, `signOut`, `startLevel`, `R`, `T`, etc.
  - **Risk: Medium** — any script or console can overwrite `G`, `ME`, `S`, `V`, or short-named globals (`S`, `G`, `R`, `T`, `A`, `$`, `$$`), and future scripts risk name collisions.

- **`pixel-art.js` globals**:
  - `E`, `st`, `SKIN`, `HAIRC`, `CLOTH`, `BOTC`, `BODY`, `HAIR`, `TOP`, `BOT`, `HAT`, `EXTRA`, `GW`, `GH`, `OY`, `TOOLS`, `WTABS`, `DIALOGS`, `DPOS` (mutable array), `IC`, and functions `shade`, `sprite`, `pix`, `avatarSVG`, `screenhead`, `meeple`, `holoTeacher`, `dialogsHTML`, `tabIcon`.
  - **Risk: Low** — mostly read-only art data and pure SVG builders, though short names `E` and `st` could collide with other scripts.

- **`world-map.js` globals**:
  - `W` (mutable loop/input state), `GHOSTS`, `GSPOTS`, `ROOMS`, `SPOTS`, `WW`, `WH`, `PR`, `ELEV`, `HALL`, `SIDE`, `WROOMS`, `LOCKS`, `RNAME`, `BLOCKS`, `PRESETS_ROOK`, `MMLAB`, `ROOK`, `TAP_MS`, and functions `furniture`, `officeMap`, `teamMarkers`, `inPoly`, `inRect`, `walkable`, `blocked`, `canStand`, `roomAt`, `P`, `wFurniture`, `doorSVG`, `worldSVG`, `mmFit`, `minimapSVG`, `mmapInner`, `toggleMinimap`, `worldHTML`, `roomPanel`, `rookPanel`, `ghostPanel`, `stopWorld`, `fitWorld`, `initWorld`, `useAction`, `doUse`, `ghostHop`.
  - **Risk: Low** — map geometry/UI functions and a single `W` state object, though short names `W` and `P` could collide with future scripts.
