// Express routes for LG Arkanoid screen handling

const express = require('express');
const path = require('path');
const fs = require('fs');
const { getLanIp } = require('./config.js');

function createRouter(worldState) {
  const router = express.Router();
  const isProd = process.env.NODE_ENV === 'production';
  const webClientPath = isProd ? path.join(__dirname, '..', 'dist') : path.join(__dirname, '..', 'web-client');

  // Health check endpoint

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      numScreens: worldState.numScreens || 3,
      gameStatus: worldState.gameStatus,
      gameActive: worldState.gameStatus === 'playing',
      connectedPlayers: worldState.players.filter((p) => p.connected).length,
      sessionToken: worldState.sessionToken,
      lanIp: getLanIp(),
      port: process.env.PORT || 3000,
    });
  });

  // Pacman-style browser controller (optional). Flutter app is preferred on phone.
  router.get('/controller', (req, res) => {
    const candidates = [
      path.join(webClientPath, 'controller.html'),
      path.join(__dirname, '..', 'web-client', 'controller.html'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return res.sendFile(file);
      }
    }
    res.status(404).send('Controller page not found. Use the Flutter mobile app.');
  });

  // -- Static assets ----------------------------------------------------------
  // Serve CSS, JS, images, and other static files from the web-client folder.
  // This must come before the screen route so that requests for /css/style.css,
  // /js/game.js, etc. are handled as static files and not mistaken for screen
  // numbers.

  router.use(express.static(webClientPath));
  if (!isProd) {
    router.use(express.static(path.join(webClientPath, 'public')));
  }

  // -- Screen route (LG convention) -------------------------------------------
  // Each screen on the Liquid Galaxy rig is addressed by its screen number:
  //   http://lg1:3000/1  -- screen 1
  //   http://lg1:3000/2  -- screen 2
  // Injects SCREEN_ID + NUM_SCREENS for the Phaser client (Pacman-style routes).

  router.get('/:screenNum(\\d+)', (req, res) => {
    const screenNum = parseInt(req.params.screenNum, 10);
    const configured = worldState.numScreens || 3;

    if (screenNum < 1 || screenNum > configured || screenNum > 12) {
      return res.status(400).send(`Screen number must be between 1 and ${configured}.`);
    }

    const htmlPath = path.join(webClientPath, 'index.html');

    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) {
        console.error('Failed to read index.html:', err.message);
        return res.status(500).send('Internal server error.');
      }

      // Inject the screen ID as a global variable before the closing </head>
      // tag. This allows the Phaser client to read it immediately on load.
      const nonce = res.locals.nonce || '';
      const injectedScript = `<script nonce="${nonce}">
        window.SCREEN_ID = ${screenNum};
        window.NUM_SCREENS = ${worldState.numScreens || 3};
      </script>`;
      const modifiedHtml = html.replace('</head>', injectedScript + '\n</head>');

      res.type('html').send(modifiedHtml);
    });
  });

  return router;
}

module.exports = createRouter;
