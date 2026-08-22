import 'dart:async';
import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class ControllerDpad extends StatefulWidget {
  final Color playerColor;
  final Function(double) onPaddleMove;

  const ControllerDpad({
    super.key,
    required this.playerColor,
    required this.onPaddleMove,
  });

  @override
  State<ControllerDpad> createState() => _ControllerDpadState();
}

class _ControllerDpadState extends State<ControllerDpad> {
  Timer? _dpadRepeatTimer;

  void _startDpadMovement(double stepDelta) {
    widget.onPaddleMove(stepDelta);
    _dpadRepeatTimer?.cancel();
    _dpadRepeatTimer = Timer.periodic(const Duration(milliseconds: 50), (_) {
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

  Widget _padButton({
    required IconData icon,
    required String label,
    required double delta,
  }) {
    return Expanded(
      child: Listener(
        onPointerDown: (_) => _startDpadMovement(delta),
        onPointerUp: (_) => _stopDpadMovement(),
        onPointerCancel: (_) => _stopDpadMovement(),
        child: Container(
          constraints: const BoxConstraints(minHeight: 88),
          decoration: BoxDecoration(
            color: cardFill,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: widget.playerColor.withOpacity(0.35),
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 48, color: widget.playerColor),
              const SizedBox(height: 12),
              Text(
                label,
                style: AppFonts.spaceGrotesk(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: textPrimary,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _padButton(
            icon: Icons.arrow_back_ios_new_rounded,
            label: 'HOLD LEFT',
            delta: -48.0,
          ),
          const SizedBox(width: 16),
          _padButton(
            icon: Icons.arrow_forward_ios_rounded,
            label: 'HOLD RIGHT',
            delta: 48.0,
          ),
        ],
      ),
    );
  }
}
