#!/usr/bin/env bash
# Build Spindle and deploy it to the "mini-pc" (Windows + WSL2 Ubuntu) on the LAN.
#
# Usage: deploy.sh [--skip-build]
#
# Environment overrides:
#   MINI_PC_HOST     ssh host alias        (default: mini-pc)
#   MINI_PC_PORT     http port on the LAN  (default: 8080)
#   MINI_PC_APP_DIR  install dir in WSL    (default: ~/apps/spindle)
#   MINI_PC_SERVICE  systemd unit name     (default: spindle)
#   MINI_PC_API_PORT PostgREST port, loopback only inside WSL (default: 3000)
#
# The mini-pc's OpenSSH default shell is wsl.exe, which rejects `ssh host <command>`
# and breaks scp/sftp. So everything goes over stdin of `ssh -T`: a bash script with
# the build tarball embedded as base64.
set -euo pipefail

host="${MINI_PC_HOST:-mini-pc}"
port="${MINI_PC_PORT:-8080}"
app_dir="${MINI_PC_APP_DIR:-\$HOME/apps/spindle}"
service="${MINI_PC_SERVICE:-spindle}"
api_port="${MINI_PC_API_PORT:-3000}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"

skip_build=false
for arg in "$@"; do
	case "$arg" in
		--skip-build) skip_build=true ;;
		-h | --help)
			sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
			exit 0
			;;
		*)
			echo "Unknown argument: $arg" >&2
			exit 2
			;;
	esac
done

build_site() {
	if [[ "$skip_build" == true ]]; then
		echo "==> Skipping build, using existing build/"
	else
		echo "==> Building (served from the site root; data from the shared database at /api)"
		(cd "$repo_root" && BASE_PATH='' SYNC_API_URL=/api npm run build)
	fi
	if [[ ! -f "$repo_root/build/index.html" ]]; then
		echo "build/index.html not found; run without --skip-build" >&2
		exit 1
	fi
}

make_bundle() {
	local staging="$1"
	mkdir -p "$staging/bundle"
	cp -R "$repo_root/build" "$staging/bundle/www"
	cp "$script_dir/serve.py" "$script_dir/remote-install.sh" "$script_dir/windows-expose.ps1" "$staging/bundle/"
	# Compose file and schema only; secrets are generated on the mini-pc, never shipped.
	mkdir -p "$staging/bundle/server"
	cp -R "$repo_root/server/compose.yaml" "$repo_root/server/db" "$staging/bundle/server/"
	COPYFILE_DISABLE=1 tar -czf "$staging/bundle.tgz" -C "$staging/bundle" .
}

remote_payload() {
	local bundle="$1"
	cat <<EOF
exec /bin/bash -s
set -euo pipefail
tmp="\$(mktemp -d)"
trap 'rm -rf "\$tmp"' EXIT
base64 -d >"\$tmp/bundle.tgz" <<'__SPINDLE_BUNDLE__'
$(base64 <"$bundle")
__SPINDLE_BUNDLE__
mkdir "\$tmp/bundle"
tar -xzf "\$tmp/bundle.tgz" -C "\$tmp/bundle" 2>/dev/null
bash "\$tmp/bundle/remote-install.sh" "\$tmp/bundle" "$app_dir" "$port" "$service" "$api_port" </dev/null
EOF
}

lan_ip() {
	ssh -G "$host" | awk '$1 == "hostname" { print $2 }'
}

main() {
	build_site

	# Global (not local) so the EXIT trap can still see it after main returns.
	staging="$(mktemp -d)"
	trap 'rm -rf "${staging:-}"' EXIT
	make_bundle "$staging"

	echo "==> Deploying to $host ($(du -h "$staging/bundle.tgz" | cut -f1) bundle)"
	remote_payload "$staging/bundle.tgz" | ssh -T -q -o BatchMode=yes "$host"

	local url
	url="http://$(lan_ip):${port}/"
	echo "==> Checking $url from this machine"
	if ! curl -fsS -o /dev/null --max-time 5 "$url"; then
		echo "!! Deployed, but $url is not reachable from here. Check the Windows firewall / port proxy." >&2
		exit 1
	fi
	if ! curl -fsS -o /dev/null --max-time 5 "${url}api/app_state?select=key&limit=1"; then
		echo "!! The site is up, but ${url}api/ is failing. Check the database containers (see SKILL.md)." >&2
		exit 1
	fi
	echo "==> Spindle is live at $url (shared database OK)"
}

main
