import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';

class PlayerStatsBar extends StatelessWidget {
  final Color playerColor;
  final int remainingSeconds;
  final bool showTimer;
  final bool warnLowTime;

  const PlayerStatsBar({
    super.key,
    required this.playerColor,
    required this.remainingSeconds,
    required this.showTimer,
    this.warnLowTime = false,
  });

  String _formatTime(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
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
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              maxLines: 1,
              style: GoogleFonts.spaceGrotesk(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: textSecondary,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
              color: service.lives <= 1 ? accentError : accentSuccess,
              icon: Icons.favorite_rounded,
            ),
          ),
          const SizedBox(width: 8),
          // Rank
          Expanded(
            child: _buildStatCard(
              label: 'RANK',
              value: '#${service.rank}',
              color: service.rank == 1 ? accentWarning : accentSystem,
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
                color: warnLowTime ? accentError : textPrimary,
                icon: Icons.timer_rounded,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
