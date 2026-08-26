'use strict';
/**
 * After the match process answers /health, open every wall slice in the
 * default browser: /1 left … /N right. Laptop testers used to open one tab
 * and only see the center QR (master). Express on 8130 injects SCREEN_ID;
 * do not open Vite :5173.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', 'server', '.env');
  let text = '';
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch (_) {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
  }
}

loadDotEnv();

const PORT = Number.parseInt(process.env.PORT || '8130', 10);
const NUM = Math.max(1, Math.min(12, Number.parseInt(process.env.NUM_SCREENS || '3', 10) || 3));

function healthOk() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openUrl(url) {
  const cmd = process.platform === 'win32'
    ? `cmd /c start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.error('Could not open', url, err.message);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (await healthOk()) {
      ready = true;
      break;
    }
    await sleep(250);
  }
  if (!ready) {
    console.error(`No /health on :${PORT} yet. Open these yourself:`);
    for (let s = 1; s <= NUM; s++) {
      console.error(`  http://127.0.0.1:${PORT}/${s}`);
    }
    process.exit(0);
  }
  for (let s = 1; s <= NUM; s++) {
    const url = `http://127.0.0.1:${PORT}/${s}`;
    console.log(`Opening wall slice ${s}/${NUM}  ${url}`);
    openUrl(url);
    await sleep(500);
  }
  console.log(`Opened ${NUM} screens. QR is on the center tab (/${Math.ceil(NUM / 2)}).`);
})();
