'use strict';

function getBallSpeedMultiplier(ballSpeed) {
  if (ballSpeed === 'slow') return 0.75;
  if (ballSpeed === 'fast') return 1.4;
  if (ballSpeed === 'insane') return 1.8;
  return 1;
}

function getRespawnVelocity(gameState) {
  const m = getBallSpeedMultiplier(gameState && gameState.ballSpeed);
  const slow = gameState && gameState.slowBallActive ? 0.5 : 1;
  return { vx: 3 * m * slow, vy: 4 * m * slow };
}

module.exports = { getBallSpeedMultiplier, getRespawnVelocity };
