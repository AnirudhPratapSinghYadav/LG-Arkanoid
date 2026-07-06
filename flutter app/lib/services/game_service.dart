import 'dart:math';
import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class GameService extends ChangeNotifier {
  io.Socket? socket;
  String? serverAddress;
  String? serverPort;
  String? playerId;
  int? playerNumber;
  String? sessionId;
  int score = 0;
  int lives = 3;
  String lastCommentary = '';
  String lastCommentarySource = 'fallback';
  bool connected = false;
  Map<String, dynamic>? latestGameState;

  final Random _random = Random();

  String generateNonce() {
    return List.generate(8, (_) => _random.nextInt(16).toRadixString(16)).join();
  }

  Future<bool> connect(String address, String port,
      {Duration timeout = const Duration(seconds: 3)}) async {
    disconnect();
    serverAddress = address;
    serverPort = port;

    try {
      final url = 'https://$address:$port';
      socket = io.io(
        url,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .enableAutoConnect()
            .build(),
      );

      socket!.onConnect((_) {
        connected = true;
        notifyListeners();
      });

      socket!.onDisconnect((_) {
        connected = false;
        notifyListeners();
      });

      socket!.on('join_confirmed', (data) {
        final map = _asMap(data);
        playerId = map['playerId'] as String?;
        playerNumber = map['playerNumber'] as int?;
        sessionId = map['sessionId'] as String?;
        notifyListeners();
      });

      socket!.on('join_rejected', (data) {
        final map = _asMap(data);
        lastCommentary = 'Join rejected: ${map['message'] ?? map['errorCode']}';
        lastCommentarySource = 'fallback';
        notifyListeners();
      });

      socket!.on('game_state', (data) {
        latestGameState = _asMap(data);
        if (playerId != null) {
          final players = latestGameState!['players'] as List<dynamic>? ?? [];
          for (final p in players) {
            final pm = _asMap(p);
            if (pm['id'] == playerId) {
              score = pm['score'] as int? ?? 0;
              lives = pm['lives'] as int? ?? 0;
              break;
            }
          }
        }
        notifyListeners();
      });

      socket!.on('commentary', (data) {
        final map = _asMap(data);
        lastCommentary = map['text'] as String? ?? '';
        lastCommentarySource = map['source'] as String? ?? 'fallback';
        notifyListeners();
      });

      socket!.connect();

      final start = DateTime.now();
      while (DateTime.now().difference(start) < timeout) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (connected) {
          return true;
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  void joinGame(String sessionToken) {
    socket?.emit('player_join', {'sessionToken': sessionToken});
  }

  void sendPaddleMove(double paddleVirtualX) {
    if (socket == null || !connected || playerId == null) return;
    socket!.emit('paddle_move', {
      'playerId': playerId,
      'x': paddleVirtualX.round(),
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void activatePowerUp(String powerUpType) {
    if (socket == null || !connected || playerId == null) return;
    socket!.emit('power_up_activate', {
      'playerId': playerId,
      'powerUpType': powerUpType,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void startGame() {
    if (socket == null || !connected) return;
    socket!.emit('start_game');
  }

  void disconnect() {
    socket?.dispose();
    socket = null;
    connected = false;
    notifyListeners();
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}
