import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../services/ttsservice.dart';
import '../services/ssh_service.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/connectionstatus.dart';
import '../widgets/settings_labeled_field.dart';
import '../widgets/settings_about_footer.dart';
import '../utils/settings_validators.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();

  final _usernameController = TextEditingController(text: defaultSshUsername);
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '$defaultSshPort');
  final _passwordController = TextEditingController();
  final _screensController = TextEditingController(text: '3');

  bool _obscurePassword = true;
  bool _isConnecting = false;
  bool _isConnected = false;
  bool _isBusy = false;

  final _secureStorage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadSavedValues();
    _checkInitialConnectionState();
  }

  Future<void> _checkInitialConnectionState() async {
    setState(() {
      _isConnected = SSHService().isConnected;
    });
  }

  Future<void> _loadSavedValues() async {
    final prefs = await SharedPreferences.getInstance();

    _usernameController.text = prefs.getString(prefUsername) ?? defaultSshUsername;
    _hostController.text = prefs.getString(prefHost) ?? '';
    _portController.text = prefs.getString(prefPort) ?? '$defaultSshPort';
    
    final savedPassword = await _secureStorage.read(key: prefPassword);
    _passwordController.text = savedPassword ?? '';

    final savedScreens = prefs.getInt(prefNumScreens);
    if (savedScreens != null) {
      _screensController.text = savedScreens.toString();
    }

    if (mounted) setState(() {});
  }

  Future<void> _saveValues() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(prefUsername, _usernameController.text.trim());
    await prefs.setString(prefHost, _hostController.text.trim());
    await prefs.setString(prefPort, _portController.text.trim());
    
    final screens = int.tryParse(_screensController.text.trim()) ?? 3;
    await prefs.setInt(prefNumScreens, screens);

    await _secureStorage.write(
      key: prefPassword,
      value: _passwordController.text,
    );
  }

  Future<void> _connectToRig() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isConnecting = true);
    
    await _saveValues();
    
    bool connected = false;
    int retries = 0;
    
    while (!connected && retries < 5) {
      final err = await SSHService().connect();
      connected = err == null;
      if (!connected) {
        retries++;
        if (retries < 5) {
          await Future.delayed(const Duration(seconds: 2));
        }
      }
    }
    
    // The rig knows its own width, so stop making the operator guess it.
    int? detectedScreens;
    if (connected) {
      detectedScreens = await SSHService().detectScreenCount();
    }

    if (!mounted) return;
    setState(() { 
      _isConnecting = false; 
      _isConnected = connected; 
      if (detectedScreens != null) {
        _screensController.text = detectedScreens.toString();
      }
    });

    if (detectedScreens != null) {
      await _saveValues();
    }

    if (!mounted) return;
    final message = connected
        ? (detectedScreens != null
            ? 'Connected to rig — $detectedScreens screens detected.'
            : 'Connected to rig. Screen count not reported, using the value above.')
        : 'Failed to connect after $retries retries.';

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: AppFonts.inter(color: Colors.white),
        ),
        backgroundColor: connected ? accentSystem : accentError,
      )
    );
  }

  int _parseScreenCount() {
    final parsed = int.tryParse(_screensController.text.trim()) ?? 3;
    return parsed.clamp(1, 12);
  }

  bool _sshLooksFailed(String out) {
    final t = out.trim();
    if (t.startsWith('ERROR')) return true;
    if (t.contains('did not answer /health')) return true;
    if (t.contains('Warning: failed to open Chromium')) return true;
    if (t.contains('Some slaves did not open')) return true;
    if (t.contains('did not start Chromium')) return true;
    return false;
  }

  Future<void> _launchGame() async {
    if (!_isConnected || _isBusy) return;
    setState(() => _isBusy = true);
    final screens = _parseScreenCount();
    final out = await SSHService().launchGame(screens);
    if (!mounted) return;
    setState(() => _isBusy = false);
    final failed = _sshLooksFailed(out);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(failed ? out : 'Launched successfully.'),
      backgroundColor: failed ? accentError : accentSuccess,
    ));
  }

  Future<void> _relaunchGame() async {
    if (!_isConnected || _isBusy) return;
    setState(() => _isBusy = true);
    final screens = _parseScreenCount();
    final out = await SSHService().relaunchGame(screens);
    if (!mounted) return;
    setState(() => _isBusy = false);
    final failed = _sshLooksFailed(out);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(failed ? out : 'Launched successfully.'),
      backgroundColor: failed ? accentError : accentSuccess,
    ));
  }

  Future<void> _closeGame() async {
    if (!_isConnected || _isBusy) return;
    setState(() => _isBusy = true);
    final out = await SSHService().closeGame();
    if (!mounted) return;
    setState(() => _isBusy = false);
    final failed = _sshLooksFailed(out);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(failed ? out : 'Closed successfully.'),
      backgroundColor: failed ? accentError : accentSuccess,
    ));
  }

  Future<void> _disconnect() async {
    if (!_isConnected) return;
    await SSHService().disconnect();
    if (mounted) {
      setState(() {
        _isConnected = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Disconnected from rig.'), backgroundColor: accentSystem)
      );
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _hostController.dispose();
    _portController.dispose();
    _passwordController.dispose();
    _screensController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: bgDark,
        elevation: 0,
        title: Row(
          children: [
            Expanded(
              child: Text(
                'SETTINGS',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppFonts.jetBrainsMono(
                  fontSize: 16,
                  color: accentSystem,
                  letterSpacing: 1,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ConnectionStatus(isConnected: _isConnected, label: 'LG LINK'),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // -- TTS toggle panel ---------------------------------------------
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ROBOT COMMENTARY',
                    style: AppFonts.spaceGrotesk(
                      fontWeight: FontWeight.bold,
                      color: textPrimary,
                      fontSize: 16,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Consumer<TTSService>(
                    builder: (context, tts, child) {
                      return SwitchListTile(
                        title: Text(
                          'Enable TTS Voice',
                          style: AppFonts.inter(
                            color: textPrimary,
                            fontSize: 14,
                          ),
                        ),
                        value: !tts.isMuted,
                        onChanged: (bool value) {
                          if (tts.isMuted == value) {
                            tts.toggleMute();
                          }
                        },
                        activeColor: accentSystem,
                        contentPadding: EdgeInsets.zero,
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // -- Rig Connection Panel -----------------------------------------
            LgPanel(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'CONNECTION',
                      style: AppFonts.spaceGrotesk(
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                        fontSize: 16,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 20),
                    SettingsLabeledField(
                      label: 'USERNAME',
                      hint: 'lg',
                      controller: _usernameController,
                    ),
                    const SizedBox(height: 16),
                    SettingsLabeledField(
                      label: 'PASSWORD',
                      hint: 'lq',
                      controller: _passwordController,
                      obscure: _obscurePassword,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                          color: textSecondary,
                          size: 20,
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    SettingsLabeledField(
                      label: 'IP ADDRESS',
                      hint: '10.11.77.106  (lg1 Wi‑Fi IPv4)',
                      controller: _hostController,
                      validator: validateRigHost,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Emulator join uses 10.0.2.2:8130. Launch/SSH always uses the rig Wi‑Fi IPv4, never 10.0.2.2.',
                      style: AppFonts.inter(
                        fontSize: 11,
                        color: textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SettingsLabeledField(
                      label: 'PORT',
                      hint: '22',
                      controller: _portController,
                      keyboardType: TextInputType.number,
                      validator: validateSshPort
                    ),
                    const SizedBox(height: 16),
                    SettingsLabeledField(
                      label: 'NUMBER OF SCREENS',
                      hint: '3',
                      controller: _screensController,
                      keyboardType: TextInputType.number,
                      validator: validateScreenCount
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // QR scanner button
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final result = await Navigator.pushNamed(context, '/qrscan', arguments: 'rigConnect');
                      if (result != null && result is String && result.startsWith('LGRIG|')) {
                        final parts = result.split('|');
                        if (!mounted) return;
                        if (parts.length >= 6) {
                          setState(() {
                            _usernameController.text = parts[1];
                            _hostController.text = parts[2];
                            _portController.text = parts[3];
                            _screensController.text = parts[5];
                          });
                          _saveValues();
                        }
                      }
                    },
                    icon: const Icon(Icons.qr_code_scanner_rounded),
                    label: const Text('Scan QR to Connect'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: accentSystem,
                      side: const BorderSide(color: accentSystem),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // Rig Action Buttons
            ElevatedButton.icon(
              onPressed: () {
                _saveValues();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Credentials saved successfully.'),
                    backgroundColor: accentSuccess,
                  ),
                );
              },
              icon: const Icon(Icons.save_outlined),
              label: const Text('SAVE CREDENTIALS'),
              style: ElevatedButton.styleFrom(
                backgroundColor: cardSecondary,
                foregroundColor: textPrimary,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnecting ? null : _connectToRig,
              icon: _isConnecting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.wifi_tethering),
              label: Text(_isConnecting ? 'CONNECTING...' : (_isConnected ? 'RECONNECT LG' : 'CONNECT LG')),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentSystem,
                foregroundColor: bgDark,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected && !_isBusy ? _launchGame : null,
              icon: _isBusy
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.rocket_launch),
              label: Text(_isBusy ? 'LAUNCHING WALL…' : 'LAUNCH ON RIG'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentGame,
                foregroundColor: bgDark,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected && !_isBusy ? _relaunchGame : null,
              icon: const Icon(Icons.restart_alt),
              label: const Text('RELAUNCH'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentGame.withOpacity(0.2),
                foregroundColor: accentGame,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected && !_isBusy ? _closeGame : null,
              icon: const Icon(Icons.stop_circle),
              label: const Text('SHUT DOWN ON RIG'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentError.withOpacity(0.2),
                foregroundColor: accentError,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected ? _disconnect : null,
              icon: const Icon(Icons.link_off),
              label: const Text('DISCONNECT'),
              style: ElevatedButton.styleFrom(
                backgroundColor: cardFill,
                foregroundColor: textPrimary,
                textStyle: AppFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 32),
            const SettingsAboutFooter(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
