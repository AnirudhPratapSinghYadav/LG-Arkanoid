GameScene.prototype.setupSocket = function() {
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
        if (typeof this.hideBootOverlay === 'function') this.hideBootOverlay();
        this.syncMatchEndBar(state);
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
        if (typeof this._ensureVoicesReady === 'function') this._ensureVoicesReady();

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
};

GameScene.prototype.syncMatchEndBar = function(state) {
    const bar = document.getElementById('matchEndBar');
    if (!bar) return;
    const ended = state && (state.gameStatus === 'win' || state.gameStatus === 'time_up' || state.gameStatus === 'game_over');
    bar.hidden = !(isCenterScreen && ended);
    if (!this._matchEndBarBound) {
        this._matchEndBarBound = true;
        const newGame = document.getElementById('matchEndNewGame');
        const rematch = document.getElementById('matchEndRematch');
        if (newGame) {
            newGame.addEventListener('click', () => {
                if (this.socket) this.socket.emit('return_to_lobby');
            });
        }
        if (rematch) {
            rematch.addEventListener('click', () => {
                if (this.socket) this.socket.emit('rematch');
            });
        }
    }
};
