GameScene.prototype.updateHUD = function() {
    this.hudPanelGraphics.clear();
    this.timerPanelGraphics.clear();
    this.leaderboardPanelGraphics.clear();

    const status = this.currentState && this.currentState.gameStatus;
    const isGameActive = status === 'playing' || status === 'game_over' || status === 'win' || status === 'time_up' || status === 'countdown';

    if (!isGameActive) {
        this.hudText.setVisible(false);
        this.timerText.setVisible(false);
        if (this.timerLabel) this.timerLabel.setVisible(false);
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
    const matchEnded = status === 'win' || status === 'time_up' || status === 'game_over';
    const showStandings = onRight && (status === 'playing' || status === 'countdown' || matchEnded);
    if (screenId === 1) this.hudText.setVisible(true);
    this.timerText.setVisible(true);
    if (this.timerLabel) this.timerLabel.setVisible(true);
    if (showStandings) {
        this.leaderboardTexts.forEach((t) => { if (t) t.setVisible(true); });
        this.leaderboardTitle.setVisible(true);
    } else {
        this.leaderboardTexts.forEach((t) => { if (t) t.setVisible(false); });
        this.leaderboardTitle.setVisible(false);
    }

    const line = this.currentState.lastCommentary || '';
    if (isCenterScreen && line && !matchEnded) {
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

    let remainingForPill = null;
    if (this.currentState.gameStartedAt && status === 'playing') {
        const elapsed = Math.floor((Date.now() - this.currentState.gameStartedAt) / 1000);
        const duration = this.currentState.gameDurationSeconds ?? 180;
        if (duration > 0) {
            const remaining = Math.max(0, duration - elapsed);
            remainingForPill = remaining;
            const m = String(Math.floor(remaining / 60)).padStart(2, '0');
            const s = String(remaining % 60).padStart(2, '0');
            this.timerText.setText(m + ':' + s);
            this.timerText.setColor(remaining <= 30 ? HEX.error : HEX.white);
            if (this.timerLabel) {
                this.timerLabel.setText('TIME LEFT');
                this.timerLabel.setColor(remaining <= 30 ? HEX.error : HEX.accent);
            }
        } else {
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            this.timerText.setText(m + ':' + s);
            this.timerText.setColor(HEX.game);
            if (this.timerLabel) {
                this.timerLabel.setText('ELAPSED');
                this.timerLabel.setColor(HEX.game);
            }
        }
    } else if (status === 'countdown') {
        this.timerText.setText('READY');
        this.timerText.setColor(HEX.white);
        if (this.timerLabel) {
            this.timerLabel.setText('MATCH STARTS');
            this.timerLabel.setColor(HEX.accent);
        }
    } else if (matchEnded) {
        this.timerText.setText(status === 'time_up' ? '00:00' : 'DONE');
        this.timerText.setColor(HEX.error);
        if (this.timerLabel) {
            this.timerLabel.setText(status === 'time_up' ? 'TIME UP' : 'MATCH OVER');
            this.timerLabel.setColor(HEX.error);
        }
    }

    const pillW = 280;
    const pillH = 88;
    const pillX = CENTER_X - pillW / 2;
    const pillColor = (remainingForPill != null && remainingForPill <= 30) || matchEnded ? 0xe63946 : 0x20c5ff;
    this.timerPanelGraphics.fillStyle(0x05070c, 0.88);
    this.timerPanelGraphics.fillRoundedRect(pillX, 4, pillW, pillH, 16);
    this.timerPanelGraphics.lineStyle(2, pillColor, 0.85);
    this.timerPanelGraphics.strokeRoundedRect(pillX, 4, pillW, pillH, 16);

    const boardPlayers = ((status === 'playing' || status === 'countdown')
        ? players.filter((p) => p && p.connected)
        : players.filter((p) => p && (p.connected || (p.score || 0) > 0 || p.name))
    ).sort((a, b) => {
        const scoreDelta = (b.score || 0) - (a.score || 0);
        if (scoreDelta !== 0) return scoreDelta;
        return (a.rank || 99) - (b.rank || 99);
    });
    for (let i = 0; i < this.leaderboardTexts.length; i++) {
        if (showStandings && i < boardPlayers.length) {
            const p = boardPlayers[i];
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

    if (showStandings && boardPlayers.length > 0) {
        this.leaderboardTitle.setVisible(true).setDepth(55);
        this.leaderboardTitle.setText(matchEnded ? 'FINAL LEADERBOARD' : 'LIVE STANDINGS');
        const panelY = 468;
        const panelH = 72 + boardPlayers.length * 88;
        this.leaderboardPanelGraphics.fillStyle(0x0c1219, 0.78);
        this.leaderboardPanelGraphics.fillRoundedRect(36, panelY, SCREEN_W - 72, panelH, 18);
        this.leaderboardPanelGraphics.lineStyle(2, matchEnded ? 0xffc300 : 0x20c5ff, 0.5);
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
};

GameScene.prototype.drawWinMode = function() {
    if (!this.winTitle) {
        this.winCongrats = this.add.text(CENTER_X, 118, 'CONGRATULATIONS', {
            fontFamily: FONTS.heading, fontSize: '26px', color: HEX.game, fontWeight: 'bold', letterSpacing: 6
        }).setOrigin(0.5, 0.5).setDepth(90);

        this.winTitle = this.add.text(CENTER_X, 164, 'MATCH OVER', {
            fontFamily: FONTS.heading, fontSize: '40px', color: HEX.accent, fontWeight: 'bold'
        }).setOrigin(0.5, 0.5).setDepth(90);

        this.winName = this.add.text(CENTER_X, 226, '', {
            fontFamily: FONTS.heading, fontSize: '52px', color: HEX.textPrimary, fontWeight: 'bold'
        }).setOrigin(0.5, 0.5).setDepth(90);

        this.winMessage = this.add.text(CENTER_X, 286, '', {
            fontFamily: FONTS.body, fontSize: '22px', color: HEX.white, align: 'center',
            wordWrap: { width: SCREEN_W - 120, useAdvancedWrap: true }
        }).setOrigin(0.5, 0.5).setDepth(90);

        this.winRatingLabel = this.add.text(CENTER_X, 338, 'FINAL LEADERBOARD', {
            fontFamily: FONTS.heading, fontSize: '22px', color: HEX.accent, letterSpacing: 4
        }).setOrigin(0.5, 0.5).setDepth(90);

        this.winStatsText = this.add.text(CENTER_X, 368, '', {
            fontFamily: FONTS.body, fontSize: '18px', color: HEX.textSecondary, align: 'center', lineSpacing: 8
        }).setOrigin(0.5, 0).setDepth(90);

        this.winRankTexts = [];
        for (let i = 0; i < 5; i++) {
            this.winRankTexts.push(this.add.text(CENTER_X, 410 + i * 86, '', {
                fontFamily: FONTS.mono, fontSize: '30px', color: HEX.textPrimary, align: 'center'
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

    const status = this.currentState.gameStatus;
    const ranked = [...(this.currentState.players || [])]
        .filter((p) => p && (p.connected || (p.score || 0) > 0 || p.name))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = ranked[0];
    const winnerName = (winner && (winner.name || ('P' + (winner.playerNumber || 1)))) || 'PLAYER';
    const comment = (this.currentState.lastCommentary || '').trim();
    let oneLiner = comment;
    if (!oneLiner || oneLiner.length < 8) {
        if (status === 'time_up') oneLiner = 'Congratulations ' + winnerName + ' — the clock hit zero and you own the wall.';
        else if (status === 'game_over') oneLiner = 'Congratulations ' + winnerName + ' — last paddle standing.';
        else oneLiner = 'Congratulations ' + winnerName + ' — you cleared the Liquid Galaxy wall.';
    }

    if (status === 'time_up') this.winTitle.setText('TIME UP');
    else if (status === 'game_over') this.winTitle.setText('GAME OVER');
    else this.winTitle.setText('YOU WIN');

    this.winName.setText(winnerName.toUpperCase() + ' WINS');
    this.winMessage.setText(oneLiner);

    const onRight = isRightmostScreen(this.currentState);
    const showFullBoard = isCenterScreen;

    if (this.winCongrats) this.winCongrats.setVisible(true);
    this.winTitle.setVisible(true);
    this.winName.setVisible(true);
    if (this.winMessage) this.winMessage.setVisible(true);

    if (showFullBoard) {
        if (this.winRatingLabel) this.winRatingLabel.setVisible(true);
        this.winStatsText.setVisible(true);
        this.winStatsText.setText(
            'RALLY ' + (this.currentState.longestRally || 0) +
            '   ·   POWER-UPS ' + (this.currentState.powerupsCollected || 0) +
            '   ·   COMBO ' + (this.currentState.highestCombo || 0)
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
                    medals[i] + '  ' + (p.name || ('P' + (p.playerNumber || i + 1))).toUpperCase() +
                    '   ' + String(p.score || 0).padStart(5, '0') +
                    '   ' + starStr + '   ' + lives + '♥'
                );
                row.setColor(PLAYER_HEX[(Math.max(1, p.playerNumber) - 1) % PLAYER_HEX.length]);
                row.setVisible(true);
            } else {
                row.setVisible(false);
            }
        }
    } else {
        if (this.winRatingLabel) this.winRatingLabel.setVisible(false);
        this.winStatsText.setVisible(false);
        if (this.winRankTexts) this.winRankTexts.forEach((t) => t.setVisible(false));
        if (onRight) {
            this.winCongrats.setY(120);
            this.winTitle.setY(168);
            this.winName.setY(230);
            this.winMessage.setY(300);
        } else if (!isCenterScreen) {
            this.winCongrats.setY(200);
            this.winTitle.setY(268);
            this.winName.setY(350);
            this.winMessage.setY(430);
        }
    }

    if (isCenterScreen && !this.winConfettiEmitted && winner) {
        this.winConfettiEmitted = true;
        if (this.winConfetti && typeof this.winConfetti.explode === 'function') {
            this.winConfetti.explode(48);
        }
    }
};

GameScene.prototype.hideWinMode = function() {
    if (this.winTitle) {
        this.winTitle.setVisible(false);
        this.winName.setVisible(false);
        if (this.winCongrats) this.winCongrats.setVisible(false);
        if (this.winMessage) this.winMessage.setVisible(false);
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
};
