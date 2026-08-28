'use strict';

const { SCREEN_WIDTH, CANVAS_HEIGHT, PADDLE_HEIGHT } = require('./layout.js');
const { Ball } = require('./entities.js');
const { loadLevel } = require('./levels.js');
const { getRespawnVelocity } = require('./speeds.js');
const {
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
} = require('./collisions.js');

const SERVE_HOLD_MS = 1500;

function servingPaddle(gameState) {
  const players = gameState.players || [];
  let p = players.find((x) => x.id && x.id === gameState.lastFallenBallToucher && x.connected && x.lives > 0);
  if (!p) p = players.find((x) => x.connected && x.lives > 0);
  return p || null;
}

function placeBallOnPaddle(ball, player) {
  if (!ball || !player) return;
  const pw = player.paddleWidth || 300;
  ball.x = player.paddleX + pw / 2;
  ball.y = (player.paddleY || 1000) - (ball.radius || 8) - 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.glued = true;
  ball.active = true;
  ball.lastTouchedByPlayerId = player.id || null;
}

function launchGluedBall(ball, gameState) {
  if (!ball) return;
  const v = getRespawnVelocity(gameState);
  ball.glued = false;
  ball.active = true;
  ball.vx = v.vx;
  ball.vy = v.vy;
  if (gameState) gameState.serveLaunchAt = 0;
}

function stickGluedBalls(gameState, player) {
  if (!player) return;
  (gameState.balls || []).forEach((b) => {
    if (!b || !b.glued || !b.active) return;
    if (b.lastTouchedByPlayerId && b.lastTouchedByPlayerId !== player.id) return;
    placeBallOnPaddle(b, player);
  });
}

function gridHasDestructible(grid) {
  if (!Array.isArray(grid) || !grid.length) return false;
  return grid.some((row) => Array.isArray(row) && row.some((cell) => {
    if (cell && typeof cell === 'object') {
      return cell.active && cell.type !== 'indestructible';
    }
    return cell !== 3 && cell !== 0;
  }));
}

function updatePowerUps(gameState, applyPowerUpEffectCallback) {
  const players = gameState.players || [];
  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const p = gameState.powerUps[i];
    if (!p.falling) continue;

    p.y += 5;

    if (p.y > CANVAS_HEIGHT) {
      gameState.powerUps.splice(i, 1);
      continue;
    }

    for (let j = 0; j < players.length; j++) {
      const player = players[j];
      if (!player.connected || player.lives <= 0) continue;

      const paddleH = player.paddleHeight || PADDLE_HEIGHT;
      const withinVertical = (p.y >= player.paddleY - 28) && (p.y <= player.paddleY + paddleH + 28);
      const withinHorizontal = (p.x >= player.paddleX - 8) && (p.x <= player.paddleX + player.paddleWidth + 8);

      if (withinVertical && withinHorizontal) {
        p.falling = false;
        p.active = true;
        p.activatedAt = Date.now();
        gameState.powerupsCollected = (gameState.powerupsCollected || 0) + 1;
        if (player.id) {
          player.score += 50;
          if (!Array.isArray(player.inventory)) player.inventory = [];
          if (p.type === 'bomb') {
            if (applyPowerUpEffectCallback) {
              applyPowerUpEffectCallback(player, p.type, p.x, p.y);
            }
          } else if (player.inventory.length < 3) {
            player.inventory.push(p.type);
          }
        }
        break;
      }
    }
  }

  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const p = gameState.powerUps[i];
    if (!p.falling && p.activatedAt && Date.now() - p.activatedAt > 10000) {
      gameState.powerUps.splice(i, 1);
    }
  }
}

function updateGameLoop(gameState, applyPowerUpEffectCallback) {
  if (gameState.gameStatus !== 'playing') return;
  // Wi-Fi blip: every paddle is disconnected during the 30s resume window.
  // Freeze the court so lives/score cannot drain on an empty HDMI wall.
  if (!(gameState.players || []).some((p) => p.connected)) return;

  const now = Date.now();
  for (let i = 0; i < gameState.balls.length; i++) {
    const ball = gameState.balls[i];
    if (!ball.active) continue;
    if (ball.glued) {
      const holder = servingPaddle(gameState);
      if (holder) placeBallOnPaddle(ball, holder);
      if (gameState.serveLaunchAt && now >= gameState.serveLaunchAt) {
        launchGluedBall(ball, gameState);
      }
      continue;
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    const steps = Math.max(1, Math.min(8, Math.ceil(speed / 12)));
    const stepScale = 1 / steps;
    let hitPaddle = false;
    let hitBrick = false;

    for (let s = 0; s < steps; s++) {
      ball._prevX = ball.x;
      ball._prevY = ball.y;
      ball.x += ball.vx * stepScale;
      ball.y += ball.vy * stepScale;
      checkWallCollision(ball, gameState);
      if (checkPaddleCollision(ball, gameState.players)) hitPaddle = true;
      if (checkBrickCollision(ball, gameState)) hitBrick = true;
    }
    ball._prevX = undefined;
    ball._prevY = undefined;

    if (hitPaddle) {
      gameState.rallyCount++;
      if (gameState.rallyCount > gameState.longestRally) {
        gameState.longestRally = gameState.rallyCount;
      }
      gameState.currentCombo = 0;
    }
    if (hitBrick) {
      gameState.currentCombo++;
      if (gameState.currentCombo > gameState.highestCombo) {
        gameState.highestCombo = gameState.currentCombo;
      }
    }

    if (ball.y - ball.radius >= CANVAS_HEIGHT) {
      ball.active = false;
      if (ball.lastTouchedByPlayerId) {
        gameState.lastFallenBallToucher = ball.lastTouchedByPlayerId;
      }
    }
  }

  if (!gameState.balls.some((b) => b.active)) {
    gameState.rallyCount = 0;
    gameState.currentCombo = 0;
    let playerToDeduct = gameState.players.find(
      (p) => p.id === gameState.lastFallenBallToucher && p.connected && p.lives > 0
    );
    if (!playerToDeduct) playerToDeduct = servingPaddle(gameState);
    if (playerToDeduct && playerToDeduct.lives > 0) {
      playerToDeduct.lives -= 1;
      playerToDeduct.score = Math.max(0, playerToDeduct.score - 10);
    }
    const holder = (playerToDeduct && playerToDeduct.lives > 0)
      ? playerToDeduct
      : servingPaddle(gameState);
    gameState.lastFallenBallToucher = holder && holder.id ? holder.id : null;

    let mainBall = gameState.balls[0] || gameState.balls.find(Boolean);
    if (!mainBall) {
      mainBall = new Ball('ball_1', 0, 0, 0, 0, 8);
      gameState.balls.push(mainBall);
    }
    if (holder) placeBallOnPaddle(mainBall, holder);
    else {
      mainBall.x = ((gameState.numScreens || 3) * SCREEN_WIDTH) / 2;
      mainBall.y = 500;
      mainBall.glued = true;
      mainBall.active = true;
    }
    gameState.serveLaunchAt = now + SERVE_HOLD_MS;
    mainBall.rallyCount = 0;
    mainBall.currentCombo = 0;
  }

  updatePowerUps(gameState, applyPowerUpEffectCallback);

  let totalLives = 0;
  for (let i = 0; i < gameState.players.length; i++) {
    if (gameState.players[i].connected) {
      totalLives += gameState.players[i].lives;
    }
  }
  if (totalLives <= 0 && gameState.players.some((p) => p.connected)) {
    gameState.gameStatus = 'game_over';
    gameState.gameActive = false;
    return;
  }

  let hasDestructibleBricks = false;
  const bricks = gameState.bricks || [];
  for (let r = 0; r < bricks.length; r++) {
    const row = bricks[r] || [];
    for (let c = 0; c < row.length; c++) {
      const brick = row[c];
      if (brick && brick.active && brick.type !== 'indestructible') {
        hasDestructibleBricks = true;
      }
    }
  }

  if (!hasDestructibleBricks) {
    gameState.level++;
    const MAX_LEVELS = 5;
    if (gameState.level > MAX_LEVELS) {
      gameState.gameStatus = 'win';
      gameState.gameActive = false;
      return;
    }
    gameState.currentLevel = gameState.level;
    const nextGrid = gameState.nextLevelBricks;
    const safeGrid = gridHasDestructible(nextGrid) ? nextGrid : null;
    const loaded = loadLevel(gameState.level, safeGrid, gameState.numScreens);
    if (gridHasDestructible(loaded)) {
      gameState.bricks = loaded;
    } else {
      gameState.bricks = loadLevel(1, null, gameState.numScreens);
    }
    gameState.nextLevelBricks = null;
    gameState.bricksDirty = true;
  }
}

module.exports = {
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
  updatePowerUps,
  updateGameLoop,
  servingPaddle,
  placeBallOnPaddle,
  launchGluedBall,
  stickGluedBalls,
  SERVE_HOLD_MS,
};
