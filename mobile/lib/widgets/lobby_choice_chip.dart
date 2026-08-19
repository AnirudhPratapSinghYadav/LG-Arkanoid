import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';

class LobbyChoiceChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final EdgeInsetsGeometry padding;

  const LobbyChoiceChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: padding,
        decoration: BoxDecoration(
          color: selected ? accentSystem.withOpacity(0.15) : cardFill,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? accentSystem : borderLight,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: AppFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: selected ? FontWeight.bold : FontWeight.w600,
            color: selected ? accentSystem : textSecondary,
          ),
        ),
      ),
    );
  }
}
