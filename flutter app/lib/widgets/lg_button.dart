import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class LgButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color accentColor;
  final bool disabled;

  const LgButton({
    super.key,
    required this.label,
    this.onPressed,
    this.accentColor = const Color(0xFF00e5ff),
    this.disabled = false,
  });

  @override
  State<LgButton> createState() => _LgButtonState();
}

class _LgButtonState extends State<LgButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.disabled || widget.onPressed == null;
    final effectiveOpacity = isDisabled ? 0.4 : 1.0;

    return Opacity(
      opacity: effectiveOpacity,
      child: GestureDetector(
        onTapDown: isDisabled ? null : (_) {
          HapticFeedback.lightImpact();
          setState(() => _pressed = true);
        },
        onTapUp: isDisabled ? null : (_) {
          setState(() => _pressed = false);
          widget.onPressed?.call();
        },
        onTapCancel: isDisabled ? null : () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          transform: Matrix4.translationValues(0, _pressed ? 2 : 0, 0),
          decoration: BoxDecoration(
            color: const Color(0xFF0d1117),
            border: Border.all(color: widget.accentColor, width: 2),
            borderRadius: BorderRadius.circular(3),
            boxShadow: [
              BoxShadow(
                color: widget.accentColor.withOpacity(_pressed ? 0.6 : 0.35),
                blurRadius: _pressed ? 18 : 12,
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Center(
            child: Text(
              widget.label.toUpperCase(),
              style: TextStyle(
                fontFamily: 'VT323',
                fontWeight: FontWeight.normal,
                fontSize: 24,
                color: widget.accentColor,
                letterSpacing: 1,
                height: 1.4,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
