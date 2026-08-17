import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/mission_background.dart';

import '../services/ssh_service.dart';
import '../widgets/dual_brand.dart';

class JoinChoiceScreen extends StatefulWidget {
  const JoinChoiceScreen({super.key});

  @override
  State<JoinChoiceScreen> createState() => _JoinChoiceScreenState();
}

class _JoinChoiceScreenState extends State<JoinChoiceScreen> {
  @override
  Widget build(BuildContext context) {
    final bool isRigConnected = SSHService().isConnected;

    return Scaffold(
      backgroundColor: bgDark,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: textSecondary, size: 24),
            tooltip: 'Settings',
            onPressed: () async {
              await Navigator.pushNamed(context, '/settings');
              if (mounted) setState(() {});
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
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
                        const DualBrand(height: 36),
                        const SizedBox(height: 16),
                        Text(
                          'LG ARKANOID',
                          style: AppFonts.spaceGrotesk(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2.0,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Phone controller for Liquid Galaxy',
                          style: AppFonts.inter(
                            fontSize: 12,
                            color: textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),
                    _buildChoiceCard(
                      context: context,
                      title: isRigConnected ? 'RIG CONNECTED' : 'RIG CONNECTION',
                      description: isRigConnected 
                          ? 'Manage connection or launch game' 
                          : 'Configure, connect, or launch on Liquid Galaxy',
                      icon: Icons.monitor,
                      onTap: () async {
                        await Navigator.pushNamed(context, '/settings');
                        if (mounted) setState(() {});
                      },
                    ),
                    const SizedBox(height: 24),
                    _buildChoiceCard(
                      context: context,
                      title: 'SCAN QR CODE',
                      description: 'Same Wi-Fi as the Liquid Galaxy master',
                      icon: Icons.qr_code_scanner_rounded,
                      onTap: () async {
                        final result = await Navigator.pushNamed(context, '/qrscan', arguments: 'session');
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
                      title: 'ENTER MANUALLY',
                      description: 'Type master IP, port, and session code',
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
      borderRadius: BorderRadius.circular(14),
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
                size: 28,
              ),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppFonts.spaceGrotesk(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppFonts.inter(
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
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
