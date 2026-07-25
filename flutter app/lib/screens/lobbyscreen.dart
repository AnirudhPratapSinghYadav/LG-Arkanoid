import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
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
    
    if (status == 'countdown' && !_countdownStarted) {
      _startLocalCountdown();
    } else if (status == 'playing') {
      _countdownTimer?.cancel();
      Navigator.pushReplacementNamed(context, '/controller');
    }
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
    _gameService.setGameSettings(
      maxPlayers: _selectedMaxPlayers,
      ballSpeed: _selectedBallSpeed,
      durationSeconds: _selectedDuration,
    );
    _gameService.startGame(_selectedDuration);
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

    final List<Color> playerColors = [
      const Color(0xFF20C5FF), // Player 1 - Cyan
      const Color(0xFFFF2D78), // Player 2 - Pink
      const Color(0xFFFFB800), // Player 3 - Gold
      const Color(0xFFE040FB), // Player 4 - Purple
      const Color(0xFFFF5252), // Player 5 - Red
    ];

    return Scaffold(
      backgroundColor: bgDark,
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
                                  ConnectionStatus(isConnected: SSHService().isConnected, label: 'SYS.CONN'),
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
                          tag: 'LOBBY.01',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                  Text(
                                    '$connectedCount/$maxPlayers CONNECTED',
                                    style: GoogleFonts.vt323(
                                      fontSize: 24,
                                      color: accentGame,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
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
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              for (int p = 1; p <= 5; p++)
                                GestureDetector(
                                  onTap: () {
                                    setState(() => _selectedMaxPlayers = p);
                                    _gameService.setMaxPlayers(p);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: _selectedMaxPlayers == p ? accentSystem.withValues(alpha: 0.2) : cardFill,
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
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
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
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
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
                                    final payload = 'LGARK|${_gameService.serverAddress}|${_gameService.serverPort}|${_gameService.sessionId}';
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
                                  'WAITING FOR HOST TO START...',
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 14,
                                    color: textSecondary,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 2,
                                  ),
                                  textAlign: TextAlign.center,
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
                color: Colors.black.withValues(alpha: 0.85),
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
            : Icon(Icons.radio_button_unchecked_rounded, color: textSecondary.withValues(alpha: 0.2), size: 18),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            displayName,
            style: GoogleFonts.inter(
              fontSize: 15,
              color: isSlotConnected ? textPrimary : textSecondary.withValues(alpha: 0.4),
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
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? accentSystem.withValues(alpha: 0.15) : cardFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? accentSystem : borderLight,
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: accentSystem.withValues(alpha: 0.3),
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
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? accentSystem.withValues(alpha: 0.15) : cardFill,
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
