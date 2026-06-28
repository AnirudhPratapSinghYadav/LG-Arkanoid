const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const PORT = 8080;
const CANVAS_WIDTH = 9600;
const CANVAS_HEIGHT = 1080;
const BALL_RADIUS = 8;
const TICK_MS = 16;

function getScreenBoundaries() {
  const boundaries = [];
  const numScreens = worldState.numScreens || 5;
  for (let i = 0; i < numScreens; i++) {
    boundaries.push({
      screenId: i + 1,
      virtualLeft: i * 1920,
      virtualRight: (i + 1) * 1920 - 1
    });
  }
  return boundaries;
}

const FALLBACK_COMMENTARY = [
  'Great shot',
  'Keep it up',
  'Incoming',
  'Watch out',
  'Nice hit',
  'Level master',
  'Brick destroyer',
  'Almost there',
  'Final push',
  'Legendary play',
  'Three players one wall',
  'The rig is alive',
  'Boundary crossed',
  'Panoramic domination',
  'Classic arcade reborn',
  'Lock and load',
  'Eyes on the ball',
  'Score milestone reached',
  'Multi ball mayhem',
  'Victory is close',
];

const COMMENTARY_COOLDOWNS = {
  level_cleared: 0,
  life_lost: 15000,
  multi_ball: 0,
  score_milestone: 30000,
  victory: 0,
};

const PLAYER_SLOT_IDS = ['player1', 'player2', 'player3'];

function createInitialWorldState() {
  const state = new gameEngine.GameState();
  
  state.balls = [
    new gameEngine.Ball('ball1', 4800, 500, 3, 4, BALL_RADIUS),
    new gameEngine.Ball('ball2', 4800, 500, -3, 4, BALL_RADIUS)
  ];
  state.balls[1].active = false;
  
  for (let i = 0; i < 3; i++) {
    let p = new gameEngine.Player(null);
    p.lastNonces = [];
    p.widePaddleTimer = null;
    p.slowBallTimer = null;
    state.players.push(p);
  }
  
  state.bricks = gameEngine.loadLevel(state.level);
  
  state.sessionId = null;
  state.sessionToken = null;
  state.commentaryRateLimiter = {
    level_cleared: { lastCalledAt: 0 },
    life_lost: { lastCalledAt: 0 },
    multi_ball: { lastCalledAt: 0 },
    score_milestone: { lastCalledAt: 0 },
    victory: { lastCalledAt: 0 },
  };
  state.slowBallActive = false;
  state.originalBallSpeeds = null;
  
  return state;
}

let worldState = createInitialWorldState();
const pendingHandoffs = new Map();
const disconnectTimers = new Map();
const socketToPlayerIndex = new Map();

const app = express();

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('Generating self-signed SSL certificate...');
  try {
    execFileSync('openssl', ['req', '-nodes', '-new', '-x509', '-keyout', keyPath, '-out', certPath, '-days', '365', '-subj', '/CN=LG-Arkanoid']);
  } catch (err) {
    console.error('Failed to generate cert via openssl. Falling back to HTTP.', err.message);
  }
}

let server;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }, app);
  console.log('SSL certificate loaded. Running over HTTPS/WSS.');
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1024,
});

const webClientPath = path.join(__dirname, '..', 'web client');
app.use(express.static(webClientPath));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gameActive: worldState.gameStatus === 'playing',
    connectedPlayers: worldState.players.filter((p) => p.connected).length,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(webClientPath, 'controller.html'));
});

app.get('/screen', (req, res) => {
  res.sendFile(path.join(webClientPath, 'index.html'));
});

app.post('/api/deploy_lg', express.json(), (req, res) => {
  const { numScreens, masterIp, username, password } = req.body;
  worldState.numScreens = parseInt(numScreens) || 5;
  
  if (masterIp && password) {
    try {
      const deployScriptPath = path.join(__dirname, '..', 'deploy_to_rig.sh');
      execFileSync('bash', [deployScriptPath, masterIp, username, password, worldState.numScreens]);
    } catch (err) {
      console.error('Failed to deploy to LG Rig:', err.message);
    }
  }

  res.json({ status: 'deployed', numScreens: worldState.numScreens });
});

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function timingSafeTokenCompare(provided, stored) {
  if (typeof provided !== 'string' || typeof stored !== 'string') {
    return false;
  }
  const a = Buffer.from(provided.padEnd(6, '0'));
  const b = Buffer.from(stored.padEnd(6, '0'));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function getScreenIdForX(x) {
  const numScreens = worldState.numScreens || 5;
  const maxRight = numScreens * 1920 - 1;
  const clampedX = Math.max(0, Math.min(x, maxRight));
  return Math.floor(clampedX / 1920) + 1;
}

function getScreenById(screenId) {
  return getScreenBoundaries().find((s) => s.screenId === screenId);
}

function detectBoundary(ball) {
  const currentScreenId = getScreenIdForX(ball.x);
  const currentScreen = getScreenById(currentScreenId);
  if (!currentScreen) return null;

  const nextX = ball.x + ball.vx;

  if (nextX > currentScreen.virtualRight && currentScreenId !== 5) {
    const arrivingScreenId = currentScreenId + 1;
    const arrivingScreen = getScreenById(arrivingScreenId);
    return {
      departingScreenId: currentScreenId,
      arrivingScreenId,
      exitX: currentScreen.virtualRight,
      exitY: ball.y,
      entryX: arrivingScreen.virtualLeft,
      entryY: ball.y,
      velocityX: ball.vx,
      velocityY: ball.vy,
    };
  }

  if (nextX < currentScreen.virtualLeft && currentScreenId !== 1) {
    const arrivingScreenId = currentScreenId - 1;
    const arrivingScreen = getScreenById(arrivingScreenId);
    return {
      departingScreenId: currentScreenId,
      arrivingScreenId,
      exitX: currentScreen.virtualLeft,
      exitY: ball.y,
      entryX: arrivingScreen.virtualRight,
      entryY: ball.y,
      velocityX: ball.vx,
      velocityY: ball.vy,
    };
  }

  return null;
}

function triggerBoundaryHandoff(handoffResult, ball) {
  const handoffId = `${handoffResult.departingScreenId}-${handoffResult.arrivingScreenId}-${Date.now()}`;

  const exitPayload = {
    handoffId,
    ballId: ball.id,
    screenId: handoffResult.departingScreenId,
    exitX: handoffResult.exitX,
    exitY: handoffResult.exitY,
    velocityX: handoffResult.velocityX,
    velocityY: handoffResult.velocityY,
  };

  const enterPayload = {
    handoffId,
    ballId: ball.id,
    screenId: handoffResult.arrivingScreenId,
    entryX: handoffResult.entryX,
    entryY: handoffResult.entryY,
    velocityX: handoffResult.velocityX,
    velocityY: handoffResult.velocityY,
  };

  io.to(`screen-${handoffResult.departingScreenId}`).emit('boundary_exit', exitPayload);
  io.to(`screen-${handoffResult.arrivingScreenId}`).emit('boundary_enter', enterPayload);

  pendingHandoffs.set(handoffId, {
    departingAck: false,
    arrivingAck: false,
    exitPayload,
    enterPayload,
    retried: false,
  });

  setTimeout(() => {
    const pending = pendingHandoffs.get(handoffId);
    if (!pending) return;

    if (!pending.departingAck || !pending.arrivingAck) {
      io.to(`screen-${pending.exitPayload.screenId}`).emit('boundary_exit', pending.exitPayload);
      io.to(`screen-${pending.enterPayload.screenId}`).emit('boundary_enter', pending.enterPayload);
      console.warn(`Boundary handoff ${handoffId} retry emitted (missing ack)`);
      pending.retried = true;
    }

    setTimeout(() => pendingHandoffs.delete(handoffId), 100);
  }, 16);

  ball.x = handoffResult.entryX;
}



function broadcastGameState() {
  const payload = {
    balls: worldState.balls.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      active: b.active,
    })),
    bricks: worldState.bricks.map((row) =>
      row.map((brick) => ({
        row: brick.row,
        col: brick.col,
        x: brick.x,
        y: brick.y,
        active: brick.active,
      }))
    ),
    players: worldState.players.map((p, index) => ({
      id: p.id,
      playerNumber: index + 1,
      paddleX: p.paddleX,
      paddleWidth: p.paddleWidth,
      score: p.score,
      lives: p.lives,
      connected: p.connected,
    })),
    currentLevel: worldState.currentLevel,
    gameActive: worldState.gameActive,
  };
  io.emit('game_state', payload);
}

function buildPrompt(eventType, snapshot) {
  const scores = snapshot.players
    .filter((p) => p.connected)
    .map((p, i) => `P${i + 1}:${p.score}`)
    .join(', ');

  const templates = {
    level_cleared: `The player just cleared level ${snapshot.currentLevel}. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary. Do not mention brick colours. Do not predict future events.`,
    life_lost: `A player just lost a life. Current lives are ${snapshot.players.map((p) => p.lives).join(', ')}. Generate exactly 15 words of tense retro arcade announcer commentary.`,
    multi_ball: `Multi ball just activated with two balls crossing the panoramic rig. Generate exactly 15 words of excited commentary.`,
    score_milestone: `A player just crossed a score milestone. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary.`,
    victory: `The game is over. Final scores are ${scores}. Generate exactly 15 words of triumphant retro arcade announcer commentary declaring the winner.`,
  };
  return templates[eventType] || templates.score_milestone;
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No API key');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty Gemini response');
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerCommentary(eventType, snapshot) {
  const limiter = worldState.commentaryRateLimiter[eventType];
  const cooldown = COMMENTARY_COOLDOWNS[eventType] || 0;
  const now = Date.now();

  let text = null;
  let source = 'fallback';

  if (limiter && cooldown > 0 && now - limiter.lastCalledAt < cooldown) {
    text = FALLBACK_COMMENTARY[crypto.randomInt(0, FALLBACK_COMMENTARY.length)];
    io.emit('commentary', { text, source, eventType });
    return;
  }

  try {
    const prompt = buildPrompt(eventType, snapshot);
    text = await callGemini(prompt);
    source = 'gemini';
  } catch (err) {
    text = FALLBACK_COMMENTARY[crypto.randomInt(0, FALLBACK_COMMENTARY.length)];
    source = 'fallback';
  }

  if (limiter) {
    limiter.lastCalledAt = Date.now();
  }

  io.emit('commentary', { text, source, eventType });
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

function findPlayerBySocket(socketId) {
  const index = socketToPlayerIndex.get(socketId);
  if (index === undefined) return null;
  return { player: worldState.players[index], index };
}

function clearPlayerTimers(player) {
  if (player.widePaddleTimer) {
    clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = null;
  }
  if (player.slowBallTimer) {
    clearTimeout(player.slowBallTimer);
    player.slowBallTimer = null;
  }
}

function applyBombPowerUp() {
  const activeBall = worldState.balls.find((b) => b.active);
  if (!activeBall) return;

  let bestCluster = null;
  let bestDistance = Infinity;

  for (let row = 0; row <= 5; row++) {
    for (let col = 0; col <= 12; col++) {
      let activeCount = 0;
      let centerX = 0;
      let centerY = 0;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const brick = worldState.bricks[row + dr]?.[col + dc];
          if (brick && brick.active) {
            activeCount++;
            centerX += brick.x + brick.width / 2;
            centerY += brick.y + brick.height / 2;
          }
        }
      }
      if (activeCount === 0) continue;
      centerX /= activeCount;
      centerY /= activeCount;
      const dist = Math.hypot(activeBall.x - centerX, activeBall.y - centerY);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestCluster = { row, col };
      }
    }
  }

  if (!bestCluster) return;

  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const brick = worldState.bricks[bestCluster.row + dr]?.[bestCluster.col + dc];
      if (brick) brick.active = false;
    }
  }
}

function resetWorldForNewGame() {
  clearAllPowerUpTimers();
  worldState = createInitialWorldState();
  socketToPlayerIndex.clear();
}

function clearAllPowerUpTimers() {
  for (const player of worldState.players) {
    clearPlayerTimers(player);
  }
}

function getWorldSnapshot() {
  return {
    players: worldState.players.map((p) => ({
      id: p.id,
      score: p.score,
      lives: p.lives,
      connected: p.connected,
    })),
    currentLevel: worldState.currentLevel,
  };
}

io.on('connection', (socket) => {
  const screenId = parseInt(socket.handshake.query.screenId, 10);
  if (screenId >= 1 && screenId <= 5) {
    socket.join(`screen-${screenId}`);
  }

  socket.on('start_game', () => {
    resetWorldForNewGame();
    worldState.gameStatus = 'playing';
    worldState.sessionId = crypto.randomUUID();
    worldState.sessionToken = generateToken();
    io.emit('game_started', {
      sessionToken: worldState.sessionToken,
      sessionId: worldState.sessionId,
    });
    broadcastGameState();
  });

  socket.on('player_join', (data) => {
    const { sessionToken } = data || {};

    if (typeof sessionToken !== 'string' || sessionToken.length > 64) {
      socket.emit('join_rejected', { errorCode: 1005, message: 'Invalid payload' });
      return;
    }

    if (!timingSafeTokenCompare(sessionToken, String(worldState.sessionToken || ''))) {
      socket.emit('join_rejected', { errorCode: 1001, message: 'Invalid session token' });
      return;
    }

    const slotIndex = worldState.players.findIndex((p) => !p.connected);
    if (slotIndex === -1) {
      socket.emit('join_rejected', { errorCode: 1002, message: 'No paddle slots available' });
      return;
    }

    const player = worldState.players[slotIndex];
    player.connected = true;
    player.id = PLAYER_SLOT_IDS[slotIndex];
    player.socketId = socket.id;
    player.lastNonces = [];
    socketToPlayerIndex.set(socket.id, slotIndex);

    if (disconnectTimers.has(socket.id)) {
      clearTimeout(disconnectTimers.get(socket.id));
      disconnectTimers.delete(socket.id);
    }

    socket.emit('join_confirmed', {
      playerId: player.id,
      playerNumber: slotIndex + 1,
      sessionId: worldState.sessionId,
    });
    broadcastGameState();
  });

  socket.on('resume_request', (data) => {
    const { playerId, sessionId } = data || {};
    if (sessionId !== worldState.sessionId) {
      socket.emit('join_rejected', { errorCode: 1001, message: 'Session expired' });
      return;
    }

    const slotIndex = worldState.players.findIndex((p) => p.id === playerId && !p.connected);
    if (slotIndex === -1) {
      socket.emit('join_rejected', { errorCode: 1002, message: 'Cannot resume this slot' });
      return;
    }

    const player = worldState.players[slotIndex];
    player.connected = true;
    player.socketId = socket.id;
    socketToPlayerIndex.set(socket.id, slotIndex);

    socket.emit('join_confirmed', {
      playerId: player.id,
      playerNumber: slotIndex + 1,
      sessionId: worldState.sessionId,
    });
    broadcastGameState();
  });

  socket.on('paddle_move', (data) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;

    const { player } = found;
    const { x, timestamp, nonce } = data || {};

    if (typeof x !== 'number' || isNaN(x)) {
      socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
      return;
    }

    const validation = validateMessage(player, timestamp, nonce);
    if (!validation.valid) {
      socket.emit('error', { errorCode: validation.errorCode });
      return;
    }

    player.paddleX = Math.max(0, Math.min(9300, Math.round(x)));
  });

  socket.on('power_up_activate', (data) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;

    const { player } = found;
    const { powerUpType, timestamp, nonce } = data || {};

    if (typeof powerUpType !== 'string' || powerUpType.length > 20) {
      socket.emit('error', { errorCode: 1005, message: 'Invalid payload' });
      return;
    }

    const now = Date.now();
    if (player.lastPowerUpTime && now - player.lastPowerUpTime < 5000) {
      socket.emit('error', { errorCode: 1006, message: 'Power-up on cooldown' });
      return;
    }
    player.lastPowerUpTime = now;

    const validation = validateMessage(player, timestamp, nonce);
    if (!validation.valid) {
      socket.emit('error', { errorCode: validation.errorCode });
      return;
    }

    if (powerUpType === 'wide_paddle') {
      player.paddleWidth = 600;
      if (player.widePaddleTimer) clearTimeout(player.widePaddleTimer);
      player.widePaddleTimer = setTimeout(() => {
        player.paddleWidth = 300;
        player.widePaddleTimer = null;
      }, 8000);
    } else if (powerUpType === 'slow_ball') {
      if (!worldState.slowBallActive) {
        worldState.originalBallSpeeds = worldState.balls.map((b) => ({ vx: b.vx, vy: b.vy }));
        for (const ball of worldState.balls) {
          if (ball.active) {
            ball.vx *= 0.5;
            ball.vy *= 0.5;
          }
        }
        worldState.slowBallActive = true;
      }
      if (player.slowBallTimer) clearTimeout(player.slowBallTimer);
      player.slowBallTimer = setTimeout(() => {
        if (worldState.originalBallSpeeds) {
          worldState.balls.forEach((ball, i) => {
            if (worldState.originalBallSpeeds[i]) {
              ball.vx = worldState.originalBallSpeeds[i].vx;
              ball.vy = worldState.originalBallSpeeds[i].vy;
            }
          });
        }
        worldState.slowBallActive = false;
        worldState.originalBallSpeeds = null;
        player.slowBallTimer = null;
      }, 8000);
    } else if (powerUpType === 'multi_ball') {
      const ball1 = worldState.balls[0];
      const ball2 = worldState.balls[1];
      if (ball1 && ball2 && !ball2.active) {
        ball2.x = ball1.x;
        ball2.y = ball1.y;
        ball2.vx = -ball1.vx;
        ball2.vy = ball1.vy;
        ball2.active = true;
        ball2.lastTouchedByPlayerId = player.id;
        triggerCommentary('multi_ball', getWorldSnapshot());
      }
    } else if (powerUpType === 'bomb') {
      applyBombPowerUp();
    }
  });

  socket.on('boundary_ack', (data) => {
    const { handoffId, screenId } = data || {};
    const pending = pendingHandoffs.get(handoffId);
    if (!pending) return;

    if (screenId === pending.exitPayload.screenId) {
      pending.departingAck = true;
    }
    if (screenId === pending.enterPayload.screenId) {
      pending.arrivingAck = true;
    }
  });

  socket.on('disconnect', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;

    const { player, index } = found;
    const playerNumber = index + 1;
    const disconnectedSocketId = socket.id;

    if (disconnectTimers.has(disconnectedSocketId)) {
      clearTimeout(disconnectTimers.get(disconnectedSocketId));
    }

    const timer = setTimeout(() => {
      disconnectTimers.delete(disconnectedSocketId);

      if (player.socketId !== disconnectedSocketId) {
        return;
      }

      player.connected = false;
      player.id = null;
      player.socketId = null;
      player.lastNonces = [];
      clearPlayerTimers(player);
      socketToPlayerIndex.delete(disconnectedSocketId);

      io.emit('player_disconnected', {
        playerNumber,
        message: 'Player left the game',
      });
      broadcastGameState();
    }, 5000);

    disconnectTimers.set(disconnectedSocketId, timer);
  });
});

setInterval(() => {
  if (worldState.gameStatus !== 'playing') return;

  const beforeScores = worldState.players.map(p => p.score);
  const beforeLives = worldState.players.map(p => p.lives);
  const beforeLevel = worldState.level;
  const beforeBallScreens = worldState.balls.map(b => getScreenIdForX(b.x));

  gameEngine.updateGameLoop(worldState);

  for (let i = 0; i < worldState.players.length; i++) {
    const p = worldState.players[i];
    if (p.score > 0 && Math.floor(beforeScores[i] / 5000) < Math.floor(p.score / 5000)) {
      triggerCommentary('score_milestone', getWorldSnapshot());
    }
    if (p.lives < beforeLives[i]) {
      triggerCommentary('life_lost', getWorldSnapshot());
      if (p.lives === 0) {
        io.emit('player_eliminated', { playerId: p.id, playerNumber: i + 1 });
      }
    }
  }

  if (worldState.level > beforeLevel) {
    triggerCommentary('level_cleared', getWorldSnapshot());
  } else if (worldState.gameStatus === 'win' && beforeLevel > 0) {
    triggerCommentary('victory', getWorldSnapshot());
  }

  worldState.balls.forEach((ball, i) => {
    if (!ball.active) return;
    const currentScreen = getScreenIdForX(ball.x);
    const oldScreen = beforeBallScreens[i];
    if (currentScreen !== oldScreen) {
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
        if (!pending) return;

        if (!pending.departingAck || !pending.arrivingAck) {
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

server.listen(PORT, () => {
  console.log(`LG Arkanoid game server running on port ${PORT}`);
});
