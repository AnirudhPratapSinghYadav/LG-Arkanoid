# Troubleshooting

## Server Won't Start
- Ensure Node.js 18+ is installed.
- Ensure `.env` is created and `LG_PASSWORD` is configured.
- Run `npm run server` and check for syntax errors.

## Screens Won't Open on Slaves
- Ensure the master node has passwordless SSH access to the slave nodes (or the correct password in the scripts).
- Check if `google-chrome` or `chromium-browser` is installed on the rigs.

## Network Connection Fails
- Ensure the phone and Liquid Galaxy rig are on the same Wi-Fi subnet.
- Run `sudo ufw status` on the master node to verify port 3000 is open.

## CI/CD Failure
- The mobile app strictly requires Flutter 3.24.x due to dartssh2 and meta package dependencies. Do not downgrade the CI runner.
