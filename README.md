# LG Arkanoid

Panoramic multiplayer Arkanoid for a [Liquid Galaxy](https://www.liquidgalaxy.eu/) wall.

Phones are the paddles. Chromium on each frame draws one slice of one court. Node on **lg1** runs the match on port **8130**.

**Contributor:** [Anirudh Pratap Singh Yadav](https://github.com/AnirudhPratapSinghYadav)  
**Mentor:** [Sidharth Mudgil](https://github.com/SidharthMudgil)  
**Org:** Liquid Galaxy · Gemini Summer of Code 2026

---

## How to open the wall

SSH to the master as user **`lg`** (password is usually **`lq`**).

```bash
cd ~/projects
git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git LG-Arkanoid
cd LG-Arkanoid
bash install.sh lq
```

That installs Node **16** if needed, **pm2@5.4.3**, builds `dist/`, writes `server/.env`, and opens port **8130**.

Then:

```bash
bash scripts/open-arkanoid.sh
```

Omit the number to use the rig’s screen count. Or pass it:

```bash
bash scripts/open-arkanoid.sh 5
bash scripts/close-arkanoid.sh
```

What open does:

1. Starts the match process (`lg-arkanoid`) on **8130**.
2. Waits until `http://127.0.0.1:8130/health` answers.
3. Opens Chromium fullscreen on **lg1** at `http://localhost:8130/1` (left) … `/N` (right).
4. Opens Chromium on each slave at `http://lg1:8130/N`.

`/1` is the leftmost physical screen. The QR is on the **center** screen.

Already installed? `git pull` then `bash scripts/open-arkanoid.sh`.

From **lg1**, this must work with no password or the slaves stay dark:

```bash
ssh -Xnf lg@lg2 'echo ok'
ssh -Xnf lg@lg3 'echo ok'
```

---

## How to join and play

1. Phone and lg1 on the **same Wi‑Fi**. Turn off mobile data and VPN.
2. Install the **AI Arkanoid LG** APK (arm64 on modern phones).
3. Open the app → **Scan QR** on the **center** screen, or type the URL printed under it:

   `http://<lg1-Wi-Fi-IPv4>:8130/controller?c=CODE`

4. Enter a name. First phone is **HOST**.
5. Host taps **CREATE & START**. Hold **LEFT** / **RIGHT**. Three lives. Catch power-ups (wide, slow, multi, bomb).
6. Timed matches show **TIME LEFT** on every slice. Standings are on the **rightmost** screen.

Do **not** type hostname `lg1` — phones cannot resolve it. Game port is **8130**. Settings → **LAUNCH ON RIG** uses SSH port **22** only to open/close Chromium.

Android emulator: join `10.0.2.2:8130`. Launch/SSH to a real rig still needs the Wi‑Fi IPv4.

---

## Settings on the rig

`server/.env` (created by install — never commit):

```
PORT=8130
NUM_SCREENS=5
LG_PASSWORD=lq
GEMINI_API_KEY=
# LG_HOST_IP=10.11.77.106
```

Set `LG_HOST_IP` if the QR prints the wrong NIC. Empty `GEMINI_API_KEY` still runs the match (offline lines).

Portrait frames are the default. Pin landscape with `LG_FRAME_ASPECT=16:9`.

---

## Laptop (no wall)

```bash
npm install
cp server/.env.example server/.env
```

In `.env` set `PORT=8130`, `NUM_SCREENS=3`, `LG_FRAME_ASPECT=16:9`. Then:

```bash
npm run build
npm start
```

Open `http://localhost:8130/1`, `/2`, `/3`, and `http://localhost:8130/controller`.

---

## APK

```bash
cd mobile
flutter pub get
flutter build apk --release --split-per-abi
```

Use `app-arm64-v8a-release.apk` on current phones.

---

## If something is wrong

| What you see | What to do |
|---|---|
| Only the center/master glass has the game | From lg1: `ssh -Xnf lg@lg2 'echo ok'` must not ask for a password. Then `bash scripts/open-arkanoid.sh` again. |
| Phone cannot join | Same Wi‑Fi. URL under the QR. Port **8130**, not 22. Not `lg1`. Latest APK. |
| QR IP is wrong | Set `LG_HOST_IP=` in `server/.env`, close, open again. |
| Launch from the app does nothing | Wait — open can take up to 3 minutes. `dist/` is built by `install.sh`, not on every launch. |
| Node / pm2 errors on lg1 | Use Node **16.20.2** and `pm2@5.4.3`. Do not `npm audit fix --force`. |

Health check (no join code in the body):

```bash
curl -s http://127.0.0.1:8130/health
```

---

## License

MIT. Copyright © Anirudh Pratap Singh Yadav · Liquid Galaxy / Gemini Summer of Code 2026.
