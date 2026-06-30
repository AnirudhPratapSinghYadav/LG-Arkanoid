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
  double paddleX = 4800;

  double getPaddlePos(double dx, double width) {
    double maxX = 9600.0;
    double pos = (dx / width) * maxX;

    if (pos < 0) {
      pos = 0;
    }
    if (pos > maxX) {
      pos = maxX;
    }
    return maxX * pow(pos / maxX, 1.5);
  }
  void openPowerUpMenu() {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Activate Power Up'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              powerUpBtn('Wide Paddle', 'wide_paddle'),
              powerUpBtn('Slow Ball', 'slow_ball'),
              powerUpBtn('Multi Ball', 'multi_ball'),
              powerUpBtn('Bomb', 'bomb'),
            ],),);},); }

  Widget powerUpBtn(String label, String type) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ElevatedButton(
        onPressed: () {
          context.read<GameService>().activatePowerUp(type);
          Navigator.pop(context);
        },
        child: Text(label),
      ),
    );}

  @override
  Widget build(BuildContext context) {
    return Consumer<GameService>(
      builder: (context, service, child) {
        String title = 'LG Arkanoid Controller';
        if (service.playerNumber != null) {
          title = 'Player ${service.playerNumber} (${service.playerId ?? "joining..."})';
        }

        return Scaffold(
          appBar: AppBar(
            title: Text(title),
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
                      ),),],),),
              IconButton(
                icon: const Icon(Icons.dashboard),
                onPressed: () {
                  Navigator.pushNamed(context, '/status');
                },),],),
          body: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Text(
                      'Score: ${service.score}',
                      style: const TextStyle(fontSize: 22, color: Colors.teal),
                    ),
                    Text(
                      'Lives: ${service.lives}',
                      style: const TextStyle(fontSize: 22, color: Colors.white),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return GestureDetector(
                      onHorizontalDragUpdate: (details) {
                        double newX = getPaddlePos(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        paddleX = newX;
                        service.sendPaddleMove(paddleX);
                      },
                      onTapDown: (details) {
                        double newX = getPaddlePos(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        paddleX = newX;
                        service.sendPaddleMove(paddleX);
                      },
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade900,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.teal.withOpacity(0.4)),
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
                          backgroundColor: Colors.teal.shade800,
                        ),
                        onPressed: () {
                          service.startGame();
                        },
                        child: const Text(
                          'Start Game',
                          style: TextStyle(color: Colors.white),
                        ),),),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: openPowerUpMenu,
                        child: const Text('Power Up'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          service.activatePowerUp('multi_ball');},
                        child: const Text('Fire Ball'),),),],),),
              if (service.lastCommentary.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16, left: 16, right: 16),
                  child: Text(
                    service.lastCommentarySource == 'fallback'
                        ? '${service.lastCommentary} (offline)'
                        : service.lastCommentary,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 14),),),],),);},);}}
