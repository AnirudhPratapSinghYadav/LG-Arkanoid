GameScene.prototype.drawCourt = function() {
    // Physical bezel hint: this Chromium window is one slice of the panoramic world.
    this.graphics.lineStyle(2, 0x1a2430, 0.9);
    this.graphics.lineBetween(0, 0, 0, CANVAS_H);
    this.graphics.lineBetween(SCREEN_W - 1, 0, SCREEN_W - 1, CANVAS_H);
    this.graphics.fillStyle(0x0a1018, 1);
    this.graphics.fillRect(0, 992, SCREEN_W, 88);
    this.graphics.fillStyle(0x151c26, 1);
    this.graphics.fillRect(0, 988, SCREEN_W, 4);
};

GameScene.prototype.ensureRobotSlots = function(count) {
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
};

GameScene.prototype.setupLeftmostBrand = function() {
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
    // HTML #lgCorner is the only LG/GESOC brand on /1. Never also draw the
    // Phaser copies — that stacked the same two marks on top of each other.
    if (this.logo) this.logo.setVisible(false).setAlpha(0);
    if (this.gesocLogo) this.gesocLogo.setVisible(false).setAlpha(0);
};

GameScene.prototype.setRobotState = function(playerId, state, ms = 2800) {
    if (!playerId) return;
    this.robotStates[playerId] = state;
    if (this._robotStateTimers && this._robotStateTimers[playerId]) {
        clearTimeout(this._robotStateTimers[playerId]);
    }
    this._robotStateTimers = this._robotStateTimers || {};
    this._robotStateTimers[playerId] = setTimeout(() => {
        this.robotStates[playerId] = 'idle';
    }, ms);
};

GameScene.prototype.drawRobots = function() {
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
};

GameScene.prototype.drawPowerUps = function() {
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
};

GameScene.prototype.drawBricks = function() {
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
};

GameScene.prototype.drawBalls = function() {
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
};

GameScene.prototype.drawPaddles = function() {
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
};
