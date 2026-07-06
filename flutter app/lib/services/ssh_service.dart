import 'dart:developer';
import 'package:ssh2/ssh2.dart';

class SSHService {
  static final SSHService _instance = SSHService._internal();

  SSHClient? _client;
  String _host = '';
  int _port = 22;
  String _username = '';
  String _password = '';
  bool _connected = false;

  factory SSHService() {
    return _instance;
  }

  SSHService._internal();

  bool get connected => _connected;
  String get host => _host;
  int get port => _port;
  String get username => _username;

  void init({
    required String host,
    required int port,
    required String username,
    required String password,
  }) {
    _host = host;
    _port = port;
    _username = username;
    _password = password;
    _client = SSHClient(
      host: host,
      port: port,
      username: username,
      passwordOrKey: password,
    );
  }

  Future<bool> connect() async {
    if (_client == null) return false;
    try {
      String? result = await _client!.connect();
      if (result == 'session_connected') {
        _connected = true;
        return true;
      }
      return false;
    } catch (e) {
      log('SSH connect error: $e');
      _connected = false;
      return false;
    }
  }

  Future<void> disconnect() async {
    try {
      if (_client != null) {
        await _client!.disconnect();
      }
    } catch (e) {
      log('SSH disconnect error: $e');
    }
    _connected = false;
  }

  Future<bool> isConnected() async {
    if (_client == null) return false;
    try {
      bool result = await _client!.isConnected();
      _connected = result;
      return result;
    } catch (e) {
      _connected = false;
      return false;
    }
  }

  Future<String?> execute(String command) async {
    if (_client == null || !_connected) return null;
    try {
      String? result = await _client!.execute(command);
      return result;
    } catch (e) {
      log('SSH execute error: $e');
      return null;
    }
  }
}
