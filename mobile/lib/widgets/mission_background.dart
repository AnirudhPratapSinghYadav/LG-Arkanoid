import 'package:flutter/material.dart';
import '../utils/constants.dart';

/// Plain dark game background (kept name for existing screen imports).
class MissionControlBackground extends StatelessWidget {
  final Widget child;

  const MissionControlBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: bgDark,
      child: child,
    );
  }
}
