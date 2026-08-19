# LG Arkanoid — 5-screen · 5-player · 180s

Label **5p**. Automated on **2026-08-19T13:38:07.006Z**. Chrome **Chrome/151.0.7922.109**.
Viewport **1920x1080**. Verdict: **FAIL**.

Desk simulation of a Liquid Galaxy wall plus phone controllers in headless Chrome on port **8130**.

## Setup

| Item | Value |
|------|--------|
| Screens | 5 Chromium tabs |
| Players | 5 — Alpha, Bravo, Charlie, Delta, Echo |
| Aspect | `LG_FRAME_ASPECT=16:9` |
| Duration | 180 seconds |
| Viewport | 1920x1080 |

## Checks (32 passed / 1 failed)

| Result | Check | Detail |
|--------|-------|--------|
| PASS | Spawned server became healthy | {"status":"ok","numScreens":5,"gameStatus":"lobby","gameActive":false,"connectedPlayers":0,"lanIp":"10.11.77.106","port":8130} |
| PASS | health omits sessionToken | undefined |
| PASS | health numScreens matches wall | 5 |
| PASS | Screen /1 loads Phaser slice | {"id":1,"num":5,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen /2 loads Phaser slice | {"id":2,"num":5,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen /3 loads Phaser slice | {"id":3,"num":5,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":"OHM9"} |
| PASS | Screen /4 loads Phaser slice | {"id":4,"num":5,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen /5 loads Phaser slice | {"id":5,"num":5,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"canvasW":1920,"canvasH":1080,"code":""} |
| PASS | Screen 1 Phaser ready | canvas checked on load |
| PASS | 4-char session token from screen socket | OHM9 |
| PASS | Center-screen QR code matches socket token | OHM9 vs OHM9 |
| PASS | Controller 1 page loads | status=200 |
| PASS | Controller 2 page loads | status=200 |
| PASS | Controller 3 page loads | status=200 |
| PASS | Controller 4 page loads | status=200 |
| PASS | Controller 5 page loads | status=200 |
| PASS | All controller join forms filled | Alpha, Bravo, Charlie, Delta, Echo |
| PASS | Alpha joined | {"token":"OHM9","name":"Alpha"} |
| PASS | Bravo joined | {"token":"OHM9","name":"Bravo"} |
| PASS | Charlie joined | {"token":"OHM9","name":"Charlie"} |
| PASS | Delta joined | {"token":"OHM9","name":"Delta"} |
| PASS | Echo joined | {"token":"OHM9","name":"Echo"} |
| PASS | Alpha is host after join | {"host":true,"connected":true,"playerNumber":1,"spectator":false} |
| PASS | connectedPlayers >= 5 | {"status":"ok","numScreens":5,"gameStatus":"lobby","gameActive":false,"connectedPlayers":5,"lanIp":"10.11.77.106","port":8130} |
| PASS | Match countdown started | countdown |
| PASS | Match reached playing | duration=180 |
| PASS | Rightmost standings have live players on the socket | [{"name":"Alpha","score":0,"lives":3,"connected":true},{"name":"Bravo","score":0,"lives":3,"connected":true},{"name":"Charlie","score":0,"lives":3,"connected":true},{"name":"Delta","score":0,"lives":3,"connected":true},{"name":"Echo","score":0,"lives":3,"connected":true}] |
| PASS | Ball entered the center slice | ball_1:4765:787/ball_2:4409:828/ball_3:4800:500/ball_4:4920:500/ball_5:5040:500 |
| PASS | Balls moved on the wall |  |
| PASS | Screen received many ticks | 333 |
| FAIL | All 5 phones still connected | [{"name":null,"score":0,"lives":3,"rank":null,"connected":false},{"name":"Bravo","score":0,"lives":3,"rank":1,"connected":true},{"name":"Charlie","score":0,"lives":3,"rank":2,"connected":true},{"name":"Delta","score":0,"lives":3,"rank":3,"connected":true},{"name":"Echo","score":0,"lives":3,"rank":4,"connected":true}] |
| PASS | ARKANOID AI spoke at least once | ["Whistle up. Three. Two. One. Break those bricks.","Alpha stole first from Bravo. The live board just flipped.","Delta stole first from Echo. The live board just flipped.","the field takes the Liquid Galaxy wall. That is the champion — match over."] |
| PASS | Center-screen 3-minute recording | demo-play/5p/center-5p-3min.mp4 |

## Recording

[center-5p-3min.mp4](demo-play/5p/center-5p-3min.mp4)

## Timeline samples

| t | status | balls | on center | bricks | commentary | scores |
|---|--------|-------|-----------|--------|------------|--------|
| 5s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [{"name":"Alpha","score":0,"lives":3,"rank":1,"x":2730},{"name":"Bravo","score":0,"lives":3,"rank":2,"x":4224},{"name":"Charlie","score":0,"lives":3,"rank":3,"x":4767},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4650},{"name":"Echo","score":0,"lives":3,"rank":5,"x":6570}] |
| 15s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [{"name":"Alpha","score":0,"lives":3,"rank":1,"x":3050},{"name":"Bravo","score":0,"lives":3,"rank":2,"x":4117},{"name":"Charlie","score":0,"lives":3,"rank":3,"x":4767},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4650},{"name":"Echo","score":0,"lives":3,"rank":5,"x":6570}] |
| 30s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [{"name":"Alpha","score":0,"lives":3,"rank":1,"x":3370},{"name":"Bravo","score":0,"lives":3,"rank":2,"x":3881},{"name":"Charlie","score":0,"lives":3,"rank":3,"x":4767},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4767},{"name":"Echo","score":0,"lives":3,"rank":5,"x":5930}] |
| 45s | playing | 2 | 2 | 0 | Whistle up. Three. Two. One. Break those bricks. | [{"name":"Alpha","score":0,"lives":3,"rank":1,"x":3690},{"name":"Bravo","score":0,"lives":3,"rank":2,"x":3934},{"name":"Charlie","score":0,"lives":3,"rank":3,"x":4758},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4758},{"name":"Echo","score":0,"lives":3,"rank":5,"x":5610}] |
| 60s | playing | 2 | 1 | 2 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":0,"lives":3,"rank":3,"x":3764},{"name":"Bravo","score":10,"lives":3,"rank":1,"x":3764},{"name":"Charlie","score":10,"lives":3,"rank":2,"x":4749},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4749},{"name":"Echo","score":0,"lives":3,"rank":5,"x":5610}] |
| 90s | playing | 2 | 1 | 2 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Alpha","score":0,"lives":3,"rank":3,"x":3764},{"name":"Bravo","score":10,"lives":3,"rank":1,"x":3124},{"name":"Charlie","score":10,"lives":3,"rank":2,"x":4726},{"name":"Delta","score":0,"lives":3,"rank":4,"x":4726},{"name":"Echo","score":0,"lives":3,"rank":5,"x":4726}] |
| 120s | playing | 2 | 1 | 2 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Bravo","score":10,"lives":3,"rank":1,"x":3153},{"name":"Charlie","score":10,"lives":3,"rank":2,"x":4726},{"name":"Delta","score":0,"lives":3,"rank":3,"x":4726},{"name":"Echo","score":0,"lives":3,"rank":4,"x":4482}] |
| 150s | playing | 2 | 1 | 2 | Alpha stole first from Bravo. The live board just flipped. | [{"name":"Bravo","score":10,"lives":3,"rank":1,"x":3153},{"name":"Charlie","score":10,"lives":3,"rank":2,"x":4726},{"name":"Delta","score":0,"lives":3,"rank":3,"x":4726},{"name":"Echo","score":0,"lives":3,"rank":4,"x":4726}] |
| 165s | playing | 2 | 1 | 2 | Delta stole first from Echo. The live board just flipped. | [] |
| 178s | time_up | 2 | 1 | 2 | the field takes the Liquid Galaxy wall. That is the champion — match over. | [{"name":"Bravo","score":10,"lives":3,"rank":1,"x":3153}] |

## Final

```json
{
  "health": {
    "status": "ok",
    "numScreens": 5,
    "gameStatus": "time_up",
    "gameActive": false,
    "connectedPlayers": 4,
    "lanIp": "10.11.77.106",
    "port": 8130
  },
  "status": "time_up",
  "ticks": 333,
  "ballMoved": true,
  "sawBallOnCenter": true,
  "maxActiveBalls": 2,
  "bricksDestroyed": 2,
  "commentaryLines": [
    "Whistle up. Three. Two. One. Break those bricks.",
    "Alpha stole first from Bravo. The live board just flipped.",
    "Delta stole first from Echo. The live board just flipped.",
    "the field takes the Liquid Galaxy wall. That is the champion — match over."
  ],
  "players": [
    {
      "name": null,
      "score": 0,
      "lives": 3,
      "rank": null,
      "connected": false
    },
    {
      "name": "Bravo",
      "score": 0,
      "lives": 3,
      "rank": 1,
      "connected": true
    },
    {
      "name": "Charlie",
      "score": 0,
      "lives": 3,
      "rank": 2,
      "connected": true
    },
    {
      "name": "Delta",
      "score": 0,
      "lives": 3,
      "rank": 3,
      "connected": true
    },
    {
      "name": "Echo",
      "score": 0,
      "lives": 3,
      "rank": 4,
      "connected": true
    }
  ]
}
```

## Issues

- All 5 phones still connected: [{"name":null,"score":0,"lives":3,"rank":null,"connected":false},{"name":"Bravo","score":0,"lives":3,"rank":1,"connected":true},{"name":"Charlie","score":0,"lives":3,"rank":2,"connected":true},{"name":"Delta","score":0,"lives":3,"rank":3,"connected":true},{"name":"Echo","score":0,"lives":3,"rank":4,"connected":true}]

## Screenshots

- ![01-lobby-screen1.png](demo-play/5p/01-lobby-screen1.png)
- ![01-lobby-screen2.png](demo-play/5p/01-lobby-screen2.png)
- ![01-lobby-screen3.png](demo-play/5p/01-lobby-screen3.png)
- ![01-lobby-screen4.png](demo-play/5p/01-lobby-screen4.png)
- ![01-lobby-screen5.png](demo-play/5p/01-lobby-screen5.png)
- ![01-join-phone1-alpha.png](demo-play/5p/01-join-phone1-alpha.png)
- ![01-join-phone2-bravo.png](demo-play/5p/01-join-phone2-bravo.png)
- ![01-join-phone3-charlie.png](demo-play/5p/01-join-phone3-charlie.png)
- ![01-join-phone4-delta.png](demo-play/5p/01-join-phone4-delta.png)
- ![01-join-phone5-echo.png](demo-play/5p/01-join-phone5-echo.png)
- ![01b-create-game-host.png](demo-play/5p/01b-create-game-host.png)
- ![01b-joined-guest.png](demo-play/5p/01b-joined-guest.png)
- ![02-whistle-3.png](demo-play/5p/02-whistle-3.png)
- ![02-whistle-2.png](demo-play/5p/02-whistle-2.png)
- ![02-whistle-1.png](demo-play/5p/02-whistle-1.png)
- ![02-whistle-start.png](demo-play/5p/02-whistle-start.png)
- ![02-countdown-screen1.png](demo-play/5p/02-countdown-screen1.png)
- ![02-countdown-screen2.png](demo-play/5p/02-countdown-screen2.png)
- ![02-countdown-screen3.png](demo-play/5p/02-countdown-screen3.png)
- ![02-countdown-screen4.png](demo-play/5p/02-countdown-screen4.png)
- ![02-countdown-screen5.png](demo-play/5p/02-countdown-screen5.png)
- ![03-ball-visible-center.png](demo-play/5p/03-ball-visible-center.png)
- ![03-ball-closeup.png](demo-play/5p/03-ball-closeup.png)
- ![03-commentary-01.png](demo-play/5p/03-commentary-01.png)
- ![03-t005s-screen1.png](demo-play/5p/03-t005s-screen1.png)
- ![03-t005s-screen2.png](demo-play/5p/03-t005s-screen2.png)
- ![03-t005s-screen3.png](demo-play/5p/03-t005s-screen3.png)
- ![03-t005s-screen4.png](demo-play/5p/03-t005s-screen4.png)
- ![03-t005s-screen5.png](demo-play/5p/03-t005s-screen5.png)
- ![03-t005s-phone1.png](demo-play/5p/03-t005s-phone1.png)
- ![03-t005s-phone2.png](demo-play/5p/03-t005s-phone2.png)
- ![03-t005s-phone3.png](demo-play/5p/03-t005s-phone3.png)
- ![03-t005s-phone4.png](demo-play/5p/03-t005s-phone4.png)
- ![03-t005s-phone5.png](demo-play/5p/03-t005s-phone5.png)
- ![03-ball-closeup-t005s.png](demo-play/5p/03-ball-closeup-t005s.png)
- ![03-t015s-screen1.png](demo-play/5p/03-t015s-screen1.png)
- ![03-t015s-screen2.png](demo-play/5p/03-t015s-screen2.png)
- ![03-t015s-screen3.png](demo-play/5p/03-t015s-screen3.png)
- ![03-t015s-screen4.png](demo-play/5p/03-t015s-screen4.png)
- ![03-t015s-screen5.png](demo-play/5p/03-t015s-screen5.png)
- ![03-t015s-phone1.png](demo-play/5p/03-t015s-phone1.png)
- ![03-t015s-phone2.png](demo-play/5p/03-t015s-phone2.png)
- ![03-t015s-phone3.png](demo-play/5p/03-t015s-phone3.png)
- ![03-t015s-phone4.png](demo-play/5p/03-t015s-phone4.png)
- ![03-t015s-phone5.png](demo-play/5p/03-t015s-phone5.png)
- ![03-ball-closeup-t015s.png](demo-play/5p/03-ball-closeup-t015s.png)
- ![03-t030s-screen1.png](demo-play/5p/03-t030s-screen1.png)
- ![03-t030s-screen2.png](demo-play/5p/03-t030s-screen2.png)
- ![03-t030s-screen3.png](demo-play/5p/03-t030s-screen3.png)
- ![03-t030s-screen4.png](demo-play/5p/03-t030s-screen4.png)
- ![03-t030s-screen5.png](demo-play/5p/03-t030s-screen5.png)
- ![03-t030s-phone1.png](demo-play/5p/03-t030s-phone1.png)
- ![03-t030s-phone2.png](demo-play/5p/03-t030s-phone2.png)
- ![03-t030s-phone3.png](demo-play/5p/03-t030s-phone3.png)
- ![03-t030s-phone4.png](demo-play/5p/03-t030s-phone4.png)
- ![03-t030s-phone5.png](demo-play/5p/03-t030s-phone5.png)
- ![03-ball-closeup-t030s.png](demo-play/5p/03-ball-closeup-t030s.png)
- ![03-t045s-screen1.png](demo-play/5p/03-t045s-screen1.png)
- ![03-t045s-screen2.png](demo-play/5p/03-t045s-screen2.png)
- ![03-t045s-screen3.png](demo-play/5p/03-t045s-screen3.png)
- ![03-t045s-screen4.png](demo-play/5p/03-t045s-screen4.png)
- ![03-t045s-screen5.png](demo-play/5p/03-t045s-screen5.png)
- ![03-t045s-phone1.png](demo-play/5p/03-t045s-phone1.png)
- ![03-t045s-phone2.png](demo-play/5p/03-t045s-phone2.png)
- ![03-t045s-phone3.png](demo-play/5p/03-t045s-phone3.png)
- ![03-t045s-phone4.png](demo-play/5p/03-t045s-phone4.png)
- ![03-t045s-phone5.png](demo-play/5p/03-t045s-phone5.png)
- ![03-ball-closeup-t045s.png](demo-play/5p/03-ball-closeup-t045s.png)
- ![03-t060s-screen1.png](demo-play/5p/03-t060s-screen1.png)
- ![03-t060s-screen2.png](demo-play/5p/03-t060s-screen2.png)
- ![03-t060s-screen3.png](demo-play/5p/03-t060s-screen3.png)
- ![03-t060s-screen4.png](demo-play/5p/03-t060s-screen4.png)
- ![03-t060s-screen5.png](demo-play/5p/03-t060s-screen5.png)
- ![03-t060s-phone1.png](demo-play/5p/03-t060s-phone1.png)
- ![03-t060s-phone2.png](demo-play/5p/03-t060s-phone2.png)
- ![03-t060s-phone3.png](demo-play/5p/03-t060s-phone3.png)
- ![03-t060s-phone4.png](demo-play/5p/03-t060s-phone4.png)
- ![03-t060s-phone5.png](demo-play/5p/03-t060s-phone5.png)
- ![03-ball-closeup-t060s.png](demo-play/5p/03-ball-closeup-t060s.png)
- ![03-commentary-02.png](demo-play/5p/03-commentary-02.png)
- ![03-t090s-screen1.png](demo-play/5p/03-t090s-screen1.png)
- ![03-t090s-screen2.png](demo-play/5p/03-t090s-screen2.png)
- ![03-t090s-screen3.png](demo-play/5p/03-t090s-screen3.png)
- ![03-t090s-screen4.png](demo-play/5p/03-t090s-screen4.png)
- ![03-t090s-screen5.png](demo-play/5p/03-t090s-screen5.png)
- ![03-t090s-phone1.png](demo-play/5p/03-t090s-phone1.png)
- ![03-t090s-phone2.png](demo-play/5p/03-t090s-phone2.png)
- ![03-t090s-phone3.png](demo-play/5p/03-t090s-phone3.png)
- ![03-t090s-phone4.png](demo-play/5p/03-t090s-phone4.png)
- ![03-t090s-phone5.png](demo-play/5p/03-t090s-phone5.png)
- ![03-ball-closeup-t090s.png](demo-play/5p/03-ball-closeup-t090s.png)
- ![03-t120s-screen1.png](demo-play/5p/03-t120s-screen1.png)
- ![03-t120s-screen2.png](demo-play/5p/03-t120s-screen2.png)
- ![03-t120s-screen3.png](demo-play/5p/03-t120s-screen3.png)
- ![03-t120s-screen4.png](demo-play/5p/03-t120s-screen4.png)
- ![03-t120s-screen5.png](demo-play/5p/03-t120s-screen5.png)
- ![03-t120s-phone1.png](demo-play/5p/03-t120s-phone1.png)
- ![03-t120s-phone2.png](demo-play/5p/03-t120s-phone2.png)
- ![03-t120s-phone3.png](demo-play/5p/03-t120s-phone3.png)
- ![03-t120s-phone4.png](demo-play/5p/03-t120s-phone4.png)
- ![03-t120s-phone5.png](demo-play/5p/03-t120s-phone5.png)
- ![03-ball-closeup-t120s.png](demo-play/5p/03-ball-closeup-t120s.png)
- ![03-t150s-screen1.png](demo-play/5p/03-t150s-screen1.png)
- ![03-t150s-screen2.png](demo-play/5p/03-t150s-screen2.png)
- ![03-t150s-screen3.png](demo-play/5p/03-t150s-screen3.png)
- ![03-t150s-screen4.png](demo-play/5p/03-t150s-screen4.png)
- ![03-t150s-screen5.png](demo-play/5p/03-t150s-screen5.png)
- ![03-t150s-phone1.png](demo-play/5p/03-t150s-phone1.png)
- ![03-t150s-phone2.png](demo-play/5p/03-t150s-phone2.png)
- ![03-t150s-phone3.png](demo-play/5p/03-t150s-phone3.png)
- ![03-t150s-phone4.png](demo-play/5p/03-t150s-phone4.png)
- ![03-t150s-phone5.png](demo-play/5p/03-t150s-phone5.png)
- ![03-ball-closeup-t150s.png](demo-play/5p/03-ball-closeup-t150s.png)
- ![03-t165s-screen1.png](demo-play/5p/03-t165s-screen1.png)
- ![03-t165s-screen2.png](demo-play/5p/03-t165s-screen2.png)
- ![03-t165s-screen3.png](demo-play/5p/03-t165s-screen3.png)
- ![03-t165s-screen4.png](demo-play/5p/03-t165s-screen4.png)
- ![03-t165s-screen5.png](demo-play/5p/03-t165s-screen5.png)
- ![03-t165s-phone1.png](demo-play/5p/03-t165s-phone1.png)
- ![03-t165s-phone2.png](demo-play/5p/03-t165s-phone2.png)
- ![03-t165s-phone3.png](demo-play/5p/03-t165s-phone3.png)
- ![03-t165s-phone4.png](demo-play/5p/03-t165s-phone4.png)
- ![03-t165s-phone5.png](demo-play/5p/03-t165s-phone5.png)
- ![03-ball-closeup-t165s.png](demo-play/5p/03-ball-closeup-t165s.png)
- ![03-commentary-03.png](demo-play/5p/03-commentary-03.png)
- ![03-t178s-screen1.png](demo-play/5p/03-t178s-screen1.png)
- ![03-t178s-screen2.png](demo-play/5p/03-t178s-screen2.png)
- ![03-t178s-screen3.png](demo-play/5p/03-t178s-screen3.png)
- ![03-t178s-screen4.png](demo-play/5p/03-t178s-screen4.png)
- ![03-t178s-screen5.png](demo-play/5p/03-t178s-screen5.png)
- ![03-t178s-phone1.png](demo-play/5p/03-t178s-phone1.png)
- ![03-t178s-phone2.png](demo-play/5p/03-t178s-phone2.png)
- ![03-t178s-phone3.png](demo-play/5p/03-t178s-phone3.png)
- ![03-t178s-phone4.png](demo-play/5p/03-t178s-phone4.png)
- ![03-t178s-phone5.png](demo-play/5p/03-t178s-phone5.png)
- ![03-ball-closeup-t178s.png](demo-play/5p/03-ball-closeup-t178s.png)
- ![04-end-screen1.png](demo-play/5p/04-end-screen1.png)
- ![04-end-screen2.png](demo-play/5p/04-end-screen2.png)
- ![04-end-screen3.png](demo-play/5p/04-end-screen3.png)
- ![04-end-screen4.png](demo-play/5p/04-end-screen4.png)
- ![04-end-screen5.png](demo-play/5p/04-end-screen5.png)
- ![04-end-phone1.png](demo-play/5p/04-end-phone1.png)
- ![04-end-phone2.png](demo-play/5p/04-end-phone2.png)
- ![04-end-phone3.png](demo-play/5p/04-end-phone3.png)
- ![04-end-phone4.png](demo-play/5p/04-end-phone4.png)
- ![04-end-phone5.png](demo-play/5p/04-end-phone5.png)
