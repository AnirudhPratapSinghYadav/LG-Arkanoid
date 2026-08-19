# Troubleshooting

## Server Won't Start
- On the LG rig, use Node.js **16** (via nvm). On a modern laptop, Node 16+ is fine.
- Ensure `.env` is created and `LG_PASSWORD` is configured.
- Run `npm run server` and check for syntax errors.
- Phone controller must use port **8130**.

## Screens Won't Open on Slaves
- Ensure the master node has passwordless SSH access to the slave nodes (or the correct password in the scripts).
- Check if `google-chrome` or `chromium-browser` is installed on the rigs.

## Network Connection Fails
- Ensure the phone and Liquid Galaxy rig are on the same Wi-Fi subnet.
- Verify port **8130** is open. On a real rig check `/etc/iptables.conf`, not just
  `ufw`: frames re-apply that file on every `ifup`, so a rule added only through
  `ufw` disappears after a reboot and the phones stop reaching the master.
  `install.sh` appends the port to the `tcp` rule that already lists `8111`.

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

Keep **Node 16** on the rig (see `package.json` `engines` and `.nvmrc`). CI also checks 18 and 20. Stay on **Vite 4.x** — Vite 5 needs a newer Node than Ubuntu 16.04 can run.
