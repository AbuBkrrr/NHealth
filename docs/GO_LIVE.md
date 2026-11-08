# N-Health go-live guide (step by step)

Do the steps in order. Each step ends with a **✔ check**. Do not move on until the check passes.

You need:
- your Railway project (backend + web services)
- the Paystack, Flutterwave, Resend, Didit and PayScrow dashboards
- Termii and Cloudinary accounts (sign-up is free)
- access to the DNS settings for `nhealth.com.ng`

Throughout this guide, `API` means `https://n-health-backend-production.up.railway.app`. If you put the backend on a custom domain (for example `https://api.nhealth.com.ng`), use that instead everywhere.

---

## Step 0 — Back up and prepare (10 min)

1. Railway → your **Postgres** service → **Backups** → **Create backup**.
2. Generate a strong JWT secret, but only if `JWT_SECRET` is not already set. Changing it logs every user out.

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. Generate the web-push keys once and keep them safe:

   ```bash
   npx web-push generate-vapid-keys
   ```

**✔ check:** the backup is listed in Railway.

---

## Step 1 — Resend (transactional email) (15 min)

The previous backend never sent email, so even if a `RESEND_API_KEY` exists on Railway it was unused until now.

1. Resend → **Domains** → **Add domain** → `nhealth.com.ng`. Region: closest to your users (EU West or US East).
2. Add the DNS records Resend shows in your DNS provider: **MX** and **TXT (SPF)** on `send.nhealth.com.ng`, and **TXT (DKIM)** on `resend._domainkey`.
3. Wait until the domain shows **Verified**. This usually takes minutes, but can take up to 24 hours.
4. Resend → **API Keys** → **Create**. Permission: *Sending access*, domain `nhealth.com.ng`. Copy the key (`re_…`).
5. Railway → backend service → **Variables**:
   - `RESEND_API_KEY=re_…`
   - `EMAIL_FROM=N-Health <no-reply@nhealth.com.ng>`

**✔ check (after Step 9):** Admin → **Integration status** → Resend shows **OK, domain verified**. Then click **Test email** and confirm it arrives in your inbox, not spam.

---

## Step 2 — Paystack (coin top-ups, provider payouts, debt settlement) (30 min)

1. Paystack → **Settings → Business** → complete **Go Live** (business documents and settlement bank). Live keys only work after approval.
2. **Settings → API Keys & Webhooks** → **Live** tab:
   - Copy the **Live Secret Key** (`sk_live_…`) and the **Live Public Key** (`pk_live_…`).
   - **Live Webhook URL**: `API/api/webhooks/paystack`
   - **Live Callback URL**: `https://www.nhealth.com.ng/`
3. **Settings → Preferences → Transfers**:
   - Turn **ON** "Enable transfers". Payouts to providers use this.
   - Turn **OFF** "Confirm transfers before sending" (the OTP prompt). Otherwise automatic payouts stall waiting for an OTP.
4. **Transfers → Fund balance**: top up your Paystack transfer balance. Payouts are paid from this balance. Collections settle to your bank, so top it up before each payout day (or choose "settle to balance" in Settings → Payouts).
5. Railway → backend → Variables:
   - `PAYSTACK_SECRET_KEY=sk_live_…`
   - `PAYSTACK_PUBLIC_KEY=pk_live_…`

**✔ check (after Step 9):** Integration status → Paystack shows **LIVE key** and your NGN balance.

---

## Step 3 — Flutterwave (second top-up option, optional payout provider) (20 min)

The previous backend only checked Flutterwave webhooks. It never created or verified payments on the server. The new backend needs the **secret key** too.

1. Flutterwave → switch to **Live mode** (top right). Your account must be approved for live.
2. **Settings → API Keys** → copy the **Secret Key** (`FLWSECK-…`) and the **Public Key** (`FLWPUBK-…`).
3. **Settings → Webhooks**:
   - URL: `API/api/webhooks/flutterwave`
   - **Secret hash**: choose a long random string. Tick *Receive webhook response in JSON format* and the transfer events.
4. If you will pay providers through Flutterwave: **Transfers → enable** and fund your NGN balance. Also whitelist the server IP if Flutterwave asks.
5. Railway → backend → Variables:
   - `FLUTTERWAVE_SECRET_KEY=FLWSECK-…`
   - `FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-…`
   - `FLUTTERWAVE_WEBHOOK_HASH=` the same secret hash you entered in Flutterwave. Keep it if it is already set and matches.

**✔ check (after Step 9):** Integration status → Flutterwave shows **LIVE key** and no "hash missing" warning.

---

## Step 4 — PayScrow (escrow for appointments, orders and lab tests) (15 min)

PayScrow was already integrated. Confirm these values on Railway:

1. PayScrow dashboard → **API keys** → `PAYSCROW_API_KEY` (live broker key). `PAYSCROW_BASE_URL` is only needed if PayScrow gave you a non-default URL. The default is `https://api.payscrow.net`.
2. PayScrow → **Webhooks**: set the URL to `API/api/webhooks/payscrow` and copy the signing secret into `PAYSCROW_WEBHOOK_SECRET`.
   **This is now required.** In production the backend rejects unsigned PayScrow webhooks, so a missing secret means escrow payments never show as funded.

**✔ check (after Step 9):** Integration status → PayScrow shows **API reachable • N banks** with no secret warning.

---

## Step 5 — Didit (identity verification, API v3) (20 min)

The backend is set up for **Didit API v3**:
- creates sessions with `POST https://verification.didit.me/v3/session/`
- reads decisions from `GET /v3/session/{id}/decision/`
- verifies webhooks with `X-Signature-V2` (canonical JSON), falling back to `X-Signature` (raw body), and rejects deliveries older than 5 minutes

1. Didit Business Console → **Workflows** → create **KYC – Patients**: ID document + liveness + face match. Accept: Nigerian NIN slip/ID card, international passport, driver's licence, voter's card, plus foreign IDs if you serve other countries. Copy the **workflow ID**.
2. Optional: create **KYC – Providers** with the same steps plus AML screening, and copy its workflow ID.
3. **API & Webhooks**:
   - Copy the **API key**.
   - Webhook URL: `API/api/webhooks/didit`
   - Copy the **webhook secret**.
4. Railway → backend → Variables:
   - `DIDIT_API_KEY=…`
   - `DIDIT_WEBHOOK_SECRET=…`
   - `DIDIT_WORKFLOW_ID=…` (patients)
   - `DIDIT_PROVIDER_WORKFLOW_ID=…` (optional)
   - `DIDIT_BASE_URL=https://verification.didit.me`

**✔ check (after Step 9):** Integration status → Didit shows **API key accepted**. Then complete one real verification in the app: Profile → Verify identity. The admin **Identity (KYC)** page should show it as *Approved*, and "Last webhook" should update.

---

## Step 6 — Termii (SMS for OTPs, emergency alerts, reminders) (20 min + sender approval)

1. Termii → **Sender ID** → request `N-Health`. Use case: transactional OTP and alerts. Approval can take 1–3 days.
2. Top up your SMS balance.
3. Railway → backend → Variables:
   - `TERMII_API_KEY=…`
   - `TERMII_SENDER_ID=N-Health`

**✔ check:** Integration status → Termii shows a positive balance. **Test SMS** arrives on your phone.

---

## Step 7 — Cloudinary (photos, KYC documents, results, invoices) (10 min)

Without this, uploads are saved on the server disk and lost on every redeploy.

1. Cloudinary → Dashboard → copy **Cloud name**, **API key** and **API secret**.
2. Railway → backend → Variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

**✔ check:** Integration status → Cloudinary **OK**.

---

## Step 8 — Remaining backend variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://www.nhealth.com.ng` |
| `PUBLIC_URL` | `API` (the backend's own HTTPS URL) |
| `CORS_ORIGIN` | `https://admin.nhealth.com.ng` (plus any other front-end URL, comma-separated; never `*`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from Step 0 |
| `GOOGLE_CLIENT_ID` | optional; add `https://www.nhealth.com.ng` to its authorised JavaScript origins |
| `JWT_SECRET` | keep the existing value |

---

## Step 9 — Deploy

1. Merge the pull request into `main`. Railway redeploys the backend.
2. Watch the backend **Deploy Logs**:
   - `[migrate] Existing schema without history detected - baselining.` appears only on the first deploy.
   - Then `All migrations have been successfully applied.`
   - Then `N-Health API listening`.
3. **Web app service** (`apps/landing`): in Railway, set the *build* variable `VITE_API_URL=API`, then redeploy. Point `www.nhealth.com.ng` at this service.
4. **Admin console service**: set `VITE_API_URL=API/api` and redeploy. Point `admin.nhealth.com.ng` at it.
5. Create your super admin. Railway → backend → **Shell**:

   ```bash
   cd apps/backend && ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='a-long-unique-password' ADMIN_NAME='Your Name' node scripts/create-admin.cjs
   ```

**✔ check:**
- `API/health` returns `ok`.
- `API/api/config` shows `"gateways":["paystack","flutterwave"]`, `"escrow":true` and `"kyc":true`.
- Admin → **Integration status** shows every row as OK, or explains what is missing.

---

## Step 10 — Set fees and payouts (super admin)

Admin → **Fees & payouts**:

1. **Commission per service.** Suggested starting points:

   | Service | Commission |
   |---|---|
   | Doctor consultations | 15% |
   | Nurse home care | 15% |
   | Lab tests | 10% |
   | Pharmacy | 5% |
   | Ambulance | 10% |

2. **Patient booking fee:** 5%. **POS tax:** your VAT treatment (7.5% if VAT-registered, otherwise 0).
3. **Cash:** enabled, with a debt limit. For example ₦20,000: providers who owe more cannot accept cash jobs until they pay.
4. **Payouts:**
   - Weekly, Monday 10:00
   - minimum ₦1,000
   - hold 24h (the dispute window)
   - provider: **Paystack Transfers**
5. Click **Save settings**.

How it works (same model as Bolt drivers):
- **In-app payment:** the patient pays N-Health. When the job is completed, the provider's balance gets the fee minus commission. It is paid automatically on payout day, or the provider can **Cash out** once a day.
- **Cash payment:** the provider collects the money and taps **Received**. The commission (and any patient booking fee they collected) is deducted from their balance. If their balance goes negative they can **Pay balance** by card, or it is offset against future in-app jobs.
- **Escrow (PayScrow):** paid straight to the provider's bank when the patient releases it. It is recorded in their activity for reporting.

---

## Step 11 — End-to-end live test with real money (30 min)

Use your own patient account and a test provider account.

1. **Top-up:** Patient → Coins → ₦100 via Paystack, then ₦100 via Flutterwave. Coins should appear once each. Admin → Integration status → "Last webhook" updates.
2. **KYC:** complete Didit verification as the provider. Upload a licence document. Admin → **Provider verification** → Approve.
3. **Booking, in-app:** provider opens their calendar → patient books → pays with coins → provider accepts and completes. The provider's **Earnings** screen shows fee − commission as *pending*, then *available* after the hold period.
4. **Booking, cash:** book again → choose **Cash** → provider taps **Received** → completes. Commission appears as a deduction.
5. **Payout:** provider adds their bank account (the name is verified with the bank) → **Cash out**. You receive the transfer, and the payout shows **PAID** in Admin → Fees & payouts. If it shows FAILED, the reason is listed and the money returns to the balance.
6. **Escrow:** book a lab test → pay by escrow → complete the PayScrow checkout → the test shows *paid (escrow)*.
7. **Emergency:** with ≥ ₦5,000 coins, press Emergency (test with an on-duty ambulance account) → accept → en route → arrived → complete. The ambulance fee is charged and the patient sees the live map.
8. **Email and SMS:** password reset sends a code by email and SMS.

---

## Step 12 — Launch housekeeping

- **Data protection:** register with the **Nigeria Data Protection Commission (NDPC)** as a data controller. Publish the Terms and Privacy pages (they are already in the app).
- **Monitoring:** add an uptime monitor (UptimeRobot or Better Stack) on `API/health` and on the web app. Turn on Railway log alerts for `Unhandled error` and `[webhook:`.
- **Backups:** enable daily Postgres backups and keep 30 days.
- **Finance routine:** before each payout day, check that your Paystack transfer balance covers Admin → Fees & payouts → *Available* total. Check Admin → **Revenue** weekly.
- **Vercel:** the old `admin-web` project fails on every commit. Delete it, or point it at `apps/admin-web` with build command `pnpm --filter @nhealth/admin-web build` and output `apps/admin-web/dist`.
- **Mobile apps:** in `apps/mobile`, run `eas build -p android --profile production` (and `-p ios`), then submit to the stores.
