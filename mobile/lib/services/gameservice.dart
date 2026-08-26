import 'dart:math';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'ttsservice.dart';
import '../utils/join_target.dart';
import 'health_probe.dart';

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
  String? lastConnectError;
  Map<String, dynamic>? latestGameState;
  void Function(bool isSpectator)? onJoinConfirmed;

  String robotState = 'idle';
  Timer? robotStateTimer;

  int _hudNotifyAt = 0;
  String _hudStatus = '';
  int _hudScore = -1;
  int _hudLives = -1;
  String _hudCommentary = '';

  final Random _random = Random();

  void _notifyHud({bool urgent = false}) {
    final status = latestGameState?['gameStatus'] as String? ?? '';
    final now = DateTime.now().millisecondsSinceEpoch;
    final changed = urgent ||
        status != _hudStatus ||
        score != _hudScore ||
        lives != _hudLives ||
        lastCommentary != _hudCommentary;
    if (!changed && now - _hudNotifyAt < 200) return;
    _hudNotifyAt = now;
    _hudStatus = status;
    _hudScore = score;
    _hudLives = lives;
    _hudCommentary = lastCommentary;
    notifyListeners();
  }

  String generateNonce(){
    return List.generate(8, (_)=>_random.nextInt(16).toRadixString(16)).join();
  }

  Future<bool> checkHealth(String address, String port) async {
    final result = await probeHealth(address, port);
    if (!result.ok) {
      debugPrint('Health check failed for $address: ${result.detail}');
    }
    return result.ok;
  }

  Future<bool> connect(String address, String port,
      {Duration timeout = const Duration(seconds: 8)}) async {
    disconnect();
    final parsed = parseJoinInput(
      address.contains('://') || address.contains('/')
          ? address
          : '$address:$port',
      defaultPort: port,
    );
    if (parsed != null) {
      address = parsed.ip;
      port = parsed.port;
    }
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
            .setTimeout(8000)
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
        debugPrint('[GameService] Connect error: $error');
        lastConnectError = error.toString();
        notifyListeners();
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
        var urgent = false;
        if(playerId!=null){
          final players = latestGameState!['players'] as List<dynamic>? ?? [];
          for(final p in players){
            final pm = _asMap(p);
            if(pm['id']==playerId){
              final newScore = pm['score'] as int? ?? 0;
              final newLives = pm['lives'] as int? ?? 0;
              if (newLives < lives) {
                HapticFeedback.heavyImpact();
                urgent = true;
              }
              if (pm['rank'] is int) {
                rank = pm['rank'] as int;
              }
              score = newScore;
              lives = newLives;
              break;
            }
          }
        }
        final status = latestGameState!['gameStatus'] as String? ?? '';
        if (status == 'game_over' || status == 'time_up' || status == 'win' ||
            status == 'countdown' || status == 'lobby') {
          urgent = true;
        }
        _notifyHud(urgent: urgent);
      });

      socket!.on('commentary_thinking', (data){
        robotState = 'thinking';
        robotStateTimer?.cancel();
        robotStateTimer = Timer(const Duration(seconds: 3), () {
          robotState = 'idle';
          _notifyHud(urgent: true);
        });
        _notifyHud();
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
          // No haptic on commentary — was buzzing phones for the whole TTS line.
          // Speak only short critical events; countdown spam caused ~10s vibration/TTS.
          if (eventType == 'life_lost' || eventType == 'victory') {
            unawaited(TTSService().speak(lastCommentary));
          }
        }
        _notifyHud(urgent: true);
      });

      socket!.connect();

      final start = DateTime.now();
      while (DateTime.now().difference(start) < timeout) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (connected) {
          lastConnectError = null;
          return true;
        }
      }
      lastConnectError ??= 'Timed out after ${timeout.inSeconds}s';
      return false;
    } catch (e) {
      debugPrint('Socket connection error: $e');
      lastConnectError = e.toString();
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
    final status = latestGameState?['gameStatus'] as String? ?? '';
    if (status != 'playing' && status != 'countdown') return;
    // Scale by the real court width, not just the screen count: LG frames are
    // portrait by default, which makes each frame 608 logical px wide instead
    // of 1920, so the same swipe must move the paddle proportionally less.
    final n = latestGameState?['numScreens'] as int? ?? 3;
    final frameWidth = (latestGameState?['screenWidth'] as num?)?.toDouble() ?? 1920.0;
    final scale = ((n * frameWidth) / (3 * 1920.0)).clamp(0.15, 5.0);
    var stepped = (deltaX * scale).round();
    if (deltaX != 0 && stepped == 0) {
      stepped = deltaX < 0 ? -1 : 1;
    }
    socket!.emit('paddle_move', {
      'deltaX': stepped,
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

  void returnToLobbyFromHost() {
    if (socket == null || !connected) return;
    socket!.emit('return_to_lobby');
  }

  void rematch() {
    if (socket == null || !connected) return;
    socket!.emit('rematch');
  }

  void startGame({
    required int durationSeconds,
    required int maxPlayers,
    required String ballSpeed,
  }) {
    if(socket==null || !connected) return;
    // One message so START cannot race a delayed set_game_settings emit
    // (the lobby persist path awaits SharedPreferences first).
    socket!.emit('start_game', {
      'durationSeconds': durationSeconds,
      'maxPlayers': maxPlayers,
      'ballSpeed': ballSpeed,
    });
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
    lastConnectError = null;
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
