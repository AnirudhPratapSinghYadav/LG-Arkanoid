# LG Arkanoid

Panoramic multiplayer Arkanoid for a [Liquid Galaxy](https://www.liquidgalaxy.eu/) wall.

Phones (or a browser tab) are the paddles. The court is drawn on the screens. The match server always listens on **port 8130**.

**Contributor:** [Anirudh Pratap Singh Yadav](https://github.com/AnirudhPratapSinghYadav)  
**Mentor:** [Sidharth Mudgil](https://github.com/SidharthMudgil)  
**Org:** Liquid Galaxy · Gemini Summer of Code 2026

Use **section A** on a laptop. Use **section B** on the phone. Use **section C** only on a Liquid Galaxy rig.

---

## A. Run on your computer

This is the full app on one machine: wall slices in the browser + paddle in another tab (or the phone).

### A1. What you need

- Git
- **Node.js 16 or newer** (`node -v`). Node 18 or 20 is fine on a laptop.
- A browser (Chrome / Edge / Firefox)

Optional: Flutter 3.24.x if you want the Android app instead of the browser paddle.

### A2. Clone and install

```bash
git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git
cd LG-Arkanoid
npm install
```

### A3. Create the env file

Linux / macOS:

```bash
cp server/.env.example server/.env
```

Windows (PowerShell):

```powershell
Copy-Item server\.env.example server\.env
```

Open `server/.env` and set at least:

```
PORT=8130
NUM_SCREENS=3
LG_PASSWORD=lq
GEMINI_API_KEY=
LG_FRAME_ASPECT=16:9
```

Leave `GEMINI_API_KEY` empty. The match still runs. `16:9` is for a normal laptop screen (the wall is portrait by default).

### A4. Start the server

```bash
npm start
```

Leave this terminal open. You should see the game server on **8130**.

Check it:

```bash
curl http://127.0.0.1:8130/health
```

You want `"status":"ok"`. That JSON never includes the join code.

### A5. Open the wall (browser)

Open **three** tabs (because `NUM_SCREENS=3`):

| Tab | URL | What it is |
|---|---|---|
| 1 | http://localhost:8130/1 | Left slice |
| 2 | http://localhost:8130/2 | Center — **QR + 4-letter code** |
| 3 | http://localhost:8130/3 | Right slice |

The center tab shows the session code and a join URL like `http://<your-ip>:8130/controller?c=ABCD`.

### A6. Open a paddle on the same computer

New tab:

```
http://localhost:8130/controller
```

1. Type a name.
2. Paste the **4-letter code** from the center wall tab (or the `?c=` value in the URL).
3. Join. First player is **HOST**.
4. Open a **second** controller tab, different name, same code (you need two paddles to start with the default settings).
5. On the host tab: **CREATE & START**.
6. Hold **LEFT** / **RIGHT**.

That is the whole game on one PC. No phone required.

---

## B. Run on the phone

The phone is only a paddle. The match still runs on the computer (section A) or on the Liquid Galaxy master (section C). Both devices must be on the **same Wi‑Fi**. Turn off mobile data and VPN.

Never type hostname `lg1`. Phones cannot resolve it. Never use SSH port **22** as the game port. The game is always **8130**.

### B1. Fastest: phone browser (no APK)

1. Finish section A so the server is running.
2. On the computer, find the IPv4 printed under the center QR (or your Wi‑Fi IPv4, e.g. `192.168.1.42`).
3. On the phone browser open:

   `http://<that-ipv4>:8130/controller?c=CODE`

   Replace `CODE` with the 4-letter code on the center screen.
4. Enter a name → join. First phone is HOST.
5. Second phone (or a laptop controller tab) joins the same code.
6. Host taps **CREATE & START**. Hold **LEFT** / **RIGHT**.

### B2. Flutter app (run from source)

On the computer, with a phone plugged in (USB debugging) or an emulator:

```bash
cd mobile
flutter pub get
flutter run
```

Then in the app:

1. **Scan QR** on the center wall screen, **or**
2. **Manual entry**: host IP = the computer’s Wi‑Fi IPv4, port **8130**, 4-letter code.
3. Enter a name → join → host starts → hold LEFT / RIGHT.

Android emulator join IP is **`10.0.2.2`** (that is the host PC), port **8130**. USB debugging with `adb reverse tcp:8130 tcp:8130` can use `127.0.0.1`.

### B3. Install the APK

On the computer:

```bash
cd mobile
flutter pub get
flutter build apk --release --split-per-abi
```

Install `mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` on a current phone (`app-armeabi-v7a-release.apk` on 32-bit).

App name: **AI Arkanoid LG**. Then follow B2 from “Scan QR”.

### B4. How a match plays

1. First joiner is HOST. They pick players / speed / time if they want, then **CREATE & START**.
2. 3-second countdown. Ball sits on the host paddle, then launches up into the bricks.
3. Hold **LEFT** / **RIGHT**. 3 lives. Power-ups: wide, slow, multi, bomb.
4. **TIME LEFT** is on every slice. Standings are on the rightmost slice.
5. **LEAVE** exits. After a match the host can play again or return to lobby.

---

## C. Run on a Liquid Galaxy wall

Do this on **lg1** only (user `lg`, password usually `lq`). Laptop testers can skip this section.

### C1. Install once

```bash
cd ~/projects
git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git LG-Arkanoid
cd LG-Arkanoid
bash install.sh lq
```

That installs Node **16.20.2** if needed, **pm2@5.4.3**, builds `dist/`, writes `server/.env`, and opens port **8130**.

### C2. Open every screen

```bash
bash scripts/open-arkanoid.sh
```

Or pass the screen count: `bash scripts/open-arkanoid.sh 5`.

This starts the match on **8130**, waits for `/health`, then opens Chromium:

- lg1: `http://localhost:8130/1` … `/N` (left → right)
- slaves: `http://lg1:8130/N`

The QR is on the **center** physical screen. Stop with:

```bash
bash scripts/close-arkanoid.sh
```

Already cloned: `git pull` then `bash scripts/open-arkanoid.sh`.

### C3. Slaves must accept SSH

From **lg1**, with no password prompt:

```bash
ssh -Xnf lg@lg2 'echo ok'
ssh -Xnf lg@lg3 'echo ok'
```

If that asks for a password, the side screens stay dark.

### C4. Join from phones

Same as section B, using the IPv4 **printed under the wall QR**, port **8130**.

Optional: in the app, **Settings → CONNECT LG → LAUNCH ON RIG** runs `open-arkanoid.sh` over SSH (port **22**). That only opens the wall. You still join the match on **8130**.

### C5. Rig env (`server/.env`)

```
PORT=8130
NUM_SCREENS=5
LG_PASSWORD=lq
GEMINI_API_KEY=
# LG_HOST_IP=10.11.77.106
```

Set `LG_HOST_IP` if the QR shows the wrong network card. Portrait frames are the default. Pin landscape with `LG_FRAME_ASPECT=16:9`.

---

## If something is wrong

| What you see | What to do |
|---|---|
| `npm start` fails | `node -v` must be 16+. Run `npm install` again in the repo root. |
| Tabs stay blank | Server terminal still running? Open `http://127.0.0.1:8130/health`. |
| Phone cannot join | Same Wi‑Fi. Port **8130**. IPv4 from the QR, not `lg1`, not port 22. |
| Only two players needed but START is dead | Default is 2 paddles. Join a second controller (another tab or phone). |
| Only lg1 shows the game | From lg1: `ssh -Xnf lg@lg2 'echo ok'` then `bash scripts/open-arkanoid.sh`. |
| QR IP is wrong | Set `LG_HOST_IP=` in `server/.env`, restart / reopen. |
| App Launch on Rig does nothing | Wait up to 3 minutes. `dist/` is built by `install.sh`, not on every open. |

---

## License

MIT. Copyright © Anirudh Pratap Singh Yadav · Liquid Galaxy / Gemini Summer of Code 2026.
