import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/game_service.dart';
import '../utils/constants.dart';

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
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'LG Arkanoid',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Connect to Game Server',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white54,
                ),
              ),
              const SizedBox(height: 40),
              _buildField(_ipController, 'Server IP'),
              const SizedBox(height: 12),
              _buildField(_portController, 'Port'),
              const SizedBox(height: 12),
              _buildField(_tokenController, 'Session Token (6 digits)',
                  maxLength: 6),
              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: _connecting ? null : _connect,
                  child: _connecting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Connect', style: TextStyle(fontSize: 16)),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, '/settings'),
                    child: const Text(
                      'LG Settings',
                      style: TextStyle(color: Colors.tealAccent),
                    ),
                  ),
                  const SizedBox(width: 16),
                  TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, '/status'),
                    child: const Text(
                      'Debug',
                      style: TextStyle(color: Colors.white54),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(
    TextEditingController controller,
    String label, {
    int? maxLength,
  }) {
    return TextField(
      controller: controller,
      maxLength: maxLength,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white54),
        counterText: '',
        filled: true,
        fillColor: const Color(0xFF1A1A2E),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Colors.teal),
        ),
      ),
    );
  }
}
