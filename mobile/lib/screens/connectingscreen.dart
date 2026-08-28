import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/gameservice.dart';
import '../services/health_probe.dart';
import '../utils/constants.dart';
import '../utils/join_copy.dart';
import '../utils/join_target.dart';
import '../widgets/connecting_error.dart';
import '../widgets/connecting_progress.dart';
import '../widgets/mission_background.dart';

class ConnectingScreen extends StatefulWidget {
  const ConnectingScreen({super.key});

  @override
  State<ConnectingScreen> createState() => _ConnectingScreenState();
}

class _ConnectingScreenState extends State<ConnectingScreen> {
  late GameService _gameService;
  int _step = 0;
  String? _error;
  String? _hint;
  Timer? _timeout;
  bool _cancelled = false;

  String _ip = '';
  String _port = defaultServerPort;
  String _token = '';
  String _name = '';

  static const _labels = [
    'Can we see the wall?',
    'Opening a live link…',
    'Sending your name and code…',
    'In the lobby',
  ];

  @override
  void initState() {
    super.initState();
    _gameService = context.read<GameService>();
    _gameService.addListener(_onServiceUpdate);
    WidgetsBinding.instance.addPostFrameCallback((_) => _connect());
  }

  @override
  void dispose() {
    _gameService.removeListener(_onServiceUpdate);
    _timeout?.cancel();
    super.dispose();
  }

  Map<String, dynamic> _args() {
    return ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>? ??
        {};
  }

  void _readArgs() {
    final args = _args();
    final parsed = parseJoinInput(
      '${args['ip'] ?? ''}',
      defaultPort: '${args['port'] ?? defaultServerPort}',
    );
    _ip = parsed?.ip ?? (args['ip'] as String? ?? '');
    _port = parsed?.port ?? (args['port'] as String? ?? defaultServerPort);
    _token = ((args['token'] as String?) ?? '').trim().toUpperCase();
    if (_token.isEmpty && (parsed?.token.length ?? 0) == 4) {
      _token = parsed!.token;
    }
    _name = (args['name'] as String?) ?? '';
    _hint = parsed?.hint;
  }

  void _onServiceUpdate() {
    if (!mounted || _cancelled) return;
    if (_gameService.isJoinConfirmed && _step < 3) {
      _timeout?.cancel();
      if (_gameService.isSpectator) {
        setState(() => _error = lobbyFullCopy());
        _gameService.disconnect();
        return;
      }
      _saveAndGoLobby();
      return;
    }
    if (_gameService.joinError != null) {
      _timeout?.cancel();
      setState(() => _error = joinRejectedCopy(_gameService.joinError));
    }
  }

  Future<void> _saveAndGoLobby() async {
    setState(() => _step = 3);
    const storage = FlutterSecureStorage();
    await storage.write(key: prefServerAddress, value: _ip);
    await storage.write(key: prefServerPort, value: _port);
    await storage.write(key: prefSessionToken, value: _token);
    final prefs = await SharedPreferences.getInstance();
    if (_name.isNotEmpty) await prefs.setString(prefPlayerName, _name);
    if (!mounted || _cancelled) return;
    Navigator.pushReplacementNamed(context, '/lobby');
  }

  Future<void> _connect() async {
    _timeout?.cancel();
    _cancelled = false;
    _readArgs();
    if (_ip.isEmpty || _token.length != 4 || _name.isEmpty) {
      setState(() => _error = missingJoinFieldsCopy());
      return;
    }

    final host = parseJoinInput(_ip, defaultPort: _port);
    if (host?.warning != null) {
      setState(() => _error = host!.warning);
      return;
    }
    _hint = host?.hint ?? _hint;

    setState(() {
      _step = 0;
      _error = null;
    });

    _gameService.disconnect();

    final health = await probeHealth(_ip, _port);
    if (!mounted || _cancelled) return;
    if (!health.ok) {
      setState(() {
        _error = cannotReachRig(_ip, _port, detail: health.detail);
      });
      return;
    }

    setState(() => _step = 1);
    final ok = await _gameService.connect(
      _ip,
      _port,
      timeout: const Duration(seconds: 12),
    );
    if (!mounted || _cancelled) return;
    if (!ok) {
      final detail = _gameService.lastConnectError;
      setState(() {
        _error = socketFailedCopy(
          _ip,
          _port,
          detail: detail,
        );
      });
      return;
    }

    setState(() => _step = 2);
    _gameService.joinGame(_token, _name);
    _timeout = Timer(const Duration(seconds: 12), () {
      if (!mounted || _cancelled || _gameService.isJoinConfirmed) return;
      setState(() => _error = joinTimeoutCopy(_ip, _port));
      _gameService.disconnect();
    });
  }

  void _cancelJoin() {
    _cancelled = true;
    _timeout?.cancel();
    _gameService.disconnect();
    if (!mounted) return;
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    if (_ip.isEmpty) _readArgs();
    return PopScope(
      canPop: _error != null,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _cancelJoin();
      },
      child: Scaffold(
        backgroundColor: bgDark,
        body: MissionControlBackground(
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: _error != null
                      ? ConnectingError(
                          message: _error!,
                          onRetry: _connect,
                          onChangeCode: _cancelJoin,
                          onStartOver: () {
                            _cancelled = true;
                            _timeout?.cancel();
                            _gameService.disconnect();
                            Navigator.pushNamedAndRemoveUntil(
                              context,
                              '/joinchoice',
                              (_) => false,
                            );
                          },
                        )
                      : ConnectingProgress(
                          ip: _ip,
                          port: _port,
                          token: _token,
                          name: _name,
                          step: _step,
                          labels: _labels,
                          hint: _hint,
                          onCancel: _cancelJoin,
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
