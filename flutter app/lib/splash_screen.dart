import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'game_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _glowAnimation;
  late Animation<double> _bounceAnimation;
  late Animation<double> _progressAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );

    _glowAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.6), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.6, end: 1.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _animController, curve: Curves.easeInOut));

    _bounceAnimation = Tween<double>(begin: -150.0, end: 150.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.bounceOut),
    );

    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.linear),
    );

    _animController.forward();
    _bootstrap();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    const storage = FlutterSecureStorage();
    final savedAddress = await storage.read(key: 'last_server_address');
    final savedPort = await storage.read(key: 'last_server_port') ?? '8080';
    final savedToken = await storage.read(key: 'last_session_token');

    bool connectSuccess = false;

    if (savedAddress != null && savedAddress.isNotEmpty && mounted) {
      final service = context.read<GameService>();
      connectSuccess = await service.connect(savedAddress, savedPort);
      if (connectSuccess && mounted && savedToken != null && savedToken.isNotEmpty) {
        service.joinGame(savedToken);
      }
    }

    await Future.delayed(const Duration(seconds: 4));

    if (mounted) {
      if (connectSuccess) {
        Navigator.pushReplacementNamed(context, '/controller');
      } else {
        Navigator.pushReplacementNamed(context, '/connect');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF02090C),
      body: AnimatedBuilder(
        animation: _animController,
        builder: (context, child) {
          return Stack(
            fit: StackFit.expand,
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 1.5,
                    colors: [
                      Colors.teal.withOpacity(0.15 * _glowAnimation.value),
                      const Color(0xFF02090C),
                    ],
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.of(context).size.height * 0.45,
                left: (MediaQuery.of(context).size.width / 2) +
                    _bounceAnimation.value - 8,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.tealAccent
                            .withOpacity(_glowAnimation.value),
                        blurRadius: 20,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                ),
              ),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 120),
                  Text(
                    'LG Arkanoid',
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 4,
                      shadows: [
                        Shadow(
                          color: Colors.tealAccent
                              .withOpacity(_glowAnimation.value),
                          blurRadius: 30,
                        ),
                        const Shadow(
                          color: Colors.teal,
                          blurRadius: 10,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'MULTIPLAYER PANORAMIC BRICK BREAKER',
                    style: TextStyle(
                      fontSize: 12,
                      letterSpacing: 3,
                      fontWeight: FontWeight.bold,
                      color: Colors.teal,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.memory,
                        color: Colors.tealAccent
                            .withOpacity(0.5 + 0.5 * _glowAnimation.value),
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Powered by Gemini AI',
                        style: TextStyle(
                          color: Colors.tealAccent.withOpacity(0.8),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                  Container(
                    width: 250,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white10,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Stack(
                      children: [
                        Container(
                          width: 250 * _progressAnimation.value,
                          height: 4,
                          decoration: BoxDecoration(
                            color: Colors.tealAccent,
                            borderRadius: BorderRadius.circular(2),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.tealAccent.withOpacity(0.8),
                                blurRadius: 10,
                              )
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 60),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
