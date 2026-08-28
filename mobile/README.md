# LG Arkanoid — mobile controller

Flutter **phone paddle** for the panoramic LG Arkanoid match. This APK does not draw the wall.

## Requirements

- Flutter **3.24.x**
- Android device or emulator. Emulator join to a laptop server: `10.0.2.2:8130`. SSH / LAUNCH ON RIG: rig Wi‑Fi IPv4, never `10.0.2.2`. Hostname `lg1` is blocked.

## Run

```bash
cd mobile
flutter pub get
flutter run
```

Release APK (GO Store + testers — fat, all ABIs, under 50 MB):

```bash
flutter build apk --release
```

Rename `build/app/outputs/flutter-apk/app-release.apk` to `LG_Arkanoid_1.0.0.apk`.
`--split-per-abi` is only a shrink fallback; emulators often refuse arm64-only.
Listing kit and `store.json` entry: [store/LG_Arkanoid/](../store/LG_Arkanoid/).
The listing is a PR against [LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data).

Connect with the IPv4 printed under the wall QR, port **8130**, and the 4-letter code on the center screen. The connecting screen probes `http://IP:8130/health` first, then opens the live link. `/health` does not include the join code. Same Wi-Fi as lg1 — never type `lg1`.

Android emulator: join `10.0.2.2:8130` (host loopback). Settings → Launch/SSH still needs the real rig IPv4, not `10.0.2.2`.

## Typography is offline by design

The controller does **not** use the `google_fonts` package. That package pulls
its `.ttf` files from `fonts.gstatic.com` on first use, and a phone joined to a
Liquid Galaxy rig's LAN usually has no route to the internet — every label would
quietly fall back to the platform font in the middle of a demo.

Instead all five faces are bundled (~1.6 MB total) and used through
`lib/utils/app_fonts.dart`:

| Family | File | Notes |
| --- | --- | --- |
| Inter | `Inter-Variable.ttf` | variable, `wght` 100–900 |
| Space Grotesk | `SpaceGrotesk-Variable.ttf` | variable, `wght` 300–700 |
| JetBrains Mono | Regular + Bold | static faces, used for codes and IPs |
| VT323 | Regular | single weight |
| Press Start 2P | Regular | single weight, splash title |

Inter and Space Grotesk exist upstream only as variable fonts, so `AppFonts`
sets `fontVariations: [FontVariation('wght', …)]` as well as `fontWeight`.
Space Grotesk's axis *defaults to 300 (Light)*, so asking for a regular weight
without that variation renders visibly thin — use `AppFonts`, not a raw
`TextStyle(fontFamily: 'SpaceGrotesk')`.

Their SIL Open Font License texts are bundled too and registered with
`LicenseRegistry` in `main.dart`, so they appear in the app's licence page.

See the root [README.md](../README.md) and [docs/mobile-setup.md](../docs/mobile-setup.md).
