# LG Arkanoid

Multiplayer Arkanoid for Liquid Galaxy. The panoramic wall is one continuous playfield; phones are paddle controllers.

Built for Gemini Summer of Code 2026 · Liquid Galaxy Lab.

Sister-game pattern follows [galaxy-pacman](https://github.com/LiquidGalaxyLAB/galaxy-pacman): Node on the master, Chromium kiosk per frame, pm2, numbered screen URLs.

## Before running (Liquid Galaxy)

1. Liquid Galaxy core installed ([liquid-galaxy](https://github.com/LiquidGalaxyLAB/liquid-galaxy)).
2. **Node.js 16** on the master (`node -v` → `v16.x`). Older Ubuntu 16.04 / glibc rigs cannot run Node 18+.
3. `sudo npm i -g pm2`
4. Chromium on every machine in the rig.
5. SSH from `lg@lg1` to slave frames (`lg2`…). Keys preferred; password via `LG_PASSWORD` also works.

## Install on the master

```bash
cd
mkdir -p ~/projects
git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git ~/projects/LG-Arkanoid
cd ~/projects/LG-Arkanoid
bash install.sh
```

`install.sh` installs Node 16 via nvm when needed, builds the web client, writes `server/.env`, and opens firewall port **3000**.

## Launch on the rig

```bash
cd ~/projects/LG-Arkanoid
bash scripts/open-arkanoid.sh 3
```

Use `3`, `5`, `7`, `9`, or `12` (any count from 1–12). The script:

1. Starts/restarts `pm2` process `lg-arkanoid` with `NUM_SCREENS`
2. Reads `$LG_FRAMES` from `~/etc/shell.conf` when present
3. Opens Chromium kiosk: `http://localhost:3000/1` on master, `http://lg1:3000/<n>` on slaves

Stop:

```bash
bash scripts/close-arkanoid.sh
```

## Connect players

**Preferred:** Flutter APK (folder `mobile/`).

1. Phone and master on the same Wi‑Fi.
2. App → Rig Connection → master IP, SSH user `lg`, password, screen count → Connect → Launch on Rig.
3. Or Scan QR / Enter manually: master IP, port **3000**, 4-character session token shown on the screens.
4. Lobby → Start Match. Drag on the phone to move your paddle.

**Optional browser controller** (same idea as Pacman `/controller`):

`http://<master-ip>:3000/controller`

## Run locally (no rig)

```bash
npm install
npm start
```

- Game screens: `http://localhost:3000/1` … `/N`
- Health: `http://localhost:3000/health`
- Dev Vite (optional): port `5173`

```bash
npm test
npm run build
```

## Ports

| Service        | Port |
|----------------|------|
| Game server    | 3000 |
| SSH (rig)      | 22   |
| Vite (dev only)| 5173 |

Each LG sister game uses its own port (Pacman 8128, Asteroids 8129, …). Arkanoid uses **3000** so it does not collide with Pacman on the same master.

## Repo layout

```
LG-Arkanoid/
├── mobile/         Flutter phone controller
├── server/         Authoritative Node + Socket.IO physics
├── web-client/     Phaser screen clients
├── scripts/        open-arkanoid.sh / close-arkanoid.sh
├── install.sh
└── docs/
```

## Environment (`server/.env`)

```
PORT=3000
NUM_SCREENS=3
LG_PASSWORD=lg
GEMINI_API_KEY=          # optional; offline fallback lines work without it
```

## Compatibility

- **Node:** `>=16` (`.nvmrc` = 16.20.2). Vite pinned to **4.x** for Node 16.
- **Do not Dockerize for LAB demos.** Mentors expect native pm2 + Chromium like Pacman.
- Flutter CI pin: **3.24.3**.

## License

See repository license. Author: Anirudh Pratap Singh Yadav.
