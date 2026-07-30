import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/constants.dart';

enum BotState { idle, excited, alert, thinking }

class LgBot extends StatefulWidget {
  final BotState state;
  const LgBot({super.key, this.state = BotState.idle});

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
    if (oldWidget.state != widget.state) {
      _controller.dispose();
      _setupAnimation();
    }
  }

  void _setupAnimation() {
    int durationMs = 2000;
    if (widget.state == BotState.excited) durationMs = 250;
    else if (widget.state == BotState.alert) durationMs = 150;
    else if (widget.state == BotState.thinking) durationMs = 800;

    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: durationMs),
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
          painter: _BotPainter(widget.state),
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
  final BotState state;

  _BotPainter(this.state);

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

    Color visorColor = accentSystem;
    if (state == BotState.excited) visorColor = accentGame;
    else if (state == BotState.alert) visorColor = accentError;
    else if (state == BotState.thinking) visorColor = Colors.purpleAccent;

    paint.color = visorColor;
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
  bool shouldRepaint(covariant _BotPainter oldDelegate) => oldDelegate.state != state;
}
