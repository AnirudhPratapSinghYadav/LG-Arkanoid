# VirtualBox 3-rig test plan (before video / LAB submit)

This is what you can verify on a laptop. It is **not** a substitute for LAB Lleida, but it catches most deploy mistakes.

## Topology

| VM     | Hostname | Role                         | RAM (min) |
|--------|----------|------------------------------|-----------|
| lg1    | lg1      | Master: Node + pm2 + Chromium| 4 GB      |
| lg2    | lg2      | Slave: Chromium only         | 2 GB      |
| lg3    | lg3      | Slave: Chromium only         | 2 GB      |

- Host-only or internal network so VMs see each other as `lg1` / `lg2` / `lg3` (edit `/etc/hosts` on each).
- Same credentials as LAB when possible: user `lg`, password `lg`.
- Phone (or Android emulator) on a network that can reach lg1’s IP.

## Versions (match production)

- Ubuntu: as close to LAB as you can (16.04 ideal; 18.04/20.04 OK for functional test).
- Node: **16.x** via nvm on lg1.
- Chromium / `chromium-browser` on all three.
- `pm2`, `sshpass` (if using password SSH).
- Game port: **8130** (pong 8112, snake 8114, pacman 8128, asteroids 8129 are taken).

## SSH

On lg1:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
ssh-copy-id lg@lg2
ssh-copy-id lg@lg3
```

Optional: `export LG_PASSWORD=lg` if using passwords instead of keys.

Create `~/etc/shell.conf` on lg1 (example left-to-right):

```bash
LG_FRAMES="lg3 lg1 lg2"
```

(Use the order your physical wall uses. Sequential `lg1 lg2 lg3` is fine for a first test.)

## Install + launch

```bash
# on lg1
cd ~/projects/LG-Arkanoid   # or clone there
bash install.sh
bash scripts/open-arkanoid.sh 3
curl -s http://localhost:8130/health
```

Expect JSON with `"numScreens":3` and `lanIp` (no `sessionToken` — that is only on the wall).

Screens:

- Master: `http://localhost:8130/<n>` where `<n>` is lg1's left→right position
  (slice `/2` for the standard `lg3 lg1 lg2` order). Confirm with
  `bash scripts/open-arkanoid.sh --frames 3`.
- Slaves: Chromium should open `http://lg1:8130/<n>`

## Phone join

1. Note lg1 LAN IP from `/health` (`lanIp`) and the **4-letter session code from the center-screen QR** (token is not on `/health`).
2. On phone: Flutter app **or** browser → `http://<lg1-ip>:8130/controller`
3. Join with the on-screen code; host starts match. Drag paddle; ball should move on the Chromium windows.

## Test cases

| # | Case | Pass if |
|---|------|---------|
| 1 | Cold launch 3 screens | All Chromiums show the correct slice; no blank windows |
| 2 | Join + start | Countdown → playing; timer counts when duration > 0 |
| 3 | Endless (duration 0) | Timer hidden / no time-up; match continues |
| 4 | Ball cross-screen | Ball exits one frame and enters the next without teleport glitch |
| 5 | Phone disconnect 10s | Slot held; resume reconnects |
| 6 | Phone disconnect 35s | Slot cleared; can rejoin as new/same name |
| 7 | Catch power-up | Inventory shows on phone; activate works (bomb on catch) |
| 8 | Time-up / game-over / win | End screen on center; can start another match |
| 9 | Relaunch 5 (if VMs allow) | `open-arkanoid.sh 5` or close+open; `/health` shows new count |
| 10 | Close | `close-arkanoid.sh` kills Chromium + pm2 |

## Failure recovery

| Symptom | Check |
|---------|--------|
| `GLIBC_… not found` | Use Node 16, not 18+ |
| Phone cannot connect | Same subnet; port **8130** open in `/etc/iptables.conf` (not just `ufw`, which the rig resets on `ifup`) |
| Slave blank | SSH from lg1 to lgN; `DISPLAY=:0`; Chromium installed |
| Wrong panorama order | Fix `$LG_FRAMES` |
| pm2 old screens | `pm2 delete lg-arkanoid` then open script again |

## What this plan does **not** prove

- Real LAB GPU / multi-head / physical bezels
- Mentor Wi‑Fi / firewall quirks
- 7 / 9 / 12 physical frames (simulate with more VMs only if you have the hardware)

Label those as **unverified until LAB** in any submission note.
