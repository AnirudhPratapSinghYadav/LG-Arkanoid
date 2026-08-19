# GO Web Store — LG Arkanoid

The GO Store listing is the **Android controller only**. The wall is this GitHub repo, installed on `lg1` with `bash install.sh lq`.

Storefront: [store.liquidgalaxy.eu](https://store.liquidgalaxy.eu). Listings live in [LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data), not in GO-Web-Store.

Phone launcher name: **AI Arkanoid LG**. Data folder: `apps/LG_Arkanoid/` (matches the GitHub slug).

## Build the APK

CI pins Flutter **3.24.3**. `minSdk` is 21 (Android 5.0+). `applicationId` is `com.anirudh.lg_arkanoid`.

```bash
cd mobile
flutter pub get
flutter build apk --release
```

Listing must stay under 50 MB. If the fat APK is over that, use the arm64 split only:

```bash
flutter build apk --release --split-per-abi
# use: build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

Rename the file to `LG_Arkanoid_1.0.0.apk`. Sign with the upload keystore (`mobile/android/key.properties`, gitignored — see `key.properties.example`).

## Store PR

Fork Data. Add:

```
apps/LG_Arkanoid/
  1.webp … 5.webp
  icon.webp
  app/LG_Arkanoid_1.0.0.apk
```

Carousel: splash, connect, lobby, in-match paddle, wall during play. Export `icon.webp` from `mobile/assets/app_icon.png`.

Append to `store.json`:

```json
{
  "name": "AI Arkanoid LG",
  "icon": "icon.webp",
  "category": "Arcade",
  "carousel_assets": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"],
  "base_url": "/apps/LG_Arkanoid/",
  "file": "app/LG_Arkanoid_1.0.0.apk",
  "pwa_link": "",
  "type": "app",
  "date": "Aug 19, 2026",
  "android_OS": "5.0+",
  "version": "1.0.0",
  "content": "AI Arkanoid LG is a panoramic multiplayer brick-breaker built for Liquid Galaxy.\n\nThe court is rendered across every screen of the rig by a Node.js and Socket.IO server that serves a Phaser web client. Each player joins from their own Android phone using this Flutter controller. The same app manages the rig over SSH, so a match can be installed, launched and shut down without touching the master keyboard.\n\nFeatures:\n- One continuous court across 3, 5, 7, 9 or 12 frames, portrait or landscape\n- Phone paddle with input scaled to the real court width\n- Host picks match length, player count and ball speed from the lobby\n- Gemini live commentary, with offline fallback lines when the key is unset\n- QR join from the center screen (the join code is never on /health)\n- SSH connect, auto-detect screen count from personavars.txt, launch and close\n\nThis project was developed as a Gemini Summer of Code 2026 project with the Liquid Galaxy Project Organization.\n\nContributor: Anirudh Pratap Singh Yadav\nMentors: Sidharth Mudgil\nLiquid Galaxy Project Org Director: Andreu Ibanez\nRepository: https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid"
}
```

PR title: `Add AI Arkanoid LG to Liquid Galaxy GO Store`.

Share URL after it is live:

```
https://store.liquidgalaxy.eu/index.html?app=AI%20Arkanoid%20LG
```

## What Lleida will test

1. `bash install.sh lq` on the master (`$1` is the SSH password).
2. `/etc/iptables.conf` lists **8130**. Node on the rig is **16**.
3. `bash scripts/open-arkanoid.sh --frames 3` — `/1` is the leftmost screen.
4. Phone: user `lg`, password `lq`, IP of `lg1`, SSH port `22` → CONNECT LG → LAUNCH ON RIG.
5. Scan the center QR. Host starts. Paddle follows the finger. SHUT DOWN ON RIG closes the game.

Laptop check: [virtualbox-test-plan.md](virtualbox-test-plan.md). Rig notes: [lg-setup.md](lg-setup.md).

## GESOC work product

Google Doc `wps_studentname_gsoc2026`, demo video (max 15 min), and this repo reviewed by the mentor.
