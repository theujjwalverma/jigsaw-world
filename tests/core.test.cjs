const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/avatars.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), context);
const defaults = JSON.parse(JSON.stringify(context.window.OFFLINE_DEFAULTS));
const fixtureDefaults = { ...defaults, players: ['Ujjwal', 'Aarav', 'Ananya', 'Ishita', 'Rohan', 'Priya'].map(name => ({ id: name.toLowerCase(), name, avatar: 'assets/avatars/mint.svg' })) };
const make = code => C.createRoom(fixtureDefaults, code || '234234');

test('bundled JSON references agree with hardcoded runtime defaults', () => {
  const admin = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/admin.json'), 'utf8'));
  const players = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/players.json'), 'utf8'));
  assert.deepEqual(defaults, { ...admin, players: players.map(p => ({ ...p, id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') })) });
  for (const file of [...players.map(p => p.avatar), ...admin.rounds.map(r => r.image)]) assert.ok(fs.existsSync(path.join(__dirname, '..', file)));
});
test('all 49 roster portraits exist, with normalized name matching and SVG fallback', () => {
  assert.equal(defaults.players.length, 49);
  assert.equal(new Set(defaults.players.map(p => p.id)).size, 49);
  for (const p of defaults.players) assert.equal(context.window.offlineAvatarFor(p.name), p.avatar);
  assert.match(context.window.offlineAvatarFor('  UJJWAL   VERMA '), /ujjwal-verma.*jpeg$/);
  assert.match(context.window.offlineAvatarFor('Mughil M Arasu'), /mughil-arasu/);
  assert.equal(context.window.offlineAvatarFor('Unknown Player'), 'assets/avatars/mint.svg');
});
test('additional gallery pictures are registered and available locally', () => {
  assert.equal(context.window.OFFLINE_GALLERY.length, 5);
  for (const picture of context.window.OFFLINE_GALLERY) {
    assert.ok(picture.name);
    assert.ok(fs.existsSync(path.join(__dirname, '..', picture.image)), picture.image);
  }
});
test('room codes are six digits and room state is isolated', () => {
  assert.throws(() => make('abc'));
  assert.equal(C.validCode('012345'), true);
  const a = make(), b = make('345345');
  a.rounds[0].seconds = 10; a.players[0].name = 'Changed';
  assert.equal(b.rounds[0].seconds, 180); assert.equal(b.players[0].name, 'Ujjwal');
});
test('sessions resume with the original deadline and shuffled order', () => {
  const r = make();
  const session = C.startSession(r, 'ujjwal', 1, 1000);
  assert.equal(session.endsAt, 181000);
  assert.deepEqual([...session.order].sort((a,b) => a-b), [0,1,2,3]);
  assert.equal(C.startSession(r, 'ujjwal', 1, 5000), session);
});
test('moving, displacing and returning pieces counts changes only', () => {
  const r = make(), s = C.startSession(r, 'ujjwal', 1, 0);
  assert.equal(C.movePiece(s, 4, 0, 0), true);
  assert.equal(C.movePiece(s, 4, 0, 0), false);
  C.movePiece(s, 4, 1, 0);
  assert.deepEqual(s.placements, { 0: 1 });
  C.movePiece(s, 4, 1, 2);
  assert.deepEqual(s.placements, { 2: 1 });
  C.movePiece(s, 4, 1, null);
  assert.deepEqual(s.placements, {}); assert.equal(s.moves, 4);
  assert.equal(C.movePiece(s, 4, -1, 0), false);
  assert.equal(C.movePiece(s, 4, 4, 0), false);
  assert.equal(C.movePiece(s, 4, 1, 4), false);
});
test('submission stores user and round data once and advances the player', () => {
  const r = make(), s = C.startSession(r, 'ujjwal', 1, 0);
  for (let i=0; i<4; i++) C.movePiece(s, 4, i, i);
  const result = C.submit(r, 'ujjwal', 1, 42000);
  assert.equal(result.completed, true); assert.equal(result.moves, 4); assert.equal(result.timeMs, 42000);
  assert.equal(C.submit(r, 'ujjwal', 1, 99999), result);
  assert.equal(r.sessions.ujjwal[1], undefined); assert.equal(C.nextRound(r, 'ujjwal'), 2);
  assert.throws(() => C.startSession(r, 'ujjwal', 1));
});
test('timeout caps elapsed time and preserves partial progress', () => {
  const r = make(), s = C.startSession(r, 'ujjwal', 1, 1000);
  C.movePiece(s, 4, 0, 0);
  const result = C.submit(r, 'ujjwal', 1, 500000);
  assert.equal(result.timeMs, 180000); assert.equal(result.timedOut, true);
  assert.equal(result.completed, false); assert.equal(result.correct, 1);
});
test('leaderboard preserves pending names and ranks by completion, moves, time', () => {
  const r = make();
  r.results = { ujjwal: { 1: { completed: true, moves: 7, timeMs: 5000 } }, aarav: { 1: { completed: true, moves: 4, timeMs: 8000 } }, ananya: { 1: { completed: false, moves: 1, timeMs: 1000 } } };
  const rows = C.roundLeaderboard(r, 1);
  assert.equal(rows.length, r.players.length); assert.equal(rows[0].id, 'aarav'); assert.equal(rows[0].points, 50);
  assert.equal(rows[1].id, 'ujjwal'); assert.equal(rows[2].id, 'ananya');
  assert.equal(rows[3].rank, null); assert.equal(rows[3].points, null); assert.equal(rows[3].moves, undefined);
  r.results.ujjwal[2] = { completed: true, moves: 9, timeMs: 20000 };
  const finals = C.finalLeaderboard(r);
  assert.equal(finals[0].id, 'ujjwal'); assert.equal(finals[0].points, 99);
  assert.equal(finals[0].submitted, 2); assert.equal(finals.at(-1).rank, null);
});
test('finished players have no next round and serialization preserves progress', () => {
  const r = make();
  for(let round=1; round<=r.rounds.length; round++) { C.startSession(r, 'ujjwal', round, 0); C.submit(r, 'ujjwal', round, 1000000); }
  assert.equal(C.nextRound(r, 'ujjwal'), null);
  assert.equal(C.nextRound(r, 'aarav'), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});