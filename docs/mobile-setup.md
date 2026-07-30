# Mobile Setup

## Building the Flutter App
The controller app is built using Flutter.
1. Install the Flutter SDK (>= 3.24.x).
2. Connect an Android device (developer mode enabled).
3. Navigate to `mobile/`.
4. Run `flutter pub get`.
5. Run `flutter run -d <DEVICE_ID>` or build an APK via `flutter build apk`.

## Connecting to the Rig
1. Open the app on your phone.
2. Enter the rig's Master Node IP and your SSH password.
3. Tap "Connect to Rig".
4. The app uses DartSSH2 to open the game on the screens and connects to Socket.IO.
