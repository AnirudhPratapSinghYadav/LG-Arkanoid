# Liquid Galaxy setup

Follows the same flow as [galaxy-pacman](https://github.com/LiquidGalaxyLAB/galaxy-pacman): install on master → pm2 → Chromium kiosk per frame.

## Quick path

```bash
cd ~/projects/LG-Arkanoid
bash install.sh
bash scripts/open-arkanoid.sh 3           # or 5,7,9,12; omit to use the rig's own count
bash scripts/open-arkanoid.sh --frames 5  # print the frame map without launching
bash scripts/close-arkanoid.sh
```

Phone controller: same Wi‑Fi → IP of master, port **8130**, session token from the **center screen QR / code** (not `/health`). Or use `http://<master-ip>:8130/controller` in a phone browser.

## Details

- Master hostname: `lg1`, user: `lg`
- Screen URLs: `http://lg1:8130/<screenNumber>`, where `<screenNumber>` is the
  **physical** slice index counted left to right, not the hostname number
- Node **16** required on old Ubuntu / glibc rigs (see `docs/troubleshooting.md`)
- Optional browser controller: `http://<master-ip>:8130/controller`

### Frame order

`lg1` sits in the middle of an odd wall, so hostname order is not screen order.
The launcher takes `$LG_FRAMES` from `~/etc/shell.conf` when it has exactly as
many entries as screens being launched; otherwise it rebuilds the standard LG
order. That fallback is not invented — it generalises the default the rig itself
ships in `liquid-galaxy/gnu_linux/home/lg/etc/shell.conf`:

```
LG_FRAMES=${DHCP_LG_FRAMES:-"lg6 lg7 lg8 lg1 lg2 lg3 lg4 lg5"}
```

Left→right is `lg(n/2+2) … lg(n)` (left wing) followed by `lg1 … lg(n/2+1)`:

| Screens | Left → right |
| --- | --- |
| 3 | `lg3 lg1 lg2` |
| 5 | `lg4 lg5 lg1 lg2 lg3` |
| 7 | `lg5 lg6 lg7 lg1 lg2 lg3 lg4` |
| 8 | `lg6 lg7 lg8 lg1 lg2 lg3 lg4 lg5` ← matches the stock default above |
| 12 | `lg8 lg9 lg10 lg11 lg12 lg1 lg2 lg3 lg4 lg5 lg6 lg7` |

Launching fewer screens than the rig has keeps the court centred on `lg1`.
Verify with `bash scripts/open-arkanoid.sh --frames <n>` before a demo.

#### Why the URL carries a slice index, not a hostname digit

`galaxy-pacman` and `galaxy-asteroids` put the hostname digit in the URL
(`screenNumber=${lg:2}`) and let the browser work out where that frame sits, via

```js
const isRightScreen = screen <= Math.ceil(nScreens / 2);
const offsetIndex = isRightScreen ? screen - 1 : ((nScreens + 1) - screen) * -1;
```

That formula only agrees with the real wall on **odd** rigs. On the stock
8-frame default above it places `lg5` four screens *left* of the master when it
is actually four screens *right* — and it is wrong on 12 frames too. Arkanoid is
one continuous court, so a mis-placed frame would visibly break the ball's path.
The launcher therefore resolves the physical order from `$LG_FRAMES` (the rig's
own truth, whatever the order) and passes a left→right slice index, so `/1` is
always the leftmost screen and `lg1` gets whatever index it really occupies.

### Rig facts the scripts rely on

- **Screen count** comes from `DHCP_LG_FRAMES_MAX` in `/lg/personavars.txt`
  when no argument is given, the same source `galaxy-asteroids` uses.
- **Firewall**: frames restore `/etc/iptables.conf` on every `ifup`, so
  `install.sh` adds the game port to the `tcp` rule that already lists `8111`.
  A port that is only opened with `ufw` disappears after the next reboot and the
  phones silently fail to reach the master.
- **Audio**: Chromium is launched with `--autoplay-policy=no-user-gesture-required`,
  otherwise the wall stays muted because nobody ever clicks a kiosk screen.
- **Rotation**: `DHCP_RANDR` defaults to `right`, i.e. frames are portrait
  (1080×1920). Window geometry is left to `--kiosk` instead of a hardcoded
  `--window-size`, and the court's own width follows the same variable so the
  physics world matches the glass. Override with `LG_FRAME_ASPECT=16:9` in
  `server/.env` for unrotated panels.
- **Port `8130`** keeps clear of pong `8112`, snake `8114`, pacman `8128`,
  asteroids `8129` and the `lg-retro-gaming` launcher on `3123`.

### Launching from lg-retro-gaming

`install.sh` adds an `arkanoid` entry to `lg-retro-gaming/server/games.json`
when that launcher is installed:

```json
"arkanoid": {
  "openScript": "/home/lg/LG-Arkanoid/scripts/open-arkanoid.sh",
  "closeScript": "/home/lg/LG-Arkanoid/scripts/close-arkanoid.sh"
}
```

LGRG's server runs `bash <openScript> lq`, passing the rig password as `$1`.
`open-arkanoid.sh` treats a numeric `$1` as a screen count and a non-numeric
`$1` as that password, so it works from LGRG, from the phone app and by hand.

For a full VirtualBox walkthrough, see [virtualbox-test-plan.md](virtualbox-test-plan.md).
