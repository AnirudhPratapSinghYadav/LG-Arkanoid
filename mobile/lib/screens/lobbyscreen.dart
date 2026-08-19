import 'dart:async';
import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/connectionstatus.dart';
import '../services/ssh_service.dart';
import '../widgets/mission_background.dart';
import '../widgets/dual_brand.dart';
import '../widgets/lobby_player_row.dart';
import '../widgets/lobby_host_panel.dart';

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
  int _selectedMaxPlayers = 3;
  String _selectedBallSpeed = 'medium';
  int _selectedScreens = 3;
  bool _applyingScreens = false;
  String? _screenApplyMsg;
  bool _syncedFromServer = false;

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
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(_pulseController);

    // Restore last host choices, then let the live lobby snapshot win once.
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() {
        _selectedScreens = prefs.getInt(prefNumScreens) ?? 3;
        _selectedMaxPlayers = prefs.getInt(prefMaxPlayers) ?? 3;
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

    if (!_syncedFromServer && (status == 'lobby' || status == 'waiting')) {
      _syncedFromServer = true;
      final maxP = gameState['maxPlayers'] as int?;
      final duration = gameState['gameDurationSeconds'] as int?;
      final speed = gameState['ballSpeed'] as String?;
      setState(() {
        if (maxP != null && maxP >= 1 && maxP <= 5) _selectedMaxPlayers = maxP;
        if (duration != null) _selectedDuration = duration;
        if (speed != null && speed.isNotEmpty) _selectedBallSpeed = speed;
      });
    }

    if (status == 'countdown' && !_countdownStarted) {
      _startLocalCountdown();
    } else if (status == 'playing') {
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

  void _onStartMatch() {
    _persistAndPushSettings();
    _gameService.startGame(
      durationSeconds: _selectedDuration,
      maxPlayers: _selectedMaxPlayers,
      ballSpeed: _selectedBallSpeed,
    );
  }

  Future<void> _applyScreensToRig() async {
    if (_applyingScreens) return;
    if (!SSHService().isConnected) {
      setState(() {
        _screenApplyMsg = 'Connect LG SSH in Settings first, then apply screens.';
      });
      return;
    }
    setState(() {
      _applyingScreens = true;
      _screenApplyMsg = 'Applying $_selectedScreens screens to the rig…';
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(prefNumScreens, _selectedScreens);
    final err = await SSHService().relaunchGame(_selectedScreens);
    if (!mounted) return;
    setState(() {
      _applyingScreens = false;
      final failed = err.startsWith('ERROR');
      _screenApplyMsg = failed
          ? 'Rig apply failed: $err'
          : 'Rig relaunched with $_selectedScreens screens. Rejoin if needed.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;
    final players = gameState?['players'] as List<dynamic>? ?? [];
    final maxPlayers = gameState?['maxPlayers'] as int? ?? 3;
    
    // Count active connections
    final connectedCount = players.where((p) => p['connected'] == true).length;
    
    // Check if current player is the host (master)
    final masterIndex = gameState?['masterPlayerIndex'] as int? ?? 0;
    final isHost = (service.playerNumber ?? 0) - 1 == masterIndex;

    return Scaffold(
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
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.settings, color: accentSystem, size: 28),
                                    tooltip: 'Settings & Rig',
                                    onPressed: () => Navigator.pushNamed(context, '/settings'),
                                  ),
                                  ConnectionStatus(isConnected: SSHService().isConnected, label: 'LG LINK'),
                                ],
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
                            selectedScreens: _selectedScreens,
                            selectedBallSpeed: _selectedBallSpeed,
                            selectedDuration: _selectedDuration,
                            applyingScreens: _applyingScreens,
                            screenApplyMsg: _screenApplyMsg,
                            connectedCount: connectedCount,
                            onMaxPlayers: (p) {
                              setState(() => _selectedMaxPlayers = p);
                              _gameService.setMaxPlayers(p);
                              _persistAndPushSettings();
                            },
                            onScreens: (n) {
                              setState(() {
                                _selectedScreens = n;
                                _selectedMaxPlayers = n > 5 ? 5 : (n < 1 ? 1 : n);
                              });
                              _gameService.setMaxPlayers(_selectedMaxPlayers);
                              _persistAndPushSettings();
                            },
                            onApplyScreens: _applyScreensToRig,
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
                              final payload = 'LGARK|${_gameService.serverAddress}|${_gameService.serverPort}|$token';
                              Navigator.pushNamed(context, '/qrinvite', arguments: payload);
                            },
                            onStartMatch: connectedCount >= 1 ? _onStartMatch : null,
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
    );
  }
}
