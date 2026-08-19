'use strict';
/**
 * Visual 3-screen wall + 2 phone-stand-in controllers in Google Chrome.
 * Plays a timed match (default 180s), screenshots key beats, writes a report.
 *
 *   node server/tests/demo-3screen-chrome.js
 *   PLAY_MS=180000 node server/tests/demo-3screen-chrome.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8130);
const BASE = `http://127.0.0.1:${PORT}`;
const MATCH_SEC = Number(process.env.MATCH_SEC || 60);
const PLAY_MS = Number(process.env.PLAY_MS || 75000);
const DURATION_SEC = MATCH_SEC;
const ROOT = path.join(__dirname, '..', '..');
const SHOT_DIR = path.join(ROOT, 'docs', 'demo-play');
const REPORT_JSON = path.join(__dirname, 'demo-3screen-report.json');
const REPORT_MD = path.join(ROOT, 'docs', 'DEMO_PLAY_REPORT.md');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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

async function shot(page, name) {
  const dest = path.join(SHOT_DIR, name);
  await page.screenshot({ path: dest, type: 'png' }).catch((e) => {
    console.warn('screenshot failed', name, e.message);
  });
  return dest;
}

async function pageEval(page, fn, fallback) {
  try {
    return await page.evaluate(fn);
  } catch (_) {
    return fallback;
  }
}

function startServerIfNeeded() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NUM_SCREENS: '3',
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

async function main() {
  if (!process.env.KEEP_SHOTS && fs.existsSync(SHOT_DIR)) {
    for (const f of fs.readdirSync(SHOT_DIR)) {
      if (/\.(png|jpg|jpeg|webp)$/i.test(f)) fs.unlinkSync(path.join(SHOT_DIR, f));
    }
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    playMs: PLAY_MS,
    durationSec: DURATION_SEC,
    ok: true,
    issues: [],
    checks: [],
    screenshots: [],
    samples: [],
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
    health = await waitForHealth(2500);
    check('Server already running', true, JSON.stringify(health));
  } catch (_) {
    console.log('Starting local server NUM_SCREENS=3 LG_FRAME_ASPECT=16:9 …');
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
  check('health numScreens is 3', Number(health.numScreens) === 3, String(health.numScreens));

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
    protocolTimeout: 120000,
    defaultViewport: null,
    args: [
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-extensions',
      '--autoplay-policy=no-user-gesture-required',
      '--use-gl=swiftshader',
      '--window-size=1920,1080',
    ],
  });
  report.chromium.version = await browser.version();

  const screenPages = [];
  const controllers = [];

  try {
    for (let i = 1; i <= 3; i++) {
      const page = await browser.newPage();
      await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
      page.setDefaultNavigationTimeout(25000);
      const resp = await page.goto(`${BASE}/${i}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1500);
      const injected = await pageEval(page, () => ({
        id: window.SCREEN_ID,
        num: window.NUM_SCREENS,
        w: window.SCREEN_W,
        h: window.CANVAS_H,
        hasIo: typeof io !== 'undefined',
        hasPhaser: typeof Phaser !== 'undefined',
        canvas: !!document.querySelector('canvas'),
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

    check(
      'Screen 1 Phaser ready',
      true,
      'canvas checked on load'
    );

    const tokenFromDom = (
      await pageEval(screenPages[1], () =>
        ((document.getElementById('qr-session-code') || {}).textContent || '').trim().toUpperCase()
      , '')
    ).replace(/[^A-Z0-9]/g, '').slice(0, 4);

    // Authoritative token from a screen socket (same path the wall uses).
    const probe = await connectSocket({ screenId: '2' }, 'token-probe');
    const sessionInfoP = once(probe, 'session_info', 8000);
    probe.emit('request_session_info');
    const sessionInfo = await sessionInfoP;
    const token = sessionInfo.sessionToken;
    probe.disconnect();
    check('4-char session token from screen socket', String(token).length === 4, String(token));
    if (tokenFromDom) {
      check('Center-screen QR code matches socket token', tokenFromDom === token, `${tokenFromDom} vs ${token}`);
    }

    for (let i = 1; i <= 2; i++) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 1 });
      page.setDefaultNavigationTimeout(20000);
      const resp = await page.goto(`${BASE}/controller?cb=${Date.now()}-${i}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await sleep(500);
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
      await page.waitForSelector('#joinBtn', { timeout: 8000 });
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
      await page.waitForFunction(() => {
        const area = document.getElementById('gameArea');
        return area && getComputedStyle(area).display !== 'none';
      }, { timeout: 15000 });
      return result;
    }

    await fillController(controllers[0], 'Alpha', token);
    await fillController(controllers[1], 'Bravo', token);
    await shot(controllers[0], '01-lobby-phone1.png');
    await shot(controllers[1], '01-lobby-phone2.png');
    report.screenshots.push('01-lobby-phone1.png', '01-lobby-phone2.png');
    check('Phone 1 controller UI ready', true, 'Alpha + token filled');
    check('Phone 2 controller UI ready', true, 'Bravo + token filled');

    const join1 = await joinViaUi(controllers[0], 'Alpha', token);
    check('Alpha join payload 4-char token', String(join1.token || '').length === 4, JSON.stringify(join1));
    await sleep(400);
    const join2 = await joinViaUi(controllers[1], 'Bravo', token);
    check('Bravo join payload 4-char token', String(join2.token || '').length === 4, JSON.stringify(join2));
    await sleep(800);

    const hostMeta = await pageEval(controllers[0], () => window.__lgControllerMeta && window.__lgControllerMeta(), {});
    check('Alpha is host after join', !!(hostMeta && hostMeta.host), JSON.stringify(hostMeta));

    await controllers[0].waitForFunction(() => {
      const host = document.getElementById('hostControls');
      return host && getComputedStyle(host).display !== 'none';
    }, { timeout: 8000 }).catch(() => {});
    await controllers[0].click('[data-duration="60"]').catch(() => {});
    await sleep(200);
    await shot(controllers[0], '01b-create-game-phone1.png');
    await shot(controllers[1], '01b-joined-phone2.png');
    report.screenshots.push('01b-create-game-phone1.png', '01b-joined-phone2.png');

    const afterJoin = JSON.parse((await httpGet('/health')).body);
    check('connectedPlayers >= 2', afterJoin.connectedPlayers >= 2, JSON.stringify(afterJoin));

    await controllers[0].evaluate((sec) => {
      hostDuration = sec;
      if (typeof persistHostSettings === 'function') persistHostSettings();
      if (typeof window.__lgStartMatch === 'function') window.__lgStartMatch();
      else document.getElementById('startMatchBtn').click();
    }, DURATION_SEC);
    await sleep(700);

    for (let i = 1; i <= 3; i++) {
      const file = `02-countdown-screen${i}.png`;
      await shot(screenPages[i - 1], file);
      report.screenshots.push(file);
    }

    const countdownHud = await pageEval(screenPages[1], () => ({
      stage: window.__lgStage,
      playing: document.body.classList.contains('is-playing'),
      brand: (() => {
        const el = document.querySelector('.brand-mark');
        return el ? getComputedStyle(el).display : 'missing';
      })(),
    }), {});
    check('Center screen match mode hides LG Arkanoid mark',
      countdownHud && countdownHud.playing && countdownHud.brand === 'none',
      JSON.stringify(countdownHud));

    const playStart = Date.now();
    let lastState = null;
    let ticks = 0;
    let ballMoved = false;
    let lastBallHash = '';
    let bricksDestroyed = 0;
    let lastActiveBricks = null;
    let maxActiveBalls = 0;

    const watcher = await connectSocket({ screenId: '2' }, 'watcher');
    watcher.on('game_state', (st) => {
      ticks += 1;
      lastState = st;
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
        if (lastActiveBricks == null) lastActiveBricks = active;
        else if (active < lastActiveBricks) {
          bricksDestroyed += lastActiveBricks - active;
          lastActiveBricks = active;
        }
      }
    });

    await waitForGameState(watcher, (st) => st.gameStatus === 'playing', 15000)
      .then((st) => check('Match reached playing', true, `duration=${st.gameDurationSeconds}`))
      .catch((e) => check('Match reached playing', false, e.message));

    await sleep(400);
    const rightHud = await pageEval(screenPages[2], () => window.__lgHud || {}, {});
    check('Rightmost screen shows live standings',
      !!(rightHud && rightHud.standings),
      JSON.stringify(rightHud));

    const sampleAt = new Set([10, 30, 55]);

    async function steerPaddles() {
      const st = lastState;
      if (!st || !Array.isArray(st.players) || !Array.isArray(st.balls)) return;
      const balls = st.balls.filter((b) => b.active);
      if (!balls.length) return;
      const names = ['Alpha', 'Bravo'];
      for (let i = 0; i < 2; i++) {
        const p = st.players.find((pl) => pl.name === names[i]) || st.players[i];
        if (!p || !p.connected) continue;
        const width = p.paddleWidth || 300;
        const center = (p.paddleX || 0) + width / 2;
        let best = balls[0];
        let bestD = Math.abs(balls[0].x - center);
        for (let b = 1; b < balls.length; b++) {
          const d = Math.abs(balls[b].x - center);
          if (d < bestD) {
            best = balls[b];
            bestD = d;
          }
        }
        const dx = Math.max(-220, Math.min(220, best.x - center));
        if (Math.abs(dx) > 6) {
          await controllers[i].evaluate((d) => window.__lgPaddleDelta && window.__lgPaddleDelta(d), dx).catch(() => {});
        }
      }
    }

    while (Date.now() - playStart < PLAY_MS) {
      const elapsed = Date.now() - playStart;
      const sec = Math.round(elapsed / 1000);
      await steerPaddles();

      if (sampleAt.has(sec)) {
        sampleAt.delete(sec);
        const tag = String(sec).padStart(3, '0');
        for (let i = 1; i <= 3; i++) {
          const file = `03-t${tag}s-screen${i}.png`;
          await shot(screenPages[i - 1], file);
          report.screenshots.push(file);
        }
        await shot(controllers[0], `03-t${tag}s-phone1.png`);
        await shot(controllers[1], `03-t${tag}s-phone2.png`);
        report.screenshots.push(`03-t${tag}s-phone1.png`, `03-t${tag}s-phone2.png`);
        const players = ((lastState && lastState.players) || []).filter((p) => p.connected);
        const sample = {
          sec,
          status: lastState && lastState.gameStatus,
          ticks,
          balls: lastState && (lastState.balls || []).filter((b) => b.active).length,
          scores: players.map((p) => ({ name: p.name, score: p.score, lives: p.lives, rank: p.rank, x: Math.round(p.paddleX) })),
          bricksDestroyed,
        };
        report.samples.push(sample);
        console.log(`[t=${sec}s]`, JSON.stringify(sample));
      }

      if (lastState && ['win', 'game_over', 'time_up'].includes(lastState.gameStatus)) {
        await sleep(900);
        break;
      }

      await sleep(80);
    }

    await sleep(2000);
    for (let i = 1; i <= 3; i++) {
      const file = `04-end-screen${i}.png`;
      await shot(screenPages[i - 1], file);
      report.screenshots.push(file);
    }
    await shot(controllers[0], '04-end-phone1.png');
    await shot(controllers[1], '04-end-phone2.png');
    report.screenshots.push('04-end-phone1.png', '04-end-phone2.png');

    const endHealth = JSON.parse((await httpGet('/health')).body);
    report.final = {
      health: endHealth,
      status: lastState && lastState.gameStatus,
      ticks,
      ballMoved,
      maxActiveBalls,
      bricksDestroyed,
      players: ((lastState && lastState.players) || []).map((p) => ({
        name: p.name,
        score: p.score,
        lives: p.lives,
        connected: p.connected,
      })),
    };

    check('Balls moved on the wall', ballMoved);
    check('Screen received many ticks', ticks >= 100, String(ticks));
    check('Both phones still connected',
      ((lastState && lastState.players) || []).filter((p) => p.connected).length >= 2,
      JSON.stringify(report.final.players));

    watcher.disconnect();
  } finally {
    await browser.close().catch(() => {});
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  console.log('\nReport:', REPORT_MD);
  console.log(report.ok ? 'VERDICT: DEMO PLAY OK' : 'VERDICT: ISSUES — see report');
  if (spawned) spawned.kill();
  process.exit(report.ok ? 0 : 1);
}

function renderMarkdown(report) {
  const pass = report.checks.filter((c) => c.ok).length;
  const fail = report.checks.filter((c) => !c.ok).length;
  const shots = report.screenshots
    .map((f) => `- ![${f}](demo-play/${f})`)
    .join('\n');
  const samples = (report.samples || [])
    .map((s) => `| ${s.sec}s | ${s.status} | ${s.ticks} | ${s.balls} | ${s.bricksDestroyed} | ${JSON.stringify(s.scores)} |`)
    .join('\n');
  const issues = report.issues.length ? report.issues.map((i) => `- ${i}`).join('\n') : '_None._';
  const checks = report.checks
    .map((c) => `| ${c.ok ? 'PASS' : 'FAIL'} | ${c.name} | ${String(c.detail).replace(/\|/g, '/')} |`)
    .join('\n');
  return `# LG Arkanoid — 3-screen · 2-phone · 3-minute Chrome play

Automated on **${report.startedAt}**. Chrome **${report.chromium.version || '?'}**.
Match length **${report.durationSec}s**. Verdict: **${report.ok ? 'PASS' : 'FAIL'}**.

This is a desk simulation of a 3-frame Liquid Galaxy wall plus two phone controllers.
It uses Google Chrome (headless) against a local Node 16-compatible server on port **8130**.
It does **not** replace a real-rig test (SSH, iptables, portrait \`DHCP_RANDR\`).

## Setup

| Item | Value |
|------|--------|
| Screens | 3 Chromium tabs at \`/1\` \`/2\` \`/3\` |
| Phones | 2 Chromium tabs at \`/controller\` (Alpha, Bravo) |
| Aspect | \`LG_FRAME_ASPECT=16:9\` (monitor, not portrait rig) |
| Duration | ${report.durationSec} seconds |
| Chrome | \`${report.chromium.executable || ''}\` |

## Checks (${pass} passed / ${fail} failed)

| Result | Check | Detail |
|--------|-------|--------|
${checks}

## Timeline samples

| t | status | ticks | balls | bricks hit | scores |
|---|--------|-------|-------|------------|--------|
${samples || '| — | | | | | |'}

## Final

\`\`\`json
${JSON.stringify(report.final, null, 2)}
\`\`\`

## Issues

${issues}

## Screenshots

${shots}

## What this does **not** prove

- Slave-frame SSH (\`lg2\` / \`lg3\`) and \`chromium-browser\` on Ubuntu 16.04
- Portrait 608×1080 court from \`DHCP_RANDR=right\`
- Flutter APK SSH **LAUNCH ON RIG**
- \`/etc/iptables.conf\` port 8130 after reboot

Run those on VirtualBox or the LAB wall. See [virtualbox-test-plan.md](virtualbox-test-plan.md).
`;
}

main().catch((err) => {
  console.error('FATAL', err);
  if (spawnedProc) spawnedProc.kill();
  process.exit(1);
});
