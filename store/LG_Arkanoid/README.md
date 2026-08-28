# AI Arkanoid LG — GO Store listing kit

Testers play **this** APK first. The Data PR goes up only after that playtest.

Live store: https://store.liquidgalaxy.eu  
Listings live in [LiquidGalaxyLAB/Data](https://github.com/LiquidGalaxyLAB/Data), not in GO-Web-Store.

## Files in this folder

| File | Rule |
|---|---|
| `icon.webp` | 512×512 square |
| `1.webp` … `5.webp` | Same size (1400×800). Wall QR, lobby with players, in-match wall, phone join, phone paddle |
| `store.entry.json` | Append this object to Data `store.json` |

The APK is **not** in git (`*.apk` is ignored). Send testers this link:

- [27-08-2026-v2-AnirudhPratapSinghYadav-Arkanoid_AI-GESOC2026.apk](https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid/releases/latest/download/27-08-2026-v2-AnirudhPratapSinghYadav-Arkanoid_AI-GESOC2026.apk)

Same bytes as [LG_Arkanoid_1.0.0.apk](https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid/releases/latest/download/LG_Arkanoid_1.0.0.apk) (GO Store filename). Release build, under 50 MB (store policy).

## Tester play (before any Data PR)

1. Laptop: `npm install && npm start` (port **8130**). Phone: same Wi-Fi, install the APK, scan the center QR.
2. Rig: on **lg1**, `bash install.sh lq` then `bash scripts/open-arkanoid.sh` (or `5` / `7` / `9` / `12`). One master. QR is `ceil(N/2)`.
3. Host START (START WITH 1 is enough). Paddle drag. Disconnect freeze / 30s resume.

## Data PR (after testers sign off)

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

Copy the JSON object from `store.entry.json` into Data `store.json`. One APK, one image set, one JSON entry per PR.

Title: `Add AI Arkanoid LG to Liquid Galaxy GO Store`.
