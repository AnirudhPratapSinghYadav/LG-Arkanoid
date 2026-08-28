import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import 'dual_brand.dart';

class SettingsAboutFooter extends StatelessWidget {
  const SettingsAboutFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/app_icon_transparent.webp', width: 28, height: 28),
              const SizedBox(width: 12),
              const DualBrand(height: 24),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'AI Arkanoid LG',
            style: AppFonts.spaceGrotesk(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Phone paddle for Liquid Galaxy — not the wall',
            style: AppFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: accentSystem,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Built by Anirudh Pratap Singh Yadav for Liquid Galaxy\nGESOC 2026',
            style: AppFonts.inter(
              fontSize: 11,
              color: textSecondary,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
