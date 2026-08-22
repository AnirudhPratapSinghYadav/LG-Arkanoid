'use strict';

/**
 * Shared match-end ranking. Same scores at the top are a draw — nobody "wins".
 */
function resolveMatchResult(players) {
  const list = (Array.isArray(players) ? players : [])
    .filter((p) => p && (p.connected || p.name || (Number(p.score) || 0) > 0))
    .map((p, index) => ({
      id: p.id || null,
      name: String(p.name || ('Player ' + (p.playerNumber || index + 1))).slice(0, 16),
      score: Number(p.score) || 0,
      playerNumber: p.playerNumber || index + 1,
      connected: !!p.connected,
    }))
    .sort((a, b) => b.score - a.score || a.playerNumber - b.playerNumber);

  if (list.length === 0) {
    return { outcome: 'draw', topScore: 0, winnerIds: [], winnerNames: [], ranked: [] };
  }

  const topScore = list[0].score;
  const winners = list.filter((p) => p.score === topScore);
  const outcome = winners.length > 1 ? 'draw' : 'win';
  return {
    outcome,
    topScore,
    winnerIds: winners.map((p) => p.id).filter(Boolean),
    winnerNames: winners.map((p) => p.name),
    ranked: list,
  };
}

function placementForPlayer(result, playerId) {
  if (!result || !playerId) return { rank: 0, isWinner: false, isDraw: false };
  const ranked = result.ranked || [];
  const idx = ranked.findIndex((p) => p.id === playerId);
  const rank = idx >= 0 ? idx + 1 : 0;
  return {
    rank,
    isWinner: result.outcome === 'win' && result.winnerIds.includes(playerId),
    isDraw: result.outcome === 'draw',
  };
}

module.exports = {
  resolveMatchResult,
  placementForPlayer,
};
