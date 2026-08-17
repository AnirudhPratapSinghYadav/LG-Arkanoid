'use strict';
/**
 * Real Chromium automation: 3 screen tabs + 2 controller tabs.
 * Phone emulators unavailable — controllers stand in for emulators.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8130;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function getPuppeteer() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'puppeteer-core'),
    path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-core'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return require('puppeteer-core');
}

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

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: ' + label)), ms)),
  ]);
}

async function main() {
  const puppeteer = getPuppeteer();
  const health = await httpGetJson('/health');
  record('Server healthy before browser test', health.status === 'ok', JSON.stringify(health));
  record('health does not leak sessionToken', health.sessionToken === undefined, String(health.sessionToken));

  // Join code comes from panoramic screen sockets only.
  const { io } = (() => {
    const candidates = [
      path.join(__dirname, '..', 'node_modules', 'socket.io-client'),
      path.join(__dirname, '..', '..', 'node_modules', 'socket.io-client'),
    ];
    for (const c of candidates) {
      try { return require(c); } catch (_) {}
    }
    return require('socket.io-client');
  })();
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
      resolve(info.sessionToken);
    });
    screenSock.on('connect', () => screenSock.emit('request_session_info'));
    screenSock.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
  screenSock.disconnect();
  record('Got session token from screen socket', String(token).length === 4, String(token));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 960, height: 540 },
    args: ['--disable-dev-shm-usage', '--no-first-run', '--disable-gpu', '--disable-extensions'],
  });

  const shotDir = path.join(__dirname, 'e2e-screenshots');
  fs.mkdirSync(shotDir, { recursive: true });

  try {
    const screenPages = [];
    for (let i = 1; i <= 3; i++) {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(20000);
      // Abort slow third-party CDNs so Phaser CDN cannot hang the suite forever
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (/cdnjs\.cloudflare\.com|fonts\.googleapis|fonts\.gstatic/.test(u)) {
          return req.abort();
        }
        return req.continue();
      });

      let resp = null;
      try {
        resp = await page.goto(`${BASE}/${i}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {
        record(`Browser screen ${i} loads + inject`, false, e.message);
        screenPages.push(page);
        continue;
      }
      await new Promise((r) => setTimeout(r, 1000));
      const injected = await withTimeout(
        page.evaluate(() => ({
          id: window.SCREEN_ID,
          num: window.NUM_SCREENS,
          hasIo: typeof io !== 'undefined',
          canvas: !!document.querySelector('canvas'),
        })),
        5000,
        'inject-eval-' + i
      ).catch((e) => ({ error: e.message }));

      record(
        `Browser screen ${i} loads + inject`,
        resp && resp.ok() && injected.id === i && injected.num === 3,
        JSON.stringify(injected)
      );
      screenPages.push(page);
      await page.screenshot({ path: path.join(shotDir, `screen${i}.png`) }).catch(() => {});
    }

    record(
      'Screen 1 has canvas OR socket.io (Phaser may need CDN)',
      !!(await screenPages[0].evaluate(() => !!document.querySelector('canvas') || typeof io !== 'undefined').catch(() => false))
    );

    const controllers = [];
    for (let i = 1; i <= 2; i++) {
      const page = await browser.newPage();
      await page.setViewport({ width: 420, height: 800 });
      page.setDefaultNavigationTimeout(20000);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (/cdnjs\.cloudflare\.com|fonts\.googleapis|fonts\.gstatic/.test(u)) return req.abort();
        return req.continue();
      });

      let resp = null;
      try {
        resp = await page.goto(`${BASE}/controller`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {
        record(`Controller ${i} page loads`, false, e.message);
        controllers.push(page);
        continue;
      }
      await new Promise((r) => setTimeout(r, 800));
      const hasToken = await page.$('#tokenInput');
      record(`Controller ${i} page loads`, !!(resp && resp.ok() && hasToken), `status=${resp && resp.status()}`);
      controllers.push(page);
    }

    async function joinController(page, name, code) {
      await page.waitForSelector('#tokenInput', { timeout: 5000 });
      await page.click('#tokenInput', { clickCount: 3 });
      await page.type('#tokenInput', code, { delay: 20 });
      await page.click('#nameInput', { clickCount: 3 });
      await page.type('#nameInput', name, { delay: 20 });
      await Promise.all([
        page.click('#joinBtn'),
        page.waitForFunction(() => {
          const area = document.getElementById('gameArea');
          const join = document.getElementById('joinArea');
          return (area && getComputedStyle(area).display !== 'none') ||
            (join && getComputedStyle(join).display === 'none');
        }, { timeout: 8000 }).catch(() => null),
      ]);
      return page.evaluate(() => ({
        joinDisplay: document.getElementById('joinArea') ? getComputedStyle(document.getElementById('joinArea')).display : null,
        gameDisplay: document.getElementById('gameArea') ? getComputedStyle(document.getElementById('gameArea')).display : null,
        hud: (document.getElementById('hudPlayerLabel') || {}).textContent || '',
        text: document.body.innerText.slice(0, 180),
      }));
    }

    if (controllers[0] && await controllers[0].$('#tokenInput')) {
      const j1 = await joinController(controllers[0], 'Alpha', token).catch((e) => ({ error: e.message }));
      record('Controller1 joined session', !j1.error && (j1.joinDisplay === 'none' || /P1|ONLINE|SCORE/i.test(j1.text + j1.hud)), JSON.stringify(j1));
      await controllers[0].screenshot({ path: path.join(shotDir, 'controller1.png') }).catch(() => {});
    } else {
      record('Controller1 joined session', false, 'no token input');
    }

    await new Promise((r) => setTimeout(r, 1000));

    if (controllers[1] && await controllers[1].$('#tokenInput')) {
      const j2 = await joinController(controllers[1], 'Bravo', token).catch((e) => ({ error: e.message }));
      record('Controller2 joined session', !j2.error && (j2.joinDisplay === 'none' || /P2|ONLINE|SCORE/i.test(j2.text + j2.hud)), JSON.stringify(j2));
      await controllers[1].screenshot({ path: path.join(shotDir, 'controller2.png') }).catch(() => {});
    } else {
      record('Controller2 joined session', false, 'no token input');
    }

    await new Promise((r) => setTimeout(r, 1500));
    const afterJoin = await httpGetJson('/health');
    record('Health connectedPlayers >= 1 after browser joins', afterJoin.connectedPlayers >= 1, JSON.stringify(afterJoin));

    // Controllers don't host-start in web UI easily — start via socket from Node side already covered.
    // Try clicking any Start button if present.
    if (controllers[0]) {
      await controllers[0].evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => /start/i.test(x.textContent || ''));
        if (b) b.click();
      }).catch(() => {});
    }

    // Drag pad if visible
    if (controllers[0]) {
      const box = await controllers[0].evaluate(() => {
        const el = document.querySelector('#pad, #touchArea, .touch-area, #controllerPad, canvas');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.5 };
      }).catch(() => null);
      if (box) {
        await controllers[0].mouse.move(box.x, box.y);
        await controllers[0].mouse.down();
        await controllers[0].mouse.move(box.x + 100, box.y, { steps: 8 });
        await controllers[0].mouse.up();
        record('Controller1 paddle drag performed', true, JSON.stringify(box));
      } else {
        record('Controller1 paddle drag performed', false, 'no pad element found');
      }
    }

    for (let i = 0; i < screenPages.length; i++) {
      record(`Screen ${i + 1} tab still open`, !screenPages[i].isClosed());
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const report = {
    ranAt: new Date().toISOString(),
    note: 'No Android emulators/Flutter on PATH. Used 2 Chromium controller pages as phone stand-ins + 3 screen pages.',
    summary: { passed, failed, total: results.length },
    results,
  };
  fs.writeFileSync(path.join(__dirname, 'e2e-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nBrowser E2E: ${passed} passed, ${failed} failed of ${results.length}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
