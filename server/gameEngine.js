
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
    this.type = 'normal';
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
    this.nextLevelBricks = null;
  }
}

function applyGameMasterMod(gameState, modType) {
  try {
    switch(modType) {
      case 'WIDE_PADDLE':
        // Spawn wide paddle at center top of screen 3 (assuming 5 screens)
        gameState.powerUps.push(new PowerUp('wide_paddle', (gameState.numScreens * 1920) / 2, 0));
        break;
      case 'EXTRA_BALL':
        let newBall = new Ball(Date.now().toString(), (gameState.numScreens * 1920) / 2, 500, 3, 4, 8);
        gameState.balls.push(newBall);
        break;
      case 'SLOW_BALL':
        gameState.balls.forEach(b => {
          b.vx *= 0.5;
          b.vy *= 0.5;
        });
        break;
    }
  } catch (e) {
    console.error(e);
  }
}

function loadLevel(levelNumber, aiGeneratedGrid = null) {
  try {
    let newBricks = [];
    
    // If we have a pre-generated grid from AI, use it
    if (aiGeneratedGrid && Array.isArray(aiGeneratedGrid) && aiGeneratedGrid.length > 0) {
      for (let r = 0; r < aiGeneratedGrid.length; r++) {
        let rowBricks = [];
        for (let c = 0; c < aiGeneratedGrid[r].length; c++) {
          let val = aiGeneratedGrid[r][c];
          if (val > 0) {
            let brickType = val === 3 ? 'indestructible' : (val === 2 ? 'hard' : 'normal');
            // Assuming 8 rows and 15 columns for the grid mapping to coordinates
            let brick = new Brick(r, c, c * 640, 100 + r * 40, 600, 30);
            brick.type = brickType;
            rowBricks.push(brick);
          } else {
            // Placeholder for empty space so indices match
            let brick = new Brick(r, c, c * 640, 100 + r * 40, 600, 30);
            brick.active = false;
            rowBricks.push(brick);
          }
        }
        newBricks.push(rowBricks);
      }
      return newBricks;
    }

    // Fallback hardcoded logic
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

function checkWallCollision(ball, gameState) {
  try {
    if (ball.y - ball.radius <= 0) {
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.x - ball.radius <= 0) {
      ball.vx = Math.abs(ball.vx);
    }
    else {
      let totalWidth = (gameState.numScreens || 5) * 1920;
      if (ball.x + ball.radius >= totalWidth) {
        ball.vx = -Math.abs(ball.vx);
      }
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
        
        if (player.paddleWidth <= 0) return true;
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
          ball.vy = -ball.vy;
          
          if (brick.type === 'indestructible') {
            return true;
          } else if (brick.type === 'hard') {
            brick.type = 'normal';
            return true;
          } else {
            brick.active = false;
            
            if (ball.lastTouchedByPlayerId) {
              let player = players.find(p => p.id === ball.lastTouchedByPlayerId);
              if (player) {
                player.score += 100;
              }
            }
            
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
      
      p.y += 5;
      
      if (p.y > 1080) {
        gameState.powerUps.splice(i, 1);
        continue;
      }
      
      for (let j = 0; j < gameState.players.length; j++) {
        let player = gameState.players[j];
        if (!player.connected) continue;
        
        let withinVertical = (p.y >= player.paddleY - 20) && (p.y <= player.paddleY + 20);
        let withinHorizontal = (p.x >= player.paddleX) && (p.x <= player.paddleX + player.paddleWidth);
        
        if (withinVertical && withinHorizontal) {
          p.falling = false;
          p.active = true;
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
      checkWallCollision(ball, gameState);
      checkPaddleCollision(ball, gameState.players);
      checkBrickCollision(ball, gameState);

      if (ball.y - ball.radius >= 1080) {
        ball.active = false;
        ball.x = ((gameState.numScreens || 5) * 1920) / 2;
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
      if (gameState.level > 3) { // Let's keep endless or 3? Let's say endless if AI generates it
        // Actually, let's keep the win state at level 999 for now
        // But for standard demo, maybe 5 levels.
      }
      gameState.bricks = loadLevel(gameState.level, gameState.nextLevelBricks);
      gameState.nextLevelBricks = null; // Reset it so index.js knows to fetch the next one
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
  updateGameLoop,
  applyGameMasterMod
};

