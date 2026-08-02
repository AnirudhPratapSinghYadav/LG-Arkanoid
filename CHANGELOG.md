# Changelog

## [Unreleased]
### Fixed
- Removed unused `jsdom` dependency that blocked Node 16 support on rig hardware.
- Downgraded `vite` from ^8.1.5 to 4.5.14 to restore Node 16 compatibility for rig deployment, while keeping dev/CI machines on newer Node versions working via the CI matrix.


## [1.0.0] - 2026-07-30
### Added
- Complete Liquid Galaxy architectural setup.
- Web-client using Phaser 3 and Vite for rendering a unified panoramic game world across multiple screens.
- Server-authoritative Node.js backend using Socket.IO for game physics, paddle input, and boundary handoffs.
- AI Assistant module integrating Google Gemini REST API to dynamically commentate game events and generate procedurally dynamic levels.
- Mobile controller app built with Flutter featuring accelerometer/touch controls and automatic Rig SSH deployment.
- CI/CD workflow testing via GitHub Actions.
- Comprehensive `.env`-driven configuration isolating secrets from source code.
- Strict security model implementing Helmet CSP, Socket nonce sequences, and secure SSH usage documentation.

### Changed
- Directory structure normalized (`client` -> `web-client`, `mobile`).
- Upgraded `dartssh2` and `meta` dependencies to guarantee clean resolution on Flutter 3.24.x stable.
- Centralized configuration in `server/config.js`.

### Fixed
- Version conflicts between `flutter_test` and `dartssh2`.
