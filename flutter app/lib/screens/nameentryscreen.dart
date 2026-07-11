import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/lgpanel.dart';
import '../widgets/lgbutton.dart';
import '../widgets/lgtextfield.dart';
import '../widgets/mission_background.dart';

class NameEntryScreen extends StatefulWidget {
  const NameEntryScreen({super.key});

  @override
  State<NameEntryScreen> createState() => _NameEntryScreenState();
}

class _NameEntryScreenState extends State<NameEntryScreen> with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  bool _isConnecting = false;
  String? _errorMessage;
  
  late AnimationController _loadingController;
  late GameService _gameService;

  @override
  void initState() {
    super.initState();
    _loadingController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    _gameService = context.read<GameService>();
    _gameService.addListener(_onServiceUpdate);
  }

  @override
  void dispose() {
    _gameService.removeListener(_onServiceUpdate);
    _loadingController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _onServiceUpdate() {
    if (!mounted || !_isConnecting) return;

    if (_gameService.isJoinConfirmed) {
      setState(() {
        _isConnecting = false;
      });
      const storage = FlutterSecureStorage();
      final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
      storage.write(key: prefServerAddress, value: args['ip']);
      storage.write(key: prefServerPort, value: args['port']);
      storage.write(key: prefSessionToken, value: args['token']);

      Navigator.pushReplacementNamed(context, '/lobby');
    } else if (_gameService.joinError != null) {
      setState(() {
        _isConnecting = false;
        _errorMessage = _gameService.joinError;
      });
    }
  }

  Future<void> _onJoin() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your name')),
      );
      return;
    }

    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>?;
    if (args == null) return;

    setState(() {
      _isConnecting = true;
      _errorMessage = null;
    });

    final ip = args['ip'] as String;
    final port = args['port'] as String;
    final token = args['token'] as String;

    final ok = await _gameService.connect(ip, port);
    if (!ok) {
      if (mounted) {
        setState(() {
          _isConnecting = false;
          _errorMessage = 'Failed to connect to server. Check IP and port.';
        });
      }
      return;
    }

    _gameService.joinGame(token, name);

    Future.delayed(const Duration(seconds: 5), () {
      if (mounted && _isConnecting) {
        setState(() {
          _isConnecting = false;
          _errorMessage = 'Join request timed out. Please try again.';
        });
        _gameService.disconnect();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>? ?? {};

    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: accentPrimary),
      ),
      body: MissionControlBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: _isConnecting
                    ? _buildConnectingState()
                    : _errorMessage != null
                        ? _buildErrorState()
                        : _buildNameInputState(args),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNameInputState(Map<String, dynamic> args) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'YOUR NAME',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter a display name to join the match',
          style: GoogleFonts.inter(
            fontSize: 14,
            color: textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 36),
        LgPanel(
          child: LgTextField(
            controller: _nameController,
            label: 'PLAYER NAME',
            maxLength: 12,
            keyboardType: TextInputType.name,
          ),
        ),
        const SizedBox(height: 48),
        LgButton(
          label: 'JOIN MATCH',
          onPressed: _onJoin,
        ),
      ],
    );
  }

  Widget _buildConnectingState() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        RotationTransition(
          turns: _loadingController,
          child: const SizedBox(
            width: 60,
            height: 60,
            child: CircularProgressIndicator(
              strokeWidth: 6,
              color: accentPrimary,
            ),
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'CONNECTING...',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 18,
            color: accentPrimary,
            fontWeight: FontWeight.bold,
            letterSpacing: 2,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(
          Icons.error_outline_rounded,
          color: accentError,
          size: 64,
        ),
        const SizedBox(height: 24),
        Text(
          'CONNECTION ERROR',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          _errorMessage ?? 'Unknown error occurred.',
          style: GoogleFonts.inter(
            fontSize: 14,
            color: textSecondary,
            height: 1.4,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 48),
        LgButton(
          label: 'TRY AGAIN',
          onPressed: () {
            setState(() {
              _errorMessage = null;
            });
          },
        ),
      ],
    );
  }
}
