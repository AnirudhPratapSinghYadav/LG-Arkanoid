import 'package:flutter/material.dart';
import 'screens/splash_screen.dart';
import 'screens/connect_screen.dart';
import 'screens/controller_screen.dart';
import 'screens/status_screen.dart';
import 'screens/settings_screen.dart';
import 'utils/constants.dart';

class ArkanoidApp extends StatelessWidget {
  const ArkanoidApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LG Arkanoid',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: bgColor,
        primaryColor: accentCyan,
        colorScheme: ColorScheme.dark(
          primary: accentCyan,
          secondary: accentCyan,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/connect': (context) => const ConnectScreen(),
        '/controller': (context) => const ControllerScreen(),
        '/status': (context) => const StatusScreen(),
        '/settings': (context) => const SettingsScreen(),
      },
      debugShowCheckedModeBanner: false,
    );
  }
}
