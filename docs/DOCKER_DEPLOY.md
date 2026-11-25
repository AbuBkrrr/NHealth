# N-Health on your Docker server (next to your other apps)

This is the recommended way for your server (102.68.85.97), because:
- Caddy (`collation-caddy-1`) already handles ports 80/443;
- everything else runs in Docker;
- only about 800 MB of memory is free.

N-Health runs as **three containers** of its own:

| Container | What it is | Memory cap |
|---|---|---|
| `nhealth-db` | PostgreSQL 17. Only `nhealth-api` can reach it | 320 MB |
| `nhealth-api` | The API, realtime and webhooks | 640 MB |
| `nhealth-web` | The web app and admin console | 64 MB |

**What it touches on the server:** `/opt/nhealth`, those three containers, their volumes, a nightly backup job and an `nhealth-update` command.
**What it does not touch:** packages, the firewall, server ports and your other containers.
**Where it is built:** GitHub builds the images, so nothing is compiled on your server.

Your Caddy forwards the N-Health addresses to these containers over its Docker network and gets the HTTPS certificates.

---

## 1. Point the domain at the server

At your DNS provider, create these A records pointing to `102.68.85.97`: `@`, `www`, `api`, `admin`.

## 2. Look first (changes nothing)

Connect from PowerShell (`ssh root@102.68.85.97`), then:

```bash
curl -fsSL https://raw.githubusercontent.com/AbuBkrrr/NHealth/main/deploy/docker/setup.sh -o nhealth-setup.sh
CHECK_ONLY=1 bash nhealth-setup.sh
```

It shows your proxy container, its network, your Caddyfile and exactly what it would do.

## 3. Install

```bash
export ADMIN_EMAIL="you@yourdomain.com" ADMIN_PASSWORD="a-long-unique-password"
export SOURCE_DATABASE_URL="postgresql://...Railway public URL..."   # optional: copy your current data
bash nhealth-setup.sh
```

**If it says the image download was refused,** the images are private. Log in once, then run it again:

```bash
docker login ghcr.io -u AbuBkrrr
```

For the password, paste a GitHub token that has the `read:packages` permission (GitHub → Settings → Developer settings → Personal access tokens). Alternatively, make the two `nhealth-*` packages public under GitHub → your profile → Packages.

## 4. Connect Caddy

The script prints a block to add to the end of your Caddyfile:

```
nhealth.com.ng {
	redir https://www.nhealth.com.ng{uri} permanent
}
www.nhealth.com.ng, admin.nhealth.com.ng {
	reverse_proxy nhealth-web:80
}
api.nhealth.com.ng {
	reverse_proxy nhealth-api:4000
}
```

The script can add it for you:

```bash
ADD_TO_CADDYFILE=1 bash nhealth-setup.sh
```

This keeps a copy of your current Caddyfile, checks the new configuration, and does a graceful reload, so your other sites stay up. If Caddy rejects the new block, the script puts your Caddyfile back exactly as it was.

Caddy gets the HTTPS certificates by itself once DNS points at the server.

## 5. Add your keys

```bash
nano /opt/nhealth/backend.env
```

```bash
cd /opt/nhealth && docker compose up -d
```

The second command restarts only the N-Health API, now with your keys. `docs/GO_LIVE.md` says where each key comes from and which webhook URLs to set (`https://api.nhealth.com.ng/api/webhooks/...`).

## Daily operation

| Task | Command |
|---|---|
| Deploy the latest version (GitHub builds it on every merge to main) | `nhealth-update` |
| API logs | `docker logs -f nhealth-api` |
| Status | `cd /opt/nhealth && docker compose ps` |
| Restart N-Health only | `cd /opt/nhealth && docker compose restart` |
| Backup now | `/etc/cron.daily/nhealth-backup` (saved in `/var/backups/nhealth`, kept 14 days) |
| Restore a backup | `docker exec -i nhealth-db pg_restore --clean -U nhealth -d nhealth < /var/backups/nhealth/db-XXXX.dump` |
| Stop N-Health | `cd /opt/nhealth && docker compose down` (data is kept in the volumes) |

Copy the backups off the server regularly. From your PC:

```powershell
scp root@102.68.85.97:/var/backups/nhealth/* .
```
