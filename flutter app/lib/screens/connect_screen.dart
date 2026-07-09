import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/game_service.dart';
import '../utils/constants.dart';
import '../widgets/lg_panel.dart';
import '../widgets/lg_button.dart';
import '../widgets/lg_text_field.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _ipController = TextEditingController(text: '192.168.');
  final _portController = TextEditingController(text: '8080');
  final _tokenController = TextEditingController();
  bool _connecting = false;

  Future<void> _connect() async {
    final address = _ipController.text.trim();
    final port = _portController.text.trim();
    final token = _tokenController.text.trim();

    if (address.isEmpty || port.isEmpty || token.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter IP, port, and 6 digit token')),
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
      service.joinGame(token);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/controller');
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: LgPanel(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                const Text(
                  'LG ARKANOID',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'PressStart2P',
                    fontSize: 20,
                    color: accentCyan,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Connect to Game Server',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'JetBrainsMono',
                    fontSize: 12,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 40),
                LgTextField(
                  controller: _ipController,
                  label: 'Server IP',
                ),
                const SizedBox(height: 16),
                LgTextField(
                  controller: _portController,
                  label: 'Port',
                ),
                const SizedBox(height: 16),
                LgTextField(
                  controller: _tokenController,
                  label: 'Session Token (6 digits)',
                  maxLength: 6,
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
                    : LgButton(
                        label: 'Connect',
                        onPressed: _connect,
                        accentColor: accentCyan,
                      ),
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Expanded(
                      child: LgButton(
                        label: 'LG Settings',
                        onPressed: () => Navigator.pushNamed(context, '/settings'),
                        accentColor: accentCyan,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: LgButton(
                        label: 'Debug',
                        onPressed: () => Navigator.pushNamed(context, '/status'),
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
    );
  }


}
