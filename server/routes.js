// Express routes for LG Arkanoid screen handling

const express = require('express');
const path = require('path');
const fs = require('fs');
const { getLanIp, resolveWebRoot, SCREEN_WIDTH, CANVAS_HEIGHT, PORT } = require('./config.js');

function createRouter(worldState) {
  const router = express.Router();
  const web = resolveWebRoot();

  // Health check endpoint

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      numScreens: worldState.numScreens || 3,
      gameStatus: worldState.gameStatus,
      gameActive: worldState.gameStatus === 'playing',
      connectedPlayers: worldState.players.filter((p) => p.connected).length,
      // sessionToken intentionally omitted — join code is pushed only to screen sockets.
      lanIp: getLanIp(),
      port: PORT,
    });
  });

  // Pacman-style browser controller (optional). Flutter app is preferred on phone.
  router.get('/controller', (req, res) => {
    const candidates = [
      path.join(web.root, 'controller.html'),
      path.join(__dirname, '..', 'web-client', 'controller.html'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return res.sendFile(file);
      }
    }
    res.status(404).send('Controller page not found. Use the Flutter mobile app.');
  });

  // Static files first so /js/* is not eaten by the /:screenNum route.

  router.use(express.static(web.root));
  if (web.publicDir) {
    router.use(express.static(web.publicDir));
  }

  // -- Screen route (LG convention) -------------------------------------------
  // Each screen on the Liquid Galaxy rig is addressed by its screen number:
  //   http://lg1:8130/1  -- leftmost slice of the wall
  //   http://lg1:8130/2  -- the slice to its right
  // Unlike galaxy-pacman, which puts the *hostname* digit in the URL, the slice
  // index here is the physical left→right position the launcher derived from
  // LG_FRAMES. See docs/lg-setup.md for why.
  // Injects SCREEN_ID + NUM_SCREENS for the Phaser client (Pacman-style routes).

  router.get('/:screenNum(\\d+)', (req, res) => {
    const screenNum = parseInt(req.params.screenNum, 10);
    const configured = worldState.numScreens || 3;

    if (screenNum < 1 || screenNum > configured || screenNum > 12) {
      return res.status(400).send(`Screen number must be between 1 and ${configured}.`);
    }

    const htmlPath = path.join(web.root, 'index.html');

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
        window.SCREEN_W = ${worldState.screenWidth || SCREEN_WIDTH};
        window.CANVAS_H = ${worldState.canvasHeight || CANVAS_HEIGHT};
      </script>`;
      const modifiedHtml = html.replace('</head>', injectedScript + '\n</head>');

      res.type('html').send(modifiedHtml);
    });
  });

  return router;
}

module.exports = createRouter;
