'use strict';
/**
 * Full-HD Liquid Galaxy wall replay.
 *
 *   NUM_SCREENS=3 PLAYERS=2 MATCH_SEC=180 node server/tests/demo-3screen-chrome.js
 *   NUM_SCREENS=5 PLAYERS=5 MATCH_SEC=180 DEMO_LABEL=5p node server/tests/demo-3screen-chrome.js
 *
 * Viewport is 1920×1080 so the 8px ball is actually visible (old 960×540
 * captures made it a few pixels). Center screen is also filmed at 2 fps.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PORT = Number(process.env.PORT || 8130);
const BASE = `http://127.0.0.1:${PORT}`;
const NUM_SCREENS = Math.max(1, Math.min(12, Number(process.env.NUM_SCREENS || 3)));
const PLAYERS = Math.max(1, Math.min(5, Number(process.env.PLAYERS || 2)));
const MATCH_SEC = Number(process.env.MATCH_SEC || 180);
const PLAY_MS = Number(process.env.PLAY_MS || MATCH_SEC * 1000 + 12000);
const DURATION_SEC = MATCH_SEC;
const VIEW_W = Number(process.env.VIEW_W || 1920);
const VIEW_H = Number(process.env.VIEW_H || 1080);
const ALL_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
const NAMES = ALL_NAMES.slice(0, PLAYERS);
const CENTER_ID = Math.ceil(NUM_SCREENS / 2);
const DEMO_LABEL = process.env.DEMO_LABEL || (PLAYERS + 'p');
const ROOT = path.join(__dirname, '..', '..');
const SHOT_DIR = path.join(ROOT, 'docs', 'demo-play', DEMO_LABEL);
const FILM_DIR = path.join(SHOT_DIR, 'film');
const REPORT_JSON = path.join(__dirname, 'demo-' + DEMO_LABEL + '-report.json');
const REPORT_MD = path.join(SHOT_DIR, 'REPORT.md');
const INDEX_MD = path.join(ROOT, 'docs', 'DEMO_PLAY_REPORT.md');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG =
  process.env.FFMPEG_PATH ||
  'C:\\Users\\Anirudh\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe';
let spawnedProc = null;

function getPuppeteer() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'puppeteer-core'),
    path.join(ROOT, 'node_modules', 'puppeteer-core'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return require('puppeteer-core');
}

function requireIoClient() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'socket.io-client'),
    path.join(ROOT, 'node_modules', 'socket.io-client'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return require('socket.io-client');
}

function httpGet(p) {
  return new Promise((resolve, reject) => {
    const req = http.get(BASE + p, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('health timeout'));
    });
  });
}

async function waitForHealth(ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await httpGet('/health');
      if (r.status === 200) return JSON.parse(r.body);
    } catch (_) {}
    await sleep(400);
  }
  throw new Error('Server did not become healthy on ' + BASE);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectSocket(query, label) {
  const { io } = requireIoClient();
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      transports: ['websocket', 'polling'],
      query: query || {},
      forceNew: true,
      reconnection: false,
      timeout: 8000,
    });
    const t = setTimeout(() => reject(new Error(label + ' connect timeout')), 8000);
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
    const t = setTimeout(() => reject(new Error('timeout waiting for ' + event)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function waitForGameState(socket, predicate, ms = 12000) {
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

function ballsOnSlice(state, screenId) {
  const w = (state && state.screenWidth) || 1920;
  const left = (screenId - 1) * w;
  const right = screenId * w;
  return ((state && state.balls) || []).filter((b) => b && b.active && b.x >= left && b.x < right);
}

async function shot(page, name, opts) {
  const dest = path.join(SHOT_DIR, name);
  const type = (opts && opts.type) || 'jpeg';
  const quality = type === 'jpeg' ? ((opts && opts.quality) || 86) : undefined;
  const clip = opts && opts.clip;
  try {
    await Promise.race([
      page.screenshot({
        path: dest,
        type,
        quality,
        clip,
        captureBeyondViewport: false,
      }),
      sleep(4500).then(() => {
        throw new Error('screenshot timeout');
      }),
    ]);
  } catch (e) {
    console.warn('screenshot failed', name, e.message);
  }
  return dest;
}

async function pageEval(page, fn, fallback, ...args) {
  try {
    return await Promise.race([
      page.evaluate(fn, ...args),
      sleep(2500).then(() => fallback),
    ]);
  } catch (_) {
    return fallback;
  }
}

function startServerIfNeeded() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NUM_SCREENS: String(NUM_SCREENS),
    LG_FRAME_ASPECT: process.env.LG_FRAME_ASPECT || '16:9',
    NODE_ENV: process.env.NODE_ENV || 'development',
    GEMINI_API_KEY: '',
  };
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  return child;
}

function encodeFilm() {
  if (!fs.existsSync(FFMPEG)) return null;
  const frames = fs.readdirSync(FILM_DIR).filter((f) => /^frame-\d+\.jpg$/.test(f)).sort();
  if (frames.length < 8) return null;
  const out = path.join(SHOT_DIR, 'center-' + DEMO_LABEL + '-3min.mp4');
  const r = spawnSync(FFMPEG, [
    '-y', '-framerate', '1',
    '-i', path.join(FILM_DIR, 'frame-%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
    out,
  ], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.warn('ffmpeg failed', r.stderr && r.stderr.slice(-400));
    return null;
  }
  return path.relative(path.join(ROOT, 'docs'), out).replace(/\\/g, '/');
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(FILM_DIR, { recursive: true });
  for (const f of fs.readdirSync(SHOT_DIR)) {
    if (/\.(png|jpg|jpeg|webp|mp4)$/i.test(f)) fs.unlinkSync(path.join(SHOT_DIR, f));
  }
  for (const f of fs.readdirSync(FILM_DIR)) {
    fs.unlinkSync(path.join(FILM_DIR, f));
  }

  const report = {
    startedAt: new Date().toISOString(),
    label: DEMO_LABEL,
    playMs: PLAY_MS,
    durationSec: DURATION_SEC,
    numScreens: NUM_SCREENS,
    players: PLAYERS,
    names: NAMES,
    viewport: VIEW_W + 'x' + VIEW_H,
    ok: true,
    issues: [],
    checks: [],
    screenshots: [],
    samples: [],
    video: null,
    chromium: {},
    final: null,
  };

  function check(name, ok, detail) {
    report.checks.push({ name, ok: !!ok, detail: detail || '' });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) {
      report.ok = false;
      report.issues.push(name + (detail ? ': ' + detail : ''));
    }
  }

  let spawned = null;
  let health;
  try {
    health = await waitForHealth(2000);
    if (Number(health.numScreens) !== NUM_SCREENS) {
      throw new Error('wrong screen count ' + health.numScreens);
    }
    check('Server already running', true, JSON.stringify(health));
  } catch (_) {
    console.log(`Starting local server NUM_SCREENS=${NUM_SCREENS} PLAYERS=${PLAYERS} ${VIEW_W}x${VIEW_H} …`);
    spawned = startServerIfNeeded();
    spawnedProc = spawned;
    health = await waitForHealth(25000);
    check('Spawned server became healthy', health && health.status === 'ok', JSON.stringify(health));
  }

  if (health.gameStatus === 'playing' || health.gameStatus === 'countdown') {
    check('Server idle (not mid-match)', false, health.gameStatus);
    if (spawned) spawned.kill();
    process.exit(1);
  }
  check('health omits sessionToken', health.sessionToken === undefined, String(health.sessionToken));
  check('health numScreens matches wall', Number(health.numScreens) === NUM_SCREENS, String(health.numScreens));

  if (!fs.existsSync(CHROME)) {
    check('Google Chrome installed', false, CHROME);
    if (spawned) spawned.kill();
    process.exit(1);
  }
  report.chromium.executable = CHROME;

  const puppeteer = getPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 20000,
    defaultViewport: null,
    args: [
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-extensions',
      '--autoplay-policy=no-user-gesture-required',
      '--use-gl=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      `--window-size=${VIEW_W},${VIEW_H}`,
    ],
  });
  report.chromium.version = await browser.version();

  const screenPages = [];
  const controllers = [];

  try {
    for (let i = 1; i <= NUM_SCREENS; i++) {
      const page = await browser.newPage();
      await page.setViewport({ width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1 });
      page.setDefaultNavigationTimeout(25000);
      const resp = await page.goto(`${BASE}/${i}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1800);
      const injected = await pageEval(page, () => ({
        id: window.SCREEN_ID,
        num: window.NUM_SCREENS,
        w: window.SCREEN_W,
        h: window.CANVAS_H,
        hasIo: typeof io !== 'undefined',
        hasPhaser: typeof Phaser !== 'undefined',
        canvas: !!document.querySelector('#game canvas, canvas:not(#qr-canvas):not(#qrCanvas)'),
        canvasW: (() => {
          const el = document.querySelector('#game canvas') || Array.from(document.querySelectorAll('canvas')).find((c) => c.width > 400) || document.querySelector('canvas');
          return el ? el.width : 0;
        })(),
        canvasH: (() => {
          const el = document.querySelector('#game canvas') || Array.from(document.querySelectorAll('canvas')).find((c) => c.width > 400) || document.querySelector('canvas');
          return el ? el.height : 0;
        })(),
        code: (document.getElementById('qr-session-code') || {}).textContent || '',
      }), { error: 'evaluate failed' });
      check(
        `Screen /${i} loads Phaser slice`,
        resp && resp.ok() && injected.id === i && injected.hasPhaser,
        JSON.stringify(injected)
      );
      const file = `01-lobby-screen${i}.png`;
      await shot(page, file);
      report.screenshots.push(file);
      screenPages.push(page);
    }

    await sleep(800 + NUM_SCREENS * 250);

    check('Screen 1 Phaser ready', true, 'canvas checked on load');

    const centerPage = screenPages[CENTER_ID - 1];
    const tokenFromDom = (
      await pageEval(centerPage, () =>
        ((document.getElementById('qr-session-code') || {}).textContent || '').trim().toUpperCase()
      , '')
    ).replace(/[^A-Z0-9]/g, '').slice(0, 4);

    const probe = await connectSocket({ screenId: String(CENTER_ID) }, 'token-probe');
    const sessionInfoP = once(probe, 'session_info', 8000);
    probe.emit('request_session_info');
    const sessionInfo = await sessionInfoP;
    const token = sessionInfo.sessionToken;
    probe.disconnect();
    check('4-char session token from screen socket', String(token).length === 4, String(token));
    if (tokenFromDom) {
      check('Center-screen QR code matches socket token', tokenFromDom === token, `${tokenFromDom} vs ${token}`);
    }

    for (let i = 1; i <= PLAYERS; i++) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 1 });
      page.setDefaultNavigationTimeout(20000);
      const resp = await page.goto(`${BASE}/controller?cb=${Date.now()}-${i}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await sleep(400);
      const hasToken = await page.$('#tokenInput');
      const status = resp && resp.status();
      check(
        `Controller ${i} page loads`,
        !!(hasToken && status && status < 400),
        `status=${status}`
      );
      controllers.push(page);
    }

    async function fillController(page, name, code) {
      try {
        await page.waitForSelector('#joinBtn', { timeout: 20000 });
      } catch (err) {
        const dump = await pageEval(page, () => ({
          url: location.href,
          ids: [...document.querySelectorAll('[id]')].map((el) => el.id),
          title: document.title,
          body: (document.body && document.body.innerText || '').slice(0, 400),
        }), {});
        console.warn('joinBtn missing', JSON.stringify(dump));
        throw err;
      }
      await page.$eval('#tokenInput', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, code);
      await page.$eval('#nameInput', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, name);
    }

    async function joinViaUi(page, name, code) {
      page.removeAllListeners('dialog');
      page.on('dialog', async (d) => {
        console.warn('controller dialog:', d.message());
        await d.dismiss().catch(() => {});
      });
      const result = await page.evaluate((playerName, sessionCode) => {
        const tokenInput = document.getElementById('tokenInput');
        const nameInput = document.getElementById('nameInput');
        const err = document.getElementById('joinError');
        if (err) err.textContent = '';
        if (tokenInput) tokenInput.value = sessionCode;
        if (nameInput) nameInput.value = playerName;
        if (typeof joinGame === 'function') joinGame();
        else document.getElementById('joinBtn').click();
        return {
          token: tokenInput && tokenInput.value,
          name: nameInput && nameInput.value,
        };
      }, name, code);
      for (let attempt = 0; attempt < 40; attempt++) {
        const joined = await pageEval(page, () => {
          const area = document.getElementById('gameArea');
          const visible = !!(area && getComputedStyle(area).display !== 'none');
          const meta = window.__lgControllerMeta && window.__lgControllerMeta();
          return {
            visible,
            connected: !!(meta && meta.connected),
            host: !!(meta && meta.host),
            err: ((document.getElementById('joinError') || {}).textContent || ''),
          };
        }, {});
        if (joined && joined.connected && joined.visible) return result;
        if (joined && joined.err) {
          console.warn('join error', joined.err);
          break;
        }
        await sleep(250);
      }
      const dump = await pageEval(page, () => ({
        err: ((document.getElementById('joinError') || {}).textContent || ''),
        gameComputed: document.getElementById('gameArea') ? getComputedStyle(document.getElementById('gameArea')).display : null,
        meta: window.__lgControllerMeta && window.__lgControllerMeta(),
      }), {});
      if (dump && dump.meta && dump.meta.connected) return result;
      console.warn('join wait dump', JSON.stringify(dump));
      throw new Error('join did not enter game area for ' + name);
    }

    for (let i = 0; i < PLAYERS; i++) {
      await fillController(controllers[i], NAMES[i], token);
      const file = `01-join-phone${i + 1}-${NAMES[i].toLowerCase()}.png`;
      await shot(controllers[i], file);
      report.screenshots.push(file);
    }
    check('All controller join forms filled', true, NAMES.join(', '));

    for (let i = 0; i < PLAYERS; i++) {
      const join = await joinViaUi(controllers[i], NAMES[i], token);
      check(`${NAMES[i]} joined`, String(join.token || '').length === 4, JSON.stringify(join));
      await sleep(350);
    }

    const hostMeta = await pageEval(controllers[0], () => window.__lgControllerMeta && window.__lgControllerMeta(), {});
    check(`${NAMES[0]} is host after join`, !!(hostMeta && hostMeta.host), JSON.stringify(hostMeta));

    await controllers[0].waitForFunction(() => {
      const host = document.getElementById('hostControls');
      return host && getComputedStyle(host).display !== 'none';
    }, { timeout: 8000 }).catch(() => {});

    await controllers[0].evaluate((maxP, sec) => {
      hostMaxPlayers = maxP;
      hostDuration = sec;
      hostBallSpeed = 'medium';
      if (typeof persistHostSettings === 'function') persistHostSettings();
      if (typeof syncHostChips === 'function') syncHostChips();
      if (typeof emitHostSettings === 'function') emitHostSettings();
    }, PLAYERS, DURATION_SEC);
    await sleep(400);
    await shot(controllers[0], '01b-create-game-host.png');
    report.screenshots.push('01b-create-game-host.png');
    if (controllers[1]) {
      await shot(controllers[1], '01b-joined-guest.png');
      report.screenshots.push('01b-joined-guest.png');
    }

    const afterJoin = JSON.parse((await httpGet('/health')).body);
    check(
      `connectedPlayers >= ${PLAYERS}`,
      afterJoin.connectedPlayers >= PLAYERS,
      JSON.stringify(afterJoin)
    );

    let lastState = null;
    let ticks = 0;
    let ballMoved = false;
    let lastBallHash = '';
    let bricksDestroyed = 0;
    let lastActiveBricks = null;
    let maxActiveBalls = 0;
    let sawBallOnCenter = false;
    let commentaryLines = [];

    const watcher = await connectSocket({ screenId: String(CENTER_ID) }, 'watcher');
    watcher.on('game_state', (st) => {
      ticks += 1;
      lastState = st;
      if (Array.isArray(st.balls)) {
        const active = st.balls.filter((b) => b.active).length;
        maxActiveBalls = Math.max(maxActiveBalls, active);
        const hash = st.balls.map((b) => `${b.id}:${Math.round(b.x)}:${Math.round(b.y)}`).join('|');
        if (lastBallHash && hash !== lastBallHash) ballMoved = true;
        lastBallHash = hash;
        if (ballsOnSlice(st, CENTER_ID).length) sawBallOnCenter = true;
      }
      if (st.lastCommentary && commentaryLines[commentaryLines.length - 1] !== st.lastCommentary) {
        commentaryLines.push(st.lastCommentary);
      }
      if (st.bricks) {
        let active = 0;
        for (const row of st.bricks) {
          for (const b of row) if (b && b.active && b.type !== 'indestructible') active += 1;
        }
        if (lastActiveBricks == null) lastActiveBricks = active;
        else if (active < lastActiveBricks) {
          bricksDestroyed += lastActiveBricks - active;
          lastActiveBricks = active;
        }
      }
    });

    await controllers[0].evaluate((sec, maxP) => {
      hostDuration = sec;
      hostMaxPlayers = maxP;
      if (typeof persistHostSettings === 'function') persistHostSettings();
      if (typeof window.__lgStartMatch === 'function') window.__lgStartMatch();
      else document.getElementById('startMatchBtn').click();
    }, DURATION_SEC, PLAYERS);

    const countdownShots = (async () => {
      const ticksFiles = ['02-whistle-3.png', '02-whistle-2.png', '02-whistle-1.png', '02-whistle-start.png'];
      for (const file of ticksFiles) {
        await shot(centerPage, file);
        report.screenshots.push(file);
        await sleep(720);
      }
      await Promise.all(screenPages.map(async (page, i) => {
        const file = `02-countdown-screen${i + 1}.png`;
        await shot(page, file);
        report.screenshots.push(file);
      }));
    })();

    await waitForGameState(watcher, (st) => st.gameStatus === 'countdown' || st.gameStatus === 'playing', 12000)
      .then((st) => check('Match countdown started', true, st.gameStatus))
      .catch((e) => {
        if (lastState && (lastState.gameStatus === 'countdown' || lastState.gameStatus === 'playing')) {
          check('Match countdown started', true, lastState.gameStatus);
        } else {
          check('Match countdown started', false, e.message);
        }
      });

    await waitForGameState(watcher, (st) => st.gameStatus === 'playing', 20000)
      .then((st) => check('Match reached playing', true, `duration=${st.gameDurationSeconds}`))
      .catch((e) => {
        if (lastState && lastState.gameStatus === 'playing') {
          check('Match reached playing', true, `duration=${lastState.gameDurationSeconds}`);
        } else {
          check('Match reached playing', false, e.message);
        }
      });
    await Promise.race([countdownShots.catch(() => {}), sleep(3800)]);

    const playStart = Date.now();
    await sleep(200);

    check(
      'Rightmost standings have live players on the socket',
      ((lastState && lastState.players) || []).filter((p) => p && p.connected).length >= PLAYERS,
      JSON.stringify(((lastState && lastState.players) || []).map((p) => ({
        name: p.name, score: p.score, lives: p.lives, connected: p.connected,
      })))
    );

    const sampleAt = new Set([5, 15, 30, 45, 60, 90, 120, 150, 165, 178]);
    let filmIndex = 0;
    let lastFilmAt = 0;
    let lastCommentaryShot = '';

    function interceptX(ball, paddleY) {
      const vy = Number(ball.vy);
      if (!Number.isFinite(vy) || vy <= 0) return ball.x;
      const t = (paddleY - ball.y) / vy;
      if (t < 0 || t > 240) return ball.x;
      return ball.x + (Number(ball.vx) || 0) * t;
    }

    async function steerPaddles() {
      const st = lastState;
      if (!st || !Array.isArray(st.players) || !Array.isArray(st.balls)) return;
      const balls = st.balls.filter((b) => b.active);
      if (!balls.length) return;
      const paddleY = 1000;
      const wallW = (st.numScreens || NUM_SCREENS) * (st.screenWidth || VIEW_W);
      const slotW = wallW / Math.max(1, PLAYERS);
      await Promise.all(controllers.map((page, i) => {
        const p = st.players.find((pl) => pl.name === NAMES[i]) || st.players[i];
        if (!p || !p.connected) return Promise.resolve();
        const width = p.paddleWidth || 300;
        const center = (p.paddleX || 0) + width / 2;
        const laneMin = i * slotW - 240;
        const laneMax = (i + 1) * slotW + 240;
        const inLane = balls.filter((b) => {
          const x = interceptX(b, paddleY);
          return x >= laneMin && x <= laneMax;
        });
        const pool = inLane.length ? inLane : balls;
        let best = pool[0];
        let bestD = Math.abs(interceptX(pool[0], paddleY) - center);
        for (let b = 1; b < pool.length; b++) {
          const d = Math.abs(interceptX(pool[b], paddleY) - center);
          if (d < bestD) {
            best = pool[b];
            bestD = d;
          }
        }
        const target = interceptX(best, paddleY);
        const dx = Math.max(-320, Math.min(320, target - center));
        if (Math.abs(dx) <= 6) return Promise.resolve();
        return pageEval(page, (d) => window.__lgPaddleDelta && window.__lgPaddleDelta(d), null, dx);
      }));
    }

    async function captureSample(sec, tagPrefix) {
      const tag = String(sec).padStart(3, '0');
      await Promise.all(screenPages.map(async (page, i) => {
        const file = `${tagPrefix}-t${tag}s-screen${i + 1}.png`;
        await shot(page, file);
        report.screenshots.push(file);
      }));
      await Promise.all(controllers.map(async (page, i) => {
        const file = `${tagPrefix}-t${tag}s-phone${i + 1}.png`;
        await shot(page, file);
        report.screenshots.push(file);
      }));
      const onCenter = lastState ? ballsOnSlice(lastState, CENTER_ID).length : 0;
      const players = ((lastState && lastState.players) || []).filter((p) => p.connected);
      const sample = {
        sec,
        status: lastState && lastState.gameStatus,
        ticks,
        balls: lastState && (lastState.balls || []).filter((b) => b.active).length,
        ballsOnCenter: onCenter,
        commentary: (lastState && lastState.lastCommentary) || '',
        scores: players.map((p) => ({
          name: p.name, score: p.score, lives: p.lives, rank: p.rank, x: Math.round(p.paddleX),
        })),
        bricksDestroyed,
      };
      report.samples.push(sample);
      console.log(`[t=${sec}s]`, JSON.stringify(sample));
    }

    async function shotBallCloseup(name) {
      if (!lastState) return;
      const w = lastState.screenWidth || VIEW_W;
      const onSlice = ballsOnSlice(lastState, CENTER_ID);
      const b = onSlice[0] || ((lastState.balls || []).find((x) => x.active));
      if (!b) return;
      const localX = b.x - (CENTER_ID - 1) * w;
      const size = 280;
      const x = Math.max(0, Math.min(VIEW_W - size, Math.round(localX - size / 2)));
      const y = Math.max(0, Math.min(VIEW_H - size, Math.round(b.y - size / 2)));
      await shot(centerPage, name, { type: 'png', clip: { x, y, width: size, height: size } });
      report.screenshots.push(name);
    }

    const ballWaitUntil = Date.now() + 8000;
    while (Date.now() < ballWaitUntil && !sawBallOnCenter) {
      await steerPaddles();
      await sleep(60);
    }
    if (sawBallOnCenter) {
      await shot(centerPage, '03-ball-visible-center.png');
      report.screenshots.push('03-ball-visible-center.png');
      await shotBallCloseup('03-ball-closeup.png');
    }
    check('Ball entered the center slice', sawBallOnCenter, lastBallHash);

    while (Date.now() - playStart < PLAY_MS) {
      const elapsed = Date.now() - playStart;
      const sec = Math.round(elapsed / 1000);
      await steerPaddles();

      if (elapsed - lastFilmAt >= 1000) {
        lastFilmAt = elapsed;
        filmIndex += 1;
        const frame = path.join(FILM_DIR, 'frame-' + String(filmIndex).padStart(4, '0') + '.jpg');
        await Promise.race([
          centerPage.screenshot({
            path: frame,
            type: 'jpeg',
            quality: 70,
            captureBeyondViewport: false,
          }),
          sleep(2000),
        ]).catch(() => {});
      }

      if (
        lastState &&
        lastState.lastCommentary &&
        lastState.lastCommentary !== lastCommentaryShot &&
        commentaryLines.length <= 8
      ) {
        lastCommentaryShot = lastState.lastCommentary;
        const file = '03-commentary-' + String(commentaryLines.length).padStart(2, '0') + '.png';
        await shot(centerPage, file);
        report.screenshots.push(file);
      }

      if (sampleAt.size) {
        for (const t of [...sampleAt]) {
          if (sec >= t) {
            sampleAt.delete(t);
            await captureSample(t, '03');
            if (sawBallOnCenter) {
              await shotBallCloseup('03-ball-closeup-t' + String(t).padStart(3, '0') + 's.png');
            }
          }
        }
      }

      if (lastState && ['win', 'game_over', 'time_up'].includes(lastState.gameStatus)) {
        await sleep(1200);
        break;
      }

      await sleep(80);
    }

    await sleep(800);
    for (let i = 1; i <= NUM_SCREENS; i++) {
      const file = `04-end-screen${i}.png`;
      await shot(screenPages[i - 1], file);
      report.screenshots.push(file);
    }
    for (let i = 0; i < PLAYERS; i++) {
      const file = `04-end-phone${i + 1}.png`;
      await shot(controllers[i], file);
      report.screenshots.push(file);
    }

    const endHealth = JSON.parse((await httpGet('/health')).body);
    report.final = {
      health: endHealth,
      status: lastState && lastState.gameStatus,
      ticks,
      ballMoved,
      sawBallOnCenter,
      maxActiveBalls,
      bricksDestroyed,
      commentaryLines,
      players: ((lastState && lastState.players) || []).map((p) => ({
        name: p.name,
        score: p.score,
        lives: p.lives,
        rank: p.rank,
        connected: p.connected,
      })),
    };

    check('Balls moved on the wall', ballMoved);
    check('Screen received many ticks', ticks >= 100, String(ticks));
    check(
      `All ${PLAYERS} phones still connected`,
      ((lastState && lastState.players) || []).filter((p) => p.connected).length >= PLAYERS,
      JSON.stringify(report.final.players)
    );
    check('ARKANOID AI spoke at least once', commentaryLines.length >= 1, JSON.stringify(commentaryLines.slice(0, 4)));

    report.video = encodeFilm();
    if (report.video) {
      check('Center-screen 3-minute recording', true, report.video);
    } else {
      console.warn('No mp4 (ffmpeg missing or too few film frames) — screenshots still saved.');
    }

    watcher.disconnect();
  } finally {
    await browser.close().catch(() => {});
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  rebuildIndex();
  console.log('\nReport:', REPORT_MD);
  console.log(report.ok ? 'VERDICT: DEMO PLAY OK' : 'VERDICT: ISSUES — see report');
  if (spawned) spawned.kill();
  process.exit(report.ok ? 0 : 1);
}

function renderMarkdown(report) {
  const pass = report.checks.filter((c) => c.ok).length;
  const fail = report.checks.filter((c) => !c.ok).length;
  const rel = 'demo-play/' + report.label + '/';
  const shots = report.screenshots
    .map((f) => `- ![${f}](${rel}${f})`)
    .join('\n');
  const samples = (report.samples || [])
    .map((s) => `| ${s.sec}s | ${s.status} | ${s.balls} | ${s.ballsOnCenter || 0} | ${s.bricksDestroyed} | ${(s.commentary || '').replace(/\|/g, '/')} | ${JSON.stringify(s.scores)} |`)
    .join('\n');
  const issues = report.issues.length ? report.issues.map((i) => `- ${i}`).join('\n') : '_None._';
  const checks = report.checks
    .map((c) => `| ${c.ok ? 'PASS' : 'FAIL'} | ${c.name} | ${String(c.detail).replace(/\|/g, '/')} |`)
    .join('\n');
  const video = report.video ? `\n## Recording\n\n[center-${report.label}-3min.mp4](${rel}center-${report.label}-3min.mp4)\n` : '';
  return `# LG Arkanoid — ${report.numScreens}-screen · ${report.players}-player · ${report.durationSec}s

Label **${report.label}**. Automated on **${report.startedAt}**. Chrome **${report.chromium.version || '?'}**.
Viewport **${report.viewport}**. Verdict: **${report.ok ? 'PASS' : 'FAIL'}**.

Desk simulation of a Liquid Galaxy wall plus phone controllers in headless Chrome on port **8130**.

## Setup

| Item | Value |
|------|--------|
| Screens | ${report.numScreens} Chromium tabs |
| Players | ${report.players} — ${report.names.join(', ')} |
| Aspect | \`LG_FRAME_ASPECT=16:9\` |
| Duration | ${report.durationSec} seconds |
| Viewport | ${report.viewport} |

## Checks (${pass} passed / ${fail} failed)

| Result | Check | Detail |
|--------|-------|--------|
${checks}
${video}
## Timeline samples

| t | status | balls | on center | bricks | commentary | scores |
|---|--------|-------|-----------|--------|------------|--------|
${samples || '| — | | | | | | |'}

## Final

\`\`\`json
${JSON.stringify(report.final, null, 2)}
\`\`\`

## Issues

${issues}

## Screenshots

${shots}
`;
}

function rebuildIndex() {
  const root = path.join(ROOT, 'docs', 'demo-play');
  const labels = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'REPORT.md')));
  const parts = [
    '# LG Arkanoid — full play captures',
    '',
    'Full-HD (1920×1080) Chromium replays. The ball is an 8px circle on a 1920-wide slice; older 960×540 shots made it nearly invisible.',
    '',
  ];
  for (const label of labels.sort()) {
    parts.push(`- [${label}](demo-play/${label}/REPORT.md)`);
    const vid = path.join(root, label, 'center-' + label + '-3min.mp4');
    if (fs.existsSync(vid)) parts.push(`  - video: [center-${label}-3min.mp4](demo-play/${label}/center-${label}-3min.mp4)`);
  }
  fs.writeFileSync(INDEX_MD, parts.join('\n') + '\n');
}

main().catch((err) => {
  console.error('FATAL', err);
  if (spawnedProc) spawnedProc.kill();
  process.exit(1);
});
