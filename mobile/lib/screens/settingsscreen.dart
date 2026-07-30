import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../services/ttsservice.dart';
import '../services/ssh_service.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/connectionstatus.dart';

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
    
    if (!mounted) return;
    setState(() { 
      _isConnecting = false; 
      _isConnected = connected; 
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          connected ? 'Connected to rig.' : 'Failed to connect after $retries retries.',
          style: GoogleFonts.inter(color: Colors.white),
        ),
        backgroundColor: connected ? accentSystem : accentError,
      )
    );
  }

  Future<void> _launchGame() async {
    if (!_isConnected) return;
    final screens = int.tryParse(_screensController.text.trim()) ?? 3;
    final err = await SSHService().launchGame(screens);
    if (mounted && err.startsWith('ERROR')) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: accentError));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Launched successfully.'), backgroundColor: accentSuccess));
    }
  }

  Future<void> _relaunchGame() async {
    if (!_isConnected) return;
    final screens = int.tryParse(_screensController.text.trim()) ?? 3;
    final err = await SSHService().relaunchGame(screens);
    if (mounted && err.startsWith('ERROR')) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: accentError));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Launched successfully.'), backgroundColor: accentSuccess));
    }
  }

  Future<void> _closeGame() async {
    if (!_isConnected) return;
    final err = await SSHService().closeGame();
    if (mounted && err.startsWith('ERROR')) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: accentError));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Closed successfully.'), backgroundColor: accentSuccess));
    }
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

  Widget _buildTextField({
    required String label,
    required String hint,
    required TextEditingController controller,
    bool obscure = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: accentSystem,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: GoogleFonts.jetBrainsMono(color: textPrimary, fontSize: 15),
          cursorColor: accentSystem,
          validator: validator ?? (value) {
            if (value == null || value.trim().isEmpty) {
              return 'This field is required';
            }
            return null;
          },
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.jetBrainsMono(color: textSecondary.withOpacity(0.5)),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: cardSecondary,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: borderLight),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: borderLight),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: accentSystem, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: accentError, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
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
            Text(
              'SYS.CFG',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 20,
                color: accentSystem,
                letterSpacing: 2,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Spacer(),
            ConnectionStatus(isConnected: _isConnected, label: 'SYS.CONN'),
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
              tag: 'CFG.TTS',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ROBOT COMMENTARY',
                    style: GoogleFonts.spaceGrotesk(
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
                          style: GoogleFonts.inter(
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
              tag: 'CFG.RIG',
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'LG CREDENTIALS',
                      style: GoogleFonts.spaceGrotesk(
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                        fontSize: 16,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _buildTextField(
                      label: 'SSH USERNAME',
                      hint: 'lg',
                      controller: _usernameController,
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      label: 'LG MASTER IP',
                      hint: '192.168.1.1',
                      controller: _hostController,
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      label: 'SSH PORT',
                      hint: '22',
                      controller: _portController,
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) return 'This field is required';
                        if (int.tryParse(value) == null) return 'Must be a valid port number';
                        return null;
                      }
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      label: 'SSH PASSWORD',
                      hint: 'Enter password',
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
                    _buildTextField(
                      label: 'NUMBER OF SCREENS',
                      hint: 'e.g. 3, 5, 7, 9',
                      controller: _screensController,
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) return 'This field is required';
                        if (int.tryParse(value) == null) return 'Must be a number';
                        return null;
                      }
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
                        if (parts.length >= 6) {
                          setState(() {
                            _usernameController.text = parts[1];
                            _hostController.text = parts[2];
                            _portController.text = parts[3];
                            _passwordController.text = parts[4];
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
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnecting ? null : _connectToRig,
              icon: _isConnecting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.link),
              label: Text(_isConnecting ? 'CONNECTING...' : (_isConnected ? 'RECONNECT' : 'CONNECT TO RIG')),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentSystem,
                foregroundColor: bgDark,
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected ? _launchGame : null,
              icon: const Icon(Icons.rocket_launch),
              label: const Text('LAUNCH ON RIG'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentGame,
                foregroundColor: bgDark,
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected ? _relaunchGame : null,
              icon: const Icon(Icons.restart_alt),
              label: const Text('RELAUNCH'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentGame.withOpacity(0.2),
                foregroundColor: accentGame,
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isConnected ? _closeGame : null,
              icon: const Icon(Icons.stop_circle),
              label: const Text('SHUT DOWN ON RIG'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentError.withOpacity(0.2),
                foregroundColor: accentError,
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
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
                textStyle: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.bold),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 32),
            // -- About section ------------------------------------------------
            Center(
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset('assets/app_icon_transparent.png', width: 28, height: 28),
                      const SizedBox(width: 10),
                      Image.asset('assets/lg-logo.png', height: 24),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'LG Arkanoid',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Where AI meets Arkanoid',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: accentSystem,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Built by Anirudh Pratap Singh Yadav for Liquid Galaxy\npowered by GeminiSOC 2026',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: textSecondary,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
