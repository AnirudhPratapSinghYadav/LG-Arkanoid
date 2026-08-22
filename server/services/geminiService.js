'use strict';
/**
 * Arkanoid AI — Gemini with a 10-model cascade, then arcade-announcer fallback.
 * Invalid keys / 4xx auth stop the cascade immediately (all models would fail).
 * Missing-model 404s walk the list. Failures cool down so the physics loop
 * never hammers Google every 16 ms.
 */
const fetch = require('node-fetch');
const gameEngine = require('../gameEngine.js');
const { FALLBACK_COMMENTARY, FALLBACK_BY_EVENT, COMMENTARY_COOLDOWNS } = require('../config.js');

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-1.5-flash-latest',
];

let isGeneratingLevel = false;
let isPollingGameMaster = false;
let geminiLevelCooldownUntil = 0;
let geminiPollCooldownUntil = 0;
let geminiAuthCooldownUntil = 0;
let lastWorkingModel = GEMINI_MODELS[0];

const config = require('../config.js');

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

function isAuthFailure(status, body) {
  if (status === 401 || status === 403) return true;
  const s = String(body || '');
  return /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(s);
}

async function callGeminiOnce(model, prompt, options) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.code = 'NO_KEY';
    throw err;
  }

  const maxOutputTokens = options.maxOutputTokens || 80;
  const temperature = options.temperature != null ? options.temperature : 0.9;
  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens, temperature },
        }),
      }
    );
    clearTimeout(timeout);
    const raw = await response.text();
    if (!response.ok) {
      const err = new Error(`Gemini ${model} ${response.status}`);
      err.status = response.status;
      err.body = raw.slice(0, 400);
      err.auth = isAuthFailure(response.status, raw);
      err.skipModel = response.status === 404 || /not found|NOT_FOUND/i.test(raw);
      throw err;
    }
    let data;
    try { data = JSON.parse(raw); } catch (e) {
      const err = new Error('Gemini JSON parse failed');
      err.skipModel = true;
      throw err;
    }
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text) || '';
    return String(text).trim();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function callGemini(prompt, options = {}) {
  if (!config.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.code = 'NO_KEY';
    throw err;
  }
  if (Date.now() < geminiAuthCooldownUntil) {
    const err = new Error('Gemini auth cooldown');
    err.code = 'AUTH_COOLDOWN';
    throw err;
  }

  const preferred = lastWorkingModel && GEMINI_MODELS.indexOf(lastWorkingModel) !== -1
    ? [lastWorkingModel, ...GEMINI_MODELS.filter((m) => m !== lastWorkingModel)]
    : GEMINI_MODELS.slice();

  let lastErr = null;
  for (let i = 0; i < preferred.length; i++) {
    const model = preferred[i];
    try {
      const text = await callGeminiOnce(model, prompt, options);
      if (text) {
        lastWorkingModel = model;
        return { text, model };
      }
    } catch (err) {
      lastErr = err;
      if (err.code === 'NO_KEY') throw err;
      if (err.auth) {
        geminiAuthCooldownUntil = Date.now() + 300000;
        err.code = 'AUTH';
        throw err;
      }
      // 404 / unknown model → try the next id. Other 4xx/5xx also walk the list.
      continue;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
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

async function pollGameMasterAsync(worldState, io) {
  if (isPollingGameMaster) return;
  if (Date.now() < geminiPollCooldownUntil || Date.now() < geminiAuthCooldownUntil) return;
  const limiter = worldState.commentaryRateLimiter && worldState.commentaryRateLimiter.game_master;
  if (limiter && Date.now() - limiter.lastCalledAt < 15000) return;

  isPollingGameMaster = true;
  if (limiter) limiter.lastCalledAt = Date.now();
  try {
    io.emit('commentary_thinking', { eventType: 'game_master', source: 'gemini' });
    const prompt = buildPrompt('game_master', worldState);
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
  if (Date.now() < geminiLevelCooldownUntil || Date.now() < geminiAuthCooldownUntil) return;
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
