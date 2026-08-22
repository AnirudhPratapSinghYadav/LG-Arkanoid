'use strict';

const { SCREEN_WIDTH, PADDLE_HEIGHT, CANVAS_HEIGHT } = require('./layout.js');
const { Ball, PowerUp } = require('./entities.js');
const { getRespawnVelocity } = require('./speeds.js');
const { loadLevel } = require('./levels.js');

function moveBall(ball){
  try {
    ball.x += ball.vx;
    ball.y += ball.vy;
  } catch(error){
    console.log(error);
  }
}

function checkWallCollision(ball, gameState){
  try {
    if(ball.y-ball.radius<=0){
      ball.vy = Math.abs(ball.vy);
      ball.y = ball.radius;
    }
    if(ball.x-ball.radius<=0){
      ball.vx = Math.abs(ball.vx);
      ball.x = ball.radius;
    }else{
      let totalWidth = (gameState.numScreens || 3) * SCREEN_WIDTH;
      if(ball.x+ball.radius>=totalWidth){
        ball.vx = -Math.abs(ball.vx);
        ball.x = totalWidth - ball.radius;
      }
    }
  } catch(error){
    console.log(error);
  }
}

function checkPaddleCollision(ball, players){
  try {
    if (ball.vy <= 0) return false;

      for(let i = 0; i < players.length; i++){
        let player = players[i];
        if(!player.connected || player.lives <= 0) continue;

        let paddleTop = player.paddleY;
        let paddleH = player.paddleHeight || PADDLE_HEIGHT;
        let paddleBottom = player.paddleY + paddleH;
        let paddleLeft = player.paddleX;
        let paddleRight = player.paddleX + player.paddleWidth;

        let closestX = Math.max(paddleLeft, Math.min(ball.x, paddleRight));
        let closestY = Math.max(paddleTop, Math.min(ball.y, paddleBottom));

        let dx = ball.x - closestX;
        let dy = ball.y - closestY;
        if (dx === 0 && dy === 0) { dx = 0.001; dy = 0.001; }

        if ((dx*dx + dy*dy) <= (ball.radius * ball.radius)) {
          let prevY = (typeof ball._prevY === 'number') ? ball._prevY : (ball.y - ball.vy);

          if (prevY + ball.radius <= paddleTop + 5) {
            ball.y = paddleTop - ball.radius - 2;
            let paddleCenter = player.paddleX + (player.paddleWidth / 2);
            let offset = ball.x - paddleCenter;
            if(player.paddleWidth <= 0) return true;
            let normalized = Math.max(-1, Math.min(1, offset / (player.paddleWidth / 2)));
            let bounceAngle = normalized * (Math.PI / 3);
            let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            speed = Math.min(25, Math.max(8, speed * 1.02));
            ball.vx = speed * Math.sin(bounceAngle);
            ball.vy = -speed * Math.cos(bounceAngle);
          } else {
            ball.vx = -ball.vx;
            if (ball.x < paddleLeft) ball.x = paddleLeft - ball.radius - 2;
            else if (ball.x > paddleRight) ball.x = paddleRight + ball.radius + 2;
          }

          if(player.id){
            ball.lastTouchedByPlayerId = player.id;
          }
          return true;
        }
      }
    return false;
  } catch(error){
    console.log(error);
    return false;
  }
}

function checkBrickCollision(ball, gameState){
  try {
    let bricks = gameState.bricks;
    let players = gameState.players;

    for(let r = 0; r < bricks.length; r++){
      for(let c = 0; c < bricks[r].length; c++){
        let brick = bricks[r][c];
        if(!brick.active) continue;

        let closestX = Math.max(brick.x, Math.min(ball.x, brick.x+brick.width));
        let closestY = Math.max(brick.y, Math.min(ball.y, brick.y+brick.height));
        let dx = ball.x-closestX;
        let dy = ball.y-closestY;

        if (dx === 0 && dy === 0) {
          dx = 0.001;
          dy = 0.001;
        }

        let distanceSquared = (dx*dx)+(dy*dy);

        if(distanceSquared<=(ball.radius*ball.radius)){
          const dist = Math.sqrt(distanceSquared) || 0.01;
          const nx = dx/dist, ny = dy/dist;

          const overlap = ball.radius - dist;
          if (overlap > 0) {
            ball.x += nx * overlap;
            ball.y += ny * overlap;
          }

          const dot = ball.vx*nx + ball.vy*ny;
          if (dot < 0) {
            ball.vx -= 2*dot*nx;
            ball.vy -= 2*dot*ny;
          }

          if(brick.type==='indestructible'){
            return true;
          }else if(brick.type==='hard'){
            brick.type = 'normal';
            gameState.bricksDirty = true;
            return true;
          }else{
            brick.active = false;
            gameState.bricksDirty = true;

            if(ball.lastTouchedByPlayerId){
              let player = players.find(p=>p.id===ball.lastTouchedByPlayerId);
              if(player){
                player.score += 10;
              }
            }

            if(Math.random() < 0.1){
              let pool = ['wide_paddle', 'slow_ball', 'multi_ball', 'bomb'];
              let drop = pool[Math.floor(Math.random()*pool.length)];
              gameState.powerUps.push(new PowerUp(drop, brick.x+brick.width/2, brick.y));
            }
            return true;
          }
        }
      }
    }
    return false;
  } catch(error){
    console.log(error);
    return false;
  }
}

function updatePowerUps(gameState, applyPowerUpEffectCallback){
  try {
    for(let i = gameState.powerUps.length-1; i>=0; i--){
      let p = gameState.powerUps[i];
      if(!p.falling) continue;

      p.y += 5;

      if(p.y > CANVAS_HEIGHT){
        gameState.powerUps.splice(i, 1);
        continue;
      }

      for(let j = 0; j < gameState.players.length; j++){
        let player = gameState.players[j];
        if(!player.connected || player.lives <= 0) continue;

        let withinVertical = (p.y>=player.paddleY-20) && (p.y<=player.paddleY+20);
        let withinHorizontal = (p.x>=player.paddleX) && (p.x<=player.paddleX+player.paddleWidth);

        if(withinVertical && withinHorizontal){
          p.falling = false;
          p.active = true;
          p.activatedAt = Date.now();
          gameState.powerupsCollected = (gameState.powerupsCollected || 0) + 1;
          if(player.id){
            player.score += 50;
            if(!Array.isArray(player.inventory)) player.inventory = [];
            if(p.type === 'bomb'){
              if(applyPowerUpEffectCallback){
                applyPowerUpEffectCallback(player, p.type, p.x, p.y);
              }
            } else if(player.inventory.length < 3){
              player.inventory.push(p.type);
            }
          }
          break;
        }
      }
    }

    for(let i = gameState.powerUps.length-1; i>=0; i--){
      let p = gameState.powerUps[i];
      if(!p.falling && p.activatedAt && Date.now()-p.activatedAt > 10000){
        gameState.powerUps.splice(i, 1);
      }
    }
  } catch(error){
    console.log(error);
  }
}

function updateGameLoop(gameState, applyPowerUpEffectCallback){
  try {
    if(gameState.gameStatus!=='playing') return;

    for(let i = 0; i < gameState.balls.length; i++){
      let ball = gameState.balls[i];
      if(!ball.active) continue;

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

      if(ball.y-ball.radius>=CANVAS_HEIGHT){
        ball.active = false;
        if(ball.lastTouchedByPlayerId){
          gameState.lastFallenBallToucher = ball.lastTouchedByPlayerId;
        }
      }
    }

    if(!gameState.balls.some(b=>b.active)){
      gameState.rallyCount = 0;
      gameState.currentCombo = 0;
      let playerToDeduct = gameState.players.find(p=>p.id===gameState.lastFallenBallToucher);
      if(!playerToDeduct || playerToDeduct.lives <= 0){
        const connectedWithLives = gameState.players.filter(p=>p.connected && p.lives > 0);
        if(connectedWithLives.length > 0){
          gameState._fallbackDeductCursor = ((gameState._fallbackDeductCursor || 0) + 1) % connectedWithLives.length;
          playerToDeduct = connectedWithLives[gameState._fallbackDeductCursor];
        } else {
          playerToDeduct = null;
        }
      }
      if(playerToDeduct && playerToDeduct.lives > 0){
        playerToDeduct.lives -= 1;
        playerToDeduct.score = Math.max(0, playerToDeduct.score-10);
      }
      gameState.lastFallenBallToucher = null;

      let mainBall = gameState.balls[0] || gameState.balls.find(Boolean);
      if(!mainBall){
        mainBall = new Ball('ball_1', 0, 0, 0, 0, 8);
        gameState.balls.push(mainBall);
      }
      mainBall.x = ((gameState.numScreens || 3) * SCREEN_WIDTH)/2;
      mainBall.y = 500;
      const respawn = getRespawnVelocity(gameState);
      mainBall.vx = respawn.vx;
      mainBall.vy = respawn.vy;
      mainBall.active = true;
      mainBall.lastTouchedByPlayerId = null;
      mainBall.rallyCount = 0;
      mainBall.currentCombo = 0;
    }

    updatePowerUps(gameState, applyPowerUpEffectCallback);

    let totalLives = 0;
    for(let i = 0; i < gameState.players.length; i++){
      if(gameState.players[i].connected){
        totalLives += gameState.players[i].lives;
      }
    }
    if(totalLives<=0 && gameState.players.some(p=>p.connected)){
      gameState.gameStatus = 'game_over';
      gameState.gameActive = false;
      return;
    }

    let hasDestructibleBricks = false;
    for(let r = 0; r < gameState.bricks.length; r++){
      for(let c = 0; c < gameState.bricks[r].length; c++){
        let brick = gameState.bricks[r][c];
        if(brick.active && brick.type!=='indestructible'){
          hasDestructibleBricks = true;
        }
      }
    }

    if(!hasDestructibleBricks){
      gameState.level++;
      const MAX_LEVELS = 5;
      if(gameState.level > MAX_LEVELS){
        gameState.gameStatus = 'win';
        gameState.gameActive = false;
        return;
      }
      gameState.currentLevel = gameState.level;
      const nextGrid = gameState.nextLevelBricks;
      let safeGrid = nextGrid;
      if(Array.isArray(nextGrid)){
        const gridHasDestructible = nextGrid.some(row =>
          Array.isArray(row) && row.some(cell => cell !== 3 && cell !== 0)
        );
        if(!gridHasDestructible) safeGrid = null;
      }
      gameState.bricks = loadLevel(gameState.level, safeGrid, gameState.numScreens);
      gameState.nextLevelBricks = null;
      gameState.bricksDirty = true;
    }

  } catch(error){
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
};
