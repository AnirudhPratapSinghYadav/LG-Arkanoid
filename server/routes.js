const express = require('express');
const path = require('path');

function createRouter(worldState) {
  const router = express.Router();
  const webClientPath = path.join(__dirname, '..', 'web client');

  router.get('/health', (req, res)=>{
    res.json({
      status: 'ok',
      gameActive: worldState.gameStatus === 'playing',
      connectedPlayers: worldState.players.filter((p)=>p.connected).length,
    });
  });

  router.get('/', (req, res)=>{
    if (req.query.screenId) {
      res.sendFile(path.join(webClientPath, 'index.html'));
    } else {
      res.sendFile(path.join(webClientPath, 'controller.html'));
    }
  });

  router.get('/screen', (req, res)=>{
    res.sendFile(path.join(webClientPath, 'index.html'));
  });

  router.use(express.static(webClientPath));

  return router;
}

module.exports = createRouter;
