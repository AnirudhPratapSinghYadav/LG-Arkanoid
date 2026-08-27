import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class LgButton extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final isDisabled = disabled || onPressed == null;

    return Opacity(
      opacity: isDisabled ? 0.4 : 1.0,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isDisabled
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  onPressed?.call();
                },
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            height: 56,
            decoration: BoxDecoration(
              gradient: isPrimary
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
              color: isPrimary ? null : Colors.transparent,
              border: Border.all(
                color: isPrimary ? const Color(0xFF20C5FF) : Colors.white.withOpacity(0.12),
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: isPrimary && !isDisabled
                  ? [
                      BoxShadow(
                        color: accentSystem.withOpacity(0.28),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      )
                    ]
                  : null,
            ),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    maxLines: 1,
                    style: AppFonts.spaceGrotesk(
                      color: isPrimary ? const Color(0xFF041018) : textPrimary,
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
    );
  }
}
