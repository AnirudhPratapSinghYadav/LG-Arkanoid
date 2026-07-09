import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_service.dart';
import '../widgets/connection_status.dart';
import '../widgets/power_up_dialog.dart';
import '../utils/constants.dart';
import '../services/tts_service.dart';
import '../widgets/lg_panel.dart';
import '../widgets/lg_button.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  void _onPanUpdate(DragUpdateDetails details) {
    final screenWidth = MediaQuery.of(context).size.width;
    final dx = details.delta.dx;
    final speed = maxVirtualX / screenWidth;
    final deltaX = dx * speed;

    context.read<GameService>().sendPaddleMove(deltaX);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        title: Text(
          'PLAYER ${service.playerNumber ?? "?"}',
          style: const TextStyle(
            fontFamily: 'VT323',
            fontSize: 24,
            color: accentCyan,
            letterSpacing: 1,
            height: 1.4,
          ),
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
                  color: accentCyan,
                ),
                onPressed: () => TTSService().toggleMute(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.bug_report, color: accentCyan),
            onPressed: () => Navigator.pushNamed(context, '/status'),
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: accentCyan),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: LgPanel(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStat('SCORE', '${service.score}'),
                    _buildStat('LIVES', '${service.lives}'),
                  ],
                ),
              ),
            ),
            if (service.lastCommentary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: LgPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        service.lastCommentary,
                        style: const TextStyle(
                          fontFamily: 'JetBrainsMono',
                          color: textColor,
                          fontStyle: FontStyle.italic,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (service.playerNumber == 1) ...[
                    Expanded(
                      child: LgButton(
                        label: 'Start Game',
                        onPressed: () => service.startGame(),
                        accentColor: accentCyan,
                      ),
                    ),
                    const SizedBox(width: 16),
                  ],
                  Expanded(
                    child: LgButton(
                      label: 'Power Ups',
                      onPressed: () => showPowerUpDialog(context),
                      accentColor: accentAmber,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            GestureDetector(
              onPanUpdate: _onPanUpdate,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: LgPanel(
                  accentColor: accentCyan,
                  child: const SizedBox(
                    height: 120,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.touch_app, size: 32, color: accentCyan),
                          SizedBox(height: 8),
                          Text(
                            'SLIDE TO MOVE PADDLE',
                            style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              color: accentCyan,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
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

  Widget _buildStat(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'JetBrainsMono',
            color: textColor,
            fontSize: 10,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontFamily: 'PressStart2P',
            color: accentCyan,
            fontSize: 20,
          ),
        ),
      ],
    );
  }
}
