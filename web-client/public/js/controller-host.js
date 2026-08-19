function startMatch() {
    if (!socket || !isConnected || !isHost) return;
    persistHostSettings();
    socket.emit('set_game_settings', {
        maxPlayers: hostMaxPlayers,
        ballSpeed: hostBallSpeed,
        durationSeconds: hostDuration
    });
    socket.emit('start_game', {
        durationSeconds: hostDuration,
        maxPlayers: hostMaxPlayers,
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
    let code = (params.get('code') || params.get('token') || params.get('session') || '').trim().toUpperCase();
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
    if (nameInput && name) nameInput.value = name.slice(0, 12);
}
