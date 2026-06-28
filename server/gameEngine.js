// Game State Models

class Ball {
  constructor(id, x, y, vx, vy, radius) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.active = true;
    this.lastTouchedByPlayerId = null;
  }
}

class Player {
  constructor(id) {
    this.id = id;
    this.score = 0;
    this.lives = 3;
    this.paddleX = 4800;
    this.paddleY = 1000;
    this.paddleWidth = 300;
    this.connected = false;
    this.socketId = null;
  }
}

class Brick {
  constructor(row, col, x, y, width, height) {
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.active = true;
    this.type = 'normal'; // can be 'hard' or 'indestructible' later
  }
}

class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.active = false;
    this.falling = true;
  }
}

class GameState {
  constructor() {
    this.players = [];
    this.balls = [];
    this.bricks = [];
    this.powerUps = [];
    this.level = 1;
    this.gameStatus = 'waiting';
  }
}

// Physics engine is taken from AI but understood
function moveBall(ball) {
  try {
    ball.x += ball.vx;
    ball.y += ball.vy;
  } catch (error) {
    console.log(error);
  }
}

function checkWallCollision(ball) {
  try {
    // Bounce off top wall
    if (ball.y - ball.radius <= 0) {
      ball.vy = Math.abs(ball.vy);
    }
    // Bounce off left wall
    if (ball.x - ball.radius <= 0) {
      ball.vx = Math.abs(ball.vx);
    } 
    // Bounce off right wall (assuming max width is 9600 for LG rig)
    else if (ball.x + ball.radius >= 9600) {
      ball.vx = -Math.abs(ball.vx);
    }
  } catch (error) {
    console.log(error);
  }
}

function checkPaddleCollision(ball, players) {
  try {
    for (let i = 0; i < players.length; i++) {
      let player = players[i];
      if (!player.connected) continue;

      let nextY = ball.y + ball.vy;
      let paddleTop = player.paddleY;
      
      let withinVertical = (nextY + ball.radius >= paddleTop - 10) && (nextY <= paddleTop);
      let withinHorizontal = (ball.x >= player.paddleX) && (ball.x <= player.paddleX + player.paddleWidth);

      if (withinVertical && withinHorizontal) {
        ball.vy = -Math.abs(ball.vy);
        
        let paddleCenter = player.paddleX + (player.paddleWidth / 2);
        let offset = ball.x - paddleCenter;
        let normalized = offset / (player.paddleWidth / 2);
        
        if (normalized <= -0.8) {
          ball.vx = -6;
        } else if (normalized >= 0.8) {
          ball.vx = 6;
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

function checkBrickCollision(ball, bricks, players) {
  try {
    for (let r = 0; r < bricks.length; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        let brick = bricks[r][c];
        if (!brick.active) continue;

        let closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        let closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        let dx = ball.x - closestX;
        let dy = ball.y - closestY;
        let distanceSquared = (dx * dx) + (dy * dy);

        if (distanceSquared <= (ball.radius * ball.radius)) {
          brick.active = false;
          ball.vy = -ball.vy;
          
          if (ball.lastTouchedByPlayerId) {
            let player = players.find(p => p.id === ball.lastTouchedByPlayerId);
            if (player) {
              player.score += 100;
            }
          }
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
}

function updateGameLoop(gameState) {
  try {
    if (gameState.gameStatus !== 'playing') return;

    for (let i = 0; i < gameState.balls.length; i++) {
      let ball = gameState.balls[i];
      if (!ball.active) continue;

      moveBall(ball);
      checkWallCollision(ball);
      checkPaddleCollision(ball, gameState.players);
      checkBrickCollision(ball, gameState.bricks, gameState.players);

      // Check if ball falls below the bottom screen
      if (ball.y - ball.radius >= 1080) {
        ball.active = false;
        
        // Reset ball to the center
        ball.x = 4800;
        ball.y = 500;
        ball.vx = 3;
        ball.vy = 4;
        ball.active = true;
        
        if (ball.lastTouchedByPlayerId) {
          let player = gameState.players.find(p => p.id === ball.lastTouchedByPlayerId);
          if (player && player.lives > 0) {
            player.lives -= 1;
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  Ball,
  Player,
  Brick,
  PowerUp,
  GameState,
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
  updateGameLoop
};
