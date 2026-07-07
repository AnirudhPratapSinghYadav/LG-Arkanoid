import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/ssh_service.dart';
import '../services/lg_service.dart';
import '../utils/constants.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '22');
  final _usernameController = TextEditingController(text: 'lg');
  final _passwordController = TextEditingController();
  final _screensController = TextEditingController(text: '5');
  final _serverUrlController = TextEditingController();

  bool _sshConnected = false;
  bool _connecting = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    const secure = FlutterSecureStorage();
    final savedPassword = await secure.read(key: prefPassword);

    setState(() {
      _hostController.text = prefs.getString(prefHost) ?? '';
      _portController.text = prefs.getString(prefPort) ?? '22';
      _usernameController.text = prefs.getString(prefUsername) ?? 'lg';
      _passwordController.text = savedPassword ?? '';
      _screensController.text =
          prefs.getInt(prefNumScreens)?.toString() ?? '5';
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    const secure = FlutterSecureStorage();

    await prefs.setString(prefHost, _hostController.text.trim());
    await prefs.setString(prefPort, _portController.text.trim());
    await prefs.setString(prefUsername, _usernameController.text.trim());
    await secure.write(
        key: prefPassword, value: _passwordController.text.trim());
    await prefs.setInt(
      prefNumScreens,
      int.tryParse(_screensController.text.trim()) ?? 5,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved')),
      );
    }
  }

  Future<void> _connectSSH() async {
    final host = _hostController.text.trim();
    final port = int.tryParse(_portController.text.trim()) ?? 22;
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (host.isEmpty || username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fill in all fields')),
      );
      return;
    }

    setState(() => _connecting = true);

    SSHService().init(
      host: host,
      port: port,
      username: username,
      password: password,
    );

    bool result = await SSHService().connect();

    if (mounted) {
      setState(() {
        _sshConnected = result;
        _connecting = false;
      });

      int screens = int.tryParse(_screensController.text.trim()) ?? 5;
      LGService().setNumScreens(screens);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(result ? 'Connected to LG rig' : 'Connection failed'),
        ),
      );
    }
  }

  Future<void> _disconnectSSH() async {
    await SSHService().disconnect();
    if (mounted) {
      setState(() => _sshConnected = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Disconnected')),
      );
    }
  }

  Future<void> _deployToRig() async {
    final serverUrl = _serverUrlController.text.trim();
    if (serverUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter game server URL')),
      );
      return;
    }

    if (!_sshConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connect to SSH first')),
      );
      return;
    }

    await LGService().deployGame(serverUrl);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deployed to rig')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A1A),
        title: const Text('LG Settings'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _sshConnected ? Colors.green : Colors.red,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _sshConnected ? 'Connected' : 'Not Connected',
                  style: TextStyle(
                    color: _sshConnected ? Colors.green : Colors.red,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'SSH Connection',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            _buildField(_hostController, 'Master Node IP'),
            const SizedBox(height: 10),
            _buildField(_portController, 'SSH Port'),
            const SizedBox(height: 10),
            _buildField(_usernameController, 'Username'),
            const SizedBox(height: 10),
            _buildField(_passwordController, 'Password', obscure: true),
            const SizedBox(height: 10),
            _buildField(_screensController, 'Number of Screens'),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildButton('Save', Colors.teal, _saveSettings),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _connecting
                      ? const Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.teal,
                            ),
                          ),
                        )
                      : _buildButton(
                          'Connect', Colors.teal.shade700, _connectSSH),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildButton(
                    'Disconnect',
                    Colors.red.shade800,
                    _sshConnected ? _disconnectSSH : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              'Deploy to Rig',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            _buildField(_serverUrlController, 'Game Server URL'),
            const SizedBox(height: 16),
            _buildButton(
              'Deploy Game to Screens',
              Colors.teal.shade600,
              _sshConnected ? _deployToRig : null,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildButton(
                    'Reboot Rig',
                    Colors.orange.shade800,
                    _sshConnected
                        ? () async {
                            await LGService().rebootRig();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Reboot sent')),
                              );
                            }
                          }
                        : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildButton(
                    'Close Browsers',
                    Colors.grey.shade800,
                    _sshConnected
                        ? () async {
                            await LGService().closeBrowsers();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Browsers closed')),
                              );
                            }
                          }
                        : null,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(
    TextEditingController controller,
    String label, {
    bool obscure = false,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white54),
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

  Widget _buildButton(
      String text, Color color, VoidCallback? onPressed) {
    return SizedBox(
      height: 44,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        onPressed: onPressed,
        child: Text(text, style: const TextStyle(fontSize: 13)),
      ),
    );
  }
}
