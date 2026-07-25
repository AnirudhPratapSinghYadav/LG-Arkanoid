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

const ROW_COLORS = [0x4f7cac, 0x9aa4af, 0xf4a261, 0x4caf50, 0xd9534f, 0x242b35];
const PADDLE_COLORS = [0x4f7cac, 0xf4a261, 0x4caf50];

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.currentState = null;
        this.boundaryBallOverrides = {};
        this.previousBricks = {};
        this.previousScores = {};
        this.previousLives = {};
        this.ballTrails = {};
        this.qrCodeObj = null;
    }

    preload() {
        this.load.image('lg_logo', 'assets/lg-logo.png');
    }

    drawStandardPanel(graphics, x, y, width, height, alpha = 1.0, borderColor = 0xffffff) {
        graphics.fillStyle(0x10151d, alpha);
        graphics.fillRoundedRect(x, y, width, height, 8);
        
        graphics.lineStyle(1, borderColor, alpha * 0.1);
        graphics.strokeRoundedRect(x, y, width, height, 8);
    }

    create() {
        const bgGraphics = this.make.graphics({x: 0, y: 0, add: false});
        bgGraphics.fillStyle(0xffffff, 0.1);
        for(let i=0; i<30; i++) {
            bgGraphics.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 2 + 1, Math.random() * 2 + 1);
        }
        bgGraphics.generateTexture('bg_stars', 256, 256);
        this.bg = this.add.tileSprite(960, 540, 1920, 1080, 'bg_stars');

        const pGraphics = this.make.graphics({x:0, y:0, add:false});
        pGraphics.fillStyle(0xffffff, 1);
        pGraphics.fillRect(0, 0, 8, 8);
        pGraphics.generateTexture('particle', 8, 8);
        
        this.brickEmitter = this.add.particles(0, 0, 'particle', {
            speed: { min: 50, max: 300 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            emitting: false
        });

        this.graphics = this.add.graphics();
        this.trailGraphics = this.add.graphics();

        this.robotGraphics = this.add.graphics();
        this.robots = [];
        for (let i = 0; i < 3; i++) {
            let robotText = this.add.text(0, 0, '', {
                fontFamily: '"Inter"',
                fontSize: '16px',
                color: '#e8f4f8',
                align: 'center',
                backgroundColor: '#0d1117',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5, 1).setAlpha(0);
            this.robots.push({ text: robotText, opacityTarget: 0.7 });
        }

        this.sessionTokenText = this.add.text(960, 580, '', {
            fontFamily: '"Space Grotesk"',
            fontSize: '48px',
            color: '#00e5ff',
            align: 'center'
        }).setOrigin(0.5, 0.5).setAlpha(0);

        this.screenLabel = this.add.text(20, 20, 'Screen ' + screenId, {
            fontFamily: '"Inter"',
            fontSize: '24px',
            color: '#888888'
        });

        this.rigStatusText = this.add.text(20, 50, `LIQUID GALAXY · ONLINE · ${numScreens} DISPLAYS`, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '14px',
            color: '#20c5ff',
            fontWeight: 'bold'
        }).setAlpha(0);

        this.bottomStatusText = this.add.text(40, 1020, '', {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '14px',
            color: '#9aa4af',
        });
        if (screenId !== 1) this.bottomStatusText.setVisible(false);

        this.hudPanelGraphics = this.add.graphics();
        this.hudBorderAlpha = 1.0;

        this.hudText = this.add.text(40, 40, '', {
            fontFamily: '"Inter"',
            fontSize: '24px',
            color: '#20c5ff',
            lineSpacing: 16
        });
        if (screenId !== 1) this.hudText.setVisible(false);

        this.timerPanelGraphics = this.add.graphics();
        this.timerText = this.add.text(960, 40, '00:00', {
            fontFamily: '"Space Grotesk"',
            fontSize: '48px',
            color: '#ffffff',
        }).setOrigin(0.5, 0);
        if (!isCenterScreen) this.timerText.setVisible(false);

        this.leaderboardPanelGraphics = this.add.graphics();
        this.leaderboardTexts = [];
        for(let i = 0; i < 3; i++) {
            let txt = this.add.text(1880, 80 + (i * 40), '', {
                fontFamily: '"Space Grotesk"',
                fontSize: '24px'
            }).setOrigin(1, 0);
            if (screenId !== numScreens) txt.setVisible(false);
            this.leaderboardTexts.push(txt);
        }

        this.leaderboardTitle = this.add.text(1880, 40, '🏆 LEADERBOARD', { 
            fontFamily: '"Space Grotesk"', 
            fontSize: '20px', 
            color: '#4f7cac', 
            fontWeight: 'bold' 
        }).setOrigin(1, 0);
        if (screenId !== numScreens) this.leaderboardTitle.setVisible(false);
        
        this.geminiCardGraphics = this.add.graphics();
        this.geminiText = this.add.text(1880, 240, '', {
            fontFamily: '"Inter"',
            fontSize: '18px',
            color: '#f3f4f6',
            fontStyle: 'italic',
            wordWrap: { width: 350, useAdvancedWrap: true }
        }).setOrigin(1, 0);
        
        this.geminiTitle = this.add.text(1880, 210, '🛡️ MISSION ASSISTANT', {
            fontFamily: '"Space Grotesk"',
            fontSize: '20px',
            color: '#4f7cac',
            fontWeight: 'bold'
        }).setOrigin(1, 0);
        
        if (screenId !== numScreens) {
            this.geminiText.setVisible(false);
            this.geminiTitle.setVisible(false);
        }

        this.aiTagText = this.add.text(40, 10, 'LEVEL GENERATED BY MISSION CONTROL', {
            fontFamily: '"Inter"',
            fontSize: '14px',
            color: '#4f7cac',
            fontStyle: 'bold'
        }).setAlpha(0);

        this.sessionTokenText = this.add.text(960, 560, '', {
            fontFamily: '"Space Grotesk"',
            fontSize: '48px',
            color: '#00e5ff',
            align: 'center'
        }).setOrigin(0.5, 0.5).setAlpha(0);
        
        this.logo = this.add.image(960, 420, 'lg_logo').setOrigin(0.5, 0.5).setAlpha(0);
        this.logo.setScale(0.5);

        const scanlineGraphics = this.make.graphics({x: 0, y: 0, add: false});
        scanlineGraphics.fillStyle(0xffffff, 0.15);
        scanlineGraphics.fillRect(0, 0, 8, 1);
        scanlineGraphics.generateTexture('scanline', 8, 3);

        const vignetteGraphics = this.make.graphics({x:0, y:0, add:false});
        for (let i = 0; i < 20; i++) {
            vignetteGraphics.lineStyle(10, 0x000000, 0.05 + (i * 0.02));
            vignetteGraphics.strokeRect(i * 10, i * 10, 1920 - (i * 20), 1080 - (i * 20));
        }
        vignetteGraphics.generateTexture('vignette', 1920, 1080);
        this.vignetteOverlay = this.add.image(960, 540, 'vignette').setDepth(101);

        this.powerUpTexts = [];
        this.setupSocket();
    }

    update() {
        if (this.bg) {
            this.bg.tilePositionY -= 1;
        }
        
        this.graphics.clear();
        this.trailGraphics.clear();
        
        if (!this.currentState || this.currentState.gameStatus === 'idle') {
            this.drawAttractMode();
            return;
        } else {
            this.hideAttractMode();
        }
        
        this.checkStateChanges();
        
        if (this.currentState.gameStatus === 'waiting' || this.currentState.gameStatus === 'lobby') {
            this.hideCountdownMode();
            this.hideWinMode();
            this.renderJoin();
            this.updateHUD();
            return;
        } else {
            this.hideJoinMode();
        }
        
        if (this.currentState.gameStatus === 'countdown') {
            this.hideWinMode();
            this.drawCountdownMode();
            this.drawBricks();
            this.drawPaddles();
            this.drawRobots();
            this.updateHUD();
            return;
        } else {
            this.hideCountdownMode();
        }
        
        if (this.currentState.gameStatus === 'win' || this.currentState.gameStatus === 'time_up') {
            this.drawWinMode();
            this.drawRobots();
            return;
        } else {
            this.hideWinMode();
        }
        
        this.drawBricks();
        this.drawPowerUps();
        this.drawBalls();
        this.drawPaddles();
        this.drawRobots();
        this.updateHUD();
    }

    drawAttractMode() {
        if (!this.attractModeGraphics) {
            this.attractModeGraphics = this.add.graphics();
            this.attractTime = 0;
        }
        this.attractModeGraphics.clear();
        this.attractTime += 0.04;
        
        // Panoramic animated starfield / particle mesh
        for(let i = 0; i < 30; i++) {
            const angle = this.attractTime * 0.8 + (i * 0.25);
            const radius = 220 + Math.sin(this.attractTime * 0.6 + i) * 80;
            const px = 960 + Math.cos(angle) * radius;
            const py = 540 + Math.sin(angle * 0.7) * (radius * 0.6);
            
            const hueAlpha = 0.4 + Math.sin(this.attractTime + i) * 0.3;
            this.attractModeGraphics.fillStyle(i % 2 === 0 ? 0x00e5ff : 0x20c5ff, Math.max(0.1, hueAlpha));
            this.attractModeGraphics.fillCircle(px, py, 3 + (i % 4));
        }

        if (isCenterScreen) {
            if (!this.bootTitleText) {
                this.bootTitleText = this.add.text(960, 440, 'LIQUID GALAXY\nARKANOID', {
                    fontFamily: '"Space Grotesk"', fontSize: '84px', fill: '#20c5ff', align: 'center', fontWeight: 'bold'
                }).setOrigin(0.5, 0.5);
                
                this.bootSubTitleText = this.add.text(960, 560, 'WHERE AI MEETS ARKANOID', {
                    fontFamily: '"Space Grotesk"', fontSize: '22px', fill: '#00e5ff', letterSpacing: 6, fontWeight: 'bold'
                }).setOrigin(0.5, 0.5);

                this.bootLoadingText = this.add.text(960, 620, 'Powered by GeminiSoC 2026 · Liquid Galaxy', {
                    fontFamily: '"Inter"', fontSize: '18px', fill: '#9aa4af', letterSpacing: 3
                }).setOrigin(0.5, 0.5);
            }
            this.bootTitleText.setVisible(true);
            if (this.bootSubTitleText) this.bootSubTitleText.setVisible(true);
            this.bootLoadingText.setVisible(true);
        }
    }

    hideAttractMode() {
        if (this.attractModeGraphics) this.attractModeGraphics.clear();
        if (this.bootTitleText) this.bootTitleText.setVisible(false);
        if (this.bootSubTitleText) this.bootSubTitleText.setVisible(false);
        if (this.bootLoadingText) this.bootLoadingText.setVisible(false);
    }
    
    initAmbientTexts() {
        if (!this.ambientLeftText) {
            this.ambientLeftText = this.add.text(960, 540, 'LIQUID GALAXY\nMULTIPLAYER ARCADE', {
                fontFamily: '"VT323"', fontSize: '64px', fill: '#ffffff',
                align: 'center', alpha: 0.3
            }).setOrigin(0.5).setVisible(false);
        }
        if (!this.ambientRightText) {
            this.ambientRightText = this.add.text(960, 540, 'Waiting for Players\n0 / 3', {
                fontFamily: '"VT323"', fontSize: '64px', fill: '#ffffff',
                align: 'center', alpha: 0.3
            }).setOrigin(0.5).setVisible(false);
        }
        const maxP = (this.currentState && this.currentState.maxPlayers) || 5;
        if (!this.lobbyPlayerTexts) {
            this.lobbyPlayerTexts = [];
        }
        while (this.lobbyPlayerTexts.length < maxP) {
            let txt = this.add.text(960, 680 + (this.lobbyPlayerTexts.length*60), 'Waiting...', {
                fontFamily: '"VT323"', fontSize: '40px', fill: '#666666'
            }).setOrigin(0.5).setVisible(false);
            this.lobbyPlayerTexts.push({text: txt});
        }
    }

    renderJoin() {
        this.initAmbientTexts();
        
        let players = this.currentState.players || [];
        let connectedCount = players.filter(p => p.connected).length;
        
        if (screenId === 1) {
            this.ambientLeftText.setVisible(true);
        } else if (screenId === numScreens) {
            this.ambientRightText.setText(`Waiting for Players\n${connectedCount} / ${this.currentState.maxPlayers || players.length} Connected`);
            this.ambientRightText.setVisible(true);
        } else if (isCenterScreen) {
            if (this.currentState.sessionToken) {
                const qrDiv = document.getElementById('qrcode');
                const sessionCodeDiv = document.getElementById('qr-session-code');
                const sessionCodeInline = document.getElementById('qr-session-code-inline');
                const waitingText = document.getElementById('qr-waiting-text');
                
                qrDiv.style.display = 'flex';
                
                sessionCodeDiv.innerText = this.currentState.sessionToken;
                sessionCodeInline.innerText = this.currentState.sessionToken;
                
                if (connectedCount === 0) {
                    waitingText.innerText = "Waiting for first player...";
                    this.lobbyPlayerTexts.forEach(p => p.text.setVisible(false));
                } else {
                    waitingText.innerText = "";
                    
                    const maxP = this.currentState.maxPlayers || players.length;
                    for (let i = 0; i < maxP; i++) {
                        if (i >= this.lobbyPlayerTexts.length) break;
                        let p = players[i];
                        let txtObj = this.lobbyPlayerTexts[i].text;
                        
                        if (p && p.connected) {
                            txtObj.setText(`✓ ${p.name || 'Player ' + (i+1)}`);
                            txtObj.setColor('#4ade80');
                        } else {
                            txtObj.setText('Waiting...');
                            txtObj.setColor('#666666');
                        }
                        txtObj.setVisible(true);
                    }
                    for (let i = maxP; i < this.lobbyPlayerTexts.length; i++) {
                        this.lobbyPlayerTexts[i].text.setVisible(false);
                    }
                }
                
                if (this.currentState.lanIp && !this.qrCodeObj) {
                    const qrData = `LGARK|${this.currentState.lanIp}|${this.currentState.port}|${this.currentState.sessionToken}`;
                    this.qrCodeObj = new QRCode(document.getElementById('qrcode-img'), {
                        text: qrData,
                        width: 320,
                        height: 320,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.L
                    });
                }
                qrDiv.style.top = connectedCount === 0 ? '50%' : '40%';
            }
        }
    }

    hideJoinMode() {
        document.getElementById('qrcode').style.display = 'none';
        if (this.ambientLeftText) this.ambientLeftText.setVisible(false);
        if (this.ambientRightText) this.ambientRightText.setVisible(false);
        if (this.lobbyPlayerTexts) this.lobbyPlayerTexts.forEach(p => p.text.setVisible(false));
    }

    drawCountdownMode() {
        if (!this.countdownText) {
            this.countdownText = this.add.text(960, 540, '', {
                fontFamily: '"VT323", monospace', fontSize: '240px', color: '#4f7cac', fontWeight: 'bold'
            }).setOrigin(0.5, 0.5);
        }
        
        if (isCenterScreen) {
            this.countdownText.setVisible(true);
            let elapsed = Date.now() - (this.currentState.countdownStartedAt || Date.now());
            let remain = 3 - Math.floor(elapsed / 1000);
            if (remain > 0) {
                this.countdownText.setText(remain.toString());
                let scale = 1 + (elapsed % 1000) / 1000 * 0.3;
                this.countdownText.setScale(scale);
                this.countdownText.setAlpha(1 - (elapsed % 1000) / 1000);
            } else {
                this.countdownText.setText('START!');
                this.countdownText.setScale(1);
                this.countdownText.setAlpha(1);
            }
        } else {
            this.countdownText.setVisible(false);
        }
    }
    
    hideCountdownMode() {
        if (this.countdownText) this.countdownText.setVisible(false);
    }

    drawWinMode() {
        if (!this.winTitle) {
            this.winTitle = this.add.text(960, 200, '🏆 MATCH FINISHED', {
                fontFamily: '"Space Grotesk"', fontSize: '80px', color: '#f4a261', fontWeight: 'bold'
            }).setOrigin(0.5, 0.5);
            
            this.winName = this.add.text(960, 320, '', {
                fontFamily: '"Space Grotesk"', fontSize: '110px', color: '#f3f4f6', fontWeight: 'bold'
            }).setOrigin(0.5, 0.5);
            
            this.winStatsText = this.add.text(960, 540, '', {
                fontFamily: '"Inter"', fontSize: '28px', color: '#9aa4af', align: 'center', lineSpacing: 20
            }).setOrigin(0.5, 0.5);

            this.winConfetti = this.add.particles(0, 0, 'particle', {
                x: 960, y: -50,
                speed: { min: 200, max: 800 },
                angle: { min: 45, max: 135 },
                gravityY: 1000,
                scale: { start: 1, end: 0 },
                lifespan: 4000,
                emitting: false
            });
            this.winConfettiEmitted = false;
        }
        
        if (isCenterScreen) {
            this.winTitle.setVisible(true);
            this.winName.setVisible(true);
            this.winStatsText.setVisible(true);
            
            let winner = [...(this.currentState.players || [])].sort((a,b) => b.score - a.score)[0];
            if (winner && winner.connected) {
                this.winName.setText(`${winner.name.toUpperCase()} WINS!`);
            } else {
                this.winName.setText('NO PLAYERS CONNECTED');
            }
            
            let statsStr = `LONGEST RALLY: ${this.currentState.longestRally || 0}\n` +
                           `POWER-UPS COLLECTED: ${this.currentState.powerupsCollected || 0}\n` +
                           `HIGHEST COMBO: ${this.currentState.highestCombo || 0}`;
            this.winStatsText.setText(statsStr);
            
            if (!this.winConfettiEmitted && winner && winner.connected) {
                this.winConfetti.start();
                this.winConfettiEmitted = true;
                
                this.cameras.main.pan(960, 450, 2000, 'Sine.easeInOut');
                this.cameras.main.zoomTo(1.1, 2000, 'Sine.easeInOut');
            }
        }
    }
    
    hideWinMode() {
        if (this.winTitle) {
            this.winTitle.setVisible(false);
            this.winName.setVisible(false);
            if (this.winStatsText) this.winStatsText.setVisible(false);
            if (this.winConfetti) this.winConfetti.stop();
            this.winConfettiEmitted = false;
            this.cameras.main.pan(960, 540, 1000, 'Linear');
            this.cameras.main.zoomTo(1, 1000, 'Linear');
        }
    }

    updateHUD() {
        this.hudPanelGraphics.clear();
        this.timerPanelGraphics.clear();
        this.leaderboardPanelGraphics.clear();
        
        const isGameActive = this.currentState && 
                             (this.currentState.gameStatus === 'playing' || 
                              this.currentState.gameStatus === 'game_over' ||
                              this.currentState.gameStatus === 'win' ||
                              this.currentState.gameStatus === 'time_up');

        if (!isGameActive) {
            this.hudText.setVisible(false);
            this.timerText.setVisible(false);
            this.leaderboardTexts.forEach(t => { if(t) t.setVisible(false); });
            this.leaderboardTitle.setVisible(false);
            this.geminiText.setVisible(false);
            this.geminiTitle.setVisible(false);
            this.geminiCardGraphics.clear();
            if (this.rigHealthText) this.rigHealthText.setVisible(false);
            if (this.bottomStatusText) this.bottomStatusText.setVisible(false);
            return;
        }

        if (screenId === 1) this.hudText.setVisible(true);
        if (isCenterScreen) this.timerText.setVisible(true);
        if (screenId === numScreens) {
            this.leaderboardTexts.forEach(t => { if (t) t.setVisible(true); });
            this.leaderboardTitle.setVisible(true);
            this.geminiText.setVisible(true);
            this.geminiTitle.setVisible(true);
        }
        if (screenId === 1 && this.bottomStatusText) {
            const fps = this.game.loop.actualFps.toFixed(0);
            const latency = this.currentLatency !== undefined ? `${this.currentLatency} ms` : '-- ms';
            this.bottomStatusText.setText(`FPS: ${fps}   |   LATENCY: ${latency}   |   CONNECTION: ONLINE`);
            this.bottomStatusText.setVisible(true);
        }
        if (isCenterScreen && this.rigHealthText) {
            this.rigHealthText.setVisible(true);
        }

        if (!this.currentState || !this.currentState.players) {
            this.hudText.setText('');
            return;
        }

        let hudStr = `LEVEL: ${this.currentState.currentLevel || 1}\n\n`;
        
        const playerCount = this.currentState.players.length;
        for (let i = 0; i < playerCount; i++) {
            const p = this.currentState.players[i];
            if (p && p.connected) {
                const name = p.name ? p.name.padEnd(12, ' ') : `P${i+1}`.padEnd(12, ' ');
                hudStr += `${name} SCORE: ${p.score.toString().padStart(5, '0')}          \n`;
            }
        }
        
        this.hudText.setText(hudStr);
        
        const bounds = this.hudText.getBounds();
        if (screenId === 1) {
            const padX = 20;
            const padY = 20;
            const panelX = bounds.x - padX;
            const panelY = bounds.y - padY;
            const panelW = bounds.width + padX * 2;
            const panelH = bounds.height + padY * 2;
            this.drawStandardPanel(this.hudPanelGraphics, panelX, panelY, panelW, panelH);
        }

        let lineIdx = 0;
        for (let i = 0; i < playerCount; i++) {
            const p = this.currentState.players[i];
            if (p && p.connected) {
                const startY = bounds.y + 40 + (lineIdx * 40) + 12; 
                const startX = bounds.x + bounds.width - 60; 
                if (screenId === 1) {
                    this.hudPanelGraphics.fillStyle(0x4ade80, 1);
                    for(let l = 0; l < Math.min(p.lives, 5); l++) {
                        this.hudPanelGraphics.fillCircle(startX + (l * 14), startY, 5);
                    }
                }
                lineIdx++;
            }
        }
        
        if (screenId === 1) {
            this.aiTagText.setPosition(bounds.x - 20, bounds.y + bounds.height + 30);
        }

        if (this.currentState.gameStartedAt && this.currentState.gameStatus === 'playing') {
            const elapsed = Math.floor((Date.now() - this.currentState.gameStartedAt) / 1000);
            const duration = this.currentState.gameDurationSeconds || 180;
            const remaining = Math.max(0, duration - elapsed);
            const m = String(Math.floor(remaining / 60)).padStart(2, '0');
            const s = String(remaining % 60).padStart(2, '0');
            this.timerText.setText(`${m}:${s}`);
            if (remaining <= 30) this.timerText.setColor('#ff0000');
            else this.timerText.setColor('#ffffff');
        } else {
            this.timerText.setText('00:00');
        }
        
        if (isCenterScreen && this.currentState.gameStartedAt && this.currentState.gameStatus === 'playing') {
            const tBounds = this.timerText.getBounds();
            this.drawStandardPanel(this.timerPanelGraphics, tBounds.x - 30, tBounds.y - 15, tBounds.width + 60, tBounds.height + 30);
        }

        if (isCenterScreen) {
            if (!this.rigHealthText) {
                this.rigHealthGraphics = this.add.graphics();
                this.rigHealthText = this.add.text(960, 1040, '', {
                    fontFamily: '"Inter"', fontSize: '14px', color: '#888888', align: 'center'
                }).setOrigin(0.5, 1);
            }
            
            let playersCount = this.currentState.players.filter(p => p.connected).length;
            let maxPlayers = this.currentState.maxPlayers || this.currentState.players.length;
            this.rigHealthText.setText(`DISPLAYS: ${numScreens}/${numScreens}  |  PLAYERS: ${playersCount}/${maxPlayers}  |  SERVER: HEALTHY`);
            this.rigHealthText.setVisible(true);
        }

        let activePlayers = this.currentState.players.filter(p => p.connected).sort((a, b) => a.rank - b.rank);
        let lbW = 0;
        let lbLines = 0;
        
        const PLAYER_COLORS_HEX = ['#4f7cac', '#f4a261', '#4caf50', '#e040fb', '#ff5252'];
        
        for (let i = 0; i < 3; i++) {
            if (i < activePlayers.length) {
                const p = activePlayers[i];
                let colorHex = PLAYER_COLORS_HEX[(p.playerNumber - 1) % PLAYER_COLORS_HEX.length];
                
                const name = p.name || `P${p.playerNumber}`;
                this.leaderboardTexts[i].setText(`#${p.rank} ${name} ${p.score.toString().padStart(5, '0')}`);
                this.leaderboardTexts[i].setColor(colorHex);
                lbW = Math.max(lbW, this.leaderboardTexts[i].width);
                lbLines++;
                
                if (screenId === numScreens && this._rankSwapHighlightPids && this._rankSwapHighlightPids[p.id]) {
                    this.drawStandardPanel(this.leaderboardPanelGraphics, 1880 - lbW - 20, 80 + (i * 40), lbW + 40, 40, 1.0, 0xffffff);
                }
            } else {
                this.leaderboardTexts[i].setText('');
            }
        }
        
        if (screenId === numScreens && lbLines > 0) {
            this.leaderboardPanelGraphics.fillStyle(0x4f7cac, 1);
            this.leaderboardTitle.setVisible(true).setDepth(2);
            
            this.drawStandardPanel(this.leaderboardPanelGraphics, 1880 - Math.max(lbW, 180) - 20, 25, Math.max(lbW, 180) + 40, (lbLines * 40) + 70);
            
            let aiText = "Analyzing game data...";
            if (this.currentState.lastCommentary) {
                aiText = `"${this.currentState.lastCommentary}"`;
            }
            this.geminiText.setText(aiText);
            
            const gBounds = this.geminiText.getBounds();
            this.drawStandardPanel(this.leaderboardPanelGraphics, 1880 - 350 - 20, 195, 350 + 40, gBounds.height + 60);
        }
    }

    checkStateChanges() {
        if (this.currentState.bricks) {
            for (let r = 0; r < this.currentState.bricks.length; r++) {
                const row = this.currentState.bricks[r];
                for (let c = 0; c < row.length; c++) {
                    const brick = row[c];
                    const id = `${r}-${c}`;
                    if (this.previousBricks[id] && !brick.active) {
                        const localX = brick.x - virtualLeft;
                        if (localX > -600 && localX < 2520) {
                            this.brickEmitter.setParticleTint(ROW_COLORS[r % ROW_COLORS.length]);
                            this.brickEmitter.emitParticleAt(localX + 300, brick.y + 15, 15);
                            this.playBeep(600 + (6 - (r % 6)) * 100, 'square', 0.1, 0.05);
                            if (brick.type === 'hard' || brick.type === 'indestructible') {
                                this.cameras.main.shake(150, 0.005);
                                this.playBeep(200, 'sawtooth', 0.15, 0.1);
                            } else {
                                this.cameras.main.shake(50, 0.002);
                            }
                        }
                    }
                    this.previousBricks[id] = brick.active;
                }
            }
        }
        
        for (let i = 0; i < this.currentState.players.length; i++) {
            const p = this.currentState.players[i];
            if (p && p.connected) {
                const prevScore = this.previousScores[p.id] || 0;
                if (p.score > prevScore) {
                    this.spawnFloatingText(`+${p.score - prevScore}`, p.paddleX - virtualLeft + (p.paddleWidth/2 || 100), 950, '#00ff00');
                    if (p.score - prevScore >= 50) {
                        this.playBeep(1200, 'sine', 0.2, 0.1);
                        this.playBeep(1600, 'sine', 0.3, 0.1);
                    }
                } else if (p.score < prevScore) {
                    this.spawnFloatingText(`${p.score - prevScore}`, p.paddleX - virtualLeft + (p.paddleWidth/2 || 100), 950, '#ff0000');
                }
                
                this.previousScores[p.id] = p.score;
                this.previousLives[p.id] = p.lives;
            }
        }
        
        if (this.currentState.balls) {
            if (!this.previousBalls) this.previousBalls = [];
            this.currentState.balls.forEach((ball, i) => {
                const prev = this.previousBalls[i];
                if (prev && ball.active && prev.active) {
                    if (prev.vy > 0 && ball.vy < 0 && ball.y > 800) {
                        this.playBeep(400, 'triangle', 0.1, 0.1);
                    }
                }
                this.previousBalls[i] = { active: ball.active, vy: ball.vy, y: ball.y };
            });
        }
    }

    spawnFloatingText(text, x, y, color) {
        if (x < -200 || x > 2100) return; 
        const t = this.add.text(x, y, text, {
            fontFamily: '"Space Grotesk"',
            fontSize: '28px',
            color: color,
        }).setOrigin(0.5, 0.5);
        this.tweens.add({
            targets: t,
            y: y - 100,
            alpha: 0,
            duration: 600,
            onComplete: () => t.destroy()
        });
    }

    drawPowerUps() {
        const powerUps = this.currentState.powerUps;
        if (!powerUps) return;
        
        const time = this.time.now;
        this.powerUpTexts.forEach(t => t.setAlpha(0));
        let tIdx = 0;

        for (const p of powerUps) {
            if (!p.active) continue;
            const localX = p.x - virtualLeft;
            if (localX < -50 || localX > 1970) continue;
            
            let pColor = 0xff0000;
            let pLetter = 'B';
            if (p.type === 'wide_paddle') { pColor = 0x00ff00; pLetter = 'W'; }
            else if (p.type === 'slow_ball') { pColor = 0x0088ff; pLetter = 'S'; }
            else if (p.type === 'multi_ball') { pColor = 0xffb800; pLetter = 'M'; }
            
            const pulse = 1 + Math.sin(time * 0.005) * 0.3;
            const auraRadius = 16 + (4 * pulse);
            
            this.graphics.fillStyle(pColor, 0.4);
            this.graphics.fillCircle(localX, p.y, auraRadius);
            
            this.graphics.lineStyle(2, pColor, 1);
            this.graphics.strokeCircle(localX, p.y, 14);
            
            this.graphics.fillStyle(0x0d1117, 1);
            this.graphics.fillCircle(localX, p.y, 12);
            
            if (tIdx >= this.powerUpTexts.length) {
                const txt = this.add.text(0, 0, '', {
                    fontFamily: '"Space Grotesk"',
                    fontSize: '14px',
                    color: '#ffffff',
                }).setOrigin(0.5, 0.5);
                this.powerUpTexts.push(txt);
            }
            
            const txt = this.powerUpTexts[tIdx++];
            txt.setText(pLetter);
            txt.setColor(pColor === 0x00ff00 ? '#00ff00' : pColor === 0x0088ff ? '#0088ff' : pColor === 0xffb800 ? '#ffb800' : '#ff0000');
            txt.setPosition(localX, p.y);
            txt.setAlpha(1);
        }
    }

    drawBricks() {
        const bricks = this.currentState.bricks;
        if (!bricks) return;

        for (let r = 0; r < bricks.length; r++) {
            const row = bricks[r];
            if (!row) continue;

            for (let c = 0; c < row.length; c++) {
                const brick = row[c];
                if (!brick || !brick.active) continue;

                const localX = brick.x - virtualLeft;
                if (localX < -600 || localX > 2520) continue;

                const hGap = 6;
                const vGap = 8;
                
                const time = this.time.now;
                let breath = 0;
                if (brick.type === 'indestructible') {
                    breath = Math.sin(time * 0.003 + (r * c)) * 2;
                } else if (brick.type === 'hard') {
                    breath = Math.sin(time * 0.005 + (r + c)) * 1.5;
                }
                
                const drawW = (brick.width || 140) - hGap + breath;
                const drawH = (brick.height || 30) - vGap + (breath * 0.2);

                let color;
                if (brick.type === 'indestructible') {
                    color = 0x666666;
                } else if (brick.type === 'hard') {
                    color = 0xffffff;
                } else {
                    const normalColors = [0x00e5ff, 0xff2d78, 0xffb800];
                    color = normalColors[brick.row % 3];
                }
                
                const drawX = localX + hGap / 2 - (breath / 2);
                const drawY = brick.y + vGap / 2 - (breath * 0.1);

                this.graphics.fillStyle(color, 1);
                this.graphics.fillRect(drawX, drawY, drawW, drawH);
                
                if (brick.type === 'indestructible') {
                    this.graphics.lineStyle(2, 0x444444, 1);
                    for (let i = -drawH; i < drawW; i += 10) {
                        let x1 = i;
                        let y1 = 0;
                        let x2 = i + drawH;
                        let y2 = drawH;
                        
                        if (x1 < 0) { y1 -= x1; x1 = 0; }
                        if (x2 > drawW) { y2 -= (x2 - drawW); x2 = drawW; }
                        
                        if (x1 < drawW && x2 > 0) {
                            this.graphics.beginPath();
                            this.graphics.moveTo(drawX + x1, drawY + y1);
                            this.graphics.lineTo(drawX + x2, drawY + y2);
                            this.graphics.strokePath();
                        }
                    }
                }
                
                const lightColor = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.IntegerToColor(color),
                    Phaser.Display.Color.IntegerToColor(0xffffff),
                    100, 40
                );
                this.graphics.fillStyle(Phaser.Display.Color.GetColor(lightColor.r, lightColor.g, lightColor.b), 1);
                this.graphics.fillRect(drawX, drawY, drawW, 3);
                
                const darkColor = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.IntegerToColor(color),
                    Phaser.Display.Color.IntegerToColor(0x000000),
                    100, 40
                );
                this.graphics.fillStyle(Phaser.Display.Color.GetColor(darkColor.r, darkColor.g, darkColor.b), 1);
                this.graphics.fillRect(drawX, drawY + drawH - 3, drawW, 3);
            }
        }
    }

    drawBalls() {
        const balls = this.currentState.balls;
        if (!balls) return;

        for (let i = 0; i < balls.length; i++) {
            const ball = balls[i];
            if (!ball || !ball.active) {
                if (this.ballTrails[i]) this.ballTrails[i] = [];
                continue;
            }

            const override = this.boundaryBallOverrides[ball.id];
            const localX = (override !== undefined) ? override : (ball.x - virtualLeft);
            
            if (!this.ballTrails[i]) this.ballTrails[i] = [];
            this.ballTrails[i].push({ x: localX, y: ball.y });
            if (this.ballTrails[i].length > 10) this.ballTrails[i].shift();
            
            if (localX < -50 || localX > 1970) continue;

            for (let t = 0; t < this.ballTrails[i].length; t++) {
                const pos = this.ballTrails[i][t];
                const alpha = t / 10;
                this.trailGraphics.fillStyle(0x00ffff, alpha * 0.5);
                this.trailGraphics.fillCircle(pos.x, pos.y, 8 * alpha);
            }

            this.graphics.fillStyle(0xffffff, 1);
            this.graphics.fillCircle(localX, ball.y, 8);
        }
    }

    drawPaddles() {
        const players = this.currentState.players;
        if (!players) return;

        const entries = Array.isArray(players) ? players : Object.values(players);

        for (let i = 0; i < entries.length; i++) {
            const player = entries[i];
            if (!player || !player.connected) continue;

            const paddleX = player.paddleX !== undefined ? player.paddleX : player.x;
            const paddleWidth = player.paddleWidth !== undefined ? player.paddleWidth : player.width || 200;
            const playerNumber = player.playerNumber !== undefined ? player.playerNumber : (i + 1);

            if (paddleX === undefined) continue;

            const localX = paddleX - virtualLeft;
            const color = PADDLE_COLORS[(playerNumber - 1) % PADDLE_COLORS.length];

            if (localX + paddleWidth < 0 || localX > 1920) continue;

            if (player.name) {
                const nameX = localX + paddleWidth / 2;
                this.graphics.fillStyle(0xffffff, 0.8);
                this.graphics.fillRoundedRect(nameX - 40, 1000 - 35, 80, 20, 4);
                if (!this[`paddleNameText_${i}`]) {
                    this[`paddleNameText_${i}`] = this.add.text(0, 0, '', { fontFamily: '"Inter"', fontSize: '12px', color: '#000', fontWeight: 'bold' }).setOrigin(0.5, 0.5).setDepth(200);
                }
                this[`paddleNameText_${i}`].setText(player.name.substring(0, 8));
                this[`paddleNameText_${i}`].setPosition(nameX, 1000 - 25);
                this[`paddleNameText_${i}`].setVisible(true);
            }

            let drawAlpha = 1;
            if (this.lostConnectionPids && this.lostConnectionPids[player.id]) {
                const elapsed = Date.now() - this.lostConnectionPids[player.id];
                drawAlpha = 0.3 + (Math.sin(elapsed / 150) * 0.2);
            }

            this.graphics.fillStyle(color, 0.3 * drawAlpha);
            this.graphics.fillRoundedRect(localX - 10, 1000 - 10, paddleWidth + 20, 40, 10);
            
            this.graphics.fillStyle(color, drawAlpha);
            this.graphics.fillRoundedRect(localX, 1000, paddleWidth, 20, 6);
        }
    }

    drawRobots() {
        const players = this.currentState.players;
        if (!players) return;

        this.robotGraphics.clear();

        const robotX = 960;
        const robotY = 1050;
        const robotSize = 40;

        this.robotGraphics.fillStyle(0x0d1117, 0.9);
        this.robotGraphics.fillRoundedRect(robotX - robotSize/2, robotY - robotSize/2, robotSize, robotSize, 10);
        this.robotGraphics.lineStyle(2, 0x4f7cac, 0.8);
        this.robotGraphics.strokeRoundedRect(robotX - robotSize/2, robotY - robotSize/2, robotSize, robotSize, 10);

        this.robotGraphics.fillStyle(0x00e5ff, 0.9);
        this.robotGraphics.fillCircle(robotX - 8, robotY - 4, 4);
        this.robotGraphics.fillCircle(robotX + 8, robotY - 4, 4);

        this.robotGraphics.lineStyle(2, 0x00e5ff, 0.6);
        this.robotGraphics.beginPath();
        this.robotGraphics.moveTo(robotX - 6, robotY + 8);
        this.robotGraphics.lineTo(robotX + 6, robotY + 8);
        this.robotGraphics.strokePath();

        this.robotGraphics.lineStyle(2, 0x4f7cac, 0.6);
        this.robotGraphics.beginPath();
        this.robotGraphics.moveTo(robotX, robotY - robotSize/2);
        this.robotGraphics.lineTo(robotX, robotY - robotSize/2 - 10);
        this.robotGraphics.strokePath();
        this.robotGraphics.fillStyle(0x00e5ff, 0.8);
        this.robotGraphics.fillCircle(robotX, robotY - robotSize/2 - 10, 3);

        const robot = this.robots[0];
        if (robot && robot.text && robot.text.visible && robot.text.alpha > 0) {
            const bubbleText = robot.text.text;
            if (bubbleText && bubbleText.length > 0) {
                const textWidth = Math.min(bubbleText.length * 8 + 30, 400);
                const bubbleX = robotX;
                const bubbleY = robotY - robotSize/2 - 22;

                this.robotGraphics.fillStyle(0x0d1117, 0.95);
                this.robotGraphics.fillRoundedRect(bubbleX - textWidth/2, bubbleY - 36, textWidth, 30, 8);
                this.robotGraphics.lineStyle(1, 0x4f7cac, 0.6);
                this.robotGraphics.strokeRoundedRect(bubbleX - textWidth/2, bubbleY - 36, textWidth, 30, 8);

                this.robotGraphics.fillStyle(0x0d1117, 0.95);
                this.robotGraphics.fillTriangle(
                    bubbleX - 6, bubbleY - 6,
                    bubbleX + 6, bubbleY - 6,
                    bubbleX, bubbleY
                );

                robot.text.setPosition(bubbleX, bubbleY - 21);
                robot.text.setOrigin(0.5, 0.5);
                robot.text.setWordWrapWidth(textWidth - 20);
            }
        }
    }

    setupSocket() {
        this.socket = io(serverUrl, {
            query: { screenId: screenId },
            transports: ['websocket', 'polling']
        });

        this.currentLatency = 0;
        setInterval(() => {
            if (this.socket && this.socket.connected) {
                const pingStart = Date.now();
                this.socket.emit('ping_test', {}, () => {
                    this.currentLatency = Date.now() - pingStart;
                });
            }
        }, 3000);

        this.socket.on('game_state', (state) => {
            this.currentState = state;
        });

        this.socket.on('boundary_enter', (data) => {
            if (data.screenId !== screenId) return;

            const ballId = data.ballId;
            const entryX = data.entryX;

            this.boundaryBallOverrides[ballId] = entryX;

            this.tweens.add({
                targets: { value: entryX },
                value: entryX,
                duration: 16,
                onUpdate: (tween, target) => {
                    this.boundaryBallOverrides[ballId] = target.value;
                },
                onComplete: () => {
                    delete this.boundaryBallOverrides[ballId];
                }
            });

            this.tweens.add({
                targets: this,
                hudBorderAlpha: 0,
                duration: 150,
                yoyo: true
            });

            this.socket.emit('boundary_ack', { ballId: ballId, handoffId: data.handoffId, screenId: data.screenId });
        });

        this.socket.on('boundary_exit', (data) => {
            if (data.screenId !== screenId) return;
            this.socket.emit('boundary_ack', { ballId: data.ballId, handoffId: data.handoffId, screenId: data.screenId });
        });

        this.socket.on('player_connection_lost', (data) => {
            this.lostConnectionPids = this.lostConnectionPids || {};
            this.lostConnectionPids[data.playerId] = Date.now();
            this.cameras.main.flash(300, 255, 0, 0, false);
        });

        this.socket.on('player_disconnected', (data) => {
            if (this.lostConnectionPids && data.playerId) {
                delete this.lostConnectionPids[data.playerId];
            }
        });

        this.socket.on('commentary', (data) => {
            if (data.eventType === 'life_lost') {
                this.cameras.main.shake(200, 0.01);
            }

            let message = data.text || data.message || '';
            if (data.source === 'fallback') {
                message += ' (offline)';
            }

            if (data.eventType === 'rank_takeover' && data.playerId) {
                this._rankSwapHighlightPids = this._rankSwapHighlightPids || {};
                this._rankSwapHighlightPids[data.playerId] = true;
                setTimeout(() => {
                    if (this._rankSwapHighlightPids) {
                        this._rankSwapHighlightPids[data.playerId] = false;
                    }
                }, 1500);
            }

            const robot = this.robots[0];
            if (!robot || !robot.text) return;
            
            if (this.currentState) {
                this.currentState.lastCommentary = message;
            }
            robot.text.setText(message);
            robot.text.setVisible(true);
            robot.text.setAlpha(1.0);
            
            if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
            this.bubbleTimer = setTimeout(() => {
                if (robot && robot.text) {
                    this.tweens.add({
                        targets: robot.text,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            robot.text.setVisible(false);
                        }
                    });
                }
            }, 6000);
        });

        this.socket.on('level_source', (data) => {
            if (data.aiGenerated) {
                this.tweens.killTweensOf(this.aiTagText);
                this.tweens.add({
                    targets: this.aiTagText,
                    alpha: 1,
                    duration: 300,
                    ease: 'Power1',
                    onComplete: () => {
                        this.tweens.add({
                            targets: this.aiTagText,
                            alpha: 0,
                            duration: 300,
                            delay: 3000,
                            ease: 'Power1'
                        });
                    }
                });
            }
        });

        this.socket.on('player_joined', (data) => {
            const playerName = (data.playerName || 'Player ' + data.playerNumber).toUpperCase();
            const playerNumber = data.playerNumber || '?';
            const connectedCount = data.connectedCount || 1;

            if (!this.joinToastText) {
                this.joinToastText = this.add.text(960, -80, '', {
                    fontFamily: '"VT323", monospace',
                    fontSize: '48px',
                    color: '#4ade80',
                    align: 'center',
                    backgroundColor: '#0d1117ee',
                    padding: { x: 40, y: 16 }
                }).setOrigin(0.5, 0.5).setDepth(500);
            }

            if (!this.joinToastSubText) {
                this.joinToastSubText = this.add.text(960, -30, '', {
                    fontFamily: '"Inter"',
                    fontSize: '20px',
                    color: '#9AA4AF',
                    align: 'center'
                }).setOrigin(0.5, 0.5).setDepth(500);
            }

            this.joinToastText.setText(`🎮  ${playerName} HAS JOINED!`);
            this.joinToastSubText.setText(`Player ${playerNumber} · ${connectedCount}/${data.maxPlayers || connectedCount} Connected`);

            this.tweens.killTweensOf(this.joinToastText);
            this.tweens.killTweensOf(this.joinToastSubText);

            this.joinToastText.setY(-80).setAlpha(1);
            this.joinToastSubText.setY(-30).setAlpha(1);

            this.tweens.add({
                targets: this.joinToastText,
                y: 120,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: this.joinToastText,
                        y: -80,
                        alpha: 0,
                        duration: 400,
                        delay: 3500,
                        ease: 'Power2'
                    });
                }
            });

            this.tweens.add({
                targets: this.joinToastSubText,
                y: 170,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: this.joinToastSubText,
                        y: -30,
                        alpha: 0,
                        duration: 400,
                        delay: 3500,
                        ease: 'Power2'
                    });
                }
            });

            this.playBeep(880, 'sine', 0.15, 0.12);
            setTimeout(() => this.playBeep(1320, 'sine', 0.15, 0.12), 100);
            setTimeout(() => this.playBeep(1760, 'sine', 0.2, 0.12), 200);
        });
    }

    playBeep(freq, type, duration, vol) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    backgroundColor: '#0a0e14',
    scene: [GameScene],
    banner: false
};

if (document.fonts) {
    Promise.all([
        document.fonts.load('16px "Space Grotesk"'),
        document.fonts.load('16px "Space Grotesk"'),
        document.fonts.load('16px "Inter"'),
        document.fonts.load('bold 16px "Inter"')
    ]).then(() => {
        new Phaser.Game(config);
    }).catch(err => {
        console.error("Font preload failed", err);
        new Phaser.Game(config);
    });
} else {
    new Phaser.Game(config);
}
