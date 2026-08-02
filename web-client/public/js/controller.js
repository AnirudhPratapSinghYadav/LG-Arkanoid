let socket;
let isConnected = false;
let myPlayerId = null;
let myPlayerNumber = null;
let myScore = 0;
let myLives = 3;
let myRank = 1;
let lastPowerUpTime = 0;
let gameEndShown = false;
let playerColor = '#20c5ff';
const PLAYER_COLORS = ['#20c5ff', '#FF2D78', '#FFB800'];

function joinGame() {
    const token = document.getElementById('tokenInput').value.trim().toUpperCase();
    const playerName = document.getElementById('nameInput').value.trim() || 'Web Player';
    if (!token || token.length !== 4) return alert('Enter a 4-letter session code');

    let serverOrigin = window.location.origin;
    if (window.location.port === '5173') {
        serverOrigin = window.location.protocol + '//' + window.location.hostname + ':3000';
    }

    socket = io(serverOrigin, {
        query: { controller: 'true' },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        const nonce = Math.random().toString(36).substring(2, 15);
        socket.emit('join_game', { sessionToken: token, playerName: playerName, timestamp: Date.now(), nonce });
    });

    socket.on('join_confirmed', (data) => {
        isConnected = true;
        myPlayerId = data.playerId;
        myPlayerNumber = data.playerNumber;
        playerColor = PLAYER_COLORS[(myPlayerNumber - 1) % PLAYER_COLORS.length];
        gameEndShown = false;

        document.getElementById('joinArea').style.display = 'none';
        document.getElementById('gameArea').style.display = 'flex';
        document.getElementById('hudPlayerLabel').innerText = playerName.toUpperCase() + ' · P' + myPlayerNumber;
        document.getElementById('hudDot').style.background = playerColor;
        document.getElementById('hudDot').style.color = playerColor;
        
        const statusEl = document.getElementById('hudStatus');
        statusEl.style.color = '#4CAF50';
        statusEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#4CAF50;display:inline-block;"></span> ONLINE';

        const puck = document.getElementById('touchPuck');
        puck.style.background = `radial-gradient(circle, ${playerColor}, ${playerColor}88, ${playerColor}33)`;
        puck.style.boxShadow = `0 0 24px ${playerColor}80`;

        document.getElementById('touchTrack').style.background = `linear-gradient(to right, ${playerColor}0D, ${playerColor}66, ${playerColor}0D)`;
        document.getElementById('touchPad').style.borderColor = playerColor + '40';

        setupTouchControls();
        startPingLoop();

        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    });

    socket.on('join_rejected', (data) => {
        alert('Join failed: ' + data.message);
        socket.disconnect();
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

        if (me) {
            myScore = me.score;
            myLives = me.lives;
            myRank = me.rank || 1;

            document.getElementById('scoreVal').innerText = String(myScore).padStart(5, '0');
            document.getElementById('scoreVal').style.color = playerColor;

            document.getElementById('livesVal').innerText = myLives;
            document.getElementById('livesVal').style.color = myLives <= 1 ? '#D9534F' : '#4CAF50';

            document.getElementById('rankVal').innerText = '#' + myRank;
            document.getElementById('rankVal').style.color = myRank === 1 ? '#F4A261' : '#4F7CAC';
        }

        if (state.gameStartedAt && state.gameStatus === 'playing' && state.gameDurationSeconds > 0) {
            const elapsed = Math.floor((Date.now() - state.gameStartedAt) / 1000);
            const remaining = Math.max(0, state.gameDurationSeconds - elapsed);
            const m = String(Math.floor(remaining / 60)).padStart(2, '0');
            const s = String(remaining % 60).padStart(2, '0');
            document.getElementById('timerVal').innerText = m + ':' + s;
            document.getElementById('timerVal').style.color = remaining <= 30 ? '#D9534F' : '#fff';
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

    socket.on('commentary', (data) => {
        if (data && data.text) {
            document.getElementById('commentaryText').innerText = data.text;
            document.getElementById('commentaryBar').classList.add('active');

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(data.text);
                utterance.rate = 1.1;
                window.speechSynthesis.speak(utterance);
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

function activatePowerUp(type) {
    if (!socket || !isConnected || !myPlayerId) return;
    const now = Date.now();
    if (now - lastPowerUpTime < 5000) return;

    lastPowerUpTime = now;
    const nonce = Math.random().toString(36).substring(2, 15);
    socket.emit('power_up_activate', {
        playerId: myPlayerId,
        powerUpType: type,
        timestamp: now,
        nonce: nonce
    });

    if (navigator.vibrate) navigator.vibrate(50);

    document.querySelectorAll('.powerup-btn').forEach(btn => {
        btn.classList.add('on-cooldown');
    });
    setTimeout(() => {
        document.querySelectorAll('.powerup-btn').forEach(btn => {
            btn.classList.remove('on-cooldown');
        });
    }, 5000);
}

function backToJoin() {
    document.getElementById('gameEndOverlay').classList.remove('active');
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('joinArea').style.display = 'flex';
    gameEndShown = false;
    if (socket) socket.disconnect();
    isConnected = false;
    myPlayerId = null;
}

function startPingLoop() {
    setInterval(() => {
        if (socket && socket.connected) {
            const start = Date.now();
            socket.emit('ping_test', {}, () => {
                const latency = Date.now() - start;
                document.getElementById('hudPing').innerText = latency + 'ms';
            });
        }
    }, 3000);
}

function setupTouchControls() {
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
        if (!isConnected || activeTouchId === null) return;

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
            const nonce = Math.random().toString(36).substring(2, 15);
            socket.emit('paddle_move', {
                deltaX: Math.round(rigDeltaX),
                timestamp: Date.now(),
                nonce
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
        if (!mouseDown || !isConnected) return;
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
            const nonce = Math.random().toString(36).substring(2, 15);
            socket.emit('paddle_move', {
                deltaX: Math.round(rigDeltaX),
                timestamp: Date.now(),
                nonce
            });
        }
        mouseLastX = e.clientX;
    });

    window.addEventListener('mouseup', () => {
        mouseDown = false;
        puck.style.transform = 'translateX(0px)';
    });
}
