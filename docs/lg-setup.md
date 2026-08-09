# Liquid Galaxy setup

Follows the same flow as [galaxy-pacman](https://github.com/LiquidGalaxyLAB/galaxy-pacman): install on master → pm2 → Chromium kiosk per frame.

## Quick path

```bash
cd ~/projects/LG-Arkanoid
bash install.sh
bash scripts/open-arkanoid.sh 3    # or 5,7,9,12
bash scripts/close-arkanoid.sh
```

Phone controller: same Wi‑Fi → IP of master, port **3000**, session token from screens or `/health`.

## Details

- Master hostname: `lg1`, user: `lg`
- Screen URLs: `http://lg1:3000/<screenNumber>`
- `$LG_FRAMES` in `~/etc/shell.conf` controls left-to-right order
- Node **16** required on old Ubuntu / glibc rigs (see `docs/troubleshooting.md`)
- Optional browser controller: `http://<master-ip>:3000/controller`

For a full VirtualBox walkthrough, see [virtualbox-test-plan.md](virtualbox-test-plan.md).
