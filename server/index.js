require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
// helmet 7.x is the last line that runs on Node 16 (Ubuntu 16.04 LG masters).
const helmet = require('helmet');

const { PORT, GEMINI_API_KEY, isAllowedCorsOrigin, resolveWebRoot, createInitialWorldState } = require('./config.js');
const { registerSocketHandlers } = require('./handlers/socketHandler.js');
const { applyPowerUpEffect, clearAllPowerUpTimers } = require('./handlers/powerups.js');
const createRouter = require('./routes.js');
const { createMatchController } = require('./match.js');

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is missing. AI commentary and level generation will be disabled.');
}
if (!process.env.LG_PASSWORD) {
  console.warn('LG_PASSWORD is unset — SSH launch scripts will use key auth. The game server does not SSH.');
}

const worldState = createInitialWorldState();
const pendingHandoffs = new Map();

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    if (p.startsWith('/socket.io')) return true;
    return /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map|webmanifest)$/i.test(p);
  },
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        (req, res) => `'nonce-${res.locals.nonce}'`
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'"
      ],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
}));
app.use(limiter);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    },
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1024,
});

const webRoot = resolveWebRoot();
app.use(express.static(webRoot.root));
if (webRoot.publicDir) {
  app.use(express.static(webRoot.publicDir));
}

app.use(createRouter(worldState));

const match = createMatchController({
  worldState,
  io,
  pendingHandoffs,
  applyPowerUpEffect,
  clearAllPowerUpTimers,
});

registerSocketHandlers(io, worldState, pendingHandoffs, match.broadcastGameState, match.getWorldSnapshot, match.cancelReturnToLobby);
worldState.io = io;

match.startGameLoop();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LG Arkanoid game server running on port ${PORT}`);
});
