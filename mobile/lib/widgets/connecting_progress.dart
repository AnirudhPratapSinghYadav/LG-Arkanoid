import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import '../utils/constants.dart';
import '../utils/join_copy.dart';
import 'lgbutton.dart';
import 'lgpanel.dart';

class ConnectingProgress extends StatelessWidget {
  final String ip;
  final String port;
  final String token;
  final String name;
  final int step;
  final String? hint;
  final List<String> labels;
  final VoidCallback? onCancel;

  const ConnectingProgress({
    super.key,
    required this.ip,
    required this.port,
    required this.token,
    required this.name,
    required this.step,
    required this.labels,
    this.hint,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'JOINING THE WALL',
          textAlign: TextAlign.center,
          style: AppFonts.spaceGrotesk(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          sameWifiHint(),
          textAlign: TextAlign.center,
          style: AppFonts.inter(fontSize: 13, color: textSecondary, height: 1.4),
        ),
        const SizedBox(height: 20),
        LgPanel(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _kv('Wall', joinTargetLabel(ip, port)),
              const SizedBox(height: 8),
              _kv('Check', healthUrl(ip, port)),
              const SizedBox(height: 8),
              _kv('Code', token.isEmpty ? '—' : token),
              const SizedBox(height: 8),
              _kv('You', name.isEmpty ? '—' : name),
            ],
          ),
        ),
        if (hint != null && hint!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            hint!,
            textAlign: TextAlign.center,
            style: AppFonts.inter(fontSize: 12, color: accentWarning, height: 1.4),
          ),
        ],
        const SizedBox(height: 16),
        LgPanel(
          child: Column(
            children: [
              for (int i = 0; i < labels.length; i++) ...[
                _stepRow(i),
                if (i < labels.length - 1) const SizedBox(height: 10),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'If this hangs: look at the CENTER screen. The four letters there must match Code above.',
          textAlign: TextAlign.center,
          style: AppFonts.inter(fontSize: 12, color: textSecondary, height: 1.4),
        ),
        if (onCancel != null) ...[
          const SizedBox(height: 20),
          LgButton(label: 'CANCEL', onPressed: onCancel, isPrimary: false),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 52,
          child: Text(
            k,
            style: AppFonts.spaceGrotesk(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: textSecondary,
            ),
          ),
        ),
        Expanded(
          child: Text(
            v,
            style: AppFonts.jetBrainsMono(fontSize: 13, color: textPrimary),
          ),
        ),
      ],
    );
  }

  Widget _stepRow(int index) {
    final done = index < step;
    final active = index == step;
    final color = done
        ? accentSuccess
        : (active ? textPrimary : textSecondary.withOpacity(0.35));
    return Row(
      children: [
        SizedBox(
          width: 22,
          child: done
              ? const Icon(Icons.check_circle_outline, color: accentSuccess, size: 18)
              : active
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: accentPrimary,
                      ),
                    )
                  : Text('·', style: AppFonts.jetBrainsMono(color: color)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            labels[index],
            style: AppFonts.inter(
              fontSize: 14,
              color: color,
              fontWeight: active ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }
}
