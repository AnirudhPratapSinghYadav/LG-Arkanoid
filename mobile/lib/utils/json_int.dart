int? asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value.trim());
  return null;
}

int connectedPlayerCount(List<dynamic> players, {required bool selfJoined}) {
  final n = players.where((p) => p is Map && p['connected'] == true).length;
  if (n < 1 && selfJoined) return 1;
  return n;
}

/// Host START uses whoever already joined when the selected slot count is
/// higher than the current roster (one phone on a 12-glass is still a match).
int startSlotCount({required int connected, required int selected}) {
  if (connected < 1) return 0;
  final want = selected.clamp(1, 5);
  return connected >= want ? want : connected;
}
