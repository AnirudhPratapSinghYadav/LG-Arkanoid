# Contributing to LG Arkanoid

First off, thank you for considering contributing to LG Arkanoid! This project is built for the Liquid Galaxy system, and we welcome contributions that improve its stability, features, and performance.

## Setting Up Your Environment
Please refer to the technical documentation in the `docs/` folder to understand how the system is built:
- **[Architecture & Diagrams](docs/architecture.md)**
- **[Liquid Galaxy Setup](docs/lg-setup.md)**
- **[Mobile Controller Setup](docs/mobile-setup.md)**

## Our Development Workflow: Phase-Gated & Isolated Commits
This project strictly follows an isolated-commit discipline to ensure stability on the physical Liquid Galaxy rigs (which are notoriously hard to debug once deployed). 

When you submit a Pull Request, you must adhere to the following rules:
1. **One variable changes per commit.** Do not bundle unrelated cleanups, dependency bumps, and feature additions into one massive commit. 
2. **Verify in isolation.** If you change a dependency, commit it separately and verify it builds. If you change a game physics parameter, commit it separately.
3. **No untested assumptions.** Rig environments run on older OS versions (e.g. Ubuntu 16.04). Before bumping a dependency (like Node or Vite), you MUST verify that the new version explicitly supports Node 14.18+ / 16 (our required floor for the rig).
4. **Phase Validation.** We use a Triple-Loop validation protocol. If you claim a fix works, you should verify it locally immediately, after a fresh clean build, and in CI. Do not force-push broken code repeatedly hoping CI will catch it.

## Pull Requests
1. Fork the repo and create your branch from `main`.
2. Name your branch descriptively (e.g. `fix/paddle-physics`, `feat/new-powerup`).
3. Ensure the CI matrix (Node 14.18+, 16, 18, 20, 22) passes.
4. Fill out the provided Pull Request template completely.

We look forward to your contributions!
