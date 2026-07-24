// ---------------------------------------------------------------------------
// settingsscreen.dart
//
// The settings screen for the LG Arkanoid Flutter controller app. This
// screen lets the user configure the SSH connection to the Liquid Galaxy
// master machine, set the number of screens on the rig, toggle TTS, and
// test the SSH connection before launching the game.
//
// All credential fields persist across app restarts. The SSH password is
// stored securely via flutter_secure_storage; all other values use
// SharedPreferences.
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/ssh_service.dart';
import '../services/ttsservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Controllers for each text field in the form.
  final _hostController = TextEditingController();
  final _portController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  // The number of screens on the Liquid Galaxy rig.
  int _numScreens = 3;

  // Whether the password field should be obscured.
  bool _obscurePassword = true;

  // Whether we are currently testing the SSH connection.
  bool _isTesting = false;

  // Secure storage instance for the SSH password.
  final _secureStorage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadSavedValues();
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // Load previously saved values from SharedPreferences and secure storage.
  Future<void> _loadSavedValues() async {
    final prefs = await SharedPreferences.getInstance();

    _hostController.text = prefs.getString(prefHost) ?? '';
    _portController.text = prefs.getString(prefPort) ?? '$defaultSshPort';
    _usernameController.text = prefs.getString(prefUsername) ?? defaultSshUsername;

    // The password is stored securely and must be read separately.
    final savedPassword = await _secureStorage.read(key: prefPassword);
    _passwordController.text = savedPassword ?? '';

    final savedScreens = prefs.getInt(prefNumScreens);
    if (savedScreens != null && [3, 5, 7, 9].contains(savedScreens)) {
      _numScreens = savedScreens;
    }

    if (mounted) setState(() {});
  }

  // Persist all form values to their respective storage locations.
  Future<void> _saveValues() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(prefHost, _hostController.text.trim());
    await prefs.setString(prefPort, _portController.text.trim());
    await prefs.setString(prefUsername, _usernameController.text.trim());
    await prefs.setInt(prefNumScreens, _numScreens);

    // The password is stored in secure storage, not SharedPreferences.
    await _secureStorage.write(
      key: prefPassword,
      value: _passwordController.text,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Settings saved.',
            style: GoogleFonts.inter(color: Colors.white),
          ),
          backgroundColor: accentSuccess,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  // Test the SSH connection using the current form values. Shows a green or
  // red SnackBar depending on whether the connection succeeds or fails.
  Future<void> _testConnection() async {
    setState(() => _isTesting = true);

    try {
      // Save the current values first so the SSH service can read them.
      await _saveValues();

      final sshService = SSHService();
      final result = await sshService.connect();
      await sshService.disconnect();

      if (!mounted) return;

      if (result == null) {
        // A null result means the connection succeeded without errors.
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Connected successfully.',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: accentSuccess,
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Connection failed: $result',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: accentError,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Connection failed: check credentials.',
            style: GoogleFonts.inter(color: Colors.white),
          ),
          backgroundColor: accentError,
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      if (mounted) setState(() => _isTesting = false);
    }
  }

  // Build a styled text form field that matches the app design system.
  Widget _buildField({
    required String label,
    required String hint,
    required TextEditingController controller,
    bool obscure = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: textSecondary,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: GoogleFonts.inter(color: textPrimary, fontSize: 15),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(color: textSecondary.withValues(alpha: 0.5)),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: cardSecondary,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderLight),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderLight),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: accentPrimary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tts = context.watch<TTSService>();

    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: bgDark,
        title: Text(
          'SETTINGS',
          style: GoogleFonts.inter(
            fontSize: 24,
            color: accentPrimary,
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
            // -- SSH Connection Settings panel --------------------------------
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'LG CONNECTION',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: accentPrimary,
                      fontSize: 14,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 20),
                  _buildField(
                    label: 'LG MASTER IP',
                    hint: '192.168.1.1',
                    controller: _hostController,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 16),
                  _buildField(
                    label: 'SSH PORT',
                    hint: '22',
                    controller: _portController,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 16),
                  _buildField(
                    label: 'SSH USERNAME',
                    hint: 'lg',
                    controller: _usernameController,
                  ),
                  const SizedBox(height: 16),
                  _buildField(
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

                  // Number of screens dropdown.
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'NUMBER OF SCREENS',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: textSecondary,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: cardSecondary,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: borderLight),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _numScreens,
                            isExpanded: true,
                            dropdownColor: cardSecondary,
                            style: GoogleFonts.inter(color: textPrimary, fontSize: 15),
                            items: const [
                              DropdownMenuItem(value: 3, child: Text('3 Screens')),
                              DropdownMenuItem(value: 5, child: Text('5 Screens')),
                              DropdownMenuItem(value: 7, child: Text('7 Screens')),
                              DropdownMenuItem(value: 9, child: Text('9 Screens')),
                            ],
                            onChanged: (value) {
                              if (value != null) setState(() => _numScreens = value);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // -- TTS toggle panel ---------------------------------------------
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ROBOT COMMENTARY',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: accentPrimary,
                      fontSize: 14,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
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
                    activeColor: accentPrimary,
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // -- Action buttons -----------------------------------------------

            // Save button.
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _saveValues,
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentPrimary,
                  foregroundColor: bgDark,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  'SAVE',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Test Connection button.
            SizedBox(
              height: 52,
              child: OutlinedButton(
                onPressed: _isTesting ? null : _testConnection,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: accentPrimary, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _isTesting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: accentPrimary,
                        ),
                      )
                    : Text(
                        'TEST CONNECTION',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: accentPrimary,
                          letterSpacing: 1,
                        ),
                      ),
              ),
            ),

            const SizedBox(height: 32),

            // -- About section ------------------------------------------------
            Center(
              child: Column(
                children: [
                  Text(
                    'LG Arkanoid',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Powered by GeminiSoC 2026 - Liquid Galaxy - Anirudh Pratap Singh Yadav',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: textSecondary,
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
