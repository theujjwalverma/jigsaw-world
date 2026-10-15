/* Shared, DOM-free game rules. Also loadable by node --test. */
(function (root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const validCode = code => /^\d{6}$/.test(code);
  function createRoom(defaults, code) {
    if (!validCode(code)) throw new Error("Enter a six-digit room code.");
    return {
      code, title: defaults.title, leaderboardSeconds: defaults.leaderboardSeconds,
      rounds: clone(defaults.rounds), players: clone(defaults.players),
      results: {}, sessions: {}, createdAt: new Date().toISOString()
    };
  }
  function shuffle(size) {
    const pieces = Array.from({ length: size }, (_, i) => i);
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }
  function startSession(room, playerId, round, now = Date.now()) {
    if (!room.players.some(p => p.id === playerId) || !room.rounds[round - 1]) throw new Error("Unknown player or round.");
    if (room.results[playerId]?.[round]) throw new Error("This round is already submitted.");
    room.sessions[playerId] ||= {};
    room.sessions[playerId][round] ||= {
      startedAt: now, endsAt: now + room.rounds[round - 1].seconds * 1000,
      moves: 0, placements: {}, order: shuffle(room.rounds[round - 1].grid ** 2)
    };
    return room.sessions[playerId][round];
  }
  function movePiece(session, size, piece, cell) {
    if (!Number.isInteger(piece) || piece < 0 || piece >= size ||
        (cell !== null && (!Number.isInteger(cell) || cell < 0 || cell >= size))) return false;
    const previous = Object.keys(session.placements).find(key => session.placements[key] === piece);
    if ((cell === null && previous === undefined) || (cell !== null && previous === String(cell))) return false;
    if (previous !== undefined) delete session.placements[previous];
    if (cell !== null) session.placements[cell] = piece;
    session.moves++;
    return true;
  }
  function correctCount(session) {
    return Object.entries(session.placements).filter(([cell, piece]) => Number(cell) === piece).length;
  }
  function submit(room, playerId, round, now = Date.now()) {
    if (room.results[playerId]?.[round]) return room.results[playerId][round];
    const session = room.sessions[playerId]?.[round];
    if (!session) throw new Error("Start the round first.");
    const size = room.rounds[round - 1].grid ** 2;
    const correct = correctCount(session);
    const result = {
      moves: session.moves, timeMs: Math.max(0, Math.min(now, session.endsAt) - session.startedAt),
      completed: correct === size, correct, total: size,
      timedOut: now >= session.endsAt, submittedAt: new Date(now).toISOString()
    };
    room.results[playerId] ||= {};
    room.results[playerId][round] = result;
    delete room.sessions[playerId][round];
    return result;
  }
  function roundLeaderboard(room, round) {
    const submitted = room.players.flatMap(player => {
      const result = room.results[player.id]?.[round];
      return result ? [{ ...player, ...result }] : [];
    }).sort((a, b) => Number(b.completed) - Number(a.completed) || a.moves - b.moves || a.timeMs - b.timeMs || a.id.localeCompare(b.id));
    const ranked = submitted.map((row, i) => ({ ...row, rank: i + 1, points: Math.max(1, 50 - i) }));
    return ranked.concat(room.players.filter(player => !room.results[player.id]?.[round]).map(player => ({ ...player, rank: null, points: null })));
  }
  function finalLeaderboard(room) {
    const rows = room.players.map(player => ({ ...player, submitted: 0, points: 0, moves: 0, timeMs: 0 }));
    const byId = new Map(rows.map(row => [row.id, row]));
    room.rounds.forEach((_, index) => roundLeaderboard(room, index + 1).filter(row => row.rank).forEach(result => {
      const row = byId.get(result.id);
      row.submitted++; row.points += result.points; row.moves += result.moves; row.timeMs += result.timeMs;
    }));
    rows.sort((a, b) => Number(b.submitted > 0) - Number(a.submitted > 0) || b.points - a.points || a.moves - b.moves || a.timeMs - b.timeMs || a.id.localeCompare(b.id));
    let rank = 0;
    return rows.map(row => ({ ...row, rank: row.submitted ? ++rank : null }));
  }
  function nextRound(room, playerId) {
    const index = room.rounds.findIndex((_, i) => !room.results[playerId]?.[i + 1]);
    return index < 0 ? null : index + 1;
  }
  const api = { clone, validCode, createRoom, startSession, movePiece, correctCount, submit, roundLeaderboard, finalLeaderboard, nextRound };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OfflineCore = api;
})(typeof window !== "undefined" ? window : globalThis);