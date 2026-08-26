'use strict';

const {
  DEFAULT_PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  centerPaddleX,
} = require('./layout.js');

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
    this.glued = false;
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

module.exports = { Ball, Player, Brick, PowerUp, GameState };
