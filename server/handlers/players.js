const gameEngine = require('../gameEngine.js');
const { PLAYER_SLOT_IDS, SCREEN_WIDTH, generateResumeToken } = require('../config.js');
const crypto = require('crypto');
const { resetPaddle } = require('./lobby.js');
const { clearPlayerTimers, applyPowerUpEffect } = require('./powerups.js');

function timingSafeTokenCompare(provided, stored) {
  if (typeof provided !== 'string' || typeof stored !== 'string') {
    return false;
  }
  const a = Buffer.from(provided.padEnd(Math.max(provided.length, stored.length, 1), '\0'));
  const b = Buffer.from(stored.padEnd(Math.max(provided.length, stored.length, 1), '\0'));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function findPlayerBySocket(socketId, worldState, socketToPlayerIndex) {
  const index = socketToPlayerIndex.get(socketId);
  if (index === undefined) return null;
  return { player: worldState.players[index], index };
}

function validateMessage(player, timestamp, nonce) {
  const now = Date.now();
  if (typeof timestamp !== 'number' || typeof nonce !== 'string' || nonce.length > 32) {
    return { valid: false, errorCode: 1003 };
  }
  const recentDuplicate = player.lastNonces.some((entry) => entry.nonce === nonce);
  if (recentDuplicate) {
    return { valid: false, errorCode: 1004 };
  }
  player.lastNonces.push({ nonce, time: now });
  if (player.lastNonces.length > 100) {
    player.lastNonces.shift();
  }
  return { valid: true };
}

function registerPlayerHandlers(socket, ctx) {
  const {
    worldState,
    io,
    socketToPlayerIndex,
    disconnectTimers,
    ipJoinAttempts,
    broadcastGameState,
    getWorldSnapshot,
    abortMatchIfEmpty,
  } = ctx;

    const handleJoin = (data)=>{
      if (socketToPlayerIndex.has(socket.id)) {
        socket.emit('join_rejected', { errorCode: 1013, message: 'Already joined from this connection' });
        return;
      }

      const ip = socket.handshake.address;
      let attempts = ipJoinAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      
      if (Date.now() < attempts.lockedUntil) {
        const remainingSec = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        socket.emit('join_rejected', { 
          errorCode: 1009, 
          message: `Too many failed attempts. Locked for ${remainingSec}s` 
        });
        return;
      }

      const { sessionToken, playerName } = data || {};

      if(typeof sessionToken!=='string' || sessionToken.length!==4){
        socket.emit('join_rejected', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      if(!timingSafeTokenCompare(sessionToken, String(worldState.sessionToken || ''))){
        attempts.count++;
        if (attempts.count >= 5) {
          attempts.lockedUntil = Date.now() + 60000;
          attempts.count = 0;
        }
        ipJoinAttempts.set(ip, attempts);
        socket.emit('join_rejected', { errorCode: 1001, message: 'Invalid session token' });
        return;
      }
      
      ipJoinAttempts.delete(ip);

      const status = worldState.gameStatus || 'lobby';
      if (status === 'playing' || status === 'countdown' || status === 'time_up' || status === 'win' || status === 'game_over') {
        socket.emit('join_rejected', {
          errorCode: 1010,
          message: 'Match already in progress. Wait for the next lobby.',
        });
        return;
      }

      let slotIndex = worldState.players.findIndex((p) => !p.connected && !p.name);
      if (slotIndex === -1) {
        slotIndex = worldState.players.findIndex((p) => !p.connected);
      }

      if(slotIndex===-1){
        socket.join('spectators');
        socket.join('controllers');
        socket.emit('join_confirmed', {
          playerId: 'spectator_' + socket.id.substring(0, 5),
          playerNumber: 99,
          isSpectator: true,
          sessionId: worldState.sessionId,
        });
        return;
      }

      const player = worldState.players[slotIndex];
      player.connected = true;
      player.id = PLAYER_SLOT_IDS[slotIndex] || ('player' + (slotIndex + 1));
      let cleanName = (typeof playerName === 'string') ? playerName.replace(/[^a-zA-Z0-9 ]/g, '').trim() : '';
      player.name = cleanName.length > 0 ? cleanName.substring(0, 12) : `Player ${slotIndex + 1}`;
      player.socketId = socket.id;
      player.resumeToken = generateResumeToken();
      resetPaddle(player, worldState.numScreens, slotIndex, worldState.maxPlayers);
      if (!Array.isArray(player.inventory)) player.inventory = [];
      player.lastNonces = [];
      socketToPlayerIndex.set(socket.id, slotIndex);
      socket.join('controllers');

      if(disconnectTimers.has(player.id)){
        clearTimeout(disconnectTimers.get(player.id));
        disconnectTimers.delete(player.id);
      }

      socket.emit('join_confirmed', {
        playerId: player.id,
        playerNumber: slotIndex+1,
        isSpectator: false,
        sessionId: worldState.sessionId,
        sessionToken: worldState.sessionToken,
        resumeToken: player.resumeToken,
      });

      io.emit('player_joined', {
        playerName: player.name,
        playerNumber: slotIndex+1,
        playerId: player.id,
        connectedCount: worldState.players.filter((p)=>p.connected).length,
        maxPlayers: worldState.maxPlayers || 3,
      });

      broadcastGameState();
    };

    socket.on('join_game', handleJoin);
    socket.on('player_join', handleJoin);

    socket.on('paddle_move', (data)=>{
      const found = findPlayerBySocket(socket.id, worldState, socketToPlayerIndex);
      if(!found) return;

      const { player } = found;
      if (player.lives <= 0) return;
      // Allow aiming during countdown so HOLD LEFT/RIGHT is not dead for 3s.
      if (worldState.gameStatus !== 'playing' && worldState.gameStatus !== 'countdown') return;
      let { deltaX, timestamp, nonce } = data || {};

      if(typeof deltaX!=='number' || isNaN(deltaX) || !isFinite(deltaX)){
        socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      const now = Date.now();
      if (!player.lastPaddleTime) player.lastPaddleTime = 0;
      if (now - player.lastPaddleTime < 16) return;
      player.lastPaddleTime = now;

      const validation = validateMessage(player, timestamp, nonce);
      if(!validation.valid){
        socket.emit('error', { errorCode: validation.errorCode });
        return;
      }

      // Minimum 1px so Flutter .round() never silently no-ops tiny steps.
      if (deltaX !== 0 && Math.abs(deltaX) < 1) {
        deltaX = deltaX < 0 ? -1 : 1;
      }

      const maxStep = Math.round(2500 * gameEngine.inputScaleForWorld(
        worldState.numScreens,
        worldState.screenWidth
      ));
      deltaX = Math.max(-maxStep, Math.min(maxStep, deltaX));

      const frameW = worldState.screenWidth || SCREEN_WIDTH;
      const maxRight = (worldState.numScreens || 3) * frameW;
      player.paddleX += deltaX;
      const pw = player.paddleWidth || 300;
      player.paddleX = Math.max(0, Math.min(maxRight - pw, Math.round(player.paddleX)));
      if (worldState.gameStatus === 'countdown' || worldState.gameStatus === 'playing') {
        gameEngine.stickGluedBalls(worldState, player);
        if (worldState.gameStatus === 'countdown') {
          broadcastGameState({ forceControllers: true });
        }
      }
    });

    socket.on('power_up_activate', (data)=>{
      const found = findPlayerBySocket(socket.id, worldState, socketToPlayerIndex);
      if(!found) return;

      const { player } = found;
      if(worldState.gameStatus !== 'playing') return;
      if(player.lives <= 0) return;
      const { powerUpType, timestamp, nonce } = data || {};

      if(typeof powerUpType!=='string' || powerUpType.length > 20){
        socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      if(!Array.isArray(player.inventory)) player.inventory = [];
      const invIndex = player.inventory.indexOf(powerUpType);
      if(invIndex === -1){
        socket.emit('error', { errorCode: 1012, message: 'Power-up not in inventory' });
        return;
      }

      const now = Date.now();
      if(player.lastPowerUpTime && now-player.lastPowerUpTime < 1000){
        socket.emit('error', { errorCode: 1006, message: 'Power-up on cooldown' });
        return;
      }

      const validation = validateMessage(player, timestamp, nonce);
      if(!validation.valid){
        socket.emit('error', { errorCode: validation.errorCode });
        return;
      }

      player.inventory.splice(invIndex, 1);
      player.lastPowerUpTime = now;
      applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot);
      broadcastGameState();
    });

    socket.on('resume_request', (data)=>{
      const { playerId, sessionId, resumeToken } = data || {};
      if(typeof playerId !== 'string' || typeof sessionId !== 'string' || typeof resumeToken !== 'string' || resumeToken.length < 16){
        socket.emit('join_rejected', { errorCode: 1005, message: 'Invalid resume payload' });
        return;
      }
      if(playerId.startsWith('spectator_')){
        socket.emit('join_rejected', { errorCode: 1008, message: 'Spectators cannot resume a player slot' });
        return;
      }
      if(sessionId !== worldState.sessionId){
        socket.emit('join_rejected', { errorCode: 1001, message: 'Session expired' });
        return;
      }

      const slotIndex = worldState.players.findIndex((p) => p.id === playerId);
      if(slotIndex === -1){
        socket.emit('join_rejected', { errorCode: 1008, message: 'Player slot no longer available' });
        return;
      }

      const player = worldState.players[slotIndex];
      if(!player.resumeToken || !timingSafeTokenCompare(resumeToken, player.resumeToken)){
        socket.emit('join_rejected', { errorCode: 1001, message: 'Invalid resume token' });
        return;
      }

      if(player.connected && player.socketId && player.socketId !== socket.id){
        const oldSocket = io.sockets.sockets.get(player.socketId);
        if(oldSocket) oldSocket.disconnect(true);
      }

      player.connected = true;
      player.socketId = socket.id;
      player.lastNonces = [];
      // Rotate resume secret after each successful reclaim.
      player.resumeToken = generateResumeToken();
      socketToPlayerIndex.set(socket.id, slotIndex);
      socket.join('controllers');

      if(disconnectTimers.has(playerId)){
        clearTimeout(disconnectTimers.get(playerId));
        disconnectTimers.delete(playerId);
      }

      socket.emit('join_confirmed', {
        playerId: player.id,
        playerNumber: slotIndex + 1,
        isSpectator: false,
        sessionId: worldState.sessionId,
        sessionToken: worldState.sessionToken,
        resumeToken: player.resumeToken,
        resumed: true,
      });
      broadcastGameState();
    });

    socket.on('leave_game', ()=>{
      const found = findPlayerBySocket(socket.id, worldState, socketToPlayerIndex);
      if(!found) return;
      const { player, index } = found;
      const playerNumber = index + 1;
      const playerId = player.id;

      if(playerId && disconnectTimers.has(playerId)){
        clearTimeout(disconnectTimers.get(playerId));
        disconnectTimers.delete(playerId);
      }

      clearPlayerTimers(player);
      player.connected = false;
      player.id = null;
      player.socketId = null;
      player.lastNonces = [];
      player.name = null;
      resetPaddle(player, worldState.numScreens, index, worldState.maxPlayers);
      player.score = 0;
      player.lives = 3;
      player.inventory = [];
      socketToPlayerIndex.delete(socket.id);

      if (index === worldState.masterPlayerIndex) {
        let newMaster = worldState.players.findIndex((p) => p.connected);
        worldState.masterPlayerIndex = newMaster >= 0 ? newMaster : 0;
      }

      io.emit('player_disconnected', {
        playerNumber,
        message: 'Player left the game',
      });
      broadcastGameState();
      if (typeof abortMatchIfEmpty === 'function') {
        abortMatchIfEmpty('leave_game');
      }
    });

    socket.on('disconnect', ()=>{
      const found = findPlayerBySocket(socket.id, worldState, socketToPlayerIndex);
      if(!found) return;

      const { player, index } = found;
      const playerNumber = index+1;
      const disconnectedSocketId = socket.id;
      const playerId = player.id;

      if(playerId && disconnectTimers.has(playerId)){
        clearTimeout(disconnectTimers.get(playerId));
      }

      socketToPlayerIndex.delete(disconnectedSocketId);
      player.connected = false;
      if (player.socketId === disconnectedSocketId) {
        player.socketId = null;
      }

      // Reassign host immediately so lobby is not stuck without a starter.
      if (index === worldState.masterPlayerIndex) {
        let newMaster = -1;
        for (let i = 0; i < worldState.players.length; i++) {
          if (worldState.players[i].connected) {
            newMaster = i;
            break;
          }
        }
        if (newMaster !== -1) {
          worldState.masterPlayerIndex = newMaster;
        }
      }
      
      io.emit('player_connection_lost', {
        playerNumber,
        playerId,
        message: 'Connection lost, waiting to reconnect...',
      });
      broadcastGameState();
      // Do NOT abortMatchIfEmpty here. connectedCount is 0 during a Wi-Fi blip
      // grace window; aborting would wipe score/session before resume_request.
      // leave_game (explicit quit) and the 30s timer below still abort when empty.

      const timer = setTimeout(()=>{
        if(playerId) disconnectTimers.delete(playerId);

        if(player.connected && player.socketId && player.socketId !== disconnectedSocketId){
          return;
        }
        if(player.id !== playerId){
          return;
        }

        player.id = null;
        player.socketId = null;
        player.lastNonces = [];
        clearPlayerTimers(player);
        player.name = null;
        resetPaddle(player, worldState.numScreens, index, worldState.maxPlayers);
        player.score = 0;
        player.lives = 3;
        player.inventory = [];

        io.emit('player_disconnected', {
          playerNumber,
          message: 'Player left the game',
        });
        broadcastGameState();
        if (typeof abortMatchIfEmpty === 'function') {
          abortMatchIfEmpty('disconnect_grace_expired');
        }
      }, 30000);

      if(playerId){
        disconnectTimers.set(playerId, timer);
      }
    });
}

module.exports = {
  registerPlayerHandlers,
  timingSafeTokenCompare,
  findPlayerBySocket,
};
