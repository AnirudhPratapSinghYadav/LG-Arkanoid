// Liquid Galaxy Rig Settings Screen

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/ttsservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final tts = context.watch<TTSService>();

    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: bgDark,
        title: Text(
          'SETTINGS',
          style: GoogleFonts.inter(
            fontSize: 24,
            color: accentPrimary,
            letterSpacing: 1,
            height: 1.4,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // -- TTS toggle panel ---------------------------------------------
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ROBOT COMMENTARY',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: accentPrimary,
                      fontSize: 14,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: Text(
                      'Enable TTS Voice',
                      style: GoogleFonts.inter(
                        color: textPrimary,
                        fontSize: 14,
                      ),
                    ),
                    value: !tts.isMuted,
                    onChanged: (bool value) {
                      if (tts.isMuted == value) {
                        tts.toggleMute();
                      }
                    },
                    activeColor: accentPrimary,
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // -- About section ------------------------------------------------
            Center(
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset('assets/app_icon_transparent.png', width: 28, height: 28),
                      const SizedBox(width: 10),
                      Image.asset('assets/lg-logo.png', height: 24),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'LG Arkanoid',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Where AI meets Arkanoid',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: accentPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Built by Anirudh Pratap Singh Yadav for Liquid Galaxy\npowered by GeminiSOC 2026',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: textSecondary,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
