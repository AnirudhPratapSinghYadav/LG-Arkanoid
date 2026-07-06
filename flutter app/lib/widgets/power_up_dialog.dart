import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_service.dart';

void showPowerUpDialog(BuildContext context) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Activate Power Up'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _powerUpButton(context, 'Wide Paddle', 'wide_paddle'),
          _powerUpButton(context, 'Slow Ball', 'slow_ball'),
          _powerUpButton(context, 'Multi Ball', 'multi_ball'),
          _powerUpButton(context, 'Bomb', 'bomb'),
        ],
      ),
    ),
  );
}

Widget _powerUpButton(BuildContext context, String label, String type) {
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
