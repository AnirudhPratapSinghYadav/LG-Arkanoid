import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
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
                title: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    'INVITE PLAYERS',
                    style: AppFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: accentPrimary,
                      letterSpacing: 1,
                    ),
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
                          'Scan this QR from another phone on the same Wi-Fi / LAN as lg1. Cellular or guest Wi-Fi will not connect.',
                          style: AppFonts.inter(
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
                                color: accentPrimary.withOpacity(0.2),
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
                            eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.black),
                            dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black),
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
