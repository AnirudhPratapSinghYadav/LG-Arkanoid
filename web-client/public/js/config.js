// ---------------------------------------------------------------------------
// Screen identification.
//
// On a Liquid Galaxy rig, the Express server injects window.SCREEN_ID into
// the HTML via a script tag (e.g. window.SCREEN_ID = 2). This tells the
// Phaser client which portion of the panoramic virtual world to render.
//
// The number of screens (numScreens) is received from the game server via
// Socket.IO game_state events, but we initialise with a sensible default
// here so the scene can set up its boundaries before the first state arrives.
// ---------------------------------------------------------------------------
const numScreens = (typeof window.NUM_SCREENS !== 'undefined') ? window.NUM_SCREENS : 3;
const screenId = (typeof window.SCREEN_ID !== 'undefined') ? window.SCREEN_ID : Math.ceil(numScreens / 2);
const isCenterScreen = screenId === Math.ceil(numScreens / 2);

let SCREEN_BOUNDARIES = [];
for (let i = 1; i <= numScreens; i++) {
    SCREEN_BOUNDARIES.push({
        screenId: i,
        virtualLeft: (i - 1) * 1920,
        virtualRight: (i * 1920) - 1
    });
}

const screenBoundary = SCREEN_BOUNDARIES.find(s => s.screenId === screenId) || SCREEN_BOUNDARIES[0];
const virtualLeft = screenBoundary.virtualLeft;
const serverUrl = window.location.origin;

// ---------------------------------------------------------------------------
// Design tokens — single source of truth for all colors, fonts, spacing.
// Dual-channel: SYSTEM (cyan) for rig/telemetry, GAME (amber) for score/action.
// ---------------------------------------------------------------------------
// Arcade tokens. Player colors stay in lockstep with Flutter + web controller.
const PLAYER_COLORS = [0x20c5ff, 0xff2d78, 0xffb800, 0x9b59b6, 0x2ecc71];
const PLAYER_HEX = ['#20c5ff', '#FF2D78', '#FFB800', '#9B59B6', '#2ECC71'];

const COLORS = {
    bg: 0x070b12, panel: 0x121820, panelDark: 0x0c1219, black: 0x05070c,
    system: 0x20c5ff, systemAlt: 0x20c5ff, game: 0xffc300,
    accent: 0x20c5ff, success: 0x2ecc71, successBright: 0x4ade80, error: 0xe63946,
    textPrimary: 0xf3f4f6, textSecondary: 0x9aa4af, white: 0xffffff,
    brickGrey: 0x6c757d, gridLine: 0x2a3340,
    powerGreen: 0x2ecc71, powerBlue: 0x20c5ff, powerYellow: 0xffc300, powerRed: 0xe63946,
    brickCyan: 0x20c5ff, brickPink: 0xff2d78, brickGold: 0xffc300,
    trail: 0xffffff,
    brickHard: 0xcfd4da, brickSteel: 0x5c6773,
};
const HEX = {
    system: '#20c5ff', systemAlt: '#20c5ff', game: '#ffc300',
    accent: '#20c5ff', success: '#2ecc71', error: '#e63946',
    textPrimary: '#f3f4f6', textSecondary: '#9aa4af', textDim: '#6b7682',
    bgPanel: '#0c1219', bgPanelAlpha: '#0c1219ee', bgDark: '#070b12',
    white: '#ffffff', black: '#000000', textLight: '#e8f4f8',
};
const FONTS = {
    display: '"VT323", monospace',
    heading: '"Space Grotesk"',
    body: '"Inter"',
    mono: '"JetBrains Mono", monospace',
};

const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Classic Arkanoid row rainbow (top → bottom). Hard / steel override in drawBricks.
const ROW_COLORS = [0xc1121f, 0xe85d04, 0xffc300, 0x2a9d8f, 0x00b4d8, 0x277da1, 0x7b2cbf, 0xff4d6d];
const PADDLE_COLORS = PLAYER_COLORS;
