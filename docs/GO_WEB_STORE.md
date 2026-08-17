# GO Web Store — LG Arkanoid submission

This is the handover checklist for putting LG Arkanoid on the Liquid Galaxy
GO Store. It is copied from the process Yash Raj Bharti posted on Discord
(15 Aug 2026), the merged example PR
[LiquidGalaxyLAB/Data#86](https://github.com/LiquidGalaxyLAB/Data/pull/86),
and the **LG RPG** listing that landed the same day
([LiquidGalaxyLAB/lg-rpg](https://github.com/LiquidGalaxyLAB/lg-rpg),
store entry `apps/LG_RPG/`, `file: app/LG_RPG_1.0.0.apk`).

The storefront itself is [GO-Web-Store](https://github.com/LiquidGalaxyLAB/GO-Web-Store)
and is deployed at [store.liquidgalaxy.eu](https://store.liquidgalaxy.eu).
**You do not PR that repo.** The store reads every listing from the
[LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data) repository.

## What gets submitted where (this is two artifacts)

LG RPG, Asteroids, Pacman, and every other phone-plus-wall game work the same
way. The GO Store listing is **only the Android controller**. Chromium never
goes in the APK.

| Artifact | Where it lives | Who installs it |
| --- | --- | --- |
| Flutter APK | `LiquidGalaxyLAB/Data` → `apps/LG_Arkanoid/app/LG_Arkanoid_1.0.0.apk` | Phones, via [store.liquidgalaxy.eu](https://store.liquidgalaxy.eu) |
| Node server + Phaser kiosk pages + `install.sh` / `open-arkanoid.sh` | This GitHub repo | Mentors / you, once, on the **master** (`lg1`) |

There is no second APK for the wall, no PWA (`pwa_link` is `""` on LG RPG),
and no Chromium binary to attach. Lleida clones the repo, runs
`bash install.sh lq`, then launches from the phone.

## Versions Lleida actually runs (verified, not assumed)

| Piece | LG RPG (submitted 17 Aug 2026) | Pacman / Asteroids | **LG Arkanoid** |
| --- | --- | --- | --- |
| Master OS | Ubuntu **16.04** (README) | Ubuntu 16.04 | same |
| Node on master | **16** via nvm (`nvm install 16`) | **14** (pacman README) | **16** (`.nvmrc` `16.20.2`, CI 16/18/20) |
| Wall client | Phaser **4** from a **CDN** (needs internet) | Phaser / canvas, bundled | Phaser **3.80**, **vendored** in `web-client/public/js/vendor/` (works offline on the rig LAN) |
| Game port | **8111** (already in stock iptables) | 8128 / 8129 | **8130** (installer patches `/etc/iptables.conf`) |
| Flutter / Dart | SDK `>=3.0.0 <4.0.0`, CI = `channel: stable` (unpinned) | n/a (web joystick) | SDK `>=3.0.0 <4.0.0`, CI **pins Flutter 3.24.3** |
| Store `android_OS` | `"7.0+"` (README still says 5.0+; they ship Google Maps) | `"4.4W+"` (Asteroids 2022) | `"5.0+"` — `minSdk = 21`, no Maps |
| Store APK | **one** file, `flutter build apk` (fat, no split) | one APK | **one** file (see below) |
| Screens | **3 or 5 only** | `$LG_FRAMES` | **1–12** (typical 3/5/7/9/12) |

Ubuntu 16.04 is glibc 2.23. Node 18+ will not start (`GLIBC_2.27 not found`).
That is why RPG and this repo both freeze Node at 16. Helmet is pinned to
**7.2.0** because helmet 8 declares `engines.node >= 18` and would crash on
the LAB image.

## 1. Build the APK that goes in the listing

LG RPG's controller README builds a **single fat APK**:

```bash
flutter build apk
```

Yash's size note still applies: the listing must be **under 50 MB**. Do this
in order:

```bash
cd mobile
flutter pub get
flutter build apk --release
```

Open `build/app/outputs/flutter-apk/app-release.apk` in
[APK Analyzer](https://developer.android.com/studio/debug/apk-analyzer).

- If it is **< 50 MB**, that fat APK is what you rename and upload — same as
  LG RPG, so Pixel emulators (x86_64) and phones (arm64) both install it.
- If it is **≥ 50 MB**, rebuild with ABI split and upload **only** arm64:

```bash
flutter build apk --release --split-per-abi
# use: build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

Do **not** put three split APKs in the Data repo. `store.json` has a single
`file` field. LG RPG's is `app/LG_RPG_1.0.0.apk`. Ours must be:

```
LG_Arkanoid_1.0.0.apk
```

Release builds already run R8 (`isMinifyEnabled`) and resource shrinking.
Images are lossless WebP; fonts are bundled (no `google_fonts` LAN fetch —
RPG still uses `google_fonts`, which fails on an offline rig Wi‑Fi).

Sign with a real upload keystore (`mobile/android/key.properties`, gitignored;
see `mobile/android/key.properties.example`). RPG still ships debug keys;
we should not.

`applicationId` is `com.anirudh.lg_arkanoid`, `android:label` is `LG Arkanoid`,
`minSdk` is 21 (Android 5.0). The store field `android_OS` for that is `"5.0+"`.

## 2. Capture carousel screenshots

The store shows a carousel of `.webp` images next to the listing. The merged
example used five; LG RPG (Arcade, submitted 17 Aug 2026) used seven. Aim for
**5–7 lossless WebP**, 16:9 or 9:16, no status-bar clutter:

1. Splash with the Liquid Galaxy + GESOC logos
2. Connection screen (Username / Password / IP / Port / Number of screens + CONNECT LG)
3. Lobby (player count, match time, ball speed)
4. In-match controller (paddle + lives)
5. Wall: leftmost screen during lobby, both logos visible
6. Wall: match in play across 3+ frames (VirtualBox or the LAB rig)
7. Optional: Gemini commentary on the center screen

Name them `1.webp` … `N.webp`. Also export `icon.webp` from
`mobile/assets/app_icon.png` (the 1024 px source used by
`flutter_launcher_icons`).

## 3. Open the pull request against `LiquidGalaxyLAB/Data`

Fork [LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data). Add a
folder and append one object to `store.json`. Folder name uses underscores,
no spaces:

```
apps/LG_Arkanoid/
  1.webp
  2.webp
  3.webp
  4.webp
  5.webp
  icon.webp
  app/LG_Arkanoid_1.0.0.apk
```

`store.json` entry — keys must match the existing schema exactly
(`name`, `icon`, `category`, `carousel_assets`, `base_url`, `file`,
`pwa_link`, `type`, `date`, `android_OS`, `version`, `content`).
Arcade is the category the other panoramic games use (Asteroids, LG RPG):

```json
{
  "name": "LG Arkanoid",
  "icon": "icon.webp",
  "category": "Arcade",
  "carousel_assets": ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"],
  "base_url": "/apps/LG_Arkanoid/",
  "file": "app/LG_Arkanoid_1.0.0.apk",
  "pwa_link": "",
  "type": "app",
  "date": "Aug 17, 2026",
  "android_OS": "5.0+",
  "version": "1.0.0",
  "content": "LG Arkanoid is a panoramic multiplayer brick-breaker built for Liquid Galaxy.\n\nThe court is rendered across every screen of the rig by a Node.js and Socket.IO server that serves a Phaser web client. Each player joins from their own Android phone using this Flutter controller. The same app manages the rig over SSH, so a match can be installed, launched and shut down without touching the master keyboard.\n\nFeatures:\n- One continuous court across 3, 5, 7, 9 or 12 frames, portrait or landscape\n- Phone paddle with input scaled to the real court width\n- Host picks match length, player count and ball speed from the lobby\n- Gemini live commentary, with offline fallback lines when the key is unset\n- QR join from the center screen (the join code is never on /health)\n- SSH connect, auto-detect screen count from personavars.txt, launch and close\n\nThis project was developed as a Gemini Summer of Code 2026 project with the Liquid Galaxy Project Organization.\n\nContributor: Anirudh Pratap Singh Yadav\nLiquid Galaxy Project Org Director: Andreu Ibanez\nRepository: https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid"
}
```

PR title, matching the example: `Add LG Arkanoid to Liquid Galaxy GO Store`.

PR body, matching the example:

```
### Description
This pull request introduces **LG Arkanoid** to the Liquid Galaxy GO Store,
developed as part of Gemini Summer of Code 2026.

### Changes Included
* **App Assets:** Added high-quality `.webp` carousel screenshots and `icon.webp`.
* **App Build:** Included the `1.0.0` release APK inside the `app/` directory.
* **Store Entry:** Appended the complete application metadata to `store.json`.

### Relevant Links
* **Source Repository:** [LG Arkanoid](https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid)

### Contributor & Mentors
* **Contributor:** Anirudh Pratap Singh Yadav
* **Mentors:** <fill in>
```

Do not force-push after review comments land. Git LFS is not used; the APK
goes in as a normal binary the way Darpan's did.

## 4. After the listing is live

The storefront builds a share URL from the `name` field. Use the share
button on the app page, then publish **that** URL, not a guessed one. The
format is:

```
https://store.liquidgalaxy.eu/index.html?app=LG%20Arkanoid
```

Spaces in `name` become `%20`. That is the link that goes in the work-product
doc and in any Discord/announcement post.

## 5. What Lleida will actually test

The LAB will install on a real rig (3, 5, 7, 12+ frames) and on the
contributor's own VirtualBox 3-machine cluster. Walk through this before
you send the APK:

1. `bash install.sh lq` on the master (password as `$1`, no stdin prompts).
2. Confirm `/etc/iptables.conf` lists **8130** on the `tcp` rule that already
   has 8111. `ufw` alone is not enough — frames restore iptables on every
   `ifup`.
3. `bash scripts/open-arkanoid.sh --frames 3` (and 5, 7) prints the left→right
   map. `/1` must be the leftmost physical screen.
4. Phone: Settings → Username `lg`, Password `lq`, IP of `lg1`, Port `22`,
   Number of screens (auto-filled from `DHCP_LG_FRAMES_MAX`) → **CONNECT LG**.
5. **LAUNCH ON RIG**. Leftmost Chromium shows the Liquid Galaxy logo and the
   GESOC logo. Center screen shows the QR and 4-letter code.
6. A second phone (or `/controller`) joins with that code. Host sets time,
   players, speed, starts the match.
7. Paddle tracks the finger, ball crosses bezels, commentary speaks, Gemini
   lines appear when `GEMINI_API_KEY` is set and fall back when it is not.
8. **SHUT DOWN ON RIG** returns the wall to the previous session.

VirtualBox walkthrough: [virtualbox-test-plan.md](virtualbox-test-plan.md).
Rig facts: [lg-setup.md](lg-setup.md).

Play this on your VirtualBox 3-machine cluster **before** recording. If that
run is clean, record immediately (the LAB wants the demo on your own system
in the last two minutes of the 15-minute video). Do not wait for a Lleida
slot to discover a missing `iptables` port or a Node 18 binary.

## 6. Work product (GESOC / GSoC 2026)

Separate from the store PR, the LAB still wants the Google Doc named
`wps_studentname_gsoc2026` in your GSoC Drive folder, sent to
liquidgalaxylab gmail. That doc is what they publish on
liquidgalaxy.eu and is the URL you attach to Google's final submission.

Also required, from the [GSoC 2026 unique post](https://www.liquidgalaxy.eu/2025/11/GSoC2026.html):

- GitHub fully updated and reviewed by your mentor
- Documentation (this repo)
- Worklog up to date
- Demo Day video (horizontal, good sound and light, max 15 minutes)
- Fully tested APK at LG HQ

The demo video structure they published:

1. 1 min — you (name, city, country, university, project)
2. 10 min — code and app, face + screen
3. 2 min — demo on your own system
4. 2 min — personal experience
