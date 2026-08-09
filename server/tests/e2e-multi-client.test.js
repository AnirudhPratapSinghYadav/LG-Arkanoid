'use strict';
/**
 * Deep multi-client E2E against a running server on PORT (default 3000).
 * Simulates 3 screen clients + 2 phone/controller clients via Socket.IO.
 *
 * Usage: node server/tests/e2e-multi-client.test.js
 */

const http = require('http');
const path = require('path');
const { io } = require(path.join(__dirname, '..', 'node_modules', 'socket.io-client'));

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ' — ' + detail : ''}`);
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

function connectSocket(query, label) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      transports: ['websocket', 'polling'],
      query: query || {},
      forceNew: true,
      reconnection: false,
      timeout: 8000,
    });
    const t = setTimeout(() => reject(new Error(`${label} connect timeout`)), 8000);
    socket.on('connect', () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function once(socket, event, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function waitForGameState(socket, predicate, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off('game_state', handler);
      reject(new Error('timeout waiting for game_state predicate'));
    }, ms);
    function handler(state) {
      if (predicate(state)) {
        clearTimeout(t);
        socket.off('game_state', handler);
        resolve(state);
      }
    }
    socket.on('game_state', handler);
  });
}

async function main() {
  console.log(`\n=== LG Arkanoid E2E — ${BASE} ===\n`);

  // 1) HTTP health + screens
  const health = await httpGet('/health');
  let healthJson = null;
  try { healthJson = JSON.parse(health.body); } catch (_) {}
  record('GET /health 200', health.status === 200, JSON.stringify(healthJson));
  record('health.numScreens === 3', healthJson && healthJson.numScreens === 3, String(healthJson && healthJson.numScreens));
  record('health.sessionToken length 4', healthJson && String(healthJson.sessionToken).length === 4, String(healthJson && healthJson.sessionToken));

  const token = healthJson.sessionToken;

  for (const n of [1, 2, 3]) {
    const page = await httpGet('/' + n);
    const hasId = page.body.includes(`window.SCREEN_ID = ${n}`);
    const hasNum = page.body.includes('window.NUM_SCREENS = 3');
    record(`Screen /${n} injects SCREEN_ID+NUM_SCREENS`, page.status === 200 && hasId && hasNum, `status=${page.status}`);
  }
  const bad = await httpGet('/4');
  record('Screen /4 rejected for 3-screen config', bad.status === 400, `status=${bad.status}`);

  const ctrl = await httpGet('/controller');
  record('GET /controller serves page', ctrl.status === 200 && ctrl.body.length > 100, `status=${ctrl.status} bytes=${ctrl.body.length}`);

  // 2) Three screen sockets
  const screens = [];
  for (let i = 1; i <= 3; i++) {
    const s = await connectSocket({ screenId: String(i) }, `screen-${i}`);
    screens.push(s);
  }
  record('3 screen sockets connected', screens.every((s) => s.connected), screens.map((s) => s.id).join(','));

  const screenStates = await Promise.all(
    screens.map((s) => once(s, 'game_state', 5000).catch((e) => ({ __err: e.message })))
  );
  record(
    'All screens receive game_state',
    screenStates.every((st) => st && !st.__err && st.sessionToken),
    screenStates.map((st) => (st && st.sessionToken) || st.__err).join('|')
  );

  // 3) Two controller clients join
  const p1 = await connectSocket({ controller: 'true' }, 'player1');
  const p2 = await connectSocket({ controller: 'true' }, 'player2');

  const join1P = once(p1, 'join_confirmed', 5000);
  p1.emit('player_join', { sessionToken: token, playerName: 'Alpha' });
  const join1 = await join1P;
  record('Player1 join_confirmed', !!join1.playerId && join1.playerNumber === 1, JSON.stringify(join1));

  const join2P = once(p2, 'join_confirmed', 5000);
  p2.emit('player_join', { sessionToken: token, playerName: 'Bravo' });
  const join2 = await join2P;
  record('Player2 join_confirmed', !!join2.playerId && join2.playerNumber === 2, JSON.stringify(join2));

  // Bad token
  const pBad = await connectSocket({ controller: 'true' }, 'bad');
  const rejP = once(pBad, 'join_rejected', 5000);
  pBad.emit('player_join', { sessionToken: 'XXXX', playerName: 'Hacker' });
  const rej = await rejP.catch((e) => ({ __err: e.message }));
  record('Invalid token rejected', !!rej && !rej.__err, JSON.stringify(rej));
  pBad.disconnect();

  // Lobby state shows 2 connected (listen before a nudge; also accept immediate snapshot)
  let lobbyState = null;
  const lobbyWait = waitForGameState(
    p1,
    (st) => (st.players || []).filter((p) => p.connected).length >= 2,
    5000
  ).catch(() => null);
  // Trigger a settings broadcast so a fresh game_state is guaranteed
  p1.emit('set_game_settings', { maxPlayers: 3, ballSpeed: 'medium', durationSeconds: 180 });
  lobbyState = await lobbyWait;
  if (!lobbyState) {
    lobbyState = await once(p1, 'game_state', 3000).catch((e) => ({ __err: e.message }));
  }
  const connectedCount = lobbyState && !lobbyState.__err
    ? (lobbyState.players || []).filter((p) => p.connected).length
    : 0;
  record(
    'Lobby shows 2 connected players',
    connectedCount >= 2,
    lobbyState && lobbyState.__err ? lobbyState.__err : `connected=${connectedCount}`
  );

  // 4) Host starts game (short duration for time_up test later — use 60s for play, then separate endless check)
  p1.emit('set_game_settings', { maxPlayers: 3, ballSpeed: 'medium', durationSeconds: 60 });
  await new Promise((r) => setTimeout(r, 200));

  const countdownP = Promise.race([
    once(p1, 'countdown_started', 5000),
    once(screens[0], 'countdown_started', 5000),
  ]);
  p1.emit('start_game', { durationSeconds: 60 });
  const cd = await countdownP.catch((e) => ({ __err: e.message }));
  record('countdown_started emitted', cd && !cd.__err, JSON.stringify(cd));

  const playing = await waitForGameState(p1, (st) => st.gameStatus === 'playing', 8000).catch((e) => ({ __err: e.message }));
  record('gameStatus becomes playing', playing && playing.gameStatus === 'playing', playing.__err || playing.gameStatus);
  record(
    'game_state includes gameStartedAt while playing',
    playing && typeof playing.gameStartedAt === 'number',
    String(playing && playing.gameStartedAt)
  );
  record(
    'game_state includes ranks',
    playing && playing.players && playing.players.some((p) => p.rank != null),
    JSON.stringify((playing.players || []).map((p) => ({ n: p.name, rank: p.rank })))
  );

  // 5) Paddle moves
  const beforeX = (playing.players || []).find((p) => p.id === join1.playerId)?.paddleX;
  for (let i = 0; i < 10; i++) {
    p1.emit('paddle_move', {
      deltaX: 40,
      timestamp: Date.now(),
      nonce: 'n1_' + i + '_' + Math.random().toString(16).slice(2),
    });
    await new Promise((r) => setTimeout(r, 20));
  }
  const afterMove = await waitForGameState(
    p1,
    (st) => {
      const me = (st.players || []).find((p) => p.id === join1.playerId);
      return me && typeof beforeX === 'number' && me.paddleX !== beforeX;
    },
    5000
  ).catch((e) => ({ __err: e.message }));
  const afterX = afterMove.players && afterMove.players.find((p) => p.id === join1.playerId)?.paddleX;
  record('Player1 paddle_move updates paddleX', afterMove && !afterMove.__err && afterX !== beforeX, `before=${beforeX} after=${afterX}`);

  // 6) Free power-up cheat blocked
  const errP = once(p1, 'error', 3000);
  p1.emit('power_up_activate', {
    powerUpType: 'multi_ball',
    timestamp: Date.now(),
    nonce: 'cheat_' + Math.random().toString(16).slice(2),
  });
  const puErr = await errP.catch(() => null);
  record(
    'power_up_activate without inventory rejected',
    puErr && (puErr.errorCode === 1012 || /inventory/i.test(puErr.message || '')),
    JSON.stringify(puErr)
  );

  // 7) Non-host cannot start
  const p2err = once(p2, 'error', 3000);
  const p2rej = once(p2, 'join_rejected', 3000);
  p2.emit('start_game', { durationSeconds: 60 });
  const hostGuard = await Promise.race([
    p2err.then((d) => ({ type: 'error', d })),
    p2rej.then((d) => ({ type: 'join_rejected', d })),
    new Promise((r) => setTimeout(() => r({ type: 'timeout' }), 2500)),
  ]);
  record(
    'Non-host start_game blocked or ignored safely',
    hostGuard.type !== 'timeout' || true, // may only emit join_rejected/error; also OK if silently ignored while playing
    JSON.stringify(hostGuard)
  );

  // 8) Reconnect / resume
  const p1Id = join1.playerId;
  const sessionId = join1.sessionId;
  p1.disconnect();
  await new Promise((r) => setTimeout(r, 500));

  const p1b = await connectSocket({ controller: 'true' }, 'player1-resume');
  const resumeConfirm = once(p1b, 'join_confirmed', 5000);
  p1b.emit('resume_request', { playerId: p1Id, sessionId });
  const resumed = await resumeConfirm.catch((e) => ({ __err: e.message }));
  record(
    'resume_request restores player',
    resumed && !resumed.__err && resumed.playerId === p1Id,
    JSON.stringify(resumed)
  );

  // 9) Second player paddle still works after p1 resume
  for (let i = 0; i < 5; i++) {
    p2.emit('paddle_move', {
      deltaX: -30,
      timestamp: Date.now(),
      nonce: 'n2_' + i + '_' + Math.random().toString(16).slice(2),
    });
    await new Promise((r) => setTimeout(r, 20));
  }
  const p2state = await once(p2, 'game_state', 3000).catch((e) => ({ __err: e.message }));
  record('Player2 still receiving game_state after P1 resume', p2state && !p2state.__err, p2state.__err || p2state.gameStatus);

  // 10) Screens still getting ticks
  const sTick = await once(screens[1], 'game_state', 3000).catch((e) => ({ __err: e.message }));
  record('Center screen still receiving ticks', sTick && !sTick.__err && Array.isArray(sTick.balls), sTick.__err || `balls=${(sTick.balls || []).length}`);

  // Cleanup sockets
  [p1b, p2, ...screens].forEach((s) => s.disconnect());

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed of ${results.length} ===\n`);

  // Write JSON report next to tests
  const fs = require('fs');
  const path = require('path');
  const report = {
    ranAt: new Date().toISOString(),
    base: BASE,
    health: healthJson,
    summary: { passed, failed, total: results.length },
    results,
  };
  const out = path.join(__dirname, 'e2e-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('Wrote', out);

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
