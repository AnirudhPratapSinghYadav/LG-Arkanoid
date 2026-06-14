# LG Arkanoid Protocol Reference

Version 0.1.0

This document defines every message exchanged between Flutter controllers, Phaser screen clients, and the Node.js game server over Socket.io.

## Client to Server Messages

### paddle_move

Sent when a player drags the paddle on their phone controller.

```json
{
  "playerId": "player1",
  "x": 4800,
  "timestamp": 1718044800123,
  "nonce": "a3f8b2c1"
}
```

| Field | Type | Description |
|---|---|---|
| playerId | string | Assigned player id from join_confirmed |
| x | integer | Virtual paddle position in pixels, range 0 to 9599 |
| timestamp | integer | Milliseconds since epoch at send time |
| nonce | string | 8 hexadecimal characters, unique per message |

### power_up_activate

Sent when a player activates a power up from the controller.

```json
{
  "playerId": "player1",
  "powerUpType": "wide_paddle",
  "timestamp": 1718044800456,
  "nonce": "7e2d9f04"
}
```

| Field | Type | Description |
|---|---|---|
| playerId | string | Assigned player id |
| powerUpType | string | One of wide_paddle, slow_ball, multi_ball, bomb |
| timestamp | integer | Milliseconds since epoch |
| nonce | string | 8 hexadecimal characters |

### player_join

Sent when a controller connects and submits the session token displayed on Screen 5.

```json
{
  "sessionToken": "482913"
}
```

| Field | Type | Description |
|---|---|---|
| sessionToken | string | 6 digit token from game_started event |

### resume_request

Sent when a player reconnects within the same game session.

```json
{
  "playerId": "player2",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Description |
|---|---|---|
| playerId | string | Previously assigned player id |
| sessionId | string | UUID from join_confirmed or game_started |

### start_game

Sent from any screen client when the operator presses S to begin a new game.

```json
{}
```

### boundary_ack

Sent by a screen client after receiving boundary_exit or boundary_enter.

```json
{
  "handoffId": "2-3-1718044801000",
  "screenId": 3
}
```

## Server to Client Messages

### game_state

Broadcast at 60 fps while the game is active and after every state change.

```json
{
  "balls": [
    {
      "id": "ball1",
      "x": 4800,
      "y": 500,
      "vx": 3,
      "vy": 4,
      "active": true
    }
  ],
  "bricks": [
    [
      {
        "row": 0,
        "col": 0,
        "x": 0,
        "y": 100,
        "active": true
      }
    ]
  ],
  "players": [
    {
      "id": "player1",
      "playerNumber": 1,
      "paddleX": 4800,
      "paddleWidth": 300,
      "score": 1200,
      "lives": 3,
      "connected": true
    }
  ],
  "currentLevel": 1,
  "gameActive": true
}
```

### boundary_exit

Sent to the departing screen when a ball crosses a bezel boundary.

```json
{
  "handoffId": "2-3-1718044801000",
  "ballId": "ball1",
  "screenId": 2,
  "exitX": 3839,
  "exitY": 520,
  "velocityX": 3,
  "velocityY": 4
}
```

### boundary_enter

Sent to the arriving screen in the same synchronous execution as boundary_exit.

```json
{
  "handoffId": "2-3-1718044801000",
  "ballId": "ball1",
  "screenId": 3,
  "entryX": 3840,
  "entryY": 520,
  "velocityX": 3,
  "velocityY": 4
}
```

### commentary

Sent when a game event triggers the Gemini commentary layer or the local fallback.

```json
{
  "text": "Incredible brick busting frenzy across the panoramic rig tonight",
  "source": "gemini",
  "eventType": "score_milestone"
}
```

| Field | Type | Description |
|---|---|---|
| text | string | Commentary text to display and read aloud |
| source | string | gemini or fallback |
| eventType | string | Event that triggered the commentary |

### game_started

Sent when a new game session begins.

```json
{
  "sessionToken": "482913",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### join_confirmed

Sent to a controller after successful player_join.

```json
{
  "playerId": "player1",
  "playerNumber": 1,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### join_rejected

Sent when player_join or resume_request fails validation.

```json
{
  "errorCode": 1001,
  "message": "Invalid session token"
}
```

### player_disconnected

Sent when a player slot is released after the 5 second grace period.

```json
{
  "playerNumber": 2,
  "message": "Player left the game"
}
```

### player_eliminated

Sent when a player reaches zero lives.

```json
{
  "playerId": "player2",
  "playerNumber": 2
}
```

### error

Sent to a specific client when input validation fails.

```json
{
  "errorCode": 1004
}
```

## Error Codes

| Code | Meaning |
|---|---|
| 1001 | Invalid session token |
| 1002 | Paddle slot unavailable |
| 1003 | Message timestamp expired, older than 500 milliseconds |
| 1004 | Duplicate nonce rejected within 100 millisecond window |
| 1005 | Gemini rate limit exceeded, falling back to local commentary |
