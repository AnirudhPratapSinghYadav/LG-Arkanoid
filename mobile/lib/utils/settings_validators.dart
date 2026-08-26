String? validateRigHost(String? value) {
  final h = (value ?? '').trim().toLowerCase();
  if (h.isEmpty) return 'This field is required';
  if (h == 'lg1') {
    return 'Phones cannot resolve lg1. Use the Wi‑Fi IPv4.';
  }
  if (h == '10.0.2.2' || h == '127.0.0.1' || h == 'localhost') {
    return 'SSH needs the rig IPv4. 10.0.2.2 is only for joining the game from the emulator.';
  }
  return null;
}

String? validateSshPort(String? value) {
  if (value == null || value.trim().isEmpty) return 'This field is required';
  if (int.tryParse(value) == null) return 'Must be a valid port number';
  return null;
}

String? validateScreenCount(String? value) {
  if (value == null || value.trim().isEmpty) return 'This field is required';
  final n = int.tryParse(value);
  if (n == null) return 'Must be a number';
  if (n < 1 || n > 12) return 'Use 1–12 (typical LG: 3, 5, 7, 9, 12)';
  return null;
}
