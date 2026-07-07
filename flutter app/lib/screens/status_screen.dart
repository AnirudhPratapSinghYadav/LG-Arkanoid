import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_service.dart';
import '../utils/constants.dart';

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final state = service.latestGameState;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A1A),
        title: const Text('Debug'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildCard(
              'Connection',
              [
                _buildRow('Status',
                    service.connected ? 'CONNECTED' : 'DISCONNECTED',
                    color: service.connected ? Colors.green : Colors.red),
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
                'Game State',
                [
                  _buildRow('Status', state['status'] ?? 'Unknown'),
                  _buildRow(
                      'Screen Width', '${state['rigVirtualWidth'] ?? 0}'),
                  const SizedBox(height: 8),
                  const Text('Balls',
                      style: TextStyle(
                          color: Colors.teal, fontWeight: FontWeight.bold)),
                  ...?((state['balls'] as List<dynamic>?)?.map((b) =>
                      _buildRow(
                        'Ball ${b['id']?.toString().substring(0, 4)}',
                        'x: ${b['x']?.round()}, y: ${b['y']?.round()}',
                      ))),
                ],
              ),
            const SizedBox(height: 16),
            _buildCard(
              'Last Commentary',
              [
                Text(
                  service.lastCommentary.isEmpty
                      ? 'No commentary yet'
                      : service.lastCommentary,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 8),
                Text(
                  'Source: ${service.lastCommentarySource}',
                  style:
                      const TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
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
          Text(label, style: const TextStyle(color: Colors.white54)),
          Text(
            value,
            style: TextStyle(
              color: color ?? Colors.white,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
