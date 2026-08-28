'use strict';

const layout = require('./engine/layout.js');
const { Ball, Player, Brick, PowerUp, GameState } = require('./engine/entities.js');
const { getBallSpeedMultiplier, getRespawnVelocity } = require('./engine/speeds.js');
const { loadLevel } = require('./engine/levels.js');
const {
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
} = require('./engine/physics.js');
const physics = require('./engine/physics.js');

function applyGameMasterMod(gameState, modType){
  try {
    switch(modType){
      case 'WIDE_PADDLE': {
        const normalW = layout.DEFAULT_PADDLE_WIDTH;
        (gameState.players || []).forEach((p) => {
          if (!p || !p.connected || p.lives <= 0) return;
          p.paddleWidth = normalW * 2;
          if (p.widePaddleTimer) clearTimeout(p.widePaddleTimer);
          p.widePaddleTimer = setTimeout(() => {
            p.paddleWidth = normalW;
            p.widePaddleTimer = null;
          }, 8000);
        });
        break;
      }
      case 'EXTRA_BALL': {
        const radius = gameState.balls.length > 0 ? gameState.balls[0].radius : 8;
        const extra = new Ball(Date.now().toString(), 0, 0, 0, 0, radius);
        extra.active = true;
        const holder = servingPaddle(gameState);
        if (holder) placeBallOnPaddle(extra, holder);
        launchGluedBall(extra, gameState);
        extra.vx = -extra.vx;
        gameState.balls.push(extra);
        break;
      }
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

module.exports = {
  Ball,
  Player,
  Brick,
  PowerUp,
  GameState,
  CANVAS_HEIGHT: layout.CANVAS_HEIGHT,
  SCREEN_WIDTH: layout.SCREEN_WIDTH,
  FRAME_ASPECT: layout.FRAME_ASPECT,
  LANDSCAPE_SCREEN_WIDTH: layout.LANDSCAPE_SCREEN_WIDTH,
  PADDLE_HEIGHT: layout.PADDLE_HEIGHT,
  PADDLE_Y: layout.PADDLE_Y,
  DEFAULT_PADDLE_WIDTH: layout.DEFAULT_PADDLE_WIDTH,
  resolveFrameAspect: layout.resolveFrameAspect,
  brickMetrics: layout.brickMetrics,
  brickColumnsForWorld: layout.brickColumnsForWorld,
  centerPaddleX: layout.centerPaddleX,
  paddleXForSlot: layout.paddleXForSlot,
  inputScaleForScreens: layout.inputScaleForScreens,
  inputScaleForWorld: layout.inputScaleForWorld,
  expandTiledBrickGrid: layout.expandTiledBrickGrid,
  getBallSpeedMultiplier,
  getRespawnVelocity,
  loadLevel,
  moveBall,
  checkWallCollision,
  checkPaddleCollision,
  checkBrickCollision,
  updatePowerUps,
  updateGameLoop,
  applyGameMasterMod,
  servingPaddle,
  placeBallOnPaddle,
  launchGluedBall,
  stickGluedBalls,
  SERVE_HOLD_MS: physics.SERVE_HOLD_MS,
};
