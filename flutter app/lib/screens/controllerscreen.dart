import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/mission_background.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen>
    with TickerProviderStateMixin {
  double _puckPosition = 0.0;

  // Power-up cooldown tracking
  DateTime? _lastPowerUpTime;
  static const _powerUpCooldown = Duration(seconds: 5);

  // Game-end overlay
  bool _showGameEndOverlay = false;
  String _gameEndTitle = '';
  String _gameEndSubtitle = '';

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  late AnimationController _glowController;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    final service = context.read<GameService>();
    service.addListener(_onGameStateUpdate);

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _pulseAnimation =
        Tween<double>(begin: 0.6, end: 1.0).animate(_pulseController);

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
    _pulseController.dispose();
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
        winnerName = winner['name'] as String? ?? 'Player ${winner['playerNumber']}';
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

  void _onPanUpdate(DragUpdateDetails details, double screenWidth) {
    final trackWidth = screenWidth - 64 - 80;
    if (trackWidth <= 0) return;

    final dx = details.delta.dx;

    // Acceleration curve: faster swipes move proportionally more
    final absDx = dx.abs();
    final acceleration = 1.0 + (absDx / 20.0).clamp(0.0, 3.0);
    final acceleratedDelta = dx * acceleration;

    // Convert to rig-scale movement
    final rigDeltaX = acceleratedDelta * 12.0;
    context.read<GameService>().sendPaddleMove(rigDeltaX);

    setState(() {
      _puckPosition += dx;
      double maxVisual = trackWidth / 2;
      _puckPosition = _puckPosition.clamp(-maxVisual, maxVisual);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _puckPosition = 0;
    });
  }

  bool get _canUsePowerUp {
    if (_lastPowerUpTime == null) return true;
    return DateTime.now().difference(_lastPowerUpTime!) >= _powerUpCooldown;
  }

  void _activatePowerUp(String type) {
    if (!_canUsePowerUp) {
      HapticFeedback.lightImpact();
      return;
    }
    HapticFeedback.heavyImpact();
    context.read<GameService>().activatePowerUp(type);
    setState(() {
      _lastPowerUpTime = DateTime.now();
    });
  }

  String _formatTime(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final screenWidth = MediaQuery.of(context).size.width;
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: cardFill,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: borderLight),
                      ),
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
                                        color:
                                            playerColor.withValues(alpha: 0.4),
                                        blurRadius: 6,
                                        spreadRadius: 1)
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

                          // Connection status
                          Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: service.connected
                                      ? accentSuccess
                                      : accentError,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                service.connected ? 'ONLINE' : 'OFFLINE',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: service.connected
                                      ? accentSuccess
                                      : accentError,
                                ),
                              ),
                            ],
                          ),

                          // Ping
                          Text(
                            '${service.latencyMs}ms',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Score / Lives / Rank / Timer Row ──
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      children: [
                        // Score
                        Expanded(
                          child: _buildStatCard(
                            label: 'SCORE',
                            value: service.score.toString().padLeft(5, '0'),
                            color: playerColor,
                            icon: Icons.stars_rounded,
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Lives
                        Expanded(
                          child: _buildStatCard(
                            label: 'LIVES',
                            value: '${service.lives}',
                            color: service.lives <= 1
                                ? accentError
                                : accentSuccess,
                            icon: Icons.favorite_rounded,
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Rank
                        Expanded(
                          child: _buildStatCard(
                            label: 'RANK',
                            value: '#${service.rank}',
                            color: service.rank == 1
                                ? accentWarning
                                : accentPrimary,
                            icon: Icons.emoji_events_rounded,
                          ),
                        ),
                        if (showTimer) ...[
                          const SizedBox(width: 8),
                          // Timer
                          Expanded(
                            child: _buildStatCard(
                              label: 'TIME',
                              value: _formatTime(remainingSeconds),
                              color: remainingSeconds <= 30
                                  ? accentError
                                  : textPrimary,
                              icon: Icons.timer_rounded,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 4),

                  // ── Commentary Feed ──
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
                        child: Row(
                          children: [
                            const Icon(Icons.campaign_rounded,
                                color: accentPrimary, size: 16),
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

                  const Spacer(),

                  // ── Power-Up Buttons Row ──
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        _buildPowerUpButton(
                          icon: Icons.swap_horiz_rounded,
                          label: 'WIDE',
                          color: const Color(0xFF4CAF50),
                          type: 'wide_paddle',
                        ),
                        const SizedBox(width: 8),
                        _buildPowerUpButton(
                          icon: Icons.speed_rounded,
                          label: 'SLOW',
                          color: const Color(0xFF2196F3),
                          type: 'slow_ball',
                        ),
                        const SizedBox(width: 8),
                        _buildPowerUpButton(
                          icon: Icons.control_point_duplicate_rounded,
                          label: 'MULTI',
                          color: const Color(0xFFFFB800),
                          type: 'multi_ball',
                        ),
                        const SizedBox(width: 8),
                        _buildPowerUpButton(
                          icon: Icons.local_fire_department_rounded,
                          label: 'BOMB',
                          color: const Color(0xFFD9534F),
                          type: 'bomb',
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Main Touch Controller ──
                  GestureDetector(
                    onPanUpdate: (details) =>
                        _onPanUpdate(details, screenWidth),
                    onPanEnd: _onPanEnd,
                    child: AnimatedBuilder(
                      animation: _glowAnimation,
                      builder: (context, child) {
                        return Container(
                          width: double.infinity,
                          height: 200,
                          margin: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: cardFill,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: playerColor
                                  .withValues(alpha: _glowAnimation.value),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: playerColor.withValues(
                                    alpha: _glowAnimation.value * 0.3),
                                blurRadius: 20,
                                spreadRadius: -5,
                              ),
                            ],
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Track line
                              Container(
                                width: double.infinity,
                                height: 4,
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 50),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      playerColor.withValues(alpha: 0.05),
                                      playerColor.withValues(alpha: 0.4),
                                      playerColor.withValues(alpha: 0.05),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),

                              // Left/Right arrows
                              Positioned(
                                left: 16,
                                child: Icon(
                                  Icons.chevron_left_rounded,
                                  color: playerColor.withValues(alpha: 0.3),
                                  size: 32,
                                ),
                              ),
                              Positioned(
                                right: 16,
                                child: Icon(
                                  Icons.chevron_right_rounded,
                                  color: playerColor.withValues(alpha: 0.3),
                                  size: 32,
                                ),
                              ),

                              // Label
                              Positioned(
                                bottom: 20,
                                child: Text(
                                  'SLIDE TO MOVE PADDLE',
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 10,
                                    color: textSecondary.withValues(alpha: 0.4),
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 3,
                                  ),
                                ),
                              ),

                              // Puck
                              Transform.translate(
                                offset: Offset(_puckPosition, 0),
                                child: Container(
                                  width: 72,
                                  height: 72,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: RadialGradient(
                                      colors: [
                                        playerColor,
                                        playerColor.withValues(alpha: 0.6),
                                        playerColor.withValues(alpha: 0.2),
                                      ],
                                      stops: const [0.3, 0.7, 1.0],
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color:
                                            playerColor.withValues(alpha: 0.5),
                                        blurRadius: 24,
                                        spreadRadius: 4,
                                      ),
                                    ],
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.7),
                                      width: 2,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.drag_handle_rounded,
                                    color: Colors.white,
                                    size: 36,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),

            // ── Game-End Overlay ──
            if (_showGameEndOverlay)
              Container(
                color: Colors.black.withValues(alpha: 0.9),
                child: SafeArea(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.emoji_events_rounded,
                          color: accentWarning,
                          size: 80,
                        ),
                        const SizedBox(height: 24),
                        Text(
                          _gameEndTitle,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: accentWarning,
                            letterSpacing: 4,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _gameEndSubtitle,
                          style: GoogleFonts.inter(
                            fontSize: 24,
                            color: textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Your Score: ${service.score}',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 18,
                            color: playerColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Final Rank: #${service.rank}',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 16,
                            color: textSecondary,
                          ),
                        ),
                        const SizedBox(height: 48),
                        SizedBox(
                          width: 240,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: () {
                              setState(() {
                                _showGameEndOverlay = false;
                              });
                              Navigator.pushNamedAndRemoveUntil(
                                  context, '/joinchoice', (_) => false);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accentPrimary,
                              foregroundColor: bgDark,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: Text(
                              'BACK TO LOBBY',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
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
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: cardFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderLight),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 8,
              fontWeight: FontWeight.bold,
              color: textSecondary,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPowerUpButton({
    required IconData icon,
    required String label,
    required Color color,
    required String type,
  }) {
    final canUse = _canUsePowerUp;

    return Expanded(
      child: GestureDetector(
        onTap: () => _activatePowerUp(type),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: canUse
                ? color.withValues(alpha: 0.12)
                : cardFill.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: canUse ? color.withValues(alpha: 0.5) : borderLight,
              width: 1.5,
            ),
            boxShadow: canUse
                ? [
                    BoxShadow(
                      color: color.withValues(alpha: 0.2),
                      blurRadius: 8,
                      spreadRadius: -2,
                    )
                  ]
                : [],
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: canUse ? color : textSecondary.withValues(alpha: 0.3),
                size: 24,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: canUse ? color : textSecondary.withValues(alpha: 0.3),
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
