import '../utils/app_fonts.dart';
import 'package:flutter/material.dart';
import '../utils/constants.dart';

class ConnectionStatus extends StatelessWidget {
  final bool isConnected;
  final String label;

  const ConnectionStatus({
    super.key,
    required this.isConnected,
    this.label = '',
  });

  @override
  Widget build(BuildContext context) {
    final color = isConnected ? accentSystem : accentError;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: isConnected
                ? [
                    BoxShadow(
                      color: accentSystem.withOpacity(0.45),
                      blurRadius: 6,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label.isNotEmpty
              ? label
              : (isConnected ? 'CONNECTED' : 'DISCONNECTED'),
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontFamily: AppFonts.jetBrainsMono().fontFamily,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }
}
