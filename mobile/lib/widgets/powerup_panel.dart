import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';

class PowerupPanel extends StatefulWidget {
  const PowerupPanel({super.key});

  @override
  State<PowerupPanel> createState() => _PowerupPanelState();
}

class _PowerupPanelState extends State<PowerupPanel> {
  DateTime? _lastPowerUpTime;
  static const _powerUpCooldown = Duration(seconds: 5);

  bool get _canUsePowerUp {
    if (_lastPowerUpTime == null) return true;
    return DateTime.now().difference(_lastPowerUpTime!) >= _powerUpCooldown;
  }

  void _activatePowerUp(String type) {
    if (!_canUsePowerUp) {
      HapticFeedback.lightImpact();
      return;
    }
    HapticFeedback.heavyImpact();
    context.read<GameService>().activatePowerUp(type);
    setState(() {
      _lastPowerUpTime = DateTime.now();
    });
  }

  Widget _buildPowerUpButton({
    required IconData icon,
    required String label,
    required Color color,
    required String type,
  }) {
    final canUse = _canUsePowerUp;

    return Expanded(
      child: GestureDetector(
        onTap: () => _activatePowerUp(type),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: canUse
                ? color.withOpacity(0.12)
                : cardFill.withOpacity(0.5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: canUse ? color.withOpacity(0.5) : borderLight,
              width: 1.5,
            ),
            boxShadow: canUse
                ? [
                    BoxShadow(
                      color: color.withOpacity(0.2),
                      blurRadius: 8,
                      spreadRadius: -2,
                    )
                  ]
                : [],
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: canUse ? color : textSecondary.withOpacity(0.3),
                size: 24,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: canUse ? color : textSecondary.withOpacity(0.3),
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _buildPowerUpButton(
            icon: Icons.swap_horiz_rounded,
            label: 'WIDE',
            color: const Color(0xFF4CAF50),
            type: 'wide_paddle',
          ),
          const SizedBox(width: 8),
          _buildPowerUpButton(
            icon: Icons.speed_rounded,
            label: 'SLOW',
            color: const Color(0xFF2196F3),
            type: 'slow_ball',
          ),
          const SizedBox(width: 8),
          _buildPowerUpButton(
            icon: Icons.control_point_duplicate_rounded,
            label: 'MULTI',
            color: const Color(0xFFFFB800),
            type: 'multi_ball',
          ),
          const SizedBox(width: 8),
          _buildPowerUpButton(
            icon: Icons.local_fire_department_rounded,
            label: 'BOMB',
            color: const Color(0xFFD9534F),
            type: 'bomb',
          ),
        ],
      ),
    );
  }
}
