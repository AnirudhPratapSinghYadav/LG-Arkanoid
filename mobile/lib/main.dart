import 'dart:io';
import 'package:flutter/foundation.dart'
    show LicenseEntry, LicenseEntryWithLineBreaks, LicenseRegistry;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
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

/// The typefaces are bundled rather than fetched, so the app itself has to
/// carry their SIL Open Font License texts. This surfaces them in the standard
/// "view licenses" page instead of leaving them only in the repository.
Stream<LicenseEntry> _fontLicenses() async* {
  const fonts = <String, String>{
    'Inter': 'assets/fonts/licenses/OFL-Inter.txt',
    'Space Grotesk': 'assets/fonts/licenses/OFL-SpaceGrotesk.txt',
    'VT323': 'assets/fonts/licenses/OFL-VT323.txt',
    'JetBrains Mono': 'assets/fonts/licenses/OFL-JetBrainsMono.txt',
    'Press Start 2P': 'assets/fonts/licenses/OFL-PressStart2P.txt',
  };
  for (final entry in fonts.entries) {
    final text = await rootBundle.loadString(entry.value);
    yield LicenseEntryWithLineBreaks(<String>[entry.key], text);
  }
}

void main() {
  // Only bypass TLS checks during local/debug development — never in release APKs.
  assert(() {
    HttpOverrides.global = DevHttpOverrides();
    return true;
  }());
  LicenseRegistry.addLicense(_fontLicenses);
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
