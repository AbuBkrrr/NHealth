# N-Health Backend

Node.js + Express + TypeScript + PostgreSQL (Prisma) + Socket.io.

## Prerequisites

- Node.js 18+
- A PostgreSQL database (local install, Docker, or a hosted one like Supabase/Neon/Railway)

## Setup

```bash
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)

```bash
npm install
npx prisma migrate dev --name init   # creates all tables
npm run prisma:seed                  # optional: one demo account per role
npm run dev                          # starts on http://localhost:4000
```

No local Postgres? Easiest path is a free instance on
[Neon](https://neon.tech) or [Supabase](https://supabase.com) — create a
project, copy the connection string into `DATABASE_URL`, and run the same
commands above.

## Project layout

```
src/
  app.ts            Express app + middleware + route mounting
  server.ts         HTTP server + Socket.io bootstrap
  config/           env loader, Prisma client singleton
  controllers/       request handlers, one file per domain
  routes/            route definitions, one file per domain
  middleware/        auth (JWT) and error handling
  sockets/           Socket.io auth + room wiring
  utils/             jwt, ApiError, asyncHandler helpers
prisma/
  schema.prisma      full data model for all 6 roles
  seed.ts            demo data
```

## API overview

All endpoints are prefixed `/api`.

- `POST /auth/register` — body: `{ email, password, name, role, phone?, profile? }`
- `POST /auth/login` — body: `{ email, password }` → `{ token, user }`
- `GET /auth/me` — current user + role profile (requires `Authorization: Bearer <token>`)

Account routes (`/account/*`, any authenticated role):
`POST /avatar` — multipart upload (`avatar` field), returns `{ id, avatarUrl }`.
Stored on local disk under `backend/uploads/avatars` and served back via
`express.static`; swap the storage engine in `accountController.ts` for
S3/Cloudinary in a production deployment serving many users. `PUBLIC_URL` in
`.env` controls the base URL used to build the absolute link the mobile app
needs (defaults to `http://localhost:4000` - set it to your machine's LAN IP
when testing on a physical device).

Patient routes (`/patient/*`, requires a PATIENT token):
`GET/PATCH /profile` (now includes `genotype` and `nhisNumber`),
`GET/POST /appointments`, `POST /appointments/:id/cancel`,
`GET/POST /orders`, `GET /prescriptions`, `GET/POST /lab-tests`,
`GET/POST /emergency`, `POST /emergency/:id/cancel`, `POST /nurse-requests`, `GET/POST /donations`,
`GET/POST /insurance`.

Pharmacy routes (`/pharmacy/*`, requires a PHARMACY token):
`GET/PATCH /profile`, `GET /stats` (dashboard: pending orders, low-stock
count, total items, today's revenue), `GET/POST /inventory`,
`PATCH/DELETE /inventory/:id`, `GET/POST /suppliers`,
`PATCH/DELETE /suppliers/:id`, `GET /orders`, `GET /orders/:id`,
`POST /orders/:id/status` (body `{ status }`, one of `PROCESSING` | `READY` |
`OUT_FOR_DELIVERY` | `DELIVERED` | `CANCELLED` — enforced as a forward-only
state machine; cancelling restocks the order's items and emits
`order:updated` to the patient).

Lab routes (`/lab/*`, requires a LAB token):
`GET/PATCH /profile`, `GET /stats` (dashboard: awaiting-sample count,
in-progress count, completed count, today's revenue), `GET /tests`
(each test annotated with `isPaid`, looked up against confirmed `Payment`
rows since `LabTest` has no denormalized payment-status field),
`GET /tests/:id`, `POST /tests/:id/status` (body `{ status }`, one of
`SAMPLE_COLLECTED` | `PROCESSING` | `CANCELLED` — forward-only state machine;
`SAMPLE_COLLECTED` is rejected until payment is confirmed),
`POST /tests/:id/result` (body `{ results: [{parameter, value, unit?,
referenceRange?, flag?}], notes? }` — creates the `LabResult` and flips the
test to `COMPLETED`; emits `labresult:new` to the patient),
`GET /tests/:id/result/pdf` (downloadable result report).

Ambulance routes (`/ambulance/*`, requires an AMBULANCE token):
`GET/PATCH /profile`, `PATCH /availability` (body `{ isAvailable }`),
`POST /location` (body `{ lat, lng }` — updates the ambulance's stored
position and broadcasts `ambulance:location` to anyone tracking it),
`GET /stats`, `GET /requests/available` (unclaimed requests, any ambulance
can see these), `GET /requests/mine` (this ambulance's own requests, optional
`?status=`), `GET /requests/:id`, `POST /requests/:id/accept` (claims an
unclaimed request via a conditional update — first to claim wins; broadcasts
`emergency:claimed` to every other ambulance dashboard and
`emergency:accepted` to the patient), `POST /requests/:id/status` (body
`{ status }`, one of `EN_ROUTE` | `ARRIVED` | `COMPLETED` | `CANCELLED` —
forward-only; emits `emergency:status` to the patient). No payment gating —
emergency dispatch doesn't wait on billing.

Nurse routes (`/nurse/*`, requires a NURSE token):
`GET/PATCH /profile`, `PATCH /availability` (body `{ isAvailable }`),
`GET /stats`, `GET /requests/available` (broadcast requests plus any
targeted directly at this nurse, all still `REQUESTED`),
`GET /requests/mine` (optional `?status=`, defaults to everything except
`REQUESTED` since those live in `/available`), `GET /requests/:id`,
`POST /requests/:id/accept` (handles both a broadcast claim — atomic, first
to accept wins — and confirming a request already targeted at this nurse),
`POST /requests/:id/status` (body `{ status }`, one of `IN_PROGRESS` |
`COMPLETED` | `CANCELLED` — forward-only; `IN_PROGRESS` is rejected until
payment is confirmed). Emits `nurse:accepted` / `nurse:status` to the
patient and `nurse:claimed` to every other nurse dashboard once a broadcast
request is taken.

Provider directory (`/providers/*`, any authenticated role):
`GET /doctors`, `GET /pharmacies`, `GET /pharmacies/:id/inventory`, `GET /labs`,
`GET /ambulances`, `GET /nurses`. `GET /doctors`, `/pharmacies`, `/labs`, and
`/ambulances` all accept optional `?lat=&lng=` query params - when given,
results come back sorted nearest-first with a `distanceKm` field (via
`utils/geo.ts`, haversine distance); entries with no location on file sort to
the end rather than being dropped. Doctor/Pharmacy/Lab set their location
through their own `PATCH /profile` (`{ lat, lng }`) or at registration;
ambulances use their existing live `currentLat/currentLng`.

Messaging (`/messages/*`, any role): `GET /conversations`,
`GET /conversations/:partnerId`, `POST /` (send).

Payments (`/payments/*`, any role) - shared across every payable module
(appointments, pharmacy orders, lab tests, nurse visits, donations, insurance
premiums):
- `POST /` - body `{ payableType, payableId, method }`. `method` is one of
  `USSD` | `TRANSFER` | `CARD` | `WALLET`. `WALLET` is rejected (403) until
  licensing is secured. The amount is always looked up server-side from the
  underlying record - the client never gets to say how much something costs.
  Returns a `Payment` with a 5-minute `expiresAt` window and method-specific
  display instructions (a USSD code, or demo bank transfer details).
  Donations and insurance premiums have no in-app counterparty to confirm
  receipt, so those auto-confirm immediately instead of waiting.
- `GET /:id` - fetch one payment (payer or provider only). Automatically
  flips an overdue `PENDING` payment to `EXPIRED` on read.
- `GET /mine` - the current user's own payment history.
- `GET /incoming` - a provider's queue of payments awaiting their
  confirmation (e.g. a doctor's pending consultation fees).
- `POST /:id/confirm` - the provider (whoever owns the paid-for record)
  confirms receipt. Only the resolved provider for that record can call
  this. Confirming a `PHARMACY_ORDER` payment also bumps the order to
  `PROCESSING`.
- `POST /:id/cancel` - the payer can cancel their own still-pending payment.
- `GET /:id/receipt.pdf` - downloads a PDF receipt (payer or provider only,
  and only once the payment is `CONFIRMED`).

Downloadable documents (PDF, via `pdf-lib`):
- `GET /payments/:id/receipt.pdf` - payment receipt (above)
- `GET /patient/orders/:id/invoice.pdf` - pharmacy order invoice
- `GET /patient/prescriptions/:id/pdf` - prescription (patient's own copy)
- `GET /doctor/prescriptions/:id/pdf` - prescription (the issuing doctor's copy)

## Real-time events (Socket.io)

Connect with `auth: { token: <jwt> }`. Every socket joins `user:<id>` and
`role:<ROLE>` rooms automatically.

- `message:new` — pushed to the recipient when someone sends them a message
- `emergency:new` — pushed to all `role:AMBULANCE` sockets on a new emergency request
- `nurse:new` — pushed to all `role:NURSE` sockets on a new visit request
- `ambulance:location` — an ambulance emits `{ lat, lng }`; broadcast to others tracking it
- `payment:new` — pushed to the provider when a patient starts a payment they need to confirm
- `payment:confirmed` — pushed to the payer once the provider confirms receipt
- `appointment:updated` — pushed to the patient when a doctor accepts/declines/completes their appointment
- `prescription:new` — pushed to the patient when a doctor issues them a prescription
- `order:updated` — pushed to the patient when a pharmacy moves their order forward or cancels it
- `labtest:updated` — pushed to the patient when a lab moves their test forward or cancels it
- `labresult:new` — pushed to the patient when a lab uploads a result
- `emergency:new` — broadcast to every ambulance dashboard when a patient requests one
- `emergency:accepted` / `emergency:status` — pushed to the patient as an ambulance accepts/progresses their call
- `emergency:claimed` — broadcast to every other ambulance dashboard once a call is accepted, so it drops off their available queue
- `ambulance:location` — broadcast whenever an en-route ambulance pings its position
- `nurse:new` — sent to a specific nurse (targeted request) or broadcast to `role:NURSE` (untargeted) when a patient requests one
- `nurse:accepted` / `nurse:status` — pushed to the patient as a nurse accepts/progresses their visit
- `nurse:claimed` — broadcast to every other nurse dashboard once a broadcast request is accepted

## All field roles are now built

Patient, Doctor, Pharmacy, Lab, Ambulance, and Nurse all have complete
backend + mobile implementations, alongside the Admin back office. The
`controllers/` and `routes/` directories are a good reference set if you're
extending any of them further — `pharmacyController.ts` and
`labController.ts` for provider-picked-upfront flows (patient chooses from a
directory), `ambulanceController.ts` and `nurseController.ts` for
claim-based/broadcast flows (patient doesn't choose upfront, or can
optionally target someone).
