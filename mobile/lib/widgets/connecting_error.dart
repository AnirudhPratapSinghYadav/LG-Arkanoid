import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import 'lgbutton.dart';
import 'lgpanel.dart';

class ConnectingError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback onChangeCode;
  final VoidCallback onStartOver;

  const ConnectingError({
    super.key,
    required this.message,
    required this.onRetry,
    required this.onChangeCode,
    required this.onStartOver,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LgPanel(
          child: Column(
            children: [
              const Icon(Icons.wifi_off_rounded, color: accentError, size: 40),
              const SizedBox(height: 12),
              Text(
                'Could not join',
                style: AppFonts.spaceGrotesk(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.left,
                style: AppFonts.inter(
                  fontSize: 14,
                  color: textSecondary,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        LgButton(label: 'TRY AGAIN', onPressed: onRetry, isPrimary: true),
        const SizedBox(height: 10),
        LgButton(
          label: 'CHANGE CODE / IP',
          onPressed: onChangeCode,
          isPrimary: false,
        ),
        const SizedBox(height: 10),
        LgButton(label: 'START OVER', onPressed: onStartOver, isPrimary: false),
      ],
    );
  }
}
