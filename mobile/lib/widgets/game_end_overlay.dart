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
                title,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: accentWarning,
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                  fontSize: 24,
                  color: textPrimary,
                  fontWeight: FontWeight.w600,
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
              const SizedBox(height: 48),
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
    );
  }
}
