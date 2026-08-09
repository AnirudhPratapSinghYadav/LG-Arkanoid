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
  late Animation<double> _logoOpacity;
  late Animation<double> _fadeScreen;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 8000),
    );

    _dotOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.15, curve: Curves.easeIn)),
    );
    
    _dotScale = Tween<double>(begin: 1.0, end: 3.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.15, 0.35, curve: Curves.easeOut)),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.5, 0.75, curve: Curves.easeIn)),
    );

    _fadeScreen = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.85, 1.0, curve: Curves.easeOut)),
    );

    _controller.forward().then((_) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/joinchoice');
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
      backgroundColor: Colors.black,
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Stack(
            children: [
              // The main splash content with fade animation.
              Opacity(
                opacity: _fadeScreen.value,
                child: Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      if (_logoOpacity.value == 0.0)
                        Opacity(
                          opacity: _dotOpacity.value,
                          child: Transform.scale(
                            scale: _dotScale.value,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: accentSystem,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(color: accentSystem.withOpacity(0.5), blurRadius: 10)
                                ],
                              ),
                            ),
                          ),
                        ),
                      
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
                                Image.asset('assets/lg-logo.png', height: 40),
                              ],
                            ),
                            const SizedBox(height: 28),
                            Text(
                              'LIQUID GALAXY ARCADE CONTROLLER',
                              style: GoogleFonts.vt323(
                                fontSize: 24,
                                color: textPrimary,
                                letterSpacing: 1.5,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Phone controller for panoramic play',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 13,
                                color: accentSystem,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Anirudh Pratap Singh Yadav · Liquid Galaxy',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                color: textSecondary,
                                height: 1.4,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            _DotDotDot(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              Positioned(
                top: MediaQuery.of(context).padding.top + 12,
                right: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'LG Arkanoid',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    Text(
                      'Liquid Galaxy',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DotDotDot extends StatefulWidget {
  @override
  State<_DotDotDot> createState() => _DotDotDotState();
}

class _DotDotDotState extends State<_DotDotDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<int> _dots;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat();
    _dots = IntTween(begin: 0, end: 3).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _dots,
      builder: (context, child) {
        String dotsText = '';
        for (int i = 0; i < _dots.value; i++) {
          dotsText += '. ';
        }
        return SizedBox(
          height: 20,
          child: Text(
            dotsText,
            style: GoogleFonts.inter(
              fontSize: 18,
              color: textSecondary,
              letterSpacing: 4,
              fontWeight: FontWeight.bold,
            ),
          ),
        );
      },
    );
  }
}
