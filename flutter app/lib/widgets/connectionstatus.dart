import 'package:google_fonts/google_fonts.dart';
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isConnected ? accentPrimary : accentError,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label.isNotEmpty
              ? label
              : (isConnected ? 'CONNECTED' : 'DISCONNECTED'),
          style: TextStyle(
            color: isConnected ? accentPrimary : accentError,
            fontSize: 12,
            fontFamily: GoogleFonts.inter().fontFamily,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
