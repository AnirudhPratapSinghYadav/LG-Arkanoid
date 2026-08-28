const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');

// Dedicated match port for this game.
const PORT = Number.parseInt(process.env.PORT || '8130', 10);
// Court geometry is owned by the engine: height is fixed, per-frame width comes
// from the rig's real frame aspect (portrait on a stock LG rotation).
const CANVAS_HEIGHT = gameEngine.CANVAS_HEIGHT;
const SCREEN_WIDTH = gameEngine.SCREEN_WIDTH;
const BALL_RADIUS = 8;
const TICK_MS = 16;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// No default password — empty means key-based SSH only (scripts already handle that).
const LG_PASSWORD = process.env.LG_PASSWORD != null ? process.env.LG_PASSWORD : '';
const MAX_SCREENS = 12;
const ALLOWED_BALL_SPEEDS = new Set(['slow', 'medium', 'fast', 'insane']);

function generateResumeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function parseScreenCount(value, fallback = 3) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_SCREENS) {
    return fallback;
  }
  return parsed;
}

const NUM_SCREENS = parseScreenCount(process.env.NUM_SCREENS, 3);

const FALLBACK_COMMENTARY = [
  'Keep the rally alive.',
  'Cover the gap.',
  'Stay on the line.',
];

/** Event-specific arcade announcer lines when Gemini is offline or the key fails. */
const FALLBACK_BY_EVENT = {
  life_lost: ({ lead }) => `${lead} lost a life. Cover the floor.`,
  score_milestone: ({ lead }) => `${lead} is pulling ahead.`,
  level_cleared: ({ lead }) => `${lead} cleared the floor. Next wave.`,
  multi_ball: () => 'Multi-ball. Cover both edges.',
  rank_takeover: ({ lead, second }) => second
    ? `${lead} took first from ${second}.`
    : `${lead} took first.`,
  victory: ({ winner, draw, names }) => {
    if (draw) {
      const a = names && names[0] && names[0].name;
      const b = names && names[1] && names[1].name;
      return a && b ? `Dead heat. ${a} and ${b} finish level. Draw.` : 'Dead heat. This match is a draw.';
    }
    return `${winner} wins the wall. Champion.`;
  },
  countdown: () => 'Three. Two. One. Play.',
  game_master: ({ lead }) => `ARKANOID AI is watching ${lead}. Hang on — the next bounce decides it.`,
};

const COMMENTARY_COOLDOWNS = {
  level_cleared: 0,
  life_lost: 15000,
  multi_ball: 0,
  score_milestone: 30000,
  victory: 0,
  rank_takeover: 9000,
  countdown: 0,
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

function isVirtualLanAddress(name, address) {
  const n = String(name || '').toLowerCase();
  const ip = String(address || '');
  if (/docker|veth|br-|vmnet|vbox|virtualbox|hyper-v|loopback|tailscale|utun|tun|tap/.test(n)) {
    return true;
  }
  // VirtualBox host-only / Docker Toolbox — phones on Wi-Fi cannot reach these.
  if (ip.startsWith('192.168.56.') || ip.startsWith('192.168.99.')) return true;
  if (ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.')) return true;
  return false;
}

function isPreferredNic(name) {
  const n = String(name || '').toLowerCase();
  return /wl|wifi|wlan|eth|enp|ens|eno|lan/.test(n);
}

let lanIpCache = { value: '', at: 0 };

function getLanIp() {
  // Pin the IPv4 phones actually reach (the wall QR / /controller URL).
  // On some rigs the first "real" NIC is the cluster fabric, not the visitor Wi-Fi.
  const pinned = String(process.env.LG_HOST_IP || process.env.LG_LAN_IP || '').trim();
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(pinned)) return pinned;
  if (lanIpCache.value && Date.now() - lanIpCache.at < 5000) return lanIpCache.value;

  const nets = os.networkInterfaces();
  let preferred = null;
  let anyReal = null;
  let fallbackIp = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const family = net.family === 'IPv4' || net.family === 4;
      if (!family || net.internal) continue;
      fallbackIp = net.address;
      if (isVirtualLanAddress(name, net.address)) continue;
      if (!anyReal) anyReal = net.address;
      if (!preferred && isPreferredNic(name)) preferred = net.address;
    }
  }
  lanIpCache = { value: preferred || anyReal || fallbackIp, at: Date.now() };
  return lanIpCache.value;
}

/** LAN arcade CORS: empty Origin (Flutter) + localhost + lg1 + RFC1918. */
function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'lg1') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

function resolveWebRoot() {
  const distRoot = path.join(__dirname, '..', 'dist');
  const webRoot = path.join(__dirname, '..', 'web-client');
  // Rig launcher sets NODE_ENV=production and rebuilds dist/. A laptop
  // `node server/index.js` must NOT serve a stale dist from yesterday.
  const useDist = process.env.NODE_ENV === 'production' || process.env.LG_WEB_ROOT === 'dist';
  if (useDist && fs.existsSync(path.join(distRoot, 'index.html'))) {
    return { root: distRoot, publicDir: null };
  }
  return { root: webRoot, publicDir: path.join(webRoot, 'public') };
}

function generateToken(){
  // No 0/O/1/I — testers typed OWGO as OGWO and got "Invalid session token".
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for(let i = 0; i < 4; i++){
    token += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return token;
}

function createInitialWorldState(maxPlayers){
  const state = new gameEngine.GameState();
  // 2 phones on a 3/5/8 wall is the LAB demo. Host raises this to 5.
  // Defaulting to NUM_SCREENS forced START to wait for 3 phones on a 3-glass.
  const defaultPlayers = 2;
  state.maxPlayers = maxPlayers || defaultPlayers;
  state.numScreens = NUM_SCREENS;
  state.lastCommentary = '';
  state.lastCommentarySource = '';
  state.victoryAnnounced = false;
  // Broadcast the court geometry so controllers and wall clients agree with the
  // physics without having to guess the rig's orientation.
  state.screenWidth = SCREEN_WIDTH;
  state.canvasHeight = CANVAS_HEIGHT;
  
  const centerX = (state.numScreens * SCREEN_WIDTH) / 2;
  state.balls = [
    new gameEngine.Ball('ball1', centerX, 500, 3, 4, BALL_RADIUS),
    new gameEngine.Ball('ball2', centerX, 500, -3, 4, BALL_RADIUS)
  ];
  state.balls[1].active = false;
  
  for(let i = 0; i < state.maxPlayers; i++){
    let p = new gameEngine.Player(null, state.numScreens);
    p.paddleX = gameEngine.paddleXForSlot(i, state.maxPlayers, state.numScreens, p.paddleWidth);
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
  FALLBACK_BY_EVENT,
  COMMENTARY_COOLDOWNS,
  PLAYER_SLOT_IDS,
  getScreenBoundaries,
  getLanIp,
  isAllowedCorsOrigin,
  resolveWebRoot,
  generateToken,
  generateResumeToken,
  createInitialWorldState,
  parseScreenCount,
  normalizeDurationSeconds,
  ALLOWED_BALL_SPEEDS,
};
