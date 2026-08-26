class JoinTarget {
  final String ip;
  final String port;
  final String token;
  final String? warning;
  final String? hint;

  const JoinTarget({
    required this.ip,
    required this.port,
    this.token = '',
    this.warning,
    this.hint,
  });
}

/// Pacman-style join strings plus the legacy LGARK payload.
///
/// Accepts:
///   LGARK|10.0.0.5|8130|ABCD
///   http://10.0.0.5:8130/controller?c=ABCD
///   10.0.0.5:8130
///   10.0.0.5
JoinTarget? parseJoinInput(String raw, {String defaultPort = '8130'}) {
  var s = raw.trim();
  if (s.isEmpty) return null;

  if (s.toUpperCase().startsWith('LGARK|') ||
      s.toUpperCase().startsWith('LGRIG|')) {
    final parts = s.split('|');
    if (parts.length >= 4) {
      final ip = parts[1].trim();
      return JoinTarget(
        ip: ip,
        port: parts[2].trim().isEmpty ? defaultPort : parts[2].trim(),
        token: parts[3].trim().toUpperCase(),
        warning: _hostWarning(ip),
        hint: _hostHint(ip),
      );
    }
  }

  Uri? uri;
  if (s.contains('://')) {
    uri = Uri.tryParse(s);
  } else if (s.contains('/') || RegExp(r':\d{2,5}').hasMatch(s)) {
    uri = Uri.tryParse('http://$s');
  } else if (RegExp(r'^\d{1,3}(?:\.\d{1,3}){3}$').hasMatch(s) ||
      RegExp(r'^[A-Za-z0-9.-]+$').hasMatch(s)) {
    uri = Uri.tryParse('http://$s:$defaultPort');
  }

  if (uri == null || uri.host.isEmpty) return null;

  final params = uri.queryParameters;
  final code = (params['c'] ??
          params['code'] ??
          params['token'] ??
          params['session'] ??
          '')
      .trim()
      .toUpperCase();
  final port = uri.hasPort ? uri.port.toString() : defaultPort;

  return JoinTarget(
    ip: uri.host,
    port: port,
    token: code.length >= 4 ? code.substring(0, 4) : code,
    warning: _hostWarning(uri.host),
    hint: _hostHint(uri.host),
  );
}

/// Blocking: phones never resolve the cluster hostname `lg1`.
String? _hostWarning(String host) {
  if (host.toLowerCase() == 'lg1') {
    return 'Use the IPv4 printed under the wall QR, not lg1. Phones cannot resolve lg1.';
  }
  return null;
}

/// Non-blocking: 127.0.0.1 only works with USB debugging + adb reverse.
String? _hostHint(String host) {
  final h = host.toLowerCase();
  if (h == 'localhost' || h == '127.0.0.1') {
    return '127.0.0.1 only works with USB debugging. On a PC run: adb reverse tcp:8130 tcp:8130';
  }
  if (h == '10.0.2.2') {
    return 'Emulator loopback to the host PC. Join the game here on :8130. SSH to a real Liquid Galaxy still needs lg1 Wi‑Fi IPv4, never 10.0.2.2.';
  }
  return null;
}
