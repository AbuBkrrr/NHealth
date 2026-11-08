# N-Health — Complete Healthcare Ecosystem

N-Health connects patients with verified doctors, nurses, pharmacies, labs, ambulances and hospitals. Patients book care, buy medicines, get tested, request emergency help, donate and manage their health records. Providers run their practice, and institutions manage staff, departments and patients.

| App | Path | Stack | Purpose |
|---|---|---|---|
| **Web app (PWA)** | `apps/landing` | Vanilla JS + Vite. Uses the mockup's design system (`src/styles/mockup.css`) | The app users use, for all 7 roles. Installable, works offline (read-only), supports push. |
| **API** | `apps/backend` | Express, Prisma, PostgreSQL, Socket.io | REST + realtime API, payments, KYC, notifications, scheduler |
| **Admin console** | `apps/admin-web` | React + Vite | Provider verification, KYC, campaigns, payouts, tickets, catalogs, audit |
| **Mobile** | `apps/mobile` | Expo / React Native | Native app (EAS build profiles in `eas.json`) |
| Shared | `packages/*` | TypeScript | Types, JWT and error helpers |

The original mockup and the previous patched web app are kept in `apps/landing/legacy/`. Old status reports and one-off scripts are kept in `docs/archive/`.

## Features

**Patients**: email/Google sign-up, Didit identity verification, coins top-up (Paystack/Flutterwave), escrow checkout (PayScrow), appointments with live doctor calendars and a 5% service fee, reschedule/cancel with automatic refunds, pharmacy store (OTC and prescription-gated), lab test catalog with home collection and results/PDFs, nurse home-care requests, one-tap emergency (nearest ambulances and on-call doctors alerted, live ambulance map with ETA, SMS to the emergency contact), provider and facility directory (distance/rating/fee), reviews, chat with photos and short videos, blood/organ donation (eligibility check, requests, pledges with contact details, centres, organ donor registry and card), fundraising and patient-case campaigns with live progress, insurance plans/NHIA, health records (timeline, medication reminders, family members, vaccinations, documents), emergency medical ID QR, notifications (in-app/push/email/SMS), multi-currency/language/time zone, data export, account deletion, access log, referral rewards, health tips.

**Doctors**: requests (accept/refer/decline), confirmed and past visits, patient records (access is logged), e-prescriptions (optionally routed to a pharmacy), lab orders whose results come back to them, weekly availability and time off, referrals, emergency alerts, earnings and payout bank account.

**Pharmacies**: inventory (brand, manufacturer, batch, barcode, expiry, POM flag, reorder level), low-stock/expiry alerts, stock intake from invoices (paste lines or attach invoice), stock audits with variance, POS (barcode, tax, discount, cash/card/transfer/patient coins, receipts), incoming orders and routed prescriptions, customers.

**Labs**: test catalog and prices, test queue (sample collected, processing, result upload with flags and attachments), results returned to the patient and the ordering doctor, opening hours.

**Nurses**: availability toggle, open requests and my visits, start/complete workflow, navigation and calls.

**Ambulances**: on/off duty, live GPS sharing (only with the patient being served), open emergencies by distance, accept/en route/arrived/complete, navigation.

**Institutions**: dashboard (beds, occupancy, today's admissions/discharges), departments with bed tracking, staff enrolment by email invite (providers accept from their profile), patient registration/admission/discharge with MRN, reports, campaigns.

**Provider earnings (Bolt-style)**:
- Patients pay in-app (coins/escrow) or in cash.
- In-app: providers earn the fee minus commission when the job completes. They are paid automatically to a bank account verified with the bank (Paystack/Flutterwave Transfers), or can cash out daily.
- Cash: the commission becomes a balance debt; cash jobs are blocked above a limit, and providers can settle by card.
- Super admins set commission per service, booking fee, POS tax, cash policy and payout schedule in the admin console. Admins also see revenue, balances, payouts and live integration checks.

**Trust & safety**:
- Gateway-verified top-ups and signed webhooks (Paystack, Flutterwave, Fincra, Monnify, PayScrow, Didit).
- Server-side prices everywhere.
- Rate limiting and account lockout.
- Hashed one-time codes with attempt limits.
- Token revocation (logout-all, password reset).
- An allow-list for cross-site requests (CORS).
- Providers can act only after admin licence verification.
- Fundraising campaigns are reviewed before they go live.
- Every access to medical records is logged.
- Migration-based schema changes.

## Local development

```bash
pnpm install
```

```bash
cp apps/backend/.env.example apps/backend/.env   # set DATABASE_URL and JWT_SECRET
```

```bash
cd apps/backend && npx prisma migrate deploy && cd ../..
```

```bash
pnpm --filter @nhealth/backend dev
```

```bash
VITE_API_URL=http://localhost:4000 pnpm --filter @nhealth/landing dev
```

```bash
VITE_API_URL=http://localhost:4000/api pnpm --filter @nhealth/admin-web dev
```

Without integration keys, emails and SMS are printed to the API console, and uploads are saved to local disk.

### Tests

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/nhealth_test pnpm --filter @nhealth/backend test
```

CI (`.github/workflows/ci.yml`):
- runs migrations against PostgreSQL 16
- checks that the schema matches the migrations
- typechecks and runs the API tests
- builds all three apps

## Deployment

Step-by-step launch guide: [docs/GO_LIVE.md](docs/GO_LIVE.md). Reference runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the production checklist: environment variables, webhook URLs, DNS, first admin, and the go-live steps.
