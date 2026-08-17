// ---------------------------------------------------------------------------
// Frame geometry.
//
// A Liquid Galaxy frame is a 1920x1080 panel that the rig usually rotates to
// portrait: /etc/X11/Xsession.d/45x11-custom_xrandr rotates by DHCP_RANDR,
// which defaults to "right". So the browser viewport is 1080x1920 on a stock
// rig and 1920x1080 only when the panels are left unrotated.
//
// Like every other LG game (galaxy-pacman derives its whole grid from
// window.innerHeight, galaxy-asteroids from window.innerWidth), we normalise on
// height: the logical court is always CANVAS_HEIGHT tall and each frame is
// CANVAS_HEIGHT * aspect wide. Everything vertical therefore stays fixed while
// horizontal sizes scale, which keeps a level's brick layout identical in both
// orientations instead of letterboxing the court into a third of the screen.
// ---------------------------------------------------------------------------
const CANVAS_HEIGHT = 1080;
const LANDSCAPE_SCREEN_WIDTH = 1920;

/** Frame aspect (width/height) from the environment; see docs/lg-setup.md. */
function resolveFrameAspect(env) {
  const e = env || process.env;
  const clamp = (v) => (Number.isFinite(v) && v >= 0.25 && v <= 4 ? v : null);

  const explicit = String(e.LG_FRAME_ASPECT || '').trim();
  if (explicit) {
    const ratio = explicit.split(':');
    if (ratio.length === 2) {
      const w = Number.parseFloat(ratio[0]);
      const h = Number.parseFloat(ratio[1]);
      const v = clamp(w / h);
      if (v) return v;
    }
    const v = clamp(Number.parseFloat(explicit));
    if (v) return v;
  }

  const w = Number.parseFloat(e.LG_FRAME_WIDTH);
  const h = Number.parseFloat(e.LG_FRAME_HEIGHT);
  if (Number.isFinite(w) && Number.isFinite(h) && h > 0) {
    const v = clamp(w / h);
    if (v) return v;
  }

  // The rig's own rotation variable, passed straight through by the launcher.
  const randr = String(e.LG_RANDR || e.DHCP_RANDR || '').trim().toLowerCase();
  if (randr === 'left' || randr === 'right') return 1080 / 1920;
  if (randr === 'normal' || randr === 'inverted') return 1920 / 1080;

  return 1920 / 1080;
}

const FRAME_ASPECT = resolveFrameAspect();
const SCREEN_WIDTH = Math.round(CANVAS_HEIGHT * FRAME_ASPECT);

const PADDLE_HEIGHT = 18;
const PADDLE_Y = 1000;
/** 300px on a landscape frame — same share of a frame in either orientation. */
const DEFAULT_PADDLE_WIDTH = Math.round(SCREEN_WIDTH * (300 / LANDSCAPE_SCREEN_WIDTH));

// Reference grid, authored against a landscape frame. Portrait frames use the
// same column count with proportionally narrower cells, so a level's shape is
// identical in either orientation instead of drifting with rounding.
const REF_GUTTER = 24;
const REF_CELL = 144;
const REF_BRICK_WIDTH = 140;

/** Column count for the full panoramic court — aspect independent by design. */
function brickColumnsForWorld(numScreens) {
  const refWorld = (numScreens || 3) * LANDSCAPE_SCREEN_WIDTH;
  return Math.max(1, Math.floor((refWorld - REF_GUTTER * 2) / REF_CELL));
}

/** Brick grid metrics for a frame width. Vertical values never scale. */
function brickMetrics(screenWidth = SCREEN_WIDTH) {
  const scale = (screenWidth || SCREEN_WIDTH) / LANDSCAPE_SCREEN_WIDTH;
  return {
    gutter: REF_GUTTER * scale,
    cell: REF_CELL * scale,
    brickWidth: REF_BRICK_WIDTH * scale,
    brickHeight: 30,
    rowPitch: 40,
    top: 100,
  };
}

function centerPaddleX(numScreens, paddleWidth = DEFAULT_PADDLE_WIDTH) {
  const width = paddleWidth || DEFAULT_PADDLE_WIDTH;
  return Math.round(((numScreens || 3) * SCREEN_WIDTH) / 2 - width / 2);
}

/** Spread players across the panoramic court so 5 paddles are not stacked on the center bezel. */
function paddleXForSlot(slotIndex, maxPlayers, numScreens, paddleWidth = DEFAULT_PADDLE_WIDTH) {
  const n = Math.max(1, maxPlayers || 1);
  const width = paddleWidth || DEFAULT_PADDLE_WIDTH;
  const world = (numScreens || 3) * SCREEN_WIDTH;
  const idx = Math.max(0, Math.min(n - 1, slotIndex || 0));
  const center = ((idx + 0.5) / n) * world;
  return Math.max(0, Math.round(center - width / 2));
}

/**
 * Phone delta is authored for a 3-screen landscape court. Scale by the real
 * court width so a 12-screen wall stays traversable and a narrow portrait wall
 * does not send the paddle flying.
 */
function inputScaleForWorld(numScreens, screenWidth) {
  const world = (Number(numScreens) || 3) * (Number(screenWidth) || SCREEN_WIDTH);
  const reference = 3 * LANDSCAPE_SCREEN_WIDTH;
  return Math.max(0.15, Math.min(5, world / reference));
}

function inputScaleForScreens(numScreens) {
  return inputScaleForWorld(numScreens, SCREEN_WIDTH);
}

function expandTiledBrickGrid(tile, numCols) {
  if (!Array.isArray(tile) || tile.length === 0) return null;
  const cols = Math.max(1, numCols || 1);
  const tileW = Array.isArray(tile[0]) ? tile[0].length : 0;
  if (tileW <= 0) return null;
  const expanded = [];
  for (let r = 0; r < tile.length; r++) {
    const src = Array.isArray(tile[r]) ? tile[r] : [];
    const row = [];
    let mirror = false;
    while (row.length < cols) {
      const chunk = mirror ? src.slice().reverse() : src;
      for (let c = 0; c < chunk.length && row.length < cols; c++) {
        const v = chunk[c];
        row.push(typeof v === 'number' ? v : 0);
      }
      mirror = !mirror;
    }
    expanded.push(row);
  }
  return expanded;
}

function getBallSpeedMultiplier(ballSpeed) {
  if (ballSpeed === 'slow') return 0.75;
  if (ballSpeed === 'fast') return 1.4;
  if (ballSpeed === 'insane') return 1.8;
  return 1;
}

function getRespawnVelocity(gameState) {
  const m = getBallSpeedMultiplier(gameState && gameState.ballSpeed);
  const slow = gameState && gameState.slowBallActive ? 0.5 : 1;
  return { vx: 3 * m * slow, vy: 4 * m * slow };
}

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
  constructor(id, numScreens = 3){
    this.id = id;
    this.score = 0;
    this.lives = 3;
    this.paddleWidth = DEFAULT_PADDLE_WIDTH;
    this.paddleHeight = PADDLE_HEIGHT;
    this.paddleX = centerPaddleX(numScreens, this.paddleWidth);
    this.paddleY = PADDLE_Y;
    this.connected = false;
    this.socketId = null;
    this.inventory = [];
    this.lastNonces = [];
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
    this.gameStatus = 'lobby';
    this.nextLevelBricks = null;
    this.rallyCount = 0;
    this.longestRally = 0;
    this.powerupsCollected = 0;
    this.highestCombo = 0;
    this.currentCombo = 0;
    this.lastFallenBallToucher = null;
    this.bricksDirty = true;
  }
}

function applyGameMasterMod(gameState, modType){
  try {
    switch(modType){
      case 'WIDE_PADDLE':
        gameState.powerUps.push(new PowerUp('wide_paddle', ((gameState.numScreens || 3) * SCREEN_WIDTH)/2, 0));
        break;
      case 'EXTRA_BALL':
        const speedMult = gameState.slowBallActive ? 1.5 : 3;
        const radius = gameState.balls.length > 0 ? gameState.balls[0].radius : 8;
        let newBall = new Ball(Date.now().toString(), ((gameState.numScreens || 3) * SCREEN_WIDTH)/2, 500, speedMult, speedMult * 1.33, radius);
        gameState.balls.push(newBall);
        break;
      case 'SLOW_BALL':
        if(!gameState.slowBallActive){
          gameState.balls.forEach(b=>{
            if(b.active){
              b.vx *= 0.5;
              b.vy *= 0.5;
            }
          });
          gameState.slowBallActive = true;
          if(gameState.slowBallTimer) clearTimeout(gameState.slowBallTimer);
          gameState.slowBallTimer = setTimeout(()=>{
            if(gameState.slowBallActive){
              gameState.balls.forEach(b=>{
                if(b.active){
                  b.vx *= 2.0;
                  b.vy *= 2.0;
                }
              });
              gameState.slowBallActive = false;
              gameState.slowBallTimer = null;
            }
          }, 8000);
        }
        break;
    }
  } catch(e){
    console.error(e);
  }
}

function loadLevel(levelNumber, aiGeneratedGrid = null, numScreens = 3, screenWidth = SCREEN_WIDTH){
  try {
    let newBricks = [];
    const m = brickMetrics(screenWidth);
    const brickAt = (r, c) => new Brick(
      r, c,
      m.gutter + c * m.cell,
      m.top + r * m.rowPitch,
      m.brickWidth, m.brickHeight
    );

    if(aiGeneratedGrid && Array.isArray(aiGeneratedGrid) && aiGeneratedGrid.length > 0){
      for(let r = 0; r < aiGeneratedGrid.length; r++){
        let rowBricks = [];
        for(let c = 0; c < aiGeneratedGrid[r].length; c++){
          let val = aiGeneratedGrid[r][c];
          let brick = brickAt(r, c);
          if(val > 0){
            brick.type = val===3 ? 'indestructible' : (val===2 ? 'hard' : 'normal');
          }else{
            brick.active = false;
          }
          rowBricks.push(brick);
        }
        newBricks.push(rowBricks);
      }
      return newBricks;
    }

    let numCols = brickColumnsForWorld(numScreens);
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
        }else if(levelNumber===4){
          if((row + col) % 2 === 0) brickType = 'hard';
          if(row === 7 && col % 4 === 0) brickType = 'indestructible';
        }else if(levelNumber>=5){
          const edge = col === 0 || col === numCols - 1;
          if(edge && row < 6){
            brickType = 'indestructible';
          }else if((row + col) % 2 === 0){
            brickType = 'hard';
          }
        }
        
        let brick = brickAt(row, col);
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
            // Top collision (bounce logic)
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
            // Side collision (horizontal reflect)
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
            // Store for controller activation (max 3). Bomb auto-fires on catch.
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

      // Respawn a single ball; prefer slot 0, otherwise first existing ball object.
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
      // Only indestructible (or empty) bricks remain — advance level.
      // Reject AI grids with zero destructible cells to avoid instant win-skip.
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
  Ball,
  Player,
  Brick,
  PowerUp,
  GameState,
  CANVAS_HEIGHT,
  SCREEN_WIDTH,
  FRAME_ASPECT,
  LANDSCAPE_SCREEN_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  DEFAULT_PADDLE_WIDTH,
  resolveFrameAspect,
  brickMetrics,
  brickColumnsForWorld,
  centerPaddleX,
  paddleXForSlot,
  inputScaleForScreens,
  inputScaleForWorld,
  expandTiledBrickGrid,
  getBallSpeedMultiplier,
  getRespawnVelocity,
  loadLevel,
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
  updatePowerUps,
  updateGameLoop,
  applyGameMasterMod
};

