import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';

class LgButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isPrimary;
  final bool disabled;

  const LgButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isPrimary = true,
    this.disabled = false,
  });

  @override
  State<LgButton> createState() => _LgButtonState();
}

class _LgButtonState extends State<LgButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.98).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.disabled || widget.onPressed == null;
    final effectiveOpacity = isDisabled ? 0.4 : 1.0;

    return Opacity(
      opacity: effectiveOpacity,
      child: GestureDetector(
        onTapDown: isDisabled ? null : (_) {
          HapticFeedback.selectionClick();
          _controller.forward();
        },
        onTapUp: isDisabled ? null : (_) {
          _controller.reverse();
          widget.onPressed?.call();
        },
        onTapCancel: isDisabled ? null : () => _controller.reverse(),
        child: AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) => Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          ),
          child: Container(
            height: 56,
            decoration: BoxDecoration(
              color: widget.isPrimary ? accentPrimary : Colors.transparent,
              border: Border.all(color: widget.isPrimary ? accentPrimary : Colors.white.withOpacity(0.12), width: 1.5),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                widget.label,
                style: GoogleFonts.inter(
                  color: widget.isPrimary ? bgDark : textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
