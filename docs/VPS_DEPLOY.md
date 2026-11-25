# Moving N-Health to your VPS (Debian 13) — step by step

Server: **102.68.85.97** (Debian 13, 2 vCPU, 2 GB RAM, 80 GB disk).
Everything runs on this one server:

| Part | Address |
|---|---|
| Web app | `https://www.nhealth.com.ng` |
| Admin console | `https://admin.nhealth.com.ng` |
| API | `https://api.nhealth.com.ng` |
| Database | PostgreSQL, private to the server |

One script sets everything up, and you can re-run it safely.

---

## Step 1 — Get your root password

The welcome email says root access details are never emailed. Find them in your hosting client area:

1. Log in to your hosting provider's client area → **Services** → your *Linux Cloud Server 2026* (`vm136qylw.yourlocaldomain.com`).
2. Look for **Login details / Root password / Reset root password**, and copy or set the password.
3. On the same page, make sure the server shows **Running/Online**. If there's a **VNC/Console** button that doesn't connect, ignore it; PowerShell works instead.

## Step 2 — Connect from Windows PowerShell

Open **PowerShell** (Start → type "PowerShell"). First check the server answers on SSH:

```powershell
Test-NetConnection 102.68.85.97 -Port 22
```

`TcpTestSucceeded : True` means it's reachable. If it's `False`, the server is off, or SSH/port 22 is blocked in the provider's firewall panel. Turn it on there, or ask their support to "enable SSH on port 22".

Connect:

```powershell
ssh root@102.68.85.97
```

- Type `yes` when asked about the fingerprint.
- Paste the root password. Right-click pastes in PowerShell, and nothing shows while you type; that's normal.
- You'll see a prompt like `root@vm136qylw:~#`.

## Step 3 — Point your domain at the server

In the DNS settings for **nhealth.com.ng** (where you bought the domain, or Cloudflare), create or replace these **A records**:

| Type | Name | Value |
|---|---|---|
| A | `@` | `102.68.85.97` |
| A | `www` | `102.68.85.97` |
| A | `api` | `102.68.85.97` |
| A | `admin` | `102.68.85.97` |

Delete old records for these names that point to Railway or Vercel (CNAMEs included). DNS can take from a few minutes to a few hours.

The installer still works before DNS has switched over. It just skips HTTPS and tells you the one command to run later.

## Step 4 — Copy your current data (optional but recommended)

To keep your existing users and records, get your old database's connection URL:
1. Railway → your project → **Postgres** service → **Connect** tab.
2. Copy the **Public Network** URL. It looks like `postgresql://postgres:…@….proxy.rlwy.net:12345/railway`.

You'll paste it in step 5. Skip this step for a fresh, empty start.

## Step 5 — Run the installer (on the server)

Paste these into the PowerShell window that is connected to the server. Replace the values in quotes:

```bash
export DOMAIN="nhealth.com.ng"
export LE_EMAIL="you@yourdomain.com"
export ADMIN_EMAIL="you@yourdomain.com"
export ADMIN_PASSWORD="a-long-unique-password"
export SOURCE_DATABASE_URL="postgresql://...paste from step 4, or delete this line..."
curl -fsSL https://raw.githubusercontent.com/AbuBkrrr/NHealth/main/deploy/vps/install.sh -o install.sh
bash install.sh
```

It takes about **10–15 minutes** and prints a ✔ for each stage:

1. updates
2. 2 GB swap
3. Node.js 22
4. downloads the code
5. PostgreSQL (plus your copied data, if you set `SOURCE_DATABASE_URL`)
6. config
7. build
8. API service
9. Nginx
10. firewall and backups
11. HTTPS

At the end it shows your web addresses.

**If PowerShell disconnects midway**, reconnect and run `bash install.sh` again. It continues safely.

## Step 6 — Add your keys

```bash
nano /etc/nhealth/backend.env
```

Fill in the Paystack, Flutterwave, Resend, Didit, PayScrow, Termii and `PLATFORM_*` lines; see `docs/GO_LIVE.md` for where each key comes from. Save with **Ctrl+O, Enter, Ctrl+X**, then:

```bash
systemctl restart nhealth-api
```

Then set these **webhook URLs** in each provider's dashboard:

| Provider | Webhook URL |
|---|---|
| Paystack | `https://api.nhealth.com.ng/api/webhooks/paystack` |
| Flutterwave | `https://api.nhealth.com.ng/api/webhooks/flutterwave` |
| PayScrow | `https://api.nhealth.com.ng/api/webhooks/payscrow` |
| Didit | `https://api.nhealth.com.ng/api/webhooks/didit` |

Also set the **Paystack callback URL** to `https://www.nhealth.com.ng/`.

## Step 7 — Check everything

- Open `https://admin.nhealth.com.ng`, sign in with `ADMIN_EMAIL`, and go to **Integration status**. Each row should be green.
- Open `https://www.nhealth.com.ng`, create a patient account, and book a test appointment.
- Then follow step 11 of `docs/GO_LIVE.md` (the real-money test).

## Step 8 — Turn off the old hosting

Once the new server works:
- **Railway:** disconnect or pause the backend and web services, after you've copied the data (step 4).
- **Vercel:** delete the `admin-web` project.

---

## Daily operation

| Task | Command (on the server) |
|---|---|
| Deploy the latest code from GitHub | `nhealth-update` |
| See live API logs | `journalctl -u nhealth-api -f` |
| Restart the API | `systemctl restart nhealth-api` |
| Edit keys/settings | `nano /etc/nhealth/backend.env`, then restart |
| Run a backup now | `/etc/cron.daily/nhealth-backup` |
| List backups | `ls -lh /var/backups/nhealth` |
| Restore a backup | `sudo -u postgres pg_restore --clean -d nhealth /var/backups/nhealth/db-YYYYMMDD-HHMM.dump` |
| Renew HTTPS (automatic; to test) | `certbot renew --dry-run` |
| Disk/memory | `df -h` / `free -h` |

**Backups:**
- Nightly backups (database + uploaded files) are kept **on the server for 14 days**.
- Copy them off the server regularly. From your PC: `scp root@102.68.85.97:/var/backups/nhealth/* .`
- Your plan has no snapshots, so also consider adding the provider's backup option.

**Security that is set up for you:**
- The firewall only allows SSH, HTTP and HTTPS.
- fail2ban blocks SSH password guessing.
- Security updates install automatically.
- The database isn't reachable from the internet.
- The API runs as a non-root user.

For extra safety, use an SSH key instead of a password. On your PC, run `ssh-keygen`, then:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@102.68.85.97 "cat >> ~/.ssh/authorized_keys"
```
