// Canvas size is the logical slice this frame owns, so Scale.FIT maps it 1:1
// onto the physical frame instead of letterboxing a landscape court into a
// rotated portrait panel.
const config = {
    type: Phaser.AUTO,
    width: SCREEN_W,
    height: CANVAS_H,
    backgroundColor: HEX.bgDark,
    scene: [GameScene],
    banner: false,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: SCREEN_W,
        height: CANVAS_H,
    },
};

if (document.fonts) {
    Promise.all([
        document.fonts.load('16px "VT323"'),
        document.fonts.load('16px "Space Grotesk"'),
        document.fonts.load('16px "Inter"'),
        document.fonts.load('bold 16px "Inter"')
    ]).then(() => {
        window.__lgGame = new Phaser.Game(config);
    }).catch(err => {
        console.error("Font preload failed", err);
        window.__lgGame = new Phaser.Game(config);
    });
} else {
    window.__lgGame = new Phaser.Game(config);
}
