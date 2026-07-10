import 'package:google_fonts/google_fonts.dart';
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
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, color: accentPrimary),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: cardFill,
                  shape: RoundedRectangleBorder(
                    side: const BorderSide(color: accentPrimary, width: 2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  title: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Image.asset('assets/app_icon_transparent.png', width: 40, height: 40),
                          const SizedBox(width: 16),
                          Image.asset('assets/lg-logo.png', height: 40, color: Colors.white),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text('ABOUT US', style: TextStyle(color: accentPrimary, fontFamily: GoogleFonts.spaceGrotesk().fontFamily, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      const Divider(color: accentPrimary, thickness: 1),
                    ],
                  ),
                  content: const Text(
                    'Author -> Anirudh Pratap Singh Yadav\n\nAbout Game -> LG Arkanoid brings classic brick-breaking action to the Liquid Galaxy!\n\nA Gemini Summer of Code Project.\n\nPowered by: Gemini & Liquid Galaxy',
                    style: TextStyle(color: textPrimary, fontFamily: GoogleFonts.inter().fontFamily, fontSize: 12, height: 1.5),
                    textAlign: TextAlign.center,
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('CLOSE', style: TextStyle(color: accentError, fontFamily: GoogleFonts.inter().fontFamily, fontWeight: FontWeight.bold)),
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
                      child: Image.asset('assets/app_icon_transparent.png', width: 64, height: 64),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'LG ARKANOID',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: GoogleFonts.inter().fontFamily,
                        fontSize: 40,
                        color: accentPrimary,
                        letterSpacing: 1,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                  'JOIN GAME',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: GoogleFonts.inter().fontFamily,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: textPrimary,
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
                        fontFamily: GoogleFonts.inter().fontFamily,
                        fontSize: 12,
                        color: textPrimary,
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
                                child: CircularProgressIndicator(strokeWidth: 2, color: accentError),
                              ),
                            )
                          : LgButton(
                              label: 'Launch on Rig (SSH)',
                              onPressed: _launchRig,
                              
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
                            color: accentPrimary,
                          ),
                        ),
                      )
                  : Row(
                      children: [
                        Expanded(
                          child: LgButton(
                            label: 'Scan QR',
                            onPressed: _scanQr,
                            
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: LgButton(
                            label: 'Join Game',
                            onPressed: _connect,
                            
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
