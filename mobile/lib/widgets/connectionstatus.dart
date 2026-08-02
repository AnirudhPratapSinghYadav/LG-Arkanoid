import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
import '../utils/constants.dart';

class ConnectionStatus extends StatefulWidget {
  final bool isConnected;
  final String label;

  const ConnectionStatus({
    super.key,
    required this.isConnected,
    this.label = '',
  });

  @override
  State<ConnectionStatus> createState() => _ConnectionStatusState();
}

class _ConnectionStatusState extends State<ConnectionStatus> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.isConnected ? accentSystem : accentError,
                boxShadow: widget.isConnected ? [
                  BoxShadow(
                    color: accentSystem.withOpacity(0.6 * _controller.value),
                    blurRadius: 8 * _controller.value,
                    spreadRadius: 2 * _controller.value,
                  )
                ] : null,
              ),
            );
          },
        ),
        const SizedBox(width: 8),
        Text(
          widget.label.isNotEmpty
              ? widget.label
              : (widget.isConnected ? 'CONNECTED' : 'DISCONNECTED'),
          style: TextStyle(
            color: widget.isConnected ? accentSystem : accentError,
            fontSize: 12,
            fontFamily: GoogleFonts.jetBrainsMono().fontFamily,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }
}
