// SSH Service for Liquid Galaxy Rig Remote Control
// Patterns match Pacman / Asteroids: password auth, short commands, no hanging UI.

import 'dart:async';
import 'dart:convert';
import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';

class SSHService {
  static final SSHService _instance = SSHService._internal();
  factory SSHService() => _instance;
  SSHService._internal();

  SSHClient? _client;
  final _secureStorage = const FlutterSecureStorage();

  /// Serializes connect/sendCommand so Detect Screens + Launch cannot tear
  /// down each other's socket mid-flight.
  Future<void> _chain = Future.value();

  Future<T> _serialized<T>(Future<T> Function() fn) {
    final completer = Completer<T>();
    _chain = _chain.then((_) async {
      try {
        completer.complete(await fn());
      } catch (e, st) {
        completer.completeError(e, st);
      }
    });
    return completer.future;
  }

  bool get isConnected => _client != null;

  Future<String?> connect() {
    return _serialized(() => _connectUnlocked());
  }

  Future<String?> _connectUnlocked() async {
    try {
      await _disconnectUnlocked();

      final prefs = await SharedPreferences.getInstance();

      final host = prefs.getString(prefHost) ?? '';
      final portStr = prefs.getString(prefPort) ?? '$defaultSshPort';
      final username = prefs.getString(prefUsername) ?? defaultSshUsername;
      final password = await _secureStorage.read(key: prefPassword) ?? '';

      if (host.isEmpty) {
        return 'LG Master IP is not configured. Please set it in Settings.';
      }

      final port = int.tryParse(portStr) ?? defaultSshPort;

      debugPrint('[SSHService] Connecting to $username@$host:$port ...');

      final socket = await SSHSocket.connect(
        host,
        port,
        timeout: const Duration(seconds: 8),
      );

      _client = SSHClient(
        socket,
        username: username,
        onPasswordRequest: () => password,
        keepAliveInterval: const Duration(seconds: 15),
      );

      await _client!.authenticated.timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('SSH authentication timed out'),
      );

      debugPrint('[SSHService] Connected successfully to $host:$port.');
      return null;
    } catch (e) {
      debugPrint('[SSHService] Connection failed: $e');
      _client = null;
      return e.toString();
    }
  }

  static const _wallScriptTimeout = Duration(seconds: 180);

  Future<String> sendCommand(
    String command, {
    Duration timeout = const Duration(seconds: 45),
  }) {
    return _serialized(() => _sendCommandUnlocked(command, timeout: timeout));
  }

  Future<String> _sendCommandUnlocked(
    String command, {
    Duration timeout = const Duration(seconds: 45),
  }) async {
    try {
      if (_client == null) {
        final connectResult = await _connectUnlocked();
        if (connectResult != null) {
          return 'ERROR: $connectResult';
        }
      }

      String sanitizedCommand = command;
      if (command.contains('LG_PASSWORD=')) {
        sanitizedCommand =
            command.replaceAll(RegExp(r"LG_PASSWORD='[^']*'"), "LG_PASSWORD='***'");
      }
      debugPrint('[SSHService] Executing: $sanitizedCommand');

      final session = await _client!.execute(command).timeout(
        timeout,
        onTimeout: () => throw TimeoutException(
          'SSH command timed out (rig may be hung)',
        ),
      );

      final stdout = await session.stdout
          .cast<List<int>>()
          .transform(utf8.decoder)
          .join()
          .timeout(timeout);
      final stderr = await session.stderr
          .cast<List<int>>()
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 10), onTimeout: () => '');

      session.close();

      if (stderr.isNotEmpty) {
        debugPrint('[SSHService] stderr: $stderr');
      }

      return stdout;
    } on TimeoutException catch (e) {
      debugPrint('[SSHService] $e');
      await _disconnectUnlocked();
      return 'ERROR: ${e.message ?? e.toString()}';
    } catch (e) {
      debugPrint('[SSHService] Command failed: $e');
      // Dead socket — clear so the next call reconnects.
      await _disconnectUnlocked();
      return 'ERROR: ${e.toString()}';
    }
  }

  Future<int?> detectScreenCount() async {
    const command =
        "cat /lg/personavars.txt /home/lg/personavars.txt 2>/dev/null | "
        "grep -m1 DHCP_LG_FRAMES_MAX | cut -d= -f2 | tr -dc '0-9'";

    final output = await sendCommand(command);
    if (output.startsWith('ERROR:')) return null;

    final screens = int.tryParse(output.trim());
    if (screens == null || screens < 1 || screens > 12) return null;
    return screens;
  }

  static String? _safeRemotePath(String path) {
    if (!RegExp(r'^(~/|/)[A-Za-z0-9._/\-]+$').hasMatch(path)) return null;
    if (path.contains('..')) return null;
    return path;
  }

  Future<String> _remotePath() async {
    final prefs = await SharedPreferences.getInstance();
    return _safeRemotePath(prefs.getString(prefRemotePath) ?? defaultRemotePath) ??
        defaultRemotePath;
  }

  Future<String> launchGame(int numScreens) async {
    final remotePath = await _remotePath();
    final screens = numScreens.clamp(1, 12);
    // Wall open used to die at 45s while Vite rebuilt dist/. Pacman/Asteroids
    // never rebuild on launch; 180s covers pm2 + /health + slave SSH.
    return sendCommand(
      'bash $remotePath/scripts/open-arkanoid.sh $screens',
      timeout: _wallScriptTimeout,
    );
  }

  Future<String> closeGame() async {
    final remotePath = await _remotePath();
    return sendCommand(
      'bash $remotePath/scripts/close-arkanoid.sh',
      timeout: _wallScriptTimeout,
    );
  }

  /// Wait until pm2 no longer lists lg-arkanoid and Chromium for :8130 is gone.
  Future<void> _waitForTeardown({
    Duration timeout = const Duration(seconds: 20),
  }) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      final check = await _sendCommandUnlocked(
        "pm2 jlist 2>/dev/null | grep -c '\"name\":\"lg-arkanoid\"' || true; "
        "pgrep -af 'chromium-browser.*:8130/' 2>/dev/null | wc -l || true",
      );
      if (check.startsWith('ERROR:')) {
        await Future.delayed(const Duration(milliseconds: 500));
        continue;
      }
      final lines = check
          .trim()
          .split(RegExp(r'\s+'))
          .map((s) => int.tryParse(s) ?? -1)
          .where((n) => n >= 0)
          .toList();
      final pm2Hits = lines.isNotEmpty ? lines[0] : -1;
      final chromeHits = lines.length > 1 ? lines[1] : -1;
      if (pm2Hits == 0 && chromeHits == 0) return;
      await Future.delayed(const Duration(milliseconds: 600));
    }
    debugPrint('[SSHService] Teardown wait timed out — launching anyway.');
  }

  Future<String> relaunchGame(int numScreens) {
    return _serialized(() async {
      final remotePath = await _remotePath();
      final closeOut =
          await _sendCommandUnlocked(
        'bash $remotePath/scripts/close-arkanoid.sh',
        timeout: _wallScriptTimeout,
      );
      if (closeOut.startsWith('ERROR:')) return closeOut;
      await _waitForTeardown();
      final screens = numScreens.clamp(1, 12);
      return _sendCommandUnlocked(
        'bash $remotePath/scripts/open-arkanoid.sh $screens',
        timeout: _wallScriptTimeout,
      );
    });
  }

  Future<void> disconnect() {
    return _serialized(() => _disconnectUnlocked());
  }

  Future<void> _disconnectUnlocked() async {
    try {
      _client?.close();
    } catch (e) {
      debugPrint('[SSHService] Error during disconnect: $e');
    }
    _client = null;
  }
}
