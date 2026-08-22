'use strict';
/**
 * Live ~3 minute play session: 3 screens + 2 controllers.
 * Moves paddles, watches ticks, reports health of the match.
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
const PLAY_MS = Number(process.env.PLAY_MS || 180000);
const DURATION_SEC = Math.max(60, Math.ceil(PLAY_MS / 1000));

function httpGet(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
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

function once(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function waitForGameState(socket, predicate, ms = 10000) {
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
  const report = {
    startedAt: new Date().toISOString(),
    playMs: PLAY_MS,
    ok: true,
    issues: [],
    samples: [],
    statusTimeline: [],
    final: null,
  };

  console.log(`\n=== LIVE 3-MIN PLAY — ${BASE} for ${PLAY_MS / 1000}s ===\n`);

  const health = JSON.parse((await httpGet('/health')).body);
  console.log(`health: status=${health.gameStatus}`);

  if (health.gameStatus === 'playing' || health.gameStatus === 'countdown') {
    report.issues.push('Server already mid-match; restart server for a clean playtest');
    report.ok = false;
    console.log('ABORT: server already in a match. Restart server and retry.');
    process.exit(1);
  }

  const screens = [];
  for (let i = 1; i <= 3; i++) {
    screens.push(await connectSocket({ screenId: String(i) }, `screen-${i}`));
  }
  const sessionInfoP = once(screens[1], 'session_info', 8000);
  screens[1].emit('request_session_info');
  const sessionInfo = await sessionInfoP;
  const token = sessionInfo.sessionToken;
  console.log(`session token from screen: ${token}`);
  const p1 = await connectSocket({ controller: 'true' }, 'p1');
  const p2 = await connectSocket({ controller: 'true' }, 'p2');

  let screenTicks = 0;
  let lastBallHash = '';
  let ballMoved = false;
  let maxActiveBalls = 0;
  let bricksSeen = 0;
  let bricksDestroyed = 0;
  let lastActiveBricks = null;
  const errors = [];

  for (const s of screens) {
    s.on('game_state', (st) => {
      screenTicks += 1;
      if (Array.isArray(st.balls)) {
        const active = st.balls.filter((b) => b.active).length;
        maxActiveBalls = Math.max(maxActiveBalls, active);
        const hash = st.balls.map((b) => `${b.id}:${Math.round(b.x)}:${Math.round(b.y)}`).join('|');
        if (lastBallHash && hash !== lastBallHash) ballMoved = true;
        lastBallHash = hash;
      }
      if (st.bricks) {
        let active = 0;
        for (const row of st.bricks) {
          for (const b of row) if (b && b.active && b.type !== 'indestructible') active += 1;
        }
        if (lastActiveBricks == null) {
          lastActiveBricks = active;
          bricksSeen = active;
        } else if (active < lastActiveBricks) {
          bricksDestroyed += lastActiveBricks - active;
          lastActiveBricks = active;
        }
      }
    });
    s.on('disconnect', () => errors.push('screen disconnect'));
  }

  p1.on('error', (e) => errors.push('p1 error ' + JSON.stringify(e)));
  p2.on('error', (e) => errors.push('p2 error ' + JSON.stringify(e)));
  p1.on('join_rejected', (e) => errors.push('p1 rejected ' + JSON.stringify(e)));
  p2.on('join_rejected', (e) => errors.push('p2 rejected ' + JSON.stringify(e)));

  const j1p = once(p1, 'join_confirmed', 8000);
  p1.emit('player_join', { sessionToken: token, playerName: 'LiveP1' });
  const j1 = await j1p;
  const j2p = once(p2, 'join_confirmed', 8000);
  p2.emit('player_join', { sessionToken: token, playerName: 'LiveP2' });
  const j2 = await j2p;
  console.log(`joined: ${j1.playerId} + ${j2.playerId}`);

  p1.emit('set_game_settings', {
    maxPlayers: 2,
    ballSpeed: 'medium',
    durationSeconds: DURATION_SEC,
  });
  await new Promise((r) => setTimeout(r, 300));

  const cdP = once(p1, 'countdown_started', 8000);
  p1.emit('start_game', { durationSeconds: DURATION_SEC, maxPlayers: 2, ballSpeed: 'medium' });
  await cdP;
  const playing = await waitForGameState(p1, (st) => st.gameStatus === 'playing', 10000);
  console.log(`match live — duration=${playing.gameDurationSeconds}s startedAt=${playing.gameStartedAt}`);
  report.statusTimeline.push({ t: 0, status: 'playing' });

  let lastStatus = 'playing';
  let lastState = playing;
  const onState = (st) => {
    lastState = st;
    if (st.gameStatus !== lastStatus) {
      lastStatus = st.gameStatus;
      report.statusTimeline.push({ t: Date.now() - playing.gameStartedAt, status: st.gameStatus });
      console.log(`[${Math.round((Date.now() - playing.gameStartedAt) / 1000)}s] status → ${st.gameStatus}`);
    }
  };
  p1.on('game_state', onState);
  p2.on('game_state', onState);

  const start = Date.now();
  let dir1 = 1;
  let dir2 = -1;
  let sampleN = 0;

  while (Date.now() - start < PLAY_MS) {
    const elapsed = Date.now() - start;
    // Sweep paddles left/right so balls can be hit
    if (Math.floor(elapsed / 2500) % 2 === 0) {
      dir1 = 1;
      dir2 = -1;
    } else {
      dir1 = -1;
      dir2 = 1;
    }

    for (let i = 0; i < 4; i++) {
      p1.emit('paddle_move', {
        deltaX: dir1 * 80,
        timestamp: Date.now(),
        nonce: 'l1_' + elapsed + '_' + i,
      });
      p2.emit('paddle_move', {
        deltaX: dir2 * 80,
        timestamp: Date.now(),
        nonce: 'l2_' + elapsed + '_' + i,
      });
    }

    if (elapsed - sampleN * 30000 >= 30000 || sampleN === 0) {
      sampleN += 1;
      const players = (lastState.players || []).filter((p) => p.connected);
      const sample = {
        sec: Math.round(elapsed / 1000),
        status: lastState.gameStatus,
        ticks: screenTicks,
        activeBalls: (lastState.balls || []).filter((b) => b.active).length,
        scores: players.map((p) => ({ name: p.name, score: p.score, lives: p.lives, x: p.paddleX })),
        bricksDestroyed,
      };
      report.samples.push(sample);
      console.log(
        `[sample ${sample.sec}s] status=${sample.status} ticks=${sample.ticks} balls=${sample.activeBalls} bricksHit=${bricksDestroyed} scores=${JSON.stringify(sample.scores)}`
      );

      if (lastState.gameStatus === 'playing' && screenTicks < 10) {
        report.issues.push(`Very few screen ticks by ${sample.sec}s`);
        report.ok = false;
      }
      if (!screens.every((s) => s.connected) || !p1.connected || !p2.connected) {
        report.issues.push(`Disconnect detected at ${sample.sec}s`);
        report.ok = false;
      }
    }

    await new Promise((r) => setTimeout(r, 80));
  }

  // Brief wait in case time_up lands right at the end
  await new Promise((r) => setTimeout(r, 1500));

  const endHealth = JSON.parse((await httpGet('/health')).body);
  report.final = {
    health: endHealth,
    status: lastState.gameStatus,
    screenTicks,
    ballMoved,
    maxActiveBalls,
    bricksSeen,
    bricksDestroyed,
    players: (lastState.players || []).map((p) => ({
      name: p.name,
      score: p.score,
      lives: p.lives,
      connected: p.connected,
    })),
    errors,
    statusTimeline: report.statusTimeline,
  };

  if (!ballMoved) {
    report.issues.push('Balls never moved on screen clients');
    report.ok = false;
  }
  if (screenTicks < 100) {
    report.issues.push(`Low screen tick count: ${screenTicks}`);
    report.ok = false;
  }
  if (errors.length) {
    report.issues.push(...errors);
    report.ok = false;
  }
  if (lastState.gameStatus === 'playing' && endHealth.gameStatus === 'playing') {
    // expected for a timed session matching play window
  }

  console.log('\n=== LIVE PLAY RESULT ===');
  console.log(JSON.stringify(report.final, null, 2));
  console.log(report.ok ? '\nVERDICT: LIVE PLAY OK' : '\nVERDICT: ISSUES FOUND');
  if (report.issues.length) console.log('Issues:\n- ' + report.issues.join('\n- '));

  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'live-3min-report.json'), JSON.stringify(report, null, 2));

  for (const s of screens) s.disconnect();
  p1.disconnect();
  p2.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
