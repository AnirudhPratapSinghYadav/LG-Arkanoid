// SSH Service for Liquid Galaxy Rig Remote Control

import 'dart:convert';
import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';

class SSHService {
  // Singleton pattern so we maintain one SSH connection across the app.
  static final SSHService _instance = SSHService._internal();
  factory SSHService() => _instance;
  SSHService._internal();

  // The active SSH client, or null if not connected.
  SSHClient? _client;

  // Secure storage for reading the SSH password.
  final _secureStorage = const FlutterSecureStorage();

  // Whether we currently have an active SSH connection.
  bool get isConnected => _client != null;

  // --------------------------------------------------------------------------
  // connect
  //
  // Reads SSH credentials from SharedPreferences and flutter_secure_storage,
  // then opens a dartssh2 SSHClient connection to the Liquid Galaxy master.
  //
  // Returns null on success, or a descriptive error string on failure.
  // --------------------------------------------------------------------------
  Future<String?> connect() async {
    try {
      // Disconnect any previous session before opening a new one.
      await disconnect();

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

      // Open the SSH socket connection to the master machine.
      final socket = await SSHSocket.connect(
        host,
        port,
        timeout: const Duration(seconds: 8),
      );

      // Authenticate with the password.
      _client = SSHClient(
        socket,
        username: username,
        onPasswordRequest: () => password,
      );

      await _client!.authenticated;

      debugPrint('[SSHService] Connected successfully to $host:$port.');
      return null;
    } catch (e) {
      debugPrint('[SSHService] Connection failed: $e');
      _client = null;
      return e.toString();
    }
  }

  // --------------------------------------------------------------------------
  // sendCommand
  //
  // Runs a shell command on the Liquid Galaxy master machine and returns the
  // stdout output as a string. If the connection is not established or the
  // command fails, this method returns a descriptive error string prefixed
  // with "ERROR:" rather than throwing.
  // --------------------------------------------------------------------------
  Future<String> sendCommand(String command) async {
    try {
      if (_client == null) {
        // Try to connect automatically if no session exists.
        final connectResult = await connect();
        if (connectResult != null) {
          return 'ERROR: $connectResult';
        }
      }

      String sanitizedCommand = command;
      if (command.contains('LG_PASSWORD=')) {
        sanitizedCommand = command.replaceAll(RegExp(r"LG_PASSWORD='[^']*'"), "LG_PASSWORD='***'");
      }
      debugPrint('[SSHService] Executing: $sanitizedCommand');

      final session = await _client!.execute(command);
      final stdout = await session.stdout.cast<List<int>>().transform(utf8.decoder).join();
      final stderr = await session.stderr.cast<List<int>>().transform(utf8.decoder).join();

      session.close();

      if (stderr.isNotEmpty) {
        debugPrint('[SSHService] stderr: $stderr');
      }

      return stdout;
    } catch (e) {
      debugPrint('[SSHService] Command failed: $e');
      return 'ERROR: ${e.toString()}';
    }
  }

  // --------------------------------------------------------------------------
  // launchGame
  //
  // Launches the LG Arkanoid game on the rig by running the open-arkanoid.sh
  // Bash script on the master machine. The numScreens parameter tells the
  // script how many screens to open Chromium on.
  // --------------------------------------------------------------------------
  static String? _safeRemotePath(String path) {
    // Allow absolute paths or home-relative ~/paths without shell metacharacters.
    if (!RegExp(r'^(~/|/)[A-Za-z0-9._/\-]+$').hasMatch(path)) return null;
    if (path.contains('..')) return null;
    return path;
  }

  Future<String> launchGame(int numScreens) async {
    final prefs = await SharedPreferences.getInstance();
    final remotePath = _safeRemotePath(
          prefs.getString(prefRemotePath) ?? defaultRemotePath,
        ) ??
        defaultRemotePath;
    final screens = numScreens.clamp(1, 9);

    return sendCommand(
      'bash $remotePath/scripts/open-arkanoid.sh $screens',
    );
  }

  // --------------------------------------------------------------------------
  // closeGame
  //
  // Closes the LG Arkanoid game on the rig by running the close-arkanoid.sh
  // Bash script, which kills Chromium on all screens and stops the pm2
  // game server process.
  // --------------------------------------------------------------------------
  Future<String> closeGame() async {
    final prefs = await SharedPreferences.getInstance();
    final remotePath = _safeRemotePath(
          prefs.getString(prefRemotePath) ?? defaultRemotePath,
        ) ??
        defaultRemotePath;

    return sendCommand(
      'bash $remotePath/scripts/close-arkanoid.sh',
    );
  }

  // --------------------------------------------------------------------------
  // relaunchGame
  //
  // Convenience method that closes the running game and then launches it
  // again with the specified number of screens. Useful for resetting the
  // game state or changing the screen count without manual intervention.
  // --------------------------------------------------------------------------
  Future<String> relaunchGame(int numScreens) async {
    await closeGame();

    // Give the rig a moment to clean up before relaunching.
    await Future.delayed(const Duration(seconds: 2));

    return launchGame(numScreens);
  }

  // --------------------------------------------------------------------------
  // disconnect
  //
  // Closes the active SSH connection and releases resources. This method is
  // safe to call even if no connection is active.
  // --------------------------------------------------------------------------
  Future<void> disconnect() async {
    try {
      _client?.close();
    } catch (e) {
      debugPrint('[SSHService] Error during disconnect: $e');
    }
    _client = null;
  }
}
