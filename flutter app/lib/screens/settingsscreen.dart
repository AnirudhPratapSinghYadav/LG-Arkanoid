import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/tts_service.dart';
import '../utils/constants.dart';
import '../widgets/lg_panel.dart';

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
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        title: const Text(
          'GAME SETTINGS',
          style: TextStyle(
            fontFamily: 'VT323',
            fontSize: 24,
            color: accentCyan,
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
                      fontFamily: 'JetBrainsMono',
                      fontWeight: FontWeight.bold,
                      color: accentCyan,
                      fontSize: 14,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: const Text(
                      'Enable TTS Voice',
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        color: textColor,
                        fontSize: 14,
                      ),
                    ),
                    value: tts.enabled,
                    onChanged: (bool value) {
                      tts.setEnabled(value);
                    },
                    activeColor: accentCyan,
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
