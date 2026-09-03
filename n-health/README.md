# N-Health — Complete Healthcare Ecosystem

A cross-platform (iOS + Android) healthcare app with six field roles: **Patient,
Doctor, Pharmacy, Lab, Ambulance, Nurse** — plus an **Admin** back office. Rebuilt
from the original HTML mockup into a real, runnable app with a live backend.

## Repo structure

This is a monorepo with three independent projects. Each has its own
`package.json`, `.env.example`, and README - open the one you're working on.

```
n-health/
├── backend/      Node/Express/TypeScript/Prisma/PostgreSQL API + Socket.io
├── admin-web/    React/Vite admin dashboard (deploys as a static site)
├── mobile/       React Native/Expo app - all 6 field-role apps + Patient
├── render.yaml   Render Blueprint (backend + admin-web + Postgres, one click)
└── .gitignore
```

`mobile/` is not deployed to Railway/Render - Expo apps run on a phone/emulator
via `npx expo start`, or are built into installable binaries via EAS. See
"Deploying" below for the full picture and copy-paste commands.

## Deploying

**One-time setup:**
1. Push this folder to a new GitHub repo (commands below).
2. Deploy `backend/` first (Railway or Render) - it needs a Postgres database.
3. Deploy `admin-web/` second, pointing its `VITE_API_URL` at the backend's URL.
4. Point the `mobile/` app's `EXPO_PUBLIC_API_URL` at the backend's URL.

**Testing locally with Docker instead?** Skip straight to `docker compose up
--build` from the repo root - it runs Postgres + the backend together with
no native Postgres install needed. See `docker-compose.yml`'s header comment
for the full command reference (seeding, logs, tearing down). Once it's up,
`admin-web` and `mobile` still run the normal way (steps 2-3 below, or the
localhost setup guide) pointed at `http://localhost:4000`.

### 1. Push to GitHub

```bash
cd n-health
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Backend - Render (recommended: one-click via Blueprint)

Render reads the `render.yaml` at the repo root and provisions the backend web
service, a Postgres database, and the admin-web static site together.

1. On [render.com](https://render.com) → **New** → **Blueprint** → connect your
   GitHub repo → Render detects `render.yaml` automatically → **Apply**.
2. Render provisions everything and wires `DATABASE_URL` automatically. It
   also auto-generates `JWT_SECRET`.
3. Once the backend is live, copy its URL (e.g. `https://n-health-backend.onrender.com`)
   and paste it into that service's `PUBLIC_URL` env var (Render dashboard →
   n-health-backend → Environment), then **Manual Deploy → Deploy latest commit**
   so avatar upload URLs resolve correctly.
4. Open a shell for the backend service (Render dashboard → Shell tab) and run:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed
   ```
   (Migrations also run automatically on every deploy via the `start` script,
   but running it once manually right after the first deploy lets you catch
   any issue immediately instead of via a crashed deploy.)

### 2. Backend - Railway (alternative)

1. On [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
   → select this repo.
2. Railway will ask which directory to deploy - set **Root Directory** to `backend`.
   It reads `backend/railway.json` automatically for build/start commands.
3. **New** → **Database** → **Add PostgreSQL** in the same project. Railway
   auto-injects `DATABASE_URL` into every service in the project.
4. On the backend service → **Variables**, add:
   ```
   JWT_SECRET=<any long random string>
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=*
   NODE_ENV=production
   ```
5. Deploy, then copy the backend's public URL (Settings → Networking → Generate
   Domain) into a `PUBLIC_URL` variable, and redeploy.
6. Open a shell (⋮ menu → Shell) and run:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed
   ```

### 3. Admin-web

**On Render:** already deployed by the same Blueprint as step 2. Once the
backend has a URL, set the admin-web service's `VITE_API_URL` env var to
`https://<your-backend-url>/api` and redeploy (Render dashboard →
n-health-admin-web → Environment → edit → Manual Deploy).

**On Railway:** New service in the same project → Deploy from the same
GitHub repo → set **Root Directory** to `admin-web` → it reads
`admin-web/railway.json` automatically. Add a `VITE_API_URL` variable set to
`https://<your-backend-url>/api`, then generate a public domain for this
service too.

Either way, once deployed, log in with a seeded account, e.g.
`superadmin@demo.com` / `password123`.

### 4. Mobile app

The mobile app isn't hosted on Railway/Render - it runs on a device. Point it
at your deployed backend, then either run it in Expo Go or build it properly:

```bash
cd mobile
npm install
echo "EXPO_PUBLIC_API_URL=https://<your-backend-url>/api" > .env
npx expo start          # scan the QR code with Expo Go to test on your phone
```

To produce an actual installable app later (not required just to test):
```bash
npm install -g eas-cli
eas build --platform android   # or ios
```

### After deploying: demo logins

Every seeded account uses the password `password123`:
`patient@demo.com`, `doctor@demo.com`, `pharmacy@demo.com`, `lab@demo.com`,
`ambulance@demo.com`, `nurse@demo.com`, `superadmin@demo.com`.

## What's in this delivery (Phase 16) — real TypeScript build errors, from a real build

Running `docker compose up --build` on a real machine surfaced 4 genuine
TypeScript compile errors that no phase before this one could ever have
caught: the sandbox this project was built in never had a fully-generated
Prisma client (a one-time binary download it couldn't reach), so every
`Decimal`- and `Json`-typed field was invisible to its type checker the
entire time - not just harder to check, *literally never type-checked at
all*. The "backend typecheck holds at its baseline" claims throughout every
earlier phase were true for what they checked, but that baseline was an
undercount - this whole category of error couldn't have shown up in it
either way.

Fixed, based on the actual compiler output rather than a guess:
- `doctorController.ts` and `patientController.ts` both cast a Prisma `Json`
  field directly to `Medication[]` in one step (`as Medication[]`), which
  Prisma's real generated types correctly reject as an unsafe narrowing.
  Fixed with the standard `as unknown as Medication[]` pattern - safe here
  since the shape is validated on the way in by `createPrescription`'s own
  schema, TypeScript just can't see that from the stored `JsonValue` type
  alone.
- `patientController.ts` and `paymentController.ts` both passed a Prisma
  `Decimal` value (`order.total`, `payment.amount`) directly into
  `formatNaira(amount: number | string)`. Fixed by wrapping in `Number(...)`
  at the call site - every other place in the codebase already did this
  correctly (`nurseController.ts`, and three other spots in
  `paymentController.ts` itself), confirmed by grepping for every other use
  of these Decimal fields and every other `formatNaira` call site - these
  were the only two places missing it.

Worth being direct about the limit here: these fixes are correct by sound
TypeScript reasoning (each pattern is unambiguous - `Number(x)` always
returns `number`, `as unknown as T` always bypasses an overlap check) and
by checking every other place the same pattern appears in the codebase for
consistency, but they could not be verified by actually running `tsc`
against a complete Prisma client here, for the same reason they weren't
caught in the first place. If your rebuild still shows an error in one of
these four spots, that's a real signal worth reporting back.

## What's in Phase 15 — critical fix: real migration files + Docker

**This is the most significant fix in this project's history, and it's worth
reading in full even if you skip the rest of this changelog.**

Investigating a Docker setup surfaced a gap that had been invisible through
every previous phase: **this project had no `prisma/migrations/` folder at
all**, anywhere, until this phase. `npx prisma migrate deploy` - the command
in every "run it locally" instruction given throughout this whole project
(the localhost setup guide, the PowerShell guide, `render.yaml`,
`backend/railway.json`, and the new Dockerfile below) - applies migrations
that already exist; if none exist, it succeeds and does *nothing*. On a
genuinely fresh database, every one of those setup paths would have failed
the moment `npm run prisma:seed` tried to insert into tables that were never
created. This had never been caught because no phase before this one
actually ran the app against a real, empty, from-scratch database.

It's fixed now: `prisma/migrations/20260101000000_init/migration.sql` is a
complete, hand-written initial migration (all 21 tables, 11 enums, 10 unique
constraints, 17 lookup indexes, 31 foreign keys - one for every relation in
`schema.prisma`, with cascade/restrict/set-null behavior matching each
relation's declared intent). It was hand-written rather than tool-generated
because the tool that normally does this needs a one-time binary download
that the sandbox building this project couldn't reach - and then it was
**empirically verified**, not just reviewed: applied to a real, fresh
PostgreSQL 16 database, checked against `schema.prisma` (table count, enum
count, foreign-key count all match exactly), and proven against realistic
inserts spanning every relationship in the schema, plus explicit tests
confirming both `ON DELETE CASCADE` (deleting a user removes their role
profile) and `ON DELETE RESTRICT` (deleting a user with existing payments is
correctly blocked) behave exactly as `schema.prisma` declares. Every
existing setup path now actually works on a fresh database, verified rather
than assumed.

**Also added: Docker support.** `backend/Dockerfile` (multi-stage build) and
a root `docker-compose.yml` that runs Postgres + the backend + Adminer (a
browser-based DB viewer) with one command - `docker compose up --build` -
replacing the need to install Postgres natively at all. One real bug was
caught and fixed before it shipped: the first draft of the Dockerfile's
runtime stage used `npm install --omit=dev`, which would have broken the
container immediately, since `prisma migrate deploy` (part of the app's own
`start` script) needs the `prisma` CLI, and that CLI is a devDependency -
only the runtime client library is a regular one. Fixed by reusing the full
`node_modules` from the build stage instead of reinstalling.

See `docker-compose.yml`'s header comment for usage, or the root README's
"Deploying" section.

## What's in Phase 14 — 100-user load test script

A real, runnable simulation - not a narrative - now lives in `load-test/`.
`node simulate.js` registers 100 users across all six roles against a real
running backend (local or deployed) and drives them concurrently through
the app's core features, finishing with a dedicated stress test of the
three atomic-guard race conditions this codebase depends on (ambulance
claim, nurse claim, pharmacy stock decrement) - each with several accounts
racing for the same single resource at the same instant, verifying exactly
one wins.

Worth being upfront about how this was built: a live instance of this app
couldn't be run inside the sandboxed environment that built it (no database
was available there, and separately, this project's Prisma version needs a
one-time binary download that environment's network policy blocks - neither
constraint applies to a normal machine or CI runner). Real effort went into
finding a workaround before concluding it wasn't feasible there: PostgreSQL
was actually installed and run successfully, several Prisma workarounds were
investigated in an isolated scratch copy (a documented mirror-URL override
with no known mirror to use, and Prisma's newer engine-free "driver
adapters" mode, which the pinned version doesn't fully support at
generate-time - only an unstable, not-yet-released major version does). None
of that touched the delivered project. The script itself was still verified
by running it end-to-end against a purpose-built mock server that mirrors
every endpoint's response shape, confirming its own logic - registration,
all seven phases, and all three race tests correctly detecting a single
winner - runs without error. See `load-test/README.md` for usage and what
that verification does and doesn't cover.

## What's in Phase 13 — Ambulance walkthrough + admin verification

Closing out the one area flagged as a lighter pass last round (Ambulance),
plus verifying the remaining admin-web pages.

**Real gap found and fixed:** when a patient cancels an emergency request
the ambulance had *already accepted*, the ambulance app was silently
refreshing its list with no notification at all - a driver already en route
would only notice the call was gone if they happened to check. Added an
explicit "Request cancelled" alert.

**A bug I caught in my own fix before it shipped:** the first version of
that alert read the ambulance's current request list directly inside the
socket handler - but `useSocket` only re-subscribes its listeners when the
auth token changes, not on every render, so that handler would have
permanently captured an empty list from the very first render and the alert
would never actually have fired. Caught this by tracing exactly when
`useSocket`'s effect re-runs, not just reading the code at face value, and
fixed it with a ref that always holds the latest value. Also swept every
other `useSocket` call site across the app for the same risk: all but one
just call a stable, dependency-free function (safe by construction); the
one exception (`ChatScreen`) reads a value via closure the same way, but is
only ever reached through a path that always produces a fresh instance, so
it's a latent-but-currently-unreachable pattern, not a live bug - noted for
future maintainers rather than fixed defensively.

**Verified clean, with specifics:** the Ambulance API contract end-to-end
(no unintended default filters, no orphaned params); admin self-protection
against suspending/demoting/deleting your own account, enforced at *both*
the UI layer and the API layer independently (not just hidden buttons);
every admin route correctly gated behind `requireSuperAdmin` at the route
level, not just inside the handler.

## What's in Phase 12 — provider-side walkthrough

Continuing Phase 11's walkthrough into the five provider-role apps
(Doctor, Pharmacy, Lab, Ambulance, Nurse), tracing exact request/response
contracts rather than just re-reading code.

**Real gap found and fixed:** the Nurse role has a genuinely hybrid
targeted-or-broadcast request system on the backend (a patient can either
pick a specific nurse, or leave it unassigned so any available nurse can
claim it) - but the patient mobile app only ever exercised the *targeted*
half of it. There was no way to actually trigger a broadcast request; the
"request any available nurse" path existed end-to-end on the backend with
nothing on the patient side ever calling it. Added a "🩺 Request Any
Available Nurse" button to the Nurses tab alongside the existing
browse-and-pick list.

**Gap found and fixed (smaller, UX):** lab test requests use a flat ₦5,000
fee regardless of test type (a schema default, not a bug - it doesn't break
payment), but the patient never saw *any* price until reaching the payment
screen. Added a visible fee note to the test-request form so it's not a
surprise. Differentiated per-test-type pricing would be the natural next
step if this needs to reflect real-world lab costs.

**Verified clean, with specifics:** Doctor's full appointment/patient/
prescription flow including the `assertDoctorTreatsPatient` access guard
(used consistently for both viewing records and prescribing); Pharmacy's
order-creation transaction (atomic, race-safe stock decrement, symmetric
restock on cancel); the exact request/response shape for every Doctor,
Pharmacy, and Lab endpoint against its mobile consumer.

## What's in Phase 11 — signup-to-every-feature walkthrough

Phase 11 traced every screen's actual request/response contract against its
backend endpoint, end to end, as if walking through the app as a brand-new
user from signup through every role's every feature - not just re-reading
code, but cross-checking exact field names and route paths on both sides.

**Real bug found and fixed:** the global error handler had no handling at
all for Prisma unique-constraint violations (`P2002`). Concretely: two
people registering with the same phone number would hit a raw database
error and see a bland "Internal server error" instead of a clear message.
Fixed at the source (not just for phone - for any unique-constraint
collision anywhere in the app going forward).

**Checked and confirmed correct** (a few looked suspicious at first glance
and turned out fine on closer inspection - noted here so the reasoning is
on record, not just the conclusion):
- The Patient Home screen's "Quick Action" buttons (Lab Test, Nurse Visit,
  Insurance, Donate) navigate to route names that aren't top-level tabs -
  this looked broken at first, but they're registered as sibling screens
  inside the same stack as Home, which React Navigation resolves directly;
  confirmed working as designed.
- Donations auto-confirm and flip the donation's own status to `COMPLETED`
  on payment; Insurance policies don't get a matching update - this looked
  like a missed case, but a policy's `status` field tracks validity
  (active/expired), not payment status, so no update was needed there.
- The full payment contract (create/get/confirm/cancel/receipt PDF) between
  `PaymentModal` and `paymentController` - every method, every field name.
- The entire admin-web ↔ `adminController` contract (stats, user list +
  pagination, admin management, audit log) - every route and response shape.
- Messaging end to end (conversation list, thread, send, live socket delivery).

## What's in Phase 10 — hard-test checkup + deploy-ready

Phase 10 is a full audit pass across all three projects (not a new feature),
plus getting the repo genuinely one-click deployable:

**Real bugs found and fixed** (confirmed independent of any sandbox
limitation - each was reproduced, root-caused, and verified fixed):
- `utils/jwt.ts` - a newer `@types/jsonwebtoken` narrows `expiresIn` to a
  branded string type that a plain `string` no longer satisfies; would have
  broken `npm run build` for anyone on a recent install.
- `admin-web` was missing `src/vite-env.d.ts` entirely, so `import.meta.env`
  didn't typecheck and `npm run build` failed outright - **admin-web now
  builds clean end-to-end.**
- A recurring TypeScript structural-typing gap in the mobile app (named
  interfaces need an explicit index signature to satisfy
  `Record<string, unknown>`) - fixed at all 4 call sites. **Mobile now
  typechecks with zero errors.**
- `ambulance:location` was being broadcast to *every* connected socket
  instead of just the patient actively tracking that ambulance - a real
  privacy/efficiency leak, now scoped correctly.

**Gaps found against the original mockup/spec and closed:**
- `prescription:new`, `labresult:new`, and `appointment:updated` were emitted
  by the backend but never listened to anywhere on the patient side - those
  screens only updated on manual refresh, not live. Fixed.
- The mockup has a `cancelEmergency()` function with no backend counterpart
  at all - a patient could request an ambulance but never cancel. Built the
  full path: `POST /patient/emergency/:id/cancel`, ambulance-side
  notification, and a Cancel button on the patient screen.
- The mockup's registration form has a **Phone** field; the backend
  supported it; the mobile registration screen never collected it - and
  there was no way to ever set/edit a phone number for *any* role after
  signup, despite phone being displayed throughout (ambulance, nurse, lab,
  pharmacy all show `patient.user.phone`). Added the field to registration
  and built a new shared `PATCH /account` endpoint plus an "Account info"
  edit card on the Profile screen for every role.
- A live "ambulance is X km away" readout was added to the patient's
  Emergency screen, using the now-correctly-scoped location broadcast.

**Verified clean, no issues found:** every route file is mounted, every
exported controller function is wired to a route (zero dead backend code),
no orphaned mobile screens/components, and the six-role Pharmacy cart/quantity
flow already matches the mockup's intent (different UI mechanics, same
function).

**Repo made deploy-ready:** added a root `.gitignore`, `render.yaml`
(one-click Render Blueprint for backend + Postgres + admin-web together),
`railway.json` in both `backend/` and `admin-web/` for Railway, a
`postinstall` hook so `prisma generate` always runs automatically on any
platform's build, and `mobile/.env.example`. See "Deploying" above for
copy-paste instructions.

## What's in Phase 9 — GPS-proximity provider search

Phase 9 closes the last of the three spec gaps from the original audit:

- **Backend**: `lat`/`lng` added to `DoctorProfile`, `PharmacyProfile`, and
  `LabProfile`, settable at registration or via each role's own profile-edit
  endpoint. A new `utils/geo.ts` (haversine distance) powers optional
  `?lat=&lng=` query params on every `/providers/*` directory endpoint -
  results come back sorted nearest-first with a `distanceKm` field, and
  providers without a location on file simply sort to the end rather than
  being excluded. Ambulances (which already track live position for
  dispatch) get the same treatment via their `currentLat/currentLng`.
- **Mobile - patient side**: a new `useUserLocation` hook silently requests
  the device's GPS once and feeds it into the Doctors, Pharmacy, and Labs
  directory screens, which now show a "📍 X km away" distance on each result
  (Labs' compact chip-picker UI gets the proximity *sorting* benefit without
  a distance label, since there's no room to print one there).
- **Mobile - provider side**: a new `LocationCaptureButton` component - "📍
  Set/Update location from GPS" - added to the Doctor, Pharmacy, and Lab
  profile-edit cards, so a provider can set their own fixed location from
  their device in one tap.
- Seed data now gives the demo doctor, pharmacy, and lab real Lagos-area
  coordinates, so proximity sorting has something to demonstrate immediately.

**All three spec gaps from the original audit are now closed except e-wallet
top-up, which is blocked on a payment-gateway license rather than code.**

## What's in Phase 8 — NHIS/genotype/photo upload

Phase 8 closed two of the gaps flagged against the original 2019 design doc:

- **NHIS number + genotype**: added to `PatientProfile` (schema, registration,
  and the profile-edit endpoint), and surfaced on both the Patient
  registration screen and the "Medical details" card on Profile.
- **Profile photo upload**: previously `avatarUrl` existed on the `User`
  table but nothing ever wrote to it. Added a new `/api/account/avatar`
  endpoint (works for every role, since the field is shared) backed by local
  disk storage — swappable for S3/Cloudinary later without changing the
  shape of anything downstream — plus a tappable `AvatarPicker` component on
  the mobile Profile screen that uploads immediately on selection.

Still open from that same gap list: GPS-proximity "nearest provider" search
(the Providers/Doctors directory doesn't sort by distance yet, though
Emergency requests already capture live GPS), and e-wallet top-up (blocked on
a payment-gateway license, not code).

## What's in Phase 7 — all six field roles complete

Phase 7 added the **Nurse app**, the last of the four field roles from the
original roadmap:
- Backend: `nurseController`/`nurseRoutes` — profile (specialty, hourly rate),
  an availability toggle, dashboard stats, and a **hybrid** request model: a
  patient can either target a specific nurse directly or leave a request
  unassigned to broadcast to every nurse (mirroring what the Patient app's
  `requestNurse` endpoint already supported, but which had no provider-side
  counterpart until now). `POST /requests/:id/accept` handles both cases —
  confirming a targeted request or atomically claiming a broadcast one — then
  it's the same forward-only shape as the other provider roles:
  `ACCEPTED → IN_PROGRESS → COMPLETED` (or `CANCELLED`), with `IN_PROGRESS`
  gated on the patient's payment being confirmed.
- Mobile: a Nurse tab bar — Home (availability switch + dashboard stats),
  Requests (Available queue + in-progress visit workflow), and Payments.
  Nurse users get an editable "Nurse details" (specialty, hourly rate) card
  on Profile.
- **This completes every field role.** Patient, Doctor, Pharmacy, Lab,
  Ambulance, and Nurse are now all built end-to-end against the real backend,
  alongside the Admin back office.

## What's in Phase 6

Phase 6 added the **Ambulance app** end-to-end:
- Backend: `ambulanceController`/`ambulanceRoutes` — profile, an on/off-duty
  availability toggle, a live-location ping endpoint, dashboard stats, and a
  claim-based dispatch model: emergency requests start unassigned
  (`ambulanceId: null`) and broadcast to every connected ambulance dashboard
  over `role:AMBULANCE`; the first ambulance to accept claims it via a
  conditional update so two ambulances can't grab the same call. From there
  it's a forward-only workflow: `ACCEPTED → EN_ROUTE → ARRIVED → COMPLETED`
  (or `CANCELLED`). Unlike Pharmacy/Lab, there's no payment gating — emergency
  dispatch isn't held up by billing.
- Mobile: an Ambulance tab bar — Home (on/off-duty switch + dashboard stats),
  Requests (an Available queue to accept calls, plus "My active calls" with
  the accept → en route → arrived → complete workflow). While a call is
  `EN_ROUTE` or `ARRIVED`, the app pings the device's live GPS location to the
  server every 15s, which the existing `ambulance:location` socket event
  already broadcasts out to the patient. Ambulance users get an editable
  "Vehicle details" card on Profile.
- Wired into the patient app's existing `EmergencyScreen`, which was already
  listening for `emergency:accepted` / `emergency:status` events that
  previously had nothing on the other end emitting them.

## What's in Phase 5

Phase 5 added the **Lab app** end-to-end:
- Backend: `labController`/`labRoutes` — profile, dashboard stats, a test
  workflow (`REQUESTED → SAMPLE_COLLECTED → PROCESSING → COMPLETED`, or
  `CANCELLED`), a structured result-upload endpoint (parameter/value/unit/
  reference-range rows, stored as JSON), and a downloadable result PDF.
  Sample collection is gated on the patient's payment being confirmed —
  looked up directly against the shared `Payment` table since `LabTest`
  doesn't denormalize a payment-status field the way `PharmacyOrder` does.
- Mobile: a Lab tab bar — Home (dashboard with awaiting/in-progress counts and
  today's revenue), Tests (workflow + a result-entry form with add-a-row
  support), and Payments (confirms patient payments, same shared system every
  other provider role uses). Lab users get an editable "Lab details" card on
  Profile.
- Patients' existing lab-test-request flow now has a real lab on the other
  end that can move it through to a result.

## What's in Phase 4

Phase 4 added the **Pharmacy app** end-to-end:
- Backend: `pharmacyController`/`pharmacyRoutes` — profile, dashboard stats,
  inventory CRUD, supplier CRUD, and an order-fulfillment endpoint that walks
  each order through `PENDING → PROCESSING → READY → OUT_FOR_DELIVERY →
  DELIVERED` (or `CANCELLED`, which automatically restocks the items).
- Mobile: a full Pharmacy tab bar — Home (dashboard with low-stock alerts and
  today's revenue), Orders (fulfillment queue, gated on payment confirmation),
  Inventory (add/edit/remove products, assign a supplier), Suppliers, and
  Payments (confirm patient payments — reuses the same shared payment system
  Doctor already uses). Pharmacy users also get an editable "Pharmacy details"
  card on their Profile tab.
- Patients' existing pharmacy ordering flow (browse → cart → pay) now has a
  real pharmacy on the other end fulfilling those orders.

Pharmacy was picked first because it's next in the Phase 3 roadmap and it's
the piece that closes the loop on the Patient app's existing pharmacy-ordering
flow, which previously had no one to fulfill the order.

## What was in Phase 3

- **`backend/`** — Node.js + Express + TypeScript API, PostgreSQL via Prisma, JWT
  auth, Socket.io for real-time messaging/emergency alerts/payments. The database
  schema models **all six field roles plus Admin** already, so later phases plug
  straight in.
- **`admin-web/`** — a real React + Vite + TypeScript **web app**: login, dashboard
  (live stats), user management (search/filter/suspend/reactivate across every
  role), and - for super admins only - creating/managing other admin accounts and
  an audit log of admin actions. This is the browser-based "desktop" management
  surface. See `admin-web/README.md`.
- **`mobile/`** — React Native (Expo) app, TypeScript:
  - **Patient app** — register/login, dashboard, book doctor appointments, order
    from pharmacies (live inventory + cart), request lab tests, request a nurse
    visit, one-tap emergency ambulance request (real device GPS), donations,
    insurance policies, real-time messaging with any provider.
  - **Doctor app** — accept/decline/complete appointment requests, patient roster
    with full history, write prescriptions, message patients, edit practice
    details, and a Payments tab to confirm fees patients have paid.
  - **Pharmacy app** — see Phase 4 above.
  - **Lab app** — see Phase 5 above.
  - **Ambulance app** — see Phase 6 above.
  - **Nurse app** — see Phase 7 above.
  - All six field roles, plus Admin, are now fully built end-to-end.
- **Payment system** — shared across every payable module (consultation fees,
  pharmacy orders, lab test fees, nurse visit fees, donations, insurance
  premiums). Patient picks USSD / Bank Transfer / Card / Wallet (Wallet is
  disabled - pending license), gets method-specific instructions, a live 5-minute
  countdown, and real-time confirmation once the provider marks it received. See
  `backend/README.md` for the full endpoint list.
- **Downloadable PDFs** — payment receipts, pharmacy order invoices, and
  prescriptions (both the patient's and issuing doctor's copies) all generate
  real PDFs server-side (`pdf-lib`) and download + open the OS share sheet on
  mobile.

## Why only Patient + Doctor + Admin are fully built right now

Full feature parity across all 6 field roles (37 screens total) plus a full admin
suite is a large build. Rather than rush shallow versions of everything, each
phase ships a surface *end-to-end and for real* — real database, real auth, real
API, real UI — so you can install it, click through it, and confirm the direction
before more gets built.

## Roadmap for next phases

1. ~~**Pharmacy app** — inventory management, POS, order fulfillment, suppliers~~ ✅ done (Phase 4)
2. ~~**Lab app** — receive test requests, upload results, patient history~~ ✅ done (Phase 5)
3. ~~**Ambulance app** — receive emergency requests, live location broadcast, accept/complete~~ ✅ done (Phase 6)
4. ~~**Nurse app** — receive visit requests, schedule, patient list~~ ✅ done (Phase 7)

All four field-role apps from the original roadmap are now complete. What's
left is the smaller spec gaps flagged against the original design doc (see
below) — there's no next role to build.

Also still open, called out as spec gaps against the original design doc:
NHIS number / genotype / profile-photo upload fields on registration, and
GPS-proximity-based "nearest hospital/doctor" search (emergency requests do
already capture live GPS; the Providers/Doctors list screens don't yet sort
by distance).

Each phase adds controllers/routes on the existing backend (the DB tables already
exist) and a new set of mobile screens + a bottom-tab navigator, following the
same pattern as `mobile/src/navigation/PatientNavigator.tsx` and
`DoctorNavigator.tsx`.

## Known gaps / not yet built

To be direct about scope, none of the following exist in this codebase yet:
- **Offline support.** The mobile app shows an "offline" banner when disconnected,
  but every screen (and the admin web app) requires a live connection - there's no
  local data cache, queued writes, or offline-first sync anywhere.
- **A desktop (native) app.** The admin panel runs in a browser, which covers
  "manage this from a computer" - but there's no Electron/Tauri native build for
  any role, mobile or admin.
- **A barcode/inventory scanner.** No camera-based scanning anywhere in the app.
- **Receipt/invoice OCR with automatic inventory updates.** No document-scanning,
  OCR, or parsing pipeline exists; pharmacy inventory is only ever edited directly
  (and the Pharmacy app itself hasn't been built yet - see roadmap above).

These are all substantial, separate features - happy to scope and build any of
them, but wanted to be upfront rather than claim they exist when they don't.

## Quick start

See `backend/README.md`, `admin-web/README.md`, and `mobile/README.md` for full
setup. Short version:

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit DATABASE_URL if needed
npm install
npx prisma migrate dev --name init
npm run prisma:seed         # creates one demo login per role + a super admin
npm run dev                 # http://localhost:4000

# 2. Admin web (separate terminal)
cd admin-web
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173

# 3. Mobile (separate terminal)
cd mobile
npm install
npx expo start              # scan the QR code with Expo Go on your phone
```

Demo logins after seeding (password for all: `password123`):
`patient@demo.com`, `doctor@demo.com`, `pharmacy@demo.com`, `lab@demo.com`,
`ambulance@demo.com`, `nurse@demo.com`, `superadmin@demo.com`.

**Note on device testing:** if you run the mobile app on a physical phone,
`localhost` in `mobile/src/api/client.ts` won't reach your computer. Set
`EXPO_PUBLIC_API_URL` to your computer's LAN IP, e.g.
`http://192.168.1.20:4000/api`.
