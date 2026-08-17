import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class ControllerTouchpad extends StatefulWidget {
  final Animation<double> glowAnimation;
  final Color playerColor;
  final Function(double) onPaddleMove;

  const ControllerTouchpad({
    super.key,
    required this.glowAnimation,
    required this.playerColor,
    required this.onPaddleMove,
  });

  @override
  State<ControllerTouchpad> createState() => _ControllerTouchpadState();
}

class _ControllerTouchpadState extends State<ControllerTouchpad> {
  double _puckPosition = 0.0;
  DateTime _lastEmit = DateTime.now();

  void _onPanUpdate(DragUpdateDetails details, double screenWidth) {
    final trackWidth = screenWidth - 64 - 80;
    if (trackWidth <= 0) return;

    final dx = details.delta.dx;

    // Acceleration curve: faster swipes move proportionally more
    final absDx = dx.abs();
    final acceleration = 1.0 + (absDx / 20.0).clamp(0.0, 3.0);
    final acceleratedDelta = dx * acceleration;

    // Convert to rig-scale movement
    final rigDeltaX = acceleratedDelta * 12.0;
    final now = DateTime.now();
    if (now.difference(_lastEmit).inMilliseconds >= 33) {
      widget.onPaddleMove(rigDeltaX);
      _lastEmit = now;
    }

    setState(() {
      _puckPosition += dx;
      double maxVisual = trackWidth / 2;
      _puckPosition = _puckPosition.clamp(-maxVisual, maxVisual);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _puckPosition = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    return GestureDetector(
      onPanUpdate: (details) => _onPanUpdate(details, screenWidth),
      onPanEnd: _onPanEnd,
      child: AnimatedBuilder(
        animation: widget.glowAnimation,
        builder: (context, child) {
          return Container(
            width: double.infinity,
            height: 200,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: cardFill,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: widget.playerColor.withOpacity(widget.glowAnimation.value),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: widget.playerColor.withOpacity(widget.glowAnimation.value * 0.3),
                  blurRadius: 20,
                  spreadRadius: -5,
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Track line
                Container(
                  width: double.infinity,
                  height: 4,
                  margin: const EdgeInsets.symmetric(horizontal: 50),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        widget.playerColor.withOpacity(0.05),
                        widget.playerColor.withOpacity(0.4),
                        widget.playerColor.withOpacity(0.05),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Left/Right arrows
                Positioned(
                  left: 16,
                  child: Icon(
                    Icons.chevron_left_rounded,
                    color: widget.playerColor.withOpacity(0.3),
                    size: 32,
                  ),
                ),
                Positioned(
                  right: 16,
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: widget.playerColor.withOpacity(0.3),
                    size: 32,
                  ),
                ),

                // Label
                Positioned(
                  bottom: 20,
                  child: Text(
                    'SLIDE TO MOVE PADDLE',
                    style: AppFonts.spaceGrotesk(
                      fontSize: 10,
                      color: textSecondary.withOpacity(0.4),
                      fontWeight: FontWeight.bold,
                      letterSpacing: 3,
                    ),
                  ),
                ),

                // Puck
                Transform.translate(
                  offset: Offset(_puckPosition, 0),
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          widget.playerColor,
                          widget.playerColor.withOpacity(0.6),
                          widget.playerColor.withOpacity(0.2),
                        ],
                        stops: const [0.3, 0.7, 1.0],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: widget.playerColor.withOpacity(0.5),
                          blurRadius: 24,
                          spreadRadius: 4,
                        ),
                      ],
                      border: Border.all(
                        color: Colors.white.withOpacity(0.7),
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.drag_handle_rounded,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
