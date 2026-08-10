import 'package:flutter/material.dart';
import '../utils/constants.dart';

/// Atmospheric dark background used across mission screens.
class MissionControlBackground extends StatelessWidget {
  final Widget child;

  const MissionControlBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF0A121C),
            Color(0xFF070B11),
            Color(0xFF05070C),
          ],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.85),
                radius: 1.1,
                colors: [
                  Color(0x3300E5FF),
                  Color(0x00000000),
                ],
              ),
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(1.0, 1.1),
                radius: 0.9,
                colors: [
                  Color(0x22F4A261),
                  Color(0x00000000),
                ],
              ),
            ),
          ),
          ColoredBox(
            color: bgDark.withOpacity(0.15),
            child: child,
          ),
        ],
      ),
    );
  }
}
