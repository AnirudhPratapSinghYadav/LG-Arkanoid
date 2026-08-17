import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/connectionstatus.dart';
import '../services/ssh_service.dart';
import '../widgets/mission_background.dart';

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
    _gameService.startGame(_selectedDuration);
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

  Widget _buildScreenChip(int n) {
    final selected = _selectedScreens == n;
    return GestureDetector(
      onTap: () => setState(() => _selectedScreens = n),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? accentSystem.withOpacity(0.2) : cardFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? accentSystem : borderLight),
        ),
        child: Text(
          '$n',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: selected ? textPrimary : textSecondary,
          ),
        ),
      ),
    );
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

    final List<Color> playerColors = playerSlotColors;

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
                                Image.asset('assets/lg-logo.png', height: 40),
                                const SizedBox(height: 12),
                                Text(
                                  'LG ARKANOID',
                                  style: GoogleFonts.vt323(
                                    fontSize: 32,
                                    color: accentSystem,
                                    letterSpacing: 2.0,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                Text(
                                  'MULTIPLAYER LOBBY',
                                  style: GoogleFonts.spaceGrotesk(
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
                                    style: GoogleFonts.spaceGrotesk(
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
                                      style: GoogleFonts.spaceGrotesk(
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
                                _buildPlayerRow(
                                  index: i,
                                  playersList: players,
                                  color: playerColors[i % playerColors.length],
                                  masterIndex: masterIndex,
                                ),
                                if (i < maxPlayers - 1) const SizedBox(height: 16),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 48),

                        if (isHost) ...[
                          const SizedBox(height: 16),
                          Text(
                            'MAX PLAYERS',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                              letterSpacing: 1,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (int p = 1; p <= 5; p++)
                                GestureDetector(
                                  onTap: () {
                                    setState(() => _selectedMaxPlayers = p);
                                    _gameService.setMaxPlayers(p);
                                    _persistAndPushSettings();
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: _selectedMaxPlayers == p ? accentSystem.withOpacity(0.2) : cardFill,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: _selectedMaxPlayers == p ? accentSystem : borderLight,
                                      ),
                                    ),
                                    child: Text(
                                      '$p',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: _selectedMaxPlayers == p ? textPrimary : textSecondary,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'SCREENS (RIG)',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                              letterSpacing: 1,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final n in const [1, 3, 5, 7, 9, 12]) _buildScreenChip(n),
                            ],
                          ),
                          const SizedBox(height: 10),
                          LgButton(
                            label: _applyingScreens ? 'APPLYING…' : 'APPLY SCREENS TO RIG',
                            onPressed: _applyingScreens ? null : _applyScreensToRig,
                          ),
                          if (_screenApplyMsg != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              _screenApplyMsg!,
                              style: GoogleFonts.inter(fontSize: 11, color: textSecondary, height: 1.35),
                              textAlign: TextAlign.center,
                            ),
                          ],
                          const SizedBox(height: 16),

                          Text(
                            'BALL SPEED',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                              letterSpacing: 1,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildSpeedOption('slow', 'SLOW'),
                              _buildSpeedOption('medium', 'NORM'),
                              _buildSpeedOption('fast', 'FAST'),
                              _buildSpeedOption('insane', 'HYPER'),
                            ],
                          ),
                          const SizedBox(height: 16),

                          Text(
                            'MATCH DURATION',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                              letterSpacing: 1,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildDurationOption(60, '1 MIN'),
                              _buildDurationOption(180, '3 MIN'),
                              _buildDurationOption(300, '5 MIN'),
                              _buildDurationOption(0, 'ENDLESS'),
                            ],
                          ),
                          const SizedBox(height: 28),
                          Row(
                            children: [
                              Expanded(
                                child: LgButton(
                                  label: 'QR INVITE',
                                  onPressed: () {
                                    final token = _gameService.sessionToken ?? '';
                                    final payload = 'LGARK|${_gameService.serverAddress}|${_gameService.serverPort}|$token';
                                    Navigator.pushNamed(context, '/qrinvite', arguments: payload);
                                  },
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: LgButton(
                                  label: 'START MATCH',
                                  onPressed: connectedCount >= 1 ? _onStartMatch : null,
                                  isPrimary: true,
                                ),
                              ),
                            ],
                          ),
                        ] else
                          AnimatedBuilder(
                            animation: _pulseAnimation,
                            builder: (context, child) {
                              return Opacity(
                                opacity: _pulseAnimation.value,
                                child: Text(
                                  'WAITING FOR HOST TO START',
                                  style: GoogleFonts.spaceGrotesk(
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
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: textSecondary,
                          letterSpacing: 4,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '$_countdownVal',
                        style: GoogleFonts.vt323(
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

  Widget _buildPlayerRow({
    required int index,
    required List<dynamic> playersList,
    required Color color,
    required int masterIndex,
  }) {
    final bool isSlotConnected = index < playersList.length && playersList[index]['connected'] == true;
    final bool isPlayerMaster = index == masterIndex;
    final String displayName = isSlotConnected 
        ? (playersList[index]['name'] as String? ?? 'Player ${index + 1}')
        : 'Waiting...';

    return Row(
      children: [
        isSlotConnected
            ? const Icon(Icons.check_rounded, color: accentSuccess, size: 20)
            : Icon(Icons.radio_button_unchecked_rounded, color: textSecondary.withOpacity(0.2), size: 18),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 15,
              color: isSlotConnected ? textPrimary : textSecondary.withOpacity(0.4),
              fontWeight: isSlotConnected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
        if (isSlotConnected)
          Text(
            isPlayerMaster ? 'HOST' : 'READY',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 11,
              color: isPlayerMaster ? accentGame : accentSuccess,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
      ],
    );
  }

  Widget _buildDurationOption(int duration, String label) {
    final isSelected = _selectedDuration == duration;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedDuration = duration;
        });
        _persistAndPushSettings();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? accentSystem.withOpacity(0.15) : cardFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? accentSystem : borderLight,
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: accentSystem.withOpacity(0.3),
              blurRadius: 10,
              spreadRadius: -2,
            )
          ] : [],
        ),
        child: Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? accentSystem : textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildSpeedOption(String speed, String label) {
    final isSelected = _selectedBallSpeed == speed;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedBallSpeed = speed;
        });
        _persistAndPushSettings();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? accentSystem.withOpacity(0.15) : cardFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? accentSystem : borderLight,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? accentSystem : textSecondary,
          ),
        ),
      ),
    );
  }
}
