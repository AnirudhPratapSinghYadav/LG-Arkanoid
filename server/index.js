/**
 * LG Arkanoid Game Server
 *
 * Authoritative multiplayer brick breaker for the Liquid Galaxy five screen rig.
 * Owns world state, physics, boundary handoffs, security validation, and Gemini commentary.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const PORT = 8080;
const CANVAS_WIDTH = 9600;
const CANVAS_HEIGHT = 1080;
const BALL_RADIUS = 8;
const TICK_MS = 16;

const SCREEN_BOUNDARIES = [
  { screenId: 1, virtualLeft: 0, virtualRight: 1919 },
  { screenId: 2, virtualLeft: 1920, virtualRight: 3839 },
  { screenId: 3, virtualLeft: 3840, virtualRight: 5759 },
  { screenId: 4, virtualLeft: 5760, virtualRight: 7679 },
  { screenId: 5, virtualLeft: 7680, virtualRight: 9599 },
];

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

// ---------------------------------------------------------------------------
// World state factory
// ---------------------------------------------------------------------------

function createBrickGrid() {
  const bricks = [];
  for (let row = 0; row < 8; row++) {
    const rowBricks = [];
    for (let col = 0; col < 15; col++) {
      rowBricks.push({
        row,
        col,
        x: col * 640,
        y: 100 + row * 40,
        width: 600,
        height: 30,
        active: true,
      });
    }
    bricks.push(rowBricks);
  }
  return bricks;
}

function createInitialWorldState() {
  return {
    balls: [
      {
        id: 'ball1',
        x: 4800,
        y: 500,
        vx: 3,
        vy: 4,
        active: true,
        lastTouchedByPlayerId: null,
      },
      {
        id: 'ball2',
        x: 4800,
        y: 500,
        vx: -3,
        vy: 4,
        active: false,
        lastTouchedByPlayerId: null,
      },
    ],
    bricks: createBrickGrid(),
    players: [
      {
        id: null,
        paddleX: 4800,
        paddleWidth: 300,
        paddleY: 1000,
        score: 0,
        lives: 3,
        connected: false,
        lastNonces: [],
        socketId: null,
        widePaddleTimer: null,
        slowBallTimer: null,
      },
      {
        id: null,
        paddleX: 4800,
        paddleWidth: 300,
        paddleY: 1000,
        score: 0,
        lives: 3,
        connected: false,
        lastNonces: [],
        socketId: null,
        widePaddleTimer: null,
        slowBallTimer: null,
      },
      {
        id: null,
        paddleX: 4800,
        paddleWidth: 300,
        paddleY: 1000,
        score: 0,
        lives: 3,
        connected: false,
        lastNonces: [],
        socketId: null,
        widePaddleTimer: null,
        slowBallTimer: null,
      },
    ],
    currentLevel: 1,
    gameActive: false,
    sessionId: null,
    sessionToken: null,
    commentaryRateLimiter: {
      level_cleared: { lastCalledAt: 0 },
      life_lost: { lastCalledAt: 0 },
      multi_ball: { lastCalledAt: 0 },
      score_milestone: { lastCalledAt: 0 },
      victory: { lastCalledAt: 0 },
    },
    slowBallActive: false,
    originalBallSpeeds: null,
  };
}

let worldState = createInitialWorldState();
const pendingHandoffs = new Map();
const disconnectTimers = new Map();
const socketToPlayerIndex = new Map();

// ---------------------------------------------------------------------------
// Express and Socket.io
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const webClientPath = path.join(__dirname, '..', 'web client');
app.use(express.static(webClientPath));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gameActive: worldState.gameActive,
    connectedPlayers: worldState.players.filter((p) => p.connected).length,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(webClientPath, 'index.html'));
});

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function generateToken() {
  return crypto.randomInt(100000, 999999).toString();
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
  for (const screen of SCREEN_BOUNDARIES) {
    if (x >= screen.virtualLeft && x <= screen.virtualRight) {
      return screen.screenId;
    }
  }
  if (x < 0) return 1;
  return 5;
}

function getScreenById(screenId) {
  return SCREEN_BOUNDARIES.find((s) => s.screenId === screenId);
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

function circleRectOverlap(cx, cy, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function checkBrickCollision(ball) {
  for (const row of worldState.bricks) {
    for (const brick of row) {
      if (!brick.active) continue;
      if (circleRectOverlap(ball.x, ball.y, BALL_RADIUS, brick)) {
        brick.active = false;
        ball.vy = -ball.vy;
        if (ball.lastTouchedByPlayerId) {
          const player = worldState.players.find((p) => p.id === ball.lastTouchedByPlayerId);
          if (player) {
            const previousScore = player.score;
            player.score += 100;
            player._previousScore = previousScore;
            return ball.lastTouchedByPlayerId;
          }
        }
        return null;
      }
    }
  }
  return null;
}

function checkPaddleCollision(ball) {
  for (const player of worldState.players) {
    if (!player.connected) continue;

    const nextY = ball.y + ball.vy;
    const paddleTop = player.paddleY;
    const withinVertical = nextY + BALL_RADIUS >= paddleTop - 10 && nextY <= paddleTop;
    const withinHorizontal =
      ball.x >= player.paddleX && ball.x <= player.paddleX + player.paddleWidth;

    if (withinVertical && withinHorizontal) {
      ball.vy = -Math.abs(ball.vy);
      const paddleCenter = player.paddleX + player.paddleWidth / 2;
      const offset = ball.x - paddleCenter;
      const halfWidth = player.paddleWidth / 2;
      const normalized = halfWidth > 0 ? offset / halfWidth : 0;

      if (normalized <= -0.8) {
        ball.vx = -6;
      } else if (normalized >= 0.8) {
        ball.vx = 6;
      }

      if (player.id) {
        ball.lastTouchedByPlayerId = player.id;
      }
      return true;
    }
  }
  return false;
}

function allBricksInactive() {
  for (const row of worldState.bricks) {
    for (const brick of row) {
      if (brick.active) return false;
    }
  }
  return true;
}

function resetBall(ball) {
  ball.x = 4800;
  ball.y = 500;
  ball.vx = 3;
  ball.vy = 4;
  ball.active = true;
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
  if (typeof timestamp !== 'number' || Math.abs(now - timestamp) > 500) {
    return { valid: false, errorCode: 1003 };
  }

  const recentDuplicate = player.lastNonces.some(
    (entry) => entry.nonce === nonce && now - entry.time < 100
  );
  if (recentDuplicate) {
    return { valid: false, errorCode: 1004 };
  }

  player.lastNonces.push({ nonce, time: now });
  if (player.lastNonces.length > 50) {
    player.lastNonces = player.lastNonces.slice(-50);
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

// ---------------------------------------------------------------------------
// Socket.io connection handler
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  const screenId = parseInt(socket.handshake.query.screenId, 10);
  if (screenId >= 1 && screenId <= 5) {
    socket.join(`screen-${screenId}`);
  }

  socket.on('start_game', () => {
    resetWorldForNewGame();
    worldState.gameActive = true;
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
    if (!timingSafeTokenCompare(String(sessionToken || ''), String(worldState.sessionToken || ''))) {
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

// ---------------------------------------------------------------------------
// Main game loop at 60 fps
// ---------------------------------------------------------------------------

setInterval(() => {
  if (!worldState.gameActive) return;

  for (const ball of worldState.balls) {
    if (!ball.active) continue;

    const scoringPlayerId = checkBrickCollision(ball);
    if (scoringPlayerId) {
      const player = worldState.players.find((p) => p.id === scoringPlayerId);
      if (
        player &&
        player.score > 0 &&
        player.score % 5000 === 0 &&
        (player._previousScore === undefined || Math.floor(player._previousScore / 5000) < Math.floor(player.score / 5000))
      ) {
        triggerCommentary('score_milestone', getWorldSnapshot());
      }
      if (player) player._previousScore = player.score;
    }

    checkPaddleCollision(ball);

    if (ball.y - BALL_RADIUS < 0) {
      ball.vy = Math.abs(ball.vy);
    }

    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx);
    }

    if (ball.x + BALL_RADIUS > CANVAS_WIDTH - 1) {
      ball.x = CANVAS_WIDTH - 1 - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y > CANVAS_HEIGHT) {
      if (ball.lastTouchedByPlayerId) {
        const player = worldState.players.find((p) => p.id === ball.lastTouchedByPlayerId);
        if (player) {
          const previousLives = player.lives;
          player.lives = Math.max(0, player.lives - 1);
          if (previousLives > player.lives) {
            triggerCommentary('life_lost', getWorldSnapshot());
          }
          if (player.lives === 0) {
            io.emit('player_eliminated', { playerId: player.id, playerNumber: worldState.players.indexOf(player) + 1 });
          }
        }
      }

      ball.active = false;
      const anyActive = worldState.balls.some((b) => b.active);
      if (!anyActive) {
        resetBall(worldState.balls[0]);
        worldState.balls[1].active = false;
      }
      continue;
    }

    const handoff = detectBoundary(ball);
    if (handoff) {
      triggerBoundaryHandoff(handoff, ball);
    } else {
      ball.x += ball.vx;
      ball.y += ball.vy;
    }
  }

  if (allBricksInactive()) {
    triggerCommentary('level_cleared', getWorldSnapshot());
    worldState.currentLevel += 1;
    worldState.bricks = createBrickGrid();

    if (worldState.currentLevel >= 4) {
      worldState.gameActive = false;
      triggerCommentary('victory', getWorldSnapshot());
    }
  }

  broadcastGameState();
}, TICK_MS);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`LG Arkanoid game server running on port ${PORT}`);
});
