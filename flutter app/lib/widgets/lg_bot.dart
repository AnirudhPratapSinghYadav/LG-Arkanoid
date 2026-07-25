import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/constants.dart';

class LgBot extends StatefulWidget {
  final bool isSpeaking;
  const LgBot({super.key, this.isSpeaking = false});

  @override
  State<LgBot> createState() => _LgBotState();
}

class _LgBotState extends State<LgBot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _floatAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimation();
  }

  @override
  void didUpdateWidget(covariant LgBot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isSpeaking != widget.isSpeaking) {
      _controller.dispose();
      _setupAnimation();
    }
  }

  void _setupAnimation() {
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: widget.isSpeaking ? 250 : 2000),
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
    final disableAnimations = MediaQuery.disableAnimationsOf(context);

    Widget botWidget = GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
      },
      child: SizedBox(
        width: 48,
        height: 48,
        child: CustomPaint(
          painter: _BotPainter(),
        ),
      ),
    );

    if (disableAnimations) {
      return botWidget;
    }

    return AnimatedBuilder(
      animation: _floatAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, _floatAnimation.value),
          child: botWidget,
        );
      }
    );
  }
}

class _BotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    
    paint.color = cardFill;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(8, 12, size.width - 16, size.height - 24),
        const Radius.circular(8)
      ),
      paint,
    );

    paint.color = accentSystem;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(12, 18, size.width - 24, 10),
        const Radius.circular(4)
      ),
      paint,
    );

    paint.color = cardFill;
    canvas.drawLine(
      Offset(size.width / 2, 12),
      Offset(size.width / 2, 4),
      Paint()..color = cardFill..strokeWidth = 2,
    );
    paint.color = accentGame;
    canvas.drawCircle(Offset(size.width / 2, 4), 3, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
