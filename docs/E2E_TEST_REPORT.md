# LG Arkanoid — End-to-end test report

**Date:** 2026-08-10 (local)  
**Environment:** Windows 10 · Node v24 · server `NUM_SCREENS=3` `PORT=8130`  
**Branch:** `polish/final-9`

## What was tested

| Client | Role | How |
|--------|------|-----|
| 3× screen clients | Chromium kiosk stand-ins | Socket.IO + HTTP inject checks |
| 2× controllers | Phone stand-ins | Socket.IO players `Alpha` / `Bravo` |
| Android emulators | — | **Not available** (no `flutter` / `adb` on PATH) |

## Verdict

**Socket protocol suite: 26/26 PASS**  
Includes join, start, paddle, anti-cheat, token-gated resume, and no `sessionToken` leak on `game_state`.

Offline vendor assets (`/js/vendor/phaser.min.js`, `/js/vendor/qrcode.min.js`) return HTTP 200.

---

## Working

### Server / screens
- `/health` returns `numScreens`, `gameStatus`, `lanIp` (join `sessionToken` intentionally omitted — screens get it via `session_info`)
- `/1` `/2` `/3` inject `SCREEN_ID` + `NUM_SCREENS`
- `/4` rejected for 3-screen configs
- `/controller` serves browser paddle page
- `game_state` no longer broadcasts `sessionToken`
- Matches return to lobby after end (`lobby_ready`)

### Players / lobby / match
- Valid join → `join_confirmed`
- Invalid token → `join_rejected` (1001)
- Host start → countdown → playing with `gameStartedAt` + ranks
- Paddle moves update authoritative `paddleX`
- Non-host cannot start (`1007`)
- Resume without token rejected; resume with token restores slot
- Dead players (`lives === 0`) no longer collide with paddles
- Host disconnect reassigns master immediately

### Security / fairness
- `power_up_activate` without inventory → `1012`
- Double-join from one socket rejected
- HTTP rate limit skips static/socket assets (multi-screen safe)

### Web controller
- Inventory-gated power-ups
- Host **Start Match** button
- Spectator message when lobby full
- Local `/socket.io/socket.io.js` (no CDN)

---

## Gaps (honest)

| Issue | Severity | Notes |
|-------|----------|--------|
| No Android emulator on this PC | Test gap | Flutter protocol matches Socket.IO suite; APK not launched here |
| `/health` does not expose session token | Security | Join code is pushed only to panoramic screen sockets (`session_info`) |
| Gemini level gen needs API key + network | Optional | Token budget raised; falls back to built-in levels if Gemini fails |

---

## How to re-run

> The default port moved to **8130** after this run (see the port table in the
> root README), so `PORT` no longer needs to be set by hand.

```bash
# terminal 1
set LG_PASSWORD=lq
set NUM_SCREENS=3
node server/index.js

# terminal 2
npm test
node server/tests/e2e-multi-client.test.js
```
