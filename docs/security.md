# Security Model

## Network
- The application relies on external network boundaries. `ufw` should protect everything except port 3000.
- Socket.IO connections enforce origin checking and payload validation.

## Anti-Cheat & Input Validation
- The server enforces rate limiting on `paddle_move` commands (approx 60 ticks/sec).
- Each socket payload must include a cryptographically unique `nonce` and timestamp to prevent replay attacks.

## SSH Protocol
- The `open-arkanoid.sh` and `close-arkanoid.sh` scripts use `StrictHostKeyChecking=no` to bypass initial prompt blockages for new rig setups. While standard in Liquid Galaxy environments, this is inherently vulnerable to MITM attacks. In high-security environments, keys should be manually appended to `known_hosts` and this flag removed.
- Plaintext passwords (if used) are stored only in Flutter's Secure Storage (Keystore/Keychain) and sent transiently over the local subnet. It is strongly recommended to use Passwordless SSH via public key instead of passwords.

## XSS Prevention
- The server uses `helmet` to strictly limit Content Security Policy (CSP).
- Dynamic script injection (such as setting the `SCREEN_ID`) is verified via cryptographically secure nonces generated uniquely per request.
