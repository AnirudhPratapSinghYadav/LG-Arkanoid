import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import 'connectionstatus.dart';
import 'lgpanel.dart';

class ControllerHudBar extends StatelessWidget {
  final Color playerColor;
  final int playerNumber;
  final bool connected;
  final int latencyMs;
  final VoidCallback onLeave;

  const ControllerHudBar({
    super.key,
    required this.playerColor,
    required this.playerNumber,
    required this.connected,
    required this.latencyMs,
    required this.onLeave,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
      child: LgPanel(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
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
              'P$playerNumber',
              style: AppFonts.spaceGrotesk(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: textPrimary,
              ),
            ),
            const Spacer(),
            Flexible(
              child: ConnectionStatus(isConnected: connected, label: 'GAME'),
            ),
            const SizedBox(width: 6),
            Text(
              '${latencyMs}ms',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppFonts.jetBrainsMono(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: textSecondary,
              ),
            ),
            TextButton(
              onPressed: onLeave,
              style: TextButton.styleFrom(
                foregroundColor: accentError,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: const Size(56, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                'LEAVE',
                style: AppFonts.spaceGrotesk(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: accentError,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
