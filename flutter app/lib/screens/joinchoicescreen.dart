import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/mission_background.dart';

class JoinChoiceScreen extends StatelessWidget {
  const JoinChoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Column(
                      children: [
                        Image.asset('assets/lg-logo.png', height: 40),
                        const SizedBox(height: 12),
                        Text(
                          'LG ARKANOID',
                          style: GoogleFonts.vt323(
                            fontSize: 32,
                            color: accentPrimary,
                            letterSpacing: 2.0,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          'MULTIPLAYER PANEL',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: textSecondary,
                            letterSpacing: 3.0,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),
                    _buildChoiceCard(
                      context: context,
                      title: 'SCAN QR',
                      description: 'Scan Liquid Galaxy QR Code',
                      icon: Icons.qr_code_scanner_rounded,
                      onTap: () async {
                        final result = await Navigator.pushNamed(context, '/qrscan');
                        if (result != null && result is String) {
                          final parts = result.split('|');
                          if (parts.length >= 4) {
                            if (context.mounted) {
                              Navigator.pushNamed(
                                context,
                                '/nameentry',
                                arguments: {
                                  'ip': parts[1],
                                  'port': parts[2],
                                  'token': parts[3],
                                },
                              );
                            }
                          }
                        }
                      },
                    ),
                    const SizedBox(height: 24),
                    _buildChoiceCard(
                      context: context,
                      title: 'ENTER CODE',
                      description: 'Manually configure connection',
                      icon: Icons.keyboard_rounded,
                      onTap: () {
                        Navigator.pushNamed(context, '/manualentry');
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildChoiceCard({
    required BuildContext context,
    required String title,
    required String description,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: LgPanel(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: borderLight, width: 1),
              ),
              child: Icon(
                icon,
                color: accentPrimary,
                size: 32,
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
