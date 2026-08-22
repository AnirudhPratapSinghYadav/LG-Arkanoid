// Human text for the join / connecting screen. No jargon.

String joinTargetLabel(String ip, String port) => 'http://$ip:$port';

String healthUrl(String ip, String port) => 'http://$ip:$port/health';

String cannotReachRig(String ip, String port, {String? detail}) {
  final extra = (detail != null && detail.trim().isNotEmpty)
      ? '\n\nPhone error: $detail'
      : '';
  return 'This phone cannot reach ${joinTargetLabel(ip, port)}.$extra\n\n'
      'On the phone:\n'
      '1. Same Wi-Fi as the wall. Turn OFF mobile data and VPN.\n'
      '2. Type the IPv4 under the QR — never lg1, never localhost.\n'
      '3. Port must be 8130 (the game). Port 22 is only SSH / CONNECT LG.\n\n'
      'On the wall:\n'
      '1. Center screen must show a QR and a 4-letter code.\n'
      '2. If only one screen is lit, SSH to the slaves is broken.\n'
      '3. If the printed IPv4 is wrong, set LG_HOST_IP in server/.env.';
}

String socketFailedCopy(String ip, String port, {String? detail}) {
  final extra = (detail != null && detail.trim().isNotEmpty)
      ? '\n\nPhone error: $detail'
      : '';
  return '/health answered, but the live link to ${joinTargetLabel(ip, port)} did not.$extra\n\n'
      'Stay on Wi-Fi. Wait 3 seconds. Try again. Do not mix port 22 with 8130.';
}

String joinRejectedCopy(String? serverMessage) {
  final m = (serverMessage ?? '').toLowerCase();
  if (m.contains('invalid session') || m.contains('token')) {
    return 'Wrong 4-letter code.\n\n'
        'Look at the CENTER screen only. Type those four characters. Codes change after each match.';
  }
  if (m.contains('already in progress') || m.contains('wait for the next')) {
    return 'A match is already running (or a ghost match was left open).\n\n'
        'Wait until the wall shows the lobby QR again, then scan. '
        'If nobody is playing, restart the game server.';
  }
  if (m.contains('need') && m.contains('before start')) {
    return 'Not enough phones in the lobby yet.\n\n'
        'When you pick 2 players, two phones must join before START unlocks.';
  }
  if (m.contains('locked')) {
    return 'Too many wrong codes from this phone.\n\nWait a minute, then try the code from the wall again.';
  }
  if (m.contains('invalid payload') || m.contains('4')) {
    return 'The session code must be exactly 4 letters or numbers.';
  }
  if (serverMessage != null && serverMessage.isNotEmpty) {
    return serverMessage;
  }
  return 'The wall refused this join. Scan the QR again or retype the code.';
}

String joinTimeoutCopy(String ip, String port) {
  return 'Reached $ip:$port but the lobby did not accept us in time.\n\n'
      'Usually the 4-letter code is stale. Scan the QR again from the center screen.';
}

String lobbyFullCopy() {
  return 'Lobby is full (max 5 paddles).\n\nWait for a player to leave, then join again.';
}

String sameWifiHint() {
  return 'Phone and wall must be on the same Wi-Fi. Guest networks and mobile data will not work.';
}

String missingJoinFieldsCopy() {
  return 'Missing IP, 4-letter code, or name.\n\n'
      'Go back. Scan the center-screen QR, or paste the URL printed under it.';
}
