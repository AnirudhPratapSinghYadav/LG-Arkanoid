const gameEngine = require('../gameEngine.js');
const { PLAYER_SLOT_IDS, BALL_RADIUS, PORT, getLanIp, createInitialWorldState } = require('../config.js');
const { triggerCommentary } = require('../services/geminiService.js');

const socketToPlayerIndex = new Map();
const disconnectTimers = new Map();
const ipJoinAttempts = new Map();

function timingSafeTokenCompare(provided, stored){
  if(typeof provided !== 'string' || typeof stored !== 'string'){
    return false;
  }
  const crypto = require('crypto');
  const a = Buffer.from(provided.padEnd(6, '0'));
  const b = Buffer.from(stored.padEnd(6, '0'));
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

function applyBombPowerUp(worldState){
  const activeBall = worldState.balls.find((b)=>b.active);
  if(!activeBall || !worldState.bricks) return;

  const blastRadius = 350;
  for(let r = 0; r < worldState.bricks.length; r++){
    const row = worldState.bricks[r];
    if(!row) continue;
    for(let c = 0; c < row.length; c++){
      const brick = row[c];
      if(!brick || !brick.active || brick.type === 'indestructible') continue;

      const brickCenterX = brick.x + brick.width / 2;
      const brickCenterY = brick.y + brick.height / 2;
      const dist = Math.hypot(activeBall.x - brickCenterX, activeBall.y - brickCenterY);

      if(dist <= blastRadius){
        brick.active = false;
      }
    }
  }
}

function applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot){
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
    const targetBall = worldState.balls.find(b=>!b.active);
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
    applyBombPowerUp(worldState);
  }
}

function validateMessage(player, timestamp, nonce){
  const now = Date.now();

  if(typeof timestamp!=='number' || typeof nonce!=='string' || nonce.length > 32){
    return { valid: false, errorCode: 1003 };
  }

  if(Math.abs(now-timestamp) > 3000){
    return { valid: false, errorCode: 1008 };
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
    }

    broadcastGameState();

    socket.on('ping_test', (data, callback)=>{
      if(typeof callback === 'function') callback();
    });

    socket.on('start_game', (data)=>{
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if(slotIndex!==worldState.masterPlayerIndex){
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can start the game' });
        return;
      }
      
      clearAllPowerUpTimers(worldState);
      worldState.level = 1;
      worldState.currentLevel = 1;
      worldState.bricks = gameEngine.loadLevel(1, null, worldState.numScreens);
      
      worldState.longestRally = 0;
      worldState.powerupsCollected = 0;
      worldState.highestCombo = 0;
      worldState.rallyCount = 0;
      worldState.currentCombo = 0;
      
      const centerX = (worldState.numScreens * 1920) / 2;
      const ballCount = Math.max(1, worldState.maxPlayers || 3);
      const speedMult = worldState.ballSpeed === 'slow' ? 0.75 : (worldState.ballSpeed === 'fast' ? 1.4 : (worldState.ballSpeed === 'insane' ? 1.8 : 1.0));
      worldState.balls = [];
      for (let b = 0; b < ballCount; b++) {
        const vxDir = (b % 2 === 0 ? 1 : -1) * (2.5 + (b * 0.8)) * speedMult;
        const vyDir = (3.5 + (b * 0.5)) * speedMult;
        const ball = new gameEngine.Ball(`ball_${b + 1}`, centerX + ((b - Math.floor(ballCount / 2)) * 120), 500, vxDir, vyDir, BALL_RADIUS);
        ball.active = (b < Math.min(2, ballCount)); // Start active balls capped by total ballCount
        worldState.balls.push(ball);
      }
      
      for (let p of worldState.players) {
        p.score = 0;
        p.lives = 3;
      }
      
      worldState.gameStatus = 'countdown';
      worldState.countdownStartedAt = Date.now();
      worldState.gameActive = false;
      worldState.gameDurationSeconds = data?.durationSeconds || 180;
      
      io.emit('countdown_started', { countdown: 3 });
      broadcastGameState();
      
      setTimeout(() => {
          if (worldState.gameStatus === 'countdown') {
              worldState.gameStatus = 'playing';
              worldState.gameActive = true;
              worldState.gameStartedAt = Date.now();
              io.emit('game_started', {
                  sessionToken: worldState.sessionToken,
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
      const newMax = parseInt(data?.maxPlayers, 10);
      if(newMax >= 1 && newMax <= 5){
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
          worldState.masterPlayerIndex = 0;
        }
      }
      if(typeof data?.ballSpeed === 'string'){
        worldState.ballSpeed = data.ballSpeed;
      }
      if(typeof data?.durationSeconds === 'number'){
        worldState.gameDurationSeconds = data.durationSeconds;
      }
      broadcastGameState();
    });

    socket.on('set_max_players', (data)=>{
      const slotIndex = socketToPlayerIndex.get(socket.id);
      if(slotIndex !== worldState.masterPlayerIndex){
        socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can configure settings' });
        return;
      }
      const newMax = parseInt(data?.maxPlayers, 10);
      if(newMax >= 1 && newMax <= 5){
        worldState.maxPlayers = newMax;
        while(worldState.players.length < newMax){
          let p = new gameEngine.Player(null);
          p.lastNonces = [];
          worldState.players.push(p);
        }
        if(worldState.players.length > newMax){
          worldState.players = worldState.players.slice(0, newMax);
        }
        broadcastGameState();
      }
    });

    const handleJoin = (data)=>{
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

      const slotIndex = worldState.players.findIndex((p)=>!p.connected);
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
      player.name = (typeof playerName === 'string' && playerName.trim().length > 0) ? playerName.trim().substring(0, 12) : `Player ${slotIndex + 1}`;
      player.socketId = socket.id;
      player.paddleWidth = player.paddleWidth || 300;
      if (typeof player.paddleX !== 'number') {
        player.paddleX = ((worldState.numScreens || 3)*1920)/2 - (player.paddleWidth/2);
      }
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
      const { deltaX, timestamp, nonce } = data || {};

      if(typeof deltaX!=='number' || isNaN(deltaX)){
        socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      const validation = validateMessage(player, timestamp, nonce);
      if(!validation.valid){
        socket.emit('error', { errorCode: validation.errorCode });
        return;
      }

      const maxRight = (worldState.numScreens || 3)*1920;
      player.paddleX += deltaX;
      player.paddleX = Math.max(0, Math.min(maxRight-300, Math.round(player.paddleX)));
    });

    socket.on('power_up_activate', (data)=>{
      const found = findPlayerBySocket(socket.id, worldState);
      if(!found) return;

      const { player } = found;
      const { powerUpType, timestamp, nonce } = data || {};

      if(typeof powerUpType!=='string' || powerUpType.length > 20){
        socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
        return;
      }

      const now = Date.now();
      if(player.lastPowerUpTime && now-player.lastPowerUpTime < 5000){
        socket.emit('error', { errorCode: 1006, message: 'Power-up on cooldown' });
        return;
      }
      player.lastPowerUpTime = now;

      const validation = validateMessage(player, timestamp, nonce);
      if(!validation.valid){
        socket.emit('error', { errorCode: validation.errorCode });
        return;
      }

      applyPowerUpEffect(player, powerUpType, worldState, io, getWorldSnapshot);
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
      
      io.emit('player_connection_lost', {
        playerNumber,
        playerId: player.id,
        message: 'Connection lost, waiting to reconnect...',
      });

      const timer = setTimeout(()=>{
        if(playerId) disconnectTimers.delete(playerId);

        if(player.connected && player.socketId!==disconnectedSocketId){
          return;
        }

        player.connected = false;
        player.id = null;
        player.socketId = null;
        player.lastNonces = [];
        clearPlayerTimers(player);
        player.name = null;
        
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

        socketToPlayerIndex.delete(disconnectedSocketId);

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
