(function (root) {
  "use strict";

  const CONVEX_URL = "https://whimsical-stoat-412.eu-west-1.convex.cloud";
  let client = null;
  let activeUnsubscribes = [];
  let activeRoomCode = null;
  let connected = false;

  function clearSubscriptions() {
    activeUnsubscribes.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
    activeUnsubscribes = [];
  }

  function updateBadge(status) {
    const badge = document.querySelector(".site-header .badge");
    if (badge) badge.hidden = true;
  }

  let roomsListSubscribed = false;

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
      if (!roomsListSubscribed) {
        roomsListSubscribed = true;
        try {
          client.onUpdate("rooms:list", {}, (rooms) => {
            connected = true;
            updateBadge("connected");
            if (Array.isArray(rooms) && typeof root.onConvexRoomsListUpdated === "function") {
              root.onConvexRoomsListUpdated(rooms);
            }
          });
        } catch (err) {
          console.warn("Could not subscribe to rooms:list:", err.message);
        }
      }
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

    if (activeRoomCode === roomObj.code && activeUnsubscribes.length > 0) {
      return;
    }

    clearSubscriptions();
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

    // 2. Subscribe to room config changes (players, rounds, title)
    try {
      const roomUnsub = c.onUpdate("rooms:get", { code: roomObj.code }, (remoteRoom) => {
        if (remoteRoom && typeof root.onConvexRoomSynced === "function") {
          root.onConvexRoomSynced(remoteRoom);
        }
      });
      activeUnsubscribes.push(roomUnsub);
    } catch (err) {
      console.warn("Failed to subscribe to Convex room:", err.message);
    }

    // 3. Subscribe to real-time results updates from all PCs
    try {
      const resultsUnsub = c.onUpdate("results:listByRoom", { roomCode: roomObj.code }, (results) => {
        connected = true;
        updateBadge("connected");
        if (Array.isArray(results) && typeof root.onConvexResultsUpdated === "function") {
          root.onConvexResultsUpdated(roomObj.code, results);
        }
      });
      activeUnsubscribes.push(resultsUnsub);
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

  async function deleteRoom(roomCode) {
    if (activeRoomCode === roomCode) {
      clearSubscriptions();
      activeRoomCode = null;
    }
    const c = initClient();
    if (!c) return;
    try {
      await c.mutation("rooms:deleteRoom", { code: roomCode });
    } catch (err) {
      console.warn("Failed to delete room in Convex:", err.message);
    }
  }

  root.ConvexSync = {
    CONVEX_URL,
    initClient,
    syncRoom,
    submitResult,
    updateRoomSettings,
    resetRoom,
    deleteRoom,
    updateBadge
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initClient());
    } else {
      setTimeout(() => initClient(), 0);
    }
  }

})(typeof window !== "undefined" ? window : globalThis);
