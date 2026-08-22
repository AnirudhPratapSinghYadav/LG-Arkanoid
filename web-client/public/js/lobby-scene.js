GameScene.prototype.syncQrToCanvas = function() {
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
};

GameScene.prototype.drawAttractMode = function() {
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
};

GameScene.prototype.hideAttractMode = function() {
    if (this.attractModeGraphics) this.attractModeGraphics.clear();
    if (this.bootTitleText) this.bootTitleText.setVisible(false);
    if (this.bootSubTitleText) this.bootSubTitleText.setVisible(false);
    if (this.bootLoadingText) this.bootLoadingText.setVisible(false);
    if (this.bootSideText) this.bootSideText.setVisible(false);
};

GameScene.prototype.showBootOverlay = function(statusText) {
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
};

GameScene.prototype.hideBootOverlay = function() {
    const el = document.getElementById('bootOverlay');
    if (el) el.classList.add('is-hidden');
};

GameScene.prototype.syncBootToCanvas = function() {
    const boot = document.getElementById('bootOverlay');
    const canvas = document.querySelector('canvas');
    if (!boot || !canvas || boot.classList.contains('is-hidden')) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    boot.style.left = `${rect.left + rect.width / 2}px`;
    boot.style.top = `${rect.top + rect.height * 0.48}px`;
    const scale = Math.min(rect.width / SCREEN_W, rect.height / CANVAS_H);
    boot.style.width = `${Math.max(320, Math.min(520, 520 * scale))}px`;
};

GameScene.prototype.initAmbientTexts = function() {
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
};

GameScene.prototype.drawLobbyFrame = function() {
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
};

GameScene.prototype.layoutSideSlots = function(maxP) {
    // Keep player rows inside the panel with even spacing under the divider.
    const startY = 490;
    const endY = 860;
    const span = Math.max(1, maxP - 1);
    const step = maxP <= 1 ? 0 : Math.min(70, (endY - startY) / span);
    for (let i = 0; i < this.lobbyPlayerTexts.length; i++) {
        const y = startY + (i * step);
        this.lobbyPlayerTexts[i].text.setPosition(CENTER_X, y);
    }
};

GameScene.prototype.renderJoin = function() {
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
        if (this.logo) this.logo.setVisible(false).setAlpha(0);
        if (this.gesocLogo) this.gesocLogo.setVisible(false).setAlpha(0);
        this.ambientLeftText.setText('LG ARKANOID');
        this.ambientLeftText.setVisible(true).setAlpha(0.98);
        this.ambientLeftSub.setText(
            '1  Look at the CENTER screen for the QR\n2  Phone = paddle (app or /controller)\n3  First player is HOST — they press CREATE & START'
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

            if (qrDiv) {
                qrDiv.style.display = 'flex';
                this.syncQrToCanvas();
            }
            if (sessionCodeDiv) sessionCodeDiv.innerText = token;
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
            // Pacman: phone opens http://masterIp:PORT/controller. Encode that
            // URL so a camera / browser can open a paddle, not a private LGARK blob.
            const joinUrl = (lanIp && token)
                ? `http://${lanIp}:${port || 8130}/controller?c=${encodeURIComponent(token)}`
                : '';
            const urlEl = document.getElementById('qr-controller-url');
            if (urlEl) {
                urlEl.textContent = joinUrl || 'Waiting for LAN IPv4…';
            }
            if (joinUrl && this.qrJoinUrl !== joinUrl) {
                this.clearLobbyQr();
                this.qrJoinUrl = joinUrl;
                this.qrCodeObj = new QRCode(document.getElementById('qrcode-img'), {
                    text: joinUrl,
                    width: 188,
                    height: 188,
                    colorDark: '#041018',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
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
                `Screen ${screenId} of ${n}\nQR is on the CENTER display\nPhone is the paddle — host starts`
            );
            this.ambientLeftSub.setVisible(true).setAlpha(0.9);
        }
    }
};

GameScene.prototype.clearLobbyQr = function() {
    const img = document.getElementById('qrcode-img');
    if (img) img.innerHTML = '';
    this.qrCodeObj = null;
    this.qrJoinUrl = '';
};

GameScene.prototype.fetchSessionInfo = function() {
    // Join code is pushed only to panoramic screen sockets (not /health).
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('request_session_info');
};

GameScene.prototype.applySessionInfo = function(data) {
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
};

GameScene.prototype.hideJoinMode = function() {
    const qr = document.getElementById('qrcode');
    if (qr) qr.style.display = 'none';
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
};

GameScene.prototype.hideJoinToast = function() {
    if (this.joinToastText) {
        this.tweens.killTweensOf(this.joinToastText);
        this.joinToastText.setAlpha(0).setY(-80);
    }
    if (this.joinToastSubText) {
        this.tweens.killTweensOf(this.joinToastSubText);
        this.joinToastSubText.setAlpha(0).setY(-30);
    }
};

GameScene.prototype.drawCountdownMode = function() {
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
};

GameScene.prototype.hideCountdownMode = function() {
    if (this.countdownText) this.countdownText.setVisible(false);
    this._lastCountRemain = undefined;
};
