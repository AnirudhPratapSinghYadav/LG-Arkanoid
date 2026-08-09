import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/gameservice.dart';
import 'services/ttsservice.dart';
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
  // Only bypass TLS checks during local/debug development — never in release APKs.
  assert(() {
    HttpOverrides.global = DevHttpOverrides();
    return true;
  }());
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => GameService()),
        ChangeNotifierProvider<TTSService>(create: (_) => TTSService()),
      ],
      child: const ArkanoidApp(),
    ),
  );
}
