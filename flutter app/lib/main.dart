import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'game_service.dart';
import 'app.dart';

class DevHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
  }
}

void main() {
  HttpOverrides.global = DevHttpOverrides();
  runApp(
    ChangeNotifierProvider(
      create: (_) => GameService(),
      child: const LGArkanoidApp(),
    ),
  );
}
