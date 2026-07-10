import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  State<ControllerScreen> createState()=>_ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  Timer? _moveTimer;
  bool _isButtonHeld = false;
  double _puckPosition = 0;
  int _selectedDuration = 180;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    super.dispose();
  }

  void _onPanStart(DragStartDetails details){
    if(_isButtonHeld) return;
    HapticFeedback.lightImpact();
  }

  void _onPanUpdate(DragUpdateDetails details){
    if(_isButtonHeld) return; // Prevent drag conflict
    final screenWidth = MediaQuery.of(context).size.width;
    final dx = details.delta.dx;
    final speed = maxVirtualX/screenWidth;
    final deltaX = dx*speed;

    context.read<GameService>().sendPaddleMove(deltaX);

    setState((){
      _puckPosition += dx;
      double maxVisual = (screenWidth-32-24)/2-30; // 16 padding, 12 inner padding, 30 half puck
      if(_puckPosition > maxVisual) _puckPosition = maxVisual;
      if(_puckPosition < -maxVisual) _puckPosition = -maxVisual;
    });
  }

  void _onPanEnd(DragEndDetails details){
    setState((){
      _puckPosition = 0;
    });
  }

  void _startHolding(double deltaX){
    _isButtonHeld = true;
    context.read<GameService>().sendPaddleMove(deltaX);
    _moveTimer?.cancel();
    _moveTimer = Timer.periodic(const Duration(milliseconds: 16), (_){
      if(mounted){
        context.read<GameService>().sendPaddleMove(deltaX);
      }
    });
  }

  void _stopHolding(){
    _isButtonHeld = false;
    _moveTimer?.cancel();
    _moveTimer = null;
    setState((){
      _puckPosition = 0;
    });
  }

  @override
  void dispose(){
    _moveTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context){
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
            builder: (context, _){
              return IconButton(
                icon: Icon(
                  TTSService().isMuted ? Icons.volume_off : Icons.volume_up,
                  color: accentCyan,
                ),
                onPressed: ()=>TTSService().toggleMute(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.bug_report, color: accentCyan),
            onPressed: ()=>Navigator.pushNamed(context, '/status'),
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: accentCyan),
            onPressed: ()=>Navigator.pushNamed(context, '/settings'),
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
                    _buildStat('RANK', '${service.rank}'),
                    _buildStat('SCORE', '${service.score}'),
                    _buildStat('LIVES', '${service.lives}'),
                  ],
                ),
              ),
            ),
            if(service.lastCommentary.isNotEmpty)
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
            if(service.latestGameState!=null && service.latestGameState['players']!=null)
              _buildLeaderboard(service),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if((service.playerNumber - 1) == (service.latestGameState?['masterPlayerIndex'] ?? 0)) ...[
                    if (service.latestGameState?['gameStatus'] != 'playing')
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: accentCyan.withOpacity(0.3)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _selectedDuration,
                            dropdownColor: bgColor,
                            icon: const Icon(Icons.arrow_drop_down, color: accentCyan),
                            style: const TextStyle(fontFamily: 'JetBrainsMono', color: accentCyan, fontSize: 12),
                            items: const [
                              DropdownMenuItem(value: 180, child: Text('3 Min')),
                              DropdownMenuItem(value: 300, child: Text('5 Min')),
                              DropdownMenuItem(value: 600, child: Text('10 Min')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedDuration = val);
                            },
                          ),
                        ),
                      ),
                    if (service.latestGameState?['gameStatus'] != 'playing')
                      const SizedBox(width: 8),
                    Expanded(
                      child: LgButton(
                        label: service.latestGameState?['gameStatus']=='playing' ? 'Restart Game' : 'Start Game',
                        onPressed: ()=>service.startGame(_selectedDuration),
                        accentColor: service.latestGameState?['gameStatus']=='playing' ? Colors.redAccent : accentCyan,
                      ),
                    ),
                    const SizedBox(width: 16),
                  ],
                  Expanded(
                    child: LgButton(
                      label: 'Power Ups',
                      onPressed: ()=>showPowerUpDialog(context),
                      accentColor: accentAmber,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            GestureDetector(
              onPanStart: _onPanStart,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: LgPanel(
                  accentColor: accentCyan,
                  child: SizedBox(
                    height: 120,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: double.infinity,
                          height: 2,
                          color: accentCyan.withOpacity(0.3),
                        ),
                        Transform.translate(
                          offset: Offset(_puckPosition, 0),
                          child: Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: accentCyan,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: accentCyan.withOpacity(0.5),
                                  blurRadius: 15,
                                  spreadRadius: 2,
                                )
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTapDown: (_)=>_startHolding(-25.0),
                      onTapUp: (_)=>_stopHolding(),
                      onTapCancel: ()=>_stopHolding(),
                      child: Container(
                        height: 80,
                        decoration: BoxDecoration(
                          color: bgColor,
                          border: Border.all(color: accentCyan, width: 2),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: accentCyan.withOpacity(0.2),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.chevron_left, size: 48, color: accentCyan),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: GestureDetector(
                      onTapDown: (_)=>_startHolding(25.0),
                      onTapUp: (_)=>_stopHolding(),
                      onTapCancel: ()=>_stopHolding(),
                      child: Container(
                        height: 80,
                        decoration: BoxDecoration(
                          color: bgColor,
                          border: Border.all(color: accentCyan, width: 2),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: accentCyan.withOpacity(0.2),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.chevron_right, size: 48, color: accentCyan),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value){
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

  Widget _buildLeaderboard(GameService service){
    final players = List<Map<String, dynamic>>.from(service.latestGameState['players'] ?? []);
    if(players.isEmpty) return const SizedBox.shrink();

    players.sort((a, b)=>(b['score'] as int? ?? 0).compareTo(a['score'] as int? ?? 0));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: LgPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'LIVE STANDINGS',
              style: TextStyle(
                fontFamily: 'JetBrainsMono',
                color: accentCyan,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            ...players.map((p){
              final rank = p['rank'] ?? '-';
              final name = p['name'] ?? 'Unknown';
              final score = p['score'] ?? 0;
              final isMe = p['id']==service.playerId;
              return Container(
                margin: const EdgeInsets.symmetric(vertical: 2),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isMe ? accentCyan.withOpacity(0.1) : Colors.transparent,
                  borderRadius: BorderRadius.circular(4),
                  border: isMe ? Border.all(color: accentCyan.withOpacity(0.3)) : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '#$rank $name ${isMe ? '(YOU)' : ''}',
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        color: isMe ? accentCyan : textColor,
                        fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      '$score',
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        color: isMe ? accentCyan : textColor,
                        fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }
}
