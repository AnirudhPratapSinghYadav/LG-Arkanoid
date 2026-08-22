import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';
import '../utils/join_target.dart';

class NameEntryScreen extends StatefulWidget {
  const NameEntryScreen({super.key});

  @override
  State<NameEntryScreen> createState() => _NameEntryScreenState();
}

class _NameEntryScreenState extends State<NameEntryScreen> {
  final _nameController = TextEditingController();

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      final saved = prefs.getString(prefPlayerName);
      if (!mounted || saved == null || saved.isEmpty) return;
      _nameController.text = saved;
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _onReady(Map<String, dynamic> args) async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your name')),
      );
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefPlayerName, name);

    if (!mounted) return;
    final host = parseJoinInput(
      '${args['ip'] ?? ''}',
      defaultPort: '${args['port'] ?? defaultServerPort}',
    );
    if (host?.warning != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(host!.warning!)),
      );
      return;
    }
    Navigator.pushNamed(
      context,
      '/connecting',
      arguments: {
        'ip': args['ip'],
        'port': args['port'],
        'token': args['token'],
        'name': name,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>? ?? {};

    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: textSecondary),
      ),
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'YOUR NAME',
                      style: AppFonts.spaceGrotesk(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: textPrimary,
                        letterSpacing: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'This name shows on the wall. Confirm the IP and code below match the center screen.',
                      style: AppFonts.inter(
                        fontSize: 13,
                        color: textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    LgPanel(
                      child: Text(
                        'http://${args['ip'] ?? '?'}:${args['port'] ?? defaultServerPort}'
                        '   code ${(args['token'] ?? '').toString().toUpperCase()}',
                        textAlign: TextAlign.center,
                        style: AppFonts.jetBrainsMono(
                          fontSize: 13,
                          color: textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 36),
                    LgPanel(
                      child: LgTextField(
                        controller: _nameController,
                        label: 'DISPLAY NAME',
                        maxLength: 12,
                        keyboardType: TextInputType.name,
                        textCapitalization: TextCapitalization.words,
                      ),
                    ),
                    const SizedBox(height: 48),
                    LgButton(
                      label: 'READY',
                      onPressed: () => _onReady(args),
                      isPrimary: true,
                    ),
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
