'use strict';
/**
 * Deep manual browser audit with screenshots for every instance.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
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
function requirePuppeteer() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'puppeteer-core'),
    path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-core'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return require('puppeteer-core');
}

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const shotDir = path.join(__dirname, 'manual-screenshots');

function httpGetJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(BASE + urlPath, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(shotDir, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('SHOT', name);
  return file;
}

function attachDialogLogger(page, label) {
  page.on('dialog', async (d) => {
    console.log(`DIALOG[${label}]`, d.type(), d.message());
    await d.accept();
  });
  page.on('pageerror', (err) => console.log(`PAGEERROR[${label}]`, err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`CONSOLE[${label}]`, msg.text());
  });
}

async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('timeout: ' + label);
}

async function main() {
  if (fs.existsSync(shotDir)) {
    for (const f of fs.readdirSync(shotDir)) {
      if (f.endsWith('.png') || f.endsWith('.json')) fs.unlinkSync(path.join(shotDir, f));
    }
  } else {
    fs.mkdirSync(shotDir, { recursive: true });
  }

  const findings = [];
  const note = (ok, msg) => {
    findings.push({ ok, msg });
    console.log(`[${ok ? 'OK' : 'ISSUE'}] ${msg}`);
  };

  let health = await httpGetJson('/health');
  note(health.status === 'ok' && health.gameStatus === 'lobby', `Health ${JSON.stringify(health)}`);
  note(health.sessionToken === undefined, 'Health endpoint does not leak sessionToken');
  if (health.gameStatus !== 'lobby') {
    console.log('Server not in lobby — restart required for clean audit');
    process.exit(1);
  }

  const puppeteer = requirePuppeteer();

  // Fetch join code via screen socket (not /health).
  const screenSock = io(BASE, {
    transports: ['websocket', 'polling'],
    query: { screenId: '2' },
    forceNew: true,
    reconnection: false,
  });
  const token = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('session_info timeout')), 8000);
    screenSock.on('session_info', (info) => {
      clearTimeout(t);
      resolve(String(info.sessionToken));
    });
    screenSock.on('connect', () => screenSock.emit('request_session_info'));
    screenSock.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
  screenSock.disconnect();
  note(token.length === 4, `Session token from screen socket: ${token}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: null,
    args: ['--disable-dev-shm-usage', '--no-first-run', '--window-size=1400,800'],
  });

  // --- Screens ---
  const screens = [];
  for (let i = 1; i <= 3; i++) {
    const page = await browser.newPage();
    attachDialogLogger(page, 'screen' + i);
    await page.setViewport({ width: 1400, height: 800 });
    await page.goto(`${BASE}/${i}`, { waitUntil: 'networkidle2', timeout: 45000 });
    screens.push(page);
  }

  // Wait until center screen has QR / session code from session_info
  await waitFor(async () => {
    const meta = await screens[1].evaluate(() => {
      const code = (document.getElementById('qr-session-code') || {}).innerText || '';
      const disp = document.getElementById('qrcode')
        ? getComputedStyle(document.getElementById('qrcode')).display
        : 'missing';
      return { code, disp };
    });
    return meta.disp === 'flex' && meta.code.length === 4;
  }, 15000, 'center QR');

  for (let i = 0; i < 3; i++) {
    await shot(screens[i], `01-lobby-screen${i + 1}.png`);
  }
  const qrMeta = await screens[1].evaluate(() => ({
    code: document.getElementById('qr-session-code').innerText,
    display: getComputedStyle(document.getElementById('qrcode')).display,
  }));
  note(qrMeta.code === token, `Center QR code=${qrMeta.code} expected=${token}`);

  // --- Controllers ---
  const controllers = [];
  const names = ['Alpha', 'Bravo'];
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage();
    attachDialogLogger(page, 'ctrl' + (i + 1));
    await page.setViewport({ width: 420, height: 860 });
    await page.goto(`${BASE}/controller`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(500);
    await page.evaluate((t, n) => {
      document.getElementById('tokenInput').value = t;
      document.getElementById('nameInput').value = n;
    }, token, names[i]);
    await shot(page, `02-controller${i + 1}-join-form.png`);
    await page.evaluate(() => joinGame());
    await waitFor(async () => page.evaluate(() => document.getElementById('gameArea').style.display === 'flex'), 10000, 'ctrl join ' + (i + 1));
    const joined = await page.evaluate(() => ({
      label: document.getElementById('hudPlayerLabel').innerText,
      status: document.getElementById('hudStatus').innerText.replace(/\s+/g, ' ').trim(),
      host: document.getElementById('hostControls').style.display,
    }));
    note(true, `Controller ${i + 1} joined ${JSON.stringify(joined)}`);
    controllers.push(page);
    await shot(page, `03-controller${i + 1}-in-lobby.png`);
  }

  await sleep(1000);
  await shot(screens[0], '04-lobby-left-players.png');
  await shot(screens[1], '04-lobby-center-players.png');
  await shot(screens[2], '04-lobby-right-players.png');

  // Start match from host controller
  await waitFor(async () => controllers[0].evaluate(() => document.getElementById('hostControls').style.display !== 'none'), 8000, 'host controls');
  await controllers[0].evaluate(() => startMatch());
  note(true, 'Host startMatch() called');

  await waitFor(async () => (await httpGetJson('/health')).gameStatus === 'playing', 12000, 'playing');
  note(true, 'Match is playing');
  await sleep(2000);

  for (let i = 0; i < 3; i++) await shot(screens[i], `05-playing-screen${i + 1}.png`);
  await shot(controllers[0], '05-playing-controller1.png');
  await shot(controllers[1], '05-playing-controller2.png');

  // Helper socket listens for commentary
  const helper = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('helper timeout')), 8000);
    helper.on('connect', () => { clearTimeout(t); resolve(); });
  });
  const commentaryEvents = [];
  helper.on('commentary', (d) => {
    commentaryEvents.push(d);
    console.log('COMMENTARY', JSON.stringify(d));
  });

  // Play ~50s with paddle moves
  const end = Date.now() + 50000;
  let dir = 1;
  while (Date.now() < end) {
    dir *= -1;
    for (const c of controllers) {
      await c.evaluate((d) => {
        if (socket && socket.connected) {
          socket.emit('paddle_move', {
            deltaX: d * 140,
            timestamp: Date.now(),
            nonce: Math.random().toString(36).slice(2),
          });
        }
      }, dir);
    }
    await sleep(90);
  }

  const ctrlHud = await Promise.all(controllers.map((p, idx) => p.evaluate((i) => ({
    i,
    score: document.getElementById('scoreVal').innerText,
    lives: document.getElementById('livesVal').innerText,
    rank: document.getElementById('rankVal').innerText,
    timer: document.getElementById('timerVal').innerText,
    commentary: document.getElementById('commentaryText').innerText,
    commentaryActive: document.getElementById('commentaryBar').classList.contains('active'),
    ping: document.getElementById('hudPing').innerText,
  }), idx + 1)));
  note(ctrlHud.some((h) => h.score !== '00000' || Number(h.lives) < 3 || commentaryEvents.length > 0),
    `HUD after play: ${JSON.stringify(ctrlHud)}`);
  note(commentaryEvents.length > 0, `Commentary events: ${JSON.stringify(commentaryEvents).slice(0, 800)}`);

  const screenProbe = await screens[2].evaluate(() => {
    const game = window.__lgGame || (typeof Phaser !== 'undefined' && Phaser.GAMES && Phaser.GAMES[0]);
    const scene = game && game.scene && game.scene.scenes && game.scene.scenes[0];
    const st = scene && scene.currentState;
    return {
      status: st && st.gameStatus,
      players: st && (st.players || []).map((p) => ({ name: p.name, score: p.score, lives: p.lives, rank: p.rank })),
      lastCommentary: st && st.lastCommentary,
      activeBalls: st && (st.balls || []).filter((b) => b.active).length,
      hudText: scene && scene.hudText ? String(scene.hudText.text).slice(0, 240) : '',
      geminiText: scene && scene.geminiText ? String(scene.geminiText.text).slice(0, 160) : '',
      geminiVisible: !!(scene && scene.geminiText && scene.geminiText.visible),
      leaderboard: scene && scene.leaderboardTexts
        ? scene.leaderboardTexts.map((t) => t && t.text).filter(Boolean)
        : [],
    };
  });
  note(!!screenProbe.players, `Screen3 probe ${JSON.stringify(screenProbe)}`);

  await shot(screens[0], '06-mid-screen1-hud.png');
  await shot(screens[1], '06-mid-screen2-center.png');
  await shot(screens[2], '06-mid-screen3-scores.png');
  await shot(controllers[0], '06-mid-controller1.png');
  await shot(controllers[1], '06-mid-controller2.png');

  // If commentary still missing, keep playing until life lost or 40s more
  if (commentaryEvents.length === 0) {
    console.log('No commentary yet — extending play to force life_lost…');
    const end2 = Date.now() + 40000;
    while (Date.now() < end2 && commentaryEvents.length === 0) {
      dir *= -1;
      for (const c of controllers) {
        await c.evaluate((d) => {
          if (socket && socket.connected) {
            socket.emit('paddle_move', {
              deltaX: d * 200,
              timestamp: Date.now(),
              nonce: Math.random().toString(36).slice(2),
            });
          }
        }, dir);
      }
      await sleep(80);
    }
  }

  note(commentaryEvents.length > 0, `Commentary final count=${commentaryEvents.length} last=${JSON.stringify(commentaryEvents.slice(-1)[0] || null)}`);

  // Capture commentary UI if active
  for (const [idx, c] of controllers.entries()) {
    await c.evaluate(() => {
      const bar = document.getElementById('commentaryBar');
      const text = document.getElementById('commentaryText');
      if (window.__lastCommentaryText) {
        text.innerText = window.__lastCommentaryText;
        bar.classList.add('active');
      }
    });
  }
  // Wire live commentary into DOM was already in controller.js — just screenshot
  await shot(controllers[0], '07-controller1-scores-commentary.png');
  await shot(controllers[1], '07-controller2-scores-commentary.png');
  await shot(screens[2], '07-screen3-leaderboard-commentary.png');
  await shot(screens[0], '07-screen1-live-hud.png');

  const endHealth = await httpGetJson('/health');
  const report = {
    token,
    findings,
    commentaryEvents,
    ctrlHud,
    screenProbe,
    endHealth,
    screenshots: fs.readdirSync(shotDir).filter((f) => f.endsWith('.png')),
  };
  fs.writeFileSync(path.join(shotDir, 'audit-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== AUDIT COMPLETE ===');
  console.log('OK:', findings.filter((f) => f.ok).length, 'ISSUE:', findings.filter((f) => !f.ok).length);
  findings.filter((f) => !f.ok).forEach((f) => console.log(' -', f.msg));

  helper.disconnect();
  await sleep(1500);
  await browser.close();
  process.exit(findings.some((f) => !f.ok) ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
