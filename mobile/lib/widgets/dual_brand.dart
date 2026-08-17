import 'package:flutter/material.dart';

/// Official Liquid Galaxy + Gemini Summer of Code marks, bundled so the
/// controller still brands correctly on a rig LAN with no internet.
///
/// Both files are the artwork published on liquidgalaxy.eu (the office site):
/// the five-screen LG mark and the GESOC 2026 mark from the Gemini Summer of
/// Code announcement post.
class DualBrand extends StatelessWidget {
  const DualBrand({
    super.key,
    this.height = 32,
    this.spacing = 16,
  });

  final double height;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/lg-logo.webp',
          height: height,
          filterQuality: FilterQuality.medium,
          semanticLabel: 'Liquid Galaxy',
        ),
        SizedBox(width: spacing),
        Image.asset(
          'assets/gesoc-logo.webp',
          height: height,
          filterQuality: FilterQuality.medium,
          semanticLabel: 'Gemini Summer of Code',
        ),
      ],
    );
  }
}
