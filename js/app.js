(function () {
  "use strict";
  const C = window.OfflineCore;
  const defaults = window.OFFLINE_DEFAULTS;
  const KEY = "jigsaw-offline-v1";
  const app = document.getElementById("app");
  let state, storageOK = true, selected = null, selectedPlayer = null, viewingRound = 1;
  let activeTimer = null, boardWaitUntil = null, toastTimer, imageReady = false;
  let playContext = null;
  let wizardStep = 1, wizardRound = 0, wizardDraft = null, wizardRoomCode = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const time = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const SoundFX = (() => {
    let audioCtx = null;
    let enabled = true;
    try { enabled = localStorage.getItem("puzzle_sound_enabled") !== "false"; } catch (_) {}
    function getCtx() {
      if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctor();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
    ["click", "touchstart", "keydown"].forEach(evt => {
      window.addEventListener(evt, () => getCtx(), { once: true, passive: true });
    });
    function updateBtn() {
      const btn = document.getElementById("sound-toggle");
      if (btn) {
        btn.textContent = enabled ? "🔊" : "🔇";
        btn.setAttribute("aria-label", enabled ? "Mute sound" : "Unmute sound");
        btn.setAttribute("title", enabled ? "Sound On (Click to Mute)" : "Sound Muted (Click to Unmute)");
        btn.classList.toggle("muted", !enabled);
      }
    }
    function toggle() {
      enabled = !enabled;
      try { localStorage.setItem("puzzle_sound_enabled", String(enabled)); } catch (_) {}
      updateBtn();
      if (enabled) playPickup();
      return enabled;
    }
    function playPickup() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch (_) {}
    }
    function playPlace() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(680, now);
        osc1.frequency.exponentialRampToValueAtTime(280, now + 0.07);
        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.07);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(240, now);
        osc2.frequency.exponentialRampToValueAtTime(90, now + 0.09);
        gain2.gain.setValueAtTime(0.25, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.09);
      } catch (_) {}
    }
    function playReturn() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } catch (_) {}
    }
    function playError() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        [0, 0.1].forEach(d => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(190, now + d);
          gain.gain.setValueAtTime(0.18, now + d);
          gain.gain.exponentialRampToValueAtTime(0.001, now + d + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + d);
          osc.stop(now + d + 0.08);
        });
      } catch (_) {}
    }
    function playSuccess() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [
          { f: 523.25, t: 0.00, dur: 0.35, vol: 0.18 },
          { f: 659.25, t: 0.09, dur: 0.35, vol: 0.20 },
          { f: 783.99, t: 0.18, dur: 0.45, vol: 0.22 },
          { f: 1046.50, t: 0.28, dur: 0.65, vol: 0.26 },
          { f: 1318.51, t: 0.40, dur: 0.85, vol: 0.22 }
        ];
        notes.forEach(({ f, t, dur, vol }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, now + t);
          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(vol, now + t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + dur);
        });
      } catch (_) {}
    }
    function playClick() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } catch (_) {}
    }
    function playTap() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.025);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.025);
      } catch (_) {}
    }
    function playLaunch() {
      if (!enabled) return;
      const ctx = getCtx(); if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [
          { f: 440.00, t: 0.00, dur: 0.22, vol: 0.16 },
          { f: 554.37, t: 0.09, dur: 0.22, vol: 0.18 },
          { f: 659.25, t: 0.18, dur: 0.25, vol: 0.20 },
          { f: 880.00, t: 0.28, dur: 0.55, vol: 0.24 }
        ];
        notes.forEach(({ f, t, dur, vol }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, now + t);
          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(vol, now + t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + dur);
        });
      } catch (_) {}
    }
    return { init: updateBtn, toggle, playPickup, playPlace, playReturn, playError, playSuccess, playClick, playTap, playLaunch };
  })();
  const SHORT_A = 48271, SHORT_B = 314159, SHORT_INV = 371631, SHORT_MOD = 1000000;
  function codeToShortSlug(code) {
    if (!code || !/^\d{6}$/.test(code)) return code;
    const n = parseInt(code, 10);
    const p = (n * SHORT_A + SHORT_B) % SHORT_MOD;
    return p.toString(36).padStart(4, "0");
  }
  function shortSlugToCode(slug) {
    if (!slug) return "";
    const clean = String(slug).trim().toLowerCase();
    if (/^\d{6}$/.test(clean)) return clean;
    const p = parseInt(clean, 36);
    if (isNaN(p) || p < 0 || p >= SHORT_MOD) return "";
    const diff = (((p - SHORT_B) % SHORT_MOD) + SHORT_MOD) % SHORT_MOD;
    const n = (diff * SHORT_INV) % SHORT_MOD;
    return String(n).padStart(6, "0");
  }
  function generateUniqueRoomCode() {
    for (let i = 0; i < 100; i++) {
      const c = String(Math.floor(100000 + Math.random() * 900000));
      if (!state.rooms[c]) return c;
    }
    return String(Date.now()).slice(-6);
  }
  function getAvatarUrl(name, existingAvatar) {
    if (!name || !String(name).trim()) return "assets/avatars/mint.svg";
    const clean = String(name).trim();
    if (existingAvatar && existingAvatar.startsWith("https://api.multiavatar.com/")) {
      return existingAvatar;
    }
    if (existingAvatar && !existingAvatar.includes("mint.svg") && !existingAvatar.startsWith("data:")) {
      return existingAvatar;
    }
    const off = typeof window.offlineAvatarFor === "function" ? window.offlineAvatarFor(clean) : null;
    if (off && !off.includes("mint.svg")) {
      return off;
    }
    return `https://api.multiavatar.com/${encodeURIComponent(clean)}.svg`;
  }
  function createNewTournamentRoom(code) {
    const defaultPlayerCount = 10;
    const autoPlayers = Array.from({ length: defaultPlayerCount }, (_, i) => {
      const pName = `Player ${i + 1}`;
      return {
        id: `player-${Date.now()}-${i}`,
        name: pName,
        avatar: getAvatarUrl(pName)
      };
    });
    const newRoom = C.createRoom({
      ...defaults,
      players: autoPlayers
    }, code);
    newRoom.launched = false;
    newRoom.status = "draft";
    newRoom.draftCreatedAt = new Date().toISOString();
    return newRoom;
  }
  function getUrlRoomCode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const rParam = params.get("r");
      if (rParam) {
        const decoded = shortSlugToCode(rParam);
        if (decoded && C.validCode(decoded)) return decoded;
      }
      const roomParam = params.get("room");
      if (roomParam) {
        if (C.validCode(roomParam)) return roomParam;
        const decoded = shortSlugToCode(roomParam);
        if (decoded && C.validCode(decoded)) return decoded;
      }
      const hash = window.location.hash;
      const slugHashMatch = hash.match(/[?&]r=([a-zA-Z0-9]+)/);
      if (slugHashMatch) {
        const decoded = shortSlugToCode(slugHashMatch[1]);
        if (decoded && C.validCode(decoded)) return decoded;
      }
      const match = hash.match(/room=(\d{6})/);
      if (match) return match[1];
    } catch (_) {}
    return "";
  }
  function getShareUrl(code) {
    const slug = codeToShortSlug(code);
    if (location.protocol === "file:") {
      return `https://jigsaw.ekanshi.com/?r=${slug}`;
    }
    const u = new URL(location.href);
    u.hash = "#join";
    u.search = "";
    u.searchParams.set("r", slug);
    return u.toString();
  }
  function getLeaderboardRoomCode() {
    try {
      const r = route();
      if (r.startsWith("leaderboard/")) {
        const part = r.slice("leaderboard/".length).split("?")[0].split("/")[0].trim();
        if (part) {
          if (C.validCode(part)) return part;
          const decoded = shortSlugToCode(part);
          if (decoded && C.validCode(decoded)) return decoded;
        }
      }
      if (r === "leaderboard") return "";
      return getUrlRoomCode();
    } catch (_) {}
    return "";
  }
  function getStudioRoomCode() {
    try {
      const r = route();
      if (r.startsWith("studio/")) {
        const part = r.slice("studio/".length).split("?")[0].split("/")[0].trim();
        if (part) {
          if (C.validCode(part)) return part;
          const decoded = shortSlugToCode(part);
          if (decoded && C.validCode(decoded)) return decoded;
        }
      } else if (r.startsWith("admin/")) {
        const part = r.slice("admin/".length).split("?")[0].split("/")[0].trim();
        if (part) {
          if (C.validCode(part)) return part;
          const decoded = shortSlugToCode(part);
          if (decoded && C.validCode(decoded)) return decoded;
        }
      }
    } catch (_) {}
    return "";
  }
  const getAdminRoomCode = getStudioRoomCode;
  function getLeaderboardShareUrl(code) {
    const slug = codeToShortSlug(code);
    if (location.protocol === "file:") {
      return `https://jigsaw.ekanshi.com/?r=${slug}#leaderboard/${slug}`;
    }
    const u = new URL(location.href);
    u.hash = `#leaderboard/${slug}`;
    u.search = "";
    u.searchParams.set("r", slug);
    return u.toString();
  }
  const room = () => state.rooms?.[state.currentRoom] || null;
  const player = () => room()?.players?.find(p => p.id === state.playerId) || null;
  function warn(message) {
    const el = document.getElementById("storage-warning");
    el.textContent = message; el.hidden = false;
  }
  function initialState() {
    return { schemaVersion: 1, currentRoom: null, playerId: null, rooms: {}, publicLeaderboard: [], instantPlayerName: "", instantSession: null };
  }
  function cleanExpiredDrafts() {
    if (!state || !state.rooms) return;
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let changed = false;
    for (const [code, r] of Object.entries(state.rooms)) {
      if (r && r.launched === false) {
        const created = new Date(r.draftCreatedAt || r.createdAt || 0).getTime();
        if (created > 0 && (now - created > TWENTY_FOUR_HOURS)) {
          delete state.rooms[code];
          if (state.currentRoom === code) {
            const remaining = Object.keys(state.rooms);
            state.currentRoom = remaining[0] || null;
          }
          changed = true;
        }
      }
    }
    if (changed) {
      save();
    }
  }
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : initialState();
    if (state.schemaVersion !== 1 || typeof state.rooms !== "object" || state.rooms === null) throw new Error("Invalid saved data");
    state.publicLeaderboard ||= [];
    state.instantPlayerName ||= "";
    if (state.rooms["234234"]) {
      delete state.rooms["234234"];
      if (state.currentRoom === "234234") {
        state.currentRoom = null;
      }
    }
    Object.values(state.rooms).forEach(r => {
      if (r && r.launched === undefined) {
        r.launched = true;
        r.status = "active";
      }
    });
    cleanExpiredDrafts();
    const roomCodes = Object.keys(state.rooms);
    if (!state.currentRoom || !state.rooms[state.currentRoom]) {
      state.currentRoom = roomCodes[0] || null;
    }
  } catch (error) {
    storageOK = false; state = initialState();
    warn("Browser storage is unavailable or saved data is invalid. This session is temporary. Download a JSON backup before closing.");
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
    const r = room();
    if (window.ConvexSync && r && r.launched !== false) {
      window.ConvexSync.syncRoom(r);
    }
  }
  window.onConvexResultsUpdated = function (roomCode, results) {
    const target = state.rooms[roomCode];
    if (!target) return;
    const validPlayers = new Set(target.players.map(p => p.id));
    const newResults = {};
    results.forEach(res => {
      // ONLY include results for players who actually belong to this room's roster!
      if (validPlayers.has(res.playerId)) {
        newResults[res.playerId] ||= {};
        newResults[res.playerId][res.round] = {
          moves: res.moves,
          timeMs: res.timeMs,
          completed: res.completed,
          correct: res.correct,
          total: res.total,
          timedOut: res.timedOut,
          submittedAt: res.submittedAt
        };
      }
    });
    target.results = newResults;
    save();
    if (route().startsWith("leaderboard") || route() === "join") {
      render();
    }
  };

  window.onConvexInstantResultsUpdated = function (results) {
    if (!Array.isArray(results)) return;
    const remoteList = [];
    results.forEach(res => {
      let pName = "Player";
      let pAvatar = "assets/avatars/mint.svg";
      try {
        if (typeof res.playerId === "string" && res.playerId.startsWith("{")) {
          const parsed = JSON.parse(res.playerId);
          pName = parsed.n || "Player";
          pAvatar = getAvatarUrl(pName, parsed.a);
        } else {
          pName = res.playerId || "Player";
          pAvatar = getAvatarUrl(pName);
        }
      } catch (_) {
        pName = res.playerId || "Player";
        pAvatar = getAvatarUrl(pName);
      }

      const moves = Number(res.moves) || 0;
      const timeMs = Number(res.timeMs) || 0;
      const pieces = Number(res.total) || 16;
      const completed = Boolean(res.completed);
      const points = completed ? Math.max(15, 100 + (pieces === 16 ? 25 : 0) - moves - Math.floor(timeMs / 5000)) : Math.max(1, Math.floor((res.correct || 0) * 5));

      remoteList.push({
        id: "cvx-" + (res._id || Math.random().toString(36).slice(2)),
        name: pName,
        avatar: pAvatar,
        image: "assets/rounds/round-1.svg",
        imageName: "Instant Puzzle",
        grid: Math.round(Math.sqrt(pieces)),
        pieces,
        moves,
        timeMs,
        points,
        completed,
        submittedAt: res.submittedAt || new Date().toISOString()
      });
    });

    const seen = new Set();
    const merged = [];
    remoteList.forEach(entry => {
      const key = `${entry.name}_${entry.moves}_${entry.timeMs}_${entry.pieces}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(entry);
      }
    });
    (state.publicLeaderboard || []).forEach(localEntry => {
      const key = `${localEntry.name}_${localEntry.moves}_${localEntry.timeMs}_${localEntry.pieces}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(localEntry);
      }
    });

    state.publicLeaderboard = merged;
    save();
    if (route().startsWith("leaderboard")) {
      render();
    }
  };

  window.onConvexRoomSynced = function (remoteRoom) {
    if (!remoteRoom?.code) return;
    let target = state.rooms[remoteRoom.code];
    if (!target) {
      target = state.rooms[remoteRoom.code] = {
        code: remoteRoom.code,
        title: remoteRoom.title,
        leaderboardSeconds: remoteRoom.leaderboardSeconds,
        rounds: remoteRoom.rounds,
        players: remoteRoom.players,
        results: {},
        sessions: {},
        createdAt: remoteRoom.createdAt || new Date().toISOString()
      };
    } else {
      target.title = remoteRoom.title;
      target.leaderboardSeconds = remoteRoom.leaderboardSeconds;
      target.rounds = remoteRoom.rounds;
      target.players = remoteRoom.players;
    }
    // Prune results for players who are not in the room roster!
    if (target.results) {
      const validPlayers = new Set(target.players.map(p => p.id));
      Object.keys(target.results).forEach(pid => {
        if (!validPlayers.has(pid)) {
          delete target.results[pid];
        }
      });
    }
    save();
    if (route().startsWith("leaderboard") || route() === "join" || route().startsWith("studio") || route().startsWith("admin")) {
      render();
    }
  };

  window.onConvexRoomsListUpdated = function (remoteRooms) {
    if (!Array.isArray(remoteRooms)) return;
    const remoteCodes = new Set(remoteRooms.map(r => r.code));
    remoteRooms.forEach(remoteRoom => {
      if (!state.rooms[remoteRoom.code]) {
        state.rooms[remoteRoom.code] = {
          code: remoteRoom.code,
          title: remoteRoom.title,
          leaderboardSeconds: remoteRoom.leaderboardSeconds,
          rounds: remoteRoom.rounds,
          players: remoteRoom.players,
          results: {},
          sessions: {},
          createdAt: remoteRoom.createdAt || new Date().toISOString()
        };
      }
    });
    // Remove locally cached rooms that were deleted on Convex (excluding unlaunched drafts!)
    Object.keys(state.rooms).forEach(localCode => {
      const lr = state.rooms[localCode];
      if (lr && lr.launched === false) return; // Never delete unlaunched local drafts!
      if (!remoteCodes.has(localCode)) {
        delete state.rooms[localCode];
        if (state.currentRoom === localCode) {
          state.currentRoom = null;
        }
      }
    });
    if (!state.currentRoom) {
      const remaining = Object.keys(state.rooms);
      state.currentRoom = remaining.length > 0 ? remaining[0] : null;
    }
    save();
    render();
  };
  function toast(message) {
    const el = document.getElementById("announcement");
    el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }
  function routeTo(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function route() { return location.hash.slice(1) || "join"; }
  function avatar(p) {
    const src = getAvatarUrl(p?.name, p?.avatar);
    return `<img class="avatar" src="${esc(src)}" alt="${esc(p?.name || '')}" onerror="this.onerror=null;this.src='assets/avatars/mint.svg'">`;
  }
  function roomStrip() {
    const codes = Object.keys(state.rooms || {});
    if (!codes.length) return `<div class="room-strip"><span class="badge badge-peach">No active rooms</span></div>`;
    const r = room();
    return `<form id="switch-room" class="room-strip"><label for="active-room">Room</label><select id="active-room" name="code">${codes.map(code => `<option ${code === state.currentRoom ? "selected" : ""}>${esc(code)}</option>`).join("")}</select><button class="quiet">Open room</button><span class="badge badge-mint">${r ? r.players.length : 0} players</span></form>`;
  }
  function bindRoomSwitch() {
    document.getElementById("switch-room")?.addEventListener("submit", event => {
      event.preventDefault(); state.currentRoom = new FormData(event.currentTarget).get("code");
      state.playerId = null; selectedPlayer = null; viewingRound = 1; boardWaitUntil = null; save(); syncConvex(); render();
    });
  }
  let leaderboardTab = "public";
  function render() {
    cleanExpiredDrafts();
    syncConvex();
    clearInterval(activeTimer); activeTimer = null; selected = null; playContext = null;
    if (route() === "admin") { routeTo("#studio"); return; }
    if (route().startsWith("admin/")) { routeTo("#studio/" + route().slice("admin/".length)); return; }
    document.querySelectorAll("nav a").forEach(a => {
      if (route().startsWith("studio") && a.hash.startsWith("#studio")) a.setAttribute("aria-current", "page");
      else if (a.hash.startsWith("#leaderboard") && route().startsWith("leaderboard")) a.setAttribute("aria-current", "page");
      else if (a.hash === `#${route().split("/")[0]}`) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const lbNav = document.querySelector('nav a[href*="leaderboard"]');
    if (lbNav) lbNav.href = "#leaderboard";
    if (route().startsWith("studio")) renderStudio();
    else if (route() === "instant") renderInstantGame();
    else if (route().startsWith("leaderboard")) renderLeaderboard();
    else if (route().startsWith("play/")) renderGame(Number(route().split("/")[1]));
    else renderJoin();
  }
  function renderJoin() {
    const defaultCode = getUrlRoomCode();
    const r = state.rooms[defaultCode] || room();
    app.innerHTML = `<section class="page centered-card"><div class="illustration" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="eyebrow">A LITTLE FOCUS. A LOT OF FUN.</p><h1>Jigsaw Arena</h1><p class="subtitle">Five rounds. One challenge.</p><div class="badges"><span class="badge badge-mint">⚡ Instant Play</span><span class="badge badge-lavender">🏆 Tournament</span><span class="badge badge-peach">World Leaderboard</span></div><div class="instant-play-card"><span class="instant-badge">⚡ INSTANT PLAY</span><h2 style="font-size:20px;margin:0 0 6px">Quick Puzzle Challenge</h2><p class="subtitle" style="margin-bottom:14px">Jump straight into a random puzzle without any room code. Save your score to the World Leaderboard!</p><div class="instant-input-row"><input id="instant-name" type="text" placeholder="Enter your name..." value="${esc(state.instantPlayerName || '')}" maxlength="30" autocomplete="name"><button id="instant-play-btn" type="button" class="mint" style="font-weight:800">Start Instant Play ⚡</button></div></div><div class="or-divider"><span>or join tournament room</span></div><form id="join-form" class="join-form"><label class="pin-code-label">6-digit room code</label><div class="pin-code-group" id="pin-code-group" role="group" aria-label="Enter 6-digit room code"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" data-index="0" value="${defaultCode[0] || ''}"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="1" value="${defaultCode[1] || ''}"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="2" value="${defaultCode[2] || ''}"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="3" value="${defaultCode[3] || ''}"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="4" value="${defaultCode[4] || ''}"><input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="5" value="${defaultCode[5] || ''}"></div><input id="room-code" type="hidden" name="code" value="${esc(defaultCode)}"><label for="player-search">Find your name</label><input id="player-search" type="search" placeholder="Search your name, e.g. Ujjwal" autocomplete="off"><div id="player-options" class="players-list" role="group" aria-label="Choose your player"></div><p id="selected-name" class="selection-note muted" aria-live="polite">Choose your name to continue.</p><button id="join-button" class="full mint" disabled>Join tournament game →</button><p id="join-error" role="alert" class="error"></p></form><div class="or-divider"><span>or create your own</span></div><div class="create-tournament-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap"><div style="flex:1 1 200px"><span class="badge badge-lavender" style="font-size:10px;margin-bottom:6px">HOST A TOURNAMENT</span><h3 style="font-size:16px;margin:2px 0 4px;font-weight:800;color:var(--ink)">Create New Tournament</h3><p class="subtitle" style="margin:0;font-size:12px;line-height:1.45">Generate a 6-digit room code, customize players, and compete together.</p></div><button id="btn-open-create-room" type="button" class="lavender" style="font-weight:800;padding:11px 18px;display:inline-flex;align-items:center;gap:6px"><span>🏆</span> Create Tournament</button></div></div><p class="hint" style="margin-top:20px">Enter your 6-digit room code to join tournament.<br>Syncs scores across devices in real time.</p></section>`;
    const pinGroup = document.getElementById("pin-code-group");
    const pinDigits = Array.from(pinGroup ? pinGroup.querySelectorAll(".pin-digit") : []);
    const codeInput = document.getElementById("room-code");
    const search = document.getElementById("player-search");
    selectedPlayer = null;

    function getCode() {
      return pinDigits.map(d => d.value.trim()).join("");
    }
    function updateCode(codeStr) {
      const clean = String(codeStr || "").replace(/\D/g, "").slice(0, 6);
      pinDigits.forEach((d, i) => { d.value = clean[i] || ""; });
      codeInput.value = clean;
      onCodeChange();
    }
    function onCodeChange() {
      selectedPlayer = null;
      const val = getCode();
      codeInput.value = val;
      if (val.length === 6 && C.validCode(val)) {
        if (state.rooms[val]) {
          state.currentRoom = val;
          syncConvex();
        }
      }
      options();
    }

    pinDigits.forEach((digit, index) => {
      digit.addEventListener("input", event => {
        const val = event.target.value.replace(/\D/g, "");
        if (val.length > 1) {
          updateCode(getCode().slice(0, index) + val + getCode().slice(index + 1));
          const nextIdx = Math.min(5, index + val.length);
          pinDigits[nextIdx]?.focus();
          return;
        }
        event.target.value = val;
        if (val && index < 5) {
          pinDigits[index + 1].focus();
        }
        onCodeChange();
      });

      digit.addEventListener("keydown", event => {
        if (event.key === "Backspace") {
          if (!event.target.value && index > 0) {
            pinDigits[index - 1].value = "";
            pinDigits[index - 1].focus();
            event.preventDefault();
            onCodeChange();
          }
        } else if (event.key === "ArrowLeft" && index > 0) {
          pinDigits[index - 1].focus();
        } else if (event.key === "ArrowRight" && index < 5) {
          pinDigits[index + 1].focus();
        }
      });

      digit.addEventListener("paste", event => {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData)?.getData("text") || "";
        const clean = text.replace(/\D/g, "").slice(0, 6);
        if (clean) {
          updateCode(clean);
          const nextIdx = Math.min(5, clean.length - 1);
          pinDigits[nextIdx]?.focus();
        }
      });

      digit.addEventListener("focus", () => digit.select());
    });

    function options() {
      const code = getCode();
      if (!code) {
        document.getElementById("player-options").innerHTML = '<p class="hint">Enter a 6-digit room code to view registered players.</p>';
        document.getElementById("selected-name").textContent = "Enter a room code to get started.";
        document.getElementById("join-button").disabled = true;
        document.getElementById("join-button").textContent = "Join game →";
        return;
      }
      let target = state.rooms[code];
      if (target && target.launched === false) {
        document.getElementById("player-options").innerHTML = '<div style="padding:14px;background:#fff8ee;border:1.5px solid #f6dfbe;border-radius:16px;text-align:left"><p class="hint" style="color:#7a561f;margin:0;font-size:13px">⏳ <strong>Tournament Setup in Progress:</strong> The host is still setting up rounds and hasn\'t launched this tournament yet. Please wait for the host to launch it, or check your code.</p></div>';
        document.getElementById("selected-name").textContent = "Tournament not launched yet.";
        document.getElementById("join-button").disabled = true;
        document.getElementById("join-button").textContent = "Tournament not launched";
        return;
      }
      const matches = (target?.players || []).filter(p => p.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      if (!target?.players.some(p => p.id === selectedPlayer)) selectedPlayer = null;
      document.getElementById("player-options").innerHTML = matches.length ? matches.map(p => `<button type="button" class="player-option ${p.id === selectedPlayer ? "selected" : ""}" data-player="${esc(p.id)}" aria-pressed="${p.id === selectedPlayer}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join("") : `<p class="hint">${target ? "No matching names. Add players in Studio." : (code.length === 6 ? "Room not found. Check code or create it in Studio." : "Enter all 6 digits.")}</p>`;
      const chosen = target?.players.find(p => p.id === selectedPlayer);
      const next = chosen ? C.nextRound(target, chosen.id) : null;
      document.getElementById("selected-name").textContent = chosen ? `${chosen.name} selected · ${next ? `Next: round ${next}` : "All rounds submitted"}` : "Choose your name to continue.";
      document.getElementById("join-button").disabled = !chosen;
      document.getElementById("join-button").textContent = chosen && !next ? "View final leaderboard →" : chosen && target?.sessions[chosen.id]?.[next] ? "Resume game →" : "Join game →";
    }
    document.getElementById("player-options").addEventListener("click", event => {
      const button = event.target.closest("[data-player]"); if (!button) return;
      selectedPlayer = button.dataset.player; options();
    });
    search.addEventListener("input", options);
    document.getElementById("join-form").addEventListener("submit", event => {
      event.preventDefault();
      const code = getCode();
      const target = state.rooms[code];
      if (!target || target.launched === false || !target.players.some(p => p.id === selectedPlayer)) return;
      state.currentRoom = code; state.playerId = selectedPlayer; save();
      const next = C.nextRound(target, selectedPlayer);
      if (next) routeTo(`#play/${next}`);
      else { viewingRound = "final"; routeTo(state.currentRoom ? `#leaderboard/${state.currentRoom}` : "#leaderboard"); }
    });
    document.getElementById("instant-play-btn")?.addEventListener("click", () => {
      const nameInput = document.getElementById("instant-name");
      const name = nameInput ? nameInput.value.trim() : "";
      startInstantGame(name);
    });
    document.getElementById("instant-name")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("instant-play-btn")?.click();
      }
    });

    document.getElementById("btn-open-create-room")?.addEventListener("click", () => {
      const code = generateUniqueRoomCode();
      state.rooms[code] = createNewTournamentRoom(code);
      state.currentRoom = code;
      state.playerId = null;
      viewingRound = 1;
      boardWaitUntil = null;
      wizardStep = 1;
      wizardRound = 0;
      wizardDraft = C.clone(state.rooms[code].rounds);
      wizardRoomCode = code;
      save();
      routeTo(`#studio/${code}`);
      toast("🏆 Tournament setup started! Complete rounds and launch.");
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
  function shuffle(size) {
    if (typeof C?.shuffle === "function") return C.shuffle(size);
    const pieces = Array.from({ length: size }, (_, i) => i);
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }
  function startInstantGame(name) {
    const playerName = (name || state.instantPlayerName || "").trim() || "Player";
    state.instantPlayerName = playerName;
    const gallery = Array.isArray(window.OFFLINE_GALLERY) && window.OFFLINE_GALLERY.length ? window.OFFLINE_GALLERY : [];
    const rounds = Array.isArray(defaults?.rounds) && defaults.rounds.length ? defaults.rounds : [];
    const pool = [
      ...gallery,
      ...rounds.map(r => ({ name: r.name, image: r.image }))
    ];
    if (!pool.length) {
      pool.push({ name: "A little sunshine", image: "assets/rounds/round-1.svg" });
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const grid = Math.random() < 0.5 ? 3 : 4;
    const seconds = grid === 3 ? 240 : 300;
    const now = Date.now();
    const playerAvatar = getAvatarUrl(playerName);
    state.instantSession = {
      id: "instant-" + now,
      playerName,
      avatar: playerAvatar,
      image: chosen.image,
      imageName: chosen.name,
      grid,
      seconds,
      startedAt: now,
      endsAt: now + seconds * 1000,
      moves: 0,
      placements: {},
      order: shuffle(grid * grid)
    };
    save();
    routeTo("#instant");
  }
  function renderInstantGame() {
    const session = state.instantSession;
    if (!session) { routeTo("#join"); return; }
    const size = session.grid ** 2;
    const config = { name: session.imageName, grid: session.grid, image: session.image, seconds: session.seconds };
    imageReady = false;
    app.innerHTML = `<section class="page game-page"><header class="page-heading"><div><p class="eyebrow">⚡ INSTANT PLAY · NO ROOM NEEDED</p><h1>${esc(config.name)}</h1><p class="subtitle">Quick casual puzzle challenge · Every little move counts.</p></div><span class="badge badge-mint">${config.grid} × ${config.grid} (${size} pieces)</span></header><div class="hud"><div class="stat"><small>TIME LEFT</small><strong id="timer">${time(config.seconds * 1000)}</strong></div><div class="stat"><small>MOVES</small><strong id="moves">${session.moves}</strong></div><div class="stat"><small>PLACED</small><strong id="placed">0 / ${size}</strong></div><div class="stat"><small>PLAYER</small><strong style="font-size:17px">${esc(session.playerName)}</strong></div></div><p id="image-status" class="hint" role="status">Loading your puzzle… Timer starts when image is ready.</p><div class="game-layout"><section class="clay-panel"><div class="panel-heading"><h2>Your canvas</h2><span id="pieces-left" class="badge badge-peach">${size} left</span></div><div id="board" class="board" style="grid-template-columns:repeat(${config.grid},minmax(0,1fr));grid-template-rows:repeat(${config.grid},minmax(0,1fr))"></div><p id="game-hint" class="hint" aria-live="polite">Select a piece, then a board cell—or drag and drop.</p><div id="tray" class="piece-tray" aria-label="Unplaced puzzle pieces"></div><div class="actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button id="return-piece" class="quiet" style="flex:1;min-width:140px" disabled>Return selected piece</button><button id="submit-round" class="mint" style="flex:1;min-width:140px" disabled>Submit puzzle</button><button id="quit-instant" class="quiet" style="flex:0 0 auto">Quit</button></div></section></div></section>`;

    const valid = () => route() === "instant" && state.instantSession === session;
    function finish(timedOut) {
      if (!valid() || !session) return;
      const correct = C.correctCount(session);
      const completed = correct === size;
      const now = Date.now();
      const elapsed = Math.max(0, Math.min(now, session.endsAt) - session.startedAt);
      const moves = session.moves;
      let points = completed ? Math.max(15, 100 + (session.grid === 4 ? 25 : 0) - moves - Math.floor(elapsed / 5000)) : Math.max(1, Math.floor(correct * 5));
      const newEntry = {
        id: "pub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        name: session.playerName,
        avatar: getAvatarUrl(session.playerName, session.avatar),
        image: session.image,
        imageName: session.imageName,
        grid: session.grid,
        pieces: size,
        moves,
        timeMs: elapsed,
        points,
        completed,
        submittedAt: new Date(now).toISOString()
      };
      state.publicLeaderboard ||= [];
      state.publicLeaderboard.unshift(newEntry);
      state.instantSession = null;
      save();
      window.ConvexSync?.submitInstantResult({
        name: newEntry.name,
        avatar: newEntry.avatar,
        pieces: size,
        moves,
        timeMs: elapsed,
        completed,
        timedOut
      });
      if (completed) SoundFX.playSuccess();
      toast(timedOut ? "Time up! Result recorded on World Leaderboard." : "Puzzle completed! Recorded on World Leaderboard.");
      leaderboardTab = "public";
      routeTo("#leaderboard");
    }
    function tick() {
      if (!valid() || !session) return;
      const left = session.endsAt - Date.now();
      document.getElementById("timer").textContent = time(left);
      document.getElementById("timer").classList.toggle("error", left < 30000);
      if (left <= 0) finish(true);
    }
    function draw() {
      if (!valid()) return;
      const used = new Set(Object.values(session.placements));
      document.getElementById("board").innerHTML = Array.from({ length: size }, (_, cell) => {
        const id = session.placements[cell];
        const occupied = id !== undefined;
        return `<button class="board-cell ${occupied ? "occupied" : ""} ${occupied && id === selected ? "selected" : ""}" data-cell="${cell}" ${occupied ? `data-piece="${id}" draggable="true"` : ""} aria-label="Board cell ${cell + 1}, ${occupied ? `piece ${id + 1}` : "empty"}" ${imageReady ? "" : "disabled"}>${occupied ? pieceSVG(config, id, "inst-board") : ""}</button>`;
      }).join("");
      document.getElementById("tray").innerHTML = session.order.filter(id => !used.has(id)).map(id => `<button class="piece ${id === selected ? "selected" : ""}" data-piece="${id}" draggable="true" aria-label="Select piece ${id + 1}" aria-pressed="${id === selected}" ${imageReady ? "" : "disabled"}>${pieceSVG(config, id, "inst-tray")}</button>`).join("") || '<p class="hint">Every piece has a place. Ready to submit?</p>';
      document.getElementById("moves").textContent = session.moves;
      document.getElementById("placed").textContent = `${used.size} / ${size}`;
      document.getElementById("pieces-left").textContent = `${size - used.size} left`;
      document.getElementById("return-piece").disabled = !imageReady || selected === null || !used.has(selected);
      document.getElementById("submit-round").disabled = !imageReady || used.size !== size;
    }
    function move(id, cell) {
      if (!imageReady || !valid() || !session) return;
      if (Date.now() >= session.endsAt) { finish(true); return; }
      if (C.movePiece(session, size, id, cell)) {
        save();
        if (cell !== null) SoundFX.playPlace();
        else SoundFX.playReturn();
      }
      selected = null; draw();
    }
    document.getElementById("board").addEventListener("click", event => {
      if (!imageReady || !session) return;
      const cell = event.target.closest("[data-cell]"); if (!cell) return;
      if (Date.now() >= session.endsAt) { finish(true); return; }
      const id = cell.dataset.piece === undefined ? null : Number(cell.dataset.piece);
      if (selected !== null && selected !== id) move(selected, Number(cell.dataset.cell));
      else {
        selected = selected === id ? null : id;
        if (selected !== null) SoundFX.playPickup();
        draw();
      }
    });
    document.getElementById("tray").addEventListener("click", event => {
      if (!imageReady || !session) return;
      const piece = event.target.closest("[data-piece]"); if (!piece) return;
      const pid = Number(piece.dataset.piece);
      selected = selected === pid ? null : pid;
      if (selected !== null) SoundFX.playPickup();
      draw();
    });
    for (const region of [document.getElementById("board"), document.getElementById("tray")]) {
      region.addEventListener("dragstart", event => {
        const piece = event.target.closest("[data-piece]");
        if (!piece || !imageReady) { event.preventDefault(); return; }
        selected = Number(piece.dataset.piece); event.dataTransfer.setData("text/plain", String(selected)); event.dataTransfer.effectAllowed = "move";
        SoundFX.playPickup();
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
      if (!session || !imageReady) return;
      if (Date.now() >= session.endsAt) { finish(true); return; }
      const correct = C.correctCount(session);
      if (correct !== size) {
        SoundFX.playError();
        document.getElementById("game-hint").textContent = `${size - correct} pieces are in the wrong place. Keep going!`;
        return;
      }
      finish(false);
    });
    document.getElementById("quit-instant")?.addEventListener("click", () => {
      state.instantSession = null; save(); routeTo("#join");
    });
    if (session) { draw(); tick(); if (!valid()) return; activeTimer = setInterval(tick, 250); }
    const image = new Image();
    const onReady = () => {
      if (!valid() || imageReady) return;
      imageReady = true;
      document.getElementById("image-status").textContent = "Instant puzzle ready! Find your flow.";
      draw(); tick();
      if (valid() && !activeTimer) activeTimer = setInterval(tick, 250);
    };
    image.onload = onReady;
    image.onerror = () => {
      if (!valid()) return;
      document.getElementById("image-status").textContent = "Puzzle image could not load. Reload to try another image.";
      document.getElementById("image-status").classList.add("error");
    };
    image.src = config.image;
    if (image.complete) onReady();
  }
  function renderGame(round) {
    const r = room(), p = player();
    if (!p) { routeTo("#join"); return; }
    const next = C.nextRound(r, p.id);
    if (!next || round !== next) {
      if (next) { routeTo(`#play/${next}`); return; }
      viewingRound = "final"; routeTo(state.currentRoom ? `#leaderboard/${state.currentRoom}` : "#leaderboard"); return;
    }
    const config = r.rounds[round - 1], size = config.grid ** 2;
    imageReady = false;
    app.innerHTML = `<section class="page game-page"><header class="page-heading"><div><p class="eyebrow">THE PUZZLE CHALLENGE · ROOM ${esc(r.code)}</p><h1>Round ${round} <span class="muted">/ ${r.rounds.length}</span></h1><p class="subtitle">${esc(config.name)} · Find your flow. Make the picture whole.</p></div><span class="badge badge-mint">${config.grid} × ${config.grid} puzzle</span></header><div class="hud"><div class="stat"><small>TIME LEFT</small><strong id="timer">${time(config.seconds * 1000)}</strong></div><div class="stat"><small>MOVES</small><strong id="moves">0</strong></div><div class="stat"><small>PLACED</small><strong id="placed">0 / ${size}</strong></div><div class="stat"><small>PLAYER</small><strong style="font-size:17px">${esc(p.name)}</strong></div></div><p id="image-status" class="hint" role="status">Loading your puzzle… Timer starts when the image is ready.</p><div class="game-layout"><section class="clay-panel"><div class="panel-heading"><h2>Your canvas</h2><span id="pieces-left" class="badge badge-peach">${size} left</span></div><div id="board" class="board" style="grid-template-columns:repeat(${config.grid},minmax(0,1fr));grid-template-rows:repeat(${config.grid},minmax(0,1fr))"></div><p id="game-hint" class="hint" aria-live="polite">Select a piece, then a board cell—or drag and drop.</p><div id="tray" class="piece-tray" aria-label="Unplaced puzzle pieces"></div><div class="actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button id="return-piece" class="quiet" style="flex:1;min-width:140px" disabled>Return selected piece</button><button id="submit-round" class="mint" style="flex:1;min-width:140px" disabled>Submit round</button></div></section></div></section>`;
    const context = { code: r.code, playerId: p.id, round, config, session: r.sessions[p.id]?.[round] || null };
    playContext = context;
    const valid = () => playContext === context && route() === `play/${round}` && room().code === context.code && state.playerId === context.playerId;
    function finish(timedOut) {
      if (!valid() || !context.session || r.results[p.id]?.[round]) return;
      const result = C.submit(r, p.id, round); save(); viewingRound = C.nextRound(r, p.id) ? round : "final";
      window.ConvexSync?.submitResult(r.code, p.id, round, result);
      boardWaitUntil = r.leaderboardSeconds > 0 ? Date.now() + r.leaderboardSeconds * 1000 : null;
      toast(timedOut ? "Time is up. Your round result has been saved." : "Round submitted. Nicely done!");
      routeTo(state.currentRoom ? `#leaderboard/${state.currentRoom}` : "#leaderboard");
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
      if (C.movePiece(context.session, size, id, cell)) {
        save();
        if (cell !== null) SoundFX.playPlace();
        else SoundFX.playReturn();
      }
      selected = null; draw();
    }
    document.getElementById("board").addEventListener("click", event => {
      if (!imageReady || !context.session) return;
      const cell = event.target.closest("[data-cell]"); if (!cell) return;
      if (Date.now() >= context.session.endsAt) { finish(true); return; }
      const id = cell.dataset.piece === undefined ? null : Number(cell.dataset.piece);
      if (selected !== null && selected !== id) move(selected, Number(cell.dataset.cell));
      else {
        selected = selected === id ? null : id;
        if (selected !== null) SoundFX.playPickup();
        draw();
      }
    });
    document.getElementById("tray").addEventListener("click", event => {
      if (!imageReady || !context.session) return;
      const piece = event.target.closest("[data-piece]"); if (!piece) return;
      const pid = Number(piece.dataset.piece);
      selected = selected === pid ? null : pid;
      if (selected !== null) SoundFX.playPickup();
      draw();
    });
    for (const region of [document.getElementById("board"), document.getElementById("tray")]) {
      region.addEventListener("dragstart", event => {
        const piece = event.target.closest("[data-piece]");
        if (!piece || !imageReady) { event.preventDefault(); return; }
        selected = Number(piece.dataset.piece); event.dataTransfer.setData("text/plain", String(selected)); event.dataTransfer.effectAllowed = "move";
        SoundFX.playPickup();
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
      if (correct !== size) {
        SoundFX.playError();
        document.getElementById("game-hint").textContent = `${size - correct} pieces are in the wrong place. Keep going!`;
        return;
      }
      SoundFX.playSuccess();
      finish(false);
    });
    document.getElementById("leave-game")?.addEventListener("click", () => { save(); routeTo("#join"); });
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
      document.getElementById("image-status").textContent = "Puzzle image could not load. Check the image path in Studio, then reload. An existing round timer still continues.";
      document.getElementById("image-status").classList.add("error");
    };
    image.src = config.image;
  }
  function renderLeaderboard() {
    const urlCode = getLeaderboardRoomCode();
    if (urlCode && state.rooms[urlCode]) {
      state.currentRoom = urlCode;
      leaderboardTab = "room";
    } else {
      leaderboardTab = "public";
    }
    const r = room(), p = player();

    if (leaderboardTab === "public") {
      const entries = [];
      (state.publicLeaderboard || []).forEach(row => {
        const pieceCount = Number(row.pieces) || (row.grid ? Number(row.grid) ** 2 : 16);
        entries.push({
          name: row.name || "Player",
          avatar: row.avatar || "assets/avatars/mint.svg",
          title: "Instant Play",
          isInstant: true,
          pieces: pieceCount,
          moves: Number(row.moves) || 0,
          timeMs: Number(row.timeMs) || 0,
          points: Number(row.points) || 0,
          completed: row.completed !== false,
          isMe: Boolean(row.name && row.name === state.instantPlayerName)
        });
      });

      Object.values(state.rooms || {}).forEach(roomObj => {
        if (!roomObj || !roomObj.players || !roomObj.results) return;
        const finalRows = C.finalLeaderboard(roomObj);
        finalRows.forEach(row => {
          if (row.submitted > 0) {
            let playerPieces = 0;
            (roomObj.rounds || []).forEach((rd, rIdx) => {
              const res = roomObj.results[row.id]?.[rIdx + 1];
              if (res) {
                playerPieces += Number(res.total || (rd.grid ? rd.grid ** 2 : 16));
              }
            });
            entries.push({
              name: row.name || "Player",
              avatar: row.avatar || "assets/avatars/mint.svg",
              title: roomObj.title || "Jigsaw Arena",
              isInstant: false,
              pieces: playerPieces,
              moves: Number(row.moves) || 0,
              timeMs: Number(row.timeMs) || 0,
              points: Number(row.points) || 0,
              completed: true,
              isMe: Boolean(row.id === state.playerId || (p && row.id === p.id))
            });
          }
        });
      });

      entries.sort((a, b) => (Number(b.completed) - Number(a.completed)) || (b.points - a.points) || (a.moves - b.moves) || (a.timeMs - b.timeMs) || a.name.localeCompare(b.name));
      entries.forEach((row, idx) => { row.rank = idx + 1; });

      app.innerHTML = `
        <section class="page">
          <header class="page-heading">
            <div>
              <p class="eyebrow">GLOBAL COMPETITION</p>
              <h1>World Leaderboard</h1>
              <p class="subtitle">Global competition across Instant Play and Tournaments. Every little move counts.</p>
            </div>
            <span class="badge badge-peach">${entries.length} ${entries.length === 1 ? "player" : "players"} on leaderboard</span>
          </header>
          <div class="actions" style="margin-top:0;margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap">
            <button id="btn-play-instant" class="mint" type="button">⚡ Play Instant Puzzle</button>
            <button id="download-pdf" class="quiet" type="button">Download PDF</button>
          </div>
          <div class="leaderboard-cards" role="list">
            ${entries.length ? entries.map(row => `
              <div class="lb-card ${row.isMe ? "me" : ""} ${row.rank === 1 ? "rank-gold" : row.rank === 2 ? "rank-silver" : row.rank === 3 ? "rank-bronze" : ""}" role="listitem">
                <div class="lb-rank">
                  <span class="rank-badge">${row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}</span>
                </div>
                <div class="lb-player">
                  <img class="avatar" src="${esc(getAvatarUrl(row.name, row.avatar))}" alt="${esc(row.name)}" onerror="this.onerror=null;this.src='assets/avatars/mint.svg'">
                  <div class="lb-player-info">
                    <div class="lb-player-name">
                      <span>${esc(row.name)}</span>
                      ${row.isMe ? '<span class="badge badge-mint badge-mini">You</span>' : ""}
                    </div>
                    <div class="lb-player-meta">
                      <span class="badge ${row.isInstant ? 'badge-mint' : 'badge-lavender'}" style="font-size:10px;padding:2px 8px;font-weight:750">${esc(row.title)}</span>
                    </div>
                  </div>
                </div>
                <div class="lb-stats">
                  <div class="lb-stat-chip"><small>PIECES</small><strong>${row.pieces}</strong></div>
                  <div class="lb-stat-chip"><small>MOVES</small><strong>${row.moves}</strong></div>
                  <div class="lb-stat-chip"><small>TIME</small><strong>${time(row.timeMs)}</strong></div>
                </div>
                <div class="lb-points">
                  <small>POINTS</small><strong class="points-val">${row.points}</strong>
                </div>
              </div>
            `).join("") : `
              <div class="empty-board">
                <p class="hint">No games recorded on the world leaderboard yet.<br><small>Complete a quick puzzle or tournament round to claim the first spot!</small></p>
                <div style="margin-top:16px"><button id="btn-empty-play" class="mint" type="button">Start Instant Play ⚡</button></div>
              </div>
            `}
          </div>
          <p class="hint">World ranking: completed first → higher points (based on fewer moves and faster time). Play anytime with Instant Play or join a tournament!</p>
        </section>
      `;

      document.getElementById("btn-play-instant")?.addEventListener("click", () => {
        if (state.instantPlayerName) startInstantGame(state.instantPlayerName);
        else routeTo("#join");
      });
      document.getElementById("btn-empty-play")?.addEventListener("click", () => {
        if (state.instantPlayerName) startInstantGame(state.instantPlayerName);
        else routeTo("#join");
      });
      document.getElementById("download-pdf")?.addEventListener("click", () => window.print());
      return;
    }

    if (!r) {
      app.innerHTML = `
        <section class="page">
          <header class="page-heading">
            <div>
              <p class="eyebrow">TOURNAMENT STANDINGS</p>
              <h1>Tournament Leaderboard</h1>
              <p class="subtitle">${urlCode ? "Tournament not found." : "No tournament selected."}</p>
            </div>
          </header>
          <div class="clay-panel" style="text-align:center;padding:48px 24px">
            <p class="hint">${urlCode ? "Tournament could not be found. Check the code or join a tournament room." : "No tournament room selected. You can join a tournament room or play Instant Play without a room."}</p>
            <div class="actions" style="justify-content:center;gap:12px">
              <button id="switch-player">Join room</button>
              <button id="btn-play-instant-no-room" class="mint">Play Instant Puzzle ⚡</button>
              <button id="btn-goto-world-from-empty" class="lavender" style="font-weight:750">🌍 World Leaderboard</button>
            </div>
          </div>
        </section>
      `;
      document.getElementById("switch-player")?.addEventListener("click", () => routeTo("#join"));
      document.getElementById("btn-play-instant-no-room")?.addEventListener("click", () => {
        if (state.instantPlayerName) startInstantGame(state.instantPlayerName);
        else routeTo("#join");
      });
      document.getElementById("btn-goto-world-from-empty")?.addEventListener("click", () => routeTo("#leaderboard"));
      return;
    }

    if (viewingRound !== "final" && (!Number.isInteger(viewingRound) || viewingRound < 1 || viewingRound > r.rounds.length)) viewingRound = 1;
    const final = viewingRound === "final";
    const allRows = final ? C.finalLeaderboard(r) : C.roundLeaderboard(r, viewingRound);
    const rows = allRows.filter(row => row.rank !== null && row.rank !== undefined);
    const next = p ? C.nextRound(r, p.id) : null;
    app.innerHTML = `<section class="page"><header class="page-heading"><div><p class="eyebrow">TOURNAMENT STANDINGS</p><h1>${final ? "Final leaderboard" : `Round ${viewingRound} leaderboard`}</h1><p class="subtitle">${esc(r.title)} · Every little move counts.</p></div><span class="badge badge-peach">${rows.length} ${rows.length === 1 ? "player" : "players"} on leaderboard</span></header><div class="actions" style="margin-top:16px;margin-bottom:8px">${p && next ? `<button id="next-round" class="mint">${r.sessions[p.id]?.[next] ? "Resume" : "Start"} round ${next} →</button>` : p && !next ? '<span class="badge badge-mint">All your rounds are complete ✓</span>' : ""}<button id="btn-goto-world" class="lavender" type="button" style="font-weight:750">🌍 World Leaderboard →</button><button id="copy-leaderboard-url" class="quiet" type="button">🔗 Copy Leaderboard URL</button><button id="download-pdf" class="quiet" type="button">Download PDF</button></div><p id="next-countdown" class="hint" aria-live="polite"></p><div class="tabs" aria-label="Leaderboard round">${r.rounds.map((_, i) => `<button data-round="${i + 1}" class="${viewingRound === i + 1 ? "active" : ""}">Round ${i + 1}</button>`).join("")}<button data-round="final" class="${final ? "active" : ""}">Final standings</button></div><div class="leaderboard-cards" role="list">${rows.length ? rows.map(row => `<div class="lb-card ${row.id === state.playerId ? "me" : ""} ${row.rank === 1 ? "rank-gold" : row.rank === 2 ? "rank-silver" : row.rank === 3 ? "rank-bronze" : ""}" role="listitem"><div class="lb-rank"><span class="rank-badge">${row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}</span></div><div class="lb-player">${avatar(row)}<div class="lb-player-info"><div class="lb-player-name"><span>${esc(row.name)}</span>${row.id === state.playerId ? '<span class="badge badge-mint badge-mini">You</span>' : ""}</div><div class="lb-player-meta"><span class="status-tag">${final ? `${row.submitted} / ${r.rounds.length} rounds` : row.completed ? "Complete ✓" : row.timedOut ? `Time up · ${row.correct}/${row.total} placed` : "Incomplete"}</span></div></div></div><div class="lb-stats"><div class="lb-stat-chip"><small>MOVES</small><strong>${row.moves}</strong></div><div class="lb-stat-chip"><small>TIME</small><strong>${time(row.timeMs)}</strong></div></div><div class="lb-points"><small>POINTS</small><strong class="points-val">${row.points}</strong></div></div>`).join("") : '<div class="empty-board"><p class="hint">No players have submitted results for this round yet.<br><small>Complete this round to be the first on the board!</small></p></div>'}</div><p class="hint">Round ranking: completed first → fewer moves → faster time. Points start at 50 and decrease by rank (minimum 1). Final ranking uses total points, then total moves and time.</p></section>`;
    app.querySelectorAll("[data-round]").forEach(button => button.addEventListener("click", () => { viewingRound = button.dataset.round === "final" ? "final" : Number(button.dataset.round); render(); }));
    document.getElementById("btn-goto-world")?.addEventListener("click", () => routeTo("#leaderboard"));
    document.getElementById("copy-leaderboard-url")?.addEventListener("click", async event => {
      const btn = event.currentTarget;
      const shareUrl = getLeaderboardShareUrl(r.code);
      try {
        await navigator.clipboard.writeText(shareUrl);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> Copied Leaderboard Link!`;
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2200);
        toast("Leaderboard link copied!");
      } catch (_) {
        prompt("Copy this leaderboard URL:", shareUrl);
      }
    });
    document.getElementById("download-pdf")?.addEventListener("click", () => window.print());
    document.getElementById("next-round")?.addEventListener("click", () => { boardWaitUntil = null; routeTo(`#play/${next}`); });
    if (p && next && boardWaitUntil && viewingRound !== "final") {
      const update = () => {
        const remaining = boardWaitUntil - Date.now();
        if (remaining <= 0) { boardWaitUntil = null; routeTo(`#play/${next}`); return; }
        document.getElementById("next-countdown").textContent = `Next round starts in ${time(remaining)}. You can also start now.`;
      };
      update(); if (route().startsWith("leaderboard")) activeTimer = setInterval(update, 500);
    }
  }
  function renderStudio() {
    const studioCode = getStudioRoomCode();
    let r = studioCode ? state.rooms[studioCode] : null;

    if (!r) {
      app.innerHTML = `
        <section class="page centered-card">
          <div class="illustration" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
          <p class="eyebrow">HOST & MANAGE</p>
          <h1>Tournament Studio</h1>
          <p class="subtitle">Enter your 6-digit room code to manage your tournament, or create a brand new one.</p>

          <form id="studio-gateway-form" class="join-form" style="max-width:440px;margin:16px auto 0">
            <label class="pin-code-label" style="text-align:center">6-digit room code</label>
            <div class="pin-code-group" id="studio-pin-group" role="group" aria-label="Enter 6-digit room code">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" data-index="0" value="${studioCode[0] || ''}">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="1" value="${studioCode[1] || ''}">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="2" value="${studioCode[2] || ''}">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="3" value="${studioCode[3] || ''}">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="4" value="${studioCode[4] || ''}">
              <input class="pin-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="off" data-index="5" value="${studioCode[5] || ''}">
            </div>
            <input id="studio-gateway-code" type="hidden" name="code" value="${esc(studioCode)}">
            <button id="studio-enter-btn" type="submit" class="full mint" style="font-weight:800;font-size:15px;margin-top:16px" ${studioCode.length === 6 ? "" : "disabled"}>
              Open Tournament Studio →
            </button>
            <p id="studio-gateway-error" role="alert" class="error" style="text-align:center;margin-top:10px">${studioCode ? `Tournament room ${esc(studioCode)} was not found. Please enter a valid code or create a new tournament below.` : ""}</p>
          </form>

          <div class="or-divider"><span>or create new tournament</span></div>

          <div class="create-tournament-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
              <div style="flex:1 1 200px;text-align:left">
                <span class="badge badge-lavender" style="font-size:10px;margin-bottom:6px">HOST A TOURNAMENT</span>
                <h3 style="font-size:16px;margin:2px 0 4px;font-weight:800;color:var(--ink)">Create New Tournament</h3>
                <p class="subtitle" style="margin:0;font-size:12px;line-height:1.45">Generate a 6-digit room code, setup rounds, and invite players.</p>
              </div>
              <button id="btn-studio-gateway-create" type="button" class="lavender" style="font-weight:800;padding:11px 20px;display:inline-flex;align-items:center;gap:6px">
                <span>🏆</span> Create Tournament
              </button>
            </div>
          </div>
        </section>
      `;

      const pinGroup = document.getElementById("studio-pin-group");
      const pinDigits = Array.from(pinGroup ? pinGroup.querySelectorAll(".pin-digit") : []);
      const codeInput = document.getElementById("studio-gateway-code");
      const enterBtn = document.getElementById("studio-enter-btn");
      const errorEl = document.getElementById("studio-gateway-error");

      function getCode() {
        return pinDigits.map(d => d.value.trim()).join("");
      }
      function updateCode(codeStr) {
        const clean = String(codeStr || "").replace(/\D/g, "").slice(0, 6);
        pinDigits.forEach((d, i) => { d.value = clean[i] || ""; });
        codeInput.value = clean;
        onCodeChange();
      }
      function onCodeChange() {
        if (errorEl) errorEl.textContent = "";
        const val = getCode();
        codeInput.value = val;
        if (enterBtn) enterBtn.disabled = val.length !== 6;
      }

      pinDigits.forEach((digit, index) => {
        digit.addEventListener("input", event => {
          const val = event.target.value.replace(/\D/g, "");
          if (val.length > 1) {
            updateCode(getCode().slice(0, index) + val + getCode().slice(index + 1));
            const nextIdx = Math.min(5, index + val.length);
            pinDigits[nextIdx]?.focus();
            return;
          }
          event.target.value = val;
          if (val && index < 5) {
            pinDigits[index + 1].focus();
          }
          onCodeChange();
        });
        digit.addEventListener("keydown", event => {
          if (event.key === "Backspace") {
            if (!event.target.value && index > 0) {
              pinDigits[index - 1].value = "";
              pinDigits[index - 1].focus();
              event.preventDefault();
              onCodeChange();
            }
          } else if (event.key === "ArrowLeft" && index > 0) {
            pinDigits[index - 1].focus();
          } else if (event.key === "ArrowRight" && index < 5) {
            pinDigits[index + 1].focus();
          }
        });
        digit.addEventListener("paste", event => {
          event.preventDefault();
          const text = (event.clipboardData || window.clipboardData)?.getData("text") || "";
          const clean = text.replace(/\D/g, "").slice(0, 6);
          if (clean) {
            updateCode(clean);
            const nextIdx = Math.min(5, clean.length - 1);
            pinDigits[nextIdx]?.focus();
          }
        });
        digit.addEventListener("focus", () => digit.select());
      });

      document.getElementById("studio-gateway-form")?.addEventListener("submit", event => {
        event.preventDefault();
        const code = getCode();
        if (!code || code.length !== 6 || !C.validCode(code)) {
          if (errorEl) errorEl.textContent = "Please enter all 6 digits of the room code.";
          return;
        }
        if (state.rooms[code]) {
          state.currentRoom = code;
          state.playerId = null;
          save();
          syncConvex();
          routeTo(`#studio/${code}`);
        } else {
          if (errorEl) errorEl.textContent = `Tournament room ${code} not found. Check code or create a new tournament below.`;
        }
      });

      document.getElementById("btn-studio-gateway-create")?.addEventListener("click", () => {
        const code = generateUniqueRoomCode();
        state.rooms[code] = createNewTournamentRoom(code);
        state.currentRoom = code;
        state.playerId = null;
        viewingRound = 1;
        boardWaitUntil = null;
        wizardStep = 1;
        wizardRound = 0;
        wizardDraft = C.clone(state.rooms[code].rounds);
        wizardRoomCode = code;
        save();
        routeTo(`#studio/${code}`);
        toast("🏆 Tournament setup started! Complete rounds and launch.");
      });

      return;
    }

    state.currentRoom = r.code;

    // --- WIZARD MODE FOR UNLAUNCHED DRAFTS ---
    if (r.launched === false) {
      if (!wizardDraft || wizardRoomCode !== r.code) {
        wizardDraft = C.clone(r.rounds);
        wizardRoomCode = r.code;
        wizardStep = 1;
        wizardRound = 0;
      }

      const draftAge = Date.now() - new Date(r.draftCreatedAt || r.createdAt || 0).getTime();
      const msLeft = Math.max(0, 24 * 60 * 60 * 1000 - draftAge);
      const hrsLeft = Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));

      const draftBannerHtml = `
        <div class="draft-banner">
          <span style="font-size:18px">⏳</span>
          <div style="flex:1">
            <strong>Draft Tournament (Unpublished):</strong> Rounds and settings are not saved to the cloud database until you click <strong>Launch Tournament</strong>.
            <span style="display:block;margin-top:2px;font-size:11.5px;color:#a06a25">Unlaunched drafts are automatically deleted after <strong>${hrsLeft} hours</strong>.</span>
          </div>
        </div>
      `;

      const playerCount = Math.max(1, Math.min(200, r.players?.length || 10));
      const isAutoRoster = !r.players || r.players.length === 0 || r.players.every((p, idx) => p.name.trim().toLowerCase() === `player ${idx + 1}`);
      const customPlayers = (r.players || []).filter(p => !/^player\s+\d+$/i.test(p.name.trim()));
      const rosterVal = isAutoRoster ? "" : (customPlayers.length > 0 ? customPlayers.map(p => p.name).join(", ") : (r.players || []).map(p => p.name).join(", "));

      if (wizardStep === 1) {
        app.innerHTML = `
          <section class="page">
            <header class="page-heading">
              <div>
                <p class="eyebrow">TOURNAMENT SETUP WIZARD</p>
                <h1>Tournament Setup</h1>
                <p class="subtitle">Room Code: <strong style="font-family:monospace;letter-spacing:2px;color:var(--ink)">${esc(r.code)}</strong> · Configure details then proceed to rounds</p>
              </div>
              <div style="display:flex;gap:8px">
                <button id="wizard-discard-btn" type="button" class="quiet danger" style="font-size:12px;padding:8px 14px">Discard Draft</button>
                <a href="#studio" class="btn-clay" style="text-decoration:none;font-size:12px;padding:8px 14px">← Studio Gateway</a>
              </div>
            </header>

            ${draftBannerHtml}

            <div class="clay-panel" style="max-width:760px;margin:0 auto">
              <div class="wizard-stepper">
                <span class="wizard-step-pill"><span class="wizard-step-badge">Step 1 of 2</span> General Settings</span>
              </div>

              <form id="wizard-step1-form">
                <label for="tournament-title">Tournament title</label>
                <input id="tournament-title" name="title" maxlength="100" value="${esc(r.title)}" required>

                <label for="leaderboard-seconds">Between-round leaderboard (seconds)</label>
                <input id="leaderboard-seconds" type="number" name="leaderboardSeconds" min="0" max="600" value="${r.leaderboardSeconds}" required>
                <p class="hint">0 = manual Next round. Otherwise, the next round starts automatically after this interval.</p>

                <div class="clay-slider-group">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
                    <label for="player-count-slider" style="margin:0;font-size:13px;font-weight:750">How many players (Max 200)</label>
                    <div>
                      <input id="player-count-input" name="playerCount" type="number" min="1" max="200" value="${playerCount}" class="clay-num-input" aria-label="Player count number">
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:14px">
                    <input id="player-count-slider" type="range" min="1" max="200" value="${playerCount}" class="clay-range" aria-label="Player count slider">
                    <span class="hint" style="font-size:12px;white-space:nowrap;font-weight:750;min-width:75px;text-align:right" id="player-count-display">${playerCount} players</span>
                  </div>
                </div>

                <label for="roster">Player names · comma separated <span style="font-weight:500;color:var(--muted)">(optional)</span></label>
                <textarea id="roster" name="roster" rows="4" maxlength="10000" placeholder="Optional: Ujjwal, Aarav, Ananya... (Leave empty for auto-generated player slots)">${esc(rosterVal)}</textarea>
                <p class="hint">Optional. Leave empty to auto-generate slots up to the player count above, or enter custom names separated by commas.</p>

                <label for="round-count">Number of rounds (1–10)</label>
                <input id="round-count" name="roundCount" type="number" min="1" max="10" value="${wizardDraft.length}">
                <p class="hint">Choose how many rounds players will compete in (1 to 10 rounds).</p>

                <div class="wizard-actions">
                  <a href="#studio" class="btn-clay" style="text-decoration:none;font-size:13px;padding:11px 18px">Cancel</a>
                  <button type="submit" id="btn-step1-next" class="btn-clay btn-clay-mint" style="font-weight:800;font-size:14px;padding:11px 22px">
                    Next: Configure Rounds →
                  </button>
                </div>
                <p id="wizard-step1-error" class="error" role="alert" style="margin-top:12px"></p>
              </form>
            </div>
          </section>
        `;

        const countSlider = document.getElementById("player-count-slider");
        const countInput = document.getElementById("player-count-input");
        const countDisplay = document.getElementById("player-count-display");
        const rosterInput = document.getElementById("roster");

        function syncPlayerCount(val) {
          let num = parseInt(val, 10);
          if (isNaN(num)) num = 1;
          num = Math.max(1, Math.min(200, num));
          if (countSlider) countSlider.value = num;
          if (countInput) countInput.value = num;
          if (countDisplay) countDisplay.textContent = `${num} ${num === 1 ? "player" : "players"}`;
        }
        countSlider?.addEventListener("input", e => syncPlayerCount(e.target.value));
        countInput?.addEventListener("input", e => syncPlayerCount(e.target.value));
        countInput?.addEventListener("blur", () => {
          if (!countInput.value || Number(countInput.value) < 1) syncPlayerCount(1);
          else if (Number(countInput.value) > 200) syncPlayerCount(200);
        });
        rosterInput?.addEventListener("input", () => {
          const parsed = rosterInput.value.split(/[,\r\n]+/).map(n => n.trim()).filter(Boolean);
          if (parsed.length > Number(countSlider?.value || 0)) {
            syncPlayerCount(Math.min(200, parsed.length));
          }
        });

        document.getElementById("wizard-discard-btn")?.addEventListener("click", () => {
          if (!confirm(`Discard this unlaunched tournament ${r.code}? All progress will be lost.`)) return;
          delete state.rooms[r.code];
          const remaining = Object.keys(state.rooms);
          state.currentRoom = remaining[0] || null;
          wizardDraft = null; wizardRoomCode = null;
          save();
          routeTo("#studio");
          toast("Draft discarded.");
        });

        document.getElementById("wizard-step1-form")?.addEventListener("submit", event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const error = document.getElementById("wizard-step1-error");
          error.textContent = "";
          const title = form.get("title").trim(), wait = Number(form.get("leaderboardSeconds"));
          if (!title || !Number.isInteger(wait) || wait < 0 || wait > 600) {
            error.textContent = "Enter a title and a valid leaderboard duration (0–600 seconds).";
            return;
          }
          const rawRoster = form.get("roster") || "";
          const names = rawRoster.split(/[,\r\n]+/).map(name => name.trim()).filter(Boolean);
          if (names.length > 200) { error.textContent = "Maximum 200 player names allowed."; return; }
          if (names.some(name => name.length > 80)) { error.textContent = "Each player name must be 80 characters or fewer."; return; }
          if (names.length > 0 && new Set(names.map(name => name.toLowerCase())).size !== names.length) {
            error.textContent = "Player names must be unique."; return;
          }

          let targetCount = Number(countInput?.value || countSlider?.value || names.length || 10);
          if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 200) {
            targetCount = Math.max(1, Math.min(200, names.length || 10));
          }
          if (names.length > targetCount) targetCount = Math.min(200, names.length);
          const finalNames = [...names];
          if (finalNames.length < targetCount) {
            const existingLower = new Set(finalNames.map(n => n.toLowerCase()));
            let pNum = 1;
            while (finalNames.length < targetCount) {
              while (existingLower.has(`player ${pNum}`.toLowerCase())) { pNum++; }
              const fallback = `Player ${pNum}`;
              existingLower.add(fallback.toLowerCase());
              finalNames.push(fallback);
              pNum++;
            }
          }

          const targetRounds = Number(form.get("roundCount") || 5);
          if (!Number.isInteger(targetRounds) || targetRounds < 1 || targetRounds > 10) {
            error.textContent = "Number of rounds must be between 1 and 10.";
            return;
          }

          while (wizardDraft.length < targetRounds) {
            wizardDraft.push(C.clone(defaults.rounds[wizardDraft.length % defaults.rounds.length]));
          }
          wizardDraft = wizardDraft.slice(0, targetRounds);

          const previous = new Map(r.players.map(p => [p.name.toLowerCase(), p]));
          r.players = finalNames.map((name, i) => {
            const existing = previous.get(name.toLowerCase());
            return { ...(existing || { id: `player-${Date.now()}-${i}` }), name, avatar: getAvatarUrl(name, existing?.avatar) };
          });
          r.title = title;
          r.leaderboardSeconds = wait;
          save();

          wizardStep = 2;
          wizardRound = 0;
          renderStudio();
        });

        return;
      }

      // Step 2: Round by round configuration
      if (wizardRound >= wizardDraft.length) wizardRound = wizardDraft.length - 1;
      if (wizardRound < 0) wizardRound = 0;
      const currRound = wizardDraft[wizardRound];

      app.innerHTML = `
        <section class="page">
          <header class="page-heading">
            <div>
              <p class="eyebrow">TOURNAMENT SETUP WIZARD</p>
              <h1>Configure Rounds</h1>
              <p class="subtitle">Room Code: <strong style="font-family:monospace;letter-spacing:2px;color:var(--ink)">${esc(r.code)}</strong> · Setup each round one by one</p>
            </div>
            <div style="display:flex;gap:8px">
              <button id="wizard-discard-btn" type="button" class="quiet danger" style="font-size:12px;padding:8px 14px">Discard Draft</button>
              <a href="#studio" class="btn-clay" style="text-decoration:none;font-size:12px;padding:8px 14px">← Studio Gateway</a>
            </div>
          </header>

          ${draftBannerHtml}

          <div class="clay-panel" style="max-width:760px;margin:0 auto">
            <div class="wizard-stepper">
              <span class="wizard-step-pill"><span class="wizard-step-badge">Step 2 of 2</span> Round Configuration</span>
            </div>

            <div class="round-nav-chips">
              ${wizardDraft.map((cfg, i) => `
                <button type="button" class="round-chip ${i === wizardRound ? "active" : ""} ${cfg.name && cfg.image ? "configured" : ""}" data-wizard-round-tab="${i}">
                  Round ${i + 1}${cfg.name ? ` · ${esc(cfg.name)}` : ""}
                </button>
              `).join("")}
            </div>

            <form id="wizard-round-form">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <h3 style="font-size:17px;margin:0;color:var(--ink);font-weight:800">Round ${wizardRound + 1} of ${wizardDraft.length}</h3>
                <span class="badge badge-lavender" style="font-size:11px">Round ${wizardRound + 1}</span>
              </div>

              <div class="round-config" style="margin-bottom:0">
                <div>
                  <label for="wizard-round-name">Round ${wizardRound + 1} · Name</label>
                  <input id="wizard-round-name" data-field="name" maxlength="80" value="${esc(currRound.name)}" required>
                </div>
                <div>
                  <label for="wizard-round-grid">Grid Size</label>
                  <select id="wizard-round-grid" data-field="grid">
                    ${[2, 3, 4, 5, 6, 7, 8].map(g => `<option value="${g}" ${g === currRound.grid ? "selected" : ""}>${g} × ${g} (${g * g} pieces)</option>`).join("")}
                  </select>
                </div>
                <div>
                  <label for="wizard-round-time">Time Limit (seconds)</label>
                  <input id="wizard-round-time" data-field="seconds" type="number" min="10" max="7200" value="${currRound.seconds}" required>
                </div>
                <div class="wide">
                  <p class="hint" style="margin-bottom:8px">Round ${wizardRound + 1} picture</p>
                  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
                    <button type="button" id="wizard-round-image-btn" class="btn-clay" aria-haspopup="dialog" style="padding:9px 18px;font-size:13px">
                      🖼 Select Image
                    </button>
                    <span class="hint" style="font-size:12px">Images are cropped square</span>
                  </div>
                  <img class="reference" id="round-preview-img" src="${esc(currRound.image)}" alt="Round ${wizardRound + 1} image preview" style="max-height:180px;border-radius:16px;border:1px solid #e7deef;margin-top:12px">
                </div>
              </div>

              <div class="wizard-actions">
                ${wizardRound === 0 ? `
                  <button type="button" id="btn-round-back-step1" class="quiet" style="padding:11px 18px">
                    ← Edit General Settings
                  </button>
                ` : `
                  <button type="button" id="btn-round-prev" class="quiet" style="padding:11px 18px">
                    ← Previous Round (${wizardRound})
                  </button>
                `}

                ${wizardRound < wizardDraft.length - 1 ? `
                  <button type="button" id="btn-round-next" class="btn-clay" style="font-weight:800;padding:11px 22px">
                    Next: Round ${wizardRound + 2} →
                  </button>
                ` : `
                  <button type="button" id="btn-wizard-launch" class="btn-launch">
                    🚀 Launch Tournament
                  </button>
                `}
              </div>
              <p id="wizard-round-error" class="error" role="alert" style="margin-top:12px"></p>
            </form>
          </div>
        </section>
      `;

      const gallery = document.createElement("dialog");
      gallery.className = "image-gallery";
      gallery.setAttribute("aria-labelledby", "gallery-title");
      app.append(gallery);

      document.getElementById("wizard-round-image-btn")?.addEventListener("click", () => {
        const images = [...new Map([...(window.OFFLINE_GALLERY || []), ...defaults.rounds, ...wizardDraft].map(config => [config.image, config])).values()];
        gallery.innerHTML = `
          <header class="panel-heading">
            <div>
              <p class="eyebrow">PICTURE PLAYGROUND</p>
              <h2 id="gallery-title">Select image · Round ${wizardRound + 1}</h2>
            </div>
            <button type="button" data-close-gallery aria-label="Close image gallery" class="quiet">✕</button>
          </header>
          <p class="hint">Choose a picture for this round from the offline gallery.</p>
          <div class="gallery-grid">
            ${images.map((config, i) => `
              <button type="button" class="gallery-card ${config.image === currRound.image ? "selected" : ""}" data-gallery-index="${i}" aria-pressed="${config.image === currRound.image}">
                <img src="${esc(config.image)}" alt="${esc(config.name)}">
                <span>${esc(config.name)}</span>
                ${config.image === currRound.image ? '<small>Selected ✓</small>' : ""}
              </button>
            `).join("")}
          </div>
        `;
        gallery.querySelector("[data-close-gallery]")?.addEventListener("click", () => gallery.close());
        gallery.querySelectorAll("[data-gallery-index]").forEach(card => card.addEventListener("click", () => {
          const config = images[Number(card.dataset.galleryIndex)];
          currRound.image = config.image;
          const previewImg = document.getElementById("round-preview-img");
          if (previewImg) previewImg.src = config.image;
          gallery.close();
          toast("Image selected for Round " + (wizardRound + 1));
        }));
        gallery.showModal();
      });

      gallery.addEventListener("click", event => {
        if (event.target !== gallery) return;
        const rect = gallery.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) gallery.close();
      });

      function saveActiveRoundFields() {
        const nameVal = document.getElementById("wizard-round-name")?.value.trim();
        const gridVal = Number(document.getElementById("wizard-round-grid")?.value);
        const timeVal = Number(document.getElementById("wizard-round-time")?.value);
        if (nameVal) currRound.name = nameVal;
        if (gridVal) currRound.grid = gridVal;
        if (timeVal) currRound.seconds = timeVal;
      }

      document.getElementById("wizard-round-name")?.addEventListener("input", e => { currRound.name = e.target.value; });
      document.getElementById("wizard-round-grid")?.addEventListener("change", e => { currRound.grid = Number(e.target.value); });
      document.getElementById("wizard-round-time")?.addEventListener("input", e => { currRound.seconds = Number(e.target.value); });

      function validateCurrentRound() {
        saveActiveRoundFields();
        const errEl = document.getElementById("wizard-round-error");
        if (!currRound.name || !currRound.name.trim()) {
          if (errEl) errEl.textContent = "Please enter a name for Round " + (wizardRound + 1);
          return false;
        }
        if (!Number.isInteger(currRound.seconds) || currRound.seconds < 10 || currRound.seconds > 7200) {
          if (errEl) errEl.textContent = "Time limit must be between 10 and 7200 seconds.";
          return false;
        }
        if (!currRound.image) {
          if (errEl) errEl.textContent = "Please select an image for Round " + (wizardRound + 1);
          return false;
        }
        if (errEl) errEl.textContent = "";
        return true;
      }

      document.querySelectorAll("[data-wizard-round-tab]").forEach(tab => {
        tab.addEventListener("click", () => {
          if (!validateCurrentRound()) return;
          wizardRound = Number(tab.dataset.wizardRoundTab);
          renderStudio();
        });
      });

      document.getElementById("btn-round-back-step1")?.addEventListener("click", () => {
        saveActiveRoundFields();
        wizardStep = 1;
        renderStudio();
      });

      document.getElementById("btn-round-prev")?.addEventListener("click", () => {
        saveActiveRoundFields();
        wizardRound--;
        renderStudio();
      });

      document.getElementById("btn-round-next")?.addEventListener("click", () => {
        if (!validateCurrentRound()) return;
        wizardRound++;
        renderStudio();
      });

      document.getElementById("wizard-discard-btn")?.addEventListener("click", () => {
        if (!confirm(`Discard this unlaunched tournament ${r.code}? All progress will be lost.`)) return;
        delete state.rooms[r.code];
        const remaining = Object.keys(state.rooms);
        state.currentRoom = remaining[0] || null;
        wizardDraft = null; wizardRoomCode = null;
        save();
        routeTo("#studio");
        toast("Draft discarded.");
      });

      document.getElementById("btn-wizard-launch")?.addEventListener("click", () => {
        if (!validateCurrentRound()) return;
        for (let i = 0; i < wizardDraft.length; i++) {
          const rd = wizardDraft[i];
          if (!rd.name || !rd.name.trim() || !Number.isInteger(rd.seconds) || rd.seconds < 10 || rd.seconds > 7200 || !rd.image) {
            wizardRound = i;
            renderStudio();
            const errEl = document.getElementById("wizard-round-error");
            if (errEl) errEl.textContent = `Please complete configuration for Round ${i + 1} before launching.`;
            return;
          }
        }

        r.rounds = C.clone(wizardDraft);
        r.launched = true;
        r.status = "active";
        r.launchedAt = new Date().toISOString();
        r.results = {};
        r.sessions = {};
        save();
        SoundFX.playLaunch();
        syncConvex();
        window.ConvexSync?.updateRoomSettings(r);
        wizardDraft = null;
        wizardRoomCode = null;
        toast("🚀 Tournament launched! Saved to database and live for players.");
        renderStudio();
      });

      return;
    }

    // --- ACTIVE LAUNCHED TOURNAMENT VIEW ---
    const locked = Object.values(r.results).some(rounds => Object.keys(rounds).length) || Object.values(r.sessions).some(rounds => Object.keys(rounds).length);
    const isAutoRoster = !r.players || r.players.length === 0 || r.players.every((p, idx) => p.name.trim().toLowerCase() === `player ${idx + 1}`);
    const isDefaultDemoRoster = !locked && r.players && r.players.length === defaults.players.length && r.players.every((p, idx) => p.name === defaults.players[idx].name);
    const playerCount = Math.max(1, Math.min(200, (isDefaultDemoRoster ? 10 : r.players?.length) || 10));
    const customPlayers = (r.players || []).filter(p => !/^player\s+\d+$/i.test(p.name.trim()));
    const rosterVal = (isAutoRoster || isDefaultDemoRoster) ? "" : (customPlayers.length > 0 ? customPlayers.map(p => p.name).join(", ") : (r.players || []).map(p => p.name).join(", "));
    app.innerHTML = `<section class="page"><header class="page-heading"><div><p class="eyebrow">MAKE IT YOUR OWN</p><h1>Tournament Studio</h1><p class="subtitle">Same little adventure. Your rules.</p></div><a href="#studio" class="btn-clay" style="text-decoration:none;font-size:12px;padding:8px 14px">← Switch / New Tournament</a></header><div class="studio-layout"><section class="clay-panel"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px"><h2 style="margin:0;font-size:1.25rem">Active Tournament</h2><span class="badge badge-mint">Active</span></div><div class="tournament-share-card" style="padding:16px;background:#f3edf9;border-radius:18px;border:1px solid #ebe2f4;display:flex;flex-direction:column;gap:14px"><div><span style="font-size:11px;font-weight:750;color:var(--muted);display:block;text-transform:uppercase;letter-spacing:0.05em">Room Code</span><strong style="font-size:24px;letter-spacing:3px;font-family:monospace;color:var(--ink)">${esc(r.code)}</strong></div><div style="padding-top:10px;border-top:1px solid #e5d9ee"><span style="font-size:11px;font-weight:750;color:var(--muted);display:block;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Shareable Player Link</span><p class="hint" style="margin:0;word-break:break-all"><code id="share-link-display">${esc(getShareUrl(r.code))}</code></p></div><div style="padding-top:10px;border-top:1px solid #e5d9ee"><span style="font-size:11px;font-weight:750;color:var(--muted);display:block;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Leaderboard Link</span><p class="hint" style="margin:0;word-break:break-all"><code>${esc(getLeaderboardShareUrl(r.code))}</code></p></div><div style="display:flex;gap:10px;padding-top:12px;border-top:1.5px solid #e5d9ee;flex-wrap:wrap"><button type="button" id="copy-all-share-btn" class="btn-clay btn-clay-mint" style="flex:1;min-width:130px;font-size:13px;padding:9px 14px"><span id="copy-all-icon">📋</span> Copy Details</button><button type="button" id="share-all-btn" class="btn-clay" style="flex:1;min-width:110px;font-size:13px;padding:9px 14px" title="Share tournament invite"><span>📤</span> Share</button></div></div><div class="actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button id="reset-room" class="quiet" style="flex:1;min-width:110px">Reset results</button><button id="delete-room" class="danger" style="flex:1;min-width:110px">Delete</button></div><p id="studio-feedback" role="status" class="hint"></p></section><form id="studio-settings" class="clay-panel"><h2>Setup Room</h2><label for="tournament-title">Tournament title</label><input id="tournament-title" name="title" maxlength="100" value="${esc(r.title)}" required><label for="leaderboard-seconds">Between-round leaderboard (seconds)</label><input id="leaderboard-seconds" type="number" name="leaderboardSeconds" min="0" max="600" value="${r.leaderboardSeconds}" required><p class="hint">0 = manual Next round. Otherwise, the next round starts automatically after this interval while the leaderboard is open.</p><div class="clay-slider-group"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><label for="player-count-slider" style="margin:0;font-size:13px;font-weight:750">How many players (Max 200)</label><div><input id="player-count-input" name="playerCount" type="number" min="1" max="200" value="${playerCount}" ${locked ? "disabled" : ""} class="clay-num-input" aria-label="Player count number"></div></div><div style="display:flex;align-items:center;gap:14px"><input id="player-count-slider" type="range" min="1" max="200" value="${playerCount}" ${locked ? "disabled" : ""} class="clay-range" aria-label="Player count slider"><span class="hint" style="font-size:12px;white-space:nowrap;font-weight:750;min-width:75px;text-align:right" id="player-count-display">${playerCount} players</span></div></div><label for="roster">Player names · comma separated <span style="font-weight:500;color:var(--muted)">(optional)</span></label><textarea id="roster" name="roster" rows="4" maxlength="10000" placeholder="Optional: Ujjwal, Aarav, Ananya... (Leave empty for auto-generated player slots)" ${locked ? "disabled" : ""}>${esc(rosterVal)}</textarea><p class="hint">Optional. Leave empty to auto-generate slots up to the player count above, or enter custom names separated by commas.</p><label for="round-count">Number of rounds</label><input id="round-count" type="number" min="1" max="10" value="${r.rounds.length}" ${locked ? "disabled" : ""}><p class="hint">${locked ? "Players and puzzle settings are locked because play has started. Reset results to edit them." : "Up to 10 rounds. Choose a bundled picture or enter a local asset path (inside this folder). Non-square images are center-cropped to a square."}</p><div id="round-settings"></div><button class="full mint">Save settings</button><p id="settings-error" class="error" role="alert"></p></form></div></section>`;
    bindExport();
    let draft = C.clone(r.rounds);
    const count = document.getElementById("round-count"), roundSettings = document.getElementById("round-settings");
    const countSlider = document.getElementById("player-count-slider");
    const countInput = document.getElementById("player-count-input");
    const countDisplay = document.getElementById("player-count-display");
    const rosterInput = document.getElementById("roster");

    function syncPlayerCount(val) {
      let num = parseInt(val, 10);
      if (isNaN(num)) num = 1;
      num = Math.max(1, Math.min(200, num));
      if (countSlider) countSlider.value = num;
      if (countInput) countInput.value = num;
      if (countDisplay) countDisplay.textContent = `${num} ${num === 1 ? "player" : "players"}`;
    }
    countSlider?.addEventListener("input", e => syncPlayerCount(e.target.value));
    countInput?.addEventListener("input", e => syncPlayerCount(e.target.value));
    countInput?.addEventListener("blur", () => {
      if (!countInput.value || Number(countInput.value) < 1) syncPlayerCount(1);
      else if (Number(countInput.value) > 200) syncPlayerCount(200);
    });
    rosterInput?.addEventListener("input", () => {
      const parsed = rosterInput.value.split(/[,\r\n]+/).map(n => n.trim()).filter(Boolean);
      if (parsed.length > Number(countSlider?.value || 0)) {
        syncPlayerCount(Math.min(200, parsed.length));
      }
    });
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
    document.getElementById("studio-settings").addEventListener("submit", event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const error = document.getElementById("settings-error"); error.textContent = "";
      const title = form.get("title").trim(), wait = Number(form.get("leaderboardSeconds"));
      if (!title || !Number.isInteger(wait) || wait < 0 || wait > 600) { error.textContent = "Enter a title and a valid leaderboard duration (0–600 seconds)."; return; }
      if (!locked) {
        const rawRoster = form.get("roster") || "";
        const names = rawRoster.split(/[,\r\n]+/).map(name => name.trim()).filter(Boolean);
        if (names.length > 200) { error.textContent = "Maximum 200 player names allowed."; return; }
        if (names.some(name => name.length > 80)) { error.textContent = "Each player name must be 80 characters or fewer."; return; }
        if (names.length > 0 && new Set(names.map(name => name.toLowerCase())).size !== names.length) { error.textContent = "Player names must be unique."; return; }
        let targetCount = Number(countInput?.value || countSlider?.value || names.length || 10);
        if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 200) {
          targetCount = Math.max(1, Math.min(200, names.length || 10));
        }
        if (names.length > targetCount) targetCount = Math.min(200, names.length);
        const finalNames = [...names];
        if (finalNames.length < targetCount) {
          const existingLower = new Set(finalNames.map(n => n.toLowerCase()));
          let pNum = 1;
          while (finalNames.length < targetCount) {
            while (existingLower.has(`player ${pNum}`.toLowerCase())) { pNum++; }
            const fallback = `Player ${pNum}`;
            existingLower.add(fallback.toLowerCase());
            finalNames.push(fallback);
            pNum++;
          }
        }
        if (!Number.isInteger(Number(count.value)) || Number(count.value) !== draft.length || draft.some(config => !config.name.trim() || !Number.isInteger(config.seconds) || config.seconds < 10 || config.seconds > 7200 || !/^(?:\.\/)?assets\/[a-zA-Z0-9_./ -]+\.(?:svg|png|jpe?g|webp|gif)$/i.test(config.image) || config.image.includes(".."))) { error.textContent = "Check round count, names, times (10–7200 seconds) and local assets/ image paths."; return; }
        const previous = new Map(r.players.map(p => [p.name.toLowerCase(), p]));
        r.players = finalNames.map((name, i) => {
          const existing = previous.get(name.toLowerCase());
          return { ...(existing || { id: `player-${Date.now()}-${i}` }), name, avatar: getAvatarUrl(name, existing?.avatar) };
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
    document.getElementById("delete-room")?.addEventListener("click", () => {
      const codeToDelete = r.code;
      if (!confirm(`Are you sure you want to permanently delete tournament ${codeToDelete}? All settings, players, and scores will be deleted.`)) return;

      delete state.rooms[codeToDelete];
      const remainingCodes = Object.keys(state.rooms);
      state.currentRoom = remainingCodes.length > 0 ? remainingCodes[0] : null;
      state.playerId = null;
      selectedPlayer = null;
      boardWaitUntil = null;
      viewingRound = 1;
      save();
      window.ConvexSync?.deleteRoom(codeToDelete);
      if (state.currentRoom) syncConvex();
      routeTo("#studio");
      toast(`Tournament ${codeToDelete} has been permanently deleted.`);
    });
    function getFullShareText() {
      const gameUrl = getShareUrl(r.code);
      const lbUrl = getLeaderboardShareUrl(r.code);
      return `🧩 ${r.title || "Jigsaw Arena"}\n\n🔢 Room Code: ${r.code}\n🎮 Game Link: ${gameUrl}\n📊 Live Leaderboard: ${lbUrl}`;
    }
    document.getElementById("copy-all-share-btn")?.addEventListener("click", async event => {
      const btn = event.currentTarget;
      const text = getFullShareText();
      try {
        await navigator.clipboard.writeText(text);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> Copied Details!`;
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
        toast("Tournament details copied to clipboard!");
      } catch (err) {
        prompt("Copy tournament details:", text);
      }
    });
    document.getElementById("share-all-btn")?.addEventListener("click", async event => {
      const btn = event.currentTarget;
      const text = getFullShareText();
      const shareUrl = getShareUrl(r.code);
      if (navigator.share) {
        try {
          await navigator.share({
            title: r.title || "Jigsaw Arena",
            text: text,
            url: shareUrl
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> Copied Details!`;
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
        toast("Tournament details copied to clipboard!");
      } catch {
        prompt("Share tournament details:", text);
      }
    });
  }
  const renderAdmin = renderStudio;
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
  document.addEventListener("click", event => {
    const el = event.target.closest("button, a, select, input[type='range'], input[type='checkbox'], input[type='radio'], .player-option, .gallery-card, .round-chip, .pin-digit, .tabs button");
    if (!el || el.disabled) return;
    if (el.closest("#sound-toggle") || el.classList.contains("piece") || el.classList.contains("board-cell")) return;
    SoundFX.playClick();
  });
  document.addEventListener("input", event => {
    if (event.target.matches("input[type='text'], input[type='search'], input[type='number'], textarea, .pin-digit")) {
      SoundFX.playTap();
    }
  });
  document.getElementById("sound-toggle")?.addEventListener("click", () => SoundFX.toggle());
  SoundFX.init();
  render();
})();