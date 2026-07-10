import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/foundation.dart';

class LgService {
  SSHClient? _client;

  bool get isConnected => _client != null && !_client!.isClosed;

  Future<bool> connect(String host, String username, String password) async {
    try {
      final socket = await SSHSocket.connect(host, 22, timeout: const Duration(seconds: 5));
      _client = SSHClient(
        socket,
        username: username,
        onPasswordRequest: () => password,
      );
      // Wait for authentication
      await _client!.authenticated;
      return true;
    } catch (e) {
      debugPrint('SSH Connection error: $e');
      return false;
    }
  }

  void disconnect() {
    _client?.close();
    _client = null;
  }

  Future<String?> execute(String command) async {
    if (!isConnected) return null;
    try {
      final result = await _client!.run(command);
      return String.fromCharCodes(result);
    } catch (e) {
      debugPrint('SSH execution error: $e');
      return null;
    }
  }
}
