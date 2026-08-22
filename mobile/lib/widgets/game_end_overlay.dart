import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import 'lgbutton.dart';

class GameEndOverlay extends StatelessWidget {
  final String kicker;
  final String title;
  final String subtitle;
  final String message;
  final int score;
  final int rank;
  final Color playerColor;
  final List<Map<String, dynamic>> rankings;
  final bool isHost;
  final VoidCallback onExit;
  final VoidCallback? onNewGame;
  final VoidCallback? onRematch;

  const GameEndOverlay({
    super.key,
    required this.kicker,
    required this.title,
    required this.subtitle,
    required this.score,
    required this.rank,
    required this.playerColor,
    required this.onExit,
    this.message = '',
    this.rankings = const <Map<String, dynamic>>[],
    this.isHost = false,
    this.onNewGame,
    this.onRematch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withOpacity(0.92),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  kicker.contains('LUCK')
                      ? Icons.sports_esports_rounded
                      : Icons.emoji_events_rounded,
                  color: accentWarning,
                  size: 64,
                ),
                const SizedBox(height: 12),
                Text(
                  kicker,
                  textAlign: TextAlign.center,
                  style: AppFonts.spaceGrotesk(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: accentWarning,
                    letterSpacing: 3,
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      style: AppFonts.spaceGrotesk(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: accentWarning,
                        letterSpacing: 2,
                        height: 1.05,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: AppFonts.inter(
                      fontSize: 18,
                      color: textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (message.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      message,
                      textAlign: TextAlign.center,
                      style: AppFonts.inter(
                        fontSize: 15,
                        color: textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
                if (rankings.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(
                    'FINAL LEADERBOARD',
                    style: AppFonts.spaceGrotesk(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: accentSystem,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...rankings.take(5).toList().asMap().entries.map((entry) {
                    final i = entry.key;
                    final row = entry.value;
                    final name = (row['name'] as String?) ?? 'Player';
                    final rowScore = row['score'] as int? ?? 0;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Text(
                        '#${i + 1}  ${name.toUpperCase()}   ${rowScore.toString().padLeft(5, '0')}',
                        style: AppFonts.jetBrainsMono(
                          fontSize: 14,
                          color: i == 0 ? accentWarning : textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  }),
                ],
                const SizedBox(height: 12),
                Text(
                  'Your Score: $score',
                  style: AppFonts.jetBrainsMono(
                    fontSize: 18,
                    color: playerColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  rank > 0 ? 'Final Rank: #$rank' : '',
                  style: AppFonts.jetBrainsMono(
                    fontSize: 16,
                    color: textSecondary,
                  ),
                ),
                const SizedBox(height: 28),
                if (isHost) ...[
                  LgButton(
                    label: 'PLAY AGAIN',
                    onPressed: onRematch,
                    isPrimary: true,
                  ),
                  const SizedBox(height: 10),
                  LgButton(
                    label: 'NEW GAME',
                    onPressed: onNewGame,
                    isPrimary: false,
                  ),
                  const SizedBox(height: 10),
                ],
                SizedBox(
                  width: 240,
                  height: 56,
                  child: LgButton(
                    label: 'EXIT',
                    onPressed: onExit,
                    isPrimary: !isHost,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
