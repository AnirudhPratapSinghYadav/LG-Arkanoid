'use strict';

const assert = require('assert');
const { lgFrameOrder, masterSlice, qrSlices } = require('../lgFrameOrder.js');

const expected = {
  1: ['lg1'],
  3: ['lg3', 'lg1', 'lg2'],
  5: ['lg4', 'lg5', 'lg1', 'lg2', 'lg3'],
  7: ['lg5', 'lg6', 'lg7', 'lg1', 'lg2', 'lg3', 'lg4'],
  9: ['lg6', 'lg7', 'lg8', 'lg9', 'lg1', 'lg2', 'lg3', 'lg4', 'lg5'],
  12: ['lg8', 'lg9', 'lg10', 'lg11', 'lg12', 'lg1', 'lg2', 'lg3', 'lg4', 'lg5', 'lg6', 'lg7'],
};

for (const [n, order] of Object.entries(expected)) {
  const count = Number(n);
  assert.deepStrictEqual(lgFrameOrder(count), order, 'L→R hosts for ' + n);
  assert.strictEqual(order.length, count);
  assert.strictEqual(lgFrameOrder(count)[masterSlice(count) - 1], 'lg1', 'lg1 is the only master, center slice /' + masterSlice(count));
  assert.ok(qrSlices(count).includes(masterSlice(count)));
}

assert.deepStrictEqual(qrSlices(3), [2]);
assert.deepStrictEqual(qrSlices(5), [3]);
assert.deepStrictEqual(qrSlices(12), [6, 7]);

assert.deepStrictEqual(lgFrameOrder(0), []);
assert.deepStrictEqual(lgFrameOrder(13), []);

console.log('lg-frames tests passed');
