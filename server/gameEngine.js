
class Ball {
  constructor(id, x, y, vx, vy, radius){
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.active = true;
    this.lastTouchedByPlayerId = null;
    this.rallyCount = 0;
    this.currentCombo = 0;
  }
}

class Player {
  constructor(id){
    this.id = id;
    this.score = 0;
    this.lives = 3;
    this.paddleX = 2880;
    this.paddleY = 1000;
    this.paddleWidth = 300;
    this.connected = false;
    this.socketId = null;
  }
}

class Brick {
  constructor(row, col, x, y, width, height){
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
  constructor(type, x, y){
    this.type = type;
    this.x = x;
    this.y = y;
    this.active = false;
    this.falling = true;
  }
}

class GameState {
  constructor(){
    this.players = [];
    this.balls = [];
    this.bricks = [];
    this.powerUps = [];
    this.level = 1;
    this.gameStatus = 'waiting';
    this.nextLevelBricks = null;
    this.rallyCount = 0;
    this.longestRally = 0;
    this.powerupsCollected = 0;
    this.highestCombo = 0;
    this.currentCombo = 0;
    this.lastFallenBallToucher = null;
  }
}

function applyGameMasterMod(gameState, modType){
  try {
    switch(modType){
      case 'WIDE_PADDLE':
        gameState.powerUps.push(new PowerUp('wide_paddle', ((gameState.numScreens || 3)*1920)/2, 0));
        break;
      case 'EXTRA_BALL':
        let newBall = new Ball(Date.now().toString(), ((gameState.numScreens || 3)*1920)/2, 500, 3, 4, 8);
        gameState.balls.push(newBall);
        break;
      case 'SLOW_BALL':
        gameState.balls.forEach(b=>{
          b.vx *= 0.5;
          b.vy *= 0.5;
        });
        break;
    }
  } catch(e){
    console.error(e);
  }
}

function loadLevel(levelNumber, aiGeneratedGrid = null, numScreens = 3){
  try {
    let newBricks = [];
    
    if(aiGeneratedGrid && Array.isArray(aiGeneratedGrid) && aiGeneratedGrid.length > 0){
      for(let r = 0; r < aiGeneratedGrid.length; r++){
        let rowBricks = [];
        for(let c = 0; c < aiGeneratedGrid[r].length; c++){
          let val = aiGeneratedGrid[r][c];
          if(val > 0){
            let brickType = val===3 ? 'indestructible' : (val===2 ? 'hard' : 'normal');
            let xPos = 24+c*144;
            let brick = new Brick(r, c, xPos, 100+r*40, 140, 30);
            brick.type = brickType;
            rowBricks.push(brick);
          }else{
            let xPos = 24+c*144;
            let brick = new Brick(r, c, xPos, 100+r*40, 140, 30);
            brick.active = false;
            rowBricks.push(brick);
          }
        }
        newBricks.push(rowBricks);
      }
      return newBricks;
    }

    let numCols = Math.floor(((numScreens * 1920) - 48) / 144);
    for(let row = 0; row < 8; row++){
      let rowBricks = [];
      for(let col = 0; col < numCols; col++){
        let brickType = 'normal';
        let active = true;
        
        if(levelNumber===2 && (row+col) % 3===0){
          brickType = 'hard';
        }else if(levelNumber===3){
          if(row===3 || row===4){
            brickType = 'indestructible';
          }else if(col % 2===0){
            brickType = 'hard';
          }
        }
        
        let xPos = 24+col*144;
        let brick = new Brick(row, col, xPos, 100+row*40, 140, 30);
        brick.type = brickType;
        brick.active = active;
        rowBricks.push(brick);
      }
      newBricks.push(rowBricks);
    }
    return newBricks;
  } catch(error){
    console.log(error);
    return [];
  }
}

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
    }
    if(ball.x-ball.radius<=0){
      ball.vx = Math.abs(ball.vx);
    }else{
      let totalWidth = (gameState.numScreens || 3)*1920;
      if(ball.x+ball.radius>=totalWidth){
        ball.vx = -Math.abs(ball.vx);
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
      if(!player.connected) continue;

      let prevY = ball.y;
      let nextY = ball.y + ball.vy;
      let paddleTop = player.paddleY;

      let crossedPaddleTop = (prevY + ball.radius <= paddleTop + 5) && (nextY + ball.radius >= paddleTop - 5);
      let withinHorizontal = (ball.x >= player.paddleX - 10) && (ball.x <= player.paddleX + player.paddleWidth + 10);

      if(crossedPaddleTop && withinHorizontal){
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
        let distanceSquared = (dx*dx)+(dy*dy);

        if(distanceSquared<=(ball.radius*ball.radius)){
          if(Math.abs(dx) > Math.abs(dy)){
            ball.vx = -ball.vx;
          }else{
            ball.vy = -ball.vy;
          }
          
          if(brick.type==='indestructible'){
            return true;
          }else if(brick.type==='hard'){
            brick.type = 'normal';
            return true;
          }else{
            brick.active = false;
            
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
      
      if(p.y > 1080){
        gameState.powerUps.splice(i, 1);
        continue;
      }
      
      for(let j = 0; j < gameState.players.length; j++){
        let player = gameState.players[j];
        if(!player.connected) continue;
        
        let withinVertical = (p.y>=player.paddleY-20) && (p.y<=player.paddleY+20);
        let withinHorizontal = (p.x>=player.paddleX) && (p.x<=player.paddleX+player.paddleWidth);
        
        if(withinVertical && withinHorizontal){
          p.falling = false;
          p.active = true;
          p.activatedAt = Date.now();
          gameState.powerupsCollected = (gameState.powerupsCollected || 0) + 1;
          if(player.id){
            player.score += 50;
            if(applyPowerUpEffectCallback){
              applyPowerUpEffectCallback(player, p.type);
            }
          }
          break;
        }
      }
    }

    // Clean up old active powerups (they should last ~8 seconds based on timers)
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

      moveBall(ball);
      checkWallCollision(ball, gameState);
      const hitPaddle = checkPaddleCollision(ball, gameState.players);
      if (hitPaddle) {
        gameState.rallyCount++;
        if (gameState.rallyCount > gameState.longestRally) {
          gameState.longestRally = gameState.rallyCount;
        }
        gameState.currentCombo = 0;
      }
      const hitBrick = checkBrickCollision(ball, gameState);
      if (hitBrick) {
        gameState.currentCombo++;
        if (gameState.currentCombo > gameState.highestCombo) {
          gameState.highestCombo = gameState.currentCombo;
        }
      }

      if(ball.y-ball.radius>=1080){
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
      if(!playerToDeduct){
         playerToDeduct = gameState.players.find(p=>p.connected);
      }
      if(playerToDeduct && playerToDeduct.lives > 0){
        playerToDeduct.lives -= 1;
        playerToDeduct.score = Math.max(0, playerToDeduct.score-10);
      }
      gameState.lastFallenBallToucher = null;
      
      let mainBall = gameState.balls[0];
      mainBall.x = ((gameState.numScreens || 3)*1920)/2;
      mainBall.y = 500;
      mainBall.vx = 3;
      mainBall.vy = 4;
      mainBall.active = true;
      mainBall.lastTouchedByPlayerId = null;
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
      gameState.bricks = loadLevel(gameState.level, gameState.nextLevelBricks, gameState.numScreens);
      gameState.nextLevelBricks = null;
    }

  } catch(error){
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

