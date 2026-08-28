'use strict';

const assert = require('assert');
const path = require('path');

const gameEngine = require(path.join(__dirname, '..', 'gameEngine.js'));

// Per-frame width depends on the rig's frame aspect, so tests must never assume
// 1920. Run the suite with LG_FRAME_ASPECT=9:16 to exercise a portrait rig.
const FRAME_W = gameEngine.SCREEN_WIDTH;
const PADDLE_W = gameEngine.DEFAULT_PADDLE_WIDTH;

function makePlayingState(numScreens = 3) {
  const state = new gameEngine.GameState();
  state.numScreens = numScreens;
  state.screenWidth = FRAME_W;
  state.canvasHeight = gameEngine.CANVAS_HEIGHT;
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
  p.paddleX = (numScreens * FRAME_W) / 2 - PADDLE_W / 2;
  p.paddleY = gameEngine.PADDLE_Y;
  p.paddleWidth = PADDLE_W;
  p.inventory = [];
  state.players = [p];

  const ball = new gameEngine.Ball('ball_1', (numScreens * FRAME_W) / 2, 500, 3, 4, 8);
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

test('new GameState starts in lobby', () => {
  const state = new gameEngine.GameState();
  assert.strictEqual(state.gameStatus, 'lobby');
});

test('loadLevel creates destructible bricks for N screens', () => {
  for (const n of [3, 5, 7, 9, 12]) {
    const bricks = gameEngine.loadLevel(1, null, n);
    assert.ok(Array.isArray(bricks) && bricks.length > 0, `level rows for ${n}`);
    let destructible = 0;
    for (const row of bricks) {
      for (const brick of row) {
        if (brick.active && brick.type !== 'indestructible') destructible++;
        assert.ok(brick.x + brick.width <= n * FRAME_W + 1, 'brick within world width');
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

test('wide paddle is 2x default width, not landscape 600', () => {
  const { applyPowerUpEffect } = require('../handlers/powerups.js');
  const state = makePlayingState(3);
  const player = state.players[0];
  player.paddleX = (3 * FRAME_W) - 10;
  applyPowerUpEffect(player, 'wide_paddle', state, { emit() {} }, () => ({}));
  assert.strictEqual(player.paddleWidth, PADDLE_W * 2);
  assert.ok(player.paddleX + player.paddleWidth <= 3 * FRAME_W + 0.5, 'wide paddle stays in court');
  if (PADDLE_W !== 300) {
    assert.notStrictEqual(player.paddleWidth, 600);
  }
  if (player.widePaddleTimer) {
    clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = null;
  }
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

test('paddles spread across the court for N players', () => {
  const xs = [0, 1, 2].map((i) => gameEngine.paddleXForSlot(i, 3, 5, PADDLE_W));
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2], 'slots increase left to right');
  assert.ok(xs[0] < FRAME_W, 'player 1 starts on screen 1 of 5');
  assert.ok(xs[2] > FRAME_W * 3, 'player 3 starts on the right half');
});

test('brick tile expands and mirrors to panoramic width', () => {
  const tile = [
    [1, 2, 0],
    [0, 1, 2],
  ];
  const expanded = gameEngine.expandTiledBrickGrid(tile, 8);
  assert.strictEqual(expanded.length, 2);
  assert.strictEqual(expanded[0].length, 8);
  assert.deepStrictEqual(expanded[0].slice(0, 3), [1, 2, 0]);
  assert.deepStrictEqual(expanded[0].slice(3, 6), [0, 2, 1]);
});

test('input scale grows with screen count', () => {
  assert.ok(gameEngine.inputScaleForScreens(9) > gameEngine.inputScaleForScreens(5));
  assert.strictEqual(gameEngine.inputScaleForWorld(3, 1920), 1);
  assert.strictEqual(gameEngine.inputScaleForWorld(12, 1920), 4);
  // A portrait rig has a narrower court, so the same swipe must move less.
  assert.ok(gameEngine.inputScaleForWorld(3, 608) < gameEngine.inputScaleForWorld(3, 1920));
});

test('paddle spawn X is world-center left edge for N screens', () => {
  for (const n of [3, 5, 7, 9, 12]) {
    const p = new gameEngine.Player(null, n);
    const expected = gameEngine.centerPaddleX(n, PADDLE_W);
    assert.strictEqual(p.paddleX, expected, `paddleX for ${n} screens`);
    const worldCenter = (n * FRAME_W) / 2;
    assert.ok(Math.abs((p.paddleX + p.paddleWidth / 2) - worldCenter) < 1, `centered on ${n}`);
    if (n !== 3) {
      assert.notStrictEqual(p.paddleX, gameEngine.centerPaddleX(3, PADDLE_W), 'must not hardcode 3-screen X');
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
  assert.ok(ball, 'respawned ball');
  assert.strictEqual(ball.glued, true);
  state.serveLaunchAt = Date.now() - 1;
  gameEngine.updateGameLoop(state, () => {});
  const expected = gameEngine.getRespawnVelocity(state);
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
  assert.strictEqual(isAllowedCorsOrigin('http://192.168.1.20:8130'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://10.0.0.4:8130'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://lg1:8130'), true);
  assert.strictEqual(isAllowedCorsOrigin('http://localhost:5173'), true);
  assert.strictEqual(isAllowedCorsOrigin('https://evil.example'), false);
});

test('default port is 8130 and not a reserved cluster port', () => {
  const { PORT } = require('../config.js');
  const reserved = [81, 8111, 8112, 8114, 8128, 8129, 3123];
  assert.strictEqual(PORT, 8130);
  assert.ok(!reserved.includes(PORT), `port ${PORT} is reserved on the rig`);
});

test('frame aspect comes from LG rotation vars', () => {
  const r = gameEngine.resolveFrameAspect;
  // Stock LG rigs rotate frames to portrait; DHCP_RANDR defaults to "right".
  assert.ok(Math.abs(r({ DHCP_RANDR: 'right' }) - 1080 / 1920) < 1e-9);
  assert.ok(Math.abs(r({ DHCP_RANDR: 'left' }) - 1080 / 1920) < 1e-9);
  assert.ok(Math.abs(r({ LG_RANDR: 'normal' }) - 1920 / 1080) < 1e-9);
  // Explicit settings win over the rig's rotation.
  assert.ok(Math.abs(r({ LG_FRAME_ASPECT: '9:16', DHCP_RANDR: 'normal' }) - 0.5625) < 1e-9);
  assert.ok(Math.abs(r({ LG_FRAME_WIDTH: '1200', LG_FRAME_HEIGHT: '1600' }) - 0.75) < 1e-9);
  // Nonsense falls back to landscape rather than producing a broken court.
  assert.ok(Math.abs(r({ LG_FRAME_ASPECT: 'banana' }) - 1920 / 1080) < 1e-9);
  assert.ok(Math.abs(r({ LG_FRAME_ASPECT: '100:1' }) - 1920 / 1080) < 1e-9);
  assert.ok(Math.abs(r({}) - 1920 / 1080) < 1e-9);
});

test('a level has the same columns in portrait and landscape', () => {
  assert.strictEqual(gameEngine.brickColumnsForWorld(3), 39, '3 screens keep the authored 39 columns');
  for (const n of [3, 5, 9, 12]) {
    const landscape = gameEngine.loadLevel(1, null, n, 1920);
    const portrait = gameEngine.loadLevel(1, null, n, 608);
    assert.strictEqual(landscape.length, portrait.length, `row count for ${n} screens`);
    for (let r = 0; r < landscape.length; r++) {
      assert.strictEqual(
        landscape[r].length, portrait[r].length,
        `column count is aspect independent for ${n} screens`
      );
      for (let c = 0; c < landscape[r].length; c++) {
        assert.strictEqual(landscape[r][c].type, portrait[r][c].type, 'same brick types');
        assert.strictEqual(landscape[r][c].active, portrait[r][c].active, 'same brick pattern');
      }
    }
  }
});

test('brick grid fits inside the court in either aspect', () => {
  for (const frameW of [1920, 608]) {
    for (const n of [3, 5, 12]) {
      const m = gameEngine.brickMetrics(frameW);
      const cols = gameEngine.brickColumnsForWorld(n, frameW);
      const rightEdge = m.gutter + (cols - 1) * m.cell + m.brickWidth;
      assert.ok(rightEdge <= n * frameW, `grid fits ${n}x${frameW}`);
      assert.ok(m.brickWidth > 0 && m.cell > m.brickWidth, 'bricks have a gap');
      assert.ok(m.top + 8 * m.rowPitch < gameEngine.PADDLE_Y, 'bricks stay above the paddle');
    }
  }
});

test('normalizeDurationSeconds keeps endless (0)', () => {
  const { normalizeDurationSeconds } = require('../config.js');
  assert.strictEqual(normalizeDurationSeconds(0), 0);
  assert.strictEqual(normalizeDurationSeconds(180), 180);
  assert.strictEqual(normalizeDurationSeconds(30), 60);
  assert.strictEqual(normalizeDurationSeconds(9999), 600);
  assert.strictEqual(normalizeDurationSeconds(undefined, 120), 120);
});

test('ARKANOID AI lists ten Gemini fallback models', () => {
  const { GEMINI_MODELS, pickFallbackCommentary } = require('../services/geminiService.js');
  assert.strictEqual(GEMINI_MODELS.length, 10);
  const win = pickFallbackCommentary('victory', {
    players: [{ name: 'Alpha', score: 40, lives: 2, connected: true }],
  });
  assert.ok(/Alpha/i.test(win), win);
  const life = pickFallbackCommentary('life_lost', {
    players: [{ name: 'Bravo', score: 0, lives: 1, connected: true }],
  });
  assert.ok(/Bravo/i.test(life), life);
});

test('life-loss respawn glues the ball on the serving paddle', () => {
  const state = makePlayingState(3);
  const p = state.players[0];
  p.paddleX = 120;
  state.balls[0].active = false;
  state.balls[0].y = 2000;
  state.lastFallenBallToucher = 'player1';
  gameEngine.updateGameLoop(state, () => {});
  const ball = state.balls.find((b) => b.active);
  assert.ok(ball, 'respawned ball');
  assert.ok(Math.abs(ball.x - (p.paddleX + p.paddleWidth / 2)) < 2, 'serve sits on paddle X');
  assert.ok(ball.y < p.paddleY, 'serve sits above the paddle');
  assert.strictEqual(ball.glued, true);
  assert.strictEqual(ball.vy, 0);
  state.serveLaunchAt = Date.now() - 1;
  gameEngine.updateGameLoop(state, () => {});
  assert.strictEqual(ball.glued, false);
  assert.ok(ball.vy < 0, 'serve goes up into the bricks after the hold');
});

test('brick break does not credit a paddle the ball never touched', () => {
  const state = makePlayingState(3);
  const ball = state.balls[0];
  ball.lastTouchedByPlayerId = null;
  const brick = state.bricks.flat().find((b) => b.active && b.type !== 'indestructible');
  assert.ok(brick, 'need a breakable brick');
  ball.x = brick.x + brick.width / 2;
  ball.y = brick.y + brick.height / 2;
  gameEngine.checkBrickCollision(ball, state);
  assert.strictEqual(state.players[0].score, 0);
});

test('stock levels always have destructible bricks', () => {
  for (const n of [3, 5, 12]) {
    for (let level = 1; level <= 5; level++) {
      const grid = gameEngine.loadLevel(level, null, n);
      const playable = grid.some((row) => row.some((b) => b.active && b.type !== 'indestructible'));
      assert.ok(playable, `level ${level} on ${n} screens must be finishable`);
    }
  }
});

test('game master wide paddle buffs living paddles immediately', () => {
  const state = makePlayingState(3);
  const before = state.players[0].paddleWidth;
  gameEngine.applyGameMasterMod(state, 'WIDE_PADDLE');
  assert.ok(state.players[0].paddleWidth > before);
});

test('disconnect grace freezes the court so lives are not drained offline', () => {
  const state = makePlayingState(3);
  const p = state.players[0];
  p.connected = false;
  p.lives = 3;
  p.score = 40;
  state.lastFallenBallToucher = 'player1';
  const ball = state.balls[0];
  ball.active = true;
  ball.y = gameEngine.CANVAS_HEIGHT + 80;
  ball.vy = 20;
  gameEngine.updateGameLoop(state, () => {});
  assert.strictEqual(p.lives, 3, 'offline paddle keeps lives during grace');
  assert.strictEqual(p.score, 40, 'offline paddle keeps score during grace');
});

console.log('All gameEngine tests passed.');
