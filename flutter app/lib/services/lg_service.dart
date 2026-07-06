import 'dart:developer';
import 'ssh_service.dart';

class LGService {
  static final LGService _instance = LGService._internal();

  final SSHService _sshService = SSHService();
  int _numScreens = 5;

  factory LGService() {
    return _instance;
  }

  LGService._internal();

  int get numScreens => _numScreens;

  void setNumScreens(int n) {
    _numScreens = n;
  }

  Future<bool> isConnected() async {
    return await _sshService.isConnected();
  }

  Future<void> openBrowserOnScreens(String serverUrl) async {
    for (int i = 1; i <= _numScreens; i++) {
      String command =
          'export DISPLAY=:0; google-chrome --kiosk "$serverUrl/screen?screenId=$i" &';
      await _sshService.execute(command);
    }
  }

  Future<void> closeBrowsers() async {
    await _sshService.execute('pkill -f google-chrome');
  }

  Future<void> rebootRig() async {
    for (int i = 1; i <= _numScreens; i++) {
      String target = 'lg$i';
      await _sshService.execute(
        'sshpass -p ${_sshService.username} ssh -o StrictHostKeyChecking=no ${_sshService.username}@$target "sudo reboot"',
      );
    }
  }

  Future<void> shutdownRig() async {
    for (int i = 1; i <= _numScreens; i++) {
      String target = 'lg$i';
      await _sshService.execute(
        'sshpass -p ${_sshService.username} ssh -o StrictHostKeyChecking=no ${_sshService.username}@$target "sudo poweroff"',
      );
    }
  }

  Future<void> deployGame(String serverUrl) async {
    try {
      await closeBrowsers();
      await Future.delayed(const Duration(seconds: 2));
      await openBrowserOnScreens(serverUrl);
    } catch (e) {
      log('Deploy error: $e');
    }
  }
}
