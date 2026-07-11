import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
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
    // Call startGame with 180 seconds default duration
    _gameService.startGame(180);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;
    final players = gameState?['players'] as List<dynamic>? ?? [];
    
    // Count active connections
    final connectedCount = players.where((p) => p['connected'] == true).length;
    
    // Check if current player is the host (master)
    final masterIndex = gameState?['masterPlayerIndex'] as int? ?? 0;
    final isHost = (service.playerNumber ?? 0) - 1 == masterIndex;

    // Paddle/Player Colors matching Rig Client
    final List<Color> playerColors = [
      const Color(0xFF20C5FF), // Player 1 - Cyan
      const Color(0xFFFF2D78), // Player 2 - Pink
      const Color(0xFFFFB800), // Player 3 - Gold
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
                        // App Logo & title
                        Column(
                          children: [
                            Image.asset('assets/lg-logo.png', height: 40),
                            const SizedBox(height: 12),
                            Text(
                              'LG ARKANOID',
                              style: GoogleFonts.vt323(
                                fontSize: 32,
                                color: accentPrimary,
                                letterSpacing: 2.0,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            Text(
                              'MULTIPLAYER LOBBY',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: textSecondary,
                                letterSpacing: 3.0,
                                fontWeight: FontWeight.w600,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                        const SizedBox(height: 36),

                        // Connected Players Panel
                        LgPanel(
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
                                    '$connectedCount/3 CONNECTED',
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 12,
                                      color: accentPrimary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Divider(color: borderLight),
                              const SizedBox(height: 12),
                              
                              // List 3 players slots
                              for (int i = 0; i < 3; i++) ...[
                                _buildPlayerRow(
                                  index: i,
                                  playersList: players,
                                  color: playerColors[i % playerColors.length],
                                  masterIndex: masterIndex,
                                ),
                                if (i < 2) const SizedBox(height: 16),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 48),

                        // Master Host Start Match Button or Muted waiting label
                        if (isHost)
                          LgButton(
                            label: 'START MATCH',
                            onPressed: connectedCount >= 1 ? _onStartMatch : null,
                            isPrimary: true,
                          )
                        else
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

            // Countdown Overlay
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
                          color: accentPrimary,
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
              color: isPlayerMaster ? accentPrimary : accentSuccess,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
      ],
    );
  }
}
