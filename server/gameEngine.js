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

function loadLevel(levelNumber) {
  try {
    let newBricks = [];
    // Level 1: Simple block
    // Level 2: Hard bricks introduced
    // Level 3: Indestructible bricks introduced
    for (let row = 0; row < 8; row++) {
      let rowBricks = [];
      for (let col = 0; col < 15; col++) {
        let brickType = 'normal';
        let active = true;
        
        if (levelNumber === 2 && (row + col) % 3 === 0) {
          brickType = 'hard';
        } else if (levelNumber === 3) {
          if (row === 3 || row === 4) {
            brickType = 'indestructible';
          } else if (col % 2 === 0) {
            brickType = 'hard';
          }
        }
        
        let brick = new Brick(row, col, col * 640, 100 + row * 40, 600, 30);
        brick.type = brickType;
        brick.active = active;
        rowBricks.push(brick);
      }
      newBricks.push(rowBricks);
    }
    return newBricks;
  } catch (error) {
    console.log(error);
    return [];
  }
}

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
    // Bounce off right wall (width can be changed with rig specifications)
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
        
        if (player.paddleWidth <= 0) return true; // prevent div by zero
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

function checkBrickCollision(ball, gameState) {
  try {
    let bricks = gameState.bricks;
    let players = gameState.players;
    
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
          // Bounce off brick
          ball.vy = -ball.vy;
          
          if (brick.type === 'indestructible') {
            return true; // Just bounce
          } else if (brick.type === 'hard') {
            brick.type = 'normal'; // Crack it
            return true;
          } else {
            brick.active = false; // Break it
            
            // Add score
            if (ball.lastTouchedByPlayerId) {
              let player = players.find(p => p.id === ball.lastTouchedByPlayerId);
              if (player) {
                player.score += 100;
              }
            }
            
            // Spawn power-up (10% chance)
            if (Math.random() < 0.1) {
              gameState.powerUps.push(new PowerUp('wide_paddle', brick.x + brick.width / 2, brick.y));
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

function updatePowerUps(gameState) {
  try {
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
      let p = gameState.powerUps[i];
      if (!p.falling) continue;
      
      p.y += 5; // Fall down
      
      if (p.y > 1080) {
        gameState.powerUps.splice(i, 1);
        continue;
      }
      
      // Check paddle collision
      for (let j = 0; j < gameState.players.length; j++) {
        let player = gameState.players[j];
        if (!player.connected) continue;
        
        let withinVertical = (p.y >= player.paddleY - 20) && (p.y <= player.paddleY + 20);
        let withinHorizontal = (p.x >= player.paddleX) && (p.x <= player.paddleX + player.paddleWidth);
        
        if (withinVertical && withinHorizontal) {
          p.falling = false;
          p.active = true;
          // Apply simple effect
          if (player.id) {
            player.score += 500;
          }
          gameState.powerUps.splice(i, 1);
          break;
        }
      }
    }
  } catch (error) {
    console.log(error);
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
      checkBrickCollision(ball, gameState);

      // Check if ball falls below the bottom screen
      if (ball.y - ball.radius >= 1080) {
        ball.active = false;

        // if yes then Reset ball to the center
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

    updatePowerUps(gameState);

    // Check game over
    let totalLives = 0;
    for (let i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].connected) {
        totalLives += gameState.players[i].lives;
      }
    }
    if (totalLives <= 0 && gameState.players.some(p => p.connected)) {
      gameState.gameStatus = 'game_over';
      return;
    }

    // Check level clear
    let hasDestructibleBricks = false;
    for (let r = 0; r < gameState.bricks.length; r++) {
      for (let c = 0; c < gameState.bricks[r].length; c++) {
        let brick = gameState.bricks[r][c];
        if (brick.active && brick.type !== 'indestructible') {
          hasDestructibleBricks = true;
        }
      }
    }
    
    if (!hasDestructibleBricks) {
      gameState.level++;
      if (gameState.level > 3) {
        gameState.gameStatus = 'win';
      } else {
        gameState.bricks = loadLevel(gameState.level);
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
  loadLevel,
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
  updatePowerUps,
  updateGameLoop
};

