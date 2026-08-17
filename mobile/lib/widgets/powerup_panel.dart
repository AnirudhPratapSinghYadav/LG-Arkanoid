import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_fonts.dart';
import 'package:provider/provider.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';

class PowerupPanel extends StatelessWidget {
  const PowerupPanel({super.key});

  static const _defs = <String, _PowerDef>{
    'wide_paddle': _PowerDef('WIDE', Icons.swap_horiz_rounded, Color(0xFF4CAF50)),
    'slow_ball': _PowerDef('SLOW', Icons.speed_rounded, Color(0xFF2196F3)),
    'multi_ball': _PowerDef('MULTI', Icons.control_point_duplicate_rounded, Color(0xFFFFB800)),
    'bomb': _PowerDef('BOMB', Icons.local_fire_department_rounded, Color(0xFFD9534F)),
  };

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameService>();
    final inventory = _playerInventory(game);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            inventory.isEmpty
                ? 'Catch power-ups with your paddle'
                : 'Tap a power-up to activate',
            textAlign: TextAlign.center,
            style: AppFonts.spaceGrotesk(
              fontSize: 11,
              color: textSecondary,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: _defs.entries.map((entry) {
              final count = inventory.where((t) => t == entry.key).length;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: _PowerButton(
                    def: entry.value,
                    count: count,
                    onTap: count > 0
                        ? () {
                            HapticFeedback.mediumImpact();
                            context.read<GameService>().activatePowerUp(entry.key);
                          }
                        : null,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  List<String> _playerInventory(GameService game) {
    final state = game.latestGameState;
    if (state == null || game.playerId == null) return const [];
    final players = state['players'] as List<dynamic>? ?? [];
    for (final raw in players) {
      if (raw is! Map) continue;
      if (raw['id'] != game.playerId) continue;
      final inv = raw['inventory'];
      if (inv is! List) return const [];
      return inv.map((e) => e.toString()).toList();
    }
    return const [];
  }
}

class _PowerDef {
  final String label;
  final IconData icon;
  final Color color;
  const _PowerDef(this.label, this.icon, this.color);
}

class _PowerButton extends StatelessWidget {
  final _PowerDef def;
  final int count;
  final VoidCallback? onTap;

  const _PowerButton({
    required this.def,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: enabled ? def.color.withOpacity(0.15) : cardFill,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: enabled ? def.color.withOpacity(0.6) : borderLight,
          ),
        ),
        child: Column(
          children: [
            Icon(
              def.icon,
              color: enabled ? def.color : textSecondary.withOpacity(0.35),
              size: 22,
            ),
            const SizedBox(height: 4),
            Text(
              count > 0 ? '${def.label} ×$count' : def.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppFonts.spaceGrotesk(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: enabled ? def.color : textSecondary.withOpacity(0.35),
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
