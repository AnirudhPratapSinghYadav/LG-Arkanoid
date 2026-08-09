# LG Arkanoid — End-to-end test report

**Date:** 2026-08-10 (local)  
**Environment:** Windows 10 · Node v24.14.1 (test host) · server `NUM_SCREENS=3` `PORT=3000`  
**Repo:** `E:\Arkanoid Game LG` @ `main` / `fix/lg-production-ready`

## What was tested

| Client | Role | How |
|--------|------|-----|
| 3× screen clients | Chromium kiosk stand-ins | Socket.IO + HTTP inject checks; Chrome windows opened; Puppeteer headless (partial) |
| 2× controllers | Phone / emulator stand-ins | Socket.IO players `Alpha` / `Bravo`; Edge/Chrome `/controller` pages |
| Android emulators | — | **Not available** (no `adb` / `flutter` on PATH) |

> Honest limit: this machine cannot launch Android emulators. Controllers were exercised as Socket.IO clients + browser `/controller` (same protocol the Flutter app uses).

## Verdict

**Core multiplayer loop works.**  
**Socket protocol suite: 24/24 PASS** (join, start, paddle, anti-cheat, resume, screen ticks).  
**Browser UI automation: partial** — 3 screen pages confirmed inject + Phaser canvas when CDN allows; controller join UI loads (screenshots captured). Full headless join is flaky when CDN is slow.

---

## Working

### Server / screens
- `/health` returns `numScreens`, `sessionToken`, `gameStatus`
- `/1` `/2` `/3` inject `SCREEN_ID` + `NUM_SCREENS=3`
- `/4` correctly rejected when configured for 3 screens
- `/controller` serves the browser paddle page
- 3 screen sockets join rooms and receive `game_state`
- Ball ticks continue on screens during play (`balls` array present)

### Players / lobby / match
- 2 players join with valid 4-char token → `join_confirmed` (P1 host, P2)
- Invalid token → `join_rejected` (1001)
- Host `start_game` → `countdown_started` → `gameStatus: playing`
- `game_state` includes `gameStartedAt`, ranks, player names
- Paddle moves update `paddleX` on the authoritative state
- Non-host cannot start match (`1007`)
- `resume_request` restores the same `playerId` after disconnect
- After resume, P2 still receives ticks; screens still receive ticks

### Security / fairness
- `power_up_activate` without inventory → `1012` (cheat blocked)

### Manual browser launch (this session)
- Opened **3 Chrome** windows on `/1` `/2` `/3` (HTTP 200)
- Opened **2 Edge** windows on `/controller` (HTTP 200)

---

## Not working / gaps

| Issue | Severity | Notes |
|-------|----------|--------|
| **No Android emulator / Flutter on this PC** | Test gap | Could not run real APK controllers here |
| **Phaser loaded from CDN** | Medium for offline/LAB | `index.html` pulls Phaser + QRCode from cdnjs — Puppeteer navigations timed out when CDN was slow; self-hosting would harden offline rigs |
| **Web `/controller` has no host Start Match UI** | Medium | Browser controllers can join/paddle; starting the match is Flutter-lobby oriented (or needs a host button) |
| **Lobby `game_state` timing flake in harness** | Low | Both players confirmed joined; one wait-for-state raced a broadcast (fixed in test) |
| **Non-host start uses `join_rejected` event** | Low | Works, but event name is misleading (`error` would be clearer) |
| **Puppeteer full UI path incomplete** | Test tooling | Headless run confirmed 3 screens inject + canvas/io when CDN allowed; controller automation unstable under load |

---

## Detailed Socket.IO results (authoritative)

From `server/tests/e2e-multi-client.test.js` → `e2e-report.json`:

| Check | Result |
|-------|--------|
| GET /health 200 | PASS |
| numScreens === 3 | PASS |
| sessionToken length 4 | PASS |
| Screens /1 /2 /3 inject | PASS |
| Screen /4 rejected | PASS |
| GET /controller | PASS |
| 3 screen sockets | PASS |
| Screens receive game_state | PASS |
| P1 / P2 join_confirmed | PASS |
| Invalid token rejected | PASS |
| Lobby 2 connected | PASS |
| countdown_started | PASS |
| playing + gameStartedAt + ranks | PASS |
| paddle_move updates X | PASS |
| power-up cheat rejected | PASS |
| non-host start blocked | PASS |
| resume_request | PASS |
| P2 + screens after resume | PASS |

**Score: 24 PASS / 0 FAIL** (final re-run)

---

## How to re-run

```bash
# terminal 1
set LG_PASSWORD=lg
set NUM_SCREENS=3
set PORT=3000
node server/index.js

# terminal 2
node server/tests/e2e-multi-client.test.js

# optional browser automation (needs puppeteer-core under server/)
node server/tests/e2e-browser-play.js
```

Manual: open Chrome ×3 → `http://127.0.0.1:3000/1..3`, Edge ×2 → `/controller`, token from `/health`.

---

## Recommended next tests (on your machine / LAB)

1. Install Android Studio emulators ×2 — join with Flutter APK while 3 Chromes show the wall  
2. Self-host Phaser + qrcodejs under `web-client/public/vendor/` for offline LG  
3. Add “Start match” on web controller for host-only  
4. VirtualBox 3-rig per `docs/virtualbox-test-plan.md`  
5. Full match to `time_up` / `game_over` / `win` with two humans
