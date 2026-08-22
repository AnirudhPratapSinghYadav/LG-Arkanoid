'use strict';
/**
 * Reconnect grace must survive a mid-match blip: disconnect must NOT force
 * returnToLobby while the 30s timer is still pending (solo or multi).
 */
const http = require('http');
const path = require('path');

function requireIoClient() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'socket.io-client'),
    path.join(__dirname, '..', '..', 'node_modules', 'socket.io-client'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return require('socket.io-client');
}
const { io } = requireIoClient();

const PORT = process.env.PORT || 8130;
const BASE = `http://127.0.0.1:${PORT}`;

function httpGet(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, body });
        }
      });
    }).on('error', reject);
  });
}

function once(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

async function connectController(name) {
  const s = io(BASE, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    query: { controller: 'true' },
  });
  await once(s, 'connect');
  s.label = name;
  return s;
}

async function main() {
  const results = [];
  const record = (label, ok, detail) => {
    results.push({ label, ok: !!ok, detail: detail == null ? '' : String(detail) });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail != null ? ' — ' + detail : ''}`);
  };

  let health;
  try {
    health = (await httpGet('/health')).json;
  } catch (e) {
    console.error('Server not up on', BASE, e.message);
    process.exit(1);
  }
  record('health ok', health && health.status === 'ok', JSON.stringify(health));

  // Prior e2e may have left a playing court in the 30s reconnect grace.
  if (health && health.gameStatus !== 'lobby') {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      health = (await httpGet('/health')).json;
      if (health && health.gameStatus === 'lobby') break;
    }
  }
  record('lobby clear before solo join', health && health.gameStatus === 'lobby', JSON.stringify(health));

  const screen = io(BASE, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    query: { screenId: '2' },
  });
  await once(screen, 'connect');
  const session = await once(screen, 'session_info');
  const token = session.sessionToken;
  record('got session token', typeof token === 'string' && token.length === 4, token);

  const p1 = await connectController('solo');
  const joinP = once(p1, 'join_confirmed');
  p1.emit('join_game', { sessionToken: token, playerName: 'SoloBlip' });
  const join = await joinP;
  record('joined', join && join.playerId && join.resumeToken, JSON.stringify(join));

  p1.emit('set_game_settings', { maxPlayers: 1, ballSpeed: 'medium', durationSeconds: 180 });
  await new Promise((r) => setTimeout(r, 200));
  const started = once(p1, 'countdown_started');
  p1.emit('start_game', { maxPlayers: 1, ballSpeed: 'medium', durationSeconds: 180 });
  await started;
  await new Promise((r) => setTimeout(r, 3200));

  let state = await once(p1, 'game_state');
  const me = (state.players || []).find((p) => p.id === join.playerId);
  const scoreBefore = me ? me.score : -1;
  const livesBefore = me ? me.lives : -1;
  record('playing before blip', state.gameStatus === 'playing', state.gameStatus);
  record('lives before blip', livesBefore === 3, String(livesBefore));

  for (let i = 0; i < 3; i++) {
    p1.emit('paddle_move', {
      deltaX: 40,
      timestamp: Date.now(),
      nonce: 'blip_' + i + '_' + Math.random().toString(16).slice(2),
    });
  }
  await new Promise((r) => setTimeout(r, 100));

  const resumeToken = join.resumeToken;
  const playerId = join.playerId;
  const sessionId = join.sessionId;
  p1.disconnect();
  await new Promise((r) => setTimeout(r, 800));

  const midHealth = (await httpGet('/health')).json;
  record(
    'match still live during grace (not forced lobby)',
    midHealth && (midHealth.gameStatus === 'playing' || midHealth.gameActive === true),
    JSON.stringify(midHealth)
  );

  const p1b = await connectController('solo-resume');
  const resumeP = once(p1b, 'join_confirmed');
  p1b.emit('resume_request', { playerId, sessionId, resumeToken });
  const resumed = await resumeP;
  record('resume within grace', resumed && resumed.resumed === true && resumed.playerId === playerId, JSON.stringify(resumed));

  state = await once(p1b, 'game_state');
  const me2 = (state.players || []).find((p) => p.id === playerId);
  record('still playing after resume', state.gameStatus === 'playing', state.gameStatus);
  record(
    'lives preserved after resume',
    me2 && me2.lives === livesBefore,
    me2 ? `lives=${me2.lives} before=${livesBefore}` : 'missing player'
  );
  record(
    'score not wiped after resume',
    me2 && typeof me2.score === 'number' && me2.score >= scoreBefore,
    me2 ? `score=${me2.score} before=${scoreBefore}` : 'missing'
  );

  p1b.disconnect();
  screen.disconnect();

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== reconnect-grace: ${results.length - failed} passed, ${failed} failed ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
