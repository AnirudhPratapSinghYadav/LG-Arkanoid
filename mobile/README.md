# LG Arkanoid — mobile controller

Flutter phone controller for the panoramic LG Arkanoid game.

## Requirements

- Flutter **3.24.x**
- Android device or emulator on the same network as the game server

## Run

```bash
cd mobile
flutter pub get
flutter run
```

Release APK:

```bash
flutter build apk --release --split-per-abi
```

`--split-per-abi` keeps each APK well inside the Play Store / GO Web Store
comfort zone by shipping one native ABI instead of all of them. Release
builds also run R8 (`isMinifyEnabled`) and the Android resource shrinker
(`isShrinkResources`) — see `android/app/build.gradle.kts`. In-app images
are lossless WebP. Use `flutter build appbundle --release` only if you also
upload to Play; the GO Store wants the arm64 APK.

The listing itself is a pull request against
[LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data), not against
GO-Web-Store. Full steps: [docs/GO_WEB_STORE.md](../docs/GO_WEB_STORE.md).

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
