import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/gameservice.dart';
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
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/connect');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 3),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset('assets/app_icon_transparent.png', width: 72, height: 72),
                const SizedBox(width: 32),
                Image.asset('assets/lg-logo.png', height: 48, color: Colors.white),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'LG ARKANOID',
              style: TextStyle(
                fontFamily: GoogleFonts.inter().fontFamily,
                fontSize: 48,
                color: accentPrimary,
                letterSpacing: 2,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'POWERED BY GEMINI',
              style: TextStyle(
                fontFamily: GoogleFonts.inter().fontFamily,
                fontSize: 12,
                color: accentPrimary,
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
                    color: cardFill,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: 200 * _progress.value,
                      height: 4,
                      decoration: BoxDecoration(
                        color: accentPrimary,
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
