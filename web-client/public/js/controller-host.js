function startMatch() {
    if (!socket || !isConnected || !isHost) return;
    const connected = ((window.__lastGameState && window.__lastGameState.players) || [])
        .filter((p) => p && p.connected).length;
    if (connected < 1) {
        const btn = document.getElementById('startMatchBtn');
        if (btn) btn.textContent = 'Need a paddle';
        return;
    }
    const slots = Math.max(1, Math.min(hostMaxPlayers, connected));
    hostMaxPlayers = slots;
    persistHostSettings();
    socket.emit('start_game', {
        durationSeconds: hostDuration,
        maxPlayers: slots,
        ballSpeed: hostBallSpeed
    });
}

function persistHostSettings() {
    try {
        localStorage.setItem(STORAGE_HOST, JSON.stringify({
            maxPlayers: hostMaxPlayers,
            ballSpeed: hostBallSpeed,
            durationSeconds: hostDuration
        }));
    } catch (_) {}
}

function loadHostSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_HOST);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.maxPlayers >= 1 && data.maxPlayers <= 5) hostMaxPlayers = data.maxPlayers;
        if (typeof data.ballSpeed === 'string') hostBallSpeed = data.ballSpeed;
        if (data.durationSeconds === 0 || data.durationSeconds) hostDuration = data.durationSeconds;
    } catch (_) {}
}

function syncHostChips() {
    document.querySelectorAll('[data-max-players]').forEach((el) => {
        el.classList.toggle('is-on', Number(el.getAttribute('data-max-players')) === hostMaxPlayers);
    });
    document.querySelectorAll('[data-ball-speed]').forEach((el) => {
        el.classList.toggle('is-on', el.getAttribute('data-ball-speed') === hostBallSpeed);
    });
    document.querySelectorAll('[data-duration]').forEach((el) => {
        el.classList.toggle('is-on', Number(el.getAttribute('data-duration')) === hostDuration);
    });
}

function emitHostSettings() {
    if (!socket || !isConnected || !isHost) return;
    persistHostSettings();
    socket.emit('set_game_settings', {
        maxPlayers: hostMaxPlayers,
        ballSpeed: hostBallSpeed,
        durationSeconds: hostDuration
    });
    syncHostChips();
}

function prefillJoin() {
    const params = new URLSearchParams(window.location.search);
    let code = (params.get('c') || params.get('code') || params.get('token') || params.get('session') || '').trim().toUpperCase();
    if (code.indexOf('|') !== -1) {
        const parts = code.split('|');
        code = (parts[parts.length - 1] || '').trim().toUpperCase();
    }
    let name = (params.get('name') || '').trim();
    try {
        if (!name) name = localStorage.getItem(STORAGE_NAME) || '';
    } catch (_) {}
    const tokenInput = document.getElementById('tokenInput');
    const nameInput = document.getElementById('nameInput');
    if (tokenInput && code) tokenInput.value = code.slice(0, 4);
    if (nameInput) {
        if (name) nameInput.value = name.slice(0, 12);
        else if (!nameInput.value) nameInput.value = 'Player';
    }
    // Camera-scanned QR is a real URL with ?c=CODE — join without a second tap.
    if (tokenInput && tokenInput.value.length === 4 && params.get('auto') !== '0') {
        setTimeout(function () { joinGame(); }, 350);
    }
}
