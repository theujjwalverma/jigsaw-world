(function (root) {
  "use strict";

  const CONVEX_URL = "https://whimsical-stoat-412.eu-west-1.convex.cloud";
  let client = null;
  let activeUnsubscribe = null;
  let activeRoomCode = null;
  let connected = false;

  function updateBadge(status) {
    const badge = document.querySelector(".site-header .badge");
    if (!badge) return;
    if (status === "connected") {
      badge.className = "badge badge-mint";
      badge.innerHTML = "● Live Sync: whimsical-stoat-412";
      badge.title = "Connected to Convex DB. Leaderboard updates in real-time across devices.";
    } else if (status === "syncing") {
      badge.className = "badge badge-lavender";
      badge.innerHTML = "◌ Syncing with Convex…";
    } else {
      badge.className = "badge badge-peach";
      badge.innerHTML = "● Offline mode";
      badge.title = "Using local browser storage. Changes stay on this device.";
    }
  }

  function initClient() {
    if (client) return client;
    if (typeof root.ConvexClient !== "function") {
      console.warn("ConvexClient is not loaded. Operating in offline mode.");
      updateBadge("offline");
      return null;
    }
    try {
      client = new root.ConvexClient(CONVEX_URL);
      updateBadge("syncing");
      return client;
    } catch (e) {
      console.warn("Could not initialize Convex client:", e);
      updateBadge("offline");
      return null;
    }
  }

  function syncRoom(roomObj) {
    if (!roomObj?.code) return;
    const c = initClient();
    if (!c) return;

    if (activeRoomCode === roomObj.code && activeUnsubscribe) {
      return;
    }

    if (activeUnsubscribe) {
      try { activeUnsubscribe(); } catch (_) {}
      activeUnsubscribe = null;
    }

    activeRoomCode = roomObj.code;

    // 1. Ensure room exists in Convex cloud
    c.mutation("rooms:ensureRoom", {
      code: roomObj.code,
      title: roomObj.title,
      leaderboardSeconds: roomObj.leaderboardSeconds,
      rounds: roomObj.rounds.map(r => ({
        name: r.name,
        grid: r.grid,
        seconds: r.seconds,
        image: r.image
      })),
      players: roomObj.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar
      }))
    }).then(remoteRoom => {
      connected = true;
      updateBadge("connected");
      if (remoteRoom && typeof root.onConvexRoomSynced === "function") {
        root.onConvexRoomSynced(remoteRoom);
      }
    }).catch(err => {
      console.warn("Convex room sync warning:", err.message);
      // If deployment is not yet initialized or network error, keep offline mode active
      updateBadge("offline");
    });

    // 2. Subscribe to real-time results updates from all PCs
    try {
      activeUnsubscribe = c.onUpdate("results:listByRoom", { roomCode: roomObj.code }, (results) => {
        connected = true;
        updateBadge("connected");
        if (Array.isArray(results) && typeof root.onConvexResultsUpdated === "function") {
          root.onConvexResultsUpdated(roomObj.code, results);
        }
      });
    } catch (err) {
      console.warn("Failed to subscribe to Convex results:", err.message);
    }
  }

  async function submitResult(roomCode, playerId, round, result) {
    const c = initClient();
    if (!c) return;
    try {
      await c.mutation("results:submit", {
        roomCode,
        playerId,
        round,
        moves: result.moves,
        timeMs: result.timeMs,
        completed: Boolean(result.completed),
        correct: result.correct ?? 0,
        total: result.total ?? 0,
        timedOut: Boolean(result.timedOut),
        submittedAt: result.submittedAt || new Date().toISOString()
      });
      connected = true;
      updateBadge("connected");
    } catch (err) {
      console.warn("Failed to submit result to Convex:", err.message);
    }
  }

  async function updateRoomSettings(roomObj) {
    const c = initClient();
    if (!c) return;
    try {
      await c.mutation("rooms:update", {
        code: roomObj.code,
        title: roomObj.title,
        leaderboardSeconds: roomObj.leaderboardSeconds,
        rounds: roomObj.rounds.map(r => ({
          name: r.name,
          grid: r.grid,
          seconds: r.seconds,
          image: r.image
        })),
        players: roomObj.players.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar
        }))
      });
    } catch (err) {
      console.warn("Failed to update room in Convex:", err.message);
    }
  }

  async function resetRoom(roomCode) {
    const c = initClient();
    if (!c) return;
    try {
      await c.mutation("results:resetRoom", { roomCode });
    } catch (err) {
      console.warn("Failed to reset room in Convex:", err.message);
    }
  }

  root.ConvexSync = {
    CONVEX_URL,
    syncRoom,
    submitResult,
    updateRoomSettings,
    resetRoom,
    updateBadge
  };

})(typeof window !== "undefined" ? window : globalThis);
