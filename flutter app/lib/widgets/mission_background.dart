import 'package:flutter/material.dart';
import '../utils/constants.dart';

class MissionControlBackground extends StatelessWidget {
  final Widget child;
  
  const MissionControlBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: bgDark,
      ),
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.2,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.6),
                ],
                stops: const [0.4, 1.0],
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
