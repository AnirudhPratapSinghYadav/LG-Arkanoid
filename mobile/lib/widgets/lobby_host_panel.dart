import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import 'lgbutton.dart';
import 'lobby_choice_chip.dart';

class LobbyHostPanel extends StatelessWidget {
  final int selectedMaxPlayers;
  final int selectedScreens;
  final String selectedBallSpeed;
  final int selectedDuration;
  final bool applyingScreens;
  final String? screenApplyMsg;
  final int connectedCount;
  final ValueChanged<int> onMaxPlayers;
  final ValueChanged<int> onScreens;
  final VoidCallback onApplyScreens;
  final ValueChanged<String> onBallSpeed;
  final ValueChanged<int> onDuration;
  final VoidCallback onQrInvite;
  final VoidCallback? onStartMatch;

  const LobbyHostPanel({
    super.key,
    required this.selectedMaxPlayers,
    required this.selectedScreens,
    required this.selectedBallSpeed,
    required this.selectedDuration,
    required this.applyingScreens,
    required this.screenApplyMsg,
    required this.connectedCount,
    required this.onMaxPlayers,
    required this.onScreens,
    required this.onApplyScreens,
    required this.onBallSpeed,
    required this.onDuration,
    required this.onQrInvite,
    required this.onStartMatch,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 8),
        Text(
          'CREATE GAME',
          style: AppFonts.spaceGrotesk(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: accentSystem,
            letterSpacing: 2,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          'You are the host. Players default to the wall screen count (max 5).',
          style: AppFonts.inter(fontSize: 12, color: textSecondary, height: 1.35),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Text(
          'PLAYERS (= SCREENS)',
          style: AppFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: textSecondary,
            letterSpacing: 1,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (int p = 1; p <= 5; p++)
              LobbyChoiceChip(
                label: '$p',
                selected: selectedMaxPlayers == p,
                onTap: () => onMaxPlayers(p),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'SCREENS (RIG)',
          style: AppFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: textSecondary,
            letterSpacing: 1,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final n in const [1, 3, 5, 7, 9, 12])
              LobbyChoiceChip(
                label: '$n',
                selected: selectedScreens == n,
                onTap: () => onScreens(n),
              ),
          ],
        ),
        const SizedBox(height: 10),
        LgButton(
          label: applyingScreens ? 'APPLYING…' : 'APPLY SCREENS TO RIG',
          onPressed: applyingScreens ? null : onApplyScreens,
        ),
        if (screenApplyMsg != null) ...[
          const SizedBox(height: 8),
          Text(
            screenApplyMsg!,
            style: AppFonts.inter(fontSize: 11, color: textSecondary, height: 1.35),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 16),
        Text(
          'BALL SPEED',
          style: AppFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: textSecondary,
            letterSpacing: 1,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            LobbyChoiceChip(label: 'SLOW', selected: selectedBallSpeed == 'slow', onTap: () => onBallSpeed('slow')),
            LobbyChoiceChip(label: 'NORM', selected: selectedBallSpeed == 'medium', onTap: () => onBallSpeed('medium')),
            LobbyChoiceChip(label: 'FAST', selected: selectedBallSpeed == 'fast', onTap: () => onBallSpeed('fast')),
            LobbyChoiceChip(label: 'HYPER', selected: selectedBallSpeed == 'insane', onTap: () => onBallSpeed('insane')),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'MATCH DURATION',
          style: AppFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: textSecondary,
            letterSpacing: 1,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            LobbyChoiceChip(label: '1 MIN', selected: selectedDuration == 60, onTap: () => onDuration(60)),
            LobbyChoiceChip(label: '3 MIN', selected: selectedDuration == 180, onTap: () => onDuration(180)),
            LobbyChoiceChip(label: '5 MIN', selected: selectedDuration == 300, onTap: () => onDuration(300)),
            LobbyChoiceChip(label: 'ENDLESS', selected: selectedDuration == 0, onTap: () => onDuration(0)),
          ],
        ),
        const SizedBox(height: 28),
        Row(
          children: [
            Expanded(
              child: LgButton(label: 'QR INVITE', onPressed: onQrInvite),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: LgButton(
                label: 'CREATE & START',
                onPressed: connectedCount >= 1 ? onStartMatch : null,
                isPrimary: true,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
