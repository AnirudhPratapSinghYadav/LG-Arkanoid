'use strict';

// Stock LG frames are rotated portrait (DHCP_RANDR=right → 1080x1920 viewport).
// Court height stays 1080; width follows LG_FRAME_ASPECT / LG_RANDR.
const CANVAS_HEIGHT = 1080;
const LANDSCAPE_SCREEN_WIDTH = 1920;

/** Frame aspect (width/height) from the environment. */
function resolveFrameAspect(env) {
  const e = env || process.env;
  const clamp = (v) => (Number.isFinite(v) && v >= 0.25 && v <= 4 ? v : null);

  const explicit = String(e.LG_FRAME_ASPECT || '').trim();
  if (explicit) {
    const ratio = explicit.split(':');
    if (ratio.length === 2) {
      const w = Number.parseFloat(ratio[0]);
      const h = Number.parseFloat(ratio[1]);
      const v = clamp(w / h);
      if (v) return v;
    }
    const v = clamp(Number.parseFloat(explicit));
    if (v) return v;
  }

  const w = Number.parseFloat(e.LG_FRAME_WIDTH);
  const h = Number.parseFloat(e.LG_FRAME_HEIGHT);
  if (Number.isFinite(w) && Number.isFinite(h) && h > 0) {
    const v = clamp(w / h);
    if (v) return v;
  }

  const randr = String(e.LG_RANDR || e.DHCP_RANDR || '').trim().toLowerCase();
  if (randr === 'left' || randr === 'right') return 1080 / 1920;
  if (randr === 'normal' || randr === 'inverted') return 1920 / 1080;

  return 1920 / 1080;
}

const FRAME_ASPECT = resolveFrameAspect();
const SCREEN_WIDTH = Math.round(CANVAS_HEIGHT * FRAME_ASPECT);

const PADDLE_HEIGHT = 18;
const PADDLE_Y = 1000;
/** 300px on a landscape frame — same share of a frame in either orientation. */
const DEFAULT_PADDLE_WIDTH = Math.round(SCREEN_WIDTH * (300 / LANDSCAPE_SCREEN_WIDTH));

const REF_GUTTER = 24;
const REF_CELL = 144;
const REF_BRICK_WIDTH = 140;

function brickColumnsForWorld(numScreens) {
  const refWorld = (numScreens || 3) * LANDSCAPE_SCREEN_WIDTH;
  return Math.max(1, Math.floor((refWorld - REF_GUTTER * 2) / REF_CELL));
}

function brickMetrics(screenWidth = SCREEN_WIDTH) {
  const scale = (screenWidth || SCREEN_WIDTH) / LANDSCAPE_SCREEN_WIDTH;
  return {
    gutter: REF_GUTTER * scale,
    cell: REF_CELL * scale,
    brickWidth: REF_BRICK_WIDTH * scale,
    brickHeight: 30,
    rowPitch: 40,
    top: 100,
  };
}

function centerPaddleX(numScreens, paddleWidth = DEFAULT_PADDLE_WIDTH) {
  const width = paddleWidth || DEFAULT_PADDLE_WIDTH;
  return Math.round(((numScreens || 3) * SCREEN_WIDTH) / 2 - width / 2);
}

function paddleXForSlot(slotIndex, maxPlayers, numScreens, paddleWidth = DEFAULT_PADDLE_WIDTH) {
  const n = Math.max(1, maxPlayers || 1);
  const width = paddleWidth || DEFAULT_PADDLE_WIDTH;
  const world = (numScreens || 3) * SCREEN_WIDTH;
  const idx = Math.max(0, Math.min(n - 1, slotIndex || 0));
  const center = ((idx + 0.5) / n) * world;
  return Math.max(0, Math.round(center - width / 2));
}

function inputScaleForWorld(numScreens, screenWidth) {
  const world = (Number(numScreens) || 3) * (Number(screenWidth) || SCREEN_WIDTH);
  const reference = 3 * LANDSCAPE_SCREEN_WIDTH;
  return Math.max(0.15, Math.min(5, world / reference));
}

function inputScaleForScreens(numScreens) {
  return inputScaleForWorld(numScreens, SCREEN_WIDTH);
}

function expandTiledBrickGrid(tile, numCols) {
  if (!Array.isArray(tile) || tile.length === 0) return null;
  const cols = Math.max(1, numCols || 1);
  const tileW = Array.isArray(tile[0]) ? tile[0].length : 0;
  if (tileW <= 0) return null;
  const expanded = [];
  for (let r = 0; r < tile.length; r++) {
    const src = Array.isArray(tile[r]) ? tile[r] : [];
    const row = [];
    let mirror = false;
    while (row.length < cols) {
      const chunk = mirror ? src.slice().reverse() : src;
      for (let c = 0; c < chunk.length && row.length < cols; c++) {
        const v = chunk[c];
        row.push(typeof v === 'number' ? v : 0);
      }
      mirror = !mirror;
    }
    expanded.push(row);
  }
  return expanded;
}

module.exports = {
  CANVAS_HEIGHT,
  LANDSCAPE_SCREEN_WIDTH,
  FRAME_ASPECT,
  SCREEN_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  DEFAULT_PADDLE_WIDTH,
  resolveFrameAspect,
  brickColumnsForWorld,
  brickMetrics,
  centerPaddleX,
  paddleXForSlot,
  inputScaleForWorld,
  inputScaleForScreens,
  expandTiledBrickGrid,
};
