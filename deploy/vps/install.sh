#!/usr/bin/env bash
# =============================================================================
# N-Health one-command server installer (Debian 13 "trixie" / Debian 12 / Ubuntu 22.04+)
#
# Installs and configures everything on a fresh VPS:
#   PostgreSQL, Node.js 22 + pnpm, the N-Health API (systemd), the web app and admin
#   console (Nginx), HTTPS certificates (Let's Encrypt), firewall, fail2ban, swap,
#   automatic security updates and nightly database backups.
#
# Run as root:
#   curl -fsSL https://raw.githubusercontent.com/AbuBkrrr/NHealth/main/deploy/vps/install.sh -o install.sh
#   bash install.sh
#
# Optional settings (export before running, or answer the prompts):
#   DOMAIN=nhealth.com.ng          # serves www.DOMAIN, api.DOMAIN, admin.DOMAIN
#   LE_EMAIL=you@example.com       # Let's Encrypt expiry notices
#   SOURCE_DATABASE_URL=postgres://...   # copy existing data from Railway/Render (optional)
#   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME   # create the first super admin (optional)
#   BRANCH=main  REPO=https://github.com/AbuBkrrr/NHealth.git
#
# Safe to re-run: existing database, secrets and keys are kept.
# =============================================================================
set -Eeuo pipefail

REPO="${REPO:-https://github.com/AbuBkrrr/NHealth.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/nhealth
ENV_DIR=/etc/nhealth
ENV_FILE=$ENV_DIR/backend.env
APP_USER=nhealth
LOG=/var/log/nhealth-install.log

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_b=$'\e[1m'; c_0=$'\e[0m'
step() { echo; echo "${c_b}==> $*${c_0}"; }
ok() { echo "${c_ok}✔ $*${c_0}"; }
warn() { echo "${c_warn}! $*${c_0}"; }
die() { echo "${c_err}✘ $*${c_0}"; exit 1; }
trap 'echo "${c_err}✘ Failed at line $LINENO. See $LOG${c_0}"' ERR
exec > >(tee -a "$LOG") 2>&1

[ "$(id -u)" -eq 0 ] || die "Run as root (e.g. 'sudo -i' first)."
. /etc/os-release
case "$ID" in debian|ubuntu) ;; *) die "Unsupported OS: $PRETTY_NAME (needs Debian or Ubuntu)";; esac
ok "OS: $PRETTY_NAME"

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
step "1/11 System packages & automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y sudo curl ca-certificates gnupg git nginx postgresql postgresql-contrib ufw fail2ban \
  certbot python3-certbot-nginx unattended-upgrades build-essential openssl dnsutils jq
dpkg-reconfigure -f noninteractive unattended-upgrades || true
ok "Packages installed"

# -----------------------------------------------------------------------------
step "2/11 Swap (2 GB RAM servers need it to build the apps)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null; echo 'vm.swappiness=10' > /etc/sysctl.d/99-nhealth.conf
  ok "2 GB swap enabled"
else ok "Swap already present"; fi

# -----------------------------------------------------------------------------
step "3/11 Node.js 22 + pnpm"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  if curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; then apt-get install -y nodejs
  else warn "NodeSource unavailable - using the distribution's Node.js"; apt-get install -y nodejs npm; fi
fi
node -v
corepack enable >/dev/null 2>&1 || npm install -g corepack
corepack prepare pnpm@9.0.0 --activate
ok "Node $(node -v), pnpm $(pnpm -v)"

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
ok "Code at $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD))"

# -----------------------------------------------------------------------------
step "5/11 PostgreSQL database"
systemctl enable --now postgresql
mkdir -p $ENV_DIR && chmod 700 $ENV_DIR
DB_PASS_FILE=$ENV_DIR/db_password
[ -f $DB_PASS_FILE ] || openssl rand -hex 24 > $DB_PASS_FILE
chmod 600 $DB_PASS_FILE; DB_PASS=$(cat $DB_PASS_FILE)
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname='nhealth'" | grep -q 1 \
  || sudo -u postgres psql -qc "CREATE ROLE nhealth LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -qc "ALTER ROLE nhealth PASSWORD '$DB_PASS'"
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname='nhealth'" | grep -q 1 \
  || sudo -u postgres createdb -O nhealth nhealth
DATABASE_URL="postgresql://nhealth:$DB_PASS@127.0.0.1:5432/nhealth"
ok "Database 'nhealth' ready (local only, not exposed to the internet)"

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
fi
set_env() { grep -q "^$1=" "$ENV_FILE" && sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
set_env DATABASE_URL "$DATABASE_URL"
set_env NODE_ENV production
set_env PORT 4000
set_env PUBLIC_URL "https://$API_HOST"
set_env APP_URL "https://$WEB_HOST"
set_env CORS_ORIGIN "https://$ADMIN_HOST,https://$WEB_HOST,https://$DOMAIN"
chown root:$APP_USER "$ENV_FILE"; chmod 640 "$ENV_FILE"
ok "Configuration written. Add your payment/KYC/email keys later with: nano $ENV_FILE"

# -----------------------------------------------------------------------------
step "7/11 Install dependencies & build (takes 3-8 minutes)"
export NODE_OPTIONS=--max-old-space-size=1536
cd "$APP_DIR"
sudo -u $APP_USER -E HOME=/home/$APP_USER bash -c "
  set -e
  corepack enable >/dev/null 2>&1 || true
  pnpm install --frozen-lockfile
  pnpm --filter @nhealth/backend build
  VITE_API_URL=https://$API_HOST pnpm --filter @nhealth/landing build
  VITE_API_URL=https://$API_HOST/api pnpm --filter @nhealth/admin-web build
"
ok "Built API, web app and admin console"

# -----------------------------------------------------------------------------
step "8/11 API service (systemd)"
# Web-push keys (generated once, after dependencies are installed)
if ! grep -q '^VAPID_PUBLIC_KEY=.\+' "$ENV_FILE"; then
  KEYS=$(cd "$APP_DIR/apps/backend" && sudo -u $APP_USER node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)" 2>/dev/null || true)
  [ -n "$KEYS" ] && { set_env VAPID_PUBLIC_KEY "${KEYS% *}"; set_env VAPID_PRIVATE_KEY "${KEYS#* }"; ok "Push notification keys generated"; }
fi
sed "s|__APP_DIR__|$APP_DIR|g; s|__ENV_FILE__|$ENV_FILE|g; s|__USER__|$APP_USER|g" \
  "$APP_DIR/deploy/vps/nhealth-api.service" > /etc/systemd/system/nhealth-api.service
systemctl daemon-reload
systemctl enable nhealth-api >/dev/null
systemctl restart nhealth-api
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:4000/health >/dev/null || { journalctl -u nhealth-api -n 60 --no-pager; die "API did not start - see the log above"; }
ok "API running (migrations applied) - logs: journalctl -u nhealth-api -f"

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  (cd "$APP_DIR/apps/backend" && set -a && . "$ENV_FILE" && set +a && ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NAME="${ADMIN_NAME:-N-Health Admin}" node scripts/create-admin.cjs) \
    && ok "Super admin $ADMIN_EMAIL ready"
fi

# -----------------------------------------------------------------------------
step "9/11 Nginx (web app, admin console, API proxy)"
sed "s|__DOMAIN__|$DOMAIN|g; s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/vps/nginx.conf" > /etc/nginx/sites-available/nhealth.conf
ln -sf /etc/nginx/sites-available/nhealth.conf /etc/nginx/sites-enabled/nhealth.conf
rm -f /etc/nginx/sites-enabled/default
chmod o+x /opt "$APP_DIR" "$APP_DIR/apps" "$APP_DIR/apps/landing" "$APP_DIR/apps/admin-web" 2>/dev/null || true
nginx -t && systemctl reload nginx
ok "Nginx serving $WEB_HOST, $API_HOST, $ADMIN_HOST"

# -----------------------------------------------------------------------------
step "10/11 Firewall, fail2ban, backups"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null
install -m 755 "$APP_DIR/deploy/vps/backup.sh" /etc/cron.daily/nhealth-backup
install -m 755 "$APP_DIR/deploy/vps/update.sh" /usr/local/bin/nhealth-update
ok "Firewall on (SSH, HTTP, HTTPS only). Nightly backups to /var/backups/nhealth (14 days kept)"

# -----------------------------------------------------------------------------
step "11/11 HTTPS certificates"
missing=()
for h in "$DOMAIN" "$WEB_HOST" "$API_HOST" "$ADMIN_HOST"; do
  ip=$(dig +short A "$h" @1.1.1.1 | tail -n1)
  [ "$ip" = "$PUBLIC_IP" ] || missing+=("$h (points to ${ip:-nothing})")
done
if [ ${#missing[@]} -eq 0 ]; then
  certbot --nginx --non-interactive --agree-tos -m "$LE_EMAIL" --redirect \
    -d "$DOMAIN" -d "$WEB_HOST" -d "$API_HOST" -d "$ADMIN_HOST" && ok "HTTPS enabled (auto-renews)"
else
  warn "DNS is not pointing at this server yet for: ${missing[*]}"
  warn "Create these DNS A records -> $PUBLIC_IP :  @, www, api, admin   then run:"
  echo "    certbot --nginx --agree-tos -m $LE_EMAIL --redirect -d $DOMAIN -d $WEB_HOST -d $API_HOST -d $ADMIN_HOST"
fi

echo
echo "${c_b}================ N-Health is installed ================${c_0}"
echo " Web app:        https://$WEB_HOST"
echo " Admin console:  https://$ADMIN_HOST"
echo " API health:     https://$API_HOST/health"
echo " Settings/keys:  nano $ENV_FILE   then: systemctl restart nhealth-api"
echo " Update later:   nhealth-update"
echo " Logs:           journalctl -u nhealth-api -f"
[ -z "${ADMIN_EMAIL:-}" ] && echo " Create admin:   cd $APP_DIR/apps/backend && set -a && . $ENV_FILE && set +a && ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='long-password' node scripts/create-admin.cjs"
echo "========================================================"
