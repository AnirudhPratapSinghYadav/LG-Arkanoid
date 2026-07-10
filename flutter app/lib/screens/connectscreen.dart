import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../services/lg_service.dart';
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
      // Example script execution:
      // await lgService.execute('bash /home/lg/launch_arkanoid.sh');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SSH Connection Failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, color: accentCyan),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: panelFill,
                  shape: RoundedRectangleBorder(
                    side: const BorderSide(color: accentCyan, width: 2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  title: const Text('ABOUT', style: TextStyle(color: accentCyan, fontFamily: 'PressStart2P', fontSize: 14)),
                  content: const Text(
                    'LG Arkanoid\n\nDeveloped by Anirudh Pratap Singh Yadav\nPowered by Gemini & Liquid Galaxy',
                    style: TextStyle(color: textColor, fontFamily: 'JetBrainsMono'),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('CLOSE', style: TextStyle(color: accentMagenta, fontFamily: 'JetBrainsMono', fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 450),
              child: LgPanel(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),
                    Center(
                      child: Image.asset('assets/app_icon.png', width: 64, height: 64),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'LG ARKANOID',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'VT323',
                        fontSize: 40,
                        color: accentCyan,
                        letterSpacing: 1,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                  'JOIN GAME',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'JetBrainsMono',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 40),
                LgTextField(
                  controller: _nameController,
                  label: 'Player Name',
                  maxLength: 12,
                ),
                const SizedBox(height: 16),
                LgTextField(
                  controller: _tokenController,
                  label: 'Session Token (4 letters)',
                  maxLength: 4,
                ),
                const SizedBox(height: 16),
                Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    title: const Text(
                      'Advanced Server Settings',
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        fontSize: 12,
                        color: textColor,
                      ),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: LgTextField(
                          controller: _ipController,
                          label: 'Server IP',
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: LgTextField(
                          controller: _portController,
                          label: 'Port',
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: LgTextField(
                          controller: _sshUserController,
                          label: 'SSH Username',
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: LgTextField(
                          controller: _sshPassController,
                          label: 'SSH Password',
                        ),
                      ),
                      const SizedBox(height: 8),
                      _launching
                          ? const Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2, color: accentMagenta),
                              ),
                            )
                          : LgButton(
                              label: 'Launch on Rig (SSH)',
                              onPressed: _launchRig,
                              accentColor: accentMagenta,
                            ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                _connecting
                    ? const Center(
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: accentCyan,
                          ),
                        ),
                      )
                  : Row(
                      children: [
                        Expanded(
                          child: LgButton(
                            label: 'Scan QR',
                            onPressed: _scanQr,
                            accentColor: accentAmber,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: LgButton(
                            label: 'Join Game',
                            onPressed: _connect,
                            accentColor: accentCyan,
                          ),
                        ),
                      ],
                    ),
              const SizedBox(height: 16),
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
