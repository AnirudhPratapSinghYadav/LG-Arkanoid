import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
    _loadSavedSettings();
  }

  Future<void> _loadSavedSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _hostController.text = prefs.getString(prefHost) ?? '';
      _portController.text = prefs.getString(prefPort) ?? '22';
      _usernameController.text = prefs.getString(prefUsername) ?? 'lg';
      _passwordController.text = prefs.getString(prefPassword) ?? '';
      _screensController.text =
          prefs.getInt(prefNumScreens)?.toString() ?? '5';
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefHost, _hostController.text.trim());
    await prefs.setString(prefPort, _portController.text.trim());
    await prefs.setString(prefUsername, _usernameController.text.trim());
    await prefs.setString(prefPassword, _passwordController.text.trim());
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
          content: Text(result ? 'Connected to LG rig' : 'Connection failed'),
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

  Future<void> _rebootRig() async {
    if (!_sshConnected) return;
    await LGService().rebootRig();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reboot command sent')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
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
                  _sshConnected ? 'SSH Connected' : 'SSH Off',
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
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'SSH Connection',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            _buildField(_hostController, 'Master Node IP', Icons.computer),
            const SizedBox(height: 12),
            _buildField(_portController, 'SSH Port', Icons.settings_ethernet),
            const SizedBox(height: 12),
            _buildField(_usernameController, 'Username', Icons.person),
            const SizedBox(height: 12),
            _buildField(_passwordController, 'Password', Icons.lock,
                obscure: true),
            const SizedBox(height: 12),
            _buildField(
                _screensController, 'Number of Screens', Icons.monitor),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _connecting ? null : _saveSettings,
                    child: const Text('Save',
                        style: TextStyle(color: Colors.white)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal.shade700,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _connecting ? null : _connectSSH,
                    child: _connecting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Connect',
                            style: TextStyle(color: Colors.white)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade800,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _sshConnected ? _disconnectSSH : null,
                    child: const Text('Disconnect',
                        style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              'Deploy to Rig',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            _buildField(
              _serverUrlController,
              'Game Server URL (e.g. https://192.168.1.10:8080)',
              Icons.link,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.teal.shade600,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _sshConnected ? _deployToRig : null,
              child: const Text('Deploy Game to Screens',
                  style: TextStyle(color: Colors.white)),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange.shade800,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _sshConnected ? _rebootRig : null,
                    child: const Text('Reboot Rig',
                        style: TextStyle(color: Colors.white)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.grey.shade800,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _sshConnected
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
                    child: const Text('Close Browsers',
                        style: TextStyle(color: Colors.white)),
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
    String label,
    IconData icon, {
    bool obscure = false,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.5)),
        filled: true,
        fillColor: Colors.black.withOpacity(0.3),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.teal.withOpacity(0.5)),
        ),
      ),
    );
  }
}
