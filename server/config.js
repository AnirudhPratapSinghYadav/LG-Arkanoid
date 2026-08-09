const os = require('os');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');

// Dedicated game port (sister LG games each use their own; Pacman=8128).
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const CANVAS_HEIGHT = 1080;
const SCREEN_WIDTH = 1920;
const BALL_RADIUS = 8;
const TICK_MS = 16;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const LG_PASSWORD = process.env.LG_PASSWORD || 'lg';
const MAX_SCREENS = 12;

function parseScreenCount(value, fallback = 3) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_SCREENS) {
    return fallback;
  }
  return parsed;
}

const NUM_SCREENS = parseScreenCount(process.env.NUM_SCREENS, 3);

const FALLBACK_COMMENTARY = [
  'Great shot',
  'Keep it up',
  'Incoming',
  'Watch out',
  'Nice hit',
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

const PLAYER_SLOT_IDS = ['player1', 'player2', 'player3', 'player4', 'player5'];

function getScreenBoundaries(numScreens = 3){
  const boundaries = [];
  for(let i = 0; i < numScreens; i++){
    boundaries.push({
      screenId: i+1,
      virtualLeft: i * SCREEN_WIDTH,
      virtualRight: (i + 1) * SCREEN_WIDTH - 1
    });
  }
  return boundaries;
}

/** 0 = endless; otherwise clamp to 60..600 seconds. */
function normalizeDurationSeconds(value, fallback = 180) {
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n === 0) return 0;
  return Math.max(60, Math.min(600, Math.floor(n)));
}

function getLanIp() {
  const nets = os.networkInterfaces();
  let bestIp = null;
  let fallbackIp = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        fallbackIp = net.address;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wl') || lowerName.includes('eth') || lowerName.includes('en')) {
          if (!lowerName.includes('utun') && !lowerName.includes('tailscale') && !lowerName.includes('docker') && !lowerName.includes('veth') && !lowerName.includes('vmnet')) {
            bestIp = net.address;
          }
        }
      }
    }
  }
  return bestIp || fallbackIp;
}

function generateToken(){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for(let i = 0; i < 4; i++){
    token += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return token;
}

function createInitialWorldState(maxPlayers){
  const state = new gameEngine.GameState();
  
  state.maxPlayers = maxPlayers || 3;
  state.numScreens = NUM_SCREENS;
  
  const centerX = (state.numScreens * SCREEN_WIDTH) / 2;
  state.balls = [
    new gameEngine.Ball('ball1', centerX, 500, 3, 4, BALL_RADIUS),
    new gameEngine.Ball('ball2', centerX, 500, -3, 4, BALL_RADIUS)
  ];
  state.balls[1].active = false;
  
  for(let i = 0; i < state.maxPlayers; i++){
    let p = new gameEngine.Player(null);
    p.lastNonces = [];
    p.widePaddleTimer = null;
    p.slowBallTimer = null;
    state.players.push(p);
  }
  
  state.bricks = gameEngine.loadLevel(state.level, null, state.numScreens);
  state.sessionId = crypto.randomUUID();
  state.sessionToken = generateToken();
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
  
  return state;
}

module.exports = {
  PORT,
  CANVAS_HEIGHT,
  SCREEN_WIDTH,
  BALL_RADIUS,
  TICK_MS,
  GEMINI_API_KEY,
  LG_PASSWORD,
  NUM_SCREENS,
  MAX_SCREENS,
  FALLBACK_COMMENTARY,
  COMMENTARY_COOLDOWNS,
  PLAYER_SLOT_IDS,
  getScreenBoundaries,
  getLanIp,
  generateToken,
  createInitialWorldState,
  parseScreenCount,
  normalizeDurationSeconds,
};
