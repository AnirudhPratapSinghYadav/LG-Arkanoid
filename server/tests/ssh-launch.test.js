'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const pacman = read('scripts/lib/ssh-pacman.sh');
const pacmanFn = pacman.split('ssh_pacman()')[1] || '';
assert.strictEqual(
  (pacman.match(/ssh_pacman\(\) \{/g) || []).length,
  1,
  'ssh_pacman must be defined once'
);
assert.ok(!/BatchMode|IdentitiesOnly|UserKnownHostsFile/.test(pacmanFn), 'Pacman function must not add extra ssh options');

const asteroids = read('scripts/lib/ssh-asteroids.sh');
const asteroidsFn = asteroids.split('ssh_asteroids()')[1] || '';
assert.ok(asteroidsFn.includes('ssh -Xnf'), 'Password SSH uses Pacman -Xnf so a failed ssh is not reported as launched');
assert.ok(asteroidsFn.includes('sshpass -e'), 'Use sshpass -e, not -p on the command line');
assert.ok(!asteroidsFn.includes('sshpass -p'), 'Password must not be on the argv');
assert.ok(!/sleep 1\s+return 0/.test(asteroidsFn), 'Do not return 0 after backgrounding sshpass');

const parseArgs = read('scripts/lib/parse-open-args.sh');
const framesArm = (parseArgs.split('--frames|--screens)')[1] || parseArgs.split('--frames)')[1] || '').split(';;')[0];
assert.ok(!framesArm.includes('DRY_RUN=1'), '--frames must open Chromium, not print-and-exit');
assert.ok(/--map\|--dry-run/.test(parseArgs) || parseArgs.includes('--map'), 'print-only mode is --map / --dry-run');

const install = read('install.sh');
assert.ok(/git -C .* pull --ff-only/.test(install), 'install.sh must pull an existing clone so testers are not stuck on last week\'s files');

const readme = read('README.md');
assert.ok(!/\bGSoC\b/.test(readme) && !/\bGSOC\b/.test(readme), 'program name is GESOC, not GSoC');
assert.ok(readme.includes('mkdir -p ~/projects'), 'first rig clone must create ~/projects');
assert.ok(/git pull/.test(readme), 'README must tell testers to git pull');

const chrome = read('scripts/lib/chrome-remote.sh');
assert.ok(chrome.includes('export DISPLAY=:0'), 'DISPLAY=:0 like Pacman/Asteroids');
assert.ok(chrome.includes('--start-fullscreen'), 'Pacman/Asteroids use --start-fullscreen');
assert.ok(chrome.includes('chromium-browser'), 'LG images use chromium-browser');
assert.ok(chrome.includes('command -v chromium'), 'slaves may only have chromium');
assert.ok(chrome.includes('slave_chromium_up'), 'ssh -Xnf is not proof Chromium started');
assert.ok(chrome.includes('pgrep -f'), 'slave check looks for a Chromium process on this game port');
assert.ok(
  !/printf '[^']*\/dev\/null/.test(chrome),
  'printf must not pass /dev/null as a second Chromium URL'
);

const open = read('scripts/open-arkanoid.sh');
assert.ok(open.includes('open_one_frame'), 'open script must call the per-frame helper');
assert.ok(!open.includes('${lg:2}'), 'Do not copy Pacman hostname-digit slice numbers');
assert.ok(!/wait_for_health "\$port" \|\| true/.test(open), 'Do not open Chromium if /health fails');
assert.ok(open.includes('wait_for_health'), 'Must wait for /health before SSH');
assert.ok(!/^\s*npm run build\b/m.test(open), 'Must not rebuild Vite on launch (Pacman/Asteroids never do)');
assert.ok(open.includes('print_backup_urls') || open.includes('Backup Chromium'), 'open script must print manual Chromium URLs for each frame');

const wait = read('scripts/lib/wait-health.sh');
assert.ok(wait.includes('seq 1 40'), 'Give pm2 ~20s to answer /health');

const one = read('scripts/lib/open-one-frame.sh');
assert.ok(one.includes('slave_chromium_up'), 'slave launch must check Chromium is running');
assert.ok(one.includes('http://localhost:'), 'lg1 URL is localhost like Pacman');
assert.ok(one.includes('http://lg1:'), 'slave URL is http://lg1:PORT/N like Pacman');
assert.ok(one.includes('ssh -Xnf lg@'), 'log line must show the Pacman ssh');
assert.ok(one.includes("ssh -Xnf lg@$frame 'echo ok'"), 'failed slave must print the Pacman check');
assert.ok(/\[ "\$frame" = "lg1" \]/.test(one), 'lg1 must take the local Chromium branch');
assert.ok(one.includes('local Chromium'), 'lg1 Chromium is local like Asteroids');

assert.ok(asteroidsFn.includes('"lg@$host"'), 'Asteroids ssh must be lg@host, not a bare hostname');
assert.ok(!asteroidsFn.includes('timeout'), 'Do not timeout-kill Asteroids ssh (SIGHUP kills slave Chromium)');

const config = read('server/config.js');
assert.ok(config.includes("ABCDEFGHJKLMNPQRSTUVWXYZ23456789"), 'session codes skip 0/O/1/I');

const sshDart = read('mobile/lib/services/ssh_service.dart');
assert.ok(sshDart.includes('Duration(seconds: 180)'), 'phone launch/close must wait longer than 45s');

const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.scripts['open-wall'], 'npm start must open every wall slice, not only the QR');
assert.ok(pkg.scripts.start.includes('open-wall'), 'npm start launches all local screens');
const localWall = read('scripts/open-local-wall.js');
assert.ok(localWall.includes('127.0.0.1'), 'laptop wall tabs hit Express :8130 so SCREEN_ID is injected');
assert.ok(!/localhost:5173|127\.0\.0\.1:5173/.test(localWall), 'do not open Vite — slices would all look like the center QR');

const frames = read('scripts/lib/frames.sh');
assert.ok(frames.includes('lg_frame_order'), 'left-to-right LG order helper');
assert.ok(!/screen_number=\$\{lg:2\}/.test(frames), 'do not map hostname digit to slice');

const match = read('server/match.js');
assert.ok(match.includes("io.to('screens').emit('lobby_ready'"), 'lobby token must not be a global io.emit');
assert.ok(!/^\s*io\.emit\('lobby_ready'/m.test(match), 'idle sockets must not receive the join code');

const joinHtml = read('web-client/controller.html');
assert.ok(joinHtml.includes('controller-join.js'), 'web paddle must probe /health before Socket.IO');

const { lgFrameOrder, masterSlice } = require('../lgFrameOrder.js');
assert.strictEqual(lgFrameOrder(5)[masterSlice(5) - 1], 'lg1');
assert.strictEqual(lgFrameOrder(12)[masterSlice(12) - 1], 'lg1');

console.log('ssh-launch tests passed');
