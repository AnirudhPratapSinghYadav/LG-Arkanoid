# LG-Arkanoid Architecture

## Overview
LG-Arkanoid is a distributed multiplayer game designed for the Liquid Galaxy system.
The system consists of three primary components:
1. **Node.js Game Server (Master):** Runs locally on the Liquid Galaxy master node. It manages game state, physics, networking (Socket.IO), boundary handoffs between screens, and AI commentary integration via the Gemini API.
2. **Web Client (Screens):** A Phaser 3 web application running in browser instances on the Liquid Galaxy slave nodes. Each screen loads the same client but passes a unique `screenId` parameter to render only its slice of the panoramic world.
3. **Mobile App (Controller):** A Flutter application installed on the user's phone. It discovers the master node, communicates via Socket.IO, manages SSH deployment to the rig, and sends touch/gyro paddle inputs to the game server.

## Data Flow
- **Initialization:** The mobile app connects to the Node server and issues a start command via SSH.
- **Rendering:** Node server syncs entity positions 60 times a second to all connected web clients.
- **Input:** Mobile app sends `paddle_move` events via Socket.IO with cryptographically secure nonces and timestamps.
- **AI:** The server calls the Gemini API asynchronously based on game events (e.g., powerup acquired, life lost) and broadcasts the commentary to all clients to display in the UI.

## Technology Stack
- **Server:** Node.js, Express, Socket.IO
- **Client:** HTML5, CSS3, Phaser 3
- **Mobile:** Flutter, DartSSH2, Socket.IO-Client
- **AI Integration:** Google Gemini REST API
