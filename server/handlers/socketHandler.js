const gameEngine = require('../gameEngine.js');
const {
  BALL_RADIUS,
  SCREEN_WIDTH,
  CANVAS_HEIGHT,
  normalizeDurationSeconds,
  getLanIp,
  PORT,
} = require('../config.js');
const { triggerCommentary } = require('../services/geminiService.js');
const { resetPaddle, createEmptyPlayer, applyHostLobbySettings } = require('./lobby.js');
const { clearAllPowerUpTimers, applyPowerUpEffect } = require('./powerups.js');
const { registerPlayerHandlers } = require('./players.js');

const socketToPlayerIndex = new Map();
/** Grace-period reconnect timers keyed by playerId. Shared with match for lobby diagnostics. */
const disconnectTimers = new Map();
const ipJoinAttempts = new Map();

function sessionInfo(worldState) {
  return {
    sessionToken: worldState.sessionToken,
    sessionId: worldState.sessionId,
    lanIp: getLanIp(),
    port: PORT,
    numScreens: worldState.numScreens || 3,
    maxPlayers: worldState.maxPlayers || 3,
    gameDurationSeconds: worldState.gameDurationSeconds ?? 180,
    ballSpeed: worldState.ballSpeed || 'medium',
  };
}

function registerSocketHandlers(io, worldState, pendingHandoffs, broadcastGameState, getWorldSnapshot, cancelReturnToLobby, abortMatchIfEmpty, returnToLobby, emitFullStateTo) {
  io.on('connection', (socket) => {
    if (typeof emitFullStateTo === 'function') {
      emitFullStateTo(socket);
    } else {
      worldState.bricksDirty = true;
    }

    let screenId = parseInt(socket.handshake.query.screenId, 10);
    if (isNaN(screenId)) {
      const referer = socket.handshake.headers.referer;
      if (referer) {
        const match = referer.match(/\/(\d+)\/?(\?|$)/);
        if (match) {
          screenId = parseInt(match[1], 10);
        }
      }
    }

    if (!isNaN(screenId) && screenId >= 1 && screenId <= (worldState.numScreens || 3)) {
      socket.join(`screen-${screenId}`);
      socket.join('screens');
      socket.emit('session_info', sessionInfo(worldState));
    }

    socket.on('request_session_info', () => {
      if (isNaN(screenId) || screenId < 1 || screenId > (worldState.numScreens || 3)) {
        socket.emit('error', { errorCode: 1007, message: 'Not authorized for session info' });
        return;
      }
      socket.emit('session_info', sessionInfo(worldState));
    });

    socket.on('screen_register', (data) => {
      if (isNaN(screenId) || screenId < 1 || screenId > (worldState.numScreens || 3)) return;
      const vw = Number(data && data.viewportWidth);
      const vh = Number(data && data.viewportHeight);
      if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0) return;

      const measured = vw / vh;
      const configured = (worldState.screenWidth || SCREEN_WIDTH) / (worldState.canvasHeight || CANVAS_HEIGHT);
      if (Math.abs(measured - configured) / configured > 0.08) {
        console.warn(
          `Screen ${screenId} reports ${vw}x${vh} (aspect ${measured.toFixed(3)}) but the court is ` +
          `configured for aspect ${configured.toFixed(3)}. Set LG_FRAME_ASPECT=` +
          `${measured < 1 ? '9:16' : '16:9'} (or LG_RANDR) and relaunch, or the court will be letterboxed.`
        );
      }
    });

    const socketRateLimits = new Map();

    socket.on('ping_test', (data, callback) => {
      const now = Date.now();
      const lastPing = socketRateLimits.get('ping_' + socket.id) || 0;
      if (now - lastPing < 500) return;
      socketRateLimits.set('ping_' + socket.id, now);
      if (typeof callback === 'function') callback();
    });

    function tryStartMatch(data, opts) {
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
        data?.durationSeconds,
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

    socket.on('start_game', tryStartMatch);

    socket.on('return_to_lobby', () => {
      const slotIndex = socketToPlayerIndex.get(socket.id);
      const fromScreen = socket.rooms.has('screens');
      if (slotIndex !== worldState.masterPlayerIndex && !fromScreen) {
        socket.emit('error', { errorCode: 1007, message: 'Only the host can return to lobby' });
        return;
      }
      const status = worldState.gameStatus;
      if (status !== 'win' && status !== 'time_up' && status !== 'game_over') {
        socket.emit('error', { errorCode: 1010, message: 'Match is still running' });
        return;
      }
      if (typeof returnToLobby === 'function') returnToLobby({ force: true, trigger: 'host_return_to_lobby' });
    });

    socket.on('rematch', () => {
      const slotIndex = socketToPlayerIndex.get(socket.id);
      const fromScreen = socket.rooms.has('screens');
      if (slotIndex !== worldState.masterPlayerIndex && !fromScreen) {
        socket.emit('error', { errorCode: 1007, message: 'Only the host can rematch' });
        return;
      }
      const status = worldState.gameStatus;
      if (status !== 'win' && status !== 'time_up' && status !== 'game_over') {
        socket.emit('error', { errorCode: 1010, message: 'Match is still running' });
        return;
      }
      tryStartMatch({
        maxPlayers: worldState.maxPlayers,
        ballSpeed: worldState.ballSpeed,
        durationSeconds: worldState.gameDurationSeconds,
      }, { fromScreen });
    });

    socket.on('set_game_settings', (data) => {
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if (slotIndex !== worldState.masterPlayerIndex) {
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can configure settings' });
        return;
      }
      if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
        socket.emit('error', { errorCode: 1010, message: 'Cannot change settings during a match' });
        return;
      }
      const settingsErr = applyHostLobbySettings(worldState, data);
      if (settingsErr) {
        socket.emit('error', settingsErr);
        return;
      }
      broadcastGameState({ forceControllers: true });
    });

    socket.on('set_max_players', (data) => {
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if (slotIndex !== worldState.masterPlayerIndex) {
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can configure settings' });
        return;
      }
      if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
        socket.emit('error', { errorCode: 1010, message: 'Cannot change lobby size during a match' });
        return;
      }
      const newMax = parseInt(data?.maxPlayers, 10);
      if (newMax >= 1 && newMax <= 5) {
        if (worldState.players.slice(newMax).some((p) => p.connected)) {
          socket.emit('error', { errorCode: 1011, message: 'Cannot reduce slots: active players occupy higher slots. Please wait for them to leave.' });
          return;
        }
        worldState.maxPlayers = newMax;
        while (worldState.players.length < newMax) {
          worldState.players.push(createEmptyPlayer(worldState.numScreens, worldState.players.length, newMax));
        }
        if (worldState.players.length > newMax) {
          worldState.players = worldState.players.slice(0, newMax);
        }
        if (worldState.masterPlayerIndex >= worldState.players.length) {
          worldState.masterPlayerIndex = Math.max(0, worldState.players.findIndex((p) => p.connected));
          if (worldState.masterPlayerIndex < 0) worldState.masterPlayerIndex = 0;
        }
        broadcastGameState({ forceControllers: true });
      }
    });

    registerPlayerHandlers(socket, {
      worldState,
      io,
      socketToPlayerIndex,
      disconnectTimers,
      ipJoinAttempts,
      broadcastGameState,
      getWorldSnapshot,
      abortMatchIfEmpty,
    });

    socket.on('boundary_ack', (data) => {
      const { handoffId, screenId: ackScreenId } = data || {};
      const pending = pendingHandoffs.get(handoffId);
      if (!pending) return;

      if (ackScreenId === pending.exitPayload.screenId) {
        pending.departingAck = true;
      }
      if (ackScreenId === pending.enterPayload.screenId) {
        pending.arrivingAck = true;
      }
    });
  });
}

module.exports = {
  registerSocketHandlers,
  applyPowerUpEffect,
  clearAllPowerUpTimers,
  disconnectTimers,
};
