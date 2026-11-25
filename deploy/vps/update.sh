#!/usr/bin/env bash
# Deploy the latest code:  nhealth-update   (optionally: BRANCH=main nhealth-update)
set -Eeuo pipefail
APP_DIR=/opt/nhealth; BRANCH="${BRANCH:-main}"
ENV_FILE=/etc/nhealth/backend.env
NODE_DIR=/opt/nhealth-node; [ -x "$NODE_DIR/bin/node" ] || NODE_DIR=$(dirname "$(dirname "$(command -v node)")")
PORT=$(sed -n 's/^PORT=//p' "$ENV_FILE"); PORT=${PORT:-4000}
API_HOST=$(sed -n 's|^PUBLIC_URL=https\?://||p' "$ENV_FILE")
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
echo "==> Backing up the database first"; /etc/cron.daily/nhealth-backup || true
echo "==> Fetching $BRANCH"
git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
chown -R nhealth:nhealth "$APP_DIR"
echo "==> Building"
cd "$APP_DIR"
sudo -u nhealth env HOME=/home/nhealth PATH="$NODE_DIR/bin:/usr/bin:/bin" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=1536 bash -c "
  set -e
  pnpm install --frozen-lockfile
  pnpm --filter @nhealth/backend build
  VITE_API_URL=https://$API_HOST pnpm --filter @nhealth/landing build
  VITE_API_URL=https://$API_HOST/api pnpm --filter @nhealth/admin-web build
"
cp "$APP_DIR/deploy/vps/update.sh" /usr/local/bin/nhealth-update
sed "s|__APP_DIR__|$APP_DIR|g; s|__ENV_FILE__|$ENV_FILE|g; s|__USER__|nhealth|g; s|__NODE_DIR__|$NODE_DIR|g" "$APP_DIR/deploy/vps/nhealth-api.service" > /etc/systemd/system/nhealth-api.service && systemctl daemon-reload
echo "==> Restarting (runs migrations)"
systemctl restart nhealth-api
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:$PORT/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:$PORT/health && echo && echo "✔ Updated to $(git -C "$APP_DIR" rev-parse --short HEAD)" || { journalctl -u nhealth-api -n 50 --no-pager; exit 1; }
systemctl reload nginx
