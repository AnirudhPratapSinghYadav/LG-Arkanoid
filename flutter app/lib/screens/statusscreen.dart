import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final state = service.latestGameState;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        title: const Text(
          'DEBUG STATUS',
          style: TextStyle(
            fontFamily: 'VT323',
            fontSize: 24,
            color: accentCyan,
            letterSpacing: 1,
            height: 1.4,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildCard(
              'CONNECTION',
              [
                _buildRow('Status',
                    service.connected ? 'CONNECTED' : 'DISCONNECTED',
                    color: service.connected ? accentCyan : accentMagenta),
                _buildRow('Server',
                    '${service.serverAddress}:${service.serverPort}'),
                _buildRow('Player ID', service.playerId ?? 'None'),
                _buildRow(
                    'Player Num', '${service.playerNumber ?? "None"}'),
                _buildRow('Session', service.sessionId ?? 'None'),
              ],
            ),
            const SizedBox(height: 16),
            if (state != null)
              _buildCard(
                'GAME STATE',
                [
                  _buildRow('Status', state['status'] ?? 'Unknown'),
                  _buildRow(
                      'Screen Width', '${state['rigVirtualWidth'] ?? 0}'),
                  const SizedBox(height: 8),
                  const Text('BALLS',
                      style: TextStyle(
                          fontFamily: 'JetBrainsMono',
                          color: accentCyan,
                          fontWeight: FontWeight.bold)),
                  ...?((state['balls'] as List<dynamic>?)?.map((b) =>
                      _buildRow(
                        'Ball ${b['id']?.toString().substring(0, 4)}',
                        'x: ${b['x']?.round()}, y: ${b['y']?.round()}',
                      ))),
                ],
              ),
            const SizedBox(height: 16),
            _buildCard(
              'LAST COMMENTARY',
              [
                Text(
                  service.lastCommentary.isEmpty
                      ? 'No commentary yet'
                      : service.lastCommentary,
                  style: const TextStyle(
                      fontFamily: 'JetBrainsMono', color: textColor),
                ),
                const SizedBox(height: 8),
                Text(
                  'Source: ${service.lastCommentarySource}',
                  style:
                      const TextStyle(fontFamily: 'JetBrainsMono', color: textColor, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(String title, List<Widget> children) {
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'VT323',
              color: accentCyan,
              fontSize: 24,
              letterSpacing: 1,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontFamily: 'JetBrainsMono', color: textColor, fontSize: 12)),
          Text(
            value,
            style: TextStyle(
              color: color ?? accentCyan,
              fontWeight: FontWeight.bold,
              fontFamily: 'JetBrainsMono',
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
