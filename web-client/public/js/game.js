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
        // Solid court — no random starfield. Bezel ticks mark this frame on the LG wall.
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

        this.timerPanelGraphics = this.add.graphics();
        this.timerText = this.add.text(CENTER_X, 40, '00:00', {
            fontFamily: FONTS.heading,
            fontSize: '48px',
            color: HEX.white,
        }).setOrigin(0.5, 0);
        if (!isCenterScreen) this.timerText.setVisible(false);

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

    drawCourt() {
        // Physical bezel hint: this Chromium window is one slice of the panoramic world.
        this.graphics.lineStyle(2, 0x1a2430, 0.9);
        this.graphics.lineBetween(0, 0, 0, CANVAS_H);
        this.graphics.lineBetween(SCREEN_W - 1, 0, SCREEN_W - 1, CANVAS_H);
        this.graphics.fillStyle(0x0a1018, 1);
        this.graphics.fillRect(0, 992, SCREEN_W, 88);
        this.graphics.fillStyle(0x151c26, 1);
        this.graphics.fillRect(0, 988, SCREEN_W, 4);
    }

    ensureRobotSlots(count) {
        while (this.robots.length < count) {
            const bubble = this.add.text(0, 0, '', {
                fontFamily: FONTS.body,
                fontSize: '15px',
                color: HEX.textLight,
                align: 'center',
                backgroundColor: '#0d1117ee',
                padding: { x: 10, y: 6 },
                wordWrap: { width: 220 }
            }).setOrigin(0.5, 1).setAlpha(0).setDepth(45).setVisible(false);
            this.robots.push({ bubble, state: 'idle' });
        }
    }

    setupLeftmostBrand() {
        // Leftmost panoramic browser (/1): official LG + GESOC marks during
        // connect + lobby. Same convention as Super Liquid Galaxy Controller,
        // which writes a ScreenOverlay to slave_{n~/2+2}.kml (the leftmost
        // frame). Arkanoid replaces Earth with Chromium, so the overlay lives
        // in the kiosk page instead of a KML balloon.
        if (screenId !== 1) return;
        document.body.classList.add('is-leftmost-screen');
        const corner = document.getElementById('lgCorner');
        if (corner) {
            corner.hidden = false;
            corner.classList.add('is-visible');
        }
        // Keep Phaser SCREEN label clear of the HTML logo badge.
        if (this.screenLabel) {
            this.screenLabel.setPosition(22, 168);
            this.screenLabel.setText('SCREEN 1');
        }
        if (this.rigStatusText) {
            this.rigStatusText.setPosition(22, 194);
        }
        const maxLogoW = Math.min(160, SCREEN_W * 0.28);
        const place = (img, x) => {
            if (!img) return;
            const w = img.width || 640;
            const scale = Math.min(0.42, maxLogoW / w);
            img.setOrigin(0, 0)
                .setPosition(x, 18)
                .setScale(scale)
                .setAlpha(0)
                .setDepth(70);
        };
        place(this.logo, 18);
        place(this.gesocLogo, 18 + maxLogoW + 10);
    }

    setRobotState(playerId, state, ms = 2800) {
        if (!playerId) return;
        this.robotStates[playerId] = state;
        if (this._robotStateTimers && this._robotStateTimers[playerId]) {
            clearTimeout(this._robotStateTimers[playerId]);
        }
        this._robotStateTimers = this._robotStateTimers || {};
        this._robotStateTimers[playerId] = setTimeout(() => {
            this.robotStates[playerId] = 'idle';
        }, ms);
    }

    pickArcadeVoice() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        return voices.find((v) => /en-US|en_US/.test(v.lang) && /Google|Natural|Premium|Neural|Samantha|David/i.test(v.name))
            || voices.find((v) => /en-US|en_US/.test(v.lang))
            || voices.find((v) => /^en/i.test(v.lang))
            || null;
    }

    speakCommentary(text) {
        if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = 0.88;
            u.pitch = 0.9;
            u.volume = 1;
            const pick = this.pickArcadeVoice();
            if (pick) u.voice = pick;
            window.speechSynthesis.speak(u);
        } catch (_) {}
    }

    playWhistle(kind) {
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const now = ctx.currentTime;
            if (kind === 'go') {
                osc.frequency.setValueAtTime(1800, now);
                osc.frequency.exponentialRampToValueAtTime(700, now + 0.55);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
                osc.start(now);
                osc.stop(now + 0.72);
            } else {
                osc.frequency.setValueAtTime(1400, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.18);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.24);
            }
            osc.connect(gain);
            gain.connect(ctx.destination);
        } catch (_) {}
    }

    syncQrToCanvas() {
        const qr = document.getElementById('qrcode');
        const canvas = document.querySelector('canvas');
        if (!qr || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        qr.style.left = `${rect.left + rect.width / 2}px`;
        qr.style.top = `${rect.top + rect.height * 0.50}px`;
        qr.style.transform = 'translate(-50%, -50%)';
        const scale = Math.min(rect.width / SCREEN_W, rect.height / CANVAS_H);
        const cardW = Math.max(300, Math.min(420, 420 * scale));
        qr.style.width = `${cardW}px`;
        qr.style.maxHeight = `${Math.max(400, Math.min(rect.height * 0.88, 900))}px`;
    }

    drawRobots() {
        if (!this.robotGraphics) return;
        this.robotGraphics.clear();
        const players = (this.currentState && this.currentState.players) || [];
        this.ensureRobotSlots(Math.max(players.length, 3));

        for (let i = 0; i < this.robots.length; i++) {
            const slot = this.robots[i];
            if (slot.bubble) slot.bubble.setVisible(false);
            const p = players[i];
            if (!p || !p.connected || (typeof p.lives === 'number' && p.lives <= 0)) {
                continue;
            }

            const paddleW = p.paddleWidth || 300;
            const worldX = p.paddleX + paddleW / 2;
            const localX = worldX - virtualLeft;
            if (localX < -60 || localX > SCREEN_W + 60) continue;

            const color = PADDLE_COLORS[i % PADDLE_COLORS.length];
            const state = this.robotStates[p.id] || 'idle';
            const bob = state === 'idle' ? Math.sin(this.time.now / 420 + i) * 2 : 0;
            const bodyY = 948 + bob;
            const w = 28;
            const h = 34;

            // Body
            this.robotGraphics.fillStyle(0x161b22, 1);
            this.robotGraphics.fillRoundedRect(localX - w / 2, bodyY - h / 2, w, h, 6);
            this.robotGraphics.lineStyle(2, color, 1);
            this.robotGraphics.strokeRoundedRect(localX - w / 2, bodyY - h / 2, w, h, 6);

            // Visor
            let visor = color;
            if (state === 'alert') visor = COLORS.error;
            else if (state === 'excited') visor = COLORS.game;
            this.robotGraphics.fillStyle(0x05070c, 1);
            this.robotGraphics.fillRect(localX - 10, bodyY - 8, 20, 10);
            this.robotGraphics.fillStyle(visor, 1);
            this.robotGraphics.fillCircle(localX - 5, bodyY - 3, 2.4);
            this.robotGraphics.fillCircle(localX + 5, bodyY - 3, 2.4);

            // Antenna
            this.robotGraphics.lineStyle(2, color, 1);
            this.robotGraphics.lineBetween(localX, bodyY - h / 2, localX, bodyY - h / 2 - 8);
            this.robotGraphics.fillStyle(visor, 1);
            this.robotGraphics.fillCircle(localX, bodyY - h / 2 - 10, 2.5);
        }
    }

    drawAttractMode() {
        this.showBootOverlay('Connecting to lobby…');
        if (!isQrScreen(this.currentState)) {
            this.hideBootOverlay();
            if (!this.bootSideText) {
                this.bootSideText = this.add.text(CENTER_X, 540, '', {
                    fontFamily: FONTS.display,
                    fontSize: '52px',
                    fill: HEX.textPrimary,
                    align: 'center'
                }).setOrigin(0.5).setDepth(6);
            }
            this.bootSideText.setPosition(CENTER_X, screenId === 1 ? 560 : 540);
            this.bootSideText.setText(screenId === 1 ? 'LG ARKANOID' : 'WAITING');
            this.bootSideText.setVisible(true);
        } else if (this.bootSideText) {
            this.bootSideText.setVisible(false);
        }
    }

    hideAttractMode() {
        if (this.attractModeGraphics) this.attractModeGraphics.clear();
        if (this.bootTitleText) this.bootTitleText.setVisible(false);
        if (this.bootSubTitleText) this.bootSubTitleText.setVisible(false);
        if (this.bootLoadingText) this.bootLoadingText.setVisible(false);
        if (this.bootSideText) this.bootSideText.setVisible(false);
    }

    showBootOverlay(statusText) {
        // Connecting card belongs on the center display; side screens keep brand chrome only.
        if (!isQrScreen(this.currentState)) {
            this.hideBootOverlay();
            return;
        }
        const el = document.getElementById('bootOverlay');
        if (!el) return;
        el.classList.remove('is-hidden');
        const status = document.getElementById('bootStatusText');
        if (status && statusText) status.textContent = statusText;
        this.syncBootToCanvas();
    }

    hideBootOverlay() {
        const el = document.getElementById('bootOverlay');
        if (el) el.classList.add('is-hidden');
    }

    syncBootToCanvas() {
        const boot = document.getElementById('bootOverlay');
        const canvas = document.querySelector('canvas');
        if (!boot || !canvas || boot.classList.contains('is-hidden')) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        boot.style.left = `${rect.left + rect.width / 2}px`;
        boot.style.top = `${rect.top + rect.height * 0.48}px`;
        const scale = Math.min(rect.width / SCREEN_W, rect.height / CANVAS_H);
        boot.style.width = `${Math.max(320, Math.min(520, 520 * scale))}px`;
    }
    
    initAmbientTexts() {
        if (!this.lobbyDecorGfx) {
            this.lobbyDecorGfx = this.add.graphics().setDepth(5);
        }
        if (!this.ambientLeftText) {
            this.ambientLeftText = this.add.text(CENTER_X, 250, '', {
                fontFamily: FONTS.display, fontSize: '68px', fill: HEX.systemAlt,
                align: 'center'
            }).setOrigin(0.5, 0).setVisible(false).setDepth(6);
        }
        if (!this.ambientLeftSub) {
            this.ambientLeftSub = this.add.text(CENTER_X, 340, '', {
                fontFamily: FONTS.heading, fontSize: '20px', fill: HEX.textSecondary,
                align: 'center', lineSpacing: 12
            }).setOrigin(0.5, 0).setVisible(false).setDepth(6);
        }
        if (!this.ambientRightText) {
            this.ambientRightText = this.add.text(CENTER_X, 250, '', {
                fontFamily: FONTS.display, fontSize: '68px', fill: HEX.systemAlt,
                align: 'center'
            }).setOrigin(0.5, 0).setVisible(false).setDepth(6);
        }
        if (!this.ambientRightSub) {
            this.ambientRightSub = this.add.text(CENTER_X, 340, '', {
                fontFamily: FONTS.heading, fontSize: '20px', fill: HEX.textSecondary,
                align: 'center', lineSpacing: 12
            }).setOrigin(0.5, 0).setVisible(false).setDepth(6);
        }
        const maxP = (this.currentState && this.currentState.maxPlayers) || 5;
        if (!this.lobbyPlayerTexts) {
            this.lobbyPlayerTexts = [];
        }
        while (this.lobbyPlayerTexts.length < maxP) {
            const idx = this.lobbyPlayerTexts.length;
            const txt = this.add.text(CENTER_X, 470 + (idx * 62), '', {
                fontFamily: FONTS.heading, fontSize: '26px', fill: HEX.textSecondary
            }).setOrigin(0.5).setVisible(false).setDepth(6);
            this.lobbyPlayerTexts.push({ text: txt });
        }
    }

    drawLobbyFrame() {
        if (!this.lobbyDecorGfx) return;
        // Sized as a fraction of the frame: portrait LG frames are only 608
        // logical px wide, so the old fixed 1200px panel spilled off the glass.
        const panelW = Math.min(1200, SCREEN_W * 0.86);
        const panelX = CENTER_X - panelW / 2;
        const inset = panelW * 0.1;
        this.lobbyDecorGfx.clear();
        this.lobbyDecorGfx.fillStyle(0x0a1018, 0.55);
        this.lobbyDecorGfx.fillRect(panelX, 180, panelW, 720);
        this.lobbyDecorGfx.lineStyle(2, 0x2a3a4a, 1);
        this.lobbyDecorGfx.strokeRect(panelX, 180, panelW, 720);
        this.lobbyDecorGfx.lineStyle(1, 0x20c5ff, 0.35);
        this.lobbyDecorGfx.lineBetween(panelX + inset, 430, panelX + panelW - inset, 430);
    }

    layoutSideSlots(maxP) {
        // Keep player rows inside the panel with even spacing under the divider.
        const startY = 490;
        const endY = 860;
        const span = Math.max(1, maxP - 1);
        const step = maxP <= 1 ? 0 : Math.min(70, (endY - startY) / span);
        for (let i = 0; i < this.lobbyPlayerTexts.length; i++) {
            const y = startY + (i * step);
            this.lobbyPlayerTexts[i].text.setPosition(CENTER_X, y);
        }
    }

    renderJoin() {
        this.initAmbientTexts();
        this.hideAttractMode();

        const players = this.currentState.players || [];
        const connectedCount = players.filter((p) => p.connected).length;
        const maxP = this.currentState.maxPlayers || players.length;
        const duration = this.currentState.gameDurationSeconds;
        const durationLabel = duration === 0 ? 'Endless' : `${Math.round((duration || 180) / 60)} min`;
        const screensLabel = `${this.currentState.numScreens || numScreens} screens`;
        const speedLabel = (this.currentState.ballSpeed || 'medium');

        if (this.lobbyDecorGfx) this.lobbyDecorGfx.clear();
        if (this.ambientLeftText) this.ambientLeftText.setVisible(false);
        if (this.ambientLeftSub) this.ambientLeftSub.setVisible(false);
        if (this.ambientRightText) this.ambientRightText.setVisible(false);
        if (this.ambientRightSub) this.ambientRightSub.setVisible(false);
        if (this.lobbyPlayerTexts) this.lobbyPlayerTexts.forEach((p) => p.text.setVisible(false));
        if (this.logo) this.logo.setVisible(false).setAlpha(0);
        if (this.gesocLogo) this.gesocLogo.setVisible(false).setAlpha(0);

        if (screenId === 1) {
            this.hideBootOverlay();
            this.drawLobbyFrame();
            this.layoutSideSlots(maxP);
            if (this.logo) this.logo.setVisible(true).setAlpha(0.9);
            if (this.gesocLogo) this.gesocLogo.setVisible(true).setAlpha(0.9);
            this.ambientLeftText.setText('LG ARKANOID');
            this.ambientLeftText.setVisible(true).setAlpha(0.98);
            this.ambientLeftSub.setText(
                'Phone is the controller\nScan the center QR · enter the 4-letter code\nHost starts the match from the lobby'
            );
            this.ambientLeftSub.setVisible(true).setAlpha(0.92);
            for (let i = 0; i < maxP; i++) {
                const p = players[i];
                const slot = this.lobbyPlayerTexts[i];
                if (!slot) continue;
                const filled = !!(p && p.connected);
                slot.text.setText(
                    filled
                        ? `●   ${(p.name || ('Player ' + (i + 1))).toUpperCase()}   ·   READY`
                        : `○   SLOT ${i + 1}   ·   OPEN`
                );
                slot.text.setColor(filled ? (PLAYER_HEX[i % PLAYER_HEX.length]) : HEX.textDim);
                slot.text.setVisible(true).setAlpha(filled ? 1 : 0.55);
            }
        } else if (isRightmostScreen(this.currentState)) {
            this.hideBootOverlay();
            this.drawLobbyFrame();
            this.layoutSideSlots(maxP);
            this.ambientRightText.setText(`${connectedCount} / ${maxP}`);
            this.ambientRightText.setVisible(true).setAlpha(0.98);
            this.ambientRightSub.setText(
                `Players connected\n${screensLabel}  ·  ${durationLabel}  ·  ${speedLabel}\nWaiting for host to launch`
            );
            this.ambientRightSub.setVisible(true).setAlpha(0.92);
            for (let i = 0; i < maxP; i++) {
                const p = players[i];
                const slot = this.lobbyPlayerTexts[i];
                if (!slot) continue;
                const filled = !!(p && p.connected);
                slot.text.setText(
                    filled
                        ? `▸   ${(p.name || ('Player ' + (i + 1))).toUpperCase()}`
                        : `·   waiting for player ${i + 1}`
                );
                slot.text.setColor(filled ? (PLAYER_HEX[i % PLAYER_HEX.length]) : HEX.textDim);
                slot.text.setVisible(true).setAlpha(filled ? 1 : 0.5);
            }
        } else if (isQrScreen(this.currentState)) {
            const token = this.sessionToken || this.currentState.sessionToken;
            if (!token) {
                this.showBootOverlay('Fetching session code…');
                this.fetchSessionInfo();
            } else {
                this.hideBootOverlay();
                const qrDiv = document.getElementById('qrcode');
                const sessionCodeDiv = document.getElementById('qr-session-code');
                const sessionCodeInline = document.getElementById('qr-session-code-inline');
                const waitingText = document.getElementById('qr-waiting-text');
                const matchMeta = document.getElementById('qr-match-meta');
                const playerList = document.getElementById('qr-player-list');

                qrDiv.style.display = 'flex';
                this.syncQrToCanvas();

                sessionCodeDiv.innerText = token;
                if (sessionCodeInline) sessionCodeInline.innerText = token;

                if (matchMeta) {
                    matchMeta.textContent = '';
                    [
                        `${connectedCount}/${maxP} players`,
                        screensLabel,
                        durationLabel,
                        speedLabel,
                    ].forEach((label) => {
                        const chip = document.createElement('span');
                        chip.className = 'lobby-card__chip';
                        chip.textContent = label;
                        matchMeta.appendChild(chip);
                    });
                }

                if (playerList) {
                    playerList.textContent = '';
                    for (let i = 0; i < maxP; i++) {
                        const p = players[i];
                        const row = document.createElement('div');
                        row.className = 'slot' + (p && p.connected ? ' is-filled' : ' is-empty');
                        const name = document.createElement('span');
                        name.className = 'slot__name';
                        name.textContent = (p && p.connected)
                            ? (p.name || ('Player ' + (i + 1)))
                            : ('Slot ' + (i + 1));
                        const tag = document.createElement('span');
                        tag.className = 'slot__tag';
                        tag.textContent = (p && p.connected) ? 'Ready' : 'Open';
                        row.appendChild(name);
                        row.appendChild(tag);
                        playerList.appendChild(row);
                    }
                }

                if (waitingText) {
                    waitingText.innerText = connectedCount === 0
                        ? 'Waiting for first player…'
                        : 'Host starts the match from the phone';
                }

                const lanIp = this.sessionLanIp || this.currentState.lanIp;
                const port = this.sessionPort || this.currentState.port;
                if (lanIp && !this.qrCodeObj) {
                    const qrData = `LGARK|${lanIp}|${port}|${token}`;
                    this.qrCodeObj = new QRCode(document.getElementById('qrcode-img'), {
                        text: qrData,
                        width: 188,
                        height: 188,
                        colorDark: '#041018',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.L
                    });
                }
            }
        } else {
            this.hideBootOverlay();
            const qrDiv = document.getElementById('qrcode');
            if (qrDiv) qrDiv.style.display = 'none';
            this.drawLobbyFrame();
            const n = liveNumScreens(this.currentState);
            if (this.ambientLeftText) {
                this.ambientLeftText.setText('LOOK CENTER');
                this.ambientLeftText.setVisible(true).setAlpha(0.95);
            }
            if (this.ambientLeftSub) {
                this.ambientLeftSub.setText(
                    `Screen ${screenId} of ${n}\nScan the QR on the middle display\nPhone is the paddle`
                );
                this.ambientLeftSub.setVisible(true).setAlpha(0.9);
            }
        }
    }

    clearLobbyQr() {
        const img = document.getElementById('qrcode-img');
        if (img) img.innerHTML = '';
        this.qrCodeObj = null;
    }

    fetchSessionInfo() {
        // Join code is pushed only to panoramic screen sockets (not /health).
        if (!this.socket || !this.socket.connected) return;
        this.socket.emit('request_session_info');
    }

    applySessionInfo(data) {
        if (!data) return;
        if (data.sessionToken) {
            const prev = this.sessionToken;
            this.sessionToken = data.sessionToken;
            if (prev && prev !== data.sessionToken) {
                this.clearLobbyQr();
            }
        }
        if (data.sessionId) this.sessionId = data.sessionId;
        if (data.lanIp) this.sessionLanIp = data.lanIp;
        if (data.port) this.sessionPort = data.port;
        if (typeof data.numScreens === 'number') this.sessionNumScreens = data.numScreens;
        if (typeof data.maxPlayers === 'number') this.sessionMaxPlayers = data.maxPlayers;
        if (data.ballSpeed) this.sessionBallSpeed = data.ballSpeed;
        if (typeof data.gameDurationSeconds === 'number') {
            this.sessionDurationSeconds = data.gameDurationSeconds;
        }
    }

    hideJoinMode() {
        document.getElementById('qrcode').style.display = 'none';
        this.hideBootOverlay();
        if (this.lobbyDecorGfx) this.lobbyDecorGfx.clear();
        if (this.ambientLeftText) this.ambientLeftText.setVisible(false);
        if (this.ambientLeftSub) this.ambientLeftSub.setVisible(false);
        if (this.ambientRightText) this.ambientRightText.setVisible(false);
        if (this.ambientRightSub) this.ambientRightSub.setVisible(false);
        if (this.lobbyPlayerTexts) this.lobbyPlayerTexts.forEach(p => p.text.setVisible(false));
        if (this.paddleNameTexts) this.paddleNameTexts.forEach((t) => t.setVisible(false));
        if (this.logo) this.logo.setVisible(false).setAlpha(0);
        if (this.gesocLogo) this.gesocLogo.setVisible(false).setAlpha(0);
        this.hideJoinToast();
    }

    hideJoinToast() {
        if (this.joinToastText) {
            this.tweens.killTweensOf(this.joinToastText);
            this.joinToastText.setAlpha(0).setY(-80);
        }
        if (this.joinToastSubText) {
            this.tweens.killTweensOf(this.joinToastSubText);
            this.joinToastSubText.setAlpha(0).setY(-30);
        }
    }

    drawCountdownMode() {
        if (!this.countdownText) {
            this.countdownText = this.add.text(CENTER_X, 540, '', {
                fontFamily: FONTS.display, fontSize: '240px', color: HEX.accent, fontWeight: 'bold'
            }).setOrigin(0.5, 0.5).setDepth(80);
        }
        
        if (isCenterScreen) {
            this.countdownText.setVisible(true);
            let elapsed = Date.now() - (this.currentState.countdownStartedAt || Date.now());
            let remain = 3 - Math.floor(elapsed / 1000);
            if (remain !== this._lastCountRemain) {
                this._lastCountRemain = remain;
                if (remain >= 1 && remain <= 3) this.playWhistle('tick');
                else if (remain <= 0) this.playWhistle('go');
            }
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
        this._lastCountRemain = undefined;
    }

    drawWinMode() {
        if (!this.winTitle) {
            this.winTitle = this.add.text(CENTER_X, 88, 'MATCH OVER', {
                fontFamily: FONTS.heading, fontSize: '52px', color: HEX.game, fontWeight: 'bold'
            }).setOrigin(0.5, 0.5).setDepth(90);
            
            this.winName = this.add.text(CENTER_X, 168, '', {
                fontFamily: FONTS.heading, fontSize: '58px', color: HEX.textPrimary, fontWeight: 'bold'
            }).setOrigin(0.5, 0.5).setDepth(90);

            this.winRatingLabel = this.add.text(CENTER_X, 228, 'FINAL RANKING', {
                fontFamily: FONTS.heading, fontSize: '20px', color: HEX.accent, letterSpacing: 4
            }).setOrigin(0.5, 0.5).setDepth(90);
            
            this.winStatsText = this.add.text(CENTER_X, 262, '', {
                fontFamily: FONTS.body, fontSize: '20px', color: HEX.textSecondary, align: 'center', lineSpacing: 8
            }).setOrigin(0.5, 0).setDepth(90);

            this.winRankTexts = [];
            for (let i = 0; i < 5; i++) {
                this.winRankTexts.push(this.add.text(CENTER_X, 330 + i * 92, '', {
                    fontFamily: FONTS.mono, fontSize: '32px', color: HEX.textPrimary, align: 'center'
                }).setOrigin(0.5, 0).setDepth(90).setVisible(false));
            }

            this.winConfetti = this.add.particles(0, 0, 'particle', {
                x: CENTER_X, y: -50,
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
            if (this.winRatingLabel) this.winRatingLabel.setVisible(true);
            this.winStatsText.setVisible(true);
            
            const status = this.currentState.gameStatus;
            if (status === 'time_up') this.winTitle.setText('TIME UP');
            else if (status === 'game_over') this.winTitle.setText('GAME OVER');
            else this.winTitle.setText('YOU WIN');

            const ranked = [...(this.currentState.players || [])]
                .filter((p) => p && (p.connected || (p.score || 0) > 0))
                .sort((a, b) => (b.score || 0) - (a.score || 0));
            const winner = ranked[0];
            if (winner) {
                this.winName.setText(`${(winner.name || 'PLAYER').toUpperCase()} WINS`);
            } else {
                this.winName.setText('NO WINNER');
            }
            
            this.winStatsText.setText(
                `RALLY ${this.currentState.longestRally || 0}   ·   POWER-UPS ${this.currentState.powerupsCollected || 0}   ·   COMBO ${this.currentState.highestCombo || 0}`
            );

            const medals = ['1ST', '2ND', '3RD', '4TH', '5TH'];
            for (let i = 0; i < this.winRankTexts.length; i++) {
                const row = this.winRankTexts[i];
                if (i < ranked.length) {
                    const p = ranked[i];
                    const stars = i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : 2;
                    const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);
                    const lives = Math.max(0, p.lives || 0);
                    row.setText(
                        `${medals[i]}  ${(p.name || ('P' + (p.playerNumber || i + 1))).toUpperCase()}   ${String(p.score).padStart(5, '0')}   ${starStr}   ${lives}♥`
                    );
                    row.setColor(PLAYER_HEX[(Math.max(1, p.playerNumber) - 1) % PLAYER_HEX.length]);
                    row.setVisible(true);
                } else {
                    row.setVisible(false);
                }
            }
            
            if (!this.winConfettiEmitted && winner) {
                this.winConfettiEmitted = true;
            }
        }
    }
    
    hideWinMode() {
        if (this.winTitle) {
            this.winTitle.setVisible(false);
            this.winName.setVisible(false);
            if (this.winRatingLabel) this.winRatingLabel.setVisible(false);
            if (this.winStatsText) this.winStatsText.setVisible(false);
            if (this.winRankTexts) this.winRankTexts.forEach((t) => t.setVisible(false));
            if (this.winConfetti) this.winConfetti.stop();
            this.winConfettiEmitted = false;
            if (this.cameras && this.cameras.main) {
                this.cameras.main.setZoom(1);
                this.cameras.main.setScroll(0, 0);
            }
        }
    }

    updateHUD() {
        this.hudPanelGraphics.clear();
        this.timerPanelGraphics.clear();
        this.leaderboardPanelGraphics.clear();

        const status = this.currentState && this.currentState.gameStatus;
        const isGameActive = status === 'playing' || status === 'game_over' || status === 'win' || status === 'time_up' || status === 'countdown';

        if (!isGameActive) {
            this.hudText.setVisible(false);
            this.timerText.setVisible(false);
            this.leaderboardTexts.forEach((t) => { if (t) t.setVisible(false); });
            this.leaderboardTitle.setVisible(false);
            this.geminiText.setVisible(false);
            this.geminiTitle.setVisible(false);
            this.geminiCardGraphics.clear();
            if (this.centerCommentaryTitle) this.centerCommentaryTitle.setVisible(false);
            if (this.centerCommentaryText) this.centerCommentaryText.setVisible(false);
            if (this.rigHealthText) this.rigHealthText.setVisible(false);
            if (this.bottomStatusText) this.bottomStatusText.setVisible(false);
            return;
        }

        if (this.bottomStatusText) this.bottomStatusText.setVisible(false);
        if (this.rigHealthText) this.rigHealthText.setVisible(false);
        this.geminiText.setVisible(false);
        this.geminiTitle.setVisible(false);

        if (this.screenLabel) this.screenLabel.setVisible(!isGameActive);
        if (this.rigStatusText) this.rigStatusText.setVisible(false);

        const liveScreens = liveNumScreens(this.currentState);
        const onRight = screenId === liveScreens;

        const showStandings = onRight && (status === 'playing' || status === 'countdown');
        if (screenId === 1) this.hudText.setVisible(true);
        if (isCenterScreen) this.timerText.setVisible(true);
        if (showStandings) {
            this.leaderboardTexts.forEach((t) => { if (t) t.setVisible(true); });
            this.leaderboardTitle.setVisible(true);
        } else {
            this.leaderboardTexts.forEach((t) => { if (t) t.setVisible(false); });
            this.leaderboardTitle.setVisible(false);
        }

        const line = this.currentState.lastCommentary || '';
        if (isCenterScreen && line) {
            this.centerCommentaryTitle.setVisible(true);
            this.centerCommentaryTitle.setText(
                this.currentState.lastCommentarySource === 'gemini' ? 'ARKANOID AI' : 'ARKANOID AI · LOCAL'
            );
            this.centerCommentaryText.setVisible(true);
            if (this._shownCommentary !== line) {
                this._shownCommentary = line;
                this.centerCommentaryText.setText(line);
                this.centerCommentaryText.setY(530);
                this.centerCommentaryText.setAlpha(0);
                this.tweens.killTweensOf(this.centerCommentaryText);
                this.tweens.add({
                    targets: this.centerCommentaryText,
                    y: 476,
                    alpha: 1,
                    duration: 420,
                    ease: 'Cubic.Out',
                });
            }
        } else if (this.centerCommentaryTitle) {
            this.centerCommentaryTitle.setVisible(false);
            this.centerCommentaryText.setVisible(false);
        }

        if (!this.currentState || !this.currentState.players) {
            this.hudText.setText('');
            return;
        }

        const players = this.currentState.players;
        let hudStr = 'LV ' + (this.currentState.currentLevel || 1) + '\n';
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p || !p.connected) continue;
            const name = (p.name || ('P' + (i + 1))).substring(0, 10);
            const lives = '●'.repeat(Math.max(0, Math.min(p.lives, 5)));
            hudStr += name + '  ' + String(p.score).padStart(5, '0') + '  ' + lives + '\n';
        }
        this.hudText.setText(hudStr);
        this.hudText.setColor(HEX.textPrimary);

        if (this.currentState.gameStartedAt && status === 'playing') {
            const elapsed = Math.floor((Date.now() - this.currentState.gameStartedAt) / 1000);
            const duration = this.currentState.gameDurationSeconds ?? 180;
            if (duration > 0) {
                const remaining = Math.max(0, duration - elapsed);
                const m = String(Math.floor(remaining / 60)).padStart(2, '0');
                const s = String(remaining % 60).padStart(2, '0');
                this.timerText.setText(m + ':' + s);
                this.timerText.setColor(remaining <= 30 ? HEX.error : HEX.white);
            } else {
                const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
                const s = String(elapsed % 60).padStart(2, '0');
                this.timerText.setText(m + ':' + s);
                this.timerText.setColor(HEX.game);
            }
        } else if (status === 'countdown') {
            this.timerText.setText('READY');
            this.timerText.setColor(HEX.white);
        } else if (status === 'time_up' || status === 'game_over' || status === 'win') {
            this.timerText.setText(status === 'time_up' ? '00:00' : 'DONE');
            this.timerText.setColor(HEX.error);
        }

        const activePlayers = players.filter((p) => p && p.connected).sort((a, b) => {
            const scoreDelta = (b.score || 0) - (a.score || 0);
            if (scoreDelta !== 0) return scoreDelta;
            return (a.rank || 99) - (b.rank || 99);
        });
        for (let i = 0; i < this.leaderboardTexts.length; i++) {
            if (showStandings && i < activePlayers.length) {
                const p = activePlayers[i];
                const colorHex = PLAYER_HEX[(Math.max(1, p.playerNumber) - 1) % PLAYER_HEX.length];
                const name = (p.name || ('P' + p.playerNumber)).toUpperCase();
                const rank = p.rank || (i + 1);
                const hearts = '♥'.repeat(Math.max(0, Math.min(p.lives, 5))) || '—';
                this.leaderboardTexts[i].setText(
                    '#' + rank + '   ' + name + '   ' + String(p.score).padStart(5, '0') + '   ' + hearts
                );
                this.leaderboardTexts[i].setColor(colorHex);
            } else {
                this.leaderboardTexts[i].setText('');
            }
        }

        if (showStandings && activePlayers.length > 0) {
            this.leaderboardTitle.setVisible(true).setDepth(55);
            this.leaderboardTitle.setText('LIVE STANDINGS');
            const panelY = 468;
            const panelH = 72 + activePlayers.length * 88;
            this.leaderboardPanelGraphics.fillStyle(0x0c1219, 0.78);
            this.leaderboardPanelGraphics.fillRoundedRect(36, panelY, SCREEN_W - 72, panelH, 18);
            this.leaderboardPanelGraphics.lineStyle(2, 0x20c5ff, 0.5);
            this.leaderboardPanelGraphics.strokeRoundedRect(36, panelY, SCREEN_W - 72, panelH, 18);
        }

        if (typeof window !== 'undefined') {
            window.__lgHud = {
                stage: window.__lgStage || '',
                status: status || '',
                standings: showStandings,
                commentary: line,
                lives: players.filter((p) => p && p.connected).map((p) => ({
                    name: p.name, score: p.score, lives: p.lives, rank: p.rank
                })),
            };
        }
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

    drawPowerUps() {
        const powerUps = this.currentState.powerUps;
        if (!powerUps) return;

        this.powerUpTexts.forEach((t) => t.setAlpha(0));
        let tIdx = 0;

        for (const p of powerUps) {
            if (!p.falling) continue;
            const localX = p.x - virtualLeft;
            if (localX < -50 || localX > SCREEN_W + 50) continue;

            let pColor = COLORS.powerRed;
            let pLetter = 'B';
            if (p.type === 'wide_paddle') { pColor = COLORS.powerGreen; pLetter = 'W'; }
            else if (p.type === 'slow_ball') { pColor = COLORS.powerBlue; pLetter = 'S'; }
            else if (p.type === 'multi_ball') { pColor = COLORS.powerYellow; pLetter = 'M'; }

            this.graphics.fillStyle(pColor, 1);
            this.graphics.fillRoundedRect(localX - 22, p.y - 10, 44, 20, 10);
            this.graphics.fillStyle(COLORS.white, 0.35);
            this.graphics.fillRect(localX - 18, p.y - 8, 36, 3);

            if (tIdx >= this.powerUpTexts.length) {
                const txt = this.add.text(0, 0, '', {
                    fontFamily: FONTS.heading,
                    fontSize: '14px',
                    color: '#041018',
                    fontStyle: 'bold',
                }).setOrigin(0.5, 0.5);
                this.powerUpTexts.push(txt);
            }

            const txt = this.powerUpTexts[tIdx++];
            txt.setText(pLetter);
            txt.setColor('#041018');
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
                if (localX < -160 || localX > 2080) continue;

                const gap = 4;
                const drawW = (brick.width || 140) - gap;
                const drawH = (brick.height || 30) - gap;
                const drawX = localX + gap / 2;
                const drawY = brick.y + gap / 2;

                let color = ROW_COLORS[(brick.row != null ? brick.row : r) % ROW_COLORS.length];
                if (brick.type === 'indestructible') color = COLORS.brickSteel;
                else if (brick.type === 'hard') color = COLORS.brickHard;

                this.graphics.fillStyle(color, 1);
                this.graphics.fillRect(drawX, drawY, drawW, drawH);
                this.graphics.fillStyle(0xffffff, 0.28);
                this.graphics.fillRect(drawX, drawY, drawW, 3);
                this.graphics.fillRect(drawX, drawY, 3, drawH);
                this.graphics.fillStyle(0x000000, 0.28);
                this.graphics.fillRect(drawX, drawY + drawH - 3, drawW, 3);
                this.graphics.fillRect(drawX + drawW - 3, drawY, 3, drawH);

                if (brick.type === 'indestructible') {
                    this.graphics.lineStyle(1, 0x2a3038, 0.8);
                    this.graphics.lineBetween(drawX + 6, drawY + 4, drawX + drawW - 6, drawY + drawH - 4);
                    this.graphics.lineBetween(drawX + drawW - 6, drawY + 4, drawX + 6, drawY + drawH - 4);
                } else if (brick.type === 'hard') {
                    this.graphics.lineStyle(1, 0xffffff, 0.35);
                    this.graphics.strokeRect(drawX + 4, drawY + 4, drawW - 8, drawH - 8);
                }
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
            const radius = ball.radius || 8;

            if (!this.ballTrails[i]) this.ballTrails[i] = [];
            this.ballTrails[i].push({ x: localX, y: ball.y });
            if (this.ballTrails[i].length > 8) this.ballTrails[i].shift();

            if (localX < -40 || localX > SCREEN_W + 40) continue;

            for (let t = 0; t < this.ballTrails[i].length; t++) {
                const pos = this.ballTrails[i][t];
                const alpha = (t + 1) / this.ballTrails[i].length;
                this.trailGraphics.fillStyle(COLORS.white, alpha * 0.28);
                this.trailGraphics.fillCircle(pos.x, pos.y, radius * alpha);
            }

            this.graphics.fillStyle(COLORS.white, 1);
            this.graphics.fillCircle(localX, ball.y, radius);
            this.graphics.fillStyle(0xd0e8ff, 1);
            this.graphics.fillCircle(localX - 2, ball.y - 2, Math.max(2, radius * 0.35));
        }
    }

    drawPaddles() {
        const players = this.currentState.players;
        if (!players) return;

        const entries = Array.isArray(players) ? players : Object.values(players);
        while (this.paddleNameTexts.length < entries.length) {
            const txt = this.add.text(0, 0, '', {
                fontFamily: FONTS.heading,
                fontSize: '14px',
                color: HEX.white,
                fontStyle: 'bold',
            }).setOrigin(0.5, 1).setDepth(50);
            this.paddleNameTexts.push(txt);
        }

        for (let i = 0; i < entries.length; i++) {
            const player = entries[i];
            const nameText = this.paddleNameTexts[i];
            if (!player || !player.connected) {
                if (nameText) nameText.setVisible(false);
                continue;
            }

            const paddleX = player.paddleX !== undefined ? player.paddleX : player.x;
            const paddleWidth = player.paddleWidth !== undefined ? player.paddleWidth : player.width || 200;
            const playerNumber = player.playerNumber !== undefined ? player.playerNumber : (i + 1);
            if (paddleX === undefined) {
                if (nameText) nameText.setVisible(false);
                continue;
            }

            const localX = paddleX - virtualLeft;
            const color = PADDLE_COLORS[(playerNumber - 1) % PADDLE_COLORS.length];
            if (localX + paddleWidth < 0 || localX > SCREEN_W) {
                if (nameText) nameText.setVisible(false);
                continue;
            }

            let drawAlpha = 1;
            if (this.lostConnectionPids && this.lostConnectionPids[player.id]) {
                const elapsed = Date.now() - this.lostConnectionPids[player.id];
                drawAlpha = 0.4 + (Math.sin(elapsed / 150) * 0.2);
            }

            const py = 1000;
            const ph = 18;
            this.graphics.fillStyle(color, drawAlpha);
            this.graphics.fillRoundedRect(localX, py, paddleWidth, ph, 8);
            this.graphics.fillStyle(0xffffff, 0.35 * drawAlpha);
            this.graphics.fillRect(localX + 8, py + 2, paddleWidth - 16, 3);

            if (nameText) {
                nameText.setText((player.name || ('P' + playerNumber)).substring(0, 10));
                nameText.setColor(PLAYER_HEX[(playerNumber - 1) % PLAYER_HEX.length]);
                nameText.setPosition(localX + paddleWidth / 2, py - 8);
                nameText.setVisible(true);
                nameText.setAlpha(drawAlpha);
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

        this.socket.on('session_info', (data) => {
            this.applySessionInfo(data);
        });

        this.socket.on('connect', () => {
            this.fetchSessionInfo();
            // Report the viewport we actually got so a wrong LG_FRAME_ASPECT
            // shows up in the server log instead of as a letterboxed wall.
            this.socket.emit('screen_register', {
                screenId: screenId,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1,
            });
            const measured = window.innerWidth / window.innerHeight;
            const configured = SCREEN_W / CANVAS_H;
            if (Math.abs(measured - configured) / configured > 0.08) {
                console.warn(
                    `[LG] Frame aspect mismatch: viewport ${window.innerWidth}x${window.innerHeight} ` +
                    `but court is ${SCREEN_W}x${CANVAS_H}. Relaunch with LG_FRAME_ASPECT=` +
                    (measured < 1 ? '9:16' : '16:9')
                );
            }
        });

        this.socket.on('lobby_ready', (data) => {
            if (data && data.sessionToken) {
                this.applySessionInfo(data);
            } else {
                this.clearLobbyQr();
                this.sessionToken = null;
                this.fetchSessionInfo();
            }
        });

        this.socket.on('game_state', (state) => {
            if (!state.bricks && this.currentState && this.currentState.bricks) {
                state.bricks = this.currentState.bricks;
            }
            // Keep client-only commentary text across authoritative ticks.
            if (this.currentState && this.currentState.lastCommentary && !state.lastCommentary) {
                state.lastCommentary = this.currentState.lastCommentary;
            }
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
            if (!REDUCED_MOTION) this.cameras.main.flash(300, 255, 0, 0, false);
        });

        this.socket.on('player_disconnected', (data) => {
            if (this.lostConnectionPids && data.playerId) {
                delete this.lostConnectionPids[data.playerId];
            }
        });

        this.socket.on('commentary_thinking', () => {});

        this.socket.on('commentary', (data) => {
            if (data.eventType === 'life_lost') {
                if (!REDUCED_MOTION) this.cameras.main.shake(200, 0.01);
            }

            const message = data.text || data.message || '';

            if (data.eventType === 'rank_takeover' && data.playerId) {
                this._rankSwapHighlightPids = this._rankSwapHighlightPids || {};
                this._rankSwapHighlightPids[data.playerId] = true;
                setTimeout(() => {
                    if (this._rankSwapHighlightPids) {
                        this._rankSwapHighlightPids[data.playerId] = false;
                    }
                }, 1500);
            }

            if (this.currentState) {
                this.currentState.lastCommentary = message;
            }

            // Drive neon robots from commentary events
            const players = (this.currentState && this.currentState.players) || [];
            let targetId = data.playerId || null;
            if (!targetId && data.eventType === 'life_lost') {
                const hurt = players.find((p) => p.connected && p.lives >= 0);
                targetId = hurt && hurt.id;
            }
            const state =
                data.eventType === 'life_lost' ? 'alert' :
                (data.eventType === 'multi_ball' || data.eventType === 'level_cleared') ? 'excited' :
                'talking';
            if (targetId) {
                this.setRobotState(targetId, state);
            } else {
                players.filter((p) => p.connected).forEach((p) => this.setRobotState(p.id, state, 2200));
            }

            if (isCenterScreen) this.speakCommentary(message);
        });

        this.socket.on('level_source', (data) => {
            if (data.aiGenerated && this.aiTagText) {
                this.aiTagText.setText('LEVEL ' + (this.currentState?.currentLevel || ''));
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
                this.joinToastText = this.add.text(CENTER_X, -80, '', {
                    fontFamily: FONTS.display,
                    fontSize: '48px',
                    color: HEX.successBright,
                    align: 'center',
                    backgroundColor: HEX.bgPanelAlpha,
                    padding: { x: 40, y: 16 }
                }).setOrigin(0.5, 0.5).setDepth(500);
            }

            if (!this.joinToastSubText) {
                this.joinToastSubText = this.add.text(CENTER_X, -30, '', {
                    fontFamily: FONTS.body,
                    fontSize: '20px',
                    color: HEX.textSecondary,
                    align: 'center'
                }).setOrigin(0.5, 0.5).setDepth(500);
            }

            this.joinToastText.setText(`${playerName} JOINED`);
            this.joinToastSubText.setText(`P${playerNumber} · ${connectedCount}/${data.maxPlayers || connectedCount} connected`);

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
                        delay: 1400,
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
                        delay: 1400,
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
