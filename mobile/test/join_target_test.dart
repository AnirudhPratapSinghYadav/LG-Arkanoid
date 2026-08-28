import 'package:flutter_test/flutter_test.dart';
import 'package:lg_arkanoid/utils/join_target.dart';
import 'package:lg_arkanoid/utils/settings_validators.dart';
import 'package:lg_arkanoid/services/health_probe.dart';

import 'package:lg_arkanoid/utils/json_int.dart';

void main() {
  group('parseJoinInput', () {
    test('QR controller URL', () {
      final t = parseJoinInput('http://10.11.77.106:8130/controller?c=CATA');
      expect(t, isNotNull);
      expect(t!.ip, '10.11.77.106');
      expect(t.port, '8130');
      expect(t.token, 'CATA');
      expect(t.warning, isNull);
    });

    test('blocks hostname lg1', () {
      final t = parseJoinInput('http://lg1:8130/controller?c=ABCD');
      expect(t, isNotNull);
      expect(t!.ip, 'lg1');
      expect(t.warning, isNotNull);
    });

    test('controller URL without code has empty token', () {
      final t = parseJoinInput('http://10.11.77.106:8130/controller');
      expect(t, isNotNull);
      expect(t!.ip, '10.11.77.106');
      expect(t.token.length, isNot(4));
    });

    test('emulator loopback is a hint, not a block', () {
      final t = parseJoinInput('http://10.0.2.2:8130/controller?c=CATA');
      expect(t, isNotNull);
      expect(t!.ip, '10.0.2.2');
      expect(t.warning, isNull);
      expect(t.hint, contains('10.0.2.2'));
    });
  });

  group('rig SSH validators', () {
    test('reject lg1 and emulator loopback for SSH', () {
      expect(validateRigHost('lg1'), isNotNull);
      expect(validateRigHost('10.0.2.2'), isNotNull);
      expect(validateRigHost('127.0.0.1'), isNotNull);
      expect(validateRigHost('10.11.77.106'), isNull);
    });
  });

  group('health shape', () {
    test('requires status ok and gameStatus, never a token', () {
      expect(
        looksLikeArkanoidHealth({'status': 'ok', 'gameStatus': 'lobby'}),
        isTrue,
      );
      expect(looksLikeArkanoidHealth({'status': 'ok'}), isFalse);
      expect(
        looksLikeArkanoidHealth({
          'status': 'ok',
          'gameStatus': 'lobby',
          'sessionToken': 'ABCD',
        }),
        isTrue,
      );
    });
  });

  group('startSlotCount', () {
    test('one paddle can start a match', () {
      expect(startSlotCount(connected: 1, selected: 2), 1);
      expect(startSlotCount(connected: 2, selected: 2), 2);
      expect(startSlotCount(connected: 0, selected: 2), 0);
      expect(connectedPlayerCount([], selfJoined: true), 1);
      expect(connectedPlayerCount([], selfJoined: false), 0);
    });
  });

  group('asInt', () {
    test('accepts JSON nums from Socket.IO', () {
      expect(asInt(1), 1);
      expect(asInt(1.0), 1);
      expect(asInt('3'), 3);
      expect(asInt(null), isNull);
    });
  });
}
