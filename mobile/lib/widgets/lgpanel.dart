import 'package:flutter/material.dart';
import '../utils/constants.dart';

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
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(20),
      child: child,
    );
  }
}
