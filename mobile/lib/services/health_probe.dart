import 'dart:convert';
import 'dart:io';

class HealthProbeResult {
  final bool ok;
  final String url;
  final String? detail;

  const HealthProbeResult({
    required this.ok,
    required this.url,
    this.detail,
  });
}

bool looksLikeArkanoidHealth(Object? decoded) {
  if (decoded is! Map) return false;
  return decoded['status'] == 'ok' && decoded['gameStatus'] != null;
}

/// Probe GET /health a few times. First Wi-Fi packet on a phone is often slow.
/// Require JSON `{ status: "ok", gameStatus: ... }` so a random HTTP 200 on
/// 8130 (printer, other game, empty nginx) is not treated as this wall.
Future<HealthProbeResult> probeHealth(
  String ip,
  String port, {
  int tries = 4,
}) async {
  final url = 'http://$ip:$port/health';
  String? last;
  for (var i = 0; i < tries; i++) {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 3);
    try {
      final req = await client.getUrl(Uri.parse(url));
      final resp = await req.close().timeout(const Duration(seconds: 3));
      final body = await resp.transform(utf8.decoder).join();
      if (resp.statusCode == 200) {
        try {
          final decoded = jsonDecode(body);
          if (looksLikeArkanoidHealth(decoded)) {
            return HealthProbeResult(ok: true, url: url);
          }
          last =
              'HTTP 200 from $url but that is not LG Arkanoid /health (need status=ok and gameStatus).';
        } catch (_) {
          last = 'HTTP 200 from $url but the body is not JSON /health.';
        }
      } else {
        last = 'HTTP ${resp.statusCode} from $url';
      }
    } on SocketException catch (e) {
      last = e.message.isNotEmpty ? e.message : e.toString();
    } catch (e) {
      last = e.toString();
    } finally {
      client.close(force: true);
    }
    if (i < tries - 1) {
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
  }
  return HealthProbeResult(ok: false, url: url, detail: last);
}
