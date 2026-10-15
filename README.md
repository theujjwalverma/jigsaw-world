# Jigsaw World

🎮 **Play Online**: [https://theujjwalverma.github.io/jigsaw-world/](https://theujjwalverma.github.io/jigsaw-world/)

Now powered by **Convex DB** for real-time multiplayer leaderboard sync across any PC, phone, or tablet!
You can also run it offline by opening **index.html** directly. No build step or local server required.

## Play

1. Demo room code: **234234**.
2. Search **Ujjwal Verma** (or another bundled name), select the player, then Join game.
3. Tap a piece then a board cell, or drag it onto the board. Select a placed piece to move it. Dropping onto an occupied cell returns the displaced piece to the playground.
4. Fill the board correctly and Submit round. Wrong arrangements must be fixed before submission. Expired rounds are automatically submitted as incomplete.
5. The round leaderboard includes every registered name; missing results display `—`. Continue immediately, wait for the configured leaderboard countdown, or choose Next player to stop the countdown.
6. After all rounds, select Final standings. Rankings are provisional while other players have not submitted. Players can take turns on this device.

Timers start after the puzzle image loads, use absolute deadlines and continue across refresh, navigation, backgrounding and closing the page. An expired saved session is submitted on reopening its game. Moves, placements and randomized tray order resume automatically. Submitted rounds cannot be replayed without resetting that room's results.

## Admin

- Create six-digit rooms. Each room gets independent players, configuration, sessions and results.
- Edit title, roster, 1–10 rounds, grid sizes (2×2 through 8×8), round images, round timers and leaderboard duration, then **Save settings**. Click **Select image** to open the thumbnail gallery; choosing a picture updates the round preview. Escape, the close button or clicking the backdrop dismisses the gallery without changing the image.
- Between-round duration `0` means manual Next round.
- Player roster and puzzle configuration lock after play starts. Download a backup and reset room results before changing those fields. Title and leaderboard duration remain editable.
- The gallery includes bundled pictures and pictures already configured in the room. To distribute additional pictures, put them inside **assets/rounds/** and register them in **js/data.js**; the browser cannot enumerate a local folder without permission. Images are center-cropped to square. Missing images show an error rather than starting a new timer. The included scene/portrait SVG artwork is local and original; the existing app had no bundled round photographs or avatar image set.
- Names must be unique per room (case-insensitive); existing matching names keep their IDs. New names get unique IDs and a bundled portrait.
- Admin is a local editor, not authenticated access. Use a single active tab for play; multiple tabs can overwrite each other's latest changes.

## Storage: important distinction

Initial defaults are hardcoded in **js/data.js** and the 49-player portrait registry **js/avatars.js** as classic scripts. They mirror **data/admin.json** and **data/players.json** (player IDs are generated from names in the registry), but **the runtime does not fetch the JSON files**. This avoids browser restrictions on `file://` JSON loading. To change defaults for distribution, update the scripts and reference JSONs together. Existing rooms keep their roster, player IDs, results and settings; portrait mappings refresh automatically by name. New rooms use the 49-player default roster. Unrecognized names or failed portrait loads use the bundled mint SVG fallback.

Live state is a JSON string under localStorage key **jigsaw-offline-v1**:

```text
rooms[roomCode].players
rooms[roomCode].rounds
rooms[roomCode].results[playerId][roundNumber]
rooms[roomCode].sessions[playerId][roundNumber]
```

Each submitted result stores moves, elapsed milliseconds, completion, correct pieces, timeout status and submission date. Leaderboards calculate ranks and points dynamically from results; pending players have no fabricated score. Ranking follows the original app: completed first, fewer moves, faster time; 50 points for first place, decreasing to a minimum of 1. Final order uses accumulated points, then moves and time.

**The bundled results.json is a reference, not a writable database.** Browser autosave never silently rewrites files in this folder. Download results JSON exports the current room, raw results, in-progress sessions, configuration, roster and derived leaderboards. Export is an optional backup/report; no import step is required for normal use and no restore/import UI is included.

Use the same browser/profile and keep this folder at the same path. Storage behavior for local files is browser-dependent. Moving the folder, switching browsers, private browsing or clearing browser data can make progress unavailable. Storage errors show a persistent warning and the in-memory game remains usable; download a backup before closing. Room codes do **not** synchronize devices, and there is no server-side anti-cheat or authoritative shared clock.

## Files

```text
offline/
  index.html / studio.html / admin.html
  css/styles.css
  js/data.js / core.js / app.js
  assets/rounds/round-1.svg ... round-5.svg
  assets/avatars/*.svg
  data/admin.json / players.json / results.json
  tests/core.test.cjs
```

Run the dependency-free rule tests from the repository root with `node --test offline/tests/core.test.cjs`.