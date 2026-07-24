const os = require('os');
const crypto = require('crypto');
const gameEngine = require('./gameEngine.js');

const PORT = process.env.PORT || 3000;
const CANVAS_HEIGHT = 1080;
const BALL_RADIUS = 8;
const TICK_MS = 16;

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
      virtualLeft: i*1920,
      virtualRight: (i+1)*1920-1
    });
  }
  return boundaries;
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
  state.numScreens = process.env.NUM_SCREENS ? parseInt(process.env.NUM_SCREENS, 10) : 3;
  
  const centerX = (state.numScreens * 1920) / 2;
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
  BALL_RADIUS,
  TICK_MS,
  FALLBACK_COMMENTARY,
  COMMENTARY_COOLDOWNS,
  PLAYER_SLOT_IDS,
  getScreenBoundaries,
  getLanIp,
  generateToken,
  createInitialWorldState
};
