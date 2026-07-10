require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const PORT = process.env.PORT || 8080;
const CANVAS_HEIGHT = 1080;
const BALL_RADIUS = 8;
const TICK_MS = 16;

function getScreenBoundaries(){
  const boundaries = [];
  const numScreens = worldState.numScreens || 5;
  for(let i = 0; i < numScreens; i++){
    boundaries.push({
      screenId: i+1,
      virtualLeft: i*1920,
      virtualRight: (i+1)*1920-1
    });
  }
  return boundaries;
}

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
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
  rank_takeover: 9000,
};

const PLAYER_SLOT_IDS = ['player1', 'player2', 'player3'];

function createInitialWorldState(){
  const state = new gameEngine.GameState();
  
  state.balls = [
    new gameEngine.Ball('ball1', 4800, 500, 3, 4, BALL_RADIUS),
    new gameEngine.Ball('ball2', 4800, 500, -3, 4, BALL_RADIUS)
  ];
  state.balls[1].active = false;
  
  for(let i = 0; i < 3; i++){
    let p = new gameEngine.Player(null);
    p.lastNonces = [];
    p.widePaddleTimer = null;
    p.slowBallTimer = null;
    state.players.push(p);
  }
  
  state.bricks = gameEngine.loadLevel(state.level);
  
  state.sessionId = null;
  state.sessionToken = null;
  state.masterPlayerIndex = 0;
  state.commentaryRateLimiter = {
    level_cleared: { lastCalledAt: 0 },
    life_lost: { lastCalledAt: 0 },
    multi_ball: { lastCalledAt: 0 },
    score_milestone: { lastCalledAt: 0 },
    victory: { lastCalledAt: 0 },
    rank_takeover: { lastCalledAt: 0 },
    game_master: { lastCalledAt: 0 },
  };
  state.slowBallActive = false;
  state.slowBallTimer = null;
  state.originalBallSpeeds = null;
  
  state.currentLevel = state.level;
  state.gameActive = false;
  state.numScreens = process.env.NUM_SCREENS || 5;
  
  return state;
}

let worldState = createInitialWorldState();
const pendingHandoffs = new Map();
const disconnectTimers = new Map();
const socketToPlayerIndex = new Map();

const app = express();

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if(!fs.existsSync(certPath) || !fs.existsSync(keyPath)){
  console.log('Skipping SSL generation for local network debug...');
  /*
  try {
    execFileSync('openssl', ['req', '-nodes', '-new', '-x509', '-keyout', keyPath, '-out', certPath, '-days', '365', '-subj', '/CN=LG-Arkanoid']);
  } catch(err){
    console.error('Failed to generate cert via openssl. Falling back to HTTP.', err.message);
  }
  */
}

let server;
if(fs.existsSync(certPath) && fs.existsSync(keyPath)){
  server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }, app);
  console.log('SSL certificate loaded. Running over HTTPS/WSS.');
}else{
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1024,
});

const webClientPath = path.join(__dirname, '..', 'web client');

app.get('/health', (req, res)=>{
  res.json({
    status: 'ok',
    gameActive: worldState.gameStatus==='playing',
    connectedPlayers: worldState.players.filter((p)=>p.connected).length,
  });
});

app.get('/', (req, res)=>{
  res.sendFile(path.join(webClientPath, 'controller.html'));
});

app.get('/screen', (req, res)=>{
  res.sendFile(path.join(webClientPath, 'index.html'));
});

// Serve static files AFTER specific routes so index.html doesn't hijack '/'
app.use(express.static(webClientPath));

function generateToken(){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for(let i = 0; i < 4; i++){
    token += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return token;
}

function timingSafeTokenCompare(provided, stored){
  if(typeof provided!=='string' || typeof stored!=='string'){
    return false;
  }
  const a = Buffer.from(provided.padEnd(6, '0'));
  const b = Buffer.from(stored.padEnd(6, '0'));
  if(a.length!==b.length){
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function getScreenIdForX(x){
  const numScreens = worldState.numScreens || 5;
  const maxRight = numScreens*1920-1;
  const clampedX = Math.max(0, Math.min(x, maxRight));
  return Math.floor(clampedX/1920)+1;
}

function getScreenById(screenId){
  return getScreenBoundaries().find((s)=>s.screenId===screenId);
}

function broadcastGameState(){
  const sortedPlayers = [...worldState.players].sort((a, b)=>b.score-a.score);
  let currentRank = 1;
  let previousScore = null;
  const ranks = {};

  sortedPlayers.forEach((p, index)=>{
    if(previousScore!==null && p.score < previousScore){
      currentRank = index+1;
    }
    ranks[p.id] = currentRank;
    previousScore = p.score;
  });

  if(worldState.previousRanks){
    for(let p of worldState.players){
      if(p.connected && p.id && ranks[p.id] && worldState.previousRanks[p.id]){
        if(ranks[p.id] < worldState.previousRanks[p.id]){
          let snapshot = getWorldSnapshot();
          snapshot.playerId = p.id;
          triggerCommentary('rank_takeover', snapshot);
        }
      }
    }
  }
  worldState.previousRanks = ranks;

  const payload = {
    balls: worldState.balls.map((b)=>({
      id: b.id,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      active: b.active,
    })),
    bricks: worldState.bricks.map((row) =>
      row.map((brick)=>({
        row: brick.row,
        col: brick.col,
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
        type: brick.type,
        active: brick.active,
      }))
    ),
    players: worldState.players.map((p, index)=>({
      id: p.id,
      playerNumber: index+1,
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
  };
  io.emit('game_state', payload);
}

function buildPrompt(eventType, snapshot){
  const scores = snapshot.players
    .filter((p)=>p.connected)
    .map((p, i)=>`${p.name || 'P'+(i+1)}:${p.score}`)
    .join(', ');

  const templates = {
    level_cleared: `The player just cleared level ${snapshot.currentLevel}. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary mentioning player names. Do not mention brick colours. Do not predict future events.`,
    life_lost: `A player just lost a life. Current lives are ${snapshot.players.map((p)=>`${p.name || p.id}: ${p.lives}`).join(', ')}. Generate exactly 15 words of tense retro arcade announcer commentary mentioning player names.`,
    multi_ball: `Multi ball just activated with two balls crossing the panoramic rig. Generate exactly 15 words of excited commentary.`,
    score_milestone: `A player just crossed a score milestone. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary mentioning player names.`,
    victory: `The game is over. Final scores are ${scores}. Generate exactly 15 words of triumphant retro arcade announcer commentary declaring the winner by name.`,
    rank_takeover: `Player ${snapshot.playerId || 'someone'} just took the lead from their opponent. Scores are ${scores}. Generate exactly 15 words of excited, competitive retro arcade commentary announcing the lead change and mentioning player names.`,
  };
  return templates[eventType] || templates.score_milestone;
}

async function callGemini(prompt){
  const apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey){
    console.warn('⚠️ GEMINI_API_KEY not set. Using fallback commentary.');
    throw new Error('No API key');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    if(!response.ok){
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text){
      throw new Error('Empty Gemini response');
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerCommentary(eventType, snapshot){
  const limiter = worldState.commentaryRateLimiter[eventType];
  const cooldown = COMMENTARY_COOLDOWNS[eventType] || 0;
  const now = Date.now();

  let text = null;
  let source = 'fallback';

  if(limiter && cooldown > 0 && now-limiter.lastCalledAt < cooldown){
    text = FALLBACK_COMMENTARY[crypto.randomInt(0, FALLBACK_COMMENTARY.length)];
    io.emit('commentary', { text, source, eventType, playerId: snapshot.playerId || null });
    return;
  }

  if(limiter){
    limiter.lastCalledAt = Date.now();
  }

  try {
    const prompt = buildPrompt(eventType, snapshot);
    text = await callGemini(prompt);
    source = 'gemini';
  } catch(err){
    text = FALLBACK_COMMENTARY[crypto.randomInt(0, FALLBACK_COMMENTARY.length)];
    source = 'fallback';
  }

  io.emit('commentary', { text, source, eventType, playerId: snapshot.playerId || null });
}

let isGeneratingLevel = false;
async function generateNextLevelAsync(targetLevel){
  if(isGeneratingLevel || worldState.nextLevelBricks) return;
  isGeneratingLevel = true;
  try {
    const prompt = `You are a level designer for Arkanoid. Design a brick layout for level ${targetLevel}.
Return ONLY a valid JSON 2D array of integers (8 rows by 15 columns).
0 = empty, 1 = normal brick, 2 = hard brick, 3 = indestructible.
Design a cool shape or pattern. Do not include markdown formatting or backticks.`;
    const text = await callGemini(prompt);
    let rawJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    worldState.nextLevelBricks = JSON.parse(rawJson);
    console.log(`Pre-fetched AI level ${targetLevel}`);
  } catch(err){
    console.error('Failed to generate AI level:', err);
    worldState.nextLevelBricks = null;
  } finally {
    isGeneratingLevel = false;
  }
}

let isPollingGameMaster = false;
async function pollGameMasterAsync(){
  if(isPollingGameMaster) return;
  const limiter = worldState.commentaryRateLimiter['game_master'];
  if(limiter && Date.now()-limiter.lastCalledAt < 15000) return;
  
  isPollingGameMaster = true;
  if(limiter) limiter.lastCalledAt = Date.now();
  try {
    const playerStats = worldState.players.map(p => `${p.name || p.id}: ${p.lives} lives, ${p.score} score`).join(' | ');
    const prompt = `You are the AI Game Master of Arkanoid. A player just lost a life.
Current stats: ${playerStats}, Level=${worldState.level}.
Decide on a modifier to help or punish them. Choose exactly one: WIDE_PADDLE, EXTRA_BALL, SLOW_BALL, NONE.
Return a JSON object: {"modifier": "YOUR_CHOICE", "commentary": "Your 10 word snarky comment mentioning the player by name"}.
Do not include markdown.`;
    const text = await callGemini(prompt);
    let rawJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let data = JSON.parse(rawJson);
    
    if(data.modifier && data.modifier!=='NONE'){
      gameEngine.applyGameMasterMod(worldState, data.modifier);
    }
    if(data.commentary){
      io.emit('commentary', { text: data.commentary, source: 'ai', eventType: 'game_master' });
    }
  } catch(err){
    console.error('Failed to poll Game Master:', err);
  } finally {
    isPollingGameMaster = false;
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

function findPlayerBySocket(socketId){
  const index = socketToPlayerIndex.get(socketId);
  if(index===undefined) return null;
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

function applyBombPowerUp(){
  const activeBall = worldState.balls.find((b)=>b.active);
  if(!activeBall) return;

  let bestCluster = null;
  let bestDistance = Infinity;

  for(let row = 0; row<=5; row++){
    for(let col = 0; col<=12; col++){
      let activeCount = 0;
      let centerX = 0;
      let centerY = 0;
      for(let dr = 0; dr < 3; dr++){
        for(let dc = 0; dc < 3; dc++){
          const brick = worldState.bricks[row+dr]?.[col+dc];
          if(brick && brick.active){
            activeCount++;
            centerX += brick.x+brick.width/2;
            centerY += brick.y+brick.height/2;
          }
        }
      }
      if(activeCount===0) continue;
      centerX /= activeCount;
      centerY /= activeCount;
      const dist = Math.hypot(activeBall.x-centerX, activeBall.y-centerY);
      if(dist < bestDistance){
        bestDistance = dist;
        bestCluster = { row, col };
      }
    }
  }

  if(!bestCluster) return;

  for(let dr = 0; dr < 3; dr++){
    for(let dc = 0; dc < 3; dc++){
      const brick = worldState.bricks[bestCluster.row+dr]?.[bestCluster.col+dc];
      if(brick) brick.active = false;
    }
  }
}

function applyPowerUpEffect(player, powerUpType){
  if(powerUpType==='wide_paddle'){
    player.paddleWidth = 600;
    if(player.widePaddleTimer) clearTimeout(player.widePaddleTimer);
    player.widePaddleTimer = setTimeout(()=>{
      player.paddleWidth = 300;
      player.widePaddleTimer = null;
    }, 8000);
  }else if(powerUpType==='slow_ball'){
    if(!worldState.slowBallActive){
      worldState.originalBallSpeeds = worldState.balls.map((b)=>({ vx: b.vx, vy: b.vy }));
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
      if(worldState.originalBallSpeeds){
        worldState.balls.forEach((ball, i)=>{
          if(worldState.originalBallSpeeds[i]){
            ball.vx = worldState.originalBallSpeeds[i].vx;
            ball.vy = worldState.originalBallSpeeds[i].vy;
          }
        });
      }
      worldState.slowBallActive = false;
      worldState.originalBallSpeeds = null;
      worldState.slowBallTimer = null;
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
      triggerCommentary('multi_ball', getWorldSnapshot());
    }
  }else if(powerUpType==='bomb'){
    applyBombPowerUp();
  }
}

function resetWorldForNewGame(){
  clearAllPowerUpTimers();
  worldState = createInitialWorldState();
  socketToPlayerIndex.clear();
}

function clearAllPowerUpTimers(){
  for(const player of worldState.players){
    clearPlayerTimers(player);
  }
}

function getWorldSnapshot(){
  return {
    players: worldState.players.map((p)=>({
      id: p.id,
      name: p.name || 'Unknown',
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
}

io.on('connection', (socket)=>{
  const screenId = parseInt(socket.handshake.query.screenId, 10);
  if(screenId>=1 && screenId<=(worldState.numScreens || 5)){
    socket.join(`screen-${screenId}`);
  }

  socket.on('start_game', (data)=>{
    const slotIndex = socketToPlayerIndex.get(socket.id);
    if(slotIndex!==worldState.masterPlayerIndex){
      socket.emit('join_rejected', { errorCode: 1007, message: 'Only the host can start the game' });
      return;
    }
    resetWorldForNewGame();
    worldState.gameStatus = 'lobby'; // Changed to lobby
    worldState.gameActive = false;
    worldState.sessionId = crypto.randomUUID();
    worldState.sessionToken = generateToken();
    worldState.lobbyStartedAt = Date.now();
    worldState.gameDurationSeconds = data?.durationSeconds || 180;
    io.emit('lobby_started', {
      sessionToken: worldState.sessionToken,
      sessionId: worldState.sessionId,
      gameDurationSeconds: worldState.gameDurationSeconds,
    });
    
    // Automatically transition to countdown after 8 seconds of lobby
    setTimeout(() => {
        if (worldState.gameStatus === 'lobby' && worldState.sessionId) {
            worldState.gameStatus = 'countdown';
            worldState.countdownStartedAt = Date.now();
            io.emit('countdown_started', { countdown: 5 });
            broadcastGameState();
            
            // 5 second countdown before playing
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
            }, 5000);
        }
    }, 8000);
    
    broadcastGameState();
  });

  socket.on('player_join', (data)=>{
    const { sessionToken, playerName } = data || {};

    if(typeof sessionToken!=='string' || sessionToken.length!==4){
      socket.emit('join_rejected', { errorCode: 1005, message: 'Invalid payload' });
      return;
    }

    if(!timingSafeTokenCompare(sessionToken, String(worldState.sessionToken || ''))){
      socket.emit('join_rejected', { errorCode: 1001, message: 'Invalid session token' });
      return;
    }

    const slotIndex = worldState.players.findIndex((p)=>!p.connected);
    if(slotIndex===-1){
      // No slots available, join as spectator!
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
    player.id = PLAYER_SLOT_IDS[slotIndex];
    player.name = (typeof playerName === 'string' && playerName.trim().length > 0) ? playerName.trim().substring(0, 12) : `Player ${slotIndex + 1}`;
    player.socketId = socket.id;
    player.paddleX = ((worldState.numScreens || 5)*1920)/2-150;
    player.lastNonces = [];
    socketToPlayerIndex.set(socket.id, slotIndex);

    if(disconnectTimers.has(socket.id)){
      clearTimeout(disconnectTimers.get(socket.id));
      disconnectTimers.delete(socket.id);
    }

    socket.emit('join_confirmed', {
      playerId: player.id,
      playerNumber: slotIndex+1,
      isSpectator: false,
      sessionId: worldState.sessionId,
    });
    broadcastGameState();
  });

  socket.on('resume_request', (data)=>{
    const { playerId, sessionId } = data || {};
    if(sessionId!==worldState.sessionId){
      socket.emit('join_rejected', { errorCode: 1001, message: 'Session expired' });
      return;
    }

    const slotIndex = worldState.players.findIndex((p)=>p.id===playerId && !p.connected);
    if(slotIndex===-1){
      socket.emit('join_rejected', { errorCode: 1002, message: 'Cannot resume this slot' });
      return;
    }

    const player = worldState.players[slotIndex];
    player.connected = true;
    player.socketId = socket.id;
    socketToPlayerIndex.set(socket.id, slotIndex);

    socket.emit('join_confirmed', {
      playerId: player.id,
      playerNumber: slotIndex+1,
      sessionId: worldState.sessionId,
    });
    broadcastGameState();
  });

  socket.on('paddle_move', (data)=>{
    const found = findPlayerBySocket(socket.id);
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

    const maxRight = (worldState.numScreens || 5)*1920;
    player.paddleX += deltaX;
    player.paddleX = Math.max(0, Math.min(maxRight-300, Math.round(player.paddleX)));
  });

  socket.on('power_up_activate', (data)=>{
    const found = findPlayerBySocket(socket.id);
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

    applyPowerUpEffect(player, powerUpType);
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
    const found = findPlayerBySocket(socket.id);
    if(!found) return;

    const { player, index } = found;
    const playerNumber = index+1;
    const disconnectedSocketId = socket.id;

    if(disconnectTimers.has(disconnectedSocketId)){
      clearTimeout(disconnectTimers.get(disconnectedSocketId));
    }

    const timer = setTimeout(()=>{
      disconnectTimers.delete(disconnectedSocketId);

      if(player.socketId!==disconnectedSocketId){
        return;
      }

      player.connected = false;
      player.id = null;
      player.socketId = null;
      player.lastNonces = [];
      clearPlayerTimers(player);
      player.socketId = null;
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

    disconnectTimers.set(disconnectedSocketId, timer);
  });
});

setInterval(()=>{
  if(worldState.gameStatus!=='playing') return;

  if (worldState.gameStartedAt && worldState.gameDurationSeconds) {
    if (Date.now() - worldState.gameStartedAt > worldState.gameDurationSeconds * 1000) {
      worldState.gameStatus = 'time_up';
      broadcastGameState();
      return;
    }
  }

  const beforeScores = worldState.players.map(p=>p.score);
  const beforeLives = worldState.players.map(p=>p.lives);
  const beforeLevel = worldState.level;
  const beforeBallScreens = worldState.balls.map(b=>getScreenIdForX(b.x));
  const nextBricksBefore = worldState.nextLevelBricks;

  gameEngine.updateGameLoop(worldState, applyPowerUpEffect);

  // Pre-fetch next level if needed
  if(!worldState.nextLevelBricks && !isGeneratingLevel){
    generateNextLevelAsync(worldState.level+1);
  }

  for(let i = 0; i < worldState.players.length; i++){
    const p = worldState.players[i];
    if(p.score > 0 && Math.floor(beforeScores[i]/5000) < Math.floor(p.score/5000)){
      const snap = getWorldSnapshot();
      snap.playerId = p.id;
      triggerCommentary('score_milestone', snap);
    }
    if(p.lives < beforeLives[i]){
      const snap = getWorldSnapshot();
      snap.playerId = p.id;
      triggerCommentary('life_lost', snap);
      pollGameMasterAsync();
      if(p.lives===0){
        io.emit('player_eliminated', { playerId: p.id, playerNumber: i+1 });
      }
    }
  }

  if(worldState.level > beforeLevel){
    worldState.currentLevel = worldState.level;
    triggerCommentary('level_cleared', getWorldSnapshot());
    pollGameMasterAsync();
    io.emit('level_source', { level: worldState.level, aiGenerated: nextBricksBefore!==null });
  }else if(worldState.gameStatus==='win' && beforeLevel > 0){
    triggerCommentary('victory', getWorldSnapshot());
  }

  worldState.balls.forEach((ball, i)=>{
    if(!ball.active) return;
    const currentScreen = getScreenIdForX(ball.x);
    const oldScreen = beforeBallScreens[i];
    if(currentScreen!==oldScreen){
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

      setTimeout(()=>{
        const pending = pendingHandoffs.get(handoffId);
        if(!pending) return;

        if(!pending.departingAck || !pending.arrivingAck){
          io.to(`screen-${pending.exitPayload.screenId}`).emit('boundary_exit', pending.exitPayload);
          io.to(`screen-${pending.enterPayload.screenId}`).emit('boundary_enter', pending.enterPayload);
          pending.retried = true;
        }

        setTimeout(()=>pendingHandoffs.delete(handoffId), 100);
      }, 16);
    }
  });

  broadcastGameState();
}, TICK_MS);

server.listen(PORT, ()=>{
  console.log(`LG Arkanoid game server running on port ${PORT}`);
});
