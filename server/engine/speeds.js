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
  // Up into the brick belt (negative vy). Hypot ~8.6 at medium so the first
  // paddle clamp in physics (min 8) does not suddenly jump the serve.
  return { vx: 5 * m * slow, vy: -7 * m * slow };
}

module.exports = { getBallSpeedMultiplier, getRespawnVelocity };
