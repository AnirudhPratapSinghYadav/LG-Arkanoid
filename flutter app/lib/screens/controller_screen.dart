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

  void _onPanUpdate(DragUpdateDetails details) {
    final screenWidth = MediaQuery.of(context).size.width;
    final dx = details.delta.dx;
    final speed = maxVirtualX / screenWidth;

    setState(() {
      _paddleX += dx * speed;
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
        backgroundColor: const Color(0xFF0A0A1A),
        title: Text(
          'Player ${service.playerNumber ?? "?"}',
          style: const TextStyle(fontSize: 16),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ConnectionStatus(isConnected: service.connected),
          ),
          ListenableBuilder(
            listenable: TTSService(),
            builder: (context, _) {
              return IconButton(
                icon: Icon(
                  TTSService().isMuted ? Icons.volume_off : Icons.volume_up,
                ),
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
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStat('Score', '${service.score}'),
                  _buildStat('Lives', '${service.lives}'),
                ],
              ),
            ),
            if (service.lastCommentary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    service.lastCommentary,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  ElevatedButton(
                    onPressed: () => service.startGame(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 14,
                      ),
                    ),
                    child: const Text('Start Game'),
                  ),
                  ElevatedButton(
                    onPressed: () => showPowerUpDialog(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange.shade800,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 14,
                      ),
                    ),
                    child: const Text('Power Ups'),
                  ),
                ],
              ),
            ),
            const Spacer(),
            GestureDetector(
              onPanUpdate: _onPanUpdate,
              child: Container(
                margin: const EdgeInsets.all(16),
                height: 140,
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.touch_app, size: 40, color: Colors.white24),
                      SizedBox(height: 8),
                      Text(
                        'Slide to move paddle',
                        style: TextStyle(
                          color: Colors.white24,
                          fontSize: 14,
                        ),
                      ),
                    ],
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

  Widget _buildStat(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
