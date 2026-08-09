import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/mission_background.dart';
import '../widgets/lgpanel.dart';
import '../widgets/connectionstatus.dart';
import '../services/ssh_service.dart';
import '../widgets/controller_touchpad.dart';
import '../widgets/controller_dpad.dart';
import '../widgets/powerup_panel.dart';
import '../widgets/player_stats_bar.dart';
import '../widgets/game_end_overlay.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen>
    with TickerProviderStateMixin {
  String _controlMode = 'touch'; // 'touch' or 'dpad'

  // Game-end overlay state
  bool _showGameEndOverlay = false;
  String _gameEndTitle = '';
  String _gameEndSubtitle = '';

  late AnimationController _glowController;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    final service = context.read<GameService>();
    service.addListener(_onGameStateUpdate);

    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _glowAnimation =
        Tween<double>(begin: 0.2, end: 0.6).animate(_glowController);
  }

  @override
  void dispose() {
    context.read<GameService>().removeListener(_onGameStateUpdate);
    _glowController.dispose();
    super.dispose();
  }

  void _onGameStateUpdate() {
    if (!mounted) return;
    final service = context.read<GameService>();
    final gameState = service.latestGameState;
    if (gameState == null) return;

    final status = gameState['gameStatus'] as String? ?? 'playing';

    if ((status == 'game_over' || status == 'time_up' || status == 'win') &&
        !_showGameEndOverlay) {
      // Determine winner
      final players = gameState['players'] as List<dynamic>? ?? [];
      final sorted = List<dynamic>.from(players)
        ..sort((a, b) {
          final aScore = (a as Map)['score'] as int? ?? 0;
          final bScore = (b as Map)['score'] as int? ?? 0;
          return bScore.compareTo(aScore);
        });

      String winnerName = 'Nobody';
      if (sorted.isNotEmpty) {
        final winner = sorted.first as Map;
        winnerName =
            winner['name'] as String? ?? 'Player ${winner['playerNumber']}';
      }

      setState(() {
        _showGameEndOverlay = true;
        if (status == 'time_up') {
          _gameEndTitle = 'TIME\'S UP!';
        } else if (status == 'win') {
          _gameEndTitle = 'VICTORY!';
        } else {
          _gameEndTitle = 'GAME OVER';
        }
        _gameEndSubtitle = '$winnerName wins!';
      });

      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;

    final List<Color> playerColors = [
      const Color(0xFF20C5FF), // Player 1 - Cyan
      const Color(0xFFFF2D78), // Player 2 - Pink
      const Color(0xFFFFB800), // Player 3 - Gold
    ];
    final playerColor =
        playerColors[((service.playerNumber ?? 1) - 1) % playerColors.length];

    // Calculate remaining time
    int remainingSeconds = 0;
    bool showTimer = false;
    if (gameState != null) {
      final gameStartedAt = gameState['gameStartedAt'] as int?;
      final duration = gameState['gameDurationSeconds'] as int? ?? 180;
      final status = gameState['gameStatus'] as String? ?? '';
      if (gameStartedAt != null && status == 'playing' && duration > 0) {
        final elapsed =
            (DateTime.now().millisecondsSinceEpoch - gameStartedAt) ~/ 1000;
        remainingSeconds = max(0, duration - elapsed);
        showTimer = true;
      }
    }

    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: Stack(
          children: [
            SafeArea(
              child: Column(
                children: [
                  // ── Top HUD: Player info + Connection ──
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: LgPanel(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: playerColor,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'P${service.playerNumber ?? 1}',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: textPrimary,
                                ),
                              ),
                            ],
                          ),
                          ConnectionStatus(
                              isConnected: service.connected, label: 'GAME'),
                          Row(
                            children: [
                              Text(
                                '${service.latencyMs}ms',
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: textSecondary,
                                ),
                              ),
                              const SizedBox(width: 8),
                              ConnectionStatus(
                                  isConnected: SSHService().isConnected,
                                  label: 'RIG'),
                              const SizedBox(width: 4),
                              IconButton(
                                icon: const Icon(Icons.settings,
                                    color: textSecondary, size: 18),
                                constraints: const BoxConstraints(),
                                padding: EdgeInsets.zero,
                                tooltip: 'Settings',
                                onPressed: () =>
                                    Navigator.pushNamed(context, '/settings'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Score / Lives / Rank / Timer Row ──
                  PlayerStatsBar(
                    playerColor: playerColor,
                    remainingSeconds: remainingSeconds,
                    showTimer: showTimer,
                  ),

                  const SizedBox(height: 4),

                  if (service.lastCommentary.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: cardFill,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: borderLight),
                        ),
                        child: Text(
                          service.lastCommentary,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),

                  const Spacer(),

                  // ── Power-Up Buttons Row ──
                  const PowerupPanel(),

                  const SizedBox(height: 12),

                  // ── Control Mode Selector ──
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: cardFill,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: borderLight),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () =>
                                  setState(() => _controlMode = 'touch'),
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _controlMode == 'touch'
                                      ? playerColor.withOpacity(0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: _controlMode == 'touch'
                                        ? playerColor
                                        : Colors.transparent,
                                    width: 1,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.touch_app_rounded,
                                      size: 16,
                                      color: _controlMode == 'touch'
                                          ? playerColor
                                          : textSecondary,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'TOUCH',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: _controlMode == 'touch'
                                            ? textPrimary
                                            : textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: GestureDetector(
                              onTap: () =>
                                  setState(() => _controlMode = 'dpad'),
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _controlMode == 'dpad'
                                      ? playerColor.withOpacity(0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: _controlMode == 'dpad'
                                        ? playerColor
                                        : Colors.transparent,
                                    width: 1,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.gamepad_rounded,
                                      size: 16,
                                      color: _controlMode == 'dpad'
                                          ? playerColor
                                          : textSecondary,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'D-PAD',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: _controlMode == 'dpad'
                                            ? textPrimary
                                            : textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Main Controller (Touch Drag or D-Pad) ──
                  if (_controlMode == 'dpad')
                    ControllerDpad(
                      glowAnimation: _glowAnimation,
                      playerColor: playerColor,
                      onPaddleMove: (delta) {
                        context.read<GameService>().sendPaddleMove(delta);
                      },
                    )
                  else
                    ControllerTouchpad(
                      glowAnimation: _glowAnimation,
                      playerColor: playerColor,
                      onPaddleMove: (delta) {
                        context.read<GameService>().sendPaddleMove(delta);
                      },
                    ),
                  const SizedBox(height: 16),
                ],
              ),
            ),

            // ── Game-End Overlay ──
            if (_showGameEndOverlay)
              GameEndOverlay(
                title: _gameEndTitle,
                subtitle: _gameEndSubtitle,
                score: service.score,
                rank: service.rank,
                playerColor: playerColor,
                onBackToLobby: () {
                  setState(() {
                    _showGameEndOverlay = false;
                  });
                  Navigator.pushNamedAndRemoveUntil(
                      context, '/joinchoice', (_) => false);
                },
              ),
          ],
        ),
      ),
    );
  }
}

