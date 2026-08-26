'use strict';

const assert = require('assert');
const path = require('path');
const { buildControllerJoinUrl, parseJoinInput } = require(path.join(__dirname, '..', 'joinUrl.js'));

const url = buildControllerJoinUrl('10.11.77.106', 8130, 'cata');
assert.strictEqual(url, 'http://10.11.77.106:8130/controller?c=CATA');

const fromUrl = parseJoinInput(url);
assert.ok(fromUrl);
assert.strictEqual(fromUrl.ip, '10.11.77.106');
assert.strictEqual(fromUrl.port, '8130');
assert.strictEqual(fromUrl.token, 'CATA');

const legacy = parseJoinInput('LGARK|10.0.0.5|8130|Ab12');
assert.strictEqual(legacy.ip, '10.0.0.5');
assert.strictEqual(legacy.token, 'AB12');

const pasted = parseJoinInput('http://10.0.0.5:8130/controller');
assert.strictEqual(pasted.ip, '10.0.0.5');
assert.strictEqual(pasted.port, '8130');

const bare = parseJoinInput('192.168.1.42');
assert.strictEqual(bare.ip, '192.168.1.42');
assert.strictEqual(bare.port, '8130');

const lg1 = parseJoinInput('http://lg1:8130/controller?c=ZZZZ');
assert.ok(lg1.warning);
assert.strictEqual(lg1.ip, 'lg1');

const loop = parseJoinInput('http://127.0.0.1:8130/controller?c=ABCD');
assert.ok(!loop.warning);
assert.ok(loop.hint);
assert.strictEqual(loop.ip, '127.0.0.1');

const emu = parseJoinInput('http://10.0.2.2:8130/controller?c=CATA');
assert.ok(!emu.warning);
assert.ok(emu.hint);
assert.ok(/10\.0\.2\.2/.test(emu.hint));
assert.strictEqual(emu.ip, '10.0.2.2');

assert.strictEqual(buildControllerJoinUrl('', 8130, 'ABCD'), '');
console.log('join-url tests passed');
