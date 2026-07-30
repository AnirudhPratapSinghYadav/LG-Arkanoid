# Networking

## Ports
- **Node.js Server:** TCP `3000` (Handles HTTP assets and Socket.IO).
- **SSH:** TCP `22` (Used by mobile app to trigger scripts).
- **Vite (Dev):** TCP `5173` (Used only in development).

## Firewall
`ufw` must allow port `3000` for the mobile app to communicate with the Master Node. The `install.sh` script automates this.

## Protocols
- The app uses SSH commands over `dartssh2` to remotely run bash scripts on the master node, controlling the slave browsers.
- Real-time physics and paddle inputs are synced using WebSocket (Socket.IO).
- Gemini API communication uses outbound HTTPS `443` to Google's endpoints.
