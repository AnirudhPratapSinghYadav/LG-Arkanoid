var socket;
var isConnected = false;
var myPlayerId = null;
var myPlayerNumber = null;
var mySessionId = null;
var mySessionToken = null;
var myResumeToken = null;
var isHost = false;
var isSpectator = false;
var myScore = 0;
var myLives = 3;
var myRank = 1;
var myInventory = [];
var lastPowerUpTime = 0;
var gameEndShown = false;
var playerColor = '#20c5ff';
var pingTimer = null;
var touchControlsReady = false;
var PLAYER_COLORS = ['#20c5ff', '#FF2D78', '#FFB800', '#9B59B6', '#2ECC71'];
var STORAGE_NAME = 'lgark_player_name';
var STORAGE_HOST = 'lgark_host_settings';

var hostMaxPlayers = 2;
var hostBallSpeed = 'medium';
var hostDuration = 180;
var worldNumScreens = 3;
var worldScreenWidth = 1920;
var joinInFlight = false;
var joinTimer = null;

// Swipes are authored for a 3-screen landscape court. Scale by the real court
// width so a 12-screen wall stays reachable and a portrait wall (608 logical px
// per frame) does not fling the paddle across the world.
function worldInputScale() {
    const world = (worldNumScreens || 3) * (worldScreenWidth || 1920);
    return Math.max(0.15, Math.min(5, world / (3 * 1920)));
}

function setJoinBusy(busy, label) {
    joinInFlight = !!busy;
    if (!busy && joinTimer) {
        clearTimeout(joinTimer);
        joinTimer = null;
    }
    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
        joinBtn.disabled = !!busy;
        joinBtn.textContent = label || (busy ? 'Joining…' : 'Join game');
    }
}

function joinGame() {
    if (joinInFlight || isConnected) return;
    const token = document.getElementById('tokenInput').value.trim().toUpperCase();
    const playerName = document.getElementById('nameInput').value.trim() || 'Web Player';
    if (!token || token.length !== 4) {
        const err = document.getElementById('joinError');
        if (err) err.textContent = 'Enter the 4-letter session code from the wall';
        else console.warn('Enter a 4-letter session code');
        return;
    }

    mySessionToken = token;
    try { localStorage.setItem(STORAGE_NAME, playerName); } catch (_) {}
    setJoinBusy(true);
    if (joinTimer) clearTimeout(joinTimer);
    joinTimer = setTimeout(function () {
        if (isConnected) return;
        const err = document.getElementById('joinError');
        if (err) err.textContent = 'Reached the wall but the lobby did not accept us. Scan the center QR again.';
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }
        setJoinBusy(false);
    }, 12000);

    const serverOrigin = controllerServerOrigin();
    probeControllerHealth(serverOrigin).then(function () {
        openJoinSocket(serverOrigin, token, playerName);
    }).catch(function () {
        const err = document.getElementById('joinError');
        if (err) err.textContent = 'Could not reach LG Arkanoid /health on port 8130. Same Wi-Fi, not SSH 22.';
        if (joinTimer) {
            clearTimeout(joinTimer);
            joinTimer = null;
        }
        setJoinBusy(false);
    });
}

function openJoinSocket(serverOrigin, token, playerName) {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
    }

    socket = io(serverOrigin, {
        query: { controller: 'true' },
        transports: ['websocket', 'polling'],
        timeout: 12000
    });

    socket.on('connect_error', () => {
        if (isConnected) return;
        const err = document.getElementById('joinError');
        if (err) err.textContent = 'Could not reach the wall socket. Same Wi-Fi, port 8130, not 22.';
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }
        setJoinBusy(false);
    });

    socket.on('connect', () => {
        if (myPlayerId && mySessionId && myResumeToken) {
            socket.emit('resume_request', {
                playerId: myPlayerId,
                sessionId: mySessionId,
                resumeToken: myResumeToken
            });
        } else {
            socket.emit('join_game', {
                sessionToken: token,
                playerName: playerName
            });
        }
    });

    socket.on('join_confirmed', (data) => {
        setJoinBusy(false);
        isConnected = true;
        myPlayerId = data.playerId;
        myPlayerNumber = data.playerNumber;
        mySessionId = data.sessionId;
        if (data.resumeToken) myResumeToken = data.resumeToken;
        if (data.sessionToken) mySessionToken = data.sessionToken;
        isSpectator = !!data.isSpectator;
        playerColor = PLAYER_COLORS[(Math.max(1, myPlayerNumber) - 1) % PLAYER_COLORS.length];
        gameEndShown = false;

        document.getElementById('joinArea').style.display = 'none';
        document.getElementById('gameArea').style.display = 'flex';
        document.getElementById('gameEndOverlay').classList.remove('active');

        if (isSpectator) {
            document.getElementById('hudPlayerLabel').innerText = 'SPECTATOR';
            document.getElementById('hostControls').style.display = 'none';
            document.getElementById('powerupsRow').style.display = 'none';
            document.getElementById('touchPadWrap').style.display = 'none';
            document.getElementById('spectatorNote').style.display = 'block';
        } else {
            document.getElementById('hudPlayerLabel').innerText = playerName.toUpperCase() + ' · P' + myPlayerNumber;
            document.getElementById('spectatorNote').style.display = 'none';
            document.getElementById('powerupsRow').style.display = 'flex';
            document.getElementById('touchPadWrap').style.display = 'block';
            setupTouchControls();
        }

        document.getElementById('hudDot').style.background = playerColor;
        document.getElementById('hudDot').style.color = playerColor;

        const statusEl = document.getElementById('hudStatus');
        statusEl.style.color = '#4CAF50';
        statusEl.innerHTML = '<span class="hud-status-dot"></span> ONLINE';

        const puck = document.getElementById('touchPuck');
        if (puck) {
            puck.style.background = `radial-gradient(circle, ${playerColor}, ${playerColor}88, ${playerColor}33)`;
            puck.style.boxShadow = `0 0 24px ${playerColor}80`;
        }
        const track = document.getElementById('touchTrack');
        if (track) track.style.background = `linear-gradient(to right, ${playerColor}0D, ${playerColor}66, ${playerColor}0D)`;
        const pad = document.getElementById('touchPad');
        if (pad) pad.style.borderColor = playerColor + '40';
        document.querySelectorAll('.dpad-btn').forEach((btn) => {
            btn.style.borderColor = playerColor + '59';
            btn.style.color = playerColor;
        });

        startPingLoop();
        updatePowerUpButtons();
    });

    socket.on('join_rejected', (data) => {
        setJoinBusy(false);
        const msg = 'Join failed: ' + (data && data.message ? data.message : 'unknown error');
        const err = document.getElementById('joinError');
        if (err) err.textContent = msg;
        else console.warn(msg);
        clearIdentity();
        if (socket) socket.disconnect();
    });

    socket.on('game_state', (state) => {
        if (!state || !state.players) return;

        const players = state.players;
        let me = null;
        for (const p of players) {
            if (p.id === myPlayerId) {
                me = p;
                break;
            }
        }

        if (typeof state.numScreens === 'number') worldNumScreens = state.numScreens;
        if (typeof state.screenWidth === 'number' && state.screenWidth > 0) worldScreenWidth = state.screenWidth;
        window.__lastGameState = state;
        const status = state.gameStatus;

        if (gameEndShown && (status === 'countdown' || status === 'playing')) {
            gameEndShown = false;
            document.getElementById('gameEndOverlay').classList.remove('active');
        }

        isHost = !isSpectator && state.masterPlayerIndex === (myPlayerNumber - 1);
        const inLobby = status === 'lobby' || status === 'waiting';
        document.body.classList.toggle('is-lobby', inLobby);
        document.body.classList.toggle('is-playing', status === 'playing' || status === 'countdown');
        const hostControls = document.getElementById('hostControls');
        if (hostControls) {
            const canStart = isHost && (state.gameStatus === 'lobby' || state.gameStatus === 'waiting');
            hostControls.style.display = canStart ? 'block' : 'none';
            const startBtn = document.getElementById('startMatchBtn');
            if (startBtn && canStart) {
                const connected = players.filter((p) => p && p.connected).length;
                startBtn.disabled = connected < 1;
                startBtn.textContent = connected < 1
                    ? 'Need a paddle'
                    : (connected < (Number(state.maxPlayers) || hostMaxPlayers)
                        ? ('START WITH ' + connected)
                        : 'START MATCH');
            }
        }
        if (isHost && (state.gameStatus === 'lobby' || state.gameStatus === 'waiting')) {
            if (typeof state.maxPlayers === 'number') hostMaxPlayers = state.maxPlayers;
            if (state.ballSpeed) hostBallSpeed = state.ballSpeed;
            if (typeof state.gameDurationSeconds === 'number') hostDuration = state.gameDurationSeconds;
            syncHostChips();
        }

        if (me) {
            myScore = me.score;
            myLives = me.lives;
            myRank = me.rank || 0;
            myInventory = Array.isArray(me.inventory) ? me.inventory.slice() : [];

            document.getElementById('scoreVal').innerText = String(myScore).padStart(5, '0');
            document.getElementById('scoreVal').style.color = playerColor;
            document.getElementById('livesVal').innerText = myLives;
            document.getElementById('livesVal').style.color = myLives <= 1 ? '#D9534F' : '#4CAF50';
            document.getElementById('rankVal').innerText = myRank >= 1 ? '#' + myRank : '—';
            document.getElementById('rankVal').style.color = myRank === 1 ? '#F4A261' : '#4F7CAC';
            updatePowerUpButtons();
        }

        if (state.gameStartedAt && state.gameStatus === 'playing') {
            const elapsed = Math.floor((Date.now() - state.gameStartedAt) / 1000);
            const timerEl = document.getElementById('timerVal');
            const timerLabel = timerEl && timerEl.parentElement && timerEl.parentElement.querySelector('.stat-label');
            if (state.gameDurationSeconds > 0) {
                const remaining = Math.max(0, state.gameDurationSeconds - elapsed);
                const m = String(Math.floor(remaining / 60)).padStart(2, '0');
                const s = String(remaining % 60).padStart(2, '0');
                timerEl.innerText = m + ':' + s;
                timerEl.style.color = remaining <= 30 ? '#D9534F' : '#fff';
                if (timerLabel) timerLabel.textContent = 'TIME';
            } else {
                const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
                const s = String(elapsed % 60).padStart(2, '0');
                timerEl.innerText = m + ':' + s;
                timerEl.style.color = '#fff';
                if (timerLabel) timerLabel.textContent = 'ELAPSED';
            }
        } else if (state.gameStatus === 'lobby' || state.gameStatus === 'waiting') {
            const duration = state.gameDurationSeconds;
            document.getElementById('timerVal').innerText = duration === 0 ? '∞' : '--:--';
        }

        if ((status === 'game_over' || status === 'time_up' || status === 'win') && !gameEndShown) {
            gameEndShown = true;
            const sorted = [...players].sort((a, b) => b.score - a.score);
            const winner = sorted[0];
            const winnerName = winner ? (winner.name || 'Player ' + winner.playerNumber) : 'Nobody';
            const result = state.matchResult;
            const isDraw = result && result.outcome === 'draw';
            const iWon = !isDraw && winner && winner.id === myPlayerId;
            const myPlace = sorted.findIndex((p) => p.id === myPlayerId) + 1;

            let title = 'GAME OVER';
            if (isDraw) title = 'DRAW';
            else if (status === 'time_up') title = iWon ? "TIME'S UP!" : 'TIME\'S UP!';
            else if (iWon) title = 'YOU WIN';
            else if (myPlace === 2) title = '2ND PLACE';
            else if (myPlace > 2) title = 'YOU PLACED #' + myPlace;
            else if (status === 'win') title = 'VICTORY!';

            const kicker = document.getElementById('geKicker');
            if (kicker) {
                kicker.innerText = isDraw
                    ? 'MATCH OVER'
                    : (iWon ? 'CONGRATULATIONS' : 'BETTER LUCK NEXT TIME');
            }
            document.getElementById('geTitle').innerText = title;
            document.getElementById('geSubtitle').innerText = isDraw
                ? 'Same score — nobody wins.'
                : (iWon ? 'You take the wall.' : (winnerName + ' wins this match.'));
            const geMsg = document.getElementById('geMessage');
            if (geMsg) {
                geMsg.innerText = isDraw
                    ? 'It is a tie. Play again or exit.'
                    : (iWon ? (winnerName + ' wins.') : 'Stay for a rematch or exit.');
            }
            const geBoard = document.getElementById('geBoard');
            if (geBoard) {
                geBoard.innerHTML = sorted.slice(0, 5).map((p, i) => {
                    const n = (p.name || ('P' + (p.playerNumber || i + 1)));
                    return '<div>#' + (i + 1) + '  ' + n + '  ' + String(p.score || 0).padStart(5, '0') + '</div>';
                }).join('');
            }
            document.getElementById('geScore').innerText = 'Your Score: ' + myScore;
            document.getElementById('geRank').innerText = 'Final Rank: #' + (myPlace || myRank);
            const hostActions = document.getElementById('geHostActions');
            if (hostActions) hostActions.hidden = !isHost;
            document.getElementById('gameEndOverlay').classList.add('active');

            if (navigator.vibrate) navigator.vibrate(iWon ? [200, 100, 200] : [80]);
        }
    });

    socket.on('lobby_ready', (data) => {
        if (data && data.sessionId) mySessionId = data.sessionId;
        if (data && data.sessionToken) {
            mySessionToken = data.sessionToken;
            const tokenInput = document.getElementById('tokenInput');
            if (tokenInput) tokenInput.value = data.sessionToken;
        }
    });

    socket.on('commentary', (data) => {
        if (data && data.text) {
            window.__lastCommentaryText = data.text;
            document.getElementById('commentaryText').innerText = data.text;
            document.getElementById('commentaryBar').classList.add('active');
            if ('speechSynthesis' in window) {
                const eventType = data.eventType || '';
                if (eventType !== 'life_lost' && eventType !== 'victory') {
                    /* skip long countdown/commentary TTS — that was the ~10s phone buzz */
                } else try {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(data.text);
                    u.lang = 'en-US';
                    u.rate = 0.88;
                    u.pitch = 0.9;
                    u.volume = 1;
                    const voices = window.speechSynthesis.getVoices() || [];
                    const pick = voices.find((v) => /en-US|en_US/.test(v.lang) && /Google|Natural|Premium|Neural|Samantha|David/i.test(v.name))
                        || voices.find((v) => /en-US|en_US/.test(v.lang))
                        || voices.find((v) => /^en/i.test(v.lang));
                    if (pick) u.voice = pick;
                    window.speechSynthesis.speak(u);
                } catch (_) {}
            }
            setTimeout(() => {
                document.getElementById('commentaryBar').classList.remove('active');
            }, 6000);
        }
    });

    socket.on('disconnect', () => {
        isConnected = false;
        const statusEl = document.getElementById('hudStatus');
        statusEl.style.color = '#D9534F';
        statusEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#D9534F;display:inline-block;"></span> RECONNECTING';
    });
}

function updatePowerUpButtons() {
    const counts = { wide_paddle: 0, slow_ball: 0, multi_ball: 0, bomb: 0 };
    for (const item of myInventory) {
        if (counts[item] != null) counts[item] += 1;
    }
    document.querySelectorAll('.powerup-btn').forEach((btn) => {
        const type = btn.getAttribute('data-type');
        const count = counts[type] || 0;
        const badge = btn.querySelector('.pu-count');
        if (badge) badge.innerText = String(count);
        btn.classList.toggle('disabled', count <= 0 || isSpectator);
    });
}

function activatePowerUp(type) {
    if (!socket || !isConnected || !myPlayerId || isSpectator) return;
    if (!myInventory.includes(type)) return;
    const now = Date.now();
    if (now - lastPowerUpTime < 1000) return;

    lastPowerUpTime = now;
    const nonce = Math.random().toString(36).substring(2, 15);
    socket.emit('power_up_activate', {
        powerUpType: type,
        timestamp: now,
        nonce: nonce
    });

    if (navigator.vibrate) navigator.vibrate(50);
}

function clearIdentity() {
    myPlayerId = null;
    myPlayerNumber = null;
    mySessionId = null;
    mySessionToken = null;
    myResumeToken = null;
    isHost = false;
    isSpectator = false;
    myInventory = [];
    isConnected = false;
}

function bindUi() {
    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) joinBtn.addEventListener('click', () => joinGame());

    const startBtn = document.getElementById('startMatchBtn');
    if (startBtn) startBtn.addEventListener('click', () => startMatch());

    document.querySelectorAll('[data-max-players]').forEach((el) => {
        el.addEventListener('click', () => {
            hostMaxPlayers = Number(el.getAttribute('data-max-players'));
            emitHostSettings();
        });
    });
    document.querySelectorAll('[data-ball-speed]').forEach((el) => {
        el.addEventListener('click', () => {
            hostBallSpeed = el.getAttribute('data-ball-speed');
            emitHostSettings();
        });
    });
    document.querySelectorAll('[data-duration]').forEach((el) => {
        el.addEventListener('click', () => {
            hostDuration = Number(el.getAttribute('data-duration'));
            emitHostSettings();
        });
    });

    const rematchBtn = document.getElementById('geRematchBtn');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            if (socket && socket.connected) socket.emit('rematch');
        });
    }
    const newGameBtn = document.getElementById('geNewGameBtn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            gameEndShown = false;
            document.getElementById('gameEndOverlay').classList.remove('active');
            if (socket && socket.connected) socket.emit('return_to_lobby');
        });
    }

    const backBtn = document.getElementById('backToJoinBtn');
    if (backBtn) backBtn.addEventListener('click', () => backToJoin());
    const leaveBtn = document.getElementById('leaveMatchBtn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            if (window.confirm('Leave this session? Scan the wall QR again to rejoin.')) {
                backToJoin();
            }
        });
    }

    const closeAbout = document.getElementById('closeAboutBtn');
    if (closeAbout) {
        closeAbout.addEventListener('click', () => {
            const modal = document.getElementById('aboutModal');
            if (modal) modal.style.display = 'none';
        });
    }

    document.querySelectorAll('.powerup-btn[data-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            if (type) activatePowerUp(type);
        });
    });

    const tokenInput = document.getElementById('tokenInput');
    if (tokenInput) {
        tokenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') joinGame();
        });
    }
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') joinGame();
        });
    }
}

function backToJoin() {
    document.getElementById('gameEndOverlay').classList.remove('active');
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('joinArea').style.display = 'flex';
    gameEndShown = false;
    if (socket) {
        if (socket.connected && myPlayerId && !isSpectator) {
            socket.emit('leave_game');
        }
        socket.removeAllListeners();
        socket.disconnect();
    }
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
    }
    clearIdentity();
    setJoinBusy(false);
}

function startPingLoop() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
        if (socket && socket.connected) {
            const start = Date.now();
            socket.emit('ping_test', {}, () => {
                document.getElementById('hudPing').innerText = (Date.now() - start) + 'ms';
            });
        }
    }, 3000);
}


