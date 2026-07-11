import 'dart:math';
import 'dart:io';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'ttsservice.dart';

class GameService extends ChangeNotifier {
  io.Socket? socket;
  String? serverAddress;
  String? serverPort;
  String? playerId;
  int? playerNumber;
  String? sessionId;
  int score = 0;
  int lives = 3;
  int rank = 0;
  String lastCommentary = '';
  String lastCommentarySource = 'fallback';
  bool connected = false;
  bool isJoinConfirmed = false;
  String? joinError;
  Map<String, dynamic>? latestGameState;
  void Function(bool isSpectator)? onJoinConfirmed;

  final Random _random = Random();

  String generateNonce(){
    return List.generate(8, (_)=>_random.nextInt(16).toRadixString(16)).join();
  }

  Future<bool> checkHealth(String address, String port) async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(milliseconds: 400);
      final uri = Uri.parse('http://$address:$port/health');
      final req = await client.getUrl(uri);
      final resp = await req.close();
      return resp.statusCode == 200;
    } catch (e) {
      debugPrint('Health check failed: $e');
      return false;
    }
  }

  Future<bool> connect(String address, String port,
      {Duration timeout = const Duration(seconds: 3)}) async {
    disconnect();
    serverAddress = address;
    serverPort = port;

    try {
      final url = 'http://$address:$port';
      socket = io.io(
        url,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .enableAutoConnect()
            .build(),
      );

      socket!.onConnect((_){
        connected = true;
        startLatencyPing();
        if (playerId != null && sessionId != null) {
          socket!.emit('resume_request', {'playerId': playerId, 'sessionId': sessionId});
        }
        notifyListeners();
      });

      socket!.onDisconnect((_){
        connected = false;
        notifyListeners();
      });

      socket!.on('join_confirmed', (data){
        final map = _asMap(data);
        playerId = map['playerId'] as String?;
        playerNumber = map['playerNumber'] as int?;
        sessionId = map['sessionId'] as String?;
        isJoinConfirmed = true;
        joinError = null;
        bool isSpectator = map['isSpectator'] as bool? ?? false;
        if (onJoinConfirmed != null) onJoinConfirmed!(isSpectator);
        notifyListeners();
      });

      socket!.on('join_rejected', (data){
        final map = _asMap(data);
        isJoinConfirmed = false;
        joinError = map['message'] as String? ?? 'Join rejected';
        lastCommentary = 'Join rejected: ${map['message'] ?? map['errorCode']}';
        lastCommentarySource = 'fallback';
        notifyListeners();
      });

      socket!.on('game_state', (data){
        latestGameState = _asMap(data);
        if(playerId!=null){
          final players = latestGameState!['players'] as List<dynamic>? ?? [];
          
          final sortedPlayers = List<dynamic>.from(players)
            ..sort((a, b){
              final aScore = _asMap(a)['score'] as int? ?? 0;
              final bScore = _asMap(b)['score'] as int? ?? 0;
              return bScore.compareTo(aScore);
            });

          for(int i = 0; i < sortedPlayers.length; i++){
            final pm = _asMap(sortedPlayers[i]);
            if(pm['id']==playerId){
              rank = i+1;
              break;
            }
          }

          for(final p in players){
            final pm = _asMap(p);
            if(pm['id']==playerId){
              int newScore = pm['score'] as int? ?? 0;
              int newLives = pm['lives'] as int? ?? 0;
              if (newScore - score >= 50) {
                HapticFeedback.mediumImpact();
              }
              if (newLives < lives) {
                HapticFeedback.heavyImpact();
              }
              score = newScore;
              lives = newLives;
              break;
            }
          }
        }
        notifyListeners();
      });

      socket!.on('commentary', (data){
        final map = _asMap(data);
        final newCommentary = map['text'] as String? ?? '';
        
        if(newCommentary.isNotEmpty && newCommentary!=lastCommentary){
          lastCommentary = newCommentary;
          lastCommentarySource = map['source'] as String? ?? 'fallback';
          
          if(lastCommentarySource=='ai' || lastCommentarySource=='gemini'){
             HapticFeedback.mediumImpact();
             TTSService().speak(lastCommentary);
          }
        }
        notifyListeners();
      });

      socket!.connect();

      final start = DateTime.now();
      while(DateTime.now().difference(start) < timeout){
        await Future.delayed(const Duration(milliseconds: 100));
        if(connected){
          return true;
        }
      }
      return false;
    } catch (e) {
      debugPrint('Socket connection error: $e');
      return false;
    }
  }

  void joinGame(String sessionToken, String playerName){
    isJoinConfirmed = false;
    joinError = null;
    socket?.emit('player_join', {
      'sessionToken': sessionToken,
      'playerName': playerName
    });
  }

  void sendPaddleMove(double deltaX){
    if(socket==null || !connected || playerId==null) return;
    socket!.emit('paddle_move', {
      'deltaX': deltaX.round(),
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void activatePowerUp(String powerUpType){
    if(socket==null || !connected || playerId==null) return;
    socket!.emit('power_up_activate', {
      'playerId': playerId,
      'powerUpType': powerUpType,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void startGame(int durationSeconds){
    if(socket==null || !connected) return;
    socket!.emit('start_game', {'durationSeconds': durationSeconds});
  }

  void disconnect(){
    stopLatencyPing();
    socket?.dispose();
    socket = null;
    connected = false;
    isJoinConfirmed = false;
    joinError = null;
    notifyListeners();
  }

  int latencyMs = 0;
  Timer? _pingTimer;

  void startLatencyPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (socket != null && connected) {
        final stopwatch = Stopwatch()..start();
        socket!.emitWithAck('ping_test', {}, ack: (_) {
          stopwatch.stop();
          latencyMs = stopwatch.elapsedMilliseconds;
          notifyListeners();
        });
      }
    });
  }

  void stopLatencyPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  Map<String, dynamic> _asMap(dynamic data){
    if(data is Map<String, dynamic>) return data;
    if(data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}
