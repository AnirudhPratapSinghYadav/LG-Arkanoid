import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';
import '../widgets/lg_bot.dart';
import 'qrscanscreen.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> with SingleTickerProviderStateMixin {
  final _ipController = TextEditingController(text: '192.168.');
  final _portController = TextEditingController(text: '8080');
  final _sshUserController = TextEditingController(text: 'lg');
  final _sshPassController = TextEditingController(text: 'lg');
  final _tokenController = TextEditingController();
  final _nameController = TextEditingController();
  
  bool _connecting = false;
  bool _launching = false;
  bool _showAdvanced = false;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(_pulseController);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

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
        _connect();
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
    
    if (ok) {
      // Show success briefly before transitioning
      await Future.delayed(const Duration(milliseconds: 800));
      setState(() => _connecting = false);
      const storage = FlutterSecureStorage();
      await storage.write(key: prefServerAddress, value: address);
      await storage.write(key: prefServerPort, value: port);
      await storage.write(key: prefSessionToken, value: token);
      service.joinGame(token, name);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/controller');
      }
    } else {
      setState(() => _connecting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection failed')),
      );
    }
  }

  Future<void> _launchRig() async {
    debugPrint('SSH launch removed');
  }

  Widget _buildMetric(String label, String value, {Color color = Colors.white}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 10,
            color: textMuted,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'SpaceGrotesk',
            fontSize: 16,
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    // Determine status color based on state
    Color statusColor = accentWarning; // Default idle
    String statusText = 'Waiting for Connection...';
    if (_connecting) {
      statusColor = accentPrimary; // Blue pulse while searching
      statusText = 'Searching...';
    } else if (context.watch<GameService>().connected) {
      statusColor = accentSuccess; // Green connected
      statusText = 'Connected';
    }

    return Scaffold(
      backgroundColor: bgDark,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, color: textSecondary),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: cardFill,
                  shape: RoundedRectangleBorder(
                    side: const BorderSide(color: borderLight, width: 1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  title: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Image.asset('assets/app_icon_transparent.png', width: 40, height: 40),
                          const SizedBox(width: 16),
                          Image.asset('assets/lg-logo.png', height: 40),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text('ABOUT US', style: TextStyle(color: textPrimary, fontFamily: GoogleFonts.spaceGrotesk().fontFamily, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      const Divider(color: borderLight, thickness: 1),
                    ],
                  ),
                  content: Text(
                    'Author -> Anirudh Pratap Singh Yadav\n\nAbout Game -> LG Arkanoid brings classic brick-breaking action to the Liquid Galaxy!\n\nA Gemini Summer of Code Project.\n\nPowered by: Gemini & Liquid Galaxy',
                    style: TextStyle(color: textSecondary, fontFamily: GoogleFonts.inter().fontFamily, fontSize: 12, height: 1.5),
                    textAlign: TextAlign.center,
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text('CLOSE', style: TextStyle(color: textSecondary, fontFamily: GoogleFonts.inter().fontFamily, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500), // Larger responsive width
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Massive Hero Section
                    Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Image.asset('assets/lg-logo.png', height: 60),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'LIQUID GALAXY',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2.0,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          'Controller',
                          style: GoogleFonts.inter(
                            fontSize: 18,
                            color: accentPrimary,
                            letterSpacing: 4.0,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Arkanoid AI Powered',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: textSecondary,
                            letterSpacing: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),
                    
                    // Rig Status Card (Heroic dashboard feel)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: cardFill,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderLight),
                        boxShadow: [
                          if (_connecting)
                            BoxShadow(
                              color: accentPrimary.withValues(alpha: 0.2),
                              blurRadius: 30,
                              spreadRadius: 2,
                            )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Rig Status', style: GoogleFonts.inter(fontSize: 14, color: textSecondary, fontWeight: FontWeight.w500)),
                              if (_connecting)
                                FadeTransition(
                                  opacity: _pulseAnimation,
                                  child: Container(
                                    width: 12, height: 12,
                                    decoration: BoxDecoration(shape: BoxShape.circle, color: statusColor),
                                  ),
                                )
                              else
                                Container(
                                  width: 12, height: 12,
                                  decoration: BoxDecoration(shape: BoxShape.circle, color: statusColor),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            statusText,
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 24,
                              color: _connecting ? accentPrimary : textPrimary,
                              fontWeight: FontWeight.bold
                            )
                          ),
                          const SizedBox(height: 24),
                          const Divider(color: borderLight),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Latency', style: GoogleFonts.inter(fontSize: 12, color: textSecondary)),
                                  const SizedBox(height: 4),
                                  Text('-- ms', style: GoogleFonts.inter(fontSize: 14, color: textPrimary, fontWeight: FontWeight.bold)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('Displays', style: GoogleFonts.inter(fontSize: 12, color: textSecondary)),
                                  const SizedBox(height: 4),
                                  Text('5 Ready', style: GoogleFonts.inter(fontSize: 14, color: textPrimary, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ],
                          )
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Primary Actions
                    LgButton(
                      label: 'SCAN QR TO PAIR',
                      onPressed: _connecting ? null : _scanQr,
                      isPrimary: true,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Manual Token Entry
                    LgPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Manual Join', style: GoogleFonts.inter(fontSize: 12, color: textSecondary, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: LgTextField(
                                  controller: _nameController,
                                  label: 'Player Name',
                                  icon: Icons.person_outline,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                flex: 2,
                                child: LgTextField(
                                  controller: _tokenController,
                                  label: 'Session Token',
                                  icon: Icons.vpn_key_outlined,
                                  maxLength: 4,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                flex: 1,
                                child: SizedBox(
                                  height: 56, // Match textfield height
                                  child: ElevatedButton(
                                    onPressed: _connecting ? null : _connect,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: accentPrimary,
                                      foregroundColor: bgDark,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    child: _connecting 
                                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: bgDark))
                                      : const Icon(Icons.arrow_forward),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Advanced Settings Toggle
                    TextButton.icon(
                      onPressed: () {
                        setState(() {
                          _showAdvanced = !_showAdvanced;
                        });
                      },
                      icon: Icon(_showAdvanced ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: textSecondary),
                      label: Text('Advanced Connection Settings', style: GoogleFonts.inter(color: textSecondary)),
                    ),
                    
                    if (_showAdvanced) ...[
                      const SizedBox(height: 16),
                      LgPanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Rig Network Details', style: GoogleFonts.inter(fontSize: 12, color: textSecondary, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: LgTextField(
                                    controller: _ipController,
                                    label: 'Rig IP Address',
                                    icon: Icons.wifi,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 1,
                                  child: LgTextField(
                                    controller: _portController,
                                    label: 'Port',
                                    icon: null,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: LgTextField(
                                    controller: _sshUserController,
                                    label: 'SSH User',
                                    icon: Icons.terminal,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: LgTextField(
                                    controller: _sshPassController,
                                    label: 'SSH Pass',
                                    icon: Icons.password,
                                    obscureText: true,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            LgButton(
                              label: _launching ? 'LAUNCHING...' : 'LAUNCH BROWSER ON RIG',
                              onPressed: _launching ? null : _launchRig,
                              isPrimary: false,
                            ),
                          ],
                        ),
                      ),
                    ]
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
