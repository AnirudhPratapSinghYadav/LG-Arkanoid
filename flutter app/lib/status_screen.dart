import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'game_service.dart';

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<GameService>(
      builder: (context, service, _) {
        final players =
            service.latestGameState?['players'] as List<dynamic>? ?? [];
        final cardColors = [Colors.red, Colors.green, Colors.blue];

        return Scaffold(
          appBar: AppBar(title: const Text('Game Status')),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: List.generate(3, (index) {
                    Map<String, dynamic> pdata = {};
                    if (index < players.length) {
                      pdata = Map<String, dynamic>.from(
                          players[index] as Map);
                    }
                    final score = pdata['score'] as int? ?? 0;
                    final lives = pdata['lives'] as int? ?? 0;
                    final connected = pdata['connected'] as bool? ?? false;

                    return Expanded(
                      child: Card(
                        color: Colors.grey.shade900,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Text(
                                'P${index + 1}',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: cardColors[index],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                '$score',
                                style: TextStyle(
                                  fontSize: 32,
                                  color: cardColors[index],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(
                                  lives.clamp(0, 5),
                                  (_) => Icon(Icons.favorite,
                                      color: cardColors[index], size: 18),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                connected ? 'Connected' : 'Waiting',
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.white54),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade900,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: service.lastCommentarySource == 'gemini'
                            ? Colors.teal
                            : Colors.grey,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Commentary',
                          style: TextStyle(
                            color: service.lastCommentarySource == 'gemini'
                                ? Colors.teal
                                : Colors.grey,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Expanded(
                          child: SingleChildScrollView(
                            child: Text(
                              service.lastCommentary.isEmpty
                                  ? 'Waiting for commentary...'
                                  : service.lastCommentarySource == 'fallback'
                                      ? '${service.lastCommentary} (offline)'
                                      : service.lastCommentary,
                              style: const TextStyle(
                                  fontSize: 18, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
