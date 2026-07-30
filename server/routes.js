// Express routes for LG Arkanoid screen handling

const express = require('express');
const path = require('path');
const fs = require('fs');

function createRouter(worldState) {
  const router = express.Router();
  const isProd = process.env.NODE_ENV === 'production';
  const webClientPath = isProd ? path.join(__dirname, '..', 'dist') : path.join(__dirname, '..', 'web client');

  // Health check endpoint

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      gameActive: worldState.gameStatus === 'playing',
      connectedPlayers: worldState.players.filter((p) => p.connected).length,
    });
  });

  // -- Controller page --------------------------------------------------------
  // On a real LG rig, players use the Flutter mobile app as a controller.
  // This simple HTML page is shown if someone navigates to /controller in a
  // desktop browser, directing them to use the Flutter app instead.

  router.get('/controller', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LG Arkanoid Controller</title>
  <style>
    body {
      margin: 0;
      background: #080b11;
      color: #e8f4f8;
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #4F7CAC; }
    p { font-size: 1.1rem; color: #9AA4AF; max-width: 400px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>LG Arkanoid</h1>
  <p>Use the Flutter app to control this game.</p>
  <p style="margin-top: 2rem; font-size: 0.8rem; color: #555;">
    GeminiSoC 2026 - Liquid Galaxy
  </p>
</body>
</html>`);
  });

  // -- Static assets ----------------------------------------------------------
  // Serve CSS, JS, images, and other static files from the web client folder.
  // This must come before the screen route so that requests for /css/style.css,
  // /js/game.js, etc. are handled as static files and not mistaken for screen
  // numbers.

  router.use(express.static(webClientPath));

  // -- Screen route (LG convention) -------------------------------------------
  // Each screen on the Liquid Galaxy rig is addressed by its screen number:
  //   http://lg1:8128/1  -- master screen
  //   http://lg1:8128/2  -- second screen
  //   http://lg1:8128/3  -- third screen
  //
  // The server reads the game HTML file, then injects a script tag that sets
  // window.SCREEN_ID to the requested screen number. The Phaser game client
  // reads this variable to know which portion of the virtual world to render.

  router.get('/:screenNum(\\d+)', (req, res) => {
    const screenNum = parseInt(req.params.screenNum, 10);

    // Reject out-of-range screen numbers (valid range is 1 through 9).
    if (screenNum < 1 || screenNum > 9) {
      return res.status(400).send('Screen number must be between 1 and 9.');
    }

    const htmlPath = path.join(webClientPath, 'index.html');

    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) {
        console.error('Failed to read index.html:', err.message);
        return res.status(500).send('Internal server error.');
      }

      // Inject the screen ID as a global variable before the closing </head>
      // tag. This allows the Phaser client to read it immediately on load.
      const injectedScript = `<script>
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
