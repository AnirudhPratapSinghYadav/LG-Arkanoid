import 'package:google_fonts/google_fonts.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../utils/constants.dart';

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
        title: Text('Scan QR Code', style: GoogleFonts.spaceGrotesk(fontSize: 16, color: accentPrimary)),
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
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
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
                  if (mode == 'session' && barcode.rawValue!.startsWith('LGARK|')) {
                    _barcodeFound = true;
                    Navigator.of(context).pop(barcode.rawValue);
                    return;
                  } else if (mode == 'rigConnect' && barcode.rawValue!.startsWith('LGRIG|')) {
                    _barcodeFound = true;
                    Navigator.of(context).pop(barcode.rawValue);
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
            child: Text(
              'SCAN THIS QR',
              textAlign: TextAlign.center,
              style: GoogleFonts.vt323(
                fontSize: 32,
                color: accentPrimary,
                letterSpacing: 2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
