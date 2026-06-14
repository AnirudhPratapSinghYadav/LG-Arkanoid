import 'dart:convert';
import 'dart:math';
import 'dart:ui'; // Added for ImageFilter.blur

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => GameService(),
      child: const LGArkanoidApp(),
    ),
  );
}

class GameService extends ChangeNotifier {
  io.Socket? socket;
  String? serverAddress;
  String? serverPort;
  String? playerId;
  int? playerNumber;
  String? sessionId;
  int score = 0;
  int lives = 3;
  String lastCommentary = '';
  String lastCommentarySource = 'fallback';
  bool connected = false;
  Map<String, dynamic>? latestGameState;

  final Random _random = Random();

  String generateNonce() {
    return List.generate(8, (_) => _random.nextInt(16).toRadixString(16)).join();
  }

  Future<bool> connect(String address, String port, {Duration timeout = const Duration(seconds: 3)}) async {
    disconnect();
    serverAddress = address;
    serverPort = port;

    try {
      final url = 'http://$address:$port';
      socket = io.io(
        url,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .enableAutoConnect()
            .build(),
      );

      socket!.onConnect((_) {
        connected = true;
        notifyListeners();
      });

      socket!.onDisconnect((_) {
        connected = false;
        notifyListeners();
      });

      socket!.on('join_confirmed', (data) {
        final map = _asMap(data);
        playerId = map['playerId'] as String?;
        playerNumber = map['playerNumber'] as int?;
        sessionId = map['sessionId'] as String?;
        notifyListeners();
      });

      socket!.on('join_rejected', (data) {
        final map = _asMap(data);
        lastCommentary = 'Join rejected: ${map['message'] ?? map['errorCode']}';
        lastCommentarySource = 'fallback';
        notifyListeners();
      });

      socket!.on('game_state', (data) {
        latestGameState = _asMap(data);
        if (playerId != null) {
          final players = latestGameState!['players'] as List<dynamic>? ?? [];
          for (final p in players) {
            final pm = _asMap(p);
            if (pm['id'] == playerId) {
              score = pm['score'] as int? ?? 0;
              lives = pm['lives'] as int? ?? 0;
              break;
            }
          }
        }
        notifyListeners();
      });

      socket!.on('commentary', (data) {
        final map = _asMap(data);
        lastCommentary = map['text'] as String? ?? '';
        lastCommentarySource = map['source'] as String? ?? 'fallback';
        notifyListeners();
      });

      socket!.connect();

      final start = DateTime.now();
      while (DateTime.now().difference(start) < timeout) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (connected) {
          return true;
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  void joinGame(String sessionToken) {
    socket?.emit('player_join', {'sessionToken': sessionToken});
  }

  void sendPaddleMove(double paddleVirtualX) {
    if (socket == null || !connected || playerId == null) return;
    socket!.emit('paddle_move', {
      'playerId': playerId,
      'x': paddleVirtualX.round(),
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void activatePowerUp(String powerUpType) {
    if (socket == null || !connected || playerId == null) return;
    socket!.emit('power_up_activate', {
      'playerId': playerId,
      'powerUpType': powerUpType,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'nonce': generateNonce(),
    });
  }

  void startGame() {
    if (socket == null || !connected) return;
    socket!.emit('start_game');
  }

  void disconnect() {
    socket?.dispose();
    socket = null;
    connected = false;
    notifyListeners();
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}

class LGArkanoidApp extends StatelessWidget {
  const LGArkanoidApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LG Arkanoid',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.dark(
          primary: Colors.teal,
          secondary: Colors.tealAccent,
          surface: const Color(0xFF121212),
        ),
        scaffoldBackgroundColor: const Color(0xFF0a0a0a),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/connect': (context) => const ConnectScreen(),
        '/controller': (context) => const ControllerScreen(),
        '/status': (context) => const StatusScreen(),
      },
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _glowAnimation;
  late Animation<double> _bounceAnimation;
  late Animation<double> _progressAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );

    _glowAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.6), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.6, end: 1.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _animController, curve: Curves.easeInOut));

    _bounceAnimation = Tween<double>(begin: -150.0, end: 150.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.bounceOut),
    );

    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.linear),
    );

    _animController.forward();
    _bootstrap();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final savedAddress = prefs.getString('last_server_address');
    final savedPort = prefs.getString('last_server_port') ?? '8080';
    final savedToken = prefs.getString('last_session_token');

    bool connectSuccess = false;

    if (savedAddress != null && savedAddress.isNotEmpty && mounted) {
      final service = context.read<GameService>();
      connectSuccess = await service.connect(savedAddress, savedPort);
      if (connectSuccess && mounted && savedToken != null && savedToken.isNotEmpty) {
        service.joinGame(savedToken);
      }
    }

    await Future.delayed(const Duration(seconds: 4));

    if (mounted) {
      if (connectSuccess) {
        Navigator.pushReplacementNamed(context, '/controller');
      } else {
        Navigator.pushReplacementNamed(context, '/connect');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF02090C), // Deep dark teal/black
      body: AnimatedBuilder(
        animation: _animController,
        builder: (context, child) {
          return Stack(
            fit: StackFit.expand,
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 1.5,
                    colors: [
                      Colors.teal.withOpacity(0.15 * _glowAnimation.value),
                      const Color(0xFF02090C),
                    ],
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.of(context).size.height * 0.45,
                left: (MediaQuery.of(context).size.width / 2) + _bounceAnimation.value - 8,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.tealAccent.withOpacity(_glowAnimation.value),
                        blurRadius: 20,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                ),
              ),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 120),
                  Text(
                    'LG Arkanoid',
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 4,
                      shadows: [
                        Shadow(
                          color: Colors.tealAccent.withOpacity(_glowAnimation.value),
                          blurRadius: 30,
                        ),
                        const Shadow(
                          color: Colors.teal,
                          blurRadius: 10,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'MULTIPLAYER PANORAMIC BRICK BREAKER',
                    style: TextStyle(
                      fontSize: 12,
                      letterSpacing: 3,
                      fontWeight: FontWeight.bold,
                      color: Colors.teal,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.memory,
                        color: Colors.tealAccent.withOpacity(0.5 + 0.5 * _glowAnimation.value),
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Powered by Gemini AI',
                        style: TextStyle(
                          color: Colors.tealAccent.withOpacity(0.8),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                  Container(
                    width: 250,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white10,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Stack(
                      children: [
                        Container(
                          width: 250 * _progressAnimation.value,
                          height: 4,
                          decoration: BoxDecoration(
                            color: Colors.tealAccent,
                            borderRadius: BorderRadius.circular(2),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.tealAccent.withOpacity(0.8),
                                blurRadius: 10,
                              )
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 60),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _ipController = TextEditingController(text: '192.168.');
  final _portController = TextEditingController(text: '8080');
  final _tokenController = TextEditingController();
  bool _connecting = false;

  Future<void> _connect() async {
    final address = _ipController.text.trim();
    final port = _portController.text.trim();
    final token = _tokenController.text.trim();

    if (address.isEmpty || port.isEmpty || token.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter IP, port, and a 6 digit session token')),
      );
      return;
    }

    setState(() => _connecting = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Connecting')),
    );

    final service = context.read<GameService>();
    final ok = await service.connect(address, port);

    if (!mounted) return;
    setState(() => _connecting = false);

    if (ok) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_server_address', address);
      await prefs.setString('last_server_port', port);
      await prefs.setString('last_session_token', token);
      service.joinGame(token);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/controller');
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection failed check IP and port')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF02090C),
      body: Stack(
        children: [
          // Minimal background element
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.teal.withOpacity(0.1),
                boxShadow: [
                  BoxShadow(color: Colors.teal.withOpacity(0.1), blurRadius: 100),
                ],
              ),
            ),
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'UPLINK',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w300,
                      letterSpacing: 8,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 48),
                  // Frosted Glass Form Container
                  ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white.withOpacity(0.1)),
                        ),
                        child: Column(
                          children: [
                            _buildAppleField(
                              controller: _ipController,
                              label: 'Master Node IP',
                              icon: Icons.dns_outlined,
                            ),
                            const SizedBox(height: 16),
                            _buildAppleField(
                              controller: _portController,
                              label: 'Port',
                              icon: Icons.settings_ethernet,
                            ),
                            const SizedBox(height: 16),
                            _buildAppleField(
                              controller: _tokenController,
                              label: 'Session Token',
                              icon: Icons.key_outlined,
                              maxLength: 6,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Minimal sleek button
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    height: 56,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      gradient: LinearGradient(
                        colors: _connecting
                            ? [Colors.teal.shade800, Colors.teal.shade900]
                            : [Colors.teal.shade400, Colors.teal.shade600],
                      ),
                      boxShadow: _connecting ? [] : [
                        BoxShadow(
                          color: Colors.teal.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(28),
                        onTap: _connecting ? null : _connect,
                        child: Center(
                          child: _connecting
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : const Text(
                                  'INITIALIZE LINK',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 2,
                                    color: Colors.white,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/status'),
                    style: TextButton.styleFrom(foregroundColor: Colors.white54),
                    child: const Text('Open Status View', style: TextStyle(letterSpacing: 1)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppleField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int? maxLength,
  }) {
    return TextField(
      controller: controller,
      maxLength: maxLength,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.5)),
        counterText: '',
        filled: true,
        fillColor: Colors.black.withOpacity(0.2),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.teal.withOpacity(0.5)),
        ),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
    );
  }
}

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  double _smoothedPaddleX = 4800;

  double _applyTouchCurve(double localDx, double stripWidth) {
    const maxX = 9600.0;
    final raw = (localDx / stripWidth) * maxX;
    if (raw <= 0) return 0;
    if (raw >= maxX) return maxX;
    return maxX * pow(raw / maxX, 1.5);
  }

  void _showPowerUpDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Activate Power Up'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _powerUpButton('Wide Paddle', 'wide_paddle'),
            _powerUpButton('Slow Ball', 'slow_ball'),
            _powerUpButton('Multi Ball', 'multi_ball'),
            _powerUpButton('Bomb', 'bomb'),
          ],
        ),
      ),
    );
  }

  Widget _powerUpButton(String label, String type) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ElevatedButton(
        onPressed: () {
          context.read<GameService>().activatePowerUp(type);
          Navigator.pop(context);
        },
        child: Text(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<GameService>(
      builder: (context, service, _) {
        return Scaffold(
          appBar: AppBar(
            title: Text(
              service.playerNumber != null
                  ? 'Player ${service.playerNumber} (${service.playerId ?? "joining..."})'
                  : 'LG Arkanoid Controller',
            ),
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
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.dashboard),
                onPressed: () => Navigator.pushNamed(context, '/status'),
              ),
            ],
          ),
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
                        final curved = _applyTouchCurve(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        _smoothedPaddleX = curved;
                        service.sendPaddleMove(_smoothedPaddleX);
                      },
                      onTapDown: (details) {
                        final curved = _applyTouchCurve(
                          details.localPosition.dx,
                          constraints.maxWidth,
                        );
                        _smoothedPaddleX = curved;
                        service.sendPaddleMove(_smoothedPaddleX);
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
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.teal.shade800),
                        onPressed: () => service.startGame(),
                        child: const Text('Start Game', style: TextStyle(color: Colors.white)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _showPowerUpDialog,
                        child: const Text('Power Up'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => service.activatePowerUp('multi_ball'),
                        child: const Text('Fire Ball'),
                      ),
                    ),
                  ],
                ),
              ),
              if (service.lastCommentary.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16, left: 16, right: 16),
                  child: Text(
                    service.lastCommentarySource == 'fallback'
                        ? '${service.lastCommentary} (offline)'
                        : service.lastCommentary,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<GameService>(
      builder: (context, service, _) {
        final players = service.latestGameState?['players'] as List<dynamic>? ?? [];
        final cardColors = [Colors.red, Colors.green, Colors.blue];

        return Scaffold(
          appBar: AppBar(title: const Text('Game Status')),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: List.generate(3, (index) {
                    Map<String, dynamic> pdata = {};
                    if (index < players.length) {
                      pdata = Map<String, dynamic>.from(players[index] as Map);
                    }
                    final score = pdata['score'] as int? ?? 0;
                    final lives = pdata['lives'] as int? ?? 0;
                    final connected = pdata['connected'] as bool? ?? false;

                    return Expanded(
                      child: Card(
                        color: Colors.grey.shade900,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Text(
                                'P${index + 1}',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: cardColors[index],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                '$score',
                                style: TextStyle(
                                  fontSize: 32,
                                  color: cardColors[index],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(
                                  lives.clamp(0, 5),
                                  (_) => Icon(Icons.favorite, color: cardColors[index], size: 18),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                connected ? 'Connected' : 'Waiting',
                                style: const TextStyle(fontSize: 11, color: Colors.white54),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade900,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: service.lastCommentarySource == 'gemini'
                            ? Colors.teal
                            : Colors.grey,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Commentary',
                          style: TextStyle(
                            color: service.lastCommentarySource == 'gemini'
                                ? Colors.teal
                                : Colors.grey,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Expanded(
                          child: SingleChildScrollView(
                            child: Text(
                              service.lastCommentary.isEmpty
                                  ? 'Waiting for commentary...'
                                  : service.lastCommentarySource == 'fallback'
                                      ? '${service.lastCommentary} (offline)'
                                      : service.lastCommentary,
                              style: const TextStyle(fontSize: 18, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
