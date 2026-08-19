# LG Arkanoid — 3-screen · 2-player · 180s

Label **2p**. Automated on **2026-08-19T13:31:29.310Z**. Chrome **Chrome/151.0.7922.109**.
Viewport **1920x1080**. Verdict: **PASS**.

Desk simulation of a Liquid Galaxy wall plus phone controllers in headless Chrome on port **8130**.

## Setup

| Item | Value |
|------|--------|
| Screens | 3 Chromium tabs |
| Players | 2 — Alpha, Bravo |
| Aspect | `LG_FRAME_ASPECT=16:9` |
| Duration | 180 seconds |
| Viewport | 1920x1080 |

## Checks (24 passed / 0 failed)

| Result | Check | Detail |
|--------|-------|--------|
| PASS | Spawned server became healthy | {"status":"ok","numScreens":3,"gameStatus":"lobby","gameActive":false,"connectedPlayers":0,"lanIp":"10.11.77.106","port":8130} |
| PASS | health omits sessionToken | undefined |
| PASS | health numScreens matches wall | 3 |
| PASS | Screen /1 loads Phaser slice | {"id":1,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen /2 loads Phaser slice | {"id":2,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen /3 loads Phaser slice | {"id":3,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen 1 Phaser ready | canvas checked on load |
| PASS | 4-char session token from screen socket | QB22 |
| PASS | Controller 1 page loads | status=200 |
| PASS | Controller 2 page loads | status=200 |
| PASS | All controller join forms filled | Alpha, Bravo |
| PASS | Alpha joined | {"token":"QB22","name":"Alpha"} |
| PASS | Bravo joined | {"token":"QB22","name":"Bravo"} |
| PASS | Alpha is host after join | {"host":true,"connected":true,"playerNumber":1,"spectator":false} |
| PASS | connectedPlayers >= 2 | {"status":"ok","numScreens":3,"gameStatus":"lobby","gameActive":false,"connectedPlayers":2,"lanIp":"10.11.77.106","port":8130} |
| PASS | Match countdown started | countdown |
| PASS | Match reached playing | duration=180 |
| PASS | Rightmost standings have live players on the socket | [{"name":"Alpha","score":0,"lives":3,"connected":true},{"name":"Bravo","score":0,"lives":3,"connected":true}] |
| PASS | Ball entered the center slice | ball_1:2785:535/ball_2:2847:540 |
| PASS | Balls moved on the wall |  |
| PASS | Screen received many ticks | 3567 |
| PASS | All 2 phones still connected | [{"name":"Alpha","score":420,"lives":3,"rank":1,"connected":true},{"name":"Bravo","score":10,"lives":3,"rank":2,"connected":true}] |
| PASS | ARKANOID AI spoke at least once | ["Whistle up. Three. Two. One. Break those bricks.","Alpha stole first from Bravo. The live board just flipped."] |
| PASS | Center-screen 3-minute recording | demo-play/2p/center-2p-3min.mp4 |

## Recording

[center-2p-3min.mp4](demo-play/2p/center-2p-3min.mp4)

## Timeline samples

| t | status | balls | on center | bricks | commentary | scores |
|---|--------|-------|-----------|--------|------------|--------|
| 30s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [] |
| 45s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [{"name":"Bravo","score":0,"lives":3,"rank":1,"x":3610}] |
| 90s | playing | 1 | 1 | 6 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":50,"lives":3,"rank":1,"x":3504},{"name":"Bravo","score":10,"lives":3,"rank":2,"x":3504}] |
| 120s | playing | 1 | 0 | 27 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":260,"lives":3,"rank":1,"x":3738},{"name":"Bravo","score":10,"lives":3,"rank":2,"x":3738}] |
| 150s | playing | 1 | 1 | 42 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":410,"lives":3,"rank":1,"x":3522},{"name":"Bravo","score":10,"lives":3,"rank":2,"x":3522}] |
| 165s | playing | 1 | 1 | 43 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":420,"lives":3,"rank":1,"x":3444},{"name":"Bravo","score":10,"lives":3,"rank":2,"x":3444}] |

## Final

```json
{
  "health": {
    "status": "ok",
    "numScreens": 3,
    "gameStatus": "time_up",
    "gameActive": false,
    "connectedPlayers": 2,
    "lanIp": "10.11.77.106",
    "port": 8130
  },
  "status": "time_up",
  "ticks": 3567,
  "ballMoved": true,
  "sawBallOnCenter": true,
  "maxActiveBalls": 2,
  "bricksDestroyed": 43,
  "commentaryLines": [
    "Whistle up. Three. Two. One. Break those bricks.",
    "Alpha stole first from Bravo. The live board just flipped."
  ],
  "players": [
    {
      "name": "Alpha",
      "score": 420,
      "lives": 3,
      "rank": 1,
      "connected": true
    },
    {
      "name": "Bravo",
      "score": 10,
      "lives": 3,
      "rank": 2,
      "connected": true
    }
  ]
}
```

## Issues

_None._

## Screenshots

- ![01-lobby-screen1.png](demo-play/2p/01-lobby-screen1.png)
- ![01-lobby-screen2.png](demo-play/2p/01-lobby-screen2.png)
- ![01-lobby-screen3.png](demo-play/2p/01-lobby-screen3.png)
- ![01-join-phone1-alpha.png](demo-play/2p/01-join-phone1-alpha.png)
- ![01-join-phone2-bravo.png](demo-play/2p/01-join-phone2-bravo.png)
- ![01b-create-game-host.png](demo-play/2p/01b-create-game-host.png)
- ![01b-joined-guest.png](demo-play/2p/01b-joined-guest.png)
- ![02-whistle-3.png](demo-play/2p/02-whistle-3.png)
- ![02-whistle-2.png](demo-play/2p/02-whistle-2.png)
- ![02-whistle-1.png](demo-play/2p/02-whistle-1.png)
- ![02-whistle-start.png](demo-play/2p/02-whistle-start.png)
- ![02-countdown-screen1.png](demo-play/2p/02-countdown-screen1.png)
- ![02-countdown-screen2.png](demo-play/2p/02-countdown-screen2.png)
- ![02-countdown-screen3.png](demo-play/2p/02-countdown-screen3.png)
- ![03-ball-visible-center.png](demo-play/2p/03-ball-visible-center.png)
- ![03-ball-closeup.png](demo-play/2p/03-ball-closeup.png)
- ![03-commentary-01.png](demo-play/2p/03-commentary-01.png)
- ![03-t030s-screen1.png](demo-play/2p/03-t030s-screen1.png)
- ![03-t030s-screen2.png](demo-play/2p/03-t030s-screen2.png)
- ![03-t030s-screen3.png](demo-play/2p/03-t030s-screen3.png)
- ![03-t030s-phone1.png](demo-play/2p/03-t030s-phone1.png)
- ![03-t030s-phone2.png](demo-play/2p/03-t030s-phone2.png)
- ![03-ball-closeup-t030s.png](demo-play/2p/03-ball-closeup-t030s.png)
- ![03-t045s-screen1.png](demo-play/2p/03-t045s-screen1.png)
- ![03-t045s-screen2.png](demo-play/2p/03-t045s-screen2.png)
- ![03-t045s-screen3.png](demo-play/2p/03-t045s-screen3.png)
- ![03-t045s-phone1.png](demo-play/2p/03-t045s-phone1.png)
- ![03-t045s-phone2.png](demo-play/2p/03-t045s-phone2.png)
- ![03-ball-closeup-t045s.png](demo-play/2p/03-ball-closeup-t045s.png)
- ![03-commentary-02.png](demo-play/2p/03-commentary-02.png)
- ![03-t090s-screen1.png](demo-play/2p/03-t090s-screen1.png)
- ![03-t090s-screen2.png](demo-play/2p/03-t090s-screen2.png)
- ![03-t090s-screen3.png](demo-play/2p/03-t090s-screen3.png)
- ![03-t090s-phone1.png](demo-play/2p/03-t090s-phone1.png)
- ![03-t090s-phone2.png](demo-play/2p/03-t090s-phone2.png)
- ![03-ball-closeup-t090s.png](demo-play/2p/03-ball-closeup-t090s.png)
- ![03-t120s-screen1.png](demo-play/2p/03-t120s-screen1.png)
- ![03-t120s-screen2.png](demo-play/2p/03-t120s-screen2.png)
- ![03-t120s-screen3.png](demo-play/2p/03-t120s-screen3.png)
- ![03-t120s-phone1.png](demo-play/2p/03-t120s-phone1.png)
- ![03-t120s-phone2.png](demo-play/2p/03-t120s-phone2.png)
- ![03-ball-closeup-t120s.png](demo-play/2p/03-ball-closeup-t120s.png)
- ![03-t150s-screen1.png](demo-play/2p/03-t150s-screen1.png)
- ![03-t150s-screen2.png](demo-play/2p/03-t150s-screen2.png)
- ![03-t150s-screen3.png](demo-play/2p/03-t150s-screen3.png)
- ![03-t150s-phone1.png](demo-play/2p/03-t150s-phone1.png)
- ![03-t150s-phone2.png](demo-play/2p/03-t150s-phone2.png)
- ![03-ball-closeup-t150s.png](demo-play/2p/03-ball-closeup-t150s.png)
- ![03-t165s-screen1.png](demo-play/2p/03-t165s-screen1.png)
- ![03-t165s-screen2.png](demo-play/2p/03-t165s-screen2.png)
- ![03-t165s-screen3.png](demo-play/2p/03-t165s-screen3.png)
- ![03-t165s-phone1.png](demo-play/2p/03-t165s-phone1.png)
- ![03-t165s-phone2.png](demo-play/2p/03-t165s-phone2.png)
- ![03-ball-closeup-t165s.png](demo-play/2p/03-ball-closeup-t165s.png)
- ![04-end-screen1.png](demo-play/2p/04-end-screen1.png)
- ![04-end-screen2.png](demo-play/2p/04-end-screen2.png)
- ![04-end-screen3.png](demo-play/2p/04-end-screen3.png)
- ![04-end-phone1.png](demo-play/2p/04-end-phone1.png)
- ![04-end-phone2.png](demo-play/2p/04-end-phone2.png)
