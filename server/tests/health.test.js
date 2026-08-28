'use strict';

const assert = require('assert');
const createRouter = require('../routes.js');

const payload = createRouter.healthPayload({
  numScreens: 3,
  gameStatus: 'lobby',
  players: [{ connected: true }, { connected: false }],
  sessionToken: 'LEAK',
  sessionId: 'should-not-appear',
});

assert.strictEqual(payload.status, 'ok');
assert.strictEqual(payload.gameStatus, 'lobby');
assert.strictEqual(payload.connectedPlayers, 1);
assert.strictEqual(payload.port, 8130);
assert.strictEqual(typeof payload.geminiLive, 'boolean');
assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'sessionToken'));
assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'sessionId'));
assert.ok(!JSON.stringify(payload).includes('LEAK'));

console.log('health tests passed');
