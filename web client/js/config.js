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
const COLORS = {
    bg: 0x101214, panel: 0x1a1f26, panelDark: 0x10151d, black: 0x0d1117,
    system: 0x00e5ff, systemAlt: 0x20c5ff, game: 0xf4a261,
    accent: 0x4f7cac, success: 0x4caf50, successBright: 0x4ade80, error: 0xd9534f,
    textPrimary: 0xf3f4f6, textSecondary: 0x9aa4af, white: 0xffffff,
    brickGrey: 0x666666, gridLine: 0x444444,
    powerGreen: 0x00ff00, powerBlue: 0x0088ff, powerYellow: 0xffb800, powerRed: 0xff0000,
    brickCyan: 0x00e5ff, brickPink: 0xff2d78, brickGold: 0xffb800,
    trail: 0x00ffff,
};
const HEX = {
    system: '#00e5ff', systemAlt: '#20c5ff', game: '#f4a261',
    accent: '#4f7cac', success: '#4ade80', error: '#d9534f',
    textPrimary: '#f3f4f6', textSecondary: '#9aa4af', textDim: '#888888',
    bgPanel: '#0d1117', bgPanelAlpha: '#0d1117ee', bgDark: '#0a0e14',
    white: '#ffffff', black: '#000000', textLight: '#e8f4f8',
};
const FONTS = {
    display: '"VT323", monospace',
    heading: '"Space Grotesk"',
    body: '"Inter"',
    mono: '"JetBrains Mono", monospace',
};

const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROW_COLORS = [COLORS.accent, COLORS.textSecondary, COLORS.game, COLORS.success, COLORS.error, COLORS.panel];
const PADDLE_COLORS = [COLORS.accent, COLORS.game, COLORS.success];
