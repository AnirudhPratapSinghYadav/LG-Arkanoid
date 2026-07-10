import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/gameservice.dart';
import '../services/lg_service.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';
import '../widgets/lg_bot.dart';
import 'qrscanscreen.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _ipController = TextEditingController(text: '192.168.');
  final _portController = TextEditingController(text: '8080');
  final _sshUserController = TextEditingController(text: 'lg');
  final _sshPassController = TextEditingController(text: 'lg');
  final _tokenController = TextEditingController();
  final _nameController = TextEditingController();
  
  bool _connecting = false;
  bool _launching = false;

  void _scanQr() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(builder: (context) => const QrScanScreen()),
    );
    if (result != null && result is String) {
      final parts = result.split('|');
      if (parts.length >= 4 && parts[0] == 'LGARK') {
        setState(() {
          _ipController.text = parts[1];
          _portController.text = parts[2];
          _tokenController.text = parts[3];
        });
        // Auto connect after successful scan
        _connect();
      }
    }
  }

  Future<void> _connect() async {
    final address = _ipController.text.trim();
    final port = _portController.text.trim();
    final token = _tokenController.text.trim().toUpperCase();
    final name = _nameController.text.trim();

    if (address.isEmpty || port.isEmpty || token.length != 4 || name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter IP, port, token, and a name')),
      );
      return;
    }

    setState(() => _connecting = true);

    final service = context.read<GameService>();
    final ok = await service.connect(address, port);

    if (!mounted) return;
    setState(() => _connecting = false);

    if (ok) {
      const storage = FlutterSecureStorage();
      await storage.write(key: prefServerAddress, value: address);
      await storage.write(key: prefServerPort, value: port);
      await storage.write(key: prefSessionToken, value: token);
      service.joinGame(token, name);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/controller');
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection failed')),
      );
    }
  }

  Future<void> _launchRig() async {
    final address = _ipController.text.trim();
    final user = _sshUserController.text.trim();
    final pass = _sshPassController.text.trim();

    if (address.isEmpty || user.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter IP, SSH User, and Password')),
      );
      return;
    }

    setState(() => _launching = true);

    final lgService = context.read<LgService>();
    final connected = await lgService.connect(address, user, pass);

    if (!mounted) return;
    setState(() => _launching = false);

    if (connected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SSH Connected! Launching Rig...')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SSH Connection Failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: SafeArea(
          child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 450),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset('assets/app_icon_transparent.png', width: 32, height: 32),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('LIQUID GALAXY', style: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.bold, color: textPrimary, letterSpacing: 1.2)),
                          Text('Controller', style: GoogleFonts.inter(fontSize: 12, color: textSecondary, letterSpacing: 2)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  
                  // Rig Status Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: cardFill,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: borderLight),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('LG Rig Status', style: GoogleFonts.inter(fontSize: 12, color: textSecondary)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Container(
                              width: 8, height: 8,
                              decoration: const BoxDecoration(shape: BoxShape.circle, color: accentWarning),
                            ),
                            const SizedBox(width: 8),
                            Text('Waiting for Connection...', style: GoogleFonts.inter(fontSize: 15, color: textPrimary, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const Divider(color: borderLight),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Last seen', style: GoogleFonts.inter(fontSize: 12, color: textSecondary)),
                            Text('Never', style: GoogleFonts.jetbrainsMono(fontSize: 12, color: textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Actions Panel
                  LgPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        LgButton(
                          label: 'SCAN QR TO PAIR',
                          onPressed: _scanQr,
                          isPrimary: true,
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            const Expanded(child: Divider(color: borderLight)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text('OR MANUAL ENTRY', style: GoogleFonts.inter(fontSize: 10, color: textSecondary, letterSpacing: 1)),
                            ),
                            const Expanded(child: Divider(color: borderLight)),
                          ],
                        ),
                        const SizedBox(height: 24),
                        LgTextField(
                          controller: _nameController,
                          label: 'Player Name',
                          maxLength: 12,
                        ),
                        const SizedBox(height: 16),
                        LgTextField(
                          controller: _tokenController,
                          label: 'Session Code',
                          maxLength: 4,
                        ),
                        const SizedBox(height: 24),
                        _connecting 
                          ? const Center(child: CircularProgressIndicator(color: accentPrimary))
                          : LgButton(
                              label: 'JOIN SESSION',
                              onPressed: _connect,
                              isPrimary: false,
                            ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Connection Settings (Advanced)
                  Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      title: Text('Connection Settings', style: GoogleFonts.inter(fontSize: 14, color: textSecondary)),
                      children: [
                        LgTextField(controller: _ipController, label: 'Server IP'),
                        const SizedBox(height: 12),
                        LgTextField(controller: _portController, label: 'Port'),
                        const SizedBox(height: 12),
                        LgTextField(controller: _sshUserController, label: 'SSH Username'),
                        const SizedBox(height: 12),
                        LgTextField(controller: _sshPassController, label: 'SSH Password', obscureText: true),
                        const SizedBox(height: 16),
                        _launching
                          ? const Center(child: CircularProgressIndicator(color: accentPrimary))
                          : LgButton(label: 'Launch Rig Scripts (SSH)', onPressed: _launchRig, isPrimary: false),
                      ],
                    ),
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
}
