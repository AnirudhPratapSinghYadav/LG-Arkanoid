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
flutter build apk --release
```

Connect with master IP, port **3000**, and the session token shown on the Liquid Galaxy screens (or `/health`).

See the root [README.md](../README.md) and [docs/mobile-setup.md](../docs/mobile-setup.md).
