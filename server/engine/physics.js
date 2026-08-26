'use strict';

const { SCREEN_WIDTH, CANVAS_HEIGHT } = require('./layout.js');
const { Ball } = require('./entities.js');
const { loadLevel } = require('./levels.js');
const { getRespawnVelocity } = require('./speeds.js');
const {
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
} = require('./collisions.js');

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
  ball.lastTouchedByPlayerId = player.id || null;
}

function launchGluedBall(ball, gameState) {
  if (!ball) return;
  const v = getRespawnVelocity(gameState);
  ball.glued = false;
  ball.active = true;
  ball.vx = v.vx;
  ball.vy = v.vy;
}

function stickGluedBalls(gameState, player) {
  if (!player) return;
  (gameState.balls || []).forEach((b) => {
    if (!b || !b.glued || !b.active) return;
    if (b.lastTouchedByPlayerId && b.lastTouchedByPlayerId !== player.id) return;
    placeBallOnPaddle(b, player);
  });
}

function updatePowerUps(gameState, applyPowerUpEffectCallback) {
  try {
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
      const p = gameState.powerUps[i];
      if (!p.falling) continue;

      p.y += 5;

      if (p.y > CANVAS_HEIGHT) {
        gameState.powerUps.splice(i, 1);
        continue;
      }

      for (let j = 0; j < gameState.players.length; j++) {
        const player = gameState.players[j];
        if (!player.connected || player.lives <= 0) continue;

        const withinVertical = (p.y >= player.paddleY - 20) && (p.y <= player.paddleY + 20);
        const withinHorizontal = (p.x >= player.paddleX) && (p.x <= player.paddleX + player.paddleWidth);

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
  } catch (error) {
    console.log(error);
  }
}

function updateGameLoop(gameState, applyPowerUpEffectCallback) {
  try {
    if (gameState.gameStatus !== 'playing') return;
    // Wi-Fi blip: every paddle is disconnected during the 30s resume window.
    // Freeze the court so lives/score cannot drain on an empty HDMI wall.
    if (!(gameState.players || []).some((p) => p.connected)) return;

    for (let i = 0; i < gameState.balls.length; i++) {
      const ball = gameState.balls[i];
      if (!ball.active) continue;
      if (ball.glued) {
        const holder = servingPaddle(gameState);
        if (holder) placeBallOnPaddle(ball, holder);
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
        (p) => p.id === gameState.lastFallenBallToucher && p.connected
      );
      if (!playerToDeduct || playerToDeduct.lives <= 0) {
        const connectedWithLives = gameState.players.filter((p) => p.connected && p.lives > 0);
        if (connectedWithLives.length > 0) {
          gameState._fallbackDeductCursor = ((gameState._fallbackDeductCursor || 0) + 1) % connectedWithLives.length;
          playerToDeduct = connectedWithLives[gameState._fallbackDeductCursor];
        } else {
          playerToDeduct = null;
        }
      }
      if (playerToDeduct && playerToDeduct.lives > 0) {
        playerToDeduct.lives -= 1;
        playerToDeduct.score = Math.max(0, playerToDeduct.score - 10);
      }
      const holder = (playerToDeduct && playerToDeduct.lives > 0)
        ? playerToDeduct
        : servingPaddle(gameState);
      gameState.lastFallenBallToucher = null;

      let mainBall = gameState.balls[0] || gameState.balls.find(Boolean);
      if (!mainBall) {
        mainBall = new Ball('ball_1', 0, 0, 0, 0, 8);
        gameState.balls.push(mainBall);
      }
      if (holder) placeBallOnPaddle(mainBall, holder);
      else {
        mainBall.x = ((gameState.numScreens || 3) * SCREEN_WIDTH) / 2;
        mainBall.y = 500;
      }
      launchGluedBall(mainBall, gameState);
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
    for (let r = 0; r < gameState.bricks.length; r++) {
      for (let c = 0; c < gameState.bricks[r].length; c++) {
        const brick = gameState.bricks[r][c];
        if (brick.active && brick.type !== 'indestructible') {
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
      let safeGrid = nextGrid;
      if (Array.isArray(nextGrid)) {
        const gridHasDestructible = nextGrid.some((row) =>
          Array.isArray(row) && row.some((cell) => cell !== 3 && cell !== 0)
        );
        if (!gridHasDestructible) safeGrid = null;
      }
      gameState.bricks = loadLevel(gameState.level, safeGrid, gameState.numScreens);
      gameState.nextLevelBricks = null;
      gameState.bricksDirty = true;
    }
  } catch (error) {
    console.log(error);
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
};
