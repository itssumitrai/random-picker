#!/usr/bin/env bash
# Runs ON the mini-pc (inside WSL2) after deploy.sh unpacks the bundle.
# Starts the shared database (Docker: Postgres + PostgREST), installs the new build,
# (re)starts the systemd service, and refreshes the Windows port proxy + firewall
# rule so the LAN can reach the WSL2 server.
#
# Usage: remote-install.sh <bundle_dir> <app_dir> <port> <service_name> <api_port>
set -euo pipefail

bundle_dir="$1"
app_dir="$2"
port="$3"
service="$4"
api_port="$5"
server_dir="$app_dir/server"

log() { printf '[mini-pc] %s\n' "$*"; }

install_docker() {
	if command -v docker >/dev/null 2>&1 && sudo docker compose version >/dev/null 2>&1; then
		return 0
	fi
	log "Installing Docker Engine and the Compose plugin (one-time)"
	sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
	sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
	sudo systemctl enable --now docker
}

# Secrets live only here, in $server_dir/.env (mode 600). They are generated once
# and reused on every deploy; deleting the file does NOT reset the database passwords.
ensure_env_file() {
	if [[ -f "$server_dir/.env" ]]; then
		return 0
	fi
	(
		umask 077
		printf 'POSTGRES_PASSWORD=%s\nAUTHENTICATOR_PASSWORD=%s\n' \
			"$(openssl rand -hex 24)" "$(openssl rand -hex 24)" >"$server_dir/.env"
	)
	log "Generated $server_dir/.env with random passwords"
}

start_database() {
	mkdir -p "$server_dir"
	install -m 0644 "$bundle_dir/server/compose.yaml" "$server_dir/compose.yaml"
	rm -rf "$server_dir/db"
	cp -R "$bundle_dir/server/db" "$server_dir/db"
	ensure_env_file
	sudo API_PORT="$api_port" docker compose --project-directory "$server_dir" up -d --wait --quiet-pull
	log "Database API is up on 127.0.0.1:${api_port}"
}

install_files() {
	mkdir -p "$app_dir"
	rm -rf "$app_dir/www.new"
	cp -R "$bundle_dir/www" "$app_dir/www.new"
	install -m 0755 "$bundle_dir/serve.py" "$app_dir/serve.py"

	# Swap directories so the server never sees a half-copied build.
	rm -rf "$app_dir/www.prev"
	if [[ -d "$app_dir/www" ]]; then
		mv "$app_dir/www" "$app_dir/www.prev"
	fi
	mv "$app_dir/www.new" "$app_dir/www"
	log "Installed build into $app_dir/www"
}

install_service() {
	local unit="/etc/systemd/system/${service}.service"
	local tmp_unit
	tmp_unit="$(mktemp)"
	cat >"$tmp_unit" <<EOF
[Unit]
Description=Spindle randomizer (static site on port ${port}, /api -> 127.0.0.1:${api_port})
After=network-online.target docker.service
Wants=docker.service

[Service]
User=$(id -un)
ExecStart=/usr/bin/python3 ${app_dir}/serve.py --dir ${app_dir}/www --port ${port} --api http://127.0.0.1:${api_port}
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
	if ! sudo cmp -s "$tmp_unit" "$unit" 2>/dev/null; then
		sudo install -m 0644 "$tmp_unit" "$unit"
		sudo systemctl daemon-reload
		log "Wrote $unit"
	fi
	rm -f "$tmp_unit"
	sudo systemctl enable --quiet "$service"
	sudo systemctl restart "$service"
}

wait_for_server() {
	local i
	for i in $(seq 1 20); do
		if curl -fs -o /dev/null "http://127.0.0.1:${port}/"; then
			log "Server is up inside WSL on port ${port}"
			return 0
		fi
		sleep 0.5
	done
	log "Server did not respond on port ${port}; recent logs:"
	sudo journalctl -u "$service" -n 20 --no-pager || true
	return 1
}

expose_on_lan() {
	if ! command -v powershell.exe >/dev/null 2>&1; then
		log "powershell.exe not found; skipping Windows port proxy (not WSL?)"
		return 0
	fi
	local wsl_ip ps1 line
	wsl_ip="$(hostname -I | awk '{print $1}')"
	ps1="$(wslpath -w "$bundle_dir/windows-expose.ps1")"
	powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$ps1" \
		-Port "$port" -WslIp "$wsl_ip" -Distro "${WSL_DISTRO_NAME:?not running under WSL}" -LinuxUser "$(id -un)" </dev/null |
		tr -d '\000\r' | while IFS= read -r line; do
			if [[ -n "$line" ]]; then log "$line"; fi
		done
}

install_docker
start_database
install_files
install_service
wait_for_server
expose_on_lan
