'use strict';
/**
 * Arkanoid AI — Gemini cascade then arcade-announcer fallback.
 * The HTTP client lives in geminiClient.js so this file stays prompts + policy.
 */
const gameEngine = require('../gameEngine.js');
const { FALLBACK_COMMENTARY, FALLBACK_BY_EVENT, COMMENTARY_COOLDOWNS } = require('../config.js');
const { GEMINI_MODELS, callGemini } = require('./geminiClient.js');
const config = require('../config.js');

let isGeneratingLevel = false;
let isPollingGameMaster = false;
let geminiLevelCooldownUntil = 0;
let geminiPollCooldownUntil = 0;

function namedPlayers(snapshot) {
  return (snapshot && snapshot.players ? snapshot.players : [])
    .filter((p) => p && p.connected)
    .map((p, i) => ({
      name: String(p.name || ('Player ' + (i + 1))).slice(0, 16),
      score: Number(p.score) || 0,
      lives: Number(p.lives) || 0,
      rank: p.rank || i + 1,
    }))
    .sort((a, b) => b.score - a.score);
}

function winnerName(snapshot) {
  const list = namedPlayers(snapshot);
  return (list[0] && list[0].name) || 'the field';
}

function pickFallbackCommentary(eventType, snapshot) {
  const names = namedPlayers(snapshot);
  const lead = names[0] ? names[0].name : 'the field';
  const second = names[1] ? names[1].name : '';
  const draw = names.length > 1 && names[0].score === names[1].score;
  const byEvent = FALLBACK_BY_EVENT[eventType];
  if (typeof byEvent === 'function') {
    return byEvent({ lead, second, names, winner: winnerName(snapshot), draw });
  }
  if (Array.isArray(byEvent) && byEvent.length) {
    return byEvent[Math.floor(Math.random() * byEvent.length)];
  }
  return FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
}

function buildPrompt(eventType, snapshot) {
  const roster = namedPlayers(snapshot)
    .map((p) => `${p.name} score ${p.score} lives ${p.lives}`)
    .join('; ');
  const templates = {
    level_cleared: `You are ARKANOID AI, the stadium announcer on a Liquid Galaxy wall. Level ${snapshot.currentLevel} is clear. Roster: ${roster}. Speak 12-18 words, excited, name the leader. No brick colours. No future predictions.`,
    life_lost: `You are ARKANOID AI. A paddle just dropped a ball. Roster: ${roster}. Speak 12-18 tense words naming who is in danger. No future predictions.`,
    multi_ball: `You are ARKANOID AI. Multi-ball just split across a panoramic Liquid Galaxy wall. Speak 12-18 excited words. Roster: ${roster}.`,
    score_milestone: `You are ARKANOID AI. A score milestone just hit. Roster: ${roster}. Speak 12-18 hype words naming the leader.`,
    victory: `You are ARKANOID AI. Match over. Roster: ${roster}. Declare the winner by name in 12-18 triumphant words.`,
    rank_takeover: `You are ARKANOID AI. The lead just changed. Roster: ${roster}. Speak 12-18 competitive words naming the new leader.`,
    countdown: `You are ARKANOID AI. Three second countdown on a Liquid Galaxy wall. Speak 8-12 words to fire up the crowd. Roster: ${roster}.`,
    game_master: `You are ARKANOID AI game master. A life was lost. Roster: ${roster}. Reply ONLY JSON {"modifier":"WIDE_PADDLE|EXTRA_BALL|SLOW_BALL|NONE","commentary":"ten word snark naming a player"}.`,
  };
  return templates[eventType] || templates.score_milestone;
}

function rememberCommentary(worldState, text, source, model, eventType) {
  if (!worldState) return;
  worldState.lastCommentary = text;
  worldState.lastCommentarySource = source;
  worldState.lastCommentaryModel = model || '';
  worldState.lastCommentaryEvent = eventType || '';
}

async function triggerCommentary(eventType, snapshot, io, commentaryRateLimiter, worldState) {
  const cooldown = COMMENTARY_COOLDOWNS[eventType] || 0;
  const limiter = commentaryRateLimiter && commentaryRateLimiter[eventType];
  if (limiter && cooldown > 0 && Date.now() - limiter.lastCalledAt < cooldown) {
    return;
  }
  if (limiter) limiter.lastCalledAt = Date.now();

  io.emit('commentary_thinking', { eventType, source: 'gemini' });

  try {
    const prompt = buildPrompt(eventType, snapshot);
    const result = await callGemini(prompt);
    if (result && result.text) {
      rememberCommentary(worldState, result.text, 'gemini', result.model, eventType);
      io.emit('commentary', {
        text: result.text,
        source: 'gemini',
        model: result.model,
        eventType,
        ai: 'ARKANOID AI',
      });
      return;
    }
  } catch (_) {
    // Arcade fallback — still spoken on the wall and phones.
  }

  const fallbackText = pickFallbackCommentary(eventType, snapshot);
  rememberCommentary(worldState, fallbackText, 'fallback', '', eventType);
  io.emit('commentary', {
    text: fallbackText,
    source: 'fallback',
    model: '',
    eventType,
    ai: 'ARKANOID AI',
  });
}

async function pollGameMasterAsync(worldState, io, snapshot) {
  if (isPollingGameMaster) return;
  if (Date.now() < geminiPollCooldownUntil) return;
  const limiter = worldState.commentaryRateLimiter && worldState.commentaryRateLimiter.game_master;
  if (limiter && Date.now() - limiter.lastCalledAt < 15000) return;

  isPollingGameMaster = true;
  if (limiter) limiter.lastCalledAt = Date.now();
  const view = snapshot || worldState;
  try {
    io.emit('commentary_thinking', { eventType: 'game_master', source: 'gemini' });
    const prompt = buildPrompt('game_master', view);
    const result = await callGemini(prompt, { maxOutputTokens: 120, temperature: 0.5 });
    const jsonMatch = result.text && result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const data = JSON.parse(jsonMatch[0]);
    if (data.modifier && data.modifier !== 'NONE') {
      gameEngine.applyGameMasterMod(worldState, data.modifier);
    }
    if (data.commentary) {
      rememberCommentary(worldState, data.commentary, 'gemini', result.model, 'game_master');
      io.emit('commentary', {
        text: data.commentary,
        source: 'gemini',
        model: result.model,
        eventType: 'game_master',
        ai: 'ARKANOID AI',
      });
    }
  } catch (err) {
    geminiPollCooldownUntil = Date.now() + 120000;
    if (err && err.code !== 'NO_KEY' && err.code !== 'AUTH_COOLDOWN') {
      console.error('ARKANOID AI game master fallback:', err.message || err);
    }
  } finally {
    isPollingGameMaster = false;
  }
}

async function generateNextLevelAsync(nextLevel, worldState) {
  if (isGeneratingLevel) return;
  if (Date.now() < geminiLevelCooldownUntil) return;
  isGeneratingLevel = true;
  try {
    if (worldState && worldState.io) {
      worldState.io.emit('commentary_thinking', { eventType: 'level_generation', source: 'gemini' });
    }
    const numScreens = worldState.numScreens || 3;
    const numCols = gameEngine.brickColumnsForWorld(numScreens, worldState.screenWidth);
    const tileCols = 13;
    const prompt = `You are ARKANOID AI level designer for Liquid Galaxy.
Create a TILE for Level ${nextLevel} mirrored across ${numScreens} screens.
Return ONLY a JSON 2D array: exactly 8 rows, each with exactly ${tileCols} integers.
0 empty, 1 normal, 2 hard, 3 indestructible. Keep destructible bricks.`;

    const result = await callGemini(prompt, { maxOutputTokens: 2048, temperature: 0.4, timeoutMs: 15000 });
    const jsonMatch = result.text && result.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const grid = JSON.parse(jsonMatch[0]);
      if (Array.isArray(grid) && grid.length === 8) {
        let tileOk = true;
        for (let i = 0; i < grid.length; i++) {
          const row = grid[i];
          if (!Array.isArray(row) || row.length !== tileCols) { tileOk = false; break; }
          for (let j = 0; j < row.length; j++) {
            if (typeof row[j] !== 'number' || row[j] < 0 || row[j] > 3) { tileOk = false; break; }
          }
          if (!tileOk) break;
        }
        if (tileOk) {
          const expanded = gameEngine.expandTiledBrickGrid(grid, numCols);
          if (expanded) worldState.nextLevelBricks = expanded;
        } else {
          throw new Error('Gemini tile invalid');
        }
      }
    }
  } catch (err) {
    geminiLevelCooldownUntil = Date.now() + 120000;
    if (config.GEMINI_API_KEY && err && err.code !== 'NO_KEY' && err.code !== 'AUTH_COOLDOWN' && err.code !== 'AUTH') {
      console.error('ARKANOID AI level gen using stock layout:', err.message || err);
    }
  } finally {
    isGeneratingLevel = false;
  }
}

module.exports = {
  GEMINI_MODELS,
  callGemini,
  buildPrompt,
  pickFallbackCommentary,
  triggerCommentary,
  pollGameMasterAsync,
  generateNextLevelAsync,
};
