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
        this.load.image('lg_logo', 'assets/lg-logo.webp');
        this.load.image('gesoc_logo', 'assets/gesoc-logo.webp');
    }

    create() {
        const bgGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        bgGraphics.fillStyle(COLORS.bg, 1);
        bgGraphics.fillRect(0, 0, 64, 64);
        bgGraphics.fillStyle(0x0c1420, 1);
        bgGraphics.fillRect(0, 0, 64, 1);
        bgGraphics.generateTexture('bg_court', 64, 64);
        this.bg = this.add.tileSprite(CENTER_X, CENTER_Y, SCREEN_W, CANVAS_H, 'bg_court');
        this.bg.setTint(0xffffff);
        this.bg.setAlpha(1);

        const pGraphics = this.make.graphics({x:0, y:0, add:false});
        pGraphics.fillStyle(COLORS.white, 1);
        pGraphics.fillRect(0, 0, 6, 6);
        pGraphics.generateTexture('particle', 6, 6);
        
        this.brickEmitter = this.add.particles(0, 0, 'particle', {
            speed: { min: 50, max: 300 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            emitting: false
        });

        this.graphics = this.add.graphics();
        this.trailGraphics = this.add.graphics();

        this.robotGraphics = this.add.graphics().setDepth(40);
        this.robots = [];
        this.robotStates = {}; // playerId -> idle|talking|alert|excited
        this.ensureRobotSlots(5);

        this.centerCommentaryTitle = this.add.text(CENTER_X, 448, 'ARKANOID AI', {
            fontFamily: FONTS.heading, fontSize: '18px', color: HEX.system, fontWeight: 'bold', letterSpacing: 3
        }).setOrigin(0.5, 0).setVisible(false).setDepth(60);
        this.centerCommentaryText = this.add.text(CENTER_X, 476, '', {
            fontFamily: FONTS.body, fontSize: '30px', color: HEX.textLight, align: 'center',
            wordWrap: { width: Math.min(1000, SCREEN_W - 64) }
        }).setOrigin(0.5, 0).setVisible(false).setDepth(60);

        this.screenLabel = this.add.text(20, 20, 'SCREEN ' + screenId, {
            fontFamily: FONTS.mono,
            fontSize: '18px',
            color: HEX.textDim
        });

        this.rigStatusText = this.add.text(20, 48, `${numScreens}-SCREEN RIG`, {
            fontFamily: FONTS.mono,
            fontSize: '14px',
            color: HEX.systemAlt,
            fontWeight: 'bold'
        }).setAlpha(0);

        this.bottomStatusText = this.add.text(40, 1020, '', {
            fontFamily: FONTS.mono,
            fontSize: '14px',
            color: HEX.textSecondary,
        });
        if (screenId !== 1) this.bottomStatusText.setVisible(false);

        this.hudPanelGraphics = this.add.graphics();
        this.hudBorderAlpha = 1.0;

        this.hudText = this.add.text(24, 88, '', {
            fontFamily: FONTS.body,
            fontSize: '20px',
            color: HEX.systemAlt,
            lineSpacing: 10
        });
        if (screenId !== 1) this.hudText.setVisible(false);

        this.timerPanelGraphics = this.add.graphics().setDepth(69);
        this.timerLabel = this.add.text(CENTER_X, 10, 'TIME LEFT', {
            fontFamily: FONTS.mono,
            fontSize: '16px',
            color: HEX.accent,
        }).setOrigin(0.5, 0).setDepth(70);
        this.timerText = this.add.text(CENTER_X, 30, '03:00', {
            fontFamily: FONTS.heading,
            fontSize: '56px',
            color: HEX.white,
            stroke: '#05070c',
            strokeThickness: 8,
        }).setOrigin(0.5, 0).setDepth(70);

        this.leaderboardPanelGraphics = this.add.graphics();
        this.leaderboardTexts = [];
        for(let i = 0; i < 5; i++) {
            let txt = this.add.text(CENTER_X, 548 + (i * 88), '', {
                fontFamily: FONTS.mono,
                fontSize: '36px'
            }).setOrigin(0.5, 0).setDepth(55);
            if (screenId !== numScreens) txt.setVisible(false);
            this.leaderboardTexts.push(txt);
        }

        this.leaderboardTitle = this.add.text(CENTER_X, 488, 'LIVE STANDINGS', {
            fontFamily: FONTS.heading,
            fontSize: '40px',
            color: HEX.accent,
            fontWeight: 'bold'
        }).setOrigin(0.5, 0).setDepth(55);
        if (screenId !== numScreens) this.leaderboardTitle.setVisible(false);

        this.geminiCardGraphics = this.add.graphics();
        this.geminiText = this.add.text(SCREEN_W - 40, 300, '', {
            fontFamily: FONTS.body,
            fontSize: '16px',
            color: HEX.textSecondary,
            wordWrap: { width: Math.min(400, SCREEN_W - 80), useAdvancedWrap: true }
        }).setOrigin(1, 0).setVisible(false);

        this.geminiTitle = this.add.text(SCREEN_W - 40, 270, '', {
            fontFamily: FONTS.heading,
            fontSize: '18px',
            color: HEX.accent,
            fontWeight: 'bold'
        }).setOrigin(1, 0).setVisible(false);

        this.aiTagText = this.add.text(40, 10, '', {
            fontFamily: FONTS.mono,
            fontSize: '12px',
            color: HEX.textDim
        }).setAlpha(0);

        this.sessionTokenText = this.add.text(CENTER_X, 560, '', {
            fontFamily: FONTS.heading,
            fontSize: '48px',
            color: HEX.system,
            align: 'center'
        }).setOrigin(0.5, 0.5).setAlpha(0);
        
        this.logo = this.add.image(CENTER_X, 420, 'lg_logo').setOrigin(0.5, 0.5).setAlpha(0);
        this.logo.setScale(0.5);
        this.gesocLogo = this.add.image(CENTER_X, 520, 'gesoc_logo').setOrigin(0.5, 0.5).setAlpha(0);
        this.gesocLogo.setScale(0.5);
        this.setupLeftmostBrand();

        this.powerUpTexts = [];
        this.paddleNameTexts = [];
        this.setupSocket();
        this.fetchSessionInfo();
        this.showBootOverlay('Connecting to lobby…');
        window.addEventListener('resize', () => {
            this.syncQrToCanvas();
            this.syncBootToCanvas();
        });
        this.scale.on('resize', () => {
            this.syncQrToCanvas();
            this.syncBootToCanvas();
        });
    }

    setStageMode(mode) {
        if (typeof document === 'undefined' || !document.body) return;
        const inMatch = mode === 'playing';
        document.body.classList.toggle('is-playing', inMatch);
        document.body.classList.toggle('is-match', inMatch);
        document.body.classList.toggle('is-lobby', mode === 'lobby');
        document.body.classList.toggle('is-idle', mode === 'idle');
        const brand = document.querySelector('.brand-mark');
        const corner = document.getElementById('lgCorner');
        if (brand) brand.style.display = 'none';
        if (inMatch) {
            if (corner) { corner.hidden = true; corner.classList.remove('is-visible'); }
        } else if (mode === 'lobby' && screenId === 1 && corner) {
            corner.hidden = false;
            corner.classList.add('is-visible');
        }
        if (typeof window !== 'undefined') window.__lgStage = mode;
    }

    update() {
        this.graphics.clear();
        this.trailGraphics.clear();
        this.drawCourt();
        
        if (!this.currentState ||
            this.currentState.gameStatus === 'idle' ||
            this.currentState.gameStatus === 'waiting') {
            this.setStageMode('idle');
            this.drawAttractMode();
            return;
        } else {
            this.hideAttractMode();
        }
        
        this.checkStateChanges();
        
        if (this.currentState.gameStatus === 'waiting' || this.currentState.gameStatus === 'lobby') {
            this.setStageMode('lobby');
            this.hideCountdownMode();
            this.hideWinMode();
            this.renderJoin();
            this.updateHUD();
            return;
        } else {
            this.hideJoinMode();
        }
        
        if (this.currentState.gameStatus === 'countdown') {
            this.setStageMode('playing');
            this.hideBootOverlay();
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
        
        if (this.currentState.gameStatus === 'win' ||
            this.currentState.gameStatus === 'time_up' ||
            this.currentState.gameStatus === 'game_over') {
            this.setStageMode('playing');
            this.hideBootOverlay();
            this.drawWinMode();
            this.drawRobots();
            this.updateHUD();
            return;
        } else {
            this.hideWinMode();
        }
        
        this.setStageMode('playing');
        this.drawBricks();
        this.drawPowerUps();
        this.drawBalls();
        this.drawPaddles();
        this.drawRobots();
        this.updateHUD();
    }

    checkStateChanges() {
        if (this.currentState.gameStatus !== this.previousGameStatus) {
            if (this.currentState.gameStatus === 'game_over' || this.currentState.gameStatus === 'time_up') {
                this.playBeep(220, 'sawtooth', 0.4, 0.15);
            } else if (this.currentState.gameStatus === 'win') {
                [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this.playBeep(f, 'sine', 0.2, 0.12), i * 120));
            } else if (this.currentState.gameStatus === 'lobby' || this.currentState.gameStatus === 'waiting') {
                this.clearLobbyQr();
                this.fetchSessionInfo();
                this.winConfettiEmitted = false;
                if (this.cameras && this.cameras.main) {
                    this.cameras.main.setZoom(1);
                    this.cameras.main.setScroll(0, 0);
                }
            }
            this.previousGameStatus = this.currentState.gameStatus;
        }

        if (this.previousPowerupsCollected !== undefined && this.currentState.powerupsCollected > this.previousPowerupsCollected) {
            this.playBeep(700, 'square', 0.08, 0.08);
        }
        this.previousPowerupsCollected = this.currentState.powerupsCollected || 0;

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
                            this.brickEmitter.emitParticleAt(localX + (brick.width || 140) / 2, brick.y + (brick.height || 30) / 2, 10);
                            this.playBeep(600 + (6 - (r % 6)) * 100, 'square', 0.1, 0.05);
                            if (brick.type === 'hard' || brick.type === 'indestructible') {
                                if (!REDUCED_MOTION) this.cameras.main.shake(150, 0.005);
                                this.playBeep(200, 'sawtooth', 0.15, 0.1);
                            } else {
                                if (!REDUCED_MOTION) this.cameras.main.shake(50, 0.002);
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
                if (this.previousLives[p.id] !== undefined && p.lives < this.previousLives[p.id]) {
                    this.playBeep(150, 'sawtooth', 0.3, 0.15);
                }
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
            fontFamily: FONTS.heading,
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

}
