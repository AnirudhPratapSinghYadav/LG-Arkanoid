const fetch = require('node-fetch');
const gameEngine = require('../gameEngine.js');
const { FALLBACK_COMMENTARY, COMMENTARY_COOLDOWNS } = require('../config.js');

let isGeneratingLevel = false;
let isPollingGameMaster = false;

const config = require('../config.js');

async function callGemini(prompt, options = {}){
  const apiKey = config.GEMINI_API_KEY;
  if(!apiKey){
    throw new Error('GEMINI_API_KEY not configured');
  }

  const maxOutputTokens = options.maxOutputTokens || 80;
  const temperature = options.temperature != null ? options.temperature : 0.9;
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
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
    });

    clearTimeout(timeout);

    if(!response.ok){
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function buildPrompt(eventType, snapshot){
  const scores = snapshot.players
    .filter((p)=>p.connected)
    .map((p, i)=>`${p.name || 'P'+(i+1)}:${p.score}`)
    .join(', ');

  const templates = {
    level_cleared: `The player just cleared level ${snapshot.currentLevel}. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary mentioning player names. Do not mention brick colours. Do not predict future events.`,
    life_lost: `A player just lost a life. Current lives are ${snapshot.players.map((p)=>`${p.name || p.id}: ${p.lives}`).join(', ')}. Generate exactly 15 words of tense retro arcade announcer commentary mentioning player names.`,
    multi_ball: `Multi ball just activated with two balls crossing the panoramic rig. Generate exactly 15 words of excited commentary.`,
    score_milestone: `A player just crossed a score milestone. Scores are ${scores}. Generate exactly 15 words of excited retro arcade announcer commentary mentioning player names.`,
    victory: `The game is over. Final scores are ${scores}. Generate exactly 15 words of triumphant retro arcade announcer commentary declaring the winner by name.`,
    rank_takeover: `Player ${snapshot.playerId || 'someone'} just took the lead from their opponent. Scores are ${scores}. Generate exactly 15 words of excited, competitive retro arcade commentary announcing the lead change and mentioning player names.`,
  };
  return templates[eventType] || templates.score_milestone;
}

async function triggerCommentary(eventType, snapshot, io, commentaryRateLimiter){
  const cooldown = COMMENTARY_COOLDOWNS[eventType] || 0;
  const limiter = commentaryRateLimiter[eventType];

  if(limiter && cooldown > 0 && Date.now() - limiter.lastCalledAt < cooldown){
    return;
  }
  if(limiter) limiter.lastCalledAt = Date.now();

  try {
    const prompt = buildPrompt(eventType, snapshot);
    io.emit('commentary_thinking', { eventType });
    const text = await callGemini(prompt);
    if(text){
      io.emit('commentary', { text, source: 'gemini', eventType });
      return;
    }
  } catch(err){
    // Fallback commentary on error or missing API key
  }

  const fallbackText = FALLBACK_COMMENTARY[Math.floor(Math.random() * FALLBACK_COMMENTARY.length)];
  io.emit('commentary', { text: fallbackText, source: 'fallback', eventType });
}

async function pollGameMasterAsync(worldState, io){
  if(isPollingGameMaster) return;
  const limiter = worldState.commentaryRateLimiter['game_master'];
  if(limiter && Date.now() - limiter.lastCalledAt < 15000) return;
  
  isPollingGameMaster = true;
  if(limiter) limiter.lastCalledAt = Date.now();
  try {
    io.emit('commentary_thinking', { eventType: 'game_master' });
    const playerStats = worldState.players.map(p => `${p.name || p.id}: ${p.lives} lives, ${p.score} score`).join(' | ');
    const prompt = `You are the AI Game Master of Arkanoid. A player just lost a life.
Current stats: ${playerStats}, Level=${worldState.level}.
Decide on a modifier to help or punish them. Choose exactly one: WIDE_PADDLE, EXTRA_BALL, SLOW_BALL, NONE.
Return a JSON object: {"modifier": "YOUR_CHOICE", "commentary": "Your 10 word snarky comment mentioning the player by name"}.
Do not include markdown.`;

    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    let data = JSON.parse(jsonMatch[0]);
    
    if(data.modifier && data.modifier !== 'NONE'){
      gameEngine.applyGameMasterMod(worldState, data.modifier);
    }
    if(data.commentary){
      io.emit('commentary', { text: data.commentary, source: 'ai', eventType: 'game_master' });
    }
  } catch(err){
    console.error('Failed to poll Game Master:', err);
  } finally {
    isPollingGameMaster = false;
  }
}

async function generateNextLevelAsync(nextLevel, worldState){
  if(isGeneratingLevel) return;
  isGeneratingLevel = true;
  try {
    if (worldState && worldState.io) {
      worldState.io.emit('commentary_thinking', { eventType: 'level_generation' });
    }
    const numScreens = worldState.numScreens || 3;
    const numCols = gameEngine.brickColumnsForWorld(numScreens, worldState.screenWidth);
    const tileCols = 13;
    const prompt = `You are a level designer for a panoramic brick breaker.
Create a TILE for Level ${nextLevel} that will be mirrored across ${numScreens} Liquid Galaxy screens.
Output a JSON 2D array of numbers (exactly 8 rows, each row having exactly ${tileCols} integers).
Values: 0 = empty, 1 = normal brick, 2 = hard brick, 3 = indestructible.
Keep at least some destructible bricks. Make a motif that looks good when repeated left-to-right with mirroring.
Return ONLY the JSON 2D array.`;

    const text = await callGemini(prompt, { maxOutputTokens: 2048, temperature: 0.4, timeoutMs: 15000 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const grid = JSON.parse(jsonMatch[0]);
      if (Array.isArray(grid) && grid.length === 8) {
        let tileOk = true;
        for (let i = 0; i < grid.length; i++) {
          const row = grid[i];
          if (!Array.isArray(row) || row.length !== tileCols) {
            tileOk = false;
            break;
          }
          for (let j = 0; j < row.length; j++) {
            if (typeof row[j] !== 'number' || row[j] < 0 || row[j] > 3) {
              tileOk = false;
              break;
            }
          }
          if (!tileOk) break;
        }
        if (tileOk) {
          const expanded = gameEngine.expandTiledBrickGrid(grid, numCols);
          if (expanded) worldState.nextLevelBricks = expanded;
        } else {
          throw new Error('Gemini response returned invalid tile dimensions or values');
        }
      }
    }
  } catch(err){
    if(config.GEMINI_API_KEY){
      console.error('Failed to generate level via Gemini:', err.message);
    }
  } finally {
    isGeneratingLevel = false;
  }
}

module.exports = {
  callGemini,
  buildPrompt,
  triggerCommentary,
  pollGameMasterAsync,
  generateNextLevelAsync
};
