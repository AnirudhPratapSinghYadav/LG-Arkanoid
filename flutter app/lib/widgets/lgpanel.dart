import 'package:flutter/material.dart';

class LgPanel extends StatelessWidget {
  final Widget child;
  final Color accentColor;

  const LgPanel({
    super.key,
    required this.child,
    this.accentColor = const Color(0xFF00e5ff),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: accentColor, width: 2), // Changed to 2 to match spec
        borderRadius: BorderRadius.circular(3),
        boxShadow: [
          BoxShadow(
            color: accentColor.withOpacity(0.35),
            blurRadius: 12,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(3),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0d1117),
            border: Border.all(color: accentColor.withOpacity(0.4), width: 1),
            borderRadius: BorderRadius.circular(2),
          ),
          padding: const EdgeInsets.all(12),
          child: child,
        ),
      ),
    );
  }
}
