import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';

class ManualEntryScreen extends StatefulWidget {
  const ManualEntryScreen({super.key});

  @override
  State<ManualEntryScreen> createState() => _ManualEntryScreenState();
}

class _ManualEntryScreenState extends State<ManualEntryScreen> {
  final _tokenController = TextEditingController();
  final _ipController = TextEditingController();
  final _portController = TextEditingController(text: '3000');
  
  bool _developerMode = false;
  int _developerTaps = 0;
  final _storage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadSavedSettings();
  }

  Future<void> _loadSavedSettings() async {
    final savedIp = await _storage.read(key: prefServerAddress);
    final savedPort = await _storage.read(key: prefServerPort);
    final savedToken = await _storage.read(key: prefSessionToken);
    
    if (mounted) {
      setState(() {
        if (savedIp != null && savedIp.isNotEmpty) _ipController.text = savedIp;
        if (savedPort != null && savedPort.isNotEmpty) _portController.text = savedPort;
        if (savedToken != null && savedToken.isNotEmpty) _tokenController.text = savedToken;
      });
    }
  }

  void _onTitleTap() {
    // Developer mode logic removed, IP/Port inputs always visible.
  }


  void _onContinue() {
    final token = _tokenController.text.trim().toUpperCase();
    final ip = _ipController.text.trim();
    final port = _portController.text.trim();

    if (token.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session Code must be exactly 4 characters')),
      );
      return;
    }

    if (ip.isEmpty || port.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('IP Address and Port cannot be empty')),
      );
      return;
    }

    Navigator.pushNamed(
      context,
      '/nameentry',
      arguments: {
        'ip': ip,
        'port': port,
        'token': token,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: textSecondary),
      ),
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    GestureDetector(
                      onTap: _onTitleTap,
                      child: Text(
                        'ENTER SESSION CODE',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: textPrimary,
                          letterSpacing: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Enter the 4-letter token displayed on the Liquid Galaxy rig',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 36),
                    LgPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LgTextField(
                            controller: _tokenController,
                            label: 'SESSION CODE',
                            maxLength: 4,
                            keyboardType: TextInputType.text,
                          ),
                          
                          const SizedBox(height: 24),
                          const Divider(color: borderLight),
                          const SizedBox(height: 16),
                          Text(
                            'SERVER CONNECTION INFO',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: accentWarning,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Using USB debugging? Run "adb reverse tcp:3000 tcp:3000" and use IP 127.0.0.1',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: textSecondary,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 16),
                          LgTextField(
                            controller: _ipController,
                            label: 'RIG HOST IP ADDRESS',
                            hint: 'e.g. 192.168.1.42 or 127.0.0.1',
                            keyboardType: TextInputType.datetime,
                          ),
                          const SizedBox(height: 16),
                          LgTextField(
                            controller: _portController,
                            label: 'RIG SERVER PORT',
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 48),
                    LgButton(
                      label: 'CONTINUE',
                      onPressed: _onContinue,
                      isPrimary: true,
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
