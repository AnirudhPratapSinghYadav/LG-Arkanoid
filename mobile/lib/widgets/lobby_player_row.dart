import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class LobbyPlayerRow extends StatelessWidget {
  final int index;
  final List<dynamic> playersList;
  final int masterIndex;

  const LobbyPlayerRow({
    super.key,
    required this.index,
    required this.playersList,
    required this.masterIndex,
  });

  @override
  Widget build(BuildContext context) {
    final bool isSlotConnected =
        index < playersList.length && playersList[index]['connected'] == true;
    final bool isPlayerMaster = index == masterIndex;
    final String displayName = isSlotConnected
        ? (playersList[index]['name'] as String? ?? 'Player ${index + 1}')
        : 'Waiting...';

    return Row(
      children: [
        isSlotConnected
            ? const Icon(Icons.check_rounded, color: accentSuccess, size: 20)
            : Icon(Icons.radio_button_unchecked_rounded,
                color: textSecondary.withOpacity(0.2), size: 18),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppFonts.inter(
              fontSize: 15,
              color: isSlotConnected ? textPrimary : textSecondary.withOpacity(0.4),
              fontWeight: isSlotConnected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
        if (isSlotConnected)
          Text(
            isPlayerMaster ? 'HOST' : 'READY',
            style: AppFonts.spaceGrotesk(
              fontSize: 11,
              color: isPlayerMaster ? accentGame : accentSuccess,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
      ],
    );
  }
}
