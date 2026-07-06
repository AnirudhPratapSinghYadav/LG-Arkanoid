import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

class TTSService extends ChangeNotifier {
  static final TTSService _instance = TTSService._internal();

  late FlutterTts _flutterTts;
  bool _isMuted = false;
  String? _language;
  String? _engine;
  double _volume = 1.0;
  double _pitch = 1.0;
  double _rate = 0.5;

  factory TTSService() {
    return _instance;
  }

  TTSService._internal() {
    _initTts();
  }

  bool get isMuted => _isMuted;

  void toggleMute() {
    _isMuted = !_isMuted;
    if (_isMuted) {
      stop();
    }
    notifyListeners();
  }

  Future<void> _initTts() async {
    _flutterTts = FlutterTts();

    _setAwaitOptions();

    if (!kIsWeb) {
      if (Platform.isAndroid) {
        _getDefaultEngine();
        _getDefaultVoice();
      } else if (Platform.isIOS || Platform.isMacOS) {
        await _flutterTts.setSharedInstance(true);
        await _flutterTts.setIosAudioCategory(
          IosTextToSpeechAudioCategory.playback,
          [
            IosTextToSpeechAudioCategoryOptions.allowBluetooth,
            IosTextToSpeechAudioCategoryOptions.allowBluetoothA2DP,
            IosTextToSpeechAudioCategoryOptions.mixWithOthers,
          ],
          IosTextToSpeechAudioMode.defaultMode,
        );
      }
    }
  }

  Future<void> _getDefaultEngine() async {
    var engine = await _flutterTts.getDefaultEngine;
    if (engine != null) {
      _engine = engine;
    }
  }

  Future<void> _getDefaultVoice() async {
    var voice = await _flutterTts.getDefaultVoice;
    if (voice != null) {
      // Use default voice
    }
  }

  Future<void> _setAwaitOptions() async {
    await _flutterTts.awaitSpeakCompletion(true);
  }

  Future<void> speak(String text) async {
    if (_isMuted || text.isEmpty) return;

    await _flutterTts.setVolume(_volume);
    await _flutterTts.setSpeechRate(_rate);
    await _flutterTts.setPitch(_pitch);

    await _flutterTts.speak(text);
  }

  Future<void> stop() async {
    await _flutterTts.stop();
  }
}
