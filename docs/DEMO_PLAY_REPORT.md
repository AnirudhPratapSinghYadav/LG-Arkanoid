# LG Arkanoid — 3-screen · 2-phone · 3-minute Chrome play

Automated on **2026-08-19T12:43:09.381Z**. Chrome **Chrome/151.0.7922.109**.
Match length **60s**. Verdict: **PASS**.

This is a desk simulation of a 3-frame Liquid Galaxy wall plus two phone controllers.
It uses Google Chrome (headless) against a local Node 16-compatible server on port **8130**.
It does **not** replace a real-rig test (SSH, iptables, portrait `DHCP_RANDR`).

## Setup

| Item | Value |
|------|--------|
| Screens | 3 Chromium tabs at `/1` `/2` `/3` |
| Phones | 2 Chromium tabs at `/controller` (Alpha, Bravo) |
| Aspect | `LG_FRAME_ASPECT=16:9` (monitor, not portrait rig) |
| Duration | 60 seconds |
| Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

## Checks (23 passed / 0 failed)

| Result | Check | Detail |
|--------|-------|--------|
| PASS | Spawned server became healthy | {"status":"ok","numScreens":3,"gameStatus":"lobby","gameActive":false,"connectedPlayers":0,"lanIp":"10.11.77.106","port":8130} |
| PASS | health omits sessionToken | undefined |
| PASS | health numScreens is 3 | 3 |
| PASS | Screen /1 loads Phaser slice | {"id":1,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"code":""} |
| PASS | Screen /2 loads Phaser slice | {"id":2,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"code":"I6DX"} |
| PASS | Screen /3 loads Phaser slice | {"id":3,"num":3,"w":1920,"h":1080,"hasIo":true,"hasPhaser":true,"canvas":true,"code":""} |
| PASS | Screen 1 Phaser ready | canvas checked on load |
| PASS | 4-char session token from screen socket | I6DX |
| PASS | Center-screen QR code matches socket token | I6DX vs I6DX |
| PASS | Controller 1 page loads | status=200 |
| PASS | Controller 2 page loads | status=200 |
| PASS | Phone 1 controller UI ready | Alpha + token filled |
| PASS | Phone 2 controller UI ready | Bravo + token filled |
| PASS | Alpha join payload 4-char token | {"token":"I6DX","name":"Alpha"} |
| PASS | Bravo join payload 4-char token | {"token":"I6DX","name":"Bravo"} |
| PASS | Alpha is host after join | {"host":true,"connected":true,"playerNumber":1,"spectator":false} |
| PASS | connectedPlayers >= 2 | {"status":"ok","numScreens":3,"gameStatus":"lobby","gameActive":false,"connectedPlayers":2,"lanIp":"10.11.77.106","port":8130} |
| PASS | Center screen match mode hides LG Arkanoid mark | {"stage":"playing","playing":true,"brand":"none"} |
| PASS | Match reached playing | duration=60 |
| PASS | Rightmost screen shows live standings | {"stage":"playing","status":"playing","standings":true,"commentary":"Whistle up. Three. Two. One. Break those bricks.","lives":[{"name":"Alpha","score":0,"lives":3,"rank":1},{"name":"Bravo","score":0,"lives":3,"rank":2}]} |
| PASS | Balls moved on the wall |  |
| PASS | Screen received many ticks | 2930 |
| PASS | Both phones still connected | [{"name":"Alpha","score":360,"lives":3,"connected":true},{"name":"Bravo","score":250,"lives":3,"connected":true},{"name":null,"score":0,"lives":3,"connected":false}] |

## Timeline samples

| t | status | ticks | balls | bricks hit | scores |
|---|--------|-------|-------|------------|--------|
| 10s | playing | 317 | 2 | 2 | [{"name":"Alpha","score":10,"lives":3,"rank":1,"x":2223},{"name":"Bravo","score":10,"lives":3,"rank":2,"x":3014}] |
| 30s | playing | 1359 | 2 | 19 | [{"name":"Alpha","score":150,"lives":3,"rank":1,"x":1218},{"name":"Bravo","score":90,"lives":3,"rank":2,"x":3072}] |
| 55s | playing | 2635 | 2 | 46 | [{"name":"Alpha","score":330,"lives":3,"rank":1,"x":2595},{"name":"Bravo","score":180,"lives":3,"rank":2,"x":4095}] |

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
  "ticks": 2930,
  "ballMoved": true,
  "maxActiveBalls": 2,
  "bricksDestroyed": 51,
  "players": [
    {
      "name": "Alpha",
      "score": 360,
      "lives": 3,
      "connected": true
    },
    {
      "name": "Bravo",
      "score": 250,
      "lives": 3,
      "connected": true
    },
    {
      "name": null,
      "score": 0,
      "lives": 3,
      "connected": false
    }
  ]
}
```

## Issues

_None._

## Screenshots

- ![01-lobby-screen1.png](demo-play/01-lobby-screen1.png)
- ![01-lobby-screen2.png](demo-play/01-lobby-screen2.png)
- ![01-lobby-screen3.png](demo-play/01-lobby-screen3.png)
- ![01-lobby-phone1.png](demo-play/01-lobby-phone1.png)
- ![01-lobby-phone2.png](demo-play/01-lobby-phone2.png)
- ![01b-create-game-phone1.png](demo-play/01b-create-game-phone1.png)
- ![01b-joined-phone2.png](demo-play/01b-joined-phone2.png)
- ![02-countdown-screen1.png](demo-play/02-countdown-screen1.png)
- ![02-countdown-screen2.png](demo-play/02-countdown-screen2.png)
- ![02-countdown-screen3.png](demo-play/02-countdown-screen3.png)
- ![03-t010s-screen1.png](demo-play/03-t010s-screen1.png)
- ![03-t010s-screen2.png](demo-play/03-t010s-screen2.png)
- ![03-t010s-screen3.png](demo-play/03-t010s-screen3.png)
- ![03-t010s-phone1.png](demo-play/03-t010s-phone1.png)
- ![03-t010s-phone2.png](demo-play/03-t010s-phone2.png)
- ![03-t030s-screen1.png](demo-play/03-t030s-screen1.png)
- ![03-t030s-screen2.png](demo-play/03-t030s-screen2.png)
- ![03-t030s-screen3.png](demo-play/03-t030s-screen3.png)
- ![03-t030s-phone1.png](demo-play/03-t030s-phone1.png)
- ![03-t030s-phone2.png](demo-play/03-t030s-phone2.png)
- ![03-t055s-screen1.png](demo-play/03-t055s-screen1.png)
- ![03-t055s-screen2.png](demo-play/03-t055s-screen2.png)
- ![03-t055s-screen3.png](demo-play/03-t055s-screen3.png)
- ![03-t055s-phone1.png](demo-play/03-t055s-phone1.png)
- ![03-t055s-phone2.png](demo-play/03-t055s-phone2.png)
- ![04-end-screen1.png](demo-play/04-end-screen1.png)
- ![04-end-screen2.png](demo-play/04-end-screen2.png)
- ![04-end-screen3.png](demo-play/04-end-screen3.png)
- ![04-end-phone1.png](demo-play/04-end-phone1.png)
- ![04-end-phone2.png](demo-play/04-end-phone2.png)

## What this does **not** prove

- Slave-frame SSH (`lg2` / `lg3`) and `chromium-browser` on Ubuntu 16.04
- Portrait 608×1080 court from `DHCP_RANDR=right`
- Flutter APK SSH **LAUNCH ON RIG**
- `/etc/iptables.conf` port 8130 after reboot

Run those on VirtualBox or the LAB wall. See [virtualbox-test-plan.md](virtualbox-test-plan.md).
