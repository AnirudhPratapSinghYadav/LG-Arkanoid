# LG Arkanoid Architecture

This document explains how LG Arkanoid works across the Liquid Galaxy five screen rig, three phone controllers, and the Gemini commentary layer.

## Overview

LG Arkanoid is a panoramic multiplayer brick breaker. The virtual game canvas is 9600 pixels wide and 1080 pixels tall, stretched across five physical screens. Three players control paddles from Android phones. The Node.js server on the LG master node owns all physics, collisions, scoring, and boundary handoffs. Screen clients render what the server tells them. Nothing is simulated locally except visual smoothing at screen bezels.

## Data Flow

```
[Player Phone Flutter Controller]
        |
        |  Socket.io: paddle_move / power_up_activate / player_join
        v
[Node.js Game Server on LG Master Node]
        |
        |  16ms game loop: collisions, scoring, boundary detection
        |
        +--- broadcast game_state (60 fps) ---> [Screen 1 Phaser Client]
        +--- broadcast game_state -------------> [Screen 2 Phaser Client]
        +--- broadcast game_state -------------> [Screen 3 Phaser Client]
        +--- broadcast game_state -------------> [Screen 4 Phaser Client]
        +--- broadcast game_state -------------> [Screen 5 Phaser Client]

[Boundary Branch within game loop]

[Node.js Server] -- detectBoundary --> [triggerBoundaryHandoff]
        |                                      |
        | synchronous dual emit                |
        +--> boundary_exit --> departing screen
        +--> boundary_enter --> arriving screen
        |                                      |
        +<----- boundary_ack (16ms window) ----+
        +----- retry once if ack missing ------+


[Commentary Branch on game events]

[Game Event: level cleared / life lost / multi ball / score milestone / victory]
        |
        v
[triggerCommentary on Node.js Server]
        |
        +--> Gemini 2.0 Flash API (if rate limit allows and key present)
        |
        +--> Local fallback pool (20 strings on any failure)
        |
        v
[commentary event broadcast to all clients]
        |
        +--> Screen 5: commentary text overlay
        +--> Flutter controller: status text display
        +--> Future: Flutter TTS read aloud on phone
```

## Layer One: Flutter Controller App

Each player runs the LG Arkanoid Flutter app on their Android phone. The app connects to the master node over Socket.io with websocket transport for low latency.

The controller shows a horizontal drag strip. Finger position maps to a virtual paddle coordinate on the 9600 pixel canvas using an exponential sensitivity curve so fine control is possible near the centre and faster movement is available at the edges.

The app sends paddle_move messages with a fresh 8 character hex nonce and a timestamp on every drag update. Power up buttons send power_up_activate messages with the same security fields.

Players enter the 6 digit session token shown on Screen 5 when the game starts. The server validates this token before assigning a paddle slot.

## Layer Two: Node.js Game Server

The server is the single source of truth. It maintains balls, bricks, player paddles, scores, lives, quest flags, session tokens, and commentary rate limiters.

The 16 millisecond game loop processes active balls each tick. For each ball it checks brick collisions, paddle collisions, wall bounces, falls past the bottom edge, and screen boundary crossings. After all balls are processed it checks for level completion and broadcasts the full game state.

Screen clients join Socket.io rooms named screen-1 through screen-5 based on a query parameter. Boundary events are emitted only to the relevant rooms.

## Layer Three: Phaser Screen Clients

Five Chromium instances each load the same HTML client with a different screenId parameter. Each client draws only the portion of the virtual canvas visible on its screen by subtracting virtualLeft from all x coordinates.

Clients hold no game logic. They receive game_state events and draw bricks, balls, and paddles on the next Phaser update frame. This keeps rendering on the main thread and avoids visual tearing.

## Layer Four: Gemini Commentary

Game events trigger commentary generation. The server builds a prompt from live game state, calls the Gemini API, and emits the result to all clients. If the API fails or the rate limiter blocks the call, a random string from the local fallback pool is used instead.

Screen 5 displays commentary in the top right corner. Flutter controllers show the same text on the status screen.

## Boundary Crossing Two Phase Handshake

When a ball's next x position would cross a screen edge, the server computes handoff data including departing screen, arriving screen, entry coordinates, and velocity.

Both boundary_exit and boundary_enter are emitted synchronously in the same execution frame before any await or setImmediate. This guarantees both screens receive the event in the same tick.

Each screen client responds with boundary_ack containing the handoffId and its screenId. The server tracks pending acknowledgments. After 16 milliseconds, if either screen has not acknowledged, both events are emitted again once. A warning is logged if the retry was needed.

The arriving screen runs a 16 millisecond Phaser tween to visually smooth the ball entry at the bezel. The server sets the ball's world x coordinate to the entry position immediately so the next game_state broadcast is consistent.

## Client Side Prediction

Phaser screen clients do not predict physics. They render authoritative positions from the server on every frame. The only client side interpolation is the 16 millisecond boundary enter tween on the arriving screen.

Flutter controllers apply exponential touch smoothing locally for responsive paddle feel, but the server position is always authoritative. The smoothing formula maps finger position to virtual paddle x:

```
raw = (fingerX / stripWidth) * 9600
paddleX = 9600 * (raw / 9600) ^ 1.5
```

The exponent 1.5 reduces sensitivity near the edges and increases precision near the centre of the drag strip, which helps players make fine paddle adjustments on a phone screen.

## Gemini Prompt Engineering

Five event types trigger commentary. Each prompt requests exactly 15 words of retro arcade announcer style text.

### level_cleared

```
The player just cleared level {N}. Scores are {scores}. Generate exactly 15 words of excited retro arcade announcer commentary. Do not mention brick colours. Do not predict future events.
```

### life_lost

```
A player just lost a life. Current lives are {lives}. Generate exactly 15 words of tense retro arcade announcer commentary.
```

Cooldown: 15 seconds before another Gemini call for this event type.

### multi_ball

```
Multi ball just activated with two balls crossing the panoramic rig. Generate exactly 15 words of excited commentary.
```

### score_milestone

```
A player just crossed a score milestone. Scores are {scores}. Generate exactly 15 words of excited retro arcade announcer commentary.
```

Cooldown: 30 seconds before another Gemini call for this event type.

### victory

```
The game is over. Final scores are {scores}. Generate exactly 15 words of triumphant retro arcade announcer commentary declaring the winner.
```

When a cooldown is active or the API call fails, the server selects a random line from the 20 string fallback pool and sets source to fallback. Error code 1005 documents this behaviour in the protocol reference.

## Security Architecture

Six vulnerabilities were identified during design. Each has a specific fix implemented in server/index.js.

**1. Session token timing attacks**

An attacker could guess the 6 digit token faster by measuring response times. The server compares tokens using crypto.timingSafeEqual on equal length buffers so comparison time does not leak information about correct digits.

**2. Replay attacks on paddle input**

An attacker could capture and resend paddle_move messages to jerk paddles or gain advantage. Each message includes a nonce. The server rejects any nonce seen within the previous 100 milliseconds for that player and keeps only the last 50 nonces.

**3. Stale message injection**

An attacker could queue old messages and release them later. The server rejects any message whose timestamp differs from Date.now by more than 500 milliseconds.

**4. Gemini API cost and abuse**

Rapid game events could trigger excessive API calls. The commentaryRateLimiter enforces per event type cooldowns. life_lost has a 15 second cooldown. score_milestone has a 30 second cooldown. When blocked, the server uses local fallback without calling the API.

**5. Nonce and internal state leakage**

Broadcasting the full player object would expose lastNonces arrays to all clients. broadcastGameState maps players to a public shape containing only id, paddleX, paddleWidth, score, and lives.

**6. Disconnect slot churn**

Rapid connect disconnect cycles could deny service to legitimate players. When a socket disconnects, the server waits 5000 milliseconds before releasing the slot. If the same player reconnects within that window via resume_request, the slot remains assigned.

## Virtual Canvas Layout

| Screen | virtualLeft | virtualRight | Width |
|---|---|---|---|
| 1 | 0 | 1919 | 1920 |
| 2 | 1920 | 3839 | 1920 |
| 3 | 3840 | 5759 | 1920 |
| 4 | 5760 | 7679 | 1920 |
| 5 | 7680 | 9599 | 1920 |

Total canvas width: 9600 pixels. Each Phaser client renders at 1920 by 1080 resolution matching one physical LG screen.
