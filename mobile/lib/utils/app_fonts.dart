import 'dart:ui' show FontVariation;

import 'package:flutter/material.dart';

/// Typography for the controller, served entirely from bundled assets.
///
/// This replaces the `google_fonts` package on purpose. That package downloads
/// its .ttf files from fonts.gstatic.com the first time a style is used and
/// caches them; on a Liquid Galaxy rig the phone is joined to the wall's LAN,
/// which usually has no route to the internet, so every label would silently
/// fall back to the platform font mid-demo. Bundling also keeps the first frame
/// free of a font pop and adds well under a megabyte to the APK.
///
/// Inter and Space Grotesk ship upstream only as variable fonts, so the weight
/// has to be driven through the `wght` axis. Space Grotesk in particular
/// defaults to 300 (Light), which means simply asking for [FontWeight.w400]
/// without a variation would render noticeably thin.
class AppFonts {
  AppFonts._();

  static const String interFamily = 'Inter';
  static const String spaceGroteskFamily = 'SpaceGrotesk';
  static const String jetBrainsMonoFamily = 'JetBrainsMono';
  static const String vt323Family = 'VT323';
  static const String pressStart2PFamily = 'PressStart2P';

  /// Body and UI copy. Weight axis: 100-900.
  static TextStyle inter({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    FontStyle? fontStyle,
    TextDecoration? decoration,
    List<Shadow>? shadows,
  }) {
    return _variable(
      family: interFamily,
      minWeight: 100,
      maxWeight: 900,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      fontStyle: fontStyle,
      decoration: decoration,
      shadows: shadows,
    );
  }

  /// Headings and arcade chrome. Weight axis: 300-700.
  static TextStyle spaceGrotesk({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    FontStyle? fontStyle,
    TextDecoration? decoration,
    List<Shadow>? shadows,
  }) {
    return _variable(
      family: spaceGroteskFamily,
      minWeight: 300,
      maxWeight: 700,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      fontStyle: fontStyle,
      decoration: decoration,
      shadows: shadows,
    );
  }

  /// Codes, IPs and tokens — monospace matters for the join code.
  /// Bundled as static Regular + Bold faces.
  static TextStyle jetBrainsMono({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    FontStyle? fontStyle,
    TextDecoration? decoration,
    List<Shadow>? shadows,
  }) {
    return TextStyle(
      fontFamily: jetBrainsMonoFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      fontStyle: fontStyle,
      decoration: decoration,
      shadows: shadows,
    );
  }

  /// Retro terminal accents. Single weight only.
  static TextStyle vt323({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    FontStyle? fontStyle,
    TextDecoration? decoration,
    List<Shadow>? shadows,
  }) {
    return TextStyle(
      fontFamily: vt323Family,
      fontSize: fontSize,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      fontStyle: fontStyle,
      decoration: decoration,
      shadows: shadows,
    );
  }

  /// Arcade title face. Single weight only.
  static TextStyle pressStart2P({
    double? fontSize,
    Color? color,
    double? letterSpacing,
    double? height,
    List<Shadow>? shadows,
  }) {
    return TextStyle(
      fontFamily: pressStart2PFamily,
      fontSize: fontSize,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      shadows: shadows,
    );
  }

  static TextStyle _variable({
    required String family,
    required double minWeight,
    required double maxWeight,
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    FontStyle? fontStyle,
    TextDecoration? decoration,
    List<Shadow>? shadows,
  }) {
    final weight = fontWeight ?? FontWeight.w400;
    final axis = ((weight.index + 1) * 100.0).clamp(minWeight, maxWeight);
    return TextStyle(
      fontFamily: family,
      fontSize: fontSize,
      // fontWeight still matters for fallback fonts and for synthetic bolding
      // if the asset ever fails to load; fontVariations is what actually moves
      // the variable axis.
      fontWeight: weight,
      fontVariations: <FontVariation>[FontVariation('wght', axis)],
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      fontStyle: fontStyle,
      decoration: decoration,
      shadows: shadows,
    );
  }
}
