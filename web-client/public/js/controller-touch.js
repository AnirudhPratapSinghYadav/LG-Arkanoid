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
