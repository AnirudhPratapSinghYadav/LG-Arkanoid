import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../widgets/connectionstatus.dart';
import '../widgets/powerupdialog.dart';
import '../utils/constants.dart';
import '../services/ttsservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import 'dart:math';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState()=>_ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
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

  void _onPanUpdate(DragUpdateDetails details){
    final screenWidth = MediaQuery.of(context).size.width;
    final dx = details.delta.dx;
    final speed = maxVirtualX/screenWidth;
    final deltaX = dx * speed * 2.0; // Boosted sensitivity for large slider

    context.read<GameService>().sendPaddleMove(deltaX);

    setState((){
      _puckPosition += dx;
      double maxVisual = (screenWidth - 32) / 2 - 40; 
      if(_puckPosition > maxVisual) _puckPosition = maxVisual;
      if(_puckPosition < -maxVisual) _puckPosition = -maxVisual;
    });
  }

  void _onPanEnd(DragEndDetails details){
    setState((){
      _puckPosition = 0;
    });
  }

  String _formatTime(int seconds) {
    if (seconds <= 0) return "00:00";
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context){
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;
    final isPlaying = gameState != null && gameState['gameStatus'] == 'playing';
    final timeLeft = gameState != null ? (gameState['timeLeft'] as int? ?? 0) : 0;

    return Scaffold(
      backgroundColor: bgDark,
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('PLAYER ${service.playerNumber ?? "?"}', style: GoogleFonts.inter(fontSize: 12, color: textSecondary)),
                      Row(
                        children: [
                          Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: service.connected ? accentSuccess : accentError)),
                          const SizedBox(width: 6),
                          Text(service.connected ? 'ONLINE' : 'OFFLINE', style: GoogleFonts.inter(fontSize: 14, color: textPrimary, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      ListenableBuilder(
                        listenable: TTSService(),
                        builder: (context, _) => IconButton(
                          icon: Icon(TTSService().isMuted ? Icons.volume_off : Icons.volume_up, color: accentPrimary),
                          onPressed: () => TTSService().toggleMute(),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.settings, color: accentPrimary),
                        onPressed: ()=>Navigator.pushNamed(context, '/settings'),
                      ),
                    ],
                  )
                ],
              ),
            ),
            
            // HUD Dashboard
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: cardFill, borderRadius: BorderRadius.circular(12), border: Border.all(color: borderLight)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('LIVES', style: GoogleFonts.inter(fontSize: 10, color: textSecondary)),
                          const SizedBox(height: 4),
                          Row(
                            children: List.generate(3, (index) => Icon(
                              index < service.lives ? Icons.favorite : Icons.favorite_border,
                              color: accentError,
                              size: 16,
                            )),
                          ),
                          const SizedBox(height: 12),
                          Text('SCORE', style: GoogleFonts.inter(fontSize: 10, color: textSecondary)),
                          Text('${service.score}', style: GoogleFonts.spaceGrotesk(fontSize: 20, color: accentPrimary, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: cardFill, borderRadius: BorderRadius.circular(12), border: Border.all(color: borderLight)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text('TIME', style: GoogleFonts.inter(fontSize: 10, color: textSecondary)),
                          const SizedBox(height: 4),
                          Text(_formatTime(timeLeft), style: GoogleFonts.spaceGrotesk(fontSize: 28, color: textPrimary, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (service.lastCommentary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: cardFill, borderRadius: BorderRadius.circular(8), border: Border.all(color: accentPrimary.withOpacity(0.3))),
                  child: Row(
                    children: [
                      const Icon(Icons.smart_toy, color: accentPrimary, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '"${service.lastCommentary}"',
                          style: GoogleFonts.inter(fontSize: 12, color: textPrimary, fontStyle: FontStyle.italic),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Pre-Game Controls
            if (!isPlaying && (service.playerNumber ?? 0) - 1 == (gameState?['masterPlayerIndex'] ?? 0))
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: cardFill,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: borderLight),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          value: _selectedDuration,
                          dropdownColor: bgDark,
                          icon: const Icon(Icons.arrow_drop_down, color: accentPrimary),
                          style: GoogleFonts.inter(color: accentPrimary, fontSize: 14),
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
                    const SizedBox(width: 12),
                    Expanded(
                      child: LgButton(
                        label: 'START GAME',
                        onPressed: () => service.startGame(_selectedDuration),
                        isPrimary: true,
                      ),
                    ),
                  ],
                ),
              ),
              
            const Spacer(),

            // Massive Touch Slider Zone
            GestureDetector(
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: Container(
                width: double.infinity,
                height: 250, // Massive touch zone
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cardFill,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: borderLight),
                  boxShadow: [
                    BoxShadow(color: bgDark, blurRadius: 20, spreadRadius: 5)
                  ]
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Horizontal Track
                    Container(
                      width: double.infinity,
                      height: 4,
                      margin: const EdgeInsets.symmetric(horizontal: 40),
                      decoration: BoxDecoration(
                        color: borderLight,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    // Directional Labels
                    Positioned(
                      left: 20,
                      child: Icon(Icons.arrow_back_ios, color: textSecondary.withOpacity(0.5), size: 16),
                    ),
                    Positioned(
                      right: 20,
                      child: Icon(Icons.arrow_forward_ios, color: textSecondary.withOpacity(0.5), size: 16),
                    ),
                    Text(
                      'SLIDE TO MOVE',
                      style: GoogleFonts.inter(fontSize: 12, color: textSecondary.withOpacity(0.5), fontWeight: FontWeight.bold, letterSpacing: 2),
                    ),
                    // The Puck
                    Transform.translate(
                      offset: Offset(_puckPosition, 0),
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: accentPrimary,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: accentPrimary.withOpacity(0.4),
                              blurRadius: 20,
                              spreadRadius: 2,
                            )
                          ],
                        ),
                        child: const Icon(Icons.drag_handle, color: bgDark, size: 32),
                      ),
                    ),
                  ],
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
