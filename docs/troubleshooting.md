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

### Node fails with GLIBC version errors on the rig

**Symptom:**
```
node: /lib/x86_64-linux-gnu/libm.so.6: version `GLIBC_2.27' not found (required by node)
node: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.28' not found (required by node)
```

**Cause:** The Liquid Galaxy rig runs Ubuntu 16.04 LTS (glibc 2.23). Node.js 18 and above require glibc 2.28+, which does not exist on this OS. This is a hardware/OS-image limitation, not an installation mistake — reinstalling or switching Node versions above 16 will not fix it.

**Fix:** Install Node 16 via nvm, which supports glibc 2.17+:
```bash
nvm install 16
nvm alias default 16
```
Verify in a fresh terminal:
```bash
node -v   # must show v16.x.x
```

**Why the project's minimum supported Node version is 14:** This is a deliberate ceiling, not an oversight. The sister Liquid Galaxy Lab project `galaxy-pacman` documents Node 14 as its master-machine requirement, confirming this project's rig (Ubuntu 16.04 / glibc 2.23) reflects a known constraint across the LG ecosystem, not a one-off. This project's `engines` field targets Node >=14 for that reason, with the full matrix (14/16/18/20/22) verified in CI. See `package.json`'s `engines` field.

### Why jsdom and a newer Vite were removed

`jsdom` was an unused dependency (never imported anywhere in the codebase)
that required Node ^22/^24/^26 and blocked rig deployment for no actual
benefit. It has been removed entirely.

`vite` was downgraded from ^8.1.5 to 4.5.14, the newest 4.x release that
still supports Node 16 (confirmed via its published `engines` field).
If you need to upgrade Vite again in the future, check the new version's
`engines.node` requirement against the rig's actual Node ceiling (currently
16, due to Ubuntu 16.04 / glibc 2.23 — see the GLIBC entry above) before
upgrading, or you will silently re-break rig compatibility.
