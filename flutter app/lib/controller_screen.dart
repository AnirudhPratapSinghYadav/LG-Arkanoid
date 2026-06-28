import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'game_service.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  double _smoothedPaddleX = 4800;

  double _applyTouchCurve(double localDx, double stripWidth) {
    const maxX = 9600.0;
    final raw = (localDx / stripWidth) * maxX;
    if (raw <= 0) return 0;
    if (raw >= maxX) return maxX;
    return maxX * pow(raw / maxX, 1.5);
  }

  void _showPowerUpDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Activate Power Up'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _powerUpButton('Wide Paddle', 'wide_paddle'),
            _powerUpButton('Slow Ball', 'slow_ball'),
            _powerUpButton('Multi Ball', 'multi_ball'),
            _powerUpButton('Bomb', 'bomb'),
          ],
        ),
      ),
    );
  }

  Widget _powerUpButton(String label, String type) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ElevatedButton(
        onPressed: () {
          context.read<GameService>().activatePowerUp(type);
          Navigator.pop(context);
        },
        child: Text(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<GameService>(
      builder: (context, service, _) {
        return Scaffold(
          appBar: AppBar(
            title: Text(
              service.playerNumber != null
                  ? 'Player ${service.playerNumber} (${service.playerId ?? "joining..."})'
                  : 'LG Arkanoid Controller',
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: service.connected ? Colors.green : Colors.red,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      service.connected ? 'Connected' : 'Disconnected',
                      style: TextStyle(
                        color: service.connected ? Colors.green : Colors.red,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.dashboard),
                onPressed: () => Navigator.pushNamed(context, '/status'),
              ),
            ],
          ),
          body: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Text(
                      'Score: ${service.score}',
                      style:
                          const TextStyle(fontSize: 22, color: Colors.teal),
                    ),
                    Text(
                      'Lives: ${service.lives}',
                      style:
                          const TextStyle(fontSize: 22, color: Colors.white),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      onHorizontalDragUpdate: (details) {
                        final curved = _applyTouchCurve(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        _smoothedPaddleX = curved;
                        service.sendPaddleMove(_smoothedPaddleX);
                      },
                      onTapDown: (details) {
                        final curved = _applyTouchCurve(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        _smoothedPaddleX = curved;
                        service.sendPaddleMove(_smoothedPaddleX);
                      },
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade900,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: Colors.teal.withOpacity(0.4)),
                        ),
                        child: const Center(
                          child: Text(
                            'Drag horizontally to move paddle',
                            style: TextStyle(color: Colors.white54),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal.shade800),
                        onPressed: () => service.startGame(),
                        child: const Text('Start Game',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _showPowerUpDialog,
                        child: const Text('Power Up'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () =>
                            service.activatePowerUp('multi_ball'),
                        child: const Text('Fire Ball'),
                      ),
                    ),
                  ],
                ),
              ),
              if (service.lastCommentary.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(
                      bottom: 16, left: 16, right: 16),
                  child: Text(
                    service.lastCommentarySource == 'fallback'
                        ? '${service.lastCommentary} (offline)'
                        : service.lastCommentary,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.white70, fontSize: 14),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
