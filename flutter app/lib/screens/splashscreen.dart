import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/constants.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  
  late Animation<double> _dotOpacity;
  late Animation<double> _dotScale;
  late Animation<double> _orbitOpacity;
  late Animation<double> _logoOpacity;
  late Animation<double> _fadeScreen;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3500),
    );

    _dotOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.15, curve: Curves.easeIn)),
    );
    
    _dotScale = Tween<double>(begin: 1.0, end: 3.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.15, 0.35, curve: Curves.easeOut)),
    );

    _orbitOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.25, 0.45, curve: Curves.easeIn)),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.5, 0.75, curve: Curves.easeIn)),
    );

    _fadeScreen = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.85, 1.0, curve: Curves.easeOut)),
    );

    _controller.forward().then((_) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/connect');
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black, // Pure black for cinematic effect
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Opacity(
            opacity: _fadeScreen.value,
            child: Center(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Dot and Orbit
                  if (_logoOpacity.value == 0.0)
                    Opacity(
                      opacity: _dotOpacity.value,
                      child: Transform.scale(
                        scale: _dotScale.value,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: accentPrimary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(color: accentPrimary.withOpacity(0.5), blurRadius: 10)
                            ],
                          ),
                        ),
                      ),
                    ),
                  
                  // Logo
                  Opacity(
                    opacity: _logoOpacity.value,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Image.asset('assets/app_icon_transparent.png', width: 64, height: 64),
                            const SizedBox(width: 24),
                            Image.asset('assets/lg-logo.png', height: 40, color: Colors.white),
                          ],
                        ),
                        const SizedBox(height: 32),
                        Text(
                          'LIQUID GALAXY',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                            letterSpacing: 2,
                          ),
                        ),
                        Text(
                          'Controller',
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            color: textSecondary,
                            letterSpacing: 4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
