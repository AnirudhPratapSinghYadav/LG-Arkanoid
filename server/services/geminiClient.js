'use strict';
/**
 * HTTP cascade for ARKANOID AI. Invalid keys stop immediately.
 * Missing-model 404s walk the list. Auth failures cool down 5 minutes.
 */
const fetch = require('node-fetch');
const config = require('../config.js');

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

let geminiAuthCooldownUntil = 0;
let lastWorkingModel = GEMINI_MODELS[0];

function isAuthFailure(status, body) {
  if (status === 401 || status === 403) return true;
  const s = String(body || '');
  return /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(s);
}

function authCooldownActive() {
  return Date.now() < geminiAuthCooldownUntil;
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
  if (authCooldownActive()) {
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
      continue;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

module.exports = {
  GEMINI_MODELS,
  callGemini,
  callGeminiOnce,
  isAuthFailure,
  authCooldownActive,
};
