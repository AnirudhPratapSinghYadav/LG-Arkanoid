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
        const rigDeltaX = dx * acceleration * 12 * worldInputScale();

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
        const rigDeltaX = dx * acceleration * 12 * worldInputScale();

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
