import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_fonts.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/gameservice.dart';
import '../widgets/mission_background.dart';
import '../widgets/lgpanel.dart';
import '../widgets/connectionstatus.dart';
import '../widgets/controller_dpad.dart';
import '../widgets/powerup_panel.dart';
import '../widgets/player_stats_bar.dart';
import '../widgets/game_end_overlay.dart';
import '../utils/leave_match.dart';
import '../services/ttsservice.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key});

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  bool _showGameEndOverlay = false;
  String _gameEndTitle = '';
  String _gameEndSubtitle = '';
  String _gameEndKicker = '';
  String _gameEndMessage = '';
  bool _gameEndIsHost = false;
  List<Map<String, dynamic>> _gameEndRankings = <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    context.read<GameService>().addListener(_onGameStateUpdate);
  }

  @override
  void dispose() {
    context.read<GameService>().removeListener(_onGameStateUpdate);
    super.dispose();
  }

  void _onGameStateUpdate() {
    if (!mounted) return;
    final service = context.read<GameService>();
    final gameState = service.latestGameState;
    if (gameState == null) return;

    final status = gameState['gameStatus'] as String? ?? 'playing';

    if (_showGameEndOverlay &&
        (status == 'countdown' || status == 'playing')) {
      setState(() => _showGameEndOverlay = false);
      return;
    }

    if ((status == 'game_over' || status == 'time_up' || status == 'win') &&
        !_showGameEndOverlay) {
      final players = gameState['players'] as List<dynamic>? ?? [];
      final sorted = List<dynamic>.from(players)
        ..sort((a, b) {
          final aScore = (a as Map)['score'] as int? ?? 0;
          final bScore = (b as Map)['score'] as int? ?? 0;
          return bScore.compareTo(aScore);
        });

      final result = gameState['matchResult'];
      final isDraw = result is Map && result['outcome'] == 'draw';
      final masterIndex = gameState['masterPlayerIndex'] as int? ?? 0;
      final isHost = (service.playerNumber ?? 0) - 1 == masterIndex;

      String winnerName = 'Nobody';
      if (sorted.isNotEmpty) {
        final winner = sorted.first as Map;
        winnerName =
            winner['name'] as String? ?? 'Player ${winner['playerNumber']}';
      }

      final myId = service.playerId;
      int myRank = service.rank;
      if (myId != null) {
        final idx = sorted.indexWhere((raw) => (raw as Map)['id'] == myId);
        if (idx >= 0) myRank = idx + 1;
      }
      final iWon = !isDraw && myRank == 1;

      setState(() {
        _showGameEndOverlay = true;
        _gameEndIsHost = isHost;
        if (isDraw) {
          _gameEndKicker = 'MATCH OVER';
          _gameEndTitle = 'DRAW';
          _gameEndSubtitle = 'Same score — nobody wins.';
          _gameEndMessage = 'It is a tie. Play again or exit.';
        } else if (iWon) {
          _gameEndKicker = 'CONGRATULATIONS';
          _gameEndTitle = status == 'time_up' ? 'TIME\'S UP!' : 'YOU WIN';
          _gameEndSubtitle = 'You take the wall.';
          _gameEndMessage = '$winnerName wins.';
        } else {
          _gameEndKicker = 'BETTER LUCK NEXT TIME';
          _gameEndTitle = myRank == 2 ? '2ND PLACE' : 'YOU PLACED #$myRank';
          _gameEndSubtitle = '$winnerName wins this match.';
          _gameEndMessage = 'Stay for a rematch or exit.';
        }
        _gameEndRankings = sorted.take(5).map((raw) {
          final row = raw as Map;
          return <String, dynamic>{
            'name': row['name'] as String? ??
                'Player ${row['playerNumber'] ?? ''}',
            'score': row['score'] as int? ?? 0,
          };
        }).toList();
      });

      HapticFeedback.mediumImpact();
      if (isDraw) {
        unawaited(TTSService().speak('Draw. Same score.'));
      } else if (!iWon) {
        unawaited(TTSService().speak('Better luck next time.'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.watch<GameService>();
    final gameState = service.latestGameState;

    const playerColors = playerSlotColors;
    final playerColor =
        playerColors[((service.playerNumber ?? 1) - 1) % playerColors.length];

    int remainingSeconds = 0;
    bool showTimer = false;
    bool warnLowTime = false;
    if (gameState != null) {
      final gameStartedAt = gameState['gameStartedAt'] as int?;
      final duration = gameState['gameDurationSeconds'] as int? ?? 180;
      final status = gameState['gameStatus'] as String? ?? '';
      if (gameStartedAt != null && status == 'playing') {
        final elapsed =
            (DateTime.now().millisecondsSinceEpoch - gameStartedAt) ~/ 1000;
        if (duration > 0) {
          remainingSeconds = max(0, duration - elapsed);
          warnLowTime = remainingSeconds <= 30;
        } else {
          remainingSeconds = elapsed;
        }
        showTimer = true;
      }
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final ok = await confirmLeave(context, title: 'LEAVE MATCH?');
        if (!ok || !context.mounted) return;
        leaveToStart(context);
      },
      child: Scaffold(
      backgroundColor: bgDark,
      body: MissionControlBackground(
        child: Stack(
          children: [
            SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding:
                        const EdgeInsets.fromLTRB(12, 6, 12, 0),
                    child: LgPanel(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: playerColor,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'P${service.playerNumber ?? 1}',
                            style: AppFonts.spaceGrotesk(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: textPrimary,
                            ),
                          ),
                          const Spacer(),
                          Flexible(
                            child: ConnectionStatus(
                                isConnected: service.connected, label: 'GAME'),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${service.latencyMs}ms',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: textSecondary,
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              final ok = await confirmLeave(
                                  context, title: 'LEAVE MATCH?');
                              if (!ok || !context.mounted) return;
                              leaveToStart(context);
                            },
                            style: TextButton.styleFrom(
                              foregroundColor: accentError,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              minimumSize: const Size(64, 36),
                            ),
                            child: Text(
                              'LEAVE',
                              style: AppFonts.spaceGrotesk(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: accentError,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  PlayerStatsBar(
                    playerColor: playerColor,
                    remainingSeconds: remainingSeconds,
                    showTimer: showTimer,
                    warnLowTime: warnLowTime,
                  ),
                  if (service.lastCommentary.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: cardFill,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: borderLight),
                        ),
                        child: Text(
                          service.lastCommentary,
                          style: AppFonts.inter(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: PowerupPanel(),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(0, 8, 0, 12),
                      child: ControllerDpad(
                        playerColor: playerColor,
                        onPaddleMove: (delta) {
                          context.read<GameService>().sendPaddleMove(delta);
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_showGameEndOverlay)
              GameEndOverlay(
                kicker: _gameEndKicker,
                title: _gameEndTitle,
                subtitle: _gameEndSubtitle,
                message: _gameEndMessage,
                rankings: _gameEndRankings,
                score: service.score,
                rank: service.rank,
                playerColor: playerColor,
                isHost: _gameEndIsHost,
                onRematch: _gameEndIsHost
                    ? () {
                        context.read<GameService>().rematch();
                      }
                    : null,
                onNewGame: _gameEndIsHost
                    ? () {
                        context.read<GameService>().returnToLobbyFromHost();
                        setState(() => _showGameEndOverlay = false);
                        if (context.mounted) {
                          Navigator.pushReplacementNamed(context, '/lobby');
                        }
                      }
                    : null,
                onExit: () {
                  setState(() => _showGameEndOverlay = false);
                  leaveToStart(context);
                },
              ),
          ],
        ),
      ),
    ),
    );
  }
}
