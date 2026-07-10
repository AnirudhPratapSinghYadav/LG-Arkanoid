import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
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
        title: const Text(
          'GAME SETTINGS',
          style: TextStyle(
            fontFamily: GoogleFonts.inter().fontFamily,
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
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'ROBOT COMMENTARY',
                    style: TextStyle(
                      fontFamily: GoogleFonts.inter().fontFamily,
                      fontWeight: FontWeight.bold,
                      color: accentPrimary,
                      fontSize: 14,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: const Text(
                      'Enable TTS Voice',
                      style: TextStyle(
                        fontFamily: GoogleFonts.inter().fontFamily,
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
          ],
        ),
      ),
    );
  }
}
