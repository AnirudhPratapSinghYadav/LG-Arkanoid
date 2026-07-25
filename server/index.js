require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const gameEngine = require('./gameEngine.js');
const { PORT, TICK_MS, getLanIp, createInitialWorldState } = require('./config.js');
const { triggerCommentary, pollGameMasterAsync, generateNextLevelAsync } = require('./services/geminiService.js');
const { registerSocketHandlers, applyPowerUpEffect } = require('./handlers/socketHandler.js');
const createRouter = require('./routes.js');

let worldState = createInitialWorldState();
const pendingHandoffs = new Map();

const app = express();
const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const io = new Server(server, {
  cors: { 
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        `http://localhost:${PORT}`, 
        `http://127.0.0.1:${PORT}`, 
        `http://${getLanIp()}:${PORT}`,
        `http://lg1:${PORT}`
      ];
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST'] 
  },
  maxHttpBufferSize: 1024,
});

app.use(createRouter(worldState));

function getScreenIdForX(x){
  const numScreens = worldState.numScreens || 3;
  const maxRight = numScreens * 1920 - 1;
  const clampedX = Math.max(0, Math.min(x, maxRight));
  return Math.floor(clampedX / 1920) + 1;
}

function getScreenById(screenId){
  const left = (screenId - 1) * 1920;
  const right = screenId * 1920 - 1;
  return { screenId, virtualLeft: left, virtualRight: right };
}

function computePlayerRanks(){
  const sorted = [...worldState.players]
    .filter(p => p.connected)
    .sort((a, b) => b.score - a.score);
  const ranks = {};
  sorted.forEach((p, idx) => {
    if(p.id) ranks[p.id] = idx + 1;
  });
  return ranks;
}

function getWorldSnapshot(){
  const ranks = computePlayerRanks();
  return {
    balls: worldState.balls.map(b => ({ id: b.id, x: b.x, y: b.y, active: b.active })),
    players: worldState.players.map((p, index) => ({
      id: p.id,
      playerNumber: index + 1,
      name: p.name || null,
      paddleX: p.paddleX,
      paddleWidth: p.paddleWidth,
      score: p.score,
      lives: p.lives,
      connected: p.connected,
      rank: ranks[p.id] || 1,
    })),
    currentLevel: worldState.currentLevel,
    gameStatus: worldState.gameStatus,
    gameStartedAt: worldState.gameStartedAt,
    lobbyStartedAt: worldState.lobbyStartedAt,
    countdownStartedAt: worldState.countdownStartedAt,
    longestRally: worldState.longestRally || 0,
    powerupsCollected: worldState.powerupsCollected || 0,
    highestCombo: worldState.highestCombo || 0,
    lanIp: getLanIp(),
    port: PORT,
    sessionToken: worldState.sessionToken,
    masterPlayerIndex: worldState.masterPlayerIndex,
    maxPlayers: worldState.maxPlayers || 3,
    gameDurationSeconds: worldState.gameDurationSeconds || 180,
  };
}

function broadcastGameState(){
  const payload = {
    sessionId: worldState.sessionId,
    numScreens: worldState.numScreens || 3,
    balls: worldState.balls.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      radius: b.radius,
      active: b.active,
    })),
    powerUps: worldState.powerUps.map(p => ({
      type: p.type,
      x: p.x,
      y: p.y,
      falling: p.falling,
      active: p.active,
    })),
    players: worldState.players.map((p, index) => ({
      id: p.id,
      playerNumber: index + 1,
      name: p.name || null,
      paddleX: p.paddleX,
      paddleWidth: p.paddleWidth,
      score: p.score,
      lives: p.lives,
      connected: p.connected,
    })),
    currentLevel: worldState.currentLevel,
    sessionToken: worldState.sessionToken,
    gameStatus: worldState.gameStatus,
    lobbyStartedAt: worldState.lobbyStartedAt,
    countdownStartedAt: worldState.countdownStartedAt,
    masterPlayerIndex: worldState.masterPlayerIndex,
    lanIp: getLanIp(),
    port: PORT,
  };

  if (worldState.bricksDirty) {
    payload.bricks = worldState.bricks.map(row =>
      row.map(brick => ({
        row: brick.row,
        col: brick.col,
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
        active: brick.active,
        type: brick.type,
      }))
    );
    worldState.bricksDirty = false;
  }

  io.emit('game_state', payload);
}

registerSocketHandlers(io, worldState, pendingHandoffs, broadcastGameState, getWorldSnapshot);

let previousRanks = {};

setInterval(() => {
  if(worldState.gameStatus !== 'playing') return;

  if (worldState.gameStartedAt && worldState.gameDurationSeconds > 0) {
    if (Date.now() - worldState.gameStartedAt > worldState.gameDurationSeconds * 1000) {
      worldState.gameStatus = 'time_up';
      broadcastGameState();
      return;
    }
  }

  const beforeScores = worldState.players.map(p => p.score);
  const beforeLives = worldState.players.map(p => p.lives);
  const beforeLevel = worldState.level;
  const beforeBallScreens = worldState.balls.map(b => getScreenIdForX(b.x));

  gameEngine.updateGameLoop(worldState, (player, powerUpType) => {
    applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot);
  });

  if(!worldState.nextLevelBricks){
    generateNextLevelAsync(worldState.level + 1, worldState);
  }

  for(let i = 0; i < worldState.players.length; i++){
    const p = worldState.players[i];
    if(p.score > 0 && Math.floor(beforeScores[i] / 5000) < Math.floor(p.score / 5000)){
      const snap = getWorldSnapshot();
      snap.playerId = p.id;
      triggerCommentary('score_milestone', snap, io, worldState.commentaryRateLimiter);
    }
    if(p.lives < beforeLives[i]){
      const snap = getWorldSnapshot();
      snap.playerId = p.id;
      triggerCommentary('life_lost', snap, io, worldState.commentaryRateLimiter);
      pollGameMasterAsync(worldState, io);
      if(p.lives === 0){
        io.emit('player_eliminated', { playerId: p.id, playerNumber: i + 1 });
      }
    }
  }

  if(worldState.level > beforeLevel){
    worldState.currentLevel = worldState.level;
    triggerCommentary('level_cleared', getWorldSnapshot(), io, worldState.commentaryRateLimiter);
    pollGameMasterAsync(worldState, io);
  }

  const currentRanks = computePlayerRanks();
  for (const playerId in currentRanks) {
    if (previousRanks[playerId] && currentRanks[playerId] === 1 && previousRanks[playerId] > 1) {
      const snap = getWorldSnapshot();
      snap.playerId = playerId;
      triggerCommentary('rank_takeover', snap, io, worldState.commentaryRateLimiter);
    }
  }
  previousRanks = currentRanks;

  worldState.balls.forEach((ball, i) => {
    if(!ball.active) return;
    const currentScreen = getScreenIdForX(ball.x);
    const oldScreen = beforeBallScreens[i];
    if(currentScreen !== oldScreen){
      const handoffId = `${oldScreen}-${currentScreen}-${Date.now()}`;
      const isMovingRight = oldScreen < currentScreen;
      const oldScreenInfo = getScreenById(oldScreen);
      const newScreenInfo = getScreenById(currentScreen);
      
      const exitPayload = {
        handoffId,
        ballId: ball.id,
        screenId: oldScreen,
        exitX: isMovingRight ? oldScreenInfo.virtualRight : oldScreenInfo.virtualLeft,
        exitY: ball.y,
        velocityX: ball.vx,
        velocityY: ball.vy,
      };

      const enterPayload = {
        handoffId,
        ballId: ball.id,
        screenId: currentScreen,
        entryX: isMovingRight ? newScreenInfo.virtualLeft : newScreenInfo.virtualRight,
        entryY: ball.y,
        velocityX: ball.vx,
        velocityY: ball.vy,
      };

      io.to(`screen-${oldScreen}`).emit('boundary_exit', exitPayload);
      io.to(`screen-${currentScreen}`).emit('boundary_enter', enterPayload);
      
      pendingHandoffs.set(handoffId, {
        departingAck: false,
        arrivingAck: false,
        exitPayload,
        enterPayload,
        retried: false,
      });

      setTimeout(() => {
        const pending = pendingHandoffs.get(handoffId);
        if(!pending) return;

        if(!pending.departingAck || !pending.arrivingAck){
          io.to(`screen-${pending.exitPayload.screenId}`).emit('boundary_exit', pending.exitPayload);
          io.to(`screen-${pending.enterPayload.screenId}`).emit('boundary_enter', pending.enterPayload);
          pending.retried = true;
        }

        setTimeout(() => pendingHandoffs.delete(handoffId), 100);
      }, 16);
    }
  });

  broadcastGameState();
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LG Arkanoid game server running on port ${PORT}`);
});
