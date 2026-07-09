import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/game_service.dart';
import '../utils/constants.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );

    _progress = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _controller.forward();
    _tryAutoConnect();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _tryAutoConnect() async {
    const storage = FlutterSecureStorage();
    final savedAddress = await storage.read(key: prefServerAddress);
    final savedPort =
        await storage.read(key: prefServerPort) ?? defaultServerPort;
    final savedToken = await storage.read(key: prefSessionToken);

    bool success = false;

    if (savedAddress != null && savedAddress.isNotEmpty && mounted) {
      final service = context.read<GameService>();
      success = await service.connect(savedAddress, savedPort);
      if (success &&
          mounted &&
          savedToken != null &&
          savedToken.isNotEmpty) {
        service.joinGame(savedToken);
      }
    }

    await Future.delayed(const Duration(seconds: 3));

    if (mounted) {
      if (success) {
        Navigator.pushReplacementNamed(context, '/controller');
      } else {
        Navigator.pushReplacementNamed(context, '/connect');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 3),
            const Text(
              'LG ARKANOID',
              style: TextStyle(
                fontFamily: 'VT323',
                fontSize: 48,
                color: accentCyan,
                letterSpacing: 2,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'LIQUID GALAXY EDITION',
              style: TextStyle(
                fontFamily: 'JetBrainsMono',
                fontSize: 12,
                color: accentCyan,
                letterSpacing: 4,
              ),
            ),
            const Spacer(flex: 2),
            AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return Container(
                  width: 200,
                  height: 4,
                  decoration: BoxDecoration(
                    color: panelFill,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: 200 * _progress.value,
                      height: 4,
                      decoration: BoxDecoration(
                        color: accentCyan,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 60),
          ],
        ),
      ),
    );
  }
}
