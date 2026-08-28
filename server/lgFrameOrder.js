'use strict';
/**
 * Must match scripts/lib/frames.sh `lg_frame_order`.
 * Liquid Galaxy left→right hostnames. Slice /1 is always the leftmost glass.
 * There is always exactly one master machine: lg1. It sits at the center
 * slice Math.ceil(N/2) — that is the QR screen.
 *
 *   3: lg3 lg1 lg2              QR /2
 *   5: lg4 lg5 lg1 lg2 lg3        QR /3
 *   7: lg5 lg6 lg7 lg1 lg2 lg3 lg4
 *   9: lg6..lg9 lg1 .. lg5
 *  12: lg8..lg12 lg1 .. lg7       QR /6
 *
 * Slice /1 is the leftmost glass. Do not map hostname digit to URL.
 */
function lgFrameOrder(n) {
  const count = Number(n);
  if (!Number.isInteger(count) || count < 1 || count > 12) return [];
  const frames = [];
  for (let i = Math.floor(count / 2) + 2; i <= count; i++) frames.push('lg' + i);
  for (let i = 1; i <= Math.floor(count / 2) + 1; i++) frames.push('lg' + i);
  return frames;
}

function masterSlice(n) {
  const count = Number(n);
  if (!Number.isInteger(count) || count < 1) return 1;
  return Math.ceil(count / 2);
}

function qrSlices(n) {
  const total = Number(n) || 3;
  const c = masterSlice(total);
  if (total % 2 === 1) return [c];
  return [c, Math.min(total, c + 1)];
}

module.exports = { lgFrameOrder, masterSlice, qrSlices };
