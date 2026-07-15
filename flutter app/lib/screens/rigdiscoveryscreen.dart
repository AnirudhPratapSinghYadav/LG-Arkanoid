import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgpanel.dart';
import '../widgets/mission_background.dart';

class RigDiscoveryScreen extends StatefulWidget {
  const RigDiscoveryScreen({super.key});

  @override
  State<RigDiscoveryScreen> createState() => _RigDiscoveryScreenState();
}

class _RigDiscoveryScreenState extends State<RigDiscoveryScreen> {
  bool _isSearching = true;
  List<String> _discoveredRigs = [];

  @override
  void initState() {
    super.initState();
    _startDiscovery();
  }

  Future<void> _startDiscovery() async {
    if (!mounted) return;
    setState(() {
      _isSearching = true;
      _discoveredRigs.clear();
    });

    final service = context.read<GameService>();
    final Set<String> targetIps = {};

    targetIps.add('127.0.0.1');
    targetIps.add('10.0.2.2'); // Default Android emulator host loopback
    targetIps.add('10.0.3.2'); // Genymotion emulator loopback

    try {
      final interfaces = await NetworkInterface.list(
        includeLoopback: false,
        type: InternetAddressType.IPv4,
      );

      for (var interface in interfaces) {
        for (var addr in interface.addresses) {
          final ip = addr.address;
          final parts = ip.split('.');
          if (parts.length == 4) {
            final subnet = '${parts[0]}.${parts[1]}.${parts[2]}.';
            for (int i = 1; i <= 254; i++) {
              targetIps.add('$subnet$i');
            }
          }
        }
      }
    } catch (_) {
      // Fallback if network interfaces cannot be listed
    }

    // We prioritize local loopback / emulator IPs first before scanning the whole subnet
    final List<String> priorityCandidates = ['127.0.0.1', '10.0.2.2', '10.0.3.2'];
    final List<String> subnetCandidates = targetIps.where((ip) => !priorityCandidates.contains(ip)).toList();
    final List<String> allCandidates = [...priorityCandidates, ...subnetCandidates];

    final List<String> activeRigs = [];
    
    // Batch size of 20 to prevent socket exhaustion and false timeouts on Android
    const int batchSize = 20;
    for (int i = 0; i < allCandidates.length; i += batchSize) {
      final end = (i + batchSize < allCandidates.length) ? i + batchSize : allCandidates.length;
      final batch = allCandidates.sublist(i, end);

      final probes = batch.map((ip) {
        return service.checkHealth(ip, defaultServerPort).then((ok) => ok ? ip : null);
      });

      final results = await Future.wait(probes);
      activeRigs.addAll(results.whereType<String>());
      
      // If we already found a rig, we can stop early to make the process instant!
      if (activeRigs.isNotEmpty) {
        break;
      }
    }

    if (!mounted) return;

    setState(() {
      _discoveredRigs = activeRigs.toSet().toList();
      _isSearching = false;
    });

    if (_discoveredRigs.length == 1) {
      final rigIp = _discoveredRigs.first;
      final connected = await service.connect(rigIp, defaultServerPort);
      if (mounted && connected) {
        Navigator.pushReplacementNamed(context, '/joinchoice');
      } else if (mounted) {
        setState(() {
          _isSearching = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to connect to discovered rig')),
        );
      }
    }
  }

  void _onSelectRig(String ip) async {
    setState(() {
      _isSearching = true;
    });
    final service = context.read<GameService>();
    final connected = await service.connect(ip, defaultServerPort);
    if (mounted) {
      setState(() {
        _isSearching = false;
      });
      if (connected) {
        Navigator.pushReplacementNamed(context, '/joinchoice');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection failed. Please check IP and ensure server is running.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
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
                    Column(
                      children: [
                        Image.asset('assets/lg-logo.png', height: 44),
                        const SizedBox(height: 16),
                        Text(
                          'RIG DISCOVERY',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2.0,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'CONNECTING TO LIQUID GALAXY INSTANCE',
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: textSecondary,
                            letterSpacing: 1.5,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    if (_isSearching) ...[
                      LgPanel(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 32),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 44,
                                height: 44,
                                child: CircularProgressIndicator(
                                  strokeWidth: 4,
                                  color: accentPrimary,
                                ),
                              ),
                              const SizedBox(height: 24),
                              Text(
                                'Searching local network...',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ] else if (_discoveredRigs.isEmpty) ...[
                      LgPanel(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.wifi_off_rounded,
                                color: accentError,
                                size: 48,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No installations found',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: textPrimary,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Make sure the Arkanoid server is running on the same Wi-Fi network and try again.',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: textSecondary,
                                  height: 1.4,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 36),
                      LgButton(
                        label: 'RETRY SEARCH',
                        onPressed: _startDiscovery,
                        isPrimary: true,
                      ),
                    ] else ...[
                      LgPanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'SELECT INSTALLATION',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: textSecondary,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: borderLight),
                            const SizedBox(height: 8),
                            for (var ip in _discoveredRigs) ...[
                              InkWell(
                                onTap: () => _onSelectRig(ip),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: borderLight),
                                    borderRadius: BorderRadius.circular(10),
                                    color: Colors.white.withValues(alpha: 0.02),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.tv_rounded,
                                        color: accentPrimary,
                                        size: 20,
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Text(
                                          'Rig Console ($ip)',
                                          style: GoogleFonts.jetBrainsMono(
                                            fontSize: 14,
                                            color: textPrimary,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      const Icon(
                                        Icons.arrow_forward_ios_rounded,
                                        color: textSecondary,
                                        size: 14,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      LgButton(
                        label: 'RESCAN NETWORK',
                        onPressed: _startDiscovery,
                        isPrimary: false,
                      ),
                    ],

                    // ── Always-visible skip button ──
                    const SizedBox(height: 24),
                    const Divider(color: borderLight),
                    const SizedBox(height: 16),
                    Text(
                      'Or connect manually via USB / hotspot',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    LgButton(
                      label: 'SKIP — ENTER MANUALLY',
                      onPressed: () {
                        Navigator.pushReplacementNamed(context, '/joinchoice');
                      },
                      isPrimary: false,
                    ),
                    const SizedBox(height: 20),
                    LgPanel(
                      child: Column(
                        children: [
                          const Icon(Icons.usb_rounded, color: accentWarning, size: 24),
                          const SizedBox(height: 8),
                          Text(
                            'USB DEBUGGING?',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: accentWarning,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Run this on your PC terminal:\nadb reverse tcp:$defaultServerPort tcp:$defaultServerPort\nThen use IP: 127.0.0.1',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              color: textSecondary,
                              height: 1.5,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
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
