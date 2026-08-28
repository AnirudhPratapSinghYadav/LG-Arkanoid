import 'package:flutter/material.dart';

const Color bgDark = Color(0xFF101214);
const Color cardFill = Color(0xFF1A1F26);
const Color cardSecondary = Color(0xFF242B35);
const Color borderLight = Color(0x14FFFFFF); // rgba(255, 255, 255, 0.08)
const Color accentPrimary = Color(0xFF4F7CAC);
const Color accentSuccess = Color(0xFF4CAF50);
const Color accentWarning = Color(0xFFF4A261);
const Color accentError = Color(0xFFD9534F);
const Color textPrimary = Color(0xFFF3F4F6);
const Color textSecondary = Color(0xFF9AA4AF);

// Dual-channel accent system
// Cyan — rig status, telemetry, connection, system readouts
const Color accentSystem = Color(0xFF00E5FF);
// Amber — game action channel: scores, power-ups, player events
const Color accentGame = Color(0xFFF4A261);

// Spacing scale
const double spaceXs = 4;
const double spaceSm = 8;
const double spaceMd = 16;
const double spaceLg = 24;
const double spaceXl = 32;

// Matches server/config.js.
const String defaultServerPort = '8130';
const int defaultSshPort = 22;
const String defaultSshUsername = 'lg';
const String defaultRemotePath = '~/projects/LG-Arkanoid';


const String prefHost = 'ssh_host';
const String prefPort = 'ssh_port';
const String prefUsername = 'ssh_username';
const String prefPassword = 'ssh_password';
const String prefNumScreens = 'num_screens';
const String prefServerAddress = 'last_server_address';
const String prefServerPort = 'last_server_port';
const String prefSessionToken = 'last_session_token';
const String prefRemotePath = 'remote_path';
const String prefPlayerName = 'last_player_name';
const String prefMatchDuration = 'last_match_duration';
const String prefMaxPlayers = 'last_max_players';
const String prefBallSpeed = 'last_ball_speed';

const List<Color> playerSlotColors = [
  Color(0xFF20C5FF),
  Color(0xFFFF2D78),
  Color(0xFFFFB800),
  Color(0xFF9B59B6),
  Color(0xFF2ECC71),
];
