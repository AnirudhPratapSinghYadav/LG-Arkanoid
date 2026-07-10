import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/constants.dart';

class LgBot extends StatefulWidget {
  const LgBot({super.key});

  @override
  State<LgBot> createState() => _LgBotState();
}

class _LgBotState extends State<LgBot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _floatAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    
    _floatAnimation = Tween<double>(begin: -5.0, end: 5.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _floatAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, _floatAnimation.value),
          child: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              // Optional: Play chirp sound
            },
            child: SizedBox(
              width: 48,
              height: 48,
              child: CustomPaint(
                painter: _BotPainter(),
              ),
            ),
          ),
        );
      }
    );
  }
}

class _BotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    
    // Body (White shell)
    paint.color = Colors.white;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(8, 12, size.width - 16, size.height - 24),
        const Radius.circular(8)
      ),
      paint,
    );

    // Visor (Cyan)
    paint.color = accentPrimary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(12, 18, size.width - 24, 10),
        const Radius.circular(4)
      ),
      paint,
    );

    // Antenna
    paint.color = Colors.white;
    canvas.drawLine(
      Offset(size.width / 2, 12),
      Offset(size.width / 2, 4),
      Paint()..color = Colors.white..strokeWidth = 2,
    );
    paint.color = accentWarning; // Warning dot on top
    canvas.drawCircle(Offset(size.width / 2, 4), 3, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
