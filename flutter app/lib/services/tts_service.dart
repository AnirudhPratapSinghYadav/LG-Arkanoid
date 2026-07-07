import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

class TTSService extends ChangeNotifier {
  static final TTSService _instance = TTSService._internal();

  late FlutterTts _tts;
  bool _isMuted = false;

  factory TTSService() {
    return _instance;
  }

  TTSService._internal() {
    _tts = FlutterTts();
    _setup();
  }

  bool get isMuted => _isMuted;

  void toggleMute() {
    _isMuted = !_isMuted;
    if (_isMuted) {
      stop();
    }
    notifyListeners();
  }

  Future<void> _setup() async {
    await _tts.awaitSpeakCompletion(false);
    await _tts.setLanguage("en-IN");
    await _tts.setVolume(1.0);
    await _tts.setSpeechRate(0.4);
    await _tts.setPitch(0.8);

    if (!kIsWeb && (Platform.isIOS || Platform.isMacOS)) {
      await _tts.setSharedInstance(true);
    }
  }

  Future<void> speak(String text) async {
    if (_isMuted || text.isEmpty) return;
    await _tts.stop();
    await _tts.speak(text);
  }

  Future<void> stop() async {
    await _tts.stop();
  }
}
