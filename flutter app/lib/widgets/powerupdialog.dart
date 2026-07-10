import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/game_service.dart';
import '../utils/constants.dart';
import 'lg_panel.dart';
import 'lg_button.dart';

void showPowerUpDialog(BuildContext context) {
  showDialog(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: Colors.transparent,
      child: LgPanel(
        accentColor: accentAmber,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'ACTIVATE POWER UP',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'VT323',
                fontSize: 24,
                color: accentAmber,
                letterSpacing: 1,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            _powerUpButton(context, 'Wide Paddle', 'wide_paddle', accentCyan, Icons.swap_horiz),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Slow Ball', 'slow_ball', accentCyan, Icons.speed),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Multi Ball', 'multi_ball', accentAmber, Icons.control_point_duplicate),
            const SizedBox(height: 12),
            _powerUpButton(context, 'Bomb', 'bomb', accentMagenta, Icons.local_fire_department),
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
      accentColor: accent,
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
                fontFamily: 'VT323',
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
