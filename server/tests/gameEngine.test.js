'use strict';

const assert = require('assert');
const path = require('path');

const gameEngine = require(path.join(__dirname, '..', 'gameEngine.js'));

function makePlayingState(numScreens = 3) {
  const state = new gameEngine.GameState();
  state.numScreens = numScreens;
  state.gameStatus = 'playing';
  state.gameActive = true;
  state.level = 1;
  state.currentLevel = 1;
  state.bricks = gameEngine.loadLevel(1, null, numScreens);
  state.bricksDirty = true;

  const p = new gameEngine.Player('player1');
  p.connected = true;
  p.lives = 3;
  p.score = 0;
  p.paddleX = (numScreens * 1920) / 2 - 150;
  p.paddleY = 1000;
  p.paddleWidth = 300;
  p.inventory = [];
  state.players = [p];

  const ball = new gameEngine.Ball('ball_1', (numScreens * 1920) / 2, 500, 3, 4, 8);
  ball.active = true;
  state.balls = [ball];
  state.powerUps = [];
  return state;
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('gameEngine tests');

test('loadLevel creates destructible bricks for N screens', () => {
  for (const n of [3, 5, 7, 9, 12]) {
    const bricks = gameEngine.loadLevel(1, null, n);
    assert.ok(Array.isArray(bricks) && bricks.length > 0, `level rows for ${n}`);
    let destructible = 0;
    for (const row of bricks) {
      for (const brick of row) {
        if (brick.active && brick.type !== 'indestructible') destructible++;
        assert.ok(brick.x + brick.width <= n * 1920 + 1, 'brick within world width');
      }
    }
    assert.ok(destructible > 0, `has destructible bricks for ${n} screens`);
  }
});

test('wall collision keeps ball inside world', () => {
  const state = makePlayingState(3);
  const ball = state.balls[0];
  ball.x = -10;
  ball.vx = -5;
  gameEngine.checkWallCollision(ball, state);
  assert.ok(ball.x >= ball.radius, 'ball pushed inside left wall');
  assert.ok(ball.vx > 0, 'vx reversed on left wall');
});

test('life loss respawns a ball without crashing on empty array', () => {
  const state = makePlayingState(3);
  state.balls[0].active = false;
  state.balls[0].y = 2000;
  state.lastFallenBallToucher = 'player1';
  gameEngine.updateGameLoop(state, () => {});
  assert.strictEqual(state.players[0].lives, 2);
  assert.ok(state.balls.some((b) => b.active), 'a ball is active after respawn');
});

test('power-up catch stores inventory (non-bomb)', () => {
  const state = makePlayingState(3);
  const player = state.players[0];
  state.powerUps.push(new gameEngine.PowerUp('wide_paddle', player.paddleX + 10, player.paddleY));
  gameEngine.updatePowerUps(state, () => {
    throw new Error('wide_paddle should not auto-apply');
  });
  assert.deepStrictEqual(player.inventory, ['wide_paddle']);
  assert.strictEqual(state.powerupsCollected, 1);
});

test('bomb power-up auto-applies on catch', () => {
  const state = makePlayingState(3);
  const player = state.players[0];
  let applied = null;
  state.powerUps.push(new gameEngine.PowerUp('bomb', player.paddleX + 10, player.paddleY));
  gameEngine.updatePowerUps(state, (p, type) => {
    applied = type;
  });
  assert.strictEqual(applied, 'bomb');
  assert.deepStrictEqual(player.inventory, []);
});

test('all lives lost sets game_over', () => {
  const state = makePlayingState(3);
  state.players[0].lives = 1;
  state.balls[0].active = false;
  state.lastFallenBallToucher = 'player1';
  gameEngine.updateGameLoop(state, () => {});
  // first fall: lives 0, then totalLives check
  if (state.gameStatus !== 'game_over') {
    state.balls.forEach((b) => { b.active = false; });
    gameEngine.updateGameLoop(state, () => {});
  }
  assert.strictEqual(state.players[0].lives, 0);
  assert.strictEqual(state.gameStatus, 'game_over');
});

test('paddle spawn X is world-center left edge for N screens', () => {
  for (const n of [3, 5, 7, 9, 12]) {
    const p = new gameEngine.Player(null, n);
    const expected = gameEngine.centerPaddleX(n, 300);
    assert.strictEqual(p.paddleX, expected, `paddleX for ${n} screens`);
    const worldCenter = (n * 1920) / 2;
    assert.ok(Math.abs((p.paddleX + p.paddleWidth / 2) - worldCenter) < 1, `centered on ${n}`);
    if (n !== 3) {
      assert.notStrictEqual(p.paddleX, 2880, 'must not hardcode 3-screen X');
    }
  }
});

test('life-loss respawn uses configured ballSpeed', () => {
  const state = makePlayingState(5);
  state.ballSpeed = 'insane';
  state.balls[0].active = false;
  state.balls[0].y = 2000;
  state.lastFallenBallToucher = 'player1';
  gameEngine.updateGameLoop(state, () => {});
  const ball = state.balls.find((b) => b.active);
  const expected = gameEngine.getRespawnVelocity(state);
  assert.ok(ball, 'respawned ball');
  assert.strictEqual(ball.vx, expected.vx);
  assert.strictEqual(ball.vy, expected.vy);
});

test('dead player does not catch falling power-ups', () => {
  const state = makePlayingState(3);
  const player = state.players[0];
  player.lives = 0;
  state.powerUps.push(new gameEngine.PowerUp('wide_paddle', player.paddleX + 10, player.paddleY));
  gameEngine.updatePowerUps(state, () => {
    throw new Error('dead player must not catch');
  });
  assert.deepStrictEqual(player.inventory, []);
  assert.strictEqual(state.powerUps[0].falling, true);
});

test('levels 4 and 5 have destructible bricks', () => {
  for (const level of [4, 5]) {
    const bricks = gameEngine.loadLevel(level, null, 5);
    let destructible = 0;
    for (const row of bricks) {
      for (const brick of row) {
        if (brick.active && brick.type !== 'indestructible') destructible++;
      }
    }
    assert.ok(destructible > 0, `level ${level} has breakable bricks`);
  }
});

test('CORS allows LAN origins and empty Flutter origin', () => {
  const { isAllowedCorsOrigin } = require('../config.js');
  assert.strictEqual(isAllowedCorsOrigin(undefined), true);
  assert.strictEqual(isAllowedCorsOrigin('http://192.168.1.20:3000'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://10.0.0.4:3000'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://lg1:3000'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://localhost:5173'), true);
  assert.strictEqual(isAllowedCorsOrigin('https://evil.example'), false);
});

test('normalizeDurationSeconds keeps endless (0)', () => {
  const { normalizeDurationSeconds } = require('../config.js');
  assert.strictEqual(normalizeDurationSeconds(0), 0);
  assert.strictEqual(normalizeDurationSeconds(180), 180);
  assert.strictEqual(normalizeDurationSeconds(30), 60);
  assert.strictEqual(normalizeDurationSeconds(9999), 600);
  assert.strictEqual(normalizeDurationSeconds(undefined, 120), 120);
});

console.log('All gameEngine tests passed.');
