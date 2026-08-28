function setupTouchControls() {
    if (touchControlsReady) return;
    touchControlsReady = true;

    const left = document.getElementById('dpadLeft');
    const right = document.getElementById('dpadRight');
    if (!left || !right) return;

    let holdTimer = null;

    function stopHold() {
        if (holdTimer) {
            clearInterval(holdTimer);
            holdTimer = null;
        }
    }

    function startHold(step) {
        stopHold();
        if (!isConnected || isSpectator) return;
        window.__lgPaddleDelta(step);
        holdTimer = setInterval(function () {
            window.__lgPaddleDelta(step);
        }, 30);
    }

    function bindHold(el, dir) {
        const stepFor = function () {
            return dir * 48 * worldInputScale();
        };
        el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            startHold(stepFor());
        });
        el.addEventListener('pointerup', stopHold);
        el.addEventListener('pointercancel', stopHold);
        el.addEventListener('pointerleave', stopHold);
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    bindHold(left, -1);
    bindHold(right, 1);
    window.addEventListener('blur', stopHold);
    setupSwipePad();
}

function setupSwipePad() {
    const pad = document.getElementById('swipePad');
    if (!pad || pad.dataset.ready === '1') return;
    pad.dataset.ready = '1';
    let lastX = null;
    pad.addEventListener('pointerdown', function (e) {
        lastX = e.clientX;
        try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    });
    pad.addEventListener('pointermove', function (e) {
        if (lastX == null) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        if (Math.abs(dx) < 1) return;
        window.__lgPaddleDelta(dx * 3.2 * worldInputScale());
    });
    function endSwipe() { lastX = null; }
    pad.addEventListener('pointerup', endSwipe);
    pad.addEventListener('pointercancel', endSwipe);
}

window.__lgPaddleDelta = function (dx) {
    if (!socket || !socket.connected || isSpectator) return false;
    const n = Number(dx);
    if (!Number.isFinite(n) || n === 0) return false;
    socket.emit('paddle_move', {
        deltaX: Math.round(n),
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
    });
    return true;
};
window.__lgStartMatch = startMatch;
window.__lgControllerMeta = function () {
    return {
        host: isHost,
        connected: isConnected,
        playerNumber: myPlayerNumber,
        spectator: isSpectator,
    };
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadHostSettings();
        prefillJoin();
        syncHostChips();
        bindUi();
    });
} else {
    loadHostSettings();
    prefillJoin();
    syncHostChips();
    bindUi();
}
