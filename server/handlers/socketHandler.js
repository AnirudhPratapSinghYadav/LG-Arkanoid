const gameEngine = require('../gameEngine.js');
const {
  PLAYER_SLOT_IDS,
  BALL_RADIUS,
  SCREEN_WIDTH,
  normalizeDurationSeconds,
  generateResumeToken,
  ALLOWED_BALL_SPEEDS,
  getLanIp,
  PORT,
  generateToken,
} = require('../config.js');
const { triggerCommentary } = require('../services/geminiService.js');
const crypto = require('crypto');

const socketToPlayerIndex = new Map();
const disconnectTimers = new Map();
const ipJoinAttempts = new Map();

function timingSafeTokenCompare(provided, stored){
  if(typeof provided !== 'string' || typeof stored !== 'string'){
    return false;
  }
  const a = Buffer.from(provided.padEnd(Math.max(provided.length, stored.length, 1), '\0'));
  const b = Buffer.from(stored.padEnd(Math.max(provided.length, stored.length, 1), '\0'));
  if(a.length !== b.length){
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function findPlayerBySocket(socketId, worldState){
  const index = socketToPlayerIndex.get(socketId);
  if(index === undefined) return null;
  return { player: worldState.players[index], index };
}

function clearPlayerTimers(player){
  if(player.widePaddleTimer){
    clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = null;
  }
  if(player.slowBallTimer){
    clearTimeout(player.slowBallTimer);
    player.slowBallTimer = null;
  }
}

function clearAllPowerUpTimers(worldState){
  for(const player of worldState.players){
    clearPlayerTimers(player);
  }
}

function applyBombPowerUp(worldState, player, px, py){
  if(!worldState.bricks) return;

  let epicenterX = px;
  let epicenterY = py;

  if(epicenterX === undefined || epicenterY === undefined){
    const activeBall = worldState.balls.find((b)=>b.active);
    if(!activeBall) return;
    epicenterX = activeBall.x;
    epicenterY = activeBall.y;
  }

  const blastRadius = 350;
  for(let r = 0; r < worldState.bricks.length; r++){
    const row = worldState.bricks[r];
    if(!row) continue;
    for(let c = 0; c < row.length; c++){
      const brick = row[c];
      if(!brick || !brick.active || brick.type === 'indestructible') continue;

      const brickCenterX = brick.x + brick.width / 2;
      const brickCenterY = brick.y + brick.height / 2;
      const dist = Math.hypot(epicenterX - brickCenterX, epicenterY - brickCenterY);

      if(dist <= blastRadius){
        brick.active = false;
        worldState.bricksDirty = true;
        if(player) {
          player.score += 10;
        }
      }
    }
  }
}

function applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot, px, py){
  if(powerUpType==='wide_paddle'){
    player.paddleWidth = 600;
    if(player.widePaddleTimer) clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = setTimeout(()=>{
      player.paddleWidth = 300;
      player.widePaddleTimer = null;
    }, 8000);
  }else if(powerUpType==='slow_ball'){
    if(!worldState.slowBallActive){
      for(const ball of worldState.balls){
        if(ball.active){
          ball.vx *= 0.5;
          ball.vy *= 0.5;
        }
      }
      worldState.slowBallActive = true;
    }
    if(worldState.slowBallTimer) clearTimeout(worldState.slowBallTimer);
    worldState.slowBallTimer = setTimeout(()=>{
      if(worldState.slowBallActive){
        for(const ball of worldState.balls){
          if(ball.active){
            ball.vx *= 2.0;
            ball.vy *= 2.0;
          }
        }
        worldState.slowBallActive = false;
        worldState.slowBallTimer = null;
      }
    }, 8000);
  }else if(powerUpType==='multi_ball'){
    const sourceBall = worldState.balls.find(b=>b.active);
    let targetBall = worldState.balls.find(b=>!b.active);
    if(!targetBall && sourceBall){
      targetBall = new gameEngine.Ball(`ball_${worldState.balls.length + 1}`, 0, 0, 0, 0, BALL_RADIUS);
      worldState.balls.push(targetBall);
    }
    if(sourceBall && targetBall){
      targetBall.x = sourceBall.x;
      targetBall.y = sourceBall.y;
      targetBall.vx = -sourceBall.vx;
      targetBall.vy = sourceBall.vy;
      targetBall.active = true;
      targetBall.lastTouchedByPlayerId = player.id;
      triggerCommentary('multi_ball', getWorldSnapshot(), io, worldState.commentaryRateLimiter);
    }
  }else if(powerUpType==='bomb'){
    applyBombPowerUp(worldState, player, px, py);
  }
}

function validateMessage(player, timestamp, nonce){
  const now = Date.now();

  if(typeof timestamp !== 'number' || typeof nonce !== 'string' || nonce.length > 32){
    return { valid: false, errorCode: 1003 };
  }

  const recentDuplicate = player.lastNonces.some((entry)=>entry.nonce===nonce);
  if(recentDuplicate){
    return { valid: false, errorCode: 1004 };
  }

  player.lastNonces.push({ nonce, time: now });
  if(player.lastNonces.length > 100){
    player.lastNonces.shift();
  }

  return { valid: true };
}

function registerSocketHandlers(io, worldState, pendingHandoffs, broadcastGameState, getWorldSnapshot) {
  io.on('connection', (socket)=>{
    // Force the next tick to include a full bricks payload for this new connection.
    // Without this, a screen/phone connecting after bricksDirty was already consumed
    // by an earlier broadcast would never receive brick state until the next brick hit.
    worldState.bricksDirty = true;

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

    if(!isNaN(screenId) && screenId>=1 && screenId<=(worldState.numScreens || 3)){
      socket.join(`screen-${screenId}`);
      socket.emit('session_info', {
        sessionToken: worldState.sessionToken,
        sessionId: worldState.sessionId,
        lanIp: getLanIp(),
        port: PORT,
        numScreens: worldState.numScreens || 3,
        maxPlayers: worldState.maxPlayers || 3,
        gameDurationSeconds: worldState.gameDurationSeconds ?? 180,
        ballSpeed: worldState.ballSpeed || 'medium',
      });
    }

    broadcastGameState();

    socket.on('request_session_info', ()=>{
      // Only panoramic screen clients may refresh the join code.
      if(isNaN(screenId) || screenId < 1 || screenId > (worldState.numScreens || 3)){
        socket.emit('error', { errorCode: 1007, message: 'Not authorized for session info' });
        return;
      }
      socket.emit('session_info', {
        sessionToken: worldState.sessionToken,
        sessionId: worldState.sessionId,
        lanIp: getLanIp(),
        port: PORT,
        numScreens: worldState.numScreens || 3,
        maxPlayers: worldState.maxPlayers || 3,
        gameDurationSeconds: worldState.gameDurationSeconds ?? 180,
        ballSpeed: worldState.ballSpeed || 'medium',
      });
    });

    const socketRateLimits = new Map();
    
    socket.on('ping_test', (data, callback)=>{
      const now = Date.now();
      const lastPing = socketRateLimits.get('ping_' + socket.id) || 0;
      if (now - lastPing < 500) return;
      socketRateLimits.set('ping_' + socket.id, now);
      if(typeof callback === 'function') callback();
    });

    socket.on('start_game', (data)=>{
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if(slotIndex!==worldState.masterPlayerIndex){
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can start the game' });
        return;
      }
      if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
        socket.emit('error', { errorCode: 1010, message: 'Game is already in progress' });
        return;
      }
      
      clearAllPowerUpTimers(worldState);
      if (worldState.slowBallTimer) {
        clearTimeout(worldState.slowBallTimer);
      }
      worldState.slowBallActive = false;
      worldState.slowBallTimer = null;
      worldState.powerUps = [];
      worldState.nextLevelBricks = null;
      worldState.level = 1;
      worldState.currentLevel = 1;
      worldState.bricks = gameEngine.loadLevel(1, null, worldState.numScreens);
      worldState.bricksDirty = true;
      
      worldState.longestRally = 0;
      worldState.powerupsCollected = 0;
      worldState.highestCombo = 0;
      worldState.rallyCount = 0;
      worldState.currentCombo = 0;
      
      const centerX = (worldState.numScreens * SCREEN_WIDTH) / 2;
      const ballCount = Math.max(1, worldState.maxPlayers || 3);
      const speedMult = worldState.ballSpeed === 'slow' ? 0.75 : (worldState.ballSpeed === 'fast' ? 1.4 : (worldState.ballSpeed === 'insane' ? 1.8 : 1.0));
      worldState.balls = [];
      for (let b = 0; b < ballCount; b++) {
        const vxDir = (b % 2 === 0 ? 1 : -1) * (2.5 + (b * 0.8)) * speedMult;
        const vyDir = (3.5 + (b * 0.5)) * speedMult;
        const ball = new gameEngine.Ball(`ball_${b + 1}`, centerX + ((b - Math.floor(ballCount / 2)) * 120), 500, vxDir, vyDir, BALL_RADIUS);
        ball.active = (b < Math.min(2, ballCount));
        worldState.balls.push(ball);
      }
      
      for (let p of worldState.players) {
        p.score = 0;
        p.lives = 3;
        p.inventory = [];
      }
      
      worldState.gameStatus = 'countdown';
      worldState.countdownStartedAt = Date.now();
      worldState.gameActive = false;
      worldState.gameDurationSeconds = normalizeDurationSeconds(data?.durationSeconds, 180);
      
      io.emit('countdown_started', { countdown: 3 });
      broadcastGameState();
      
      setTimeout(() => {
          if (worldState.gameStatus === 'countdown') {
              worldState.gameStatus = 'playing';
              worldState.gameActive = true;
              worldState.gameStartedAt = Date.now();
              io.emit('game_started', {
                  sessionId: worldState.sessionId,
                  gameStartedAt: worldState.gameStartedAt,
                  gameDurationSeconds: worldState.gameDurationSeconds,
              });
              broadcastGameState();
          }
      }, 3000);
    });

    socket.on('set_game_settings', (data)=>{
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if(slotIndex !== worldState.masterPlayerIndex){
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can configure settings' });
        return;
      }
      if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
        socket.emit('error', { errorCode: 1010, message: 'Cannot change settings during a match' });
        return;
      }
      const newMax = parseInt(data?.maxPlayers, 10);
      if(newMax >= 1 && newMax <= 5){
        if (worldState.players.slice(newMax).some(p => p.connected)) {
          socket.emit('error', { errorCode: 1011, message: 'Cannot reduce slots: active players occupy higher slots. Please wait for them to leave.' });
          return;
        }
        worldState.maxPlayers = newMax;
        while(worldState.players.length < newMax){
          let p = new gameEngine.Player(null);
          p.lastNonces = [];
          worldState.players.push(p);
        }
        if(worldState.players.length > newMax){
          worldState.players = worldState.players.slice(0, newMax);
        }
        if(worldState.masterPlayerIndex >= worldState.players.length || !worldState.players[worldState.masterPlayerIndex]?.connected){
          const connectedIdx = worldState.players.findIndex((p) => p.connected);
          worldState.masterPlayerIndex = connectedIdx >= 0 ? connectedIdx : 0;
        }
      }
      if(typeof data?.ballSpeed === 'string'){
        if(!ALLOWED_BALL_SPEEDS.has(data.ballSpeed)){
          socket.emit('error', { errorCode: 1005, message: 'Invalid ball speed' });
          return;
        }
        worldState.ballSpeed = data.ballSpeed;
      }
      if(data?.durationSeconds !== undefined && data?.durationSeconds !== null){
        worldState.gameDurationSeconds = normalizeDurationSeconds(data.durationSeconds, worldState.gameDurationSeconds || 180);
      }
      if(worldState.masterPlayerIndex >= worldState.players.length || !worldState.players[worldState.masterPlayerIndex]?.connected){
        const connectedIdx = worldState.players.findIndex((p) => p.connected);
        worldState.masterPlayerIndex = connectedIdx >= 0 ? connectedIdx : 0;
      }
      broadcastGameState();
    });

    socket.on('set_max_players', (data)=>{
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if(slotIndex !== worldState.masterPlayerIndex){
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can configure settings' });
        return;
      }
      if (worldState.gameStatus === 'playing' || worldState.gameStatus === 'countdown') {
        socket.emit('error', { errorCode: 1010, message: 'Cannot change lobby size during a match' });
        return;
      }
      const newMax = parseInt(data?.maxPlayers, 10);
      if(newMax >= 1 && newMax <= 5){
        if (worldState.players.slice(newMax).some(p => p.connected)) {
          socket.emit('error', { errorCode: 1011, message: 'Cannot reduce slots: active players occupy higher slots. Please wait for them to leave.' });
          return;
        }
        worldState.maxPlayers = newMax;
        while(worldState.players.length < newMax){
          let p = new gameEngine.Player(null);
          p.lastNonces = [];
          worldState.players.push(p);
        }
        if(worldState.players.length > newMax){
          worldState.players = worldState.players.slice(0, newMax);
        }
        if(worldState.masterPlayerIndex >= worldState.players.length){
          worldState.masterPlayerIndex = Math.max(0, worldState.players.findIndex((p) => p.connected));
          if(worldState.masterPlayerIndex < 0) worldState.masterPlayerIndex = 0;
        }
        broadcastGameState();
      }
    });

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
      if (status === 'playing' || status === 'countdown') {
        socket.emit('join_rejected', {
          errorCode: 1010,
          message: 'Match already in progress. Wait for the next lobby.',
        });
        return;
      }

      let slotIndex = worldState.players.findIndex((p) => !p.connected && p.name === playerName);
      if (slotIndex === -1) {
        slotIndex = worldState.players.findIndex((p) => !p.connected && !p.name);
      }
      if (slotIndex === -1) {
        slotIndex = worldState.players.findIndex((p) => !p.connected);
      }

      if(slotIndex===-1){
        socket.join('spectators');
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
      player.paddleWidth = player.paddleWidth || 300;
      if (typeof player.paddleX !== 'number') {
        player.paddleX = ((worldState.numScreens || 3) * SCREEN_WIDTH) / 2 - (player.paddleWidth / 2);
      }
      if (!Array.isArray(player.inventory)) player.inventory = [];
      player.lastNonces = [];
      socketToPlayerIndex.set(socket.id, slotIndex);

      if(disconnectTimers.has(player.id)){
        clearTimeout(disconnectTimers.get(player.id));
        disconnectTimers.delete(player.id);
      }

      socket.emit('join_confirmed', {
        playerId: player.id,
        playerNumber: slotIndex+1,
        isSpectator: false,
        sessionId: worldState.sessionId,
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
      const found = findPlayerBySocket(socket.id, worldState);
      if(!found) return;

      const { player } = found;
      let { deltaX, timestamp, nonce } = data || {};

      if(typeof deltaX!=='number' || isNaN(deltaX) || !isFinite(deltaX)){
        socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      if (worldState.gameStatus === 'playing') {
        const now = Date.now();
        if (!player.lastPaddleTime) player.lastPaddleTime = 0;
        if (now - player.lastPaddleTime < 16) return;
        player.lastPaddleTime = now;
      }

      const validation = validateMessage(player, timestamp, nonce);
      if(!validation.valid){
        socket.emit('error', { errorCode: validation.errorCode });
        return;
      }

      deltaX = Math.max(-5000, Math.min(5000, deltaX));

      const maxRight = (worldState.numScreens || 3) * SCREEN_WIDTH;
      player.paddleX += deltaX;
      const pw = player.paddleWidth || 300;
      player.paddleX = Math.max(0, Math.min(maxRight - pw, Math.round(player.paddleX)));
    });

    socket.on('power_up_activate', (data)=>{
      const found = findPlayerBySocket(socket.id, worldState);
      if(!found) return;

      const { player } = found;
      if(worldState.gameStatus !== 'playing') return;
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

      if(disconnectTimers.has(playerId)){
        clearTimeout(disconnectTimers.get(playerId));
        disconnectTimers.delete(playerId);
      }

      socket.emit('join_confirmed', {
        playerId: player.id,
        playerNumber: slotIndex + 1,
        isSpectator: false,
        sessionId: worldState.sessionId,
        resumeToken: player.resumeToken,
        resumed: true,
      });
      broadcastGameState();
    });

    socket.on('leave_game', ()=>{
      const found = findPlayerBySocket(socket.id, worldState);
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
      player.paddleWidth = 300;
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
    });

    socket.on('boundary_ack', (data)=>{
      const { handoffId, screenId } = data || {};
      const pending = pendingHandoffs.get(handoffId);
      if(!pending) return;

      if(screenId===pending.exitPayload.screenId){
        pending.departingAck = true;
      }
      if(screenId===pending.enterPayload.screenId){
        pending.arrivingAck = true;
      }
    });

    socket.on('disconnect', ()=>{
      const found = findPlayerBySocket(socket.id, worldState);
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
        player.paddleWidth = 300;
        player.score = 0;
        player.lives = 3;
        player.inventory = [];

        io.emit('player_disconnected', {
          playerNumber,
          message: 'Player left the game',
        });
        broadcastGameState();
      }, 30000);

      if(playerId){
        disconnectTimers.set(playerId, timer);
      }
    });
  });
}

module.exports = {
  registerSocketHandlers,
  applyPowerUpEffect,
  clearAllPowerUpTimers
};
