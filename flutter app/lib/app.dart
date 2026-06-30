import 'package:flutter/material.dart';
import 'splash_screen.dart';
import 'connect_screen.dart';
import 'controller_screen.dart';
import 'status_screen.dart';

class LGArkanoidApp extends StatelessWidget {
  const LGArkanoidApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Arkanoid AI by LG',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.dark(
          primary: Colors.teal,
          secondary: Colors.tealAccent,
          surface: const Color(0xFF121212),),
        scaffoldBackgroundColor: const Color(0xFF0a0a0a),
        useMaterial3: true,),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/connect': (context) => const ConnectScreen(),
        '/controller': (context) => const ControllerScreen(),
        '/status': (context) => const StatusScreen(),},);}}
