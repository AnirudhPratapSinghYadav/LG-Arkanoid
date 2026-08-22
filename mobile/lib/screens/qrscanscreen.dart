import '../utils/app_fonts.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../utils/constants.dart';
import '../utils/join_target.dart';

class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController controller = MobileScannerController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  bool _barcodeFound = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Scan QR Code', style: AppFonts.spaceGrotesk(fontSize: 16, color: accentPrimary)),
        iconTheme: const IconThemeData(color: accentPrimary),
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            errorBuilder: (context, error, child) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error, color: accentWarning, size: 48),
                    const SizedBox(height: 16),
                    Text(
                      'Camera permission denied.',
                      style: AppFonts.inter(color: Colors.white, fontSize: 16),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentPrimary,
                        foregroundColor: bgDark,
                      ),
                      onPressed: () {
                        Navigator.pushReplacementNamed(context, '/manualentry');
                      },
                      child: const Text('Use Manual Entry'),
                    ),
                  ],
                ),
              );
            },
            onDetect: (capture) {
              if (_barcodeFound) return;
              final mode = ModalRoute.of(context)?.settings.arguments as String? ?? 'session';
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null) {
                  final raw = barcode.rawValue!;
                  if (mode == 'session') {
                    final parsed = parseJoinInput(raw);
                    final looksLikeJoin = raw.toUpperCase().startsWith('LGARK|') ||
                        raw.contains('/controller') ||
                        raw.contains('?c=') ||
                        (parsed != null && parsed.token.length == 4);
                    if (parsed != null && looksLikeJoin) {
                      _barcodeFound = true;
                      Navigator.of(context).pop(raw);
                      return;
                    }
                  } else if (mode == 'rigConnect' && raw.startsWith('LGRIG|')) {
                    _barcodeFound = true;
                    Navigator.of(context).pop(raw);
                    return;
                  }
                }
              }
            },
          ),
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: accentPrimary, width: 4),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          Positioned(
            bottom: 80,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(
                  'SCAN THIS QR',
                  textAlign: TextAlign.center,
                  style: AppFonts.vt323(
                    fontSize: 32,
                    color: accentPrimary,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    'Best: this APK + same Wi-Fi as lg1. Point at the wall QR.',
                    textAlign: TextAlign.center,
                    style: AppFonts.inter(
                      fontSize: 13,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
