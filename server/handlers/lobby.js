const gameEngine = require('../gameEngine.js');
const { ALLOWED_BALL_SPEEDS, normalizeDurationSeconds } = require('../config.js');

function resetPaddle(player, numScreens, slotIndex, maxPlayers) {
  player.paddleWidth = gameEngine.DEFAULT_PADDLE_WIDTH;
  player.paddleHeight = gameEngine.PADDLE_HEIGHT;
  const idx = typeof slotIndex === 'number' ? slotIndex : 0;
  player.paddleX = gameEngine.paddleXForSlot(idx, maxPlayers || 1, numScreens, player.paddleWidth);
  player.paddleY = gameEngine.PADDLE_Y;
}

function createEmptyPlayer(numScreens, slotIndex, maxPlayers) {
  const p = new gameEngine.Player(null, numScreens);
  p.lastNonces = [];
  p.widePaddleTimer = null;
  p.slowBallTimer = null;
  p.paddleX = gameEngine.paddleXForSlot(slotIndex || 0, maxPlayers || 1, numScreens, p.paddleWidth);
  return p;
}

// Shared by set_game_settings and start_game. start_game must apply this
// before spawning balls so a phone that emits start_game in the same tick
// as set_game_settings still launches with the lobby size / speed.
function applyHostLobbySettings(worldState, data) {
  if (!data || typeof data !== 'object') return null;

  if (data.maxPlayers !== undefined && data.maxPlayers !== null) {
    const newMax = parseInt(data.maxPlayers, 10);
    if (!(newMax >= 1 && newMax <= 5)) {
      return { errorCode: 1005, message: 'Invalid player count' };
    }
    if (worldState.players.slice(newMax).some((p) => p.connected)) {
      return {
        errorCode: 1011,
        message: 'Cannot reduce slots: active players occupy higher slots. Please wait for them to leave.',
      };
    }
    worldState.maxPlayers = newMax;
    while (worldState.players.length < newMax) {
      worldState.players.push(createEmptyPlayer(worldState.numScreens, worldState.players.length, newMax));
    }
    if (worldState.players.length > newMax) {
      worldState.players = worldState.players.slice(0, newMax);
    }
    if (worldState.masterPlayerIndex >= worldState.players.length || !worldState.players[worldState.masterPlayerIndex]?.connected) {
      const connectedIdx = worldState.players.findIndex((p) => p.connected);
      worldState.masterPlayerIndex = connectedIdx >= 0 ? connectedIdx : 0;
    }
  }

  if (typeof data.ballSpeed === 'string') {
    if (!ALLOWED_BALL_SPEEDS.has(data.ballSpeed)) {
      return { errorCode: 1005, message: 'Invalid ball speed' };
    }
    worldState.ballSpeed = data.ballSpeed;
  }

  if (data.durationSeconds !== undefined && data.durationSeconds !== null) {
    worldState.gameDurationSeconds = normalizeDurationSeconds(
      data.durationSeconds,
      worldState.gameDurationSeconds || 180
    );
  }

  return null;
}

module.exports = {
  resetPaddle,
  createEmptyPlayer,
  applyHostLobbySettings,
};
