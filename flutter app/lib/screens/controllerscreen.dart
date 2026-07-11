import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/mission_background.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  double _puckPosition = 0.0;
  final double _sliderRange = 1.0; // Normalized -1.0 to 1.0

  void _onPanUpdate(DragUpdateDetails details, double screenWidth) {
    // Width of active sliding zone
    final trackWidth = screenWidth - 64 - 80; // Margin padding + Puck width
    if (trackWidth <= 0) return;

    final dx = details.delta.dx;
    // Normalized delta movement
    final normalizedDelta = (dx / (trackWidth / 2)) * _sliderRange;

    // Send paddle movement velocity/delta
    final speed = 80.0; // Base speed constant
    final deltaX = normalizedDelta * speed * 2.5; 
    context.read<GameService>().sendPaddleMove(deltaX);

    setState(() {
      _puckPosition += dx;
      double maxVisual = trackWidth / 2;
      if (_puckPosition > maxVisual) _puckPosition = maxVisual;
      if (_puckPosition < -maxVisual) _puckPosition = -maxVisual;
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _puckPosition = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final screenWidth = MediaQuery.of(context).size.width;

    // Paddle/Player Colors matching Rig Client
    final List<Color> playerColors = [
      const Color(0xFF20C5FF), // Player 1 - Cyan
      const Color(0xFFFF2D78), // Player 2 - Pink
      const Color(0xFFFFB800), // Player 3 - Gold
    ];
    final playerColor = playerColors[((service.playerNumber ?? 1) - 1) % playerColors.length];

    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: SafeArea(
          child: Column(
            children: [
              // 1. Premium Hardware Top Info Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: cardFill,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: borderLight),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Player indicator
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: playerColor,
                              boxShadow: [
                                BoxShadow(color: playerColor.withOpacity(0.4), blurRadius: 6, spreadRadius: 1)
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'P${service.playerNumber ?? 1}',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: textPrimary,
                            ),
                          ),
                        ],
                      ),
                      
                      // Rig Online indicator
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: service.connected ? accentSuccess : accentError,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            service.connected ? 'RIG ONLINE' : 'RIG OFFLINE',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: service.connected ? accentSuccess : accentError,
                            ),
                          ),
                        ],
                      ),

                      // Latency (JetBrains Mono)
                      Text(
                        'PING ${service.latencyMs} MS',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: textSecondary,
                        ),
                      ),

                      // Battery (JetBrains Mono)
                      Row(
                        children: [
                          Icon(Icons.battery_5_bar_rounded, size: 14, color: textSecondary),
                          const SizedBox(width: 2),
                          Text(
                            '88%',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // 2. Mission Assistant Commentary Panel (Center)
              if (service.lastCommentary.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: LgPanel(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.shield_outlined, color: accentPrimary, size: 20),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'MISSION CONTROL FEED',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: accentPrimary,
                                  letterSpacing: 1,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '"${service.lastCommentary}"',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: textPrimary,
                                  fontStyle: FontStyle.italic,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const Spacer(),

              // 3. Primary Control Surface - Matte Slider (Bottom)
              GestureDetector(
                onPanUpdate: (details) => _onPanUpdate(details, screenWidth),
                onPanEnd: _onPanEnd,
                child: Container(
                  width: double.infinity,
                  height: 220, // Clean, comfortable remote touch height
                  margin: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: cardFill,
                    borderRadius: BorderRadius.circular(14), // V2 Corners token
                    border: Border.all(color: borderLight),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Slider Track Guide
                      Container(
                        width: double.infinity,
                        height: 4,
                        margin: const EdgeInsets.symmetric(horizontal: 40),
                        decoration: BoxDecoration(
                          color: borderLight,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      
                      // Touch helper overlay text
                      Text(
                        'SLIDE TO CONTROL PADDLE',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 12,
                          color: textSecondary.withOpacity(0.3),
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                      
                      // Slide Puck
                      Transform.translate(
                        offset: Offset(_puckPosition, 0),
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: accentPrimary,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.drag_handle_rounded,
                            color: bgDark,
                            size: 32,
                          ),
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
      ),
    );
  }
}
