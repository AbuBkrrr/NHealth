#!/usr/bin/env bash
# =============================================================================
# N-Health on a server that already runs Docker (next to your other apps).
#
#   curl -fsSL https://raw.githubusercontent.com/AbuBkrrr/NHealth/main/deploy/docker/setup.sh -o nhealth-setup.sh
#   CHECK_ONLY=1 bash nhealth-setup.sh    # look first; changes nothing
#   bash nhealth-setup.sh
#
# What it changes on the server: only /opt/nhealth, three containers named nhealth-*,
# their Docker volumes, /etc/cron.daily/nhealth-backup and /usr/local/bin/nhealth-update.
# No packages, no firewall, no ports, no other containers. The images are built by GitHub,
# so nothing is compiled on the server.
#
# Optional settings (export before running):
#   DOMAIN=nhealth.com.ng   PROXY_CONTAINER=collation-caddy-1   PROXY_NETWORK=<network>
#   SOURCE_DATABASE_URL=postgresql://...   (copy your data from Railway, optional)
#   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME   (first super admin, optional)
#   BRANCH=main
# Safe to re-run: the database, secrets and keys are kept.
# =============================================================================
set -Eeuo pipefail
BRANCH="${BRANCH:-main}"
RAW="${RAW:-https://raw.githubusercontent.com/AbuBkrrr/NHealth/$BRANCH}"
DIR=/opt/nhealth
CHECK_ONLY="${CHECK_ONLY:-0}"
c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_b=$'\e[1m'; c_0=$'\e[0m'
step() { echo; echo "${c_b}==> $*${c_0}"; }
ok() { echo "${c_ok}✔ $*${c_0}"; }
warn() { echo "${c_warn}! $*${c_0}"; }
die() { echo "${c_err}✘ $*${c_0}"; exit 1; }
trap 'echo "${c_err}✘ Failed at line $LINENO${c_0}"' ERR
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo -i first)."
command -v docker >/dev/null || die "Docker is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing (apt install docker-compose-plugin)."

DOMAIN="${DOMAIN:-nhealth.com.ng}"
WEB_HOST="www.$DOMAIN"; API_HOST="api.$DOMAIN"; ADMIN_HOST="admin.$DOMAIN"

# --- find the proxy that owns ports 80/443 -------------------------------------
step "Looking at this server"
if [ -z "${PROXY_CONTAINER:-}" ]; then
  PROXY_CONTAINER=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E ':(443|80)->' | awk '{print $1}' | head -n1 || true)
fi
[ -n "$PROXY_CONTAINER" ] || die "No container publishes ports 80/443, so there is no proxy to put N-Health behind.
   Use deploy/vps/install.sh instead (it sets up Nginx + HTTPS on the server itself)."
if [ -z "${PROXY_NETWORK:-}" ] && [ -f "$DIR/.env" ]; then PROXY_NETWORK=$(sed -n 's/^PROXY_NETWORK=//p' "$DIR/.env"); fi
if [ -z "${PROXY_NETWORK:-}" ]; then
  PROXY_NETWORK=$(docker inspect "$PROXY_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
fi
[ -n "$PROXY_NETWORK" ] || die "Could not find the Docker network of $PROXY_CONTAINER. Set PROXY_NETWORK=... and re-run."
[ "$PROXY_NETWORK" = host ] && die "$PROXY_CONTAINER uses host networking. Set PROXY_NETWORK to a bridge network and re-run."
MOUNTS=$(docker inspect "$PROXY_CONTAINER" --format '{{range .Mounts}}{{.Source}} {{.Destination}}{{"\n"}}{{end}}' || true)
CADDY_IN=/etc/caddy/Caddyfile
CADDYFILE=$(echo "$MOUNTS" | awk '$2 ~ /Caddyfile$/{print $1}' | head -n1)
[ -n "$CADDYFILE" ] && CADDY_IN=$(echo "$MOUNTS" | awk '$2 ~ /Caddyfile$/{print $2}' | head -n1)
if [ -z "$CADDYFILE" ]; then
  D=$(echo "$MOUNTS" | awk '$2=="/etc/caddy"{print $1}' | head -n1)
  [ -n "$D" ] && [ -f "$D/Caddyfile" ] && CADDYFILE="$D/Caddyfile"
fi
IS_CADDY=0; docker inspect "$PROXY_CONTAINER" --format '{{.Config.Image}}' | grep -qi caddy && IS_CADDY=1
echo " Proxy container:  $PROXY_CONTAINER ($(docker inspect "$PROXY_CONTAINER" --format '{{.Config.Image}}'))"
echo " Its network:      $PROXY_NETWORK  (N-Health's web and API containers join it; nothing else changes)"
[ -n "$CADDYFILE" ] && echo " Caddyfile:        $CADDYFILE"
echo " Memory:           $(free -h | awk '/^Mem:/{print $2" total, "$7" available"}'), swap $(free -h | awk '/^Swap:/{print $2}')"
echo " Disk free:        $(df -h / | awk 'NR==2{print $4}')"
for n in nhealth-db nhealth-api nhealth-web; do
  docker inspect "$n" >/dev/null 2>&1 && echo " Existing:         $n (will be updated)"
done
AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
[ "${AVAIL_MB:-0}" -lt 500 ] && warn "Only ${AVAIL_MB} MB RAM free. N-Health needs about 400-600 MB; consider adding swap or more RAM."

caddy_block() {
  cat <<EOF
# ---- N-Health ----
$DOMAIN {
	redir https://$WEB_HOST{uri} permanent
}
$WEB_HOST, $ADMIN_HOST {
	reverse_proxy nhealth-web:80
}
$API_HOST {
	reverse_proxy nhealth-api:4000
}
# ---- end N-Health ----
EOF
}

if [ "$CHECK_ONLY" = 1 ]; then
  echo
  echo "${c_b}What setup would do (nothing has been changed):${c_0}"
  echo " - create $DIR with docker-compose.yml, .env (database password) and backend.env (your keys)"
  echo " - download the ready-made images ghcr.io/abubkrrr/nhealth-api and nhealth-web (built by GitHub)"
  echo " - start nhealth-db (private network only), nhealth-api and nhealth-web (on network $PROXY_NETWORK)"
  echo "   memory caps: db 320 MB, api 640 MB, web 64 MB. No ports are opened on the server."
  echo " - install a nightly backup of the nhealth database and an 'nhealth-update' command"
  echo " - then you add this to your proxy${CADDYFILE:+ ($CADDYFILE)}:"
  caddy_block | sed 's/^/     /'
  exit 0
fi

# --- files -------------------------------------------------------------------------
step "1/6 Files in $DIR"
mkdir -p "$DIR" && chmod 700 "$DIR" && cd "$DIR"
curl -fsSL "$RAW/deploy/docker/docker-compose.yml" -o docker-compose.yml
# Containers from an older N-Health layout (services "db"/"api"/"web") are replaced; data volumes are kept.
for c in $(docker ps -aq --filter label=com.docker.compose.project=nhealth); do
  case "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$c")" in nhealth-*) ;; *) docker rm -f "$c" >/dev/null;; esac
done
if [ ! -f .env ]; then
  printf 'POSTGRES_PASSWORD=%s\nPROXY_NETWORK=%s\n' "$(openssl rand -hex 24)" "$PROXY_NETWORK" > .env
fi
grep -q '^PROXY_NETWORK=' .env || echo "PROXY_NETWORK=$PROXY_NETWORK" >> .env
chmod 600 .env
if [ ! -f backend.env ]; then
  curl -fsSL "$RAW/deploy/vps/backend.env.example" -o backend.env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|; /^DATABASE_URL=/d; /^PORT=/d; /^NODE_ENV=/d" backend.env
fi
set_env() { grep -q "^$1=" backend.env && sed -i "s|^$1=.*|$1=$2|" backend.env || echo "$1=$2" >> backend.env; }
set_env PUBLIC_URL "https://$API_HOST"
set_env APP_URL "https://$WEB_HOST"
set_env CORS_ORIGIN "https://$ADMIN_HOST,https://$WEB_HOST,https://$DOMAIN"
chmod 600 backend.env
ok "Configuration in $DIR (keys go in $DIR/backend.env)"

# --- images ----------------------------------------------------------------------
step "2/6 Downloading the N-Health images"
if [ "${SKIP_PULL:-0}" = 1 ]; then echo "SKIP_PULL=1: using images already on this server"
elif ! docker compose pull 2>&1 | tee /tmp/nhealth-pull.log; then
  if grep -qiE 'denied|unauthorized' /tmp/nhealth-pull.log; then
    die "GitHub refused the image download (the images are private). Log in once, then re-run:
     docker login ghcr.io -u AbuBkrrr
   For the password, use a GitHub token with the read:packages permission
   (GitHub > Settings > Developer settings > Personal access tokens)."
  fi
  die "Could not download the images (see above)."
fi
ok "Images downloaded"

# --- database ----------------------------------------------------------------------
step "3/6 Database"
docker compose up -d nhealth-db
for i in $(seq 1 60); do [ "$(docker inspect -f '{{.State.Health.Status}}' nhealth-db)" = healthy ] && break; sleep 2; done
[ "$(docker inspect -f '{{.State.Health.Status}}' nhealth-db)" = healthy ] || die "Database did not start: docker logs nhealth-db"
ok "Database running (private, not reachable from outside)"
if [ -n "${SOURCE_DATABASE_URL:-}" ]; then
  TABLES=$(docker exec nhealth-db psql -U nhealth -d nhealth -qtAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  if [ "$TABLES" = "0" ]; then
    echo "Copying your existing data..."
    docker exec -e SRC="$SOURCE_DATABASE_URL" nhealth-db sh -c 'pg_dump --no-owner --no-privileges "$SRC" | psql -q -U nhealth -d nhealth' \
      && ok "Data copied" || warn "Data copy failed - starting with an empty database (you can retry later)."
  else warn "Database already has tables - data copy skipped"; fi
fi

# --- API + web -------------------------------------------------------------------
step "4/6 API and web app"
if ! grep -q '^VAPID_PUBLIC_KEY=.\+' backend.env; then
  KEYS=$(docker compose run --rm --no-deps -T nhealth-api node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)" 2>/dev/null | tail -n1 || true)
  [ -n "$KEYS" ] && { set_env VAPID_PUBLIC_KEY "${KEYS% *}"; set_env VAPID_PRIVATE_KEY "${KEYS#* }"; ok "Push notification keys generated"; }
fi
docker compose up -d
for i in $(seq 1 90); do [ "$(docker inspect -f '{{.State.Health.Status}}' nhealth-api)" = healthy ] && break; sleep 2; done
[ "$(docker inspect -f '{{.State.Health.Status}}' nhealth-api)" = healthy ] || { docker logs --tail 60 nhealth-api; die "API did not start - see above"; }
ok "API and web app running"
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  docker exec -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" -e ADMIN_NAME="${ADMIN_NAME:-N-Health Admin}" \
    nhealth-api node scripts/create-admin.cjs && ok "Super admin $ADMIN_EMAIL ready"
fi

# --- backups + update command ------------------------------------------------------
step "5/6 Nightly backups and the update command"
cat > /etc/cron.daily/nhealth-backup <<'EOF'
#!/bin/sh
# N-Health nightly backup: database + uploaded files, 14 days kept in /var/backups/nhealth
set -e
D=/var/backups/nhealth; mkdir -p $D; chmod 700 $D; S=$(date +%Y%m%d-%H%M)
docker exec nhealth-db pg_dump -Fc -U nhealth nhealth > $D/db-$S.dump
docker cp nhealth-api:/app/apps/backend/uploads - 2>/dev/null | gzip > $D/uploads-$S.tar.gz || true
find $D -type f -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/nhealth-backup
cat > /usr/local/bin/nhealth-update <<EOF
#!/bin/sh
# Deploy the newest N-Health images (built by GitHub from the main branch)
set -e
cd $DIR
/etc/cron.daily/nhealth-backup || true
curl -fsSL $RAW/deploy/docker/docker-compose.yml -o docker-compose.yml
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
echo "N-Health updated. Logs: docker logs -f nhealth-api"
EOF
chmod 755 /usr/local/bin/nhealth-update
ok "Backups nightly to /var/backups/nhealth; update with: nhealth-update"

# --- proxy -----------------------------------------------------------------------------
step "6/6 Connect your proxy ($PROXY_CONTAINER)"
if [ "$IS_CADDY" = 1 ]; then
  if [ -n "$CADDYFILE" ] && grep -q -- '---- N-Health ----' "$CADDYFILE"; then
    ok "Your Caddyfile already has the N-Health block"
  elif [ "${ADD_TO_CADDYFILE:-0}" = 1 ] && [ -n "$CADDYFILE" ]; then
    cp -p "$CADDYFILE" "$CADDYFILE.before-nhealth"
    { echo; caddy_block; } >> "$CADDYFILE"   # appends in place (keeps the file Caddy has mounted)
    if docker exec "$PROXY_CONTAINER" caddy validate --config "$CADDY_IN" --adapter caddyfile >/dev/null 2>&1; then
      docker exec "$PROXY_CONTAINER" caddy reload --config "$CADDY_IN" --adapter caddyfile && ok "N-Health added to Caddy and Caddy reloaded (your other sites kept running)"
    else
      cat "$CADDYFILE.before-nhealth" > "$CADDYFILE"
      docker exec "$PROXY_CONTAINER" caddy validate --config "$CADDY_IN" --adapter caddyfile 2>&1 | tail -5
      die "Caddy rejected the new block, so your Caddyfile was put back exactly as it was. Nothing else changed."
    fi
  else
    echo "Add this block at the END of ${CADDYFILE:-your Caddyfile}:"
    echo; caddy_block; echo
    [ -n "$CADDYFILE" ] && { echo "Or let this script add it: re-run with  ADD_TO_CADDYFILE=1 bash nhealth-setup.sh"; echo; }
  fi
  echo "Then check and reload Caddy (graceful: your other sites keep running):"
  echo "    docker exec $PROXY_CONTAINER caddy validate --config $CADDY_IN --adapter caddyfile"
  echo "    docker exec $PROXY_CONTAINER caddy reload --config $CADDY_IN --adapter caddyfile"
  echo "Caddy fetches the HTTPS certificates itself once the DNS records point at this server."
else
  echo "In your proxy, forward with HTTPS + websockets on:"
  echo "    $WEB_HOST, $ADMIN_HOST -> http://nhealth-web:80"
  echo "    $API_HOST              -> http://nhealth-api:4000   (allow uploads up to 30 MB)"
  echo "    $DOMAIN                -> redirect to https://$WEB_HOST"
fi

echo
echo "${c_b}================ N-Health is running ================${c_0}"
echo " Web app:       https://$WEB_HOST      Admin: https://$ADMIN_HOST      API: https://$API_HOST/health"
echo " Keys:          nano $DIR/backend.env   then: cd $DIR && docker compose up -d"
echo " Logs:          docker logs -f nhealth-api"
echo " Update:        nhealth-update"
echo "======================================================"
