function controllerServerOrigin() {
    var serverOrigin = window.location.origin;
    if (window.location.port === '5173') {
        serverOrigin = window.location.protocol + '//' + window.location.hostname + ':8130';
    }
    return serverOrigin;
}

function looksLikeArkanoidHealth(h) {
    return !!(h && h.status === 'ok' && h.gameStatus);
}

function probeControllerHealth(origin) {
    return fetch(origin + '/health', { cache: 'no-store' }).then(function (r) {
        return r.json();
    }).then(function (h) {
        if (!looksLikeArkanoidHealth(h)) {
            throw new Error('not-arkanoid');
        }
        return h;
    });
}
