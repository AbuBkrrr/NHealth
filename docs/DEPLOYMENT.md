# Production deployment runbook

## 1. Services

| Service | Build | Start | Health |
|---|---|---|---|
| API (`apps/backend`) | `pnpm install --frozen-lockfile && pnpm --filter @nhealth/backend build` | `pnpm --filter @nhealth/backend start` (runs `scripts/migrate.cjs`, then the server) | `/health` |
| Web app (`apps/landing`) | `pnpm --filter @nhealth/landing build` with `VITE_API_URL` set at build time | Static `dist/` (or `pnpm --filter @nhealth/landing start`) | `/health` |
| Admin console (`apps/admin-web`) | `pnpm --filter @nhealth/admin-web build` with `VITE_API_URL=<api>/api` | Static `dist/` | — |

Configs are ready for:
- Railway: `apps/*/railway.toml`
- Render: `render.yaml` (API + web + admin + Postgres)
- Docker: `apps/backend/Dockerfile`
- Vercel: `vercel.json` (admin console)

Use a paid PostgreSQL plan with daily backups and point-in-time recovery.

### Database migrations
`scripts/migrate.cjs` runs `prisma migrate deploy`.

If the production database was created earlier with `prisma db push`, Prisma has no migration history and reports error P3005. In that case the script:
1. marks the historical migrations, up to `20261101000000_reconcile_schema_drift`, as already applied (baselining);
2. applies the new feature migration.

If migrations fail, the process exits, so the platform keeps the previous healthy release.

**Take a database backup before the first deploy of this release.**

## 2. Environment variables (API)

See `apps/backend/.env.example` for the full list.

**Required:**
- `DATABASE_URL`
- `JWT_SECRET` (48+ random bytes)
- `NODE_ENV=production`
- `APP_URL` (web app URL)
- `PUBLIC_URL` (API URL)
- `CORS_ORIGIN`: comma-separated extra web origins, e.g. the admin console URL. The nhealth.com.ng domains are built in. Never use `*` in production.

**Integrations** (each feature switches on when its keys are present):

| Feature | Variables | Provider dashboard steps |
|---|---|---|
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Verify the `nhealth.com.ng` domain in Resend (SPF/DKIM DNS records) |
| SMS / OTP | `TERMII_API_KEY`, `TERMII_SENDER_ID` | Register the "N-Health" sender ID with Termii (DND route for OTPs) |
| Files | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | KYC, medical and invoice files are uploaded as *authenticated* (private) assets |
| Paystack | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Webhook URL: `https://<api>/api/webhooks/paystack` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Webhook URL: `https://<api>/api/webhooks/flutterwave`. Set the same secret hash in the dashboard |
| Escrow | `PAYSCROW_API_KEY`, `PAYSCROW_BASE_URL`, `PAYSCROW_WEBHOOK_SECRET` | Webhook URL: `https://<api>/api/webhooks/payscrow` |
| Identity (KYC) | `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_WORKFLOW_ID`, optional `DIDIT_PROVIDER_WORKFLOW_ID` | See below |
| Web push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Generate with `npx web-push generate-vapid-keys` |
| Google sign-in | `GOOGLE_CLIENT_ID` | Add the web app origin to the authorised JavaScript origins |

Optional gateways Fincra and Monnify stay off unless their keys are set.

### Didit setup

In the Didit Business Console:
1. Create a KYC workflow (ID document + liveness + face match) and copy its ID into `DIDIT_WORKFLOW_ID`.
2. Optionally create a stricter workflow for providers (adds AML screening) and copy its ID into `DIDIT_PROVIDER_WORKFLOW_ID`.
3. Set the webhook URL to `https://<api>/api/webhooks/didit` and copy the webhook secret into `DIDIT_WEBHOOK_SECRET`.

How verification works:
- **Verifying a webhook:** the API accepts either `X-Signature` (HMAC-SHA256 of the raw body) or `X-Signature-V2` (HMAC-SHA256 of the JSON with keys sorted). It rejects webhooks whose `X-Timestamp` is more than 5 minutes old.
- **Webhook is missed:** users can tap "Check status", which polls `GET /v2/session/{id}/decision/`.
- **Data stored:** only the document type, issuing country, last 4 digits, the name on the ID and the decision. Document images stay with Didit.

The integration uses **Didit API v3**: `POST /v3/session/` to create a session and `GET /v3/session/{id}/decision/` to read the decision. Step-by-step setup is in [GO_LIVE.md](GO_LIVE.md).

### Business rules (optional)

| Variable | Default |
|---|---|
| `SERVICE_FEE_PERCENT` | 5 (initial value; super admins change fees in Admin → Fees & payouts) |
| `POS_TAX_PERCENT` | 5 |
| `EMERGENCY_MIN_BALANCE` | 5000 |
| `REFERRAL_REWARD` | 500 |
| `REQUIRE_PROVIDER_VERIFICATION` | on in production |
| `SCHEDULER_DISABLED=1` | set on all but one API replica |

## 3. Go-live checklist

1. Back up the database, then deploy the API and watch the migration output in the logs.
2. `GET /health` returns `ok`. `GET /api/config` shows the expected gateways, `kyc: true` and a VAPID key.
3. Create the first super admin. Run this from the API container, with your own email and a strong password:

   ```bash
   cd apps/backend && ADMIN_EMAIL=you@org.com ADMIN_PASSWORD='a-long-strong-password' node scripts/create-admin.cjs
   ```

   **Never run `prisma/seed.ts` in production.** It creates demo accounts with a shared password.
4. Build the web app with `VITE_API_URL=https://<api>` and the admin console with `VITE_API_URL=https://<api>/api`. Point `www.nhealth.com.ng` at the web app and `admin.nhealth.com.ng` at the console. Both must use HTTPS: required for geolocation, push and service workers.
5. Make a ₦100 top-up through each gateway and confirm that coins arrive once (webhook + confirm are idempotent).
6. Complete one Didit verification end-to-end.
7. In the admin console, review catalogs (insurance plans, donation centres, articles; they are seeded on first boot) and set display exchange rates.
8. Verify the first providers: Admin → Provider verification. Check their licences against the issuing council registers.
9. Set up monitoring:
   - uptime checks on `/health`
   - log alerts for `[webhook:` and `Unhandled error`
   - optional Sentry DSN
10. Publish the Terms and Privacy Policy (shown in the app). Register with NDPC as a data controller.

## 4. Coins: the regulatory model

Coins are a **closed-loop prepaid credit**:
- spent only on healthcare services inside N-Health
- not transferable between users
- not withdrawable as cash

Card, transfer and USSD collection is done by licensed processors (Paystack, Flutterwave). Provider settlement is done through PayScrow escrow, or by bank payouts from the platform account. The weekly payouts list is in Admin → Payouts. This keeps N-Health outside e-money or wallet licensing. Keep this wording in all marketing.
