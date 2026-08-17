import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import '../widgets/dual_brand.dart';

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
      duration: const Duration(milliseconds: 2200),
    );

    _dotOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.2, curve: Curves.easeIn)),
    );
    
    _dotScale = Tween<double>(begin: 1.0, end: 2.2).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.15, 0.4, curve: Curves.easeOut)),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.25, 0.55, curve: Curves.easeIn)),
    );

    _fadeScreen = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.82, 1.0, curve: Curves.easeOut)),
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
                            SizedBox(
                              width: MediaQuery.sizeOf(context).width - 48,
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Image.asset('assets/app_icon_transparent.webp', width: 64, height: 64),
                                    const SizedBox(width: 24),
                                    const DualBrand(height: 40),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 28),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  'LG ARKANOID',
                                  style: AppFonts.pressStart2P(
                                    fontSize: 14,
                                    color: textPrimary,
                                    letterSpacing: 1.0,
                                  ),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Phone controller for Liquid Galaxy',
                              style: AppFonts.spaceGrotesk(
                                fontSize: 13,
                                color: textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Anirudh Pratap Singh Yadav · Gemini SoC 2026',
                              style: AppFonts.inter(
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
                      style: AppFonts.inter(
                        fontSize: 11,
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    Text(
                      'Liquid Galaxy',
                      style: AppFonts.inter(
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
            style: AppFonts.inter(
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
