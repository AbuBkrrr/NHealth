# N-Health Admin Web

React + Vite + TypeScript super admin / admin panel. Runs in any browser -
this is the "desktop" management surface for the platform (as distinct from
the mobile apps).

## Setup

```bash
cp .env.example .env    # edit VITE_API_URL if your backend isn't on localhost:4000
npm install
npm run dev             # http://localhost:5173
```

Requires the backend running (see `../backend/README.md`) and seeded
(`npm run prisma:seed` in `backend/`), which creates the bootstrap super
admin account: `superadmin@demo.com` / `password123`.

## What's here

- **Dashboard** — live counts of users by role, pending appointments,
  payments awaiting confirmation, open emergencies, total donations.
- **Users** — every account across every role. Search, filter by role/status,
  view a user's full profile, suspend/reactivate any non-admin account.
- **Admin Accounts** *(super admin only)* — create new admin accounts, grant
  or revoke super admin access, suspend or permanently delete admin accounts.
  A super admin can't demote, suspend, or delete themselves (prevents
  accidentally locking yourself out).
- **Audit Log** *(super admin only)* — every admin action (suspensions,
  admin account changes) with who did it and when.

## Roles vs. permissions

- Logging in requires an account with `role: ADMIN` in the database - any
  other role is rejected at login with a clear message.
- Within `ADMIN`, `isSuperAdmin` gates the Admin Accounts and Audit Log
  sections. A plain admin can manage regular users (patients, doctors, etc.)
  but not other admins.

## Known gaps

This is a functional first version, not a finished product:
- No offline support (same as the mobile apps) - requires a live connection.
- User detail view shows the raw role-profile JSON rather than a formatted
  view per role - fine for support/debugging, not polished for daily use.
- No bulk actions, no CSV export, no server-side sorting (only filter +
  paginate).
- Suspending a user blocks them from logging in but doesn't cancel their
  in-flight appointments/orders/payments - that's a product decision to make
  once you see how you want suspensions to behave.

## Building for deployment

```bash
npm run build
```

Outputs static files to `dist/` - deployable to any static host (Vercel,
Netlify, S3+CloudFront, or your own server via nginx). Set `VITE_API_URL` to
your production backend URL at build time.
