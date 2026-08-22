import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import 'app_fonts.dart';
import 'constants.dart';

Future<bool> confirmLeave(BuildContext context, {required String title}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: cardFill,
      title: Text(
        title,
        style: AppFonts.spaceGrotesk(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
      ),
      content: Text(
        'You will leave this session. Scan the wall QR again to rejoin.',
        style: AppFonts.inter(fontSize: 14, color: textSecondary, height: 1.4),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text('STAY', style: AppFonts.spaceGrotesk(color: textSecondary)),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text('LEAVE', style: AppFonts.spaceGrotesk(color: accentError)),
        ),
      ],
    ),
  );
  return ok == true;
}

void leaveToStart(BuildContext context) {
  context.read<GameService>().leaveGame();
  Navigator.of(context).pushNamedAndRemoveUntil('/joinchoice', (_) => false);
}
