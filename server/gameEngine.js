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
  }
}

function loadLevel(levelNum) {
  try {
    let bricks = [];

    for (let row = 0; row < 8; row++) {
      let rowArr = [];
      for (let col = 0; col < 15; col++) {
        let type = 'normal';

        if (levelNum === 2 && (row + col) % 3 === 0) {
          type = 'hard';
        } else if (levelNum === 3) {
          if (row === 3 || row === 4) {
            type = 'indestructible';
          } else if (col % 2 === 0) {
            type = 'hard';
          }
        }

        let b = new Brick(row, col, col * 640, 100 + row * 40, 600, 30);
        b.type = type;
        b.active = true;
        rowArr.push(b);
      }
      bricks.push(rowArr);
    }

    return bricks;
  } catch (e) {
    console.log(e);
    return [];
  }
}

function moveBall(ball) {
  try {
    ball.x = ball.x + ball.vx;
    ball.y = ball.y + ball.vy;
  } catch (e) {
    console.log(e);
  }
}

function checkWallCollision(ball, state) {
  try {
    if (ball.y - ball.radius <= 0) {
      ball.vy = Math.abs(ball.vy);
    }

    if (ball.x - ball.radius <= 0) {
      ball.vx = Math.abs(ball.vx);
    } else {
      let width = (state.numScreens || 5) * 1920;
      if (ball.x + ball.radius >= width) {
        ball.vx = -Math.abs(ball.vx);
      }
    }
  } catch (e) {
    console.log(e);
  }
}

function checkPaddleCollision(ball, players) {
  try {
    for (let i = 0; i < players.length; i++) {
      let p = players[i];
      if (!p.connected) {
        continue;
      }

      let nextY = ball.y + ball.vy;
      let top = p.paddleY;

      let hitY = (nextY + ball.radius >= top - 10) && (nextY <= top);
      let hitX = (ball.x >= p.paddleX) && (ball.x <= p.paddleX + p.paddleWidth);

      if (hitY && hitX) {
        ball.vy = -Math.abs(ball.vy);

        let center = p.paddleX + (p.paddleWidth / 2);
        let offset = ball.x - center;

        if (p.paddleWidth <= 0) {
          return true;
        }

        let norm = offset / (p.paddleWidth / 2);

        if (norm <= -0.8) {
          ball.vx = -6;
        } else if (norm >= 0.8) {
          ball.vx = 6;
        }

        if (p.id) {
          ball.lastTouchedByPlayerId = p.id;
        }

        return true;
      }
    }

    return false;
  } catch (e) {
    console.log(e);
    return false;
  }
}

function checkBrickCollision(ball, state) {
  try {
    let bricks = state.bricks;
    let players = state.players;

    for (let r = 0; r < bricks.length; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        let brick = bricks[r][c];
        if (!brick.active) {
          continue;
        }

        let cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        let cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        let dx = ball.x - cx;
        let dy = ball.y - cy;
        let distSq = dx * dx + dy * dy;

        if (distSq <= ball.radius * ball.radius) {
          ball.vy = -ball.vy;

          if (brick.type === 'indestructible') {
            return true;
          }

          if (brick.type === 'hard') {
            brick.type = 'normal';
            return true;
          }

          brick.active = false;

          if (ball.lastTouchedByPlayerId) {
            let player = players.find((pl) => pl.id === ball.lastTouchedByPlayerId);
            if (player) {
              player.score += 100;
            }
          }

          if (Math.random() < 0.1) {
            state.powerUps.push(new PowerUp('wide_paddle', brick.x + brick.width / 2, brick.y));
          }

          return true;
        }
      }
    }

    return false;
  } catch (e) {
    console.log(e);
    return false;
  }
}

function updatePowerUps(state) {
  try {
    for (let i = state.powerUps.length - 1; i >= 0; i--) {
      let p = state.powerUps[i];
      if (!p.falling) {
        continue;
      }

      p.y += 5;

      if (p.y > 1080) {
        state.powerUps.splice(i, 1);
        continue;
      }

      for (let j = 0; j < state.players.length; j++) {
        let player = state.players[j];
        if (!player.connected) {
          continue;
        }

        let hitY = (p.y >= player.paddleY - 20) && (p.y <= player.paddleY + 20);
        let hitX = (p.x >= player.paddleX) && (p.x <= player.paddleX + player.paddleWidth);

        if (hitY && hitX) {
          p.falling = false;
          p.active = true;

          if (player.id) {
            player.score += 500;
          }

          state.powerUps.splice(i, 1);
          break;
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
}

function updateGameLoop(state) {
  try {
    if (state.gameStatus !== 'playing') {
      return;
    }

    for (let i = 0; i < state.balls.length; i++) {
      let ball = state.balls[i];
      if (!ball.active) {
        continue;
      }

      moveBall(ball);
      checkWallCollision(ball, state);
      checkPaddleCollision(ball, state.players);
      checkBrickCollision(ball, state);

      if (ball.y - ball.radius >= 1080) {
        ball.active = false;
        ball.x = ((state.numScreens || 5) * 1920) / 2;
        ball.y = 500;
        ball.vx = 3;
        ball.vy = 4;
        ball.active = true;

        if (ball.lastTouchedByPlayerId) {
          let player = state.players.find((pl) => pl.id === ball.lastTouchedByPlayerId);
          if (player && player.lives > 0) {
            player.lives -= 1;
          }
        }
      }
    }

    updatePowerUps(state);

    let totalLives = 0;
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].connected) {
        totalLives += state.players[i].lives;
      }
    }

    if (totalLives <= 0 && state.players.some((p) => p.connected)) {
      state.gameStatus = 'game_over';
      return;
    }

    let bricksLeft = false;
    for (let r = 0; r < state.bricks.length; r++) {
      for (let c = 0; c < state.bricks[r].length; c++) {
        let brick = state.bricks[r][c];
        if (brick.active && brick.type !== 'indestructible') {
          bricksLeft = true;
        }
      }
    }

    if (!bricksLeft) {
      state.level++;
      if (state.level > 3) {
        state.gameStatus = 'win';
      } else {
        state.bricks = loadLevel(state.level);
      }
    }
  } catch (e) {
    console.log(e);
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
