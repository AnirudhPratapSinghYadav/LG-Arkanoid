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
  String? sessionToken;
  String? resumeToken;
  bool isSpectator = false;
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

  String robotState = 'idle';
  Timer? robotStateTimer;

  final Random _random = Random();

  String generateNonce(){
    return List.generate(8, (_)=>_random.nextInt(16).toRadixString(16)).join();
  }

  Future<bool> checkHealth(String address, String port) async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(milliseconds: 2000);
      final uri = Uri.parse('http://$address:$port/health');
      final req = await client.getUrl(uri);
      final resp = await req.close();
      return resp.statusCode == 200;
    } catch (e) {
      debugPrint('Health check failed for $address: $e');
      return false;
    }
  }

  Future<bool> connect(String address, String port,
      {Duration timeout = const Duration(seconds: 8)}) async {
    disconnect();
    serverAddress = address;
    serverPort = port;

    try {
      final url = 'http://$address:$port';
      debugPrint('[GameService] Connecting to $url ...');
      socket = io.io(
        url,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .disableAutoConnect()
            .enableForceNew()
            .enableReconnection()
            .setReconnectionDelay(1000)
            .setReconnectionAttempts(5)
            .build(),
      );

      socket!.onConnect((_){
        debugPrint('[GameService] Socket connected');
        connected = true;
        startLatencyPing();
        if (playerId != null && sessionId != null && resumeToken != null && !isSpectator) {
          socket!.emit('resume_request', {
            'playerId': playerId,
            'sessionId': sessionId,
            'resumeToken': resumeToken,
          });
        }
        notifyListeners();
      });

      socket!.onConnectError((error){
        debugPrint('[GameService] ❌ Connect error: $error');
      });

      socket!.onError((error){
        debugPrint('[GameService] ❌ Socket error: $error');
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
        resumeToken = map['resumeToken'] as String?;
        if (map['sessionToken'] is String) {
          sessionToken = map['sessionToken'] as String;
        }
        isSpectator = map['isSpectator'] as bool? ?? false;
        final alreadyConfirmed = isJoinConfirmed;
        isJoinConfirmed = true;
        joinError = null;
        if (onJoinConfirmed != null && !alreadyConfirmed) onJoinConfirmed!(isSpectator);
        notifyListeners();
      });

      socket!.on('lobby_ready', (data){
        final map = _asMap(data);
        if (map['sessionId'] is String) {
          sessionId = map['sessionId'] as String;
        }
        if (map['sessionToken'] is String) {
          sessionToken = map['sessionToken'] as String;
        }
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

      socket!.on('commentary_thinking', (data){
        robotState = 'thinking';
        robotStateTimer?.cancel();
        robotStateTimer = Timer(const Duration(seconds: 3), () {
          robotState = 'idle';
          notifyListeners();
        });
        notifyListeners();
      });

      socket!.on('commentary', (data){
        final map = _asMap(data);
        final newCommentary = map['text'] as String? ?? '';
        final eventType = map['eventType'] as String? ?? '';
        
        if (eventType == 'life_lost') {
            robotState = 'alert';
        } else if (eventType == 'level_cleared' || eventType == 'multi_ball') {
            robotState = 'excited';
        } else {
            robotState = 'idle';
        }
        
        robotStateTimer?.cancel();
        robotStateTimer = Timer(const Duration(seconds: 3), () {
          robotState = 'idle';
          notifyListeners();
        });

          if(newCommentary.isNotEmpty && newCommentary!=lastCommentary){
          lastCommentary = newCommentary;
          lastCommentarySource = map['source'] as String? ?? 'fallback';
          HapticFeedback.mediumImpact();
          // Speak all commentary (Gemini + arcade fallback) so the phone feels alive offline.
          TTSService().speak(lastCommentary);
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

  void joinGame(String token, String playerName){
    isJoinConfirmed = false;
    joinError = null;
    isSpectator = false;
    sessionToken = token;
    socket?.emit('player_join', {
      'sessionToken': token,
      'playerName': playerName
    });
  }

  void sendPaddleMove(double deltaX){
    if(socket==null || !connected || playerId==null) return;
    if(lives <= 0) return;
    socket!.emit('paddle_move', {
      'deltaX': deltaX.round(),
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void activatePowerUp(String powerUpType){
    if(socket==null || !connected || playerId==null) return;
    if(lives <= 0) return;
    socket!.emit('power_up_activate', {
      'playerId': playerId,
      'powerUpType': powerUpType,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void setGameSettings({required int maxPlayers, required String ballSpeed, required int durationSeconds}){
    if(socket==null || !connected) return;
    socket!.emit('set_game_settings', {
      'maxPlayers': maxPlayers,
      'ballSpeed': ballSpeed,
      'durationSeconds': durationSeconds,
    });
  }

  void setMaxPlayers(int count){
    if(socket==null || !connected) return;
    socket!.emit('set_max_players', {'maxPlayers': count});
  }

  void startGame(int durationSeconds){
    if(socket==null || !connected) return;
    socket!.emit('start_game', {'durationSeconds': durationSeconds});
  }

  void leaveGame(){
    if (socket != null && connected && playerId != null && !isSpectator) {
      socket!.emit('leave_game');
    }
    disconnect();
  }

  void disconnect(){
    stopLatencyPing();
    socket?.dispose();
    socket = null;
    connected = false;
    isJoinConfirmed = false;
    joinError = null;
    playerId = null;
    playerNumber = null;
    sessionId = null;
    sessionToken = null;
    resumeToken = null;
    isSpectator = false;
    score = 0;
    lives = 3;
    rank = 0;
    latestGameState = null;
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
