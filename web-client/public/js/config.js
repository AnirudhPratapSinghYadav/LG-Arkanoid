const numScreens = (typeof window.NUM_SCREENS !== 'undefined') ? window.NUM_SCREENS : 3;
const screenId = (typeof window.SCREEN_ID !== 'undefined') ? window.SCREEN_ID : Math.ceil(numScreens / 2);
const isCenterScreen = screenId === Math.ceil(numScreens / 2);

// Court size comes from the server (portrait LG frames are 608x1080, not 1920x1080).
const CANVAS_H = (typeof window.CANVAS_H === 'number' && window.CANVAS_H > 0) ? window.CANVAS_H : 1080;
const SCREEN_W = (typeof window.SCREEN_W === 'number' && window.SCREEN_W > 0)
    ? window.SCREEN_W
    : Math.round(CANVAS_H * (16 / 9));
const CENTER_X = SCREEN_W / 2;
const CENTER_Y = CANVAS_H / 2;

function liveNumScreens(state) {
    const n = state && state.numScreens;
    return (typeof n === 'number' && n >= 1) ? n : numScreens;
}

function qrScreenIds(n) {
    const total = n || 3;
    const c = Math.ceil(total / 2);
    if (total % 2 === 1) return [c];
    return [c, Math.min(total, c + 1)];
}

function isQrScreen(state) {
    return qrScreenIds(liveNumScreens(state)).indexOf(screenId) !== -1;
}

function isRightmostScreen(state) {
    return screenId === liveNumScreens(state);
}

let SCREEN_BOUNDARIES = [];
for (let i = 1; i <= numScreens; i++) {
    SCREEN_BOUNDARIES.push({
        screenId: i,
        virtualLeft: (i - 1) * SCREEN_W,
        virtualRight: (i * SCREEN_W) - 1
    });
}

const screenBoundary = SCREEN_BOUNDARIES.find(s => s.screenId === screenId) || SCREEN_BOUNDARIES[0];
const virtualLeft = screenBoundary.virtualLeft;
const serverUrl = window.location.origin;

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

const ROW_COLORS = [0xc1121f, 0xe85d04, 0xffc300, 0x2a9d8f, 0x00b4d8, 0x277da1, 0x7b2cbf, 0xff4d6d];
const PADDLE_COLORS = PLAYER_COLORS;
