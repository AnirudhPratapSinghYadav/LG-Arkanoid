import 'package:flutter/material.dart';
import 'screens/splashscreen.dart';
import 'screens/rigdiscoveryscreen.dart';
import 'screens/joinchoicescreen.dart';
import 'screens/manualentryscreen.dart';
import 'screens/nameentryscreen.dart';
import 'screens/connectingscreen.dart';
import 'screens/lobbyscreen.dart';
import 'screens/qrscanscreen.dart';
import 'screens/controllerscreen.dart';
import 'screens/statusscreen.dart';
import 'screens/settingsscreen.dart';
import '../utils/constants.dart';

class ArkanoidApp extends StatelessWidget {
  const ArkanoidApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LG Arkanoid',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: bgDark,
        primaryColor: accentPrimary,
        colorScheme: ColorScheme.dark(
          primary: accentPrimary,
          secondary: accentPrimary,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/discovery': (context) => const RigDiscoveryScreen(),
        '/joinchoice': (context) => const JoinChoiceScreen(),
        '/manualentry': (context) => const ManualEntryScreen(),
        '/nameentry': (context) => const NameEntryScreen(),
        '/connecting': (context) => const ConnectingScreen(),
        '/lobby': (context) => const LobbyScreen(),
        '/qrscan': (context) => const QrScanScreen(),
        '/controller': (context) => const ControllerScreen(),
        '/status': (context) => const StatusScreen(),
        '/settings': (context) => const SettingsScreen(),
      },
      debugShowCheckedModeBanner: false,
    );
  }
}
