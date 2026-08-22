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
assert.ok(asteroidsFn.includes('ssh -tXn'), 'Asteroids ssh must be ssh -tXn host');
assert.ok(asteroidsFn.includes('sshpass -e'), 'Use sshpass -e, not -p on the command line');
assert.ok(!asteroidsFn.includes('sshpass -p'), 'Password must not be on the argv');

const chrome = read('scripts/lib/chrome-remote.sh');
assert.ok(chrome.includes('export DISPLAY=:0'), 'DISPLAY=:0 like Pacman/Asteroids');
assert.ok(chrome.includes('--start-fullscreen'), 'Pacman/Asteroids use --start-fullscreen');
assert.ok(
  !/printf '[^']*\/dev\/null/.test(chrome),
  'printf must not pass /dev/null as a second Chromium URL'
);

const open = read('scripts/open-arkanoid.sh');
assert.ok(open.includes('open_one_frame'), 'open script must call the per-frame helper');
assert.ok(!open.includes('${lg:2}'), 'Do not copy Pacman hostname-digit slice numbers');
assert.ok(!/wait_for_health "\$port" \|\| true/.test(open), 'Do not open Chromium if /health fails');
assert.ok(open.includes('wait_for_health'), 'Must wait for /health before SSH');

const wait = read('scripts/lib/wait-health.sh');
assert.ok(wait.includes('seq 1 40'), 'Give pm2 ~20s to answer /health');

const one = read('scripts/lib/open-one-frame.sh');
assert.ok(one.includes('http://localhost:'), 'lg1 URL is localhost like Pacman');
assert.ok(one.includes('http://lg1:'), 'slave URL is http://lg1:PORT/N like Pacman');
assert.ok(one.includes('ssh -Xnf lg@'), 'log line must show the Pacman ssh');
assert.ok(one.includes("ssh -Xnf lg@$frame 'echo ok'"), 'failed slave must print the Pacman check');

console.log('ssh-launch tests passed');
