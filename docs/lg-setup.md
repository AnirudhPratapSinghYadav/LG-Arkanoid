# Liquid Galaxy Setup

## Installation
1. SSH into the master node (typically `lg1`).
2. Clone the repository: `git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git`
3. Navigate to the folder: `cd LG-Arkanoid`
4. Run the installer: `sudo bash install.sh`
   - You will be prompted to enter your Gemini API Key.
   - The script sets up firewall rules, port 3000, and PM2 process management.
5. PM2 will automatically restart the server on reboot.

## Scripts
- `scripts/open-arkanoid.sh`: Launches browser instances across all slave nodes to load the game.
- `scripts/close-arkanoid.sh`: Kills the Chromium processes to exit the game.
These are invoked automatically by the mobile app.

## Launch Flow (SSH Pipeline)

```mermaid
flowchart TD
    Mobile["Flutter Mobile App (dartssh2)"]
    SSH["SSH Server (Port 22 on lg1)"]
    Script["open-arkanoid.sh"]
    PM2["pm2 (Node.js Server)"]
    Chromium1["Chromium (lg1)"]
    Chromium2["Chromium (lg2)"]
    Chromium3["Chromium (lg3)"]

    Mobile -->|SSH Exec| SSH
    SSH --> Script
    Script -->|Ensures Server Running| PM2
    Script -->|SSH to lg1| Chromium1
    Script -->|SSH to lg2| Chromium2
    Script -->|SSH to lg3| Chromium3
```
