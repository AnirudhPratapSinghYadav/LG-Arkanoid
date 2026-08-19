const gameEngine = require('../gameEngine.js');
const { BALL_RADIUS } = require('../config.js');
const { triggerCommentary } = require('../services/geminiService.js');

function clearPlayerTimers(player) {
  if (player.widePaddleTimer) {
    clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = null;
  }
  if (player.slowBallTimer) {
    clearTimeout(player.slowBallTimer);
    player.slowBallTimer = null;
  }
}

function clearAllPowerUpTimers(worldState) {
  for (const player of worldState.players) {
    clearPlayerTimers(player);
  }
}

function clampPaddleX(player, worldState) {
  const frameW = worldState.screenWidth || gameEngine.SCREEN_WIDTH;
  const world = (worldState.numScreens || 3) * frameW;
  const pw = player.paddleWidth || gameEngine.DEFAULT_PADDLE_WIDTH;
  player.paddleX = Math.max(0, Math.min(world - pw, player.paddleX));
}

function applyBombPowerUp(worldState, player, px, py) {
  if (!worldState.bricks) return;

  let epicenterX = px;
  let epicenterY = py;

  if (epicenterX === undefined || epicenterY === undefined) {
    const activeBall = worldState.balls.find((b) => b.active);
    if (!activeBall) return;
    epicenterX = activeBall.x;
    epicenterY = activeBall.y;
  }

  const frameW = worldState.screenWidth || gameEngine.SCREEN_WIDTH;
  const blastRadius = Math.round(350 * (frameW / gameEngine.LANDSCAPE_SCREEN_WIDTH));
  for (let r = 0; r < worldState.bricks.length; r++) {
    const row = worldState.bricks[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const brick = row[c];
      if (!brick || !brick.active || brick.type === 'indestructible') continue;

      const brickCenterX = brick.x + brick.width / 2;
      const brickCenterY = brick.y + brick.height / 2;
      const dist = Math.hypot(epicenterX - brickCenterX, epicenterY - brickCenterY);

      if (dist <= blastRadius) {
        brick.active = false;
        worldState.bricksDirty = true;
        if (player) {
          player.score += 10;
        }
      }
    }
  }
}

function applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot, px, py) {
  if (powerUpType === 'wide_paddle') {
    const normalW = gameEngine.DEFAULT_PADDLE_WIDTH;
    player.paddleWidth = normalW * 2;
    clampPaddleX(player, worldState);
    if (player.widePaddleTimer) clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = setTimeout(() => {
      player.paddleWidth = normalW;
      clampPaddleX(player, worldState);
      player.widePaddleTimer = null;
    }, 8000);
  } else if (powerUpType === 'slow_ball') {
    if (!worldState.slowBallActive) {
      for (const ball of worldState.balls) {
        if (ball.active) {
          ball.vx *= 0.5;
          ball.vy *= 0.5;
        }
      }
      worldState.slowBallActive = true;
    }
    if (worldState.slowBallTimer) clearTimeout(worldState.slowBallTimer);
    worldState.slowBallTimer = setTimeout(() => {
      if (worldState.slowBallActive) {
        for (const ball of worldState.balls) {
          if (ball.active) {
            ball.vx *= 2.0;
            ball.vy *= 2.0;
          }
        }
        worldState.slowBallActive = false;
        worldState.slowBallTimer = null;
      }
    }, 8000);
  } else if (powerUpType === 'multi_ball') {
    const sourceBall = worldState.balls.find((b) => b.active);
    let targetBall = worldState.balls.find((b) => !b.active);
    if (!targetBall && sourceBall) {
      targetBall = new gameEngine.Ball(`ball_${worldState.balls.length + 1}`, 0, 0, 0, 0, BALL_RADIUS);
      worldState.balls.push(targetBall);
    }
    if (sourceBall && targetBall) {
      targetBall.x = sourceBall.x;
      targetBall.y = sourceBall.y;
      targetBall.vx = -sourceBall.vx;
      targetBall.vy = sourceBall.vy;
      targetBall.active = true;
      targetBall.lastTouchedByPlayerId = player.id;
      triggerCommentary('multi_ball', getWorldSnapshot(), io, worldState.commentaryRateLimiter, worldState);
    }
  } else if (powerUpType === 'bomb') {
    applyBombPowerUp(worldState, player, px, py);
  }
}

module.exports = {
  clearPlayerTimers,
  clearAllPowerUpTimers,
  applyBombPowerUp,
  applyPowerUpEffect,
};
