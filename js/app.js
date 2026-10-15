(function () {
  "use strict";
  const C = window.OfflineCore;
  const defaults = window.OFFLINE_DEFAULTS;
  const KEY = "jigsaw-offline-v1";
  const app = document.getElementById("app");
  let state, storageOK = true, selected = null, selectedPlayer = null, viewingRound = 1;
  let activeTimer = null, boardWaitUntil = null, toastTimer, imageReady = false;
  let playContext = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const time = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const room = () => state.rooms[state.currentRoom];
  const player = () => room().players.find(p => p.id === state.playerId);
  function warn(message) {
    const el = document.getElementById("storage-warning");
    el.textContent = message; el.hidden = false;
  }
  function initialState() {
    return { schemaVersion: 1, currentRoom: defaults.roomCode, playerId: null, rooms: { [defaults.roomCode]: C.createRoom(defaults, defaults.roomCode) } };
  }
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : initialState();
    if (state.schemaVersion !== 1 || !state.rooms?.[state.currentRoom] || !Array.isArray(room().players) || !Array.isArray(room().rounds)) throw new Error("Invalid saved data");
  } catch (error) {
    storageOK = false; state = initialState();
    warn("Browser storage is unavailable or saved data is invalid. This session is temporary; existing saved data will not be overwritten. Download a JSON backup before closing.");
  }
  function save() {
    if (!storageOK) return false;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (error) {
      storageOK = false;
      warn("Autosave failed: browser storage is blocked or full. Keep this page open and download a JSON backup. Your latest changes are currently in memory only.");
      return false;
    }
  }
  // Refresh avatar mappings without changing existing player IDs or results.
  Object.values(state.rooms).forEach(savedRoom => {
    savedRoom.players.forEach(p => { p.avatar = window.offlineAvatarFor(p.name); });
  });
  document.addEventListener("error", event => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains("avatar") && !img.src.endsWith("/mint.svg")) {
      img.src = "assets/avatars/mint.svg";
    }
  }, true);
  save();
  function syncConvex() {
    if (window.ConvexSync && room()) {
      window.ConvexSync.syncRoom(room());
    }
  }
  window.onConvexResultsUpdated = function (roomCode, results) {
    const target = state.rooms[roomCode];
    if (!target) return;
    let changed = false;
    results.forEach(res => {
      target.results[res.playerId] ||= {};
      const existing = target.results[res.playerId][res.round];
      if (!existing || existing.moves !== res.moves || existing.timeMs !== res.timeMs || existing.completed !== res.completed) {
        target.results[res.playerId][res.round] = {
          moves: res.moves,
          timeMs: res.timeMs,
          completed: res.completed,
          correct: res.correct,
          total: res.total,
          timedOut: res.timedOut,
          submittedAt: res.submittedAt
        };
        changed = true;
      }
    });
    if (changed) {
      save();
      if (route() === "leaderboard" || route() === "join") {
        render();
      }
    }
  };
  function toast(message) {
    const el = document.getElementById("announcement");
    el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }
  function routeTo(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function route() { return location.hash.slice(1) || "join"; }
  function avatar(p) { return `<img class="avatar" src="${esc(p.avatar)}" alt="">`; }
  function roomStrip() {
    return `<form id="switch-room" class="room-strip"><label for="active-room">Room</label><select id="active-room" name="code">${Object.keys(state.rooms).map(code => `<option ${code === state.currentRoom ? "selected" : ""}>${esc(code)}</option>`).join("")}</select><button class="quiet">Open room</button><span class="badge badge-mint">${room().players.length} players</span></form>`;
  }
  function bindRoomSwitch() {
    document.getElementById("switch-room")?.addEventListener("submit", event => {
      event.preventDefault(); state.currentRoom = new FormData(event.currentTarget).get("code");
      state.playerId = null; selectedPlayer = null; viewingRound = 1; boardWaitUntil = null; save(); syncConvex(); render();
    });
  }
  function render() {
    syncConvex();
    clearInterval(activeTimer); activeTimer = null; selected = null; playContext = null;
    document.querySelectorAll("nav a").forEach(a => {
      if (a.hash === "#admin") a.hidden = route() !== "admin";
      if (a.hash === `#${route().split("/")[0]}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (route() === "admin") renderAdmin();
    else if (route() === "leaderboard") renderLeaderboard();
    else if (route().startsWith("play/")) renderGame(Number(route().split("/")[1]));
    else renderJoin();
  }
  function renderJoin() {
    const r = room();
    app.innerHTML = `<section class="page centered-card"><div class="illustration" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="eyebrow">YOUR NEXT LITTLE ADVENTURE</p><h1>Join Tournament</h1><p class="subtitle">Friendly competition.<br>A whole lot of satisfying little clicks.</p><div class="badges"><span class="badge badge-lavender">${r.rounds.length} rounds</span><span class="badge badge-mint">Your pace, your puzzle</span><span class="badge badge-peach">No internet needed</span></div><form id="join-form" class="join-form"><label for="room-code">Room code</label><input id="room-code" class="code" name="code" value="${esc(state.currentRoom)}" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" required><label for="player-search">Find your name</label><input id="player-search" type="search" placeholder="Search your name, e.g. Ujjwal" autocomplete="off"><div id="player-options" class="players-list" role="group" aria-label="Choose your player"></div><p id="selected-name" class="selection-note muted" aria-live="polite">Choose your name to continue.</p><button id="join-button" class="full mint" disabled>Join game →</button><p id="join-error" role="alert" class="error"></p></form><p class="hint">Demo room: <strong>234234</strong> · Add names and create rooms in Admin.<br>This is a shared-device edition, not an online multiplayer room.</p></section>`;
    const codeInput = document.getElementById("room-code");
    const search = document.getElementById("player-search");
    selectedPlayer = null;
    function options() {
      const target = state.rooms[codeInput.value];
      const matches = (target?.players || []).filter(p => p.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      if (!target?.players.some(p => p.id === selectedPlayer)) selectedPlayer = null;
      document.getElementById("player-options").innerHTML = matches.length ? matches.map(p => `<button type="button" class="player-option ${p.id === selectedPlayer ? "selected" : ""}" data-player="${esc(p.id)}" aria-pressed="${p.id === selectedPlayer}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join("") : `<p class="hint">${target ? "No matching names. Add players in Admin." : "Room not found. Create this room in Admin."}</p>`;
      const chosen = target?.players.find(p => p.id === selectedPlayer);
      const next = chosen ? C.nextRound(target, chosen.id) : null;
      document.getElementById("selected-name").textContent = chosen ? `${chosen.name} selected · ${next ? `Next: round ${next}` : "All rounds submitted"}` : "Choose your name to continue.";
      document.getElementById("join-button").disabled = !chosen;
      document.getElementById("join-button").textContent = chosen && !next ? "View final leaderboard →" : chosen && target.sessions[chosen.id]?.[next] ? "Resume game →" : "Join game →";
    }
    document.getElementById("player-options").addEventListener("click", event => {
      const button = event.target.closest("[data-player]"); if (!button) return;
      selectedPlayer = button.dataset.player; options();
    });
    codeInput.addEventListener("input", () => { selectedPlayer = null; options(); });
    search.addEventListener("input", options);
    document.getElementById("join-form").addEventListener("submit", event => {
      event.preventDefault();
      const target = state.rooms[codeInput.value];
      if (!target || !target.players.some(p => p.id === selectedPlayer)) return;
      state.currentRoom = codeInput.value; state.playerId = selectedPlayer; save();
      const next = C.nextRound(target, selectedPlayer);
      if (next) routeTo(`#play/${next}`);
      else { viewingRound = "final"; routeTo("#leaderboard"); }
    });
    options();
  }
  function piecePath(grid, id) {
    const row = Math.floor(id / grid), col = id % grid, even = (row + col) % 2 === 0;
    const edges = [row === 0 ? 0 : even ? -1 : 1, col === grid - 1 ? 0 : even ? 1 : -1, row === grid - 1 ? 0 : even ? -1 : 1, col === 0 ? 0 : even ? 1 : -1];
    const path = ["M 0 0"];
    [[0, 0, 1, 0], [100, 0, 0, 1], [100, 100, -1, 0], [0, 100, 0, -1]].forEach(([x, y, dx, dy], side) => {
      const point = (along, out) => `${x + dx * along + dy * out * edges[side]} ${y + dy * along - dx * out * edges[side]}`;
      if (edges[side]) path.push(`L ${point(35, 0)} C ${point(42, 0)} ${point(43, 0)} ${point(43, 3)} C ${point(43, 5)} ${point(36, 4)} ${point(36, 10)} C ${point(36, 16)} ${point(42, 18)} ${point(50, 18)} C ${point(58, 18)} ${point(64, 16)} ${point(64, 10)} C ${point(64, 4)} ${point(57, 5)} ${point(57, 3)} C ${point(57, 0)} ${point(58, 0)} ${point(65, 0)}`);
      path.push(`L ${point(100, 0)}`);
    });
    return `${path.join(" ")} Z`;
  }
  function pieceSVG(config, id, prefix) {
    const g = config.grid, clip = `${prefix}-${id}`;
    return `<svg class="piece-svg" viewBox="-18 -18 136 136" aria-hidden="true"><defs><clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${piecePath(g, id)}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="${esc(config.image)}" x="${-(id % g) * 100}" y="${-Math.floor(id / g) * 100}" width="${g * 100}" height="${g * 100}" preserveAspectRatio="xMidYMid slice"/></g><path d="${piecePath(g, id)}" fill="none" stroke="#38354e66" stroke-width=".7"/></svg>`;
  }
  function renderGame(round) {
    const r = room(), p = player();
    if (!p) { routeTo("#join"); return; }
    const next = C.nextRound(r, p.id);
    if (!next || round !== next) {
      if (next) { routeTo(`#play/${next}`); return; }
      viewingRound = "final"; routeTo("#leaderboard"); return;
    }
    const config = r.rounds[round - 1], size = config.grid ** 2;
    imageReady = false;
    app.innerHTML = `<section class="page game-page"><header class="page-heading"><div><p class="eyebrow">THE PUZZLE CHALLENGE · ROOM ${esc(r.code)}</p><h1>Round ${round} <span class="muted">/ ${r.rounds.length}</span></h1><p class="subtitle">${esc(config.name)} · Find your flow. Make the picture whole.</p></div><span class="badge badge-mint">${config.grid} × ${config.grid} puzzle</span></header><div class="hud"><div class="stat"><small>TIME LEFT</small><strong id="timer">${time(config.seconds * 1000)}</strong></div><div class="stat"><small>MOVES</small><strong id="moves">0</strong></div><div class="stat"><small>PLACED</small><strong id="placed">0 / ${size}</strong></div><div class="stat"><small>PLAYER</small><strong style="font-size:17px">${esc(p.name)}</strong></div></div><p id="image-status" class="hint" role="status">Loading your puzzle… Timer starts when the image is ready.</p><div class="game-layout"><section class="clay-panel"><div class="panel-heading"><h2>Your canvas</h2><span class="muted">Build the big picture</span></div><div id="board" class="board" style="grid-template-columns:repeat(${config.grid},minmax(0,1fr));grid-template-rows:repeat(${config.grid},minmax(0,1fr))"></div><p id="game-hint" class="hint" aria-live="polite">Select a piece, then a board cell—or drag and drop.</p><button id="submit-round" class="full mint" disabled>Submit round</button><details><summary class="hint">Peek at the picture</summary><img class="reference" src="${esc(config.image)}" alt="Complete reference for this round"></details></section><section class="clay-panel"><div class="panel-heading"><h2>Piece playground</h2><span id="pieces-left" class="badge badge-peach">${size} left</span></div><div id="tray" class="piece-tray" aria-label="Unplaced puzzle pieces"></div><button id="return-piece" class="full quiet" disabled>Return selected piece to playground</button><p class="hint">Arrange pieces anywhere. Dropping onto an occupied cell returns its old piece here. On touch screens, tap a piece then tap a cell.</p><p class="hint">The timer keeps running when you leave or close this page. Progress is saved after every move.</p><button id="leave-game" class="quiet">Save & leave</button><button data-export class="quiet">Download JSON backup</button></section></div></section>`;
    const context = { code: r.code, playerId: p.id, round, config, session: r.sessions[p.id]?.[round] || null };
    playContext = context;
    const valid = () => playContext === context && route() === `play/${round}` && room().code === context.code && state.playerId === context.playerId;
    function finish(timedOut) {
      if (!valid() || !context.session || r.results[p.id]?.[round]) return;
      const result = C.submit(r, p.id, round); save(); viewingRound = C.nextRound(r, p.id) ? round : "final";
      window.ConvexSync?.submitResult(r.code, p.id, round, result);
      boardWaitUntil = r.leaderboardSeconds > 0 ? Date.now() + r.leaderboardSeconds * 1000 : null;
      toast(timedOut ? "Time is up. Your round result has been saved." : "Round submitted. Nicely done!");
      routeTo("#leaderboard");
    }
    function tick() {
      if (!valid() || !context.session) return;
      const left = context.session.endsAt - Date.now();
      document.getElementById("timer").textContent = time(left);
      document.getElementById("timer").classList.toggle("error", left < 30000);
      if (left <= 0) finish(true);
    }
    function draw() {
      const session = context.session;
      if (!session || !valid()) return;
      const used = new Set(Object.values(session.placements));
      document.getElementById("board").innerHTML = Array.from({ length: size }, (_, cell) => {
        const id = session.placements[cell], occupied = id !== undefined;
        return `<button class="board-cell ${occupied ? "occupied" : ""} ${occupied && id === selected ? "selected" : ""}" data-cell="${cell}" ${occupied ? `data-piece="${id}" draggable="true"` : ""} aria-label="Board cell ${cell + 1}, ${occupied ? `piece ${id + 1}` : "empty"}" ${imageReady ? "" : "disabled"}>${occupied ? pieceSVG(config, id, "board") : ""}</button>`;
      }).join("");
      document.getElementById("tray").innerHTML = session.order.filter(id => !used.has(id)).map(id => `<button class="piece ${id === selected ? "selected" : ""}" data-piece="${id}" draggable="true" aria-label="Select piece ${id + 1}" aria-pressed="${id === selected}" ${imageReady ? "" : "disabled"}>${pieceSVG(config, id, "tray")}</button>`).join("") || '<p class="hint">Every piece has a place. Ready to submit?</p>';
      document.getElementById("moves").textContent = session.moves;
      document.getElementById("placed").textContent = `${used.size} / ${size}`;
      document.getElementById("pieces-left").textContent = `${size - used.size} left`;
      document.getElementById("return-piece").disabled = !imageReady || selected === null || !used.has(selected);
      document.getElementById("submit-round").disabled = !imageReady || used.size !== size;
    }
    function move(id, cell) {
      if (!imageReady || !valid() || !context.session) return;
      if (Date.now() >= context.session.endsAt) { finish(true); return; }
      if (C.movePiece(context.session, size, id, cell)) save();
      selected = null; draw();
    }
    document.getElementById("board").addEventListener("click", event => {
      if (!imageReady || !context.session) return;
      const cell = event.target.closest("[data-cell]"); if (!cell) return;
      if (Date.now() >= context.session.endsAt) { finish(true); return; }
      const id = cell.dataset.piece === undefined ? null : Number(cell.dataset.piece);
      if (selected !== null && selected !== id) move(selected, Number(cell.dataset.cell));
      else { selected = selected === id ? null : id; draw(); }
    });
    document.getElementById("tray").addEventListener("click", event => {
      if (!imageReady || !context.session) return;
      const piece = event.target.closest("[data-piece]"); if (!piece) return;
      selected = selected === Number(piece.dataset.piece) ? null : Number(piece.dataset.piece); draw();
    });
    for (const region of [document.getElementById("board"), document.getElementById("tray")]) {
      region.addEventListener("dragstart", event => {
        const piece = event.target.closest("[data-piece]");
        if (!piece || !imageReady) { event.preventDefault(); return; }
        selected = Number(piece.dataset.piece); event.dataTransfer.setData("text/plain", String(selected)); event.dataTransfer.effectAllowed = "move";
      });
      region.addEventListener("dragover", event => { if (imageReady) event.preventDefault(); });
      region.addEventListener("drop", event => {
        event.preventDefault();
        const raw = event.dataTransfer.getData("text/plain");
        if (!/^\d+$/.test(raw)) return;
        const cell = event.target.closest("[data-cell]");
        if (region.id === "board" && !cell) return;
        move(Number(raw), cell ? Number(cell.dataset.cell) : null);
      });
    }
    document.getElementById("return-piece").addEventListener("click", () => { if (selected !== null) move(selected, null); });
    document.getElementById("submit-round").addEventListener("click", () => {
      if (!context.session || !imageReady) return;
      if (Date.now() >= context.session.endsAt) { finish(true); return; }
      const correct = C.correctCount(context.session);
      if (correct !== size) { document.getElementById("game-hint").textContent = `${size - correct} pieces are in the wrong place. Keep going!`; return; }
      finish(false);
    });
    document.getElementById("leave-game").addEventListener("click", () => { save(); routeTo("#join"); });
    bindExport();
    if (context.session) { draw(); tick(); if (!valid()) return; activeTimer = setInterval(tick, 250); }
    const image = new Image();
    image.onload = () => {
      if (!valid()) return;
      imageReady = true;
      context.session = C.startSession(r, p.id, round); save();
      document.getElementById("image-status").textContent = storageOK ? "Progress autosaved in this browser · square image crop" : "Temporary session · download a backup before closing";
      draw(); tick();
      if (valid() && !activeTimer) activeTimer = setInterval(tick, 250);
    };
    image.onerror = () => {
      if (!valid()) return;
      document.getElementById("image-status").textContent = "Puzzle image could not load. Check the image path in Admin, then reload. An existing round timer still continues.";
      document.getElementById("image-status").classList.add("error");
    };
    image.src = config.image;
  }
  function renderLeaderboard() {
    const r = room(), p = player();
    if (viewingRound !== "final" && (!Number.isInteger(viewingRound) || viewingRound < 1 || viewingRound > r.rounds.length)) viewingRound = 1;
    const final = viewingRound === "final", rows = final ? C.finalLeaderboard(r) : C.roundLeaderboard(r, viewingRound);
    const next = p ? C.nextRound(r, p.id) : null;
    app.innerHTML = `<section class="page"><header class="page-heading"><div><p class="eyebrow">A LITTLE FRIENDLY COMPETITION</p><h1>${final ? "Final leaderboard" : `Round ${viewingRound} leaderboard`}</h1><p class="subtitle">${esc(r.title)} · Room ${esc(r.code)} · Every little move counts.</p></div><span class="badge badge-peach">${rows.filter(row => row.rank).length} / ${r.players.length} ${final ? "have results" : "submitted"}</span></header>${roomStrip()}<div class="tabs" aria-label="Leaderboard round">${r.rounds.map((_, i) => `<button data-round="${i + 1}" class="${viewingRound === i + 1 ? "active" : ""}">Round ${i + 1}</button>`).join("")}<button data-round="final" class="${final ? "active" : ""}">Final standings</button></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>${final ? "Rounds" : "Status"}</th><th>Moves</th><th>Time</th><th>Points</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.id === state.playerId ? "me" : ""}"><td class="rank">${row.rank ?? "—"}</td><td><span class="table-player">${avatar(row)}<strong>${esc(row.name)}${row.id === state.playerId ? " (you)" : ""}</strong></span></td><td>${!row.rank ? "—" : final ? `${row.submitted} / ${r.rounds.length}` : row.completed ? "Complete" : row.timedOut ? `Time up · ${row.correct}/${row.total} correct` : "Incomplete"}</td><td>${row.rank ? row.moves : "—"}</td><td>${row.rank ? time(row.timeMs) : "—"}</td><td><strong>${row.rank ? row.points : "—"}</strong></td></tr>`).join("")}</tbody></table></div><p class="hint">Round ranking: completed first → fewer moves → faster time. Points start at 50 and decrease by rank (minimum 1). Final ranking uses total points, then total moves and time. Missing results stay empty. Rankings update as more players submit.</p><p class="notice">Only results saved in this browser/profile are included. Room codes do not sync devices. Final standings are provisional until everyone has played.</p><div class="actions">${p && next ? `<button id="next-round" class="mint">${r.sessions[p.id]?.[next] ? "Resume" : "Start"} round ${next} →</button>` : p && !next ? '<span class="badge badge-mint">All your rounds are complete ✓</span>' : ""}<button id="switch-player">Next player / Join game</button><button data-export class="quiet">Download results JSON</button></div><p id="next-countdown" class="hint" aria-live="polite"></p></section>`;
    bindRoomSwitch(); bindExport();
    app.querySelectorAll("[data-round]").forEach(button => button.addEventListener("click", () => { viewingRound = button.dataset.round === "final" ? "final" : Number(button.dataset.round); render(); }));
    document.getElementById("switch-player").addEventListener("click", () => { state.playerId = null; selectedPlayer = null; boardWaitUntil = null; save(); routeTo("#join"); });
    document.getElementById("next-round")?.addEventListener("click", () => { boardWaitUntil = null; routeTo(`#play/${next}`); });
    if (p && next && boardWaitUntil && viewingRound !== "final") {
      const update = () => {
        const remaining = boardWaitUntil - Date.now();
        if (remaining <= 0) { boardWaitUntil = null; routeTo(`#play/${next}`); return; }
        document.getElementById("next-countdown").textContent = `Next round starts in ${time(remaining)}. You can also start now.`;
      };
      update(); if (route() === "leaderboard") activeTimer = setInterval(update, 500);
    }
  }
  function renderAdmin() {
    const r = room();
    const locked = Object.values(r.results).some(rounds => Object.keys(rounds).length) || Object.values(r.sessions).some(rounds => Object.keys(rounds).length);
    app.innerHTML = `<section class="page"><header class="page-heading"><div><p class="eyebrow">MAKE IT YOUR OWN</p><h1>Tournament studio</h1><p class="subtitle">Same little adventure. Your rules.</p></div><span class="badge badge-lavender">Local admin · no password</span></header><p class="notice">Settings and results autosave in this browser, not into the bundled JSON files. No folder connection or manual import is required. This admin screen is not a security boundary.</p>${roomStrip()}<div class="admin-layout"><section class="clay-panel"><h2>Your rooms</h2><p class="hint">Each six-digit code has its own players, settings and results.</p><form id="create-room"><label for="new-room">New room code</label><input id="new-room" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="e.g. 345345" required><button class="full">Create room</button></form><div class="actions"><button data-export class="quiet">Download room JSON</button><button id="reset-room" class="danger">Reset this room's results</button></div><p class="hint">Reset clears all in-progress games and submitted results in this room. It keeps players and settings.</p><p id="admin-feedback" role="status" class="hint"></p></section><form id="admin-settings" class="clay-panel"><h2>Room ${esc(r.code)} settings</h2><label for="tournament-title">Tournament title</label><input id="tournament-title" name="title" maxlength="100" value="${esc(r.title)}" required><label for="leaderboard-seconds">Between-round leaderboard (seconds)</label><input id="leaderboard-seconds" type="number" name="leaderboardSeconds" min="0" max="600" value="${r.leaderboardSeconds}" required><p class="hint">0 = manual Next round. Otherwise, the next round starts automatically after this interval while the leaderboard is open.</p><label for="roster">Player names · one per line</label><textarea id="roster" name="roster" rows="7" maxlength="10000" ${locked ? "disabled" : ""}>${esc(r.players.map(p => p.name).join("\n"))}</textarea><label for="round-count">Number of rounds</label><input id="round-count" type="number" min="1" max="10" value="${r.rounds.length}" ${locked ? "disabled" : ""}><p class="hint">${locked ? "Players and puzzle settings are locked because play has started. Reset results to edit them." : "Up to 10 rounds. Choose a bundled picture or enter a local asset path (inside this folder). Non-square images are center-cropped to a square."}</p><div id="round-settings"></div><button class="full mint">Save settings</button><p id="settings-error" class="error" role="alert"></p></form></div></section>`;
    bindRoomSwitch(); bindExport();
    let draft = C.clone(r.rounds);
    const count = document.getElementById("round-count"), roundSettings = document.getElementById("round-settings");
    document.querySelector('label[for="roster"]').textContent = "Player names · comma separated";
    document.getElementById("roster").value = r.players.map(p => p.name).join(", ");
    document.getElementById("roster").placeholder = "Ujjwal, Aarav, Ananya";
    if (!locked) roundSettings.previousElementSibling.textContent = "Up to 10 rounds. Click Select image to choose a picture from the offline gallery. Images are center-cropped to a square.";
    function roundFields() {
      roundSettings.innerHTML = draft.map((config, i) => `<section class="round-config" data-config="${i}"><div><label for="round-name-${i}">Round ${i + 1} · name</label><input id="round-name-${i}" data-field="name" maxlength="80" value="${esc(config.name)}" ${locked ? "disabled" : ""} required></div><div><label for="round-grid-${i}">Grid</label><select id="round-grid-${i}" data-field="grid" ${locked ? "disabled" : ""}>${[2, 3, 4, 5, 6, 7, 8].map(g => `<option value="${g}" ${g === config.grid ? "selected" : ""}>${g} × ${g}</option>`).join("")}</select></div><div><label for="round-time-${i}">Seconds</label><input id="round-time-${i}" data-field="seconds" type="number" min="10" max="7200" value="${config.seconds}" ${locked ? "disabled" : ""} required></div><div class="wide"><p class="hint">Round ${i + 1} image</p><button type="button" id="round-image-${i}" data-select-image="${i}" aria-haspopup="dialog" ${locked ? "disabled" : ""}>Select image</button><img class="reference" src="${esc(config.image)}" alt="Round ${i + 1} image preview"></div></section>`).join("");
    }
    // Native dialog provides focus trapping, Escape dismissal and focus restoration.
    const gallery = document.createElement("dialog");
    gallery.className = "image-gallery";
    gallery.setAttribute("aria-labelledby", "gallery-title");
    app.append(gallery);
    let imageRound = null;
    roundSettings.addEventListener("click", event => {
      const button = event.target.closest("[data-select-image]");
      if (!button || locked) return;
      imageRound = Number(button.dataset.selectImage);
      const images = [...new Map([...(window.OFFLINE_GALLERY || []), ...defaults.rounds, ...draft].map(config => [config.image, config])).values()];
      gallery.innerHTML = `<header class="panel-heading"><div><p class="eyebrow">PICTURE PLAYGROUND</p><h2 id="gallery-title">Select image · Round ${imageRound + 1}</h2></div><button type="button" data-close-gallery aria-label="Close image gallery" class="quiet">✕</button></header><p class="hint">Choose a picture for this round. Click Save settings afterwards to keep your changes.</p><div class="gallery-grid">${images.map((config, i) => `<button type="button" class="gallery-card ${config.image === draft[imageRound].image ? "selected" : ""}" data-gallery-index="${i}" aria-pressed="${config.image === draft[imageRound].image}"><img src="${esc(config.image)}" alt="${esc(config.name)}"><span>${esc(config.name)}</span>${config.image === draft[imageRound].image ? '<small>Selected ✓</small>' : ""}</button>`).join("")}</div>`;
      gallery.querySelector("[data-close-gallery]").addEventListener("click", () => gallery.close());
      gallery.querySelectorAll("[data-gallery-index]").forEach(card => card.addEventListener("click", () => {
        const config = images[Number(card.dataset.galleryIndex)];
        draft[imageRound].image = config.image;
        const section = roundSettings.querySelector(`[data-config="${imageRound}"]`);
        section.querySelector(".reference").src = config.image;
        gallery.close();
        toast("Image selected. Save settings to keep your changes.");
      }));
      gallery.showModal();
    });
    gallery.addEventListener("click", event => {
      if (event.target !== gallery) return;
      const rect = gallery.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) gallery.close();
    });
    roundSettings.addEventListener("input", event => {
      const field = event.target.dataset.field, parent = event.target.closest("[data-config]");
      if (!field || !parent || locked) return;
      draft[Number(parent.dataset.config)][field] = ["grid", "seconds"].includes(field) ? Number(event.target.value) : event.target.value;
    });
    count.addEventListener("change", () => {
      if (locked) return;
      const n = Number(count.value); if (!Number.isInteger(n) || n < 1 || n > 10) return;
      while (draft.length < n) draft.push(C.clone(defaults.rounds[draft.length % defaults.rounds.length]));
      draft = draft.slice(0, n); roundFields();
    });
    roundFields();
    document.getElementById("create-room").addEventListener("submit", event => {
      event.preventDefault(); const code = new FormData(event.currentTarget).get("code").trim();
      if (!C.validCode(code)) { toast("Enter a six-digit code."); return; }
      if (state.rooms[code]) { toast("This room already exists. Open it using the room selector."); return; }
      state.rooms[code] = C.createRoom(defaults, code); state.currentRoom = code; state.playerId = null; viewingRound = 1; boardWaitUntil = null;
      save(); syncConvex(); render(); toast(`Room ${code} created.`);
    });
    document.getElementById("admin-settings").addEventListener("submit", event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const error = document.getElementById("settings-error"); error.textContent = "";
      const title = form.get("title").trim(), wait = Number(form.get("leaderboardSeconds"));
      if (!title || !Number.isInteger(wait) || wait < 0 || wait > 600) { error.textContent = "Enter a title and a valid leaderboard duration (0–600 seconds)."; return; }
      if (!locked) {
        const names = form.get("roster").split(/[,\r\n]+/).map(name => name.trim()).filter(Boolean);
        if (!names.length || names.length > 200 || names.some(name => name.length > 80) || new Set(names.map(name => name.toLowerCase())).size !== names.length) { error.textContent = "Enter 1–200 unique player names, up to 80 characters each."; return; }
        if (!Number.isInteger(Number(count.value)) || Number(count.value) !== draft.length || draft.some(config => !config.name.trim() || !Number.isInteger(config.seconds) || config.seconds < 10 || config.seconds > 7200 || !/^(?:\.\/)?assets\/[a-zA-Z0-9_./ -]+\.(?:svg|png|jpe?g|webp|gif)$/i.test(config.image) || config.image.includes(".."))) { error.textContent = "Check round count, names, times (10–7200 seconds) and local assets/ image paths."; return; }
        const previous = new Map(r.players.map(p => [p.name.toLowerCase(), p]));
        r.players = names.map((name, i) => {
          const existing = previous.get(name.toLowerCase());
          return { ...(existing || { id: `player-${Date.now()}-${i}` }), name, avatar: window.offlineAvatarFor(name) };
        });
        r.rounds = C.clone(draft); r.results = {}; r.sessions = {};
        if (!r.players.some(p => p.id === state.playerId)) state.playerId = null;
      }
      r.title = title; r.leaderboardSeconds = wait;
      const ok = save(); window.ConvexSync?.updateRoomSettings(r); render(); toast(ok ? "Settings saved in this browser." : "Settings updated in memory only. Download a backup.");
    });
    document.getElementById("reset-room").addEventListener("click", () => {
      if (!confirm(`Clear all results and in-progress rounds for room ${r.code}? This cannot be undone. Download a backup first if needed.`)) return;
      r.results = {}; r.sessions = {}; boardWaitUntil = null; viewingRound = 1; save(); window.ConvexSync?.resetRoom(r.code); render(); toast("Room results reset. Settings and players kept.");
    });
  }
  function bindExport() {
    document.querySelectorAll("[data-export]").forEach(button => button.addEventListener("click", () => {
      const r = room();
      const output = { schemaVersion: 1, exportedAt: new Date().toISOString(), room: C.clone(r), leaderboards: {
        rounds: r.rounds.map((_, i) => ({ round: i + 1, players: C.roundLeaderboard(r, i + 1) })), final: C.finalLeaderboard(r)
      } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `room-${r.code}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Room JSON backup downloaded.");
    }));
  }
  window.addEventListener("hashchange", render);
  window.addEventListener("storage", event => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      if (incoming.schemaVersion !== 1 || !incoming.rooms?.[incoming.currentRoom]) return;
      state = incoming; boardWaitUntil = null; render(); toast("Data refreshed from another tab. Use one tab per game to avoid conflicting moves.");
    } catch (error) { warn("Another tab wrote invalid data. Reload only after downloading a backup."); }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && route().startsWith("play/") && playContext?.session && Date.now() >= playContext.session.endsAt) render();
  });
  render();
})();