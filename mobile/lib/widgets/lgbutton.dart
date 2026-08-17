import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_fonts.dart';
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
  bool _isFocused = false;

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
        child: Focus(
          onFocusChange: (focused) {
            setState(() {
              _isFocused = focused;
            });
          },
          child: AnimatedBuilder(
            animation: _scaleAnimation,
            builder: (context, child) => Transform.scale(
              scale: _scaleAnimation.value,
              child: child,
            ),
            child: Container(
            height: 56,
            decoration: BoxDecoration(
              gradient: widget.isPrimary
                  ? const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0xFF33D0FF),
                        Color(0xFF20C5FF),
                        Color(0xFF1296C4),
                      ],
                    )
                  : null,
              color: widget.isPrimary ? null : Colors.transparent,
              border: Border.all(
                color: _isFocused
                    ? accentSystem
                    : (widget.isPrimary ? const Color(0xFF20C5FF) : Colors.white.withOpacity(0.12)),
                width: _isFocused ? 2.5 : 1.5,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: widget.isPrimary && !isDisabled
                  ? [
                      BoxShadow(
                        color: accentSystem.withOpacity(_isFocused ? 0.45 : 0.28),
                        blurRadius: _isFocused ? 16 : 12,
                        offset: const Offset(0, 6),
                      )
                    ]
                  : (_isFocused
                      ? [
                          BoxShadow(
                            color: accentSystem.withOpacity(0.4),
                            blurRadius: 12,
                          )
                        ]
                      : []),
            ),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    widget.label,
                    maxLines: 1,
                    style: AppFonts.spaceGrotesk(
                      color: widget.isPrimary ? const Color(0xFF041018) : textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        ),
      ),
    );
  }
}
