const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');

// Dedicated game port (sister LG games each use their own; Pacman=8128).
// 8130 is the next free slot in the Liquid Galaxy game port family: pong 8112,
// snake 8114, pacman 8128, asteroids 8129. The lg-retro-gaming launcher itself
// runs on 3123, so nothing in the ecosystem competes for this one.
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
  'Save it — that ball is hunting the gap.',
  'Stay on the line. The wall is still yours.',
  'Clean brick. Keep the rally alive.',
  'Do not blink. The next drop decides the rank.',
];

/** Event-specific arcade announcer lines when Gemini is offline or the key fails. */
const FALLBACK_BY_EVENT = {
  life_lost: ({ lead }) => [
    `${lead} just dropped a life. Stay on the line — the wall is still live.`,
    `Ball through the gap. ${lead}, cover the floor before the next drop.`,
    `Life down for ${lead}. Two paddles, one court — nobody blinks.`,
  ][Math.floor(Math.random() * 3)],
  score_milestone: ({ lead }) => [
    `${lead} just punched a new high. The standings on the right just moved.`,
    `Score surge — ${lead} is running away with this wall.`,
  ][Math.floor(Math.random() * 2)],
  level_cleared: ({ lead }) => `${lead} wiped the row. Fresh bricks incoming across every screen.`,
  multi_ball: () => 'Multi-ball on a panoramic court. Cover both edges — now.',
  rank_takeover: ({ lead, second }) => second
    ? `${lead} stole first from ${second}. The live board just flipped.`
    : `${lead} stole first. The live board just flipped.`,
  victory: ({ winner }) => `${winner} takes the Liquid Galaxy wall. That is the champion — match over.`,
  countdown: () => 'Whistle up. Three. Two. One. Break those bricks.',
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

function getLanIp() {
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
  return preferred || anyReal || fallbackIp;
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
  if (fs.existsSync(path.join(distRoot, 'index.html'))) {
    return { root: distRoot, publicDir: null };
  }
  return { root: webRoot, publicDir: path.join(webRoot, 'public') };
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
  // Host "players" default to the wall width, capped at 5 paddles.
  const defaultPlayers = Math.max(1, Math.min(5, NUM_SCREENS));
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
