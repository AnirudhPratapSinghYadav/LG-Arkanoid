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
import '../widgets/lg_bot.dart';

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
                      tag: 'SYS.CTRL',
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Player indicator
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: playerColor,
                                  boxShadow: [
                                    BoxShadow(
                                      color: playerColor.withOpacity(0.4),
                                      blurRadius: 6,
                                      spreadRadius: 1,
                                    )
                                  ],
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

                          // Connection status (Game)
                          ConnectionStatus(
                              isConnected: service.connected, label: 'GAME'),

                          // Ping + Rig connection
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
                                  label: 'SYS.CONN'),
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

                  // ── Commentary Feed ──
                  if (service.lastCommentary.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          LgBot(
                            state: service.robotState == 'excited'
                                ? BotState.excited
                                : service.robotState == 'alert'
                                    ? BotState.alert
                                    : service.robotState == 'thinking'
                                        ? BotState.thinking
                                        : BotState.idle,
                          ),
                          const SizedBox(width: 4),
                          // Speech bubble tail
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: CustomPaint(
                              size: const Size(8, 12),
                              painter: _BubbleTailPainter(
                                color: cardFill,
                                borderColor: borderLight,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: cardFill,
                                borderRadius: BorderRadius.circular(10)
                                    .copyWith(bottomLeft: Radius.zero),
                                border: Border.all(color: borderLight),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    service.lastCommentarySource == 'fallback'
                                        ? Icons.chat_bubble_outline_rounded
                                        : Icons.auto_awesome_rounded,
                                    color:
                                        service.lastCommentarySource == 'fallback'
                                            ? textSecondary
                                            : accentSystem,
                                    size: 16,
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: service.lastCommentarySource ==
                                              'fallback'
                                          ? Colors.transparent
                                          : accentSystem.withOpacity(0.2),
                                      border: Border.all(
                                        color: service.lastCommentarySource ==
                                                'fallback'
                                            ? borderLight
                                            : accentSystem,
                                      ),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      service.lastCommentarySource == 'fallback'
                                          ? 'CANNED'
                                          : 'GEMINI',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                        color: service.lastCommentarySource ==
                                                'fallback'
                                            ? textSecondary
                                            : accentSystem,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      service.lastCommentary,
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: textSecondary,
                                        fontStyle: FontStyle.italic,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
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
                                      'DRAG STRIP',
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
                                      'D-PAD ARROWS',
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

class _BubbleTailPainter extends CustomPainter {
  final Color color;
  final Color borderColor;
  _BubbleTailPainter({required this.color, required this.borderColor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(size.width, 0)
      ..lineTo(0, size.height / 2)
      ..lineTo(size.width, size.height)
      ..close();

    canvas.drawPath(path, paint);

    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final borderPath = Path()
      ..moveTo(size.width, 0)
      ..lineTo(0, size.height / 2)
      ..lineTo(size.width, size.height);

    canvas.drawPath(borderPath, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
