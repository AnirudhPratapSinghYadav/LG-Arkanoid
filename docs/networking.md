# Networking

## Ports
- **Node.js Server:** TCP `8130` (HTTP assets + Socket.IO).
- **SSH:** TCP `22` (phone app runs `open-arkanoid.sh` / `close-arkanoid.sh` on the master).
- **Vite (Dev):** TCP `5173` (laptop development only — not used on the rig).

## Firewall
The installer patches `/etc/iptables.conf` (the file frames restore on every `ifup`) and, if ufw is active, also allows `8130/tcp`. A ufw-only rule disappears after reboot.

## Protocols
- The app uses SSH over `dartssh2` to run bash scripts on the master node, which then opens Chromium on the slave frames.
- Real-time physics and paddle inputs are synced using WebSocket (Socket.IO) on port 8130.
- Gemini API communication uses outbound HTTPS `443` to Google's endpoints. Without a key the game uses the bundled offline commentary lines.
