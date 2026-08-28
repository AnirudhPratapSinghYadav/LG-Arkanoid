import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';
import '../utils/join_target.dart';

class ManualEntryScreen extends StatefulWidget {
  const ManualEntryScreen({super.key});

  @override
  State<ManualEntryScreen> createState() => _ManualEntryScreenState();
}

class _ManualEntryScreenState extends State<ManualEntryScreen> {
  final _tokenController = TextEditingController();
  final _ipController = TextEditingController();
  final _portController = TextEditingController(text: defaultServerPort);
  final _storage = const FlutterSecureStorage();

  @override
  void dispose() {
    _tokenController.dispose();
    _ipController.dispose();
    _portController.dispose();
    super.dispose();
  }

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

  void _onContinue() {
    var token = _tokenController.text.trim().toUpperCase();
    var ip = _ipController.text.trim();
    var port = _portController.text.trim();

    // Pacman testers paste http://masterIp:8130/controller — that used to be
    // treated as a hostname and the socket never connected.
    final parsedField = parseJoinInput(ip.isEmpty ? token : ip, defaultPort: port.isEmpty ? defaultServerPort : port);
    if (parsedField != null) {
      ip = parsedField.ip;
      if (parsedField.port.isNotEmpty) port = parsedField.port;
      if (parsedField.token.length == 4) token = parsedField.token;
    }
    final parsedToken = parseJoinInput(token, defaultPort: port.isEmpty ? defaultServerPort : port);
    if (parsedToken != null && parsedToken.token.length == 4) {
      token = parsedToken.token;
      if (ip.isEmpty) ip = parsedToken.ip;
      if (port.isEmpty) port = parsedToken.port;
    }

    if (token.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session Code must be exactly 4 characters (or paste the wall URL)')),
      );
      return;
    }

    if (ip.isEmpty || port.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('IP Address and Port cannot be empty')),
      );
      return;
    }

    final host = parseJoinInput(ip, defaultPort: port);
    if (host?.warning != null || parsedField?.warning != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(host?.warning ?? parsedField!.warning!)),
      );
      return;
    }
    if (host?.hint != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(host!.hint!)),
      );
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
                    Text(
                      'ENTER SESSION CODE',
                      style: AppFonts.spaceGrotesk(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                        letterSpacing: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Paste the URL under the wall QR (http://IPv4:8130/controller?c=CODE), or type the 4-letter code plus the master IPv4. Same Wi-Fi as lg1 — not lg1, localhost, or cellular.',
                      style: AppFonts.inter(
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
                            autocorrect: false,
                            enableSuggestions: false,
                            textCapitalization: TextCapitalization.characters,
                          ),
                          
                          const SizedBox(height: 24),
                          const Divider(color: borderLight),
                          const SizedBox(height: 16),
                          Text(
                            'SERVER CONNECTION INFO',
                            style: AppFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: accentWarning,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Using USB debugging? Run "adb reverse tcp:8130 tcp:8130" and use IP 127.0.0.1. Android emulator join uses 10.0.2.2:8130 (host loopback). SSH/launch to a real rig still needs lg1 Wi‑Fi IPv4.',
                            style: AppFonts.inter(
                              fontSize: 11,
                              color: textSecondary,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 16),
                          LgTextField(
                            controller: _ipController,
                            label: 'RIG HOST IP ADDRESS',
                            hint: '10.11.77.106 or 10.0.2.2 (emulator join only)',
                            keyboardType: TextInputType.text,
                            autocorrect: false,
                            enableSuggestions: false,
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
