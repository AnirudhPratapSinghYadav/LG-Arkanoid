'use strict';

const { SCREEN_WIDTH, PADDLE_HEIGHT } = require('./layout.js');
const { PowerUp } = require('./entities.js');

function creditBrick(players, ball) {
  let player = ball.lastTouchedByPlayerId
    ? players.find((p) => p.id === ball.lastTouchedByPlayerId)
    : null;
  if (!player) player = players.find((p) => p.connected && p.lives > 0);
  if (player) player.score += 10;
}

function moveBall(ball) {
  try {
    ball.x += ball.vx;
    ball.y += ball.vy;
  } catch (error) {
    console.log(error);
  }
}

function checkWallCollision(ball, gameState) {
  try {
    if (ball.y - ball.radius <= 0) {
      ball.vy = Math.abs(ball.vy);
      ball.y = ball.radius;
    }
    if (ball.x - ball.radius <= 0) {
      ball.vx = Math.abs(ball.vx);
      ball.x = ball.radius;
    } else {
      const totalWidth = (gameState.numScreens || 3) * SCREEN_WIDTH;
      if (ball.x + ball.radius >= totalWidth) {
        ball.vx = -Math.abs(ball.vx);
        ball.x = totalWidth - ball.radius;
      }
    }
  } catch (error) {
    console.log(error);
  }
}

function checkPaddleCollision(ball, players) {
  try {
    if (ball.vy <= 0) return false;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (!player.connected || player.lives <= 0) continue;

      const paddleTop = player.paddleY;
      const paddleH = player.paddleHeight || PADDLE_HEIGHT;
      const paddleBottom = player.paddleY + paddleH;
      const paddleLeft = player.paddleX;
      const paddleRight = player.paddleX + player.paddleWidth;

      const closestX = Math.max(paddleLeft, Math.min(ball.x, paddleRight));
      const closestY = Math.max(paddleTop, Math.min(ball.y, paddleBottom));

      let dx = ball.x - closestX;
      let dy = ball.y - closestY;
      if (dx === 0 && dy === 0) { dx = 0.001; dy = 0.001; }

      if ((dx * dx + dy * dy) <= (ball.radius * ball.radius)) {
        const prevY = (typeof ball._prevY === 'number') ? ball._prevY : (ball.y - ball.vy);

        if (prevY + ball.radius <= paddleTop + 5) {
          ball.y = paddleTop - ball.radius - 2;
          const paddleCenter = player.paddleX + (player.paddleWidth / 2);
          const offset = ball.x - paddleCenter;
          if (player.paddleWidth <= 0) return true;
          const normalized = Math.max(-1, Math.min(1, offset / (player.paddleWidth / 2)));
          const bounceAngle = normalized * (Math.PI / 3);
          let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          speed = Math.min(25, Math.max(8, speed * 1.02));
          ball.vx = speed * Math.sin(bounceAngle);
          ball.vy = -speed * Math.cos(bounceAngle);
        } else {
          ball.vx = -ball.vx;
          if (ball.x < paddleLeft) ball.x = paddleLeft - ball.radius - 2;
          else if (ball.x > paddleRight) ball.x = paddleRight + ball.radius + 2;
        }

        if (player.id) {
          ball.lastTouchedByPlayerId = player.id;
        }
        return true;
      }
    }
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
}

function checkBrickCollision(ball, gameState) {
  try {
    const bricks = gameState.bricks;
    const players = gameState.players;

    for (let r = 0; r < bricks.length; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        const brick = bricks[r][c];
        if (!brick.active) continue;

        const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        let dx = ball.x - closestX;
        let dy = ball.y - closestY;

        if (dx === 0 && dy === 0) {
          dx = 0.001;
          dy = 0.001;
        }

        const distanceSquared = (dx * dx) + (dy * dy);

        if (distanceSquared <= (ball.radius * ball.radius)) {
          const dist = Math.sqrt(distanceSquared) || 0.01;
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = ball.radius - dist;
          if (overlap > 0) {
            ball.x += nx * overlap;
            ball.y += ny * overlap;
          }

          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
          }

          if (brick.type === 'indestructible') {
            return true;
          } else if (brick.type === 'hard') {
            brick.type = 'normal';
            gameState.bricksDirty = true;
            return true;
          } else {
            brick.active = false;
            gameState.bricksDirty = true;

            creditBrick(players, ball);

            if (Math.random() < 0.1) {
              const pool = ['wide_paddle', 'slow_ball', 'multi_ball', 'bomb'];
              const drop = pool[Math.floor(Math.random() * pool.length)];
              gameState.powerUps.push(new PowerUp(drop, brick.x + brick.width / 2, brick.y));
            }
            return true;
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
}

module.exports = {
  creditBrick,
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
};
