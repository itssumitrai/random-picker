---
name: deploy-mini-pc
description: Build Spindle and deploy it, together with its shared Postgres/PostgREST database (Docker), to the "mini-pc" home server (Windows + WSL2) so it is reachable over HTTP on the local network. Use when asked to deploy, ship, update, or restart the app or database on the mini-pc, back up or restore the shared wheels, or check why the LAN copy is down.
---

# Deploy Spindle to the mini-pc

Runs the production build and serves it on the LAN at `http://192.168.68.139:8080/`, backed by
the shared database (the single source of truth for every browser that uses this copy).
The IP comes from the `mini-pc` entry in `~/.ssh/config`.

## Deploy

```sh
.claude/skills/deploy-mini-pc/scripts/deploy.sh               # build + deploy
.claude/skills/deploy-mini-pc/scripts/deploy.sh --skip-build  # reuse existing build/
```

Overrides: `MINI_PC_HOST` (default `mini-pc`), `MINI_PC_PORT` (`8080`),
`MINI_PC_APP_DIR` (`$HOME/apps/spindle` inside WSL), `MINI_PC_SERVICE` (`spindle`),
`MINI_PC_API_PORT` (`3000`, PostgREST on loopback).

The script ends by fetching the LAN URL and `/api/` from this machine. If it prints
`Spindle is live … (shared database OK)`, the deploy worked.

Redeploying never touches the data. The Postgres volume `spindle_db-data` and `server/.env`
persist across deploys.

## How it works

| Step | Where | What |
| ---- | ----- | ---- |
| 1 | local | `BASE_PATH='' SYNC_API_URL=/api npm run build`, served from `/` (unlike GitHub Pages) |
| 2 | local | Tar `build/` + `server/compose.yaml` + `server/db/` + `serve.py` + `remote-install.sh` + `windows-expose.ps1`, base64 into a bash script (no secrets) |
| 3 | ssh | Pipe that script into `ssh -T mini-pc` |
| 4 | WSL | Installs `docker.io` + `docker-compose-v2` via apt if Docker is missing (one-time) |
| 5 | WSL | Generates `~/apps/spindle/server/.env` (random passwords, mode 600) if it doesn't exist |
| 6 | WSL | `docker compose up -d --wait`: Postgres (no published port) + PostgREST on `127.0.0.1:3000` |
| 7 | WSL | `remote-install.sh` swaps in `www/` (old copy kept as `www.prev/`) |
| 8 | WSL | Writes and restarts the systemd unit `spindle.service` (`python3 serve.py --api http://127.0.0.1:3000`) |
| 9 | Windows | `windows-expose.ps1`: `netsh portproxy` (IPv4 + IPv6) :8080 → WSL IP, firewall rule, keepalive task |

### Quirks of this host

- **OpenSSH's default shell is `wsl.exe`.** `ssh mini-pc <command>` fails with
  `Invalid command line argument: -c`, and scp/sftp fail with `Received message too long`.
  Send commands on stdin instead: `printf 'uname -a\n' | ssh -T mini-pc`.
- **WSL2 uses NAT networking** (172.17.x.x), so the LAN cannot reach WSL ports directly.
  Native Windows apps such as Plex don't have this problem. The port proxy is re-pointed
  on every deploy because the WSL IP can change after a reboot.
- The SSH session is an elevated Windows admin and `sudo` works without a password in WSL,
  so the deploy needs no prompts.
- systemd is enabled in WSL (`/etc/wsl.conf`), but **WSL stops the distro about 15s after the last
  session closes**, and the systemd service stops with it. The long `vmIdleTimeout` in `.wslconfig`
  keeps the VM alive, not the distro. The scheduled task `WSL keepalive (Ubuntu-24.04)` (runs at
  boot as S4U, no stored password) holds `sleep infinity` open in the distro to prevent this.
  Symptom if it isn't running: the LAN URL hangs or resets until someone SSHes in.
- `mini-pc.local` resolves via mDNS to IPv4 and IPv6, so the port proxy listens on both.

## Database

Layout on the mini-pc (inside WSL):

```text
~/apps/spindle/
  server/compose.yaml   copied from the repo on each deploy
  server/db/            schema init script, copied on each deploy
  server/.env           POSTGRES_PASSWORD, AUTHENTICATOR_PASSWORD; generated once, never leaves the host
  www/ www.prev/        site builds
  serve.py
```

- Containers: `spindle-db-1` (`postgres:18-alpine`) and `spindle-api-1` (`postgrest/postgrest:v16.5`),
  both `restart: unless-stopped`. Docker starts with WSL systemd, and the keepalive task below keeps
  the distro running.
- Data: Docker volume `spindle_db-data`, table `api.app_state` (one row, key `wheels`).
- **Secrets:** read `server/.env` only on the mini-pc. Don't print it, copy it off the host, or
  commit it. If it's lost, the database still holds the old role passwords. Reset them with
  `ALTER ROLE` via `docker compose exec db psql -U spindle spindle`, then write a new `.env`.
- `01-schema.sh` runs only when the volume is first created. See AGENTS.md for schema changes.

```sh
# Inspect the shared data
curl -s 'http://192.168.68.139:8080/api/app_state?select=key,updated_at'

# Back up (a SQL dump to this machine)
printf 'cd ~/apps/spindle/server && sudo docker compose exec -T db pg_dump -U spindle spindle\n' \
  | ssh -T -q mini-pc > spindle-$(date +%F).sql

# Restore just the wheels from an app export (Settings → Export backup) by importing it in the app UI.
```

## `serve.py`

A standard-library Python static server (no dependencies on the mini-pc):

- `/api/*` → proxied to PostgREST (`--api`), passing only `Accept`, `Content-Type`, `Prefer`, `Range`.
  Bodies are capped at 3 MB and responses are `no-store`. Returns 502 if the API is down.
- `/settings` → `settings.html` (prerendered pages), unknown routes → `index.html` (SPA fallback)
- Missing files with an extension → 404
- `/_app/immutable/*` → cached for a year; everything else → `no-cache`

Test it locally: `python3 .claude/skills/deploy-mini-pc/scripts/serve.py --dir build --port 8080`
(add `--api http://127.0.0.1:3000` with the local Docker stack running, see AGENTS.md).

## Troubleshooting

```sh
# Service status and logs
printf 'systemctl status spindle --no-pager; journalctl -u spindle -n 30 --no-pager\n' | ssh -T mini-pc

# Port proxy, firewall rule and keepalive task on Windows
printf 'powershell.exe -NoProfile -Command "netsh interface portproxy show all; Get-NetFirewallRule -DisplayName \\"Spindle*\\"; Get-ScheduledTask -TaskName \\"WSL keepalive*\\""\n' | ssh -T mini-pc

# Database containers and API logs
printf 'cd ~/apps/spindle/server && sudo docker compose ps && sudo docker compose logs --tail 30\n' | ssh -T mini-pc

# Restart the database stack
printf 'cd ~/apps/spindle/server && sudo docker compose restart\n' | ssh -T mini-pc

# Roll back to the previous build
printf 'cd ~/apps/spindle && mv www www.bad && mv www.prev www && sudo systemctl restart spindle\n' | ssh -T mini-pc
```

Symptom → cause:

- Settings says *Can't reach the shared database*: `/api` returns 502, so the containers are
  down. Check `docker compose ps`.
- API returns `401`/`42501` (permission denied): the schema's grants differ from `01-schema.sh`.
- First deploy fails at `apt-get`: the mini-pc has no internet access, or apt is locked by
  unattended-upgrades. Retry later.

## Uninstall

**Back up first.** `down -v` permanently deletes every shared wheel.

```sh
printf '%s\n' \
  'cd ~/apps/spindle/server && sudo docker compose down -v' \
  'sudo systemctl disable --now spindle; sudo rm /etc/systemd/system/spindle.service; rm -rf ~/apps/spindle' \
  'powershell.exe -NoProfile -Command "netsh interface portproxy delete v4tov4 listenport=8080 listenaddress=0.0.0.0; netsh interface portproxy delete v6tov4 listenport=8080 listenaddress=::; Remove-NetFirewallRule -DisplayName \"Spindle (TCP 8080)\""' \
  | ssh -T mini-pc
```

The keepalive task also keeps your other WSL services up, so remove it separately only if nothing
else needs it: `Unregister-ScheduledTask -TaskName "WSL keepalive (Ubuntu-24.04)" -Confirm:$false`.
