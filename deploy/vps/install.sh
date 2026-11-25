#!/usr/bin/env bash
# =============================================================================
# N-Health one-command server installer (Debian 13 "trixie" / Debian 12 / Ubuntu 22.04+)
#
# Safe on a server that already runs other apps:
#   - Uses its own Node.js 22 in /opt/nhealth-node; the system Node.js is not touched.
#   - Uses its own database and user inside PostgreSQL; other databases are not touched.
#   - Picks a free local port for the API (4000 or the next free one).
#   - Adds its own Nginx site file and leaves your other sites, including "default", alone.
#   - If a Docker container (Nginx Proxy Manager, Traefik, Caddy, ...) already owns ports
#     80/443, N-Health runs behind it (BEHIND_PROXY mode) instead of taking those ports.
#     Any other web server on 80/443 stops the installer before it changes anything.
#   - On a Docker server the firewall is not switched on (it can cut container traffic).
#   - Before turning the firewall on, it allows every port that is already in use, so
#     your other apps stay reachable. A firewall you already run is left alone.
#   - Does not upgrade unrelated packages (set FULL_UPGRADE=1 if you want it to).
#
# Run as root:
#   curl -fsSL https://raw.githubusercontent.com/AbuBkrrr/NHealth/main/deploy/vps/install.sh -o install.sh
#   CHECK_ONLY=1 bash install.sh   # look at the server and say what would happen; changes nothing
#   bash install.sh
#
# Optional settings (export before running, or answer the prompts):
#   DOMAIN=nhealth.com.ng          # serves www.DOMAIN, api.DOMAIN, admin.DOMAIN
#   LE_EMAIL=you@example.com       # Let's Encrypt expiry notices
#   SOURCE_DATABASE_URL=postgres://...   # copy existing data from Railway/Render (optional)
#   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME   # create the first super admin (optional)
#   SKIP_FIREWALL=1  FULL_UPGRADE=1  API_PORT=4000
#   BEHIND_PROXY=1  NGINX_PORT=8088   # force/adjust "behind your Docker proxy" mode
#   BRANCH=main  REPO=https://github.com/AbuBkrrr/NHealth.git
#
# Safe to re-run: existing database, secrets and keys are kept.
# =============================================================================
set -Eeuo pipefail

REPO="${REPO:-https://github.com/AbuBkrrr/NHealth.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/nhealth
NODE_DIR=/opt/nhealth-node
ENV_DIR=/etc/nhealth
ENV_FILE=$ENV_DIR/backend.env
APP_USER=nhealth
LOG=/var/log/nhealth-install.log
CHECK_ONLY="${CHECK_ONLY:-0}"

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_b=$'\e[1m'; c_0=$'\e[0m'
step() { echo; echo "${c_b}==> $*${c_0}"; }
ok() { echo "${c_ok}✔ $*${c_0}"; }
warn() { echo "${c_warn}! $*${c_0}"; }
die() { echo "${c_err}✘ $*${c_0}"; exit 1; }
trap 'echo "${c_err}✘ Failed at line $LINENO. See $LOG${c_0}"' ERR
[ "$(id -u)" -eq 0 ] || die "Run as root (e.g. 'sudo -i' first)."
exec > >(tee -a "$LOG") 2>&1

. /etc/os-release
case "$ID" in debian|ubuntu) ;; *) die "Unsupported OS: $PRETTY_NAME (needs Debian or Ubuntu)";; esac
ok "OS: $PRETTY_NAME"

# --- helpers ------------------------------------------------------------------
# Processes listening on a TCP port (empty if free)
port_owner() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'users:(("[^"]*"' | sed 's/users:(("//; s/"$//' | sort -u | tr '\n' ' ' || true; }
port_used() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }
# Public (not loopback-only) listening ports: "tcp 3000", "udp 51820", ...
public_ports() {
  { ss -ltnH 2>/dev/null | awk '{print "tcp", $4}'; ss -lunH 2>/dev/null | awk '{print "udp", $4}'; } |
    grep -vE ' (127\.[0-9.]+|\[::1\]|\[::ffff:127\.[0-9.]+\]):[0-9]+$' |
    sed -E 's/ .*:([0-9]+)$/ \1/' | sort -u -k1,1 -k2,2n || true
}
ssh_ports() { { sshd -T 2>/dev/null | awk '/^port /{print $2}'; ss -ltnpH 2>/dev/null | awk '/"sshd"/{print $4}' | sed -E 's/.*:([0-9]+)$/\1/'; } | sort -un || true; }
other_firewall() {
  systemctl is-active --quiet firewalld 2>/dev/null && { echo firewalld; return; }
  systemctl is-enabled --quiet netfilter-persistent 2>/dev/null && { echo netfilter-persistent; return; }
  return 1
}
# Proxy container's Docker network gateway = the address it uses to reach this server
proxy_gateway() { docker inspect "$1" --format '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}' 2>/dev/null | awk '{print $1}' || true; }
proxy_caddyfile() { docker inspect "$1" --format '{{range .Mounts}}{{.Source}} {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null | awk '$2 ~ /Caddyfile$|^\/etc\/caddy$/{print $1}' | head -n1 || true; }
# Builds run with low priority and a memory cap so they can never starve your other apps:
# if the build needs more, it slows down (swap) or fails on its own - your containers are not touched.
LOW_IMPACT=(systemd-run --scope --quiet -p MemoryHigh=600M -p MemoryMax=850M nice -n 19 ionice -c3)
systemd-run --scope --quiet -p MemoryMax=850M true >/dev/null 2>&1 || LOW_IMPACT=(nice -n 19 ionice -c3)
docker_web() { command -v docker >/dev/null && docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ':(80|443)->' | awk '{print $1}' | tr '\n' ' ' || true; }
free_port() { local p=$1; while port_used "$p"; do p=$((p+1)); done; echo "$p"; }
# Addresses Docker containers can reach the host on (docker0, br-xxxx) + localhost
bridge_ips() { echo 127.0.0.1; ip -4 -o addr show type bridge 2>/dev/null | awk '{print $4}' | cut -d/ -f1; }
node_ok() { [ -x "$NODE_DIR/bin/node" ] && [ "$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]')" -ge 22 ]; }

print_proxy_steps() { # $1 proxy container, $2 address it reaches this server on
  local ct=$1 gw=$2 np=${NGINX_PORT:-$(free_port 8088)}
  echo
  echo "${c_b}Last step: send the N-Health addresses from your proxy ($ct) to N-Health${c_0}"
  if echo "$ct" | grep -qi caddy; then
    local cf; cf=$(proxy_caddyfile "$ct")
    echo " Your proxy is Caddy. Add this block at the END of its Caddyfile${cf:+ ($cf on this server)}:"
    echo
    echo "    ${DOMAIN}, ${WEB_HOST}, ${API_HOST}, ${ADMIN_HOST} {"
    echo "        reverse_proxy ${gw}:${np}"
    echo "    }"
    echo
    echo " Then check it and reload Caddy (a graceful reload: your other sites keep running):"
    echo "    docker exec $ct caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
    echo "    docker exec $ct caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"
    echo " Caddy gets the HTTPS certificates itself once DNS points here. It also handles websockets and large uploads."
  else
    echo " In your proxy, send each of $DOMAIN, $WEB_HOST, $API_HOST, $ADMIN_HOST to  http://${gw}:${np}"
    echo " with websockets on and HTTPS on. Nginx Proxy Manager: Forward Hostname/IP $gw, Port $np, Websockets Support,"
    echo " SSL: Request a new certificate + Force SSL. For $API_HOST, under Advanced add: client_max_body_size 30m;"
  fi
}

# --- look at the server before changing anything --------------------------------
step "Checking what already runs on this server"
WEB80=$(port_owner 80); WEB443=$(port_owner 443)
FOREIGN_WEB=""; DOCKER_WEB=$(docker_web || true)
for o in $WEB80 $WEB443; do case "$o" in nginx) ;; docker-proxy) ;; *) FOREIGN_WEB="$FOREIGN_WEB $o";; esac; done
HAS_DOCKER=0; command -v docker >/dev/null && HAS_DOCKER=1
BEHIND_PROXY=${BEHIND_PROXY:-0}
if [ -n "$DOCKER_WEB" ] || echo "$WEB80 $WEB443" | grep -qw docker-proxy; then BEHIND_PROXY=1; fi
echo " Ports 80/443 used by: ${WEB80:-free} / ${WEB443:-free}"
echo " System Node.js:       $(command -v node >/dev/null && node -v || echo none)  (N-Health uses its own copy in $NODE_DIR)"
echo " PostgreSQL:           $(command -v psql >/dev/null && psql --version | awk '{print $3}' || echo 'not installed (will install)')"
if command -v docker >/dev/null; then echo " Docker containers:    $(docker ps --format '{{.Names}}' 2>/dev/null | tr '\n' ' ' || true)"; fi
if [ -d /etc/nginx/sites-enabled ]; then echo " Nginx sites:          $(ls /etc/nginx/sites-enabled 2>/dev/null | tr '\n' ' ')"; fi
echo " Ports open to the internet now:"; public_ports | sed 's/^/   /'
echo " SSH port(s):          $(ssh_ports | tr '\n' ' ')"
FW_STATE="off"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then FW_STATE="ufw active"; fi
if OF=$(other_firewall); then FW_STATE="$OF active"; fi
echo " Firewall:             $FW_STATE"
echo " Memory:               $(free -h | awk '/^Mem:/{print $2" total, "$7" available"}'), swap: $(free -h | awk '/^Swap:/{print $2}')   Disk free: $(df -h / | awk 'NR==2{print $4}')"

[ -n "$DOCKER_WEB" ] && echo " Docker owns 80/443:   $DOCKER_WEB -> N-Health will run behind it (no changes to that container)"
if [ -n "$FOREIGN_WEB" ]; then
  die "Ports 80/443 are already used by:$FOREIGN_WEB. N-Health needs Nginx on those ports, so nothing was changed.
   Options: (a) put the N-Health sites into that web server instead (send this output to your developer), or
            (b) move that app behind Nginx. The installer will not stop or reconfigure it for you."
fi
AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
[ "${AVAIL_MB:-0}" -lt 700 ] && warn "Only ${AVAIL_MB} MB RAM is free. Building may be slow and lean on swap; your other apps may slow down during the build."

if [ "$CHECK_ONLY" = 1 ]; then
  echo
  echo "${c_b}What the installer would do (nothing has been changed):${c_0}"
  echo " - install missing packages only: nginx postgresql ufw fail2ban certbot git ... (no full upgrade)"
  echo " - install Node.js 22 privately in $NODE_DIR (your system Node.js stays as it is)"
  echo " - create PostgreSQL user + database 'nhealth' (other databases untouched)"
  P=${API_PORT:-4000}; while port_used "$P"; do P=$((P+1)); done
  echo " - run the API on 127.0.0.1:$P (local only), as system user '$APP_USER', service 'nhealth-api'"
  if [ "$BEHIND_PROXY" = 1 ]; then
    echo " - BEHIND YOUR DOCKER PROXY: host Nginx uses port $(free_port "${NGINX_PORT:-8088}"), answering only this server and Docker networks"
    echo "   (not on 80/443). Your proxy ($(echo "$DOCKER_WEB" | awk '{print $1}')) keeps 80/443 and HTTPS; at the end you add one block to it:"
    WEB_HOST="www.${DOMAIN:-nhealth.com.ng}"; API_HOST="api.${DOMAIN:-nhealth.com.ng}"; ADMIN_HOST="admin.${DOMAIN:-nhealth.com.ng}"; DOMAIN=${DOMAIN:-nhealth.com.ng}
    CT=$(echo "$DOCKER_WEB" | awk '{print $1}'); G=$(proxy_gateway "$CT"); print_proxy_steps "$CT" "${G:-172.17.0.1}" | sed 's/^/   /'
    echo " - build with low priority and a memory cap (850 MB, then swap), so your containers keep their memory"
  else
    echo " - add /etc/nginx/sites-available/nhealth.conf for www/api/admin.${DOMAIN:-<domain>} (other sites untouched)"
  fi
  PGP=5432; if ! command -v psql >/dev/null && port_used 5432; then PGP="$(free_port 5433) (5432 is taken, e.g. by a container)"; fi
  echo " - PostgreSQL port: $PGP"
  [ "$HAS_DOCKER" = 1 ] && [ "$FW_STATE" = off ] && FW_STATE="docker"
  case "$FW_STATE" in
    docker) echo " - leave the firewall off (Docker server): nothing changes for your containers" ;;
    off) echo " - turn on ufw, allowing SSH, 80, 443 and every port listed above as open to the internet" ;;
    "ufw active") echo " - add allow rules for 80 and 443 to your existing ufw" ;;
    *) echo " - leave your $FW_STATE firewall alone (open 80/443 in it yourself)" ;;
  esac
  [ "${SKIP_FIREWALL:-0}" = 1 ] && echo "   (SKIP_FIREWALL=1: no firewall changes at all)"
  echo " - add a 2 GB swap file only if there is no swap; enable fail2ban for SSH; nightly backups of the nhealth database"
  exit 0
fi

ask() { # ask VAR "Question" "default"
  local var=$1 q=$2 def=${3:-}
  if [ -z "${!var:-}" ]; then
    if [ -t 0 ]; then read -r -p "$q${def:+ [$def]}: " val || true; printf -v "$var" '%s' "${val:-$def}"
    else printf -v "$var" '%s' "$def"; fi
  fi
}
ask DOMAIN   "Your domain (www/api/admin will be created under it)" "nhealth.com.ng"
ask LE_EMAIL "Email for HTTPS certificate notices" "admin@${DOMAIN}"
WEB_HOST="www.$DOMAIN"; API_HOST="api.$DOMAIN"; ADMIN_HOST="admin.$DOMAIN"
PUBLIC_IP=$(curl -fsS4 --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')
ok "Domain: $DOMAIN  (web: $WEB_HOST, api: $API_HOST, admin: $ADMIN_HOST)  server IP: $PUBLIC_IP"

# -----------------------------------------------------------------------------
step "1/11 System packages (only what N-Health needs)"
export DEBIAN_FRONTEND=noninteractive
NGINX_WAS=0; command -v nginx >/dev/null && NGINX_WAS=1
if [ "$BEHIND_PROXY" = 1 ] && [ "$NGINX_WAS" = 0 ]; then
  # A freshly installed Nginx would try to grab port 80 from your Docker proxy: don't start it yet.
  printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d; chmod 755 /usr/sbin/policy-rc.d
  trap 'rm -f /usr/sbin/policy-rc.d' EXIT
fi
apt-get update -y
[ "${FULL_UPGRADE:-0}" = 1 ] && apt-get upgrade -y
apt-get install -y --no-upgrade sudo curl ca-certificates gnupg git nginx postgresql postgresql-contrib ufw fail2ban \
  certbot python3-certbot-nginx unattended-upgrades build-essential openssl dnsutils jq xz-utils iproute2
rm -f /usr/sbin/policy-rc.d
# Only the stock "welcome" site of an Nginx we just installed is removed, so it can't fight Docker for port 80.
[ "$BEHIND_PROXY" = 1 ] && [ "$NGINX_WAS" = 0 ] && rm -f /etc/nginx/sites-enabled/default
ok "Packages installed"

# -----------------------------------------------------------------------------
step "2/11 Swap (2 GB RAM servers need it to build the apps)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap enabled"
else ok "Swap already present - left as is"; fi

# -----------------------------------------------------------------------------
step "3/11 Node.js 22 (private copy in $NODE_DIR) + pnpm"
if ! node_ok; then
  case "$(uname -m)" in x86_64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) die "Unsupported CPU $(uname -m)";; esac
  BASE=https://nodejs.org/dist/latest-v22.x
  SUMS=$(curl -fsSL "$BASE/SHASUMS256.txt")
  FILE=$(echo "$SUMS" | awk "/linux-$ARCH.tar.xz\$/{print \$2}")
  [ -n "$FILE" ] || die "Could not find the Node.js 22 download"
  TMP=$(mktemp -d)
  curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && echo "$SUMS" | grep " $FILE\$" | sha256sum -c -) || die "Node.js download failed its checksum"
  rm -rf "$NODE_DIR.new" && mkdir -p "$NODE_DIR.new"
  tar -xJf "$TMP/$FILE" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR" && mv "$NODE_DIR.new" "$NODE_DIR"; rm -rf "$TMP"
fi
export PATH="$NODE_DIR/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable --install-directory "$NODE_DIR/bin"
ok "Node $("$NODE_DIR/bin/node" -v) at $NODE_DIR (system Node.js untouched)"

# -----------------------------------------------------------------------------
step "4/11 Application user & code"
id -u $APP_USER >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin $APP_USER
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
mkdir -p "$APP_DIR/apps/backend/uploads"
chown -R $APP_USER:$APP_USER "$APP_DIR"
git config --global --add safe.directory "$APP_DIR"
RUN_AS() { sudo -u $APP_USER env HOME=/home/$APP_USER PATH="$NODE_DIR/bin:/usr/bin:/bin" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$@"; }
RUN_AS bash -c "cd $APP_DIR && corepack prepare pnpm@9.0.0 --activate >/dev/null && pnpm -v" >/dev/null
ok "Code at $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD))"

# -----------------------------------------------------------------------------
step "5/11 PostgreSQL database"
systemctl enable --now postgresql
# A Docker container on 5432 stops a newly installed cluster from starting: move ours to a free port.
if ! sudo -u postgres psql -qtAc 'SELECT 1' >/dev/null 2>&1; then
  read -r PGV PGC < <(pg_lsclusters -h | awk 'NR==1{print $1, $2}')
  [ -n "${PGV:-}" ] || die "PostgreSQL is installed but has no cluster. Run: pg_createcluster --start \$(ls /usr/lib/postgresql | sort -V | tail -1) main"
  pg_ctlcluster "$PGV" "$PGC" start 2>/dev/null || true
  if ! sudo -u postgres psql -qtAc 'SELECT 1' >/dev/null 2>&1; then
    NEWP=$(free_port 5433)
    pg_ctlcluster "$PGV" "$PGC" stop 2>/dev/null || true
    sed -i -E "s/^#?port *=.*/port = $NEWP/" "/etc/postgresql/$PGV/$PGC/postgresql.conf"
    pg_ctlcluster "$PGV" "$PGC" start
    sudo -u postgres psql -qtAc 'SELECT 1' >/dev/null || die "PostgreSQL could not start - see: journalctl -u postgresql@$PGV-$PGC"
    ok "PostgreSQL moved to port $NEWP (5432 is used by something else)"
  fi
fi
mkdir -p $ENV_DIR && chmod 700 $ENV_DIR
PG_PORT=$(sudo -u postgres psql -qtAc 'SHOW port' 2>/dev/null || echo 5432)
DB_PASS_FILE=$ENV_DIR/db_password
[ -f $DB_PASS_FILE ] || openssl rand -hex 24 > $DB_PASS_FILE
chmod 600 $DB_PASS_FILE; DB_PASS=$(cat $DB_PASS_FILE)
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname='nhealth'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE ROLE nhealth LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -qc "ALTER ROLE nhealth PASSWORD '$DB_PASS'"
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname='nhealth'" | grep -q 1 \
  || sudo -u postgres createdb -O nhealth nhealth
DATABASE_URL="postgresql://nhealth:$DB_PASS@127.0.0.1:$PG_PORT/nhealth"
ok "Database 'nhealth' ready on local port $PG_PORT (other databases untouched, not exposed to the internet)"

if [ -n "${SOURCE_DATABASE_URL:-}" ]; then
  TABLES=$(sudo -u postgres psql -d nhealth -qtAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  if [ "$TABLES" = "0" ]; then
    step "Copying existing data from your old database"
    pg_dump --no-owner --no-privileges "$SOURCE_DATABASE_URL" | psql -q "$DATABASE_URL" \
      && ok "Data copied" || warn "Data copy failed (version mismatch?). The app will start with an empty database; you can retry later."
  else warn "Local database already has tables - skipping the data copy"; fi
fi

# -----------------------------------------------------------------------------
step "6/11 Backend configuration ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/deploy/vps/backend.env.example" "$ENV_FILE"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" "$ENV_FILE"
  sed -i "/^PORT=/d" "$ENV_FILE"
fi
set_env() { grep -q "^$1=" "$ENV_FILE" && sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
# Keep the port chosen on an earlier run; otherwise take the first free one.
PORT=$(sed -n 's/^PORT=//p' "$ENV_FILE")
if [ -z "$PORT" ]; then PORT=${API_PORT:-4000}; while port_used "$PORT"; do PORT=$((PORT+1)); done; fi
set_env DATABASE_URL "$DATABASE_URL"
set_env NODE_ENV production
set_env PORT "$PORT"
set_env PUBLIC_URL "https://$API_HOST"
set_env APP_URL "https://$WEB_HOST"
set_env CORS_ORIGIN "https://$ADMIN_HOST,https://$WEB_HOST,https://$DOMAIN"
chown root:$APP_USER "$ENV_FILE"; chmod 640 "$ENV_FILE"
ok "Configuration written (API on local port $PORT). Add your payment/KYC/email keys later with: nano $ENV_FILE"

# -----------------------------------------------------------------------------
step "7/11 Install dependencies & build (takes 3-8 minutes)"
"${LOW_IMPACT[@]}" sudo -u $APP_USER env HOME=/home/$APP_USER PATH="$NODE_DIR/bin:/usr/bin:/bin" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=1536 bash -c "
  set -e
  cd $APP_DIR
  pnpm install --frozen-lockfile
  pnpm --filter @nhealth/backend build
  VITE_API_URL=https://$API_HOST pnpm --filter @nhealth/landing build
  VITE_API_URL=https://$API_HOST/api pnpm --filter @nhealth/admin-web build
"
ok "Built API, web app and admin console"

# -----------------------------------------------------------------------------
step "8/11 API service (systemd)"
if ! grep -q '^VAPID_PUBLIC_KEY=.\+' "$ENV_FILE"; then
  KEYS=$(cd "$APP_DIR/apps/backend" && RUN_AS node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)" 2>/dev/null || true)
  [ -n "$KEYS" ] && { set_env VAPID_PUBLIC_KEY "${KEYS% *}"; set_env VAPID_PRIVATE_KEY "${KEYS#* }"; ok "Push notification keys generated"; }
fi
sed "s|__APP_DIR__|$APP_DIR|g; s|__ENV_FILE__|$ENV_FILE|g; s|__USER__|$APP_USER|g; s|__NODE_DIR__|$NODE_DIR|g" \
  "$APP_DIR/deploy/vps/nhealth-api.service" > /etc/systemd/system/nhealth-api.service
systemctl daemon-reload
systemctl enable nhealth-api >/dev/null
systemctl restart nhealth-api
for i in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null || { journalctl -u nhealth-api -n 60 --no-pager; die "API did not start - see the log above"; }
ok "API running on 127.0.0.1:$PORT (migrations applied) - logs: journalctl -u nhealth-api -f"

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  (cd "$APP_DIR/apps/backend" && set -a && . "$ENV_FILE" && set +a && ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NAME="${ADMIN_NAME:-N-Health Admin}" "$NODE_DIR/bin/node" scripts/create-admin.cjs) \
    && ok "Super admin $ADMIN_EMAIL ready"
fi

# -----------------------------------------------------------------------------
step "9/11 Nginx site for N-Health (your other sites are not changed)"
CONF=/etc/nginx/sites-available/nhealth.conf
# certbot adds HTTPS lines to this file; keep them on re-runs and only refresh the port.
if [ -f "$CONF" ] && grep -q 'managed by Certbot' "$CONF"; then
  sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:$PORT;|" "$CONF"
else
  sed "s|__DOMAIN__|$DOMAIN|g; s|__APP_DIR__|$APP_DIR|g; s|__API_PORT__|$PORT|g" "$APP_DIR/deploy/vps/nginx.conf" > "$CONF"
  if [ "$BEHIND_PROXY" = 1 ]; then
    # Listen only where the Docker proxy (and this server) can reach, on a spare port; trust its headers.
    WANT_NGINX_PORT=${NGINX_PORT:-8088}
    NGINX_PORT=$(sed -n 's/^NGINX_PORT=//p' "$ENV_FILE"); [ -n "$NGINX_PORT" ] || NGINX_PORT=$(free_port "$WANT_NGINX_PORT")
    set_env NGINX_PORT "$NGINX_PORT"
    # One port on all addresses (binding to Docker bridge IPs would fail at boot before Docker starts),
    # answered only for this server and private Docker networks.
    sed -i -E "/^ *listen \[::\]:80;$/d; s|^ *listen 80;$|    listen $NGINX_PORT; if (\$nh_internal = 0) { return 444; }|" "$CONF"
    sed -i "s|^# __PROXY_TRUST__$|set_real_ip_from 127.0.0.1; set_real_ip_from 172.16.0.0/12; set_real_ip_from 10.0.0.0/8; set_real_ip_from 192.168.0.0/16; real_ip_header X-Forwarded-For; real_ip_recursive on;|; s|^map \$http_x_forwarded_proto \$nh_proto .*|map \$http_x_forwarded_proto \$nh_proto { default \$http_x_forwarded_proto; '' \$scheme; }|" "$CONF"
  fi
fi
ln -sf "$CONF" /etc/nginx/sites-enabled/nhealth.conf
chmod o+x /opt "$APP_DIR" "$APP_DIR/apps" "$APP_DIR/apps/landing" "$APP_DIR/apps/admin-web" 2>/dev/null || true
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/nhealth.conf
  die "Nginx rejected the configuration. The N-Health site was switched off again, so your other sites keep working. Send the lines above to your developer."
fi
systemctl enable --now nginx >/dev/null; systemctl reload nginx
if [ "$BEHIND_PROXY" = 1 ]; then ok "Nginx serving N-Health on port $NGINX_PORT for your Docker proxy (80/443 left to it)"
else ok "Nginx serving $WEB_HOST, $API_HOST, $ADMIN_HOST"; fi

# -----------------------------------------------------------------------------
step "10/11 Firewall, fail2ban, backups"
if [ "${SKIP_FIREWALL:-0}" = 1 ]; then warn "SKIP_FIREWALL=1 - firewall not changed. Make sure ports 80 and 443 are open."
elif [ "$HAS_DOCKER" = 1 ] && ! ufw status 2>/dev/null | grep -q 'Status: active'; then
  warn "Docker server and no firewall on today - left off so your containers keep working. Use your provider's firewall panel to allow only 22, 80 and 443 if you want one."
elif OF=$(other_firewall); then warn "$OF is managing the firewall - left alone. Open ports 80 and 443 in it."
else
  if ! ufw status | grep -q 'Status: active'; then
    # Keep everything that is reachable today reachable after the firewall turns on.
    for p in $(ssh_ports) 22; do ufw allow "$p/tcp" >/dev/null; done
    while read -r proto p; do [ -n "$p" ] && ufw allow "$p/$proto" >/dev/null; done < <(public_ports)
    ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
    ufw --force enable >/dev/null
    ok "Firewall on. Allowed: SSH, 80, 443 and the ports already in use: $(public_ports | awk '{print $2"/"$1}' | tr '\n' ' ')"
  else
    ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
    if [ "$BEHIND_PROXY" = 1 ]; then for net in 172.16.0.0/12 10.0.0.0/8 192.168.0.0/16; do ufw allow from "$net" to any port "$NGINX_PORT" proto tcp >/dev/null; done; fi
    ok "Existing ufw kept; ports 80 and 443 allowed"
  fi
  command -v docker >/dev/null && warn "Docker publishes container ports past ufw; that is unchanged."
fi
systemctl enable --now fail2ban >/dev/null || true
install -m 755 "$APP_DIR/deploy/vps/backup.sh" /etc/cron.daily/nhealth-backup
install -m 755 "$APP_DIR/deploy/vps/update.sh" /usr/local/bin/nhealth-update
ok "Nightly backups of the nhealth database to /var/backups/nhealth (14 days kept)"

# -----------------------------------------------------------------------------
step "11/11 HTTPS certificates"
if [ "$BEHIND_PROXY" = 1 ]; then
  PROXY_CT=$(echo "$DOCKER_WEB" | awk '{print $1}')
  GW=""; [ -n "$PROXY_CT" ] && GW=$(proxy_gateway "$PROXY_CT")
  [ -n "$GW" ] || GW=$(ip -4 -o addr show docker0 2>/dev/null | awk '{print $4}' | cut -d/ -f1); GW=${GW:-172.17.0.1}
  print_proxy_steps "$PROXY_CT" "$GW"
  missing=(proxy)
fi
[ "$BEHIND_PROXY" = 1 ] || {
missing=()
for h in "$DOMAIN" "$WEB_HOST" "$API_HOST" "$ADMIN_HOST"; do
  ip=$(dig +short A "$h" @1.1.1.1 | tail -n1)
  [ "$ip" = "$PUBLIC_IP" ] || missing+=("$h (points to ${ip:-nothing})")
done
if [ ${#missing[@]} -eq 0 ]; then
  certbot --nginx --non-interactive --agree-tos -m "$LE_EMAIL" --redirect --cert-name nhealth \
    -d "$DOMAIN" -d "$WEB_HOST" -d "$API_HOST" -d "$ADMIN_HOST" && ok "HTTPS enabled (auto-renews)"
else
  warn "DNS is not pointing at this server yet for: ${missing[*]}"
  warn "Create these DNS A records -> $PUBLIC_IP :  @, www, api, admin   then run:"
  echo "    certbot --nginx --agree-tos -m $LE_EMAIL --redirect --cert-name nhealth -d $DOMAIN -d $WEB_HOST -d $API_HOST -d $ADMIN_HOST"
fi
}

echo
echo "${c_b}================ N-Health is installed ================${c_0}"
echo " Web app:        https://$WEB_HOST"
echo " Admin console:  https://$ADMIN_HOST"
echo " API health:     https://$API_HOST/health"
echo " Settings/keys:  nano $ENV_FILE   then: systemctl restart nhealth-api"
echo " Update later:   nhealth-update"
echo " Logs:           journalctl -u nhealth-api -f"
[ -z "${ADMIN_EMAIL:-}" ] && echo " Create admin:   cd $APP_DIR/apps/backend && set -a && . $ENV_FILE && set +a && ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='long-password' $NODE_DIR/bin/node scripts/create-admin.cjs"
echo "========================================================"
