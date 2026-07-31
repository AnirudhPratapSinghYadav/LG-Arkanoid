# Security Policy

## Supported Versions

Currently, only the `main` branch (v1.0.x) is actively supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within LG Arkanoid (e.g. an issue with socket validation, boundary handoff validation, or API key exposure), please do NOT report it in a public GitHub issue.

Instead, please privately report it to the original GSoC contributor via their GitHub profile contact info, or reach out to the Liquid Galaxy Lab mentors. 

We take security seriously, especially given that this project interacts with external LLM APIs (Gemini) and utilizes SSH to control multiple rig machines. All validated vulnerabilities will be patched promptly following our isolated-commit, phase-gated discipline.
