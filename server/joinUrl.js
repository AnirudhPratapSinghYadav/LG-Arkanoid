'use strict';

/**
 * Pacman/Asteroids join with a real browser URL:
 *   http://<master-ipv4>:<port>/controller
 * Our wall used to encode LGARK|ip|port|token, which a phone camera cannot open
 * and which the Flutter IP field cannot paste as a "link".
 */

function buildControllerJoinUrl(lanIp, port, token) {
  const host = String(lanIp || '').trim();
  const p = String(port || '8130').trim() || '8130';
  const code = String(token || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (!host || !code) return '';
  return `http://${host}:${p}/controller?c=${encodeURIComponent(code)}`;
}

function parseJoinInput(raw, defaultPort) {
  const fallbackPort = String(defaultPort || '8130');
  const s = String(raw || '').trim();
  if (!s) return null;

  if (/^LGARK\|/i.test(s) || /^LGRIG\|/i.test(s)) {
    const parts = s.split('|');
    if (parts.length >= 4) {
      return {
        ip: parts[1].trim(),
        port: parts[2].trim() || fallbackPort,
        token: String(parts[3] || '').trim().toUpperCase().slice(0, 4),
        warning: hostWarning(parts[1].trim()),
        hint: hostHint(parts[1].trim()),
      };
    }
  }

  let uri = null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    try { uri = new URL(s); } catch (_) { uri = null; }
  } else if (s.includes('/') || /:\d{2,5}/.test(s)) {
    try { uri = new URL('http://' + s.replace(/^\/\//, '')); } catch (_) { uri = null; }
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s) || /^[A-Za-z0-9.-]+$/.test(s)) {
    try { uri = new URL('http://' + s + ':' + fallbackPort); } catch (_) { uri = null; }
  }

  if (!uri || !uri.hostname) return null;

  const params = uri.searchParams;
  const code = (params.get('c') || params.get('code') || params.get('token') || params.get('session') || '').trim().toUpperCase();
  const port = uri.port || fallbackPort;
  return {
    ip: uri.hostname,
    port: String(port),
    token: code ? code.replace(/[^A-Z0-9]/g, '').slice(0, 4) : '',
    warning: hostWarning(uri.hostname),
    hint: hostHint(uri.hostname),
  };
}

function hostWarning(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'lg1') {
    return 'Use the IPv4 printed on the wall, not lg1. Phones cannot resolve lg1.';
  }
  return '';
}

function hostHint(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') {
    return '127.0.0.1 only works with USB debugging (adb reverse tcp:8130 tcp:8130).';
  }
  return '';
}

module.exports = {
  buildControllerJoinUrl,
  parseJoinInput,
  hostWarning,
  hostHint,
};
