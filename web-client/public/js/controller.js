let socket;
let isConnected = false;
let myPlayerId = null;
let myPlayerNumber = null;
let mySessionId = null;
let mySessionToken = null;
let myResumeToken = null;
let isHost = false;
let isSpectator = false;
let myScore = 0;
let myLives = 3;
let myRank = 1;
let myInventory = [];
let lastPowerUpTime = 0;
let gameEndShown = false;
let playerColor = '#20c5ff';
let pingTimer = null;
let touchControlsReady = false;
const PLAYER_COLORS = ['#20c5ff', '#FF2D78', '#FFB800', '#9B59B6', '#2ECC71'];

function joinGame() {
    const token = document.getElementById('tokenInput').value.trim().toUpperCase();
    const playerName = document.getElementById('nameInput').value.trim() || 'Web Player';
    if (!token || token.length !== 4) return alert('Enter a 4-letter session code');

    mySessionToken = token;

    let serverOrigin = window.location.origin;
    if (window.location.port === '5173') {
        serverOrigin = window.location.protocol + '//' + window.location.hostname + ':3000';
    }

    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
    }

    socket = io(serverOrigin, {
        query: { controller: 'true' },
        transports: ['websocket', 'polling']
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
        isConnected = true;
        myPlayerId = data.playerId;
        myPlayerNumber = data.playerNumber;
        mySessionId = data.sessionId;
        if (data.resumeToken) myResumeToken = data.resumeToken;
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
        puck.style.background = `radial-gradient(circle, ${playerColor}, ${playerColor}88, ${playerColor}33)`;
        puck.style.boxShadow = `0 0 24px ${playerColor}80`;
        document.getElementById('touchTrack').style.background = `linear-gradient(to right, ${playerColor}0D, ${playerColor}66, ${playerColor}0D)`;
        document.getElementById('touchPad').style.borderColor = playerColor + '40';

        startPingLoop();
        updatePowerUpButtons();
    });

    socket.on('join_rejected', (data) => {
        alert('Join failed: ' + (data && data.message ? data.message : 'unknown error'));
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

        isHost = !isSpectator && state.masterPlayerIndex === (myPlayerNumber - 1);
        const hostControls = document.getElementById('hostControls');
        if (hostControls) {
            const canStart = isHost && (state.gameStatus === 'lobby' || state.gameStatus === 'waiting');
            hostControls.style.display = canStart ? 'block' : 'none';
        }

        if (me) {
            myScore = me.score;
            myLives = me.lives;
            myRank = me.rank || 1;
            myInventory = Array.isArray(me.inventory) ? me.inventory.slice() : [];

            document.getElementById('scoreVal').innerText = String(myScore).padStart(5, '0');
            document.getElementById('scoreVal').style.color = playerColor;
            document.getElementById('livesVal').innerText = myLives;
            document.getElementById('livesVal').style.color = myLives <= 1 ? '#D9534F' : '#4CAF50';
            document.getElementById('rankVal').innerText = '#' + myRank;
            document.getElementById('rankVal').style.color = myRank === 1 ? '#F4A261' : '#4F7CAC';
            updatePowerUpButtons();
        }

        if (state.gameStartedAt && state.gameStatus === 'playing' && state.gameDurationSeconds > 0) {
            const elapsed = Math.floor((Date.now() - state.gameStartedAt) / 1000);
            const remaining = Math.max(0, state.gameDurationSeconds - elapsed);
            const m = String(Math.floor(remaining / 60)).padStart(2, '0');
            const s = String(remaining % 60).padStart(2, '0');
            document.getElementById('timerVal').innerText = m + ':' + s;
            document.getElementById('timerVal').style.color = remaining <= 30 ? '#D9534F' : '#fff';
        } else if (state.gameStatus === 'lobby' || state.gameStatus === 'waiting') {
            document.getElementById('timerVal').innerText = '--:--';
            gameEndShown = false;
            document.getElementById('gameEndOverlay').classList.remove('active');
        }

        const status = state.gameStatus;
        if ((status === 'game_over' || status === 'time_up' || status === 'win') && !gameEndShown) {
            gameEndShown = true;
            const sorted = [...players].sort((a, b) => b.score - a.score);
            const winner = sorted[0];
            const winnerName = winner ? (winner.name || 'Player ' + winner.playerNumber) : 'Nobody';

            let title = 'GAME OVER';
            if (status === 'time_up') title = "TIME'S UP!";
            if (status === 'win') title = 'VICTORY!';

            document.getElementById('geTitle').innerText = title;
            document.getElementById('geSubtitle').innerText = winnerName + ' wins!';
            document.getElementById('geScore').innerText = 'Your Score: ' + myScore;
            document.getElementById('geRank').innerText = 'Final Rank: #' + myRank;
            document.getElementById('gameEndOverlay').classList.add('active');

            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    });

    socket.on('lobby_ready', () => {
        gameEndShown = false;
        document.getElementById('gameEndOverlay').classList.remove('active');
    });

    socket.on('commentary', (data) => {
        if (data && data.text) {
            window.__lastCommentaryText = data.text;
            document.getElementById('commentaryText').innerText = data.text;
            document.getElementById('commentaryBar').classList.add('active');
            if ('speechSynthesis' in window) {
                try {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(data.text);
                    u.rate = 1.05;
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
        statusEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#D9534F;display:inline-block;"></span> OFFLINE';
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

function startMatch() {
    if (!socket || !isConnected || !isHost) return;
    socket.emit('start_game', { durationSeconds: 180 });
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

    const backBtn = document.getElementById('backToJoinBtn');
    if (backBtn) backBtn.addEventListener('click', () => backToJoin());

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
} else {
    bindUi();
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

function setupTouchControls() {
    if (touchControlsReady) return;
    touchControlsReady = true;

    const pad = document.getElementById('touchPad');
    const puck = document.getElementById('touchPuck');
    let activeTouchId = null;
    let lastX = 0;

    pad.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (activeTouchId === null && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            lastX = touch.clientX;
        }
    }, { passive: false });

    pad.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isConnected || isSpectator || activeTouchId === null) return;

        let touch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const currentX = touch.clientX;
        const dx = currentX - lastX;
        const absDx = Math.abs(dx);
        const acceleration = 1.0 + Math.min(3.0, absDx / 20.0);
        const rigDeltaX = dx * acceleration * 12;

        let currentTransform = puck.style.transform || 'translateX(0px)';
        let match = currentTransform.match(/translateX\(([^p]+)px\)/);
        let currentOffset = match ? parseFloat(match[1]) : 0;
        currentOffset += dx;
        const maxSlide = pad.clientWidth / 2 - 40;
        currentOffset = Math.max(-maxSlide, Math.min(maxSlide, currentOffset));
        puck.style.transform = `translateX(${currentOffset}px)`;

        if (Math.abs(rigDeltaX) > 0) {
            socket.emit('paddle_move', {
                deltaX: Math.round(rigDeltaX),
                timestamp: Date.now(),
                nonce: Math.random().toString(36).substring(2, 15)
            });
        }
        lastX = currentX;
    }, { passive: false });

    const handleTouchEnd = (e) => {
        if (activeTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                activeTouchId = null;
                puck.style.transform = 'translateX(0px)';
                break;
            }
        }
    };

    pad.addEventListener('touchend', handleTouchEnd);
    pad.addEventListener('touchcancel', handleTouchEnd);

    let mouseDown = false;
    let mouseLastX = 0;

    pad.addEventListener('mousedown', (e) => {
        mouseDown = true;
        mouseLastX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
        if (!mouseDown || !isConnected || isSpectator) return;
        const dx = e.clientX - mouseLastX;
        const absDx = Math.abs(dx);
        const acceleration = 1.0 + Math.min(3.0, absDx / 20.0);
        const rigDeltaX = dx * acceleration * 12;

        let currentTransform = puck.style.transform || 'translateX(0px)';
        let match = currentTransform.match(/translateX\(([^p]+)px\)/);
        let currentOffset = match ? parseFloat(match[1]) : 0;
        currentOffset += dx;
        const maxSlide = pad.clientWidth / 2 - 40;
        currentOffset = Math.max(-maxSlide, Math.min(maxSlide, currentOffset));
        puck.style.transform = `translateX(${currentOffset}px)`;

        if (Math.abs(rigDeltaX) > 0) {
            socket.emit('paddle_move', {
                deltaX: Math.round(rigDeltaX),
                timestamp: Date.now(),
                nonce: Math.random().toString(36).substring(2, 15)
            });
        }
        mouseLastX = e.clientX;
    });

    window.addEventListener('mouseup', () => {
        mouseDown = false;
        puck.style.transform = 'translateX(0px)';
    });
}
