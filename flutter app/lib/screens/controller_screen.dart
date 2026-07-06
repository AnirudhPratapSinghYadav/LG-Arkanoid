import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_service.dart';
import '../widgets/connection_status.dart';
import '../widgets/power_up_dialog.dart';
import '../utils/constants.dart';
import '../services/tts_service.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  double _paddleX = maxVirtualX / 2;

  void _onPanUpdate(DragUpdateDetails details, BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final dx = details.delta.dx;
    final speedMultiplier = maxVirtualX / screenWidth;
    
    setState(() {
      _paddleX += dx * speedMultiplier;
      if (_paddleX < 0) _paddleX = 0;
      if (_paddleX > maxVirtualX) _paddleX = maxVirtualX;
    });
    
    context.read<GameService>().sendPaddleMove(_paddleX);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'PLAYER ${service.playerNumber ?? "?"}',
          style: const TextStyle(letterSpacing: 2),
        ),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ConnectionStatus(isConnected: service.connected),
            ),
          ),
          ListenableBuilder(
            listenable: TTSService(),
            builder: (context, _) {
              return IconButton(
                icon: Icon(TTSService().isMuted ? Icons.volume_off : Icons.volume_up),
                onPressed: () => TTSService().toggleMute(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _ScoreBox(label: 'SCORE', value: '${service.score}'),
                  _ScoreBox(label: 'LIVES', value: '${service.lives}'),
                ],
              ),
            ),
            if (service.lastCommentary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.teal.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.teal.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        service.lastCommentarySource == 'ai'
                            ? Icons.smart_toy
                            : Icons.chat_bubble_outline,
                        color: Colors.tealAccent,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          service.lastCommentary,
                          style: const TextStyle(
                            color: Colors.white,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton.icon(
                  onPressed: () => service.startGame(),
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('START GAME'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 16),
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: () => showPowerUpDialog(context),
                  icon: const Icon(Icons.bolt),
                  label: const Text('POWER UPS'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 16),
                  ),
                ),
              ],
            ),
            const Spacer(),
            Container(
              margin: const EdgeInsets.all(16),
              height: 150,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: GestureDetector(
                onPanUpdate: (d) => _onPanUpdate(d, context),
                child: Container(
                  color: Colors.transparent,
                  width: double.infinity,
                  height: double.infinity,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.touch_app,
                          size: 48,
                          color: Colors.teal.withOpacity(0.3),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'SLIDE TO MOVE',
                          style: TextStyle(
                            color: Colors.teal.withOpacity(0.5),
                            letterSpacing: 4,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _ScoreBox extends StatelessWidget {
  final String label;
  final String value;

  const _ScoreBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.5),
            fontSize: 12,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}
