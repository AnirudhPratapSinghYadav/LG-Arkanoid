import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import 'lgpanel.dart';

void showPowerUpDialog(BuildContext context) {
  showDialog(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: Colors.transparent,
      child: LgPanel(
        
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'ACTIVATE POWER UP',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: GoogleFonts.inter().fontFamily,
                fontSize: 24,
                color: accentWarning,
                letterSpacing: 1,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            _powerUpButton(context, 'Wide Paddle', 'wide_paddle', accentPrimary, Icons.swap_horiz),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Slow Ball', 'slow_ball', accentPrimary, Icons.speed),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Multi Ball', 'multi_ball', accentWarning, Icons.control_point_duplicate),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Bomb', 'bomb', accentError, Icons.local_fire_department),
          ],
        ),
      ),
    ),
  );
}

Widget _powerUpButton(BuildContext context, String label, String type, Color accent, IconData icon) {
  return GestureDetector(
    onTap: () {
      HapticFeedback.lightImpact();
      context.read<GameService>().activatePowerUp(type);
      Navigator.pop(context);
    },
    child: LgPanel(
      
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: accent, size: 28),
            const SizedBox(width: 12),
            Text(
              label.toUpperCase(),
              style: TextStyle(
                fontFamily: GoogleFonts.inter().fontFamily,
                fontSize: 24,
                color: accent,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

