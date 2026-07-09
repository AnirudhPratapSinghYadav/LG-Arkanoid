import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/ssh_service.dart';
import '../services/lg_service.dart';
import '../utils/constants.dart';
import '../widgets/lg_panel.dart';
import '../widgets/lg_button.dart';
import '../widgets/lg_text_field.dart';

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
        backgroundColor: bgColor,
        title: const Text(
          'LG Settings',
          style: TextStyle(
            fontFamily: 'VT323',
            fontSize: 24,
            color: accentCyan,
            letterSpacing: 1,
            height: 1.4,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LgPanel(
              accentColor: _sshConnected ? accentCyan : accentMagenta,
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _sshConnected ? accentCyan : accentMagenta,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _sshConnected ? 'CONNECTED TO RIG' : 'NOT CONNECTED',
                    style: TextStyle(
                      fontFamily: 'JetBrainsMono',
                      fontWeight: FontWeight.bold,
                      color: _sshConnected ? accentCyan : accentMagenta,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'SSH CONNECTION',
                    style: TextStyle(
                      fontFamily: 'VT323',
                      fontSize: 24,
                      color: accentCyan,
                      letterSpacing: 1,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  LgTextField(
                    controller: _hostController,
                    label: 'Master Node IP',
                  ),
                  const SizedBox(height: 16),
                  LgTextField(
                    controller: _portController,
                    label: 'SSH Port',
                  ),
                  const SizedBox(height: 16),
                  LgTextField(
                    controller: _usernameController,
                    label: 'Username',
                  ),
                  const SizedBox(height: 16),
                  LgTextField(
                    controller: _passwordController,
                    label: 'Password',
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  LgTextField(
                    controller: _screensController,
                    label: 'Number of Screens',
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: LgButton(
                          label: 'Save',
                          onPressed: _saveSettings,
                          accentColor: accentCyan,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _connecting
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
                                onPressed: _connectSSH,
                                accentColor: accentCyan,
                              ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: LgButton(
                          label: 'Disconnect',
                          onPressed: _sshConnected ? _disconnectSSH : null,
                          accentColor: accentMagenta,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'DEPLOY TO RIG',
                    style: TextStyle(
                      fontFamily: 'VT323',
                      fontSize: 24,
                      color: accentCyan,
                      letterSpacing: 1,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  LgTextField(
                    controller: _serverUrlController,
                    label: 'Game Server URL',
                  ),
                  const SizedBox(height: 24),
                  LgButton(
                    label: 'Deploy Game to Screens',
                    onPressed: _sshConnected ? _deployToRig : null,
                    accentColor: accentCyan,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: LgButton(
                          label: 'Reboot Rig',
                          onPressed: _sshConnected
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
                          accentColor: accentAmber,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: LgButton(
                          label: 'Close Browsers',
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
                          accentColor: accentCyan,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
