import 'dart:async';
import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/mission_background.dart';
import '../widgets/dual_brand.dart';
import '../widgets/lobby_player_row.dart';
import '../widgets/lobby_host_panel.dart';
import '../widgets/lgbutton.dart';
import '../utils/leave_match.dart';
import '../utils/json_int.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> with TickerProviderStateMixin {
  late GameService _gameService;
  
  int _countdownVal = 3;
  Timer? _countdownTimer;
  bool _countdownStarted = false;
  int _selectedDuration = 180;
  int _selectedMaxPlayers = 2;
  String _selectedBallSpeed = 'medium';
  bool _syncedFromServer = false;
  bool _openedController = false;
  String _lastHeardStatus = '';
  int _lastHeardConnected = -1;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _gameService = context.read<GameService>();
    _gameService.addListener(_onServiceUpdate);

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _pulseAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(_pulseController);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _pulseController.forward();
    });

    // Restore last host choices, then let the live lobby snapshot win once.
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() {
        _selectedMaxPlayers = prefs.getInt(prefMaxPlayers) ?? 2;
        _selectedDuration = prefs.getInt(prefMatchDuration) ?? 180;
        _selectedBallSpeed = prefs.getString(prefBallSpeed) ?? 'medium';
      });
    });
  }

  @override
  void dispose() {
    _gameService.removeListener(_onServiceUpdate);
    _countdownTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  void _onServiceUpdate() {
    if (!mounted) return;
    final gameState = _gameService.latestGameState;
    if (gameState == null) return;

    final status = gameState['gameStatus'] as String? ?? 'lobby';
    final players = gameState['players'] as List<dynamic>? ?? [];
    final connected = players.where((p) => p is Map && p['connected'] == true).length;
    if (status == _lastHeardStatus &&
        connected == _lastHeardConnected &&
        _syncedFromServer &&
        status != 'playing') {
      return;
    }
    _lastHeardStatus = status;
    _lastHeardConnected = connected;

    if (!_syncedFromServer && (status == 'lobby' || status == 'waiting')) {
      _syncedFromServer = true;
      final maxP = asInt(gameState['maxPlayers']);
      final duration = asInt(gameState['gameDurationSeconds']);
      final speed = gameState['ballSpeed'] as String?;
      setState(() {
        if (maxP != null && maxP >= 1 && maxP <= 5) _selectedMaxPlayers = maxP;
        if (duration != null) _selectedDuration = duration;
        if (speed != null && speed.isNotEmpty) _selectedBallSpeed = speed;
      });
    }

    if (status == 'countdown' && !_countdownStarted) {
      _startLocalCountdown();
    } else if (status == 'playing' && !_openedController) {
      _openedController = true;
      _countdownTimer?.cancel();
      Navigator.pushReplacementNamed(context, '/controller');
    }
  }

  Future<void> _persistAndPushSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(prefMaxPlayers, _selectedMaxPlayers);
    await prefs.setInt(prefMatchDuration, _selectedDuration);
    await prefs.setString(prefBallSpeed, _selectedBallSpeed);
    _gameService.setGameSettings(
      maxPlayers: _selectedMaxPlayers,
      ballSpeed: _selectedBallSpeed,
      durationSeconds: _selectedDuration,
    );
  }

  void _startLocalCountdown() {
    setState(() {
      _countdownStarted = true;
      _countdownVal = 3;
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          if (_countdownVal > 1) {
            _countdownVal--;
          } else {
            _countdownTimer?.cancel();
          }
        });
      }
    });
  }

  Future<void> _onStartMatch() async {
    final gameState = _gameService.latestGameState;
    final players = gameState?['players'] as List<dynamic>? ?? [];
    final connected = players.where((p) => p is Map && p['connected'] == true).length;
    final slots = startSlotCount(connected: connected, selected: _selectedMaxPlayers);
    if (slots < 1) return;
    setState(() => _selectedMaxPlayers = slots);
    await _persistAndPushSettings();
    if (!mounted) return;
    _gameService.startGame(
      durationSeconds: _selectedDuration,
      maxPlayers: slots,
      ballSpeed: _selectedBallSpeed,
    );
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;
    final players = gameState?['players'] as List<dynamic>? ?? [];
    final maxPlayers = asInt(gameState?['maxPlayers']) ?? 3;
    
    final connectedCount = players.where((p) => p is Map && p['connected'] == true).length;
    
    final masterIndex = asInt(gameState?['masterPlayerIndex']) ?? 0;
    final mySlot = asInt(service.playerNumber) ?? 0;
    final isHost = mySlot > 0 && (mySlot - 1) == masterIndex;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final ok = await confirmLeave(context, title: 'LEAVE LOBBY?');
        if (!ok || !context.mounted) return;
        leaveToStart(context);
      },
      child: Scaffold(
      backgroundColor: Colors.transparent,
      body: MissionControlBackground(
        child: Stack(
          children: [
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Stack(
                          alignment: Alignment.topCenter,
                          children: [
                            Align(
                              alignment: Alignment.topRight,
                              child: IconButton(
                                icon: const Icon(Icons.settings, color: accentSystem, size: 28),
                                tooltip: 'Settings',
                                onPressed: () => Navigator.pushNamed(context, '/settings'),
                              ),
                            ),
                            Column(
                              children: [
                                const DualBrand(height: 36),
                                const SizedBox(height: 12),
                                Text(
                                  'AI ARKANOID LG',
                                  style: AppFonts.vt323(
                                    fontSize: 32,
                                    color: accentSystem,
                                    letterSpacing: 2.0,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                Text(
                                  'MULTIPLAYER LOBBY',
                                  style: AppFonts.spaceGrotesk(
                                    fontSize: 12,
                                    color: textSecondary,
                                    letterSpacing: 3.0,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 36),

                        LgPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'PLAYERS',
                                    style: AppFonts.spaceGrotesk(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: textPrimary,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      '$connectedCount / $maxPlayers',
                                      textAlign: TextAlign.right,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppFonts.spaceGrotesk(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: accentGame,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Divider(color: borderLight),
                              const SizedBox(height: 12),
                              
                              for (int i = 0; i < maxPlayers; i++) ...[
                                LobbyPlayerRow(
                                  index: i,
                                  playersList: players,
                                  masterIndex: masterIndex,
                                ),
                                if (i < maxPlayers - 1) const SizedBox(height: 16),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 48),

                        if (isHost)
                          LobbyHostPanel(
                            selectedMaxPlayers: _selectedMaxPlayers,
                            selectedBallSpeed: _selectedBallSpeed,
                            selectedDuration: _selectedDuration,
                            connectedCount: connectedCount,
                            onMaxPlayers: (p) {
                              setState(() => _selectedMaxPlayers = p);
                              _gameService.setMaxPlayers(p);
                              _persistAndPushSettings();
                            },
                            onBallSpeed: (speed) {
                              setState(() => _selectedBallSpeed = speed);
                              _persistAndPushSettings();
                            },
                            onDuration: (duration) {
                              setState(() => _selectedDuration = duration);
                              _persistAndPushSettings();
                            },
                            onQrInvite: () {
                              final token = _gameService.sessionToken ?? '';
                              final payload =
                                  'http://${_gameService.serverAddress}:${_gameService.serverPort}/controller?c=$token';
                              Navigator.pushNamed(context, '/qrinvite', arguments: payload);
                            },
                            onStartMatch:
                                connectedCount >= 1 ? _onStartMatch : null,
                          )
                        else
                          AnimatedBuilder(
                            animation: _pulseAnimation,
                            builder: (context, child) {
                              return Opacity(
                                opacity: _pulseAnimation.value,
                                child: Text(
                                  'WAITING FOR HOST TO START',
                                  style: AppFonts.spaceGrotesk(
                                    fontSize: 13,
                                    color: textSecondary,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1,
                                  ),
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            },
                          ),
                        const SizedBox(height: 16),
                        LgButton(
                          label: 'LEAVE LOBBY',
                          isPrimary: false,
                          onPressed: () async {
                            final ok = await confirmLeave(context, title: 'LEAVE LOBBY?');
                            if (!ok || !context.mounted) return;
                            leaveToStart(context);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            if (_countdownStarted)
              Container(
                color: Colors.black.withOpacity(0.85),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'GET READY',
                        style: AppFonts.spaceGrotesk(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: textSecondary,
                          letterSpacing: 4,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '$_countdownVal',
                        style: AppFonts.vt323(
                          fontSize: 140,
                          color: accentGame,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
    );
  }
}
