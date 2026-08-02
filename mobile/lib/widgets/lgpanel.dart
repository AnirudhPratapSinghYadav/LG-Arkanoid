import 'package:flutter/material.dart';
import '../utils/constants.dart';
import 'package:google_fonts/google_fonts.dart';

class LgPanel extends StatelessWidget {
  final Widget child;
  final String? tag;
  final Color borderColor;

  const LgPanel({
    super.key,
    required this.child,
    this.tag,
    this.borderColor = borderLight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cardFill,
        border: Border.all(color: borderColor, width: 1),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 24, right: 24, bottom: 24, top: 32),
            child: child,
          ),
          if (tag != null)
            Positioned(
              top: 12,
              left: 16,
              child: Text(
                tag!,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  color: accentSystem,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
