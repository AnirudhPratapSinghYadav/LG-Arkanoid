import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../utils/constants.dart';
import '../widgets/mission_background.dart';

class QrInviteScreen extends StatelessWidget {
  const QrInviteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final String payload = ModalRoute.of(context)!.settings.arguments as String;

    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: SafeArea(
          child: Column(
            children: [
              AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                title: Text(
                  'INVITE PLAYERS',
                  style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: accentPrimary,
                    letterSpacing: 2,
                  ),
                ),
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: textPrimary),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Scan this QR code from another device on the same Wi-Fi network to join the game.',
                          style: GoogleFonts.inter(
                            color: textSecondary,
                            fontSize: 14,
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 48),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: accentPrimary.withValues(alpha: 0.2),
                                blurRadius: 40,
                                spreadRadius: 5,
                              ),
                            ],
                          ),
                          child: QrImageView(
                            data: payload,
                            version: QrVersions.auto,
                            size: 240,
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black,
                            errorCorrectionLevel: QrErrorCorrectLevel.M,
                          ),
                        ),
                        const SizedBox(height: 48),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
