import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lg_arkanoid/widgets/lobby_host_panel.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(child: child),
      ),
    );
  }

  testWidgets('START WITH 1 when one paddle and two slots selected', (tester) async {
    var started = false;
    await tester.pumpWidget(wrap(LobbyHostPanel(
      selectedMaxPlayers: 2,
      selectedBallSpeed: 'medium',
      selectedDuration: 180,
      connectedCount: 1,
      onMaxPlayers: (_) {},
      onBallSpeed: (_) {},
      onDuration: (_) {},
      onQrInvite: () {},
      onStartMatch: () { started = true; },
    )));
    expect(find.text('START WITH 1'), findsOneWidget);
    await tester.tap(find.text('START WITH 1'));
    expect(started, isTrue);
  });

  testWidgets('NEED A PADDLE when nobody has joined', (tester) async {
    await tester.pumpWidget(wrap(LobbyHostPanel(
      selectedMaxPlayers: 2,
      selectedBallSpeed: 'medium',
      selectedDuration: 180,
      connectedCount: 0,
      onMaxPlayers: (_) {},
      onBallSpeed: (_) {},
      onDuration: (_) {},
      onQrInvite: () {},
      onStartMatch: () {},
    )));
    expect(find.text('NEED A PADDLE'), findsOneWidget);
  });
}
