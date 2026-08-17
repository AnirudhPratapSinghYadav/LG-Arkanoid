import 'dart:async';
import 'package:flutter/material.dart';
import '../utils/app_fonts.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/gameservice.dart';
import '../utils/constants.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/mission_background.dart';

class ConnectingScreen extends StatefulWidget {
  const ConnectingScreen({super.key});

  @override
  State<ConnectingScreen> createState() => _ConnectingScreenState();
}

class _ConnectingScreenState extends State<ConnectingScreen> {
  late GameService _gameService;
  int _currentStepIndex = 0;
  String? _errorMessage;
  Timer? _timeoutTimer;

  final List<String> _stages = [
    'Checking server…',
    'Connecting…',
    'Joining lobby…',
    'Ready',
  ];

  @override
  void initState() {
    super.initState();
    _gameService = context.read<GameService>();
    _gameService.addListener(_onServiceUpdate);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startConnecting();
    });
  }

  @override
  void dispose() {
    _gameService.removeListener(_onServiceUpdate);
    _timeoutTimer?.cancel();
    super.dispose();
  }

  void _onServiceUpdate() {
    if (!mounted) return;

    if (_gameService.isJoinConfirmed && _currentStepIndex < 3) {
      _timeoutTimer?.cancel();

      if (_gameService.isSpectator) {
        setState(() {
          _errorMessage = 'Lobby is full. Try again when a slot opens.';
        });
        _gameService.disconnect();
        return;
      }

      _proceedToStep(3);
      final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
      const storage = FlutterSecureStorage();
      storage.write(key: prefServerAddress, value: args['ip']);
      storage.write(key: prefServerPort, value: args['port']);
      storage.write(key: prefSessionToken, value: args['token']);
      SharedPreferences.getInstance().then((prefs) {
        final name = args['name'] as String?;
        if (name != null && name.isNotEmpty) {
          prefs.setString(prefPlayerName, name);
        }
      });

      if (mounted) {
        Navigator.pushReplacementNamed(context, '/lobby');
      }
    } else if (_gameService.joinError != null) {
      _timeoutTimer?.cancel();
      setState(() {
        _errorMessage = _gameService.joinError;
      });
    }
  }

  void _proceedToStep(int stepIndex) {
    if (mounted && stepIndex > _currentStepIndex) {
      setState(() {
        _currentStepIndex = stepIndex;
      });
    }
  }

  Future<void> _startConnecting() async {
    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>?;
    if (args == null) {
      setState(() {
        _errorMessage = 'Invalid navigation arguments';
      });
      return;
    }

    final ip = args['ip'] as String;
    final port = args['port'] as String;
    final token = args['token'] as String;
    final name = args['name'] as String;

    setState(() {
      _currentStepIndex = 0; // Searching for Session...
      _errorMessage = null;
    });

    final ok = await _gameService.connect(ip, port);
    if (!ok) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to reach the rig. Verify host configuration.';
        });
      }
      return;
    }

    _proceedToStep(1);
    _proceedToStep(2);
    _gameService.joinGame(token, name);

    _timeoutTimer = Timer(const Duration(seconds: 6), () {
      if (mounted && !_gameService.isJoinConfirmed) {
        setState(() {
          _errorMessage = 'Rig connection timed out. Please try again.';
        });
        _gameService.disconnect();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: _errorMessage != null ? _buildErrorState() : _buildProgressState(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(
          child: SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 4,
              color: accentPrimary,
            ),
          ),
        ),
        const SizedBox(height: 48),

        LgPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'JOINING SESSION',
                style: AppFonts.spaceGrotesk(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: textSecondary,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: borderLight),
              const SizedBox(height: 12),
              for (int i = 0; i < _stages.length; i++) ...[
                _buildStageRow(i),
                if (i < _stages.length - 1) const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStageRow(int index) {
    final bool isCompleted = index < _currentStepIndex;
    final bool isActive = index == _currentStepIndex;
    
    Color textColor = textSecondary.withOpacity(0.3);
    Widget icon = Text('[ ]', style: AppFonts.jetBrainsMono(color: textColor));

    if (isCompleted) {
      textColor = accentSuccess;
      icon = const Icon(Icons.check_circle_outline_rounded, color: accentSuccess, size: 16);
    } else if (isActive) {
      textColor = textPrimary;
      icon = const SizedBox(
        width: 12,
        height: 12,
        child: CircularProgressIndicator(strokeWidth: 2, color: accentPrimary),
      );
    }

    return Row(
      children: [
        SizedBox(width: 24, child: Center(child: icon)),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            _stages[index],
            style: AppFonts.jetBrainsMono(
              fontSize: 13,
              color: textColor,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LgPanel(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: accentError,
                  size: 48,
                ),
                const SizedBox(height: 16),
                Text(
                  'Connection Failed',
                  style: AppFonts.spaceGrotesk(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _errorMessage ?? 'An unknown connection error occurred.',
                  style: AppFonts.inter(
                    fontSize: 13,
                    color: textSecondary,
                    height: 1.4,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 36),
        LgButton(
          label: 'RETRY CONNECTION',
          onPressed: _startConnecting,
          isPrimary: true,
        ),
        const SizedBox(height: 14),
        LgButton(
          label: 'EDIT INFO',
          onPressed: () {
            Navigator.pop(context); // Go back to name entry
          },
          isPrimary: false,
        ),
      ],
    );
  }
}
