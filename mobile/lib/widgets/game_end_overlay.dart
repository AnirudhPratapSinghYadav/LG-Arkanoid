import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';

class GameEndOverlay extends StatelessWidget {
  final String title;
  final String subtitle;
  final int score;
  final int rank;
  final Color playerColor;
  final VoidCallback onBackToLobby;

  const GameEndOverlay({
    super.key,
    required this.title,
    required this.subtitle,
    required this.score,
    required this.rank,
    required this.playerColor,
    required this.onBackToLobby,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withOpacity(0.9),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.emoji_events_rounded,
                color: accentWarning,
                size: 80,
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    style: GoogleFonts.spaceGrotesk(
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
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    color: textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Your Score: $score',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 18,
                  color: playerColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Final Rank: #$rank',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 16,
                  color: textSecondary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'The wall returns to the lobby automatically.',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: 240,
                height: 56,
                child: ElevatedButton(
                  onPressed: onBackToLobby,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentSystem,
                    foregroundColor: bgDark,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(
                    'NEXT LOBBY',
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
    );
  }
}
