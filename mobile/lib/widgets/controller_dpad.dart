import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class ControllerDpad extends StatefulWidget {
  final Animation<double> glowAnimation;
  final Color playerColor;
  final Function(double) onPaddleMove;

  const ControllerDpad({
    super.key,
    required this.glowAnimation,
    required this.playerColor,
    required this.onPaddleMove,
  });

  @override
  State<ControllerDpad> createState() => _ControllerDpadState();
}

class _ControllerDpadState extends State<ControllerDpad> {
  Timer? _dpadRepeatTimer;

  void _startDpadMovement(double stepDelta) {
    HapticFeedback.selectionClick();
    widget.onPaddleMove(stepDelta);
    _dpadRepeatTimer?.cancel();
    _dpadRepeatTimer = Timer.periodic(const Duration(milliseconds: 30), (_) {
      if (mounted) {
        widget.onPaddleMove(stepDelta);
      }
    });
  }

  void _stopDpadMovement() {
    _dpadRepeatTimer?.cancel();
    _dpadRepeatTimer = null;
  }

  @override
  void dispose() {
    _dpadRepeatTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 200,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Listener(
              onPointerDown: (_) => _startDpadMovement(-24.0),
              onPointerUp: (_) => _stopDpadMovement(),
              onPointerCancel: (_) => _stopDpadMovement(),
              child: AnimatedBuilder(
                animation: widget.glowAnimation,
                builder: (context, child) {
                  return Container(
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
                          blurRadius: 15,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.arrow_back_ios_new_rounded,
                            size: 48, color: widget.playerColor),
                        const SizedBox(height: 12),
                        Text(
                          'HOLD LEFT',
                          style: AppFonts.spaceGrotesk(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Listener(
              onPointerDown: (_) => _startDpadMovement(24.0),
              onPointerUp: (_) => _stopDpadMovement(),
              onPointerCancel: (_) => _stopDpadMovement(),
              child: AnimatedBuilder(
                animation: widget.glowAnimation,
                builder: (context, child) {
                  return Container(
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
                          blurRadius: 15,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.arrow_forward_ios_rounded,
                            size: 48, color: widget.playerColor),
                        const SizedBox(height: 12),
                        Text(
                          'HOLD RIGHT',
                          style: AppFonts.spaceGrotesk(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
