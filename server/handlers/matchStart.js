'use strict';

const gameEngine = require('../gameEngine.js');
const {
  BALL_RADIUS,
  SCREEN_WIDTH,
  normalizeDurationSeconds,
} = require('../config.js');
const { triggerCommentary } = require('../services/geminiService.js');
const { resetPaddle } = require('./lobby.js');
const { clearAllPowerUpTimers } = require('./powerups.js');
const { applyHostLobbySettings } = require('./lobby.js');

function tryStartMatch(socket, ctx, data, opts) {
  const {
    worldState,
    io,
    socketToPlayerIndex,
    cancelReturnToLobby,
    getWorldSnapshot,
    broadcastGameState,
  } = ctx;
  const fromScreen = opts && opts.fromScreen && socket.rooms.has('screens');
  const slotIndex = socketToPlayerIndex.get(socket.id);
  const ended = ['win', 'time_up', 'game_over'].includes(worldState.gameStatus);
  if (!fromScreen && slotIndex !== worldState.masterPlayerIndex) {
    socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can start the game' });
    return;
  }
  if (fromScreen && !ended) {
    socket.emit('error', { errorCode: 1007, message: 'Only the host can start from the wall before the match ends' });
    return;
  }
  if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
    socket.emit('error', { errorCode: 1010, message: 'Game is already in progress' });
    return;
  }
  const settingsErr = applyHostLobbySettings(worldState, data);
  if (settingsErr) {
    socket.emit('error', settingsErr);
    return;
  }
  const need = Math.max(1, worldState.maxPlayers || 1);
  const connected = worldState.players.filter((p) => p.connected).length;
  if (connected < need) {
    socket.emit('error', {
      errorCode: 1012,
      message: `Need ${need} players in the lobby before start (have ${connected})`,
    });
    return;
  }
  if (typeof cancelReturnToLobby === 'function') cancelReturnToLobby();

  clearAllPowerUpTimers(worldState);
  if (worldState.slowBallTimer) {
    clearTimeout(worldState.slowBallTimer);
  }
  worldState.slowBallActive = false;
  worldState.slowBallTimer = null;
  worldState.powerUps = [];
  worldState.nextLevelBricks = null;
  worldState.victoryAnnounced = false;
  worldState.lastCommentary = '';
  worldState.level = 1;
  worldState.currentLevel = 1;
  worldState.bricks = gameEngine.loadLevel(1, null, worldState.numScreens);
  worldState.bricksDirty = true;

  worldState.longestRally = 0;
  worldState.powerupsCollected = 0;
  worldState.highestCombo = 0;
  worldState.rallyCount = 0;
  worldState.currentCombo = 0;

  for (let i = 0; i < worldState.players.length; i++) {
    const p = worldState.players[i];
    p.score = 0;
    p.lives = 3;
    p.inventory = [];
    if (p.widePaddleTimer) {
      clearTimeout(p.widePaddleTimer);
      p.widePaddleTimer = null;
    }
    resetPaddle(p, worldState.numScreens, i, worldState.maxPlayers);
  }

  const host = worldState.players[worldState.masterPlayerIndex] || worldState.players.find((p) => p.connected) || worldState.players[0];
  const speedMult = gameEngine.getBallSpeedMultiplier(worldState.ballSpeed);
  worldState.balls = [];
  const serve = new gameEngine.Ball('ball_1', 0, 0, 0, 0, BALL_RADIUS);
  serve.active = true;
  if (host) gameEngine.placeBallOnPaddle(serve, host);
  else {
    serve.x = (worldState.numScreens * SCREEN_WIDTH) / 2;
    serve.y = 500;
    serve.glued = true;
  }
  worldState.balls.push(serve);
  const spare = new gameEngine.Ball('ball_2', serve.x, serve.y, -2.5 * speedMult, 3.5 * speedMult, BALL_RADIUS);
  spare.active = false;
  worldState.balls.push(spare);

  worldState.gameStatus = 'countdown';
  worldState.countdownStartedAt = Date.now();
  worldState.gameActive = false;
  worldState.gameDurationSeconds = normalizeDurationSeconds(
    data && data.durationSeconds,
    worldState.gameDurationSeconds ?? 180
  );

  io.emit('countdown_started', { countdown: 3 });
  triggerCommentary('countdown', getWorldSnapshot(), io, worldState.commentaryRateLimiter, worldState);
  broadcastGameState({ forceControllers: true });

  setTimeout(() => {
    if (worldState.gameStatus === 'countdown') {
      worldState.gameStatus = 'playing';
      worldState.gameActive = true;
      worldState.gameStartedAt = Date.now();
      (worldState.balls || []).forEach((b) => {
        if (b && b.glued && b.active) gameEngine.launchGluedBall(b, worldState);
      });
      io.emit('game_started', {
        sessionId: worldState.sessionId,
        gameStartedAt: worldState.gameStartedAt,
        gameDurationSeconds: worldState.gameDurationSeconds,
      });
      broadcastGameState({ forceControllers: true });
    }
  }, 3000);
}

module.exports = { tryStartMatch };
