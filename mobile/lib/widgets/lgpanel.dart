import 'package:flutter/material.dart';
import '../utils/constants.dart';

class LgPanel extends StatelessWidget {
  const LgPanel({
    super.key,
    required this.child,
    this.tag,
    this.borderColor = borderLight,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final String? tag;
  final Color borderColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cardFill,
        border: Border.all(color: borderColor, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: padding,
      child: child,
    );
  }
}
