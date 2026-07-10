import 'package:flutter/material.dart';
import 'screens/splashscreen.dart';
import 'screens/connectscreen.dart';
import 'screens/controllerscreen.dart';
import 'screens/statusscreen.dart';
import 'screens/settingsscreen.dart';
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
