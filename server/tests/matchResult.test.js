'use strict';

const { resolveMatchResult, placementForPlayer } = require('../matchResult.js');
const assert = require('assert');

const draw = resolveMatchResult([
  { id: 'a', name: 'Alpha', score: 100, connected: true, playerNumber: 1 },
  { id: 'b', name: 'Bravo', score: 100, connected: true, playerNumber: 2 },
]);
assert.strictEqual(draw.outcome, 'draw');
assert.deepStrictEqual(draw.winnerNames, ['Alpha', 'Bravo']);

const win = resolveMatchResult([
  { id: 'a', name: 'Alpha', score: 200, connected: true, playerNumber: 1 },
  { id: 'b', name: 'Bravo', score: 50, connected: true, playerNumber: 2 },
]);
assert.strictEqual(win.outcome, 'win');
assert.deepStrictEqual(win.winnerIds, ['a']);

const place = placementForPlayer(win, 'b');
assert.strictEqual(place.rank, 2);
assert.strictEqual(place.isWinner, false);

console.log('matchResult tests passed');
