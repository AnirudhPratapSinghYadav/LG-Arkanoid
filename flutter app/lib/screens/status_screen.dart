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
        title: const Text('DEBUG / STATUS', style: TextStyle(letterSpacing: 4)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildSection(
              'Connection',
              [
                _buildRow('Status', service.connected ? 'CONNECTED' : 'DISCONNECTED', 
                    color: service.connected ? Colors.green : Colors.red),
                _buildRow('Server', '${service.serverAddress}:${service.serverPort}'),
                _buildRow('Player ID', service.playerId ?? 'None'),
                _buildRow('Player Num', '${service.playerNumber ?? "None"}'),
                _buildRow('Session', service.sessionId ?? 'None'),
              ],
            ),
            const SizedBox(height: 24),
            if (state != null)
              _buildSection(
                'Game State',
                [
                  _buildRow('Status', state['status'] ?? 'Unknown'),
                  _buildRow('Screen Bound', '${state['rigVirtualWidth'] ?? 0}'),
                  const SizedBox(height: 8),
                  const Text('BALLS', style: TextStyle(color: Colors.teal, fontWeight: FontWeight.bold)),
                  ...?((state['balls'] as List<dynamic>?)?.map((b) => _buildRow(
                        'Ball ${b['id']?.toString().substring(0, 4)}',
                        'x: ${b['x']?.round()}, y: ${b['y']?.round()}',
                      ))),
                ],
              ),
            const SizedBox(height: 24),
            _buildSection(
              'Last AI Commentary',
              [
                Text(
                  service.lastCommentary.isEmpty ? 'No commentary yet.' : service.lastCommentary,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 8),
                Text(
                  'Source: ${service.lastCommentarySource}',
                  style: TextStyle(color: Colors.teal.withOpacity(0.5), fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
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
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.white.withOpacity(0.5))),
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
