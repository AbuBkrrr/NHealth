MIGRATION and BACKFILL RUNBOOK

This runbook guides applying the harmonized Prisma schema, detecting/resolving duplicate phones,
backfilling specialization FKs, and deploying safely.

Prerequisites
- Node 18+ and npm installed
- Access to the staging and production databases (DATABASE_URL set)
- Ensure you have backups/snapshots of the target databases before running migrations

1) Detect duplicate phones (run on staging and prod)
- Run: psql <DATABASE_URL> -f sql/detect_duplicate_phones.sql
- If the first query returns rows, there are duplicate phone numbers and you must resolve them before applying the unique constraint.

Resolution options
- Manual merge: review rows and merge accounts in-app or via SQL
- Null duplicates: run the safe UPDATE in the SQL file (commented) to null secondary rows
- Temporary suffix: set phone = phone || '-dup-' || substring(id,1,6) to preserve the value while making it unique

2) Apply schema migration on staging
- From repo root:
  npm install
  npx prisma migrate dev --name harmonize-specializations
  (Run tests and ensure app starts)

3) Backfill Specializations on staging
- Run:
  node scripts/backfillSpecializations.js
- Review created Specialization rows in the DB. Normalize names (merge similar names) if needed.
- Optionally export created specializations for a manual review:
  SELECT * FROM "Specialization" ORDER BY name;

4) Run integration tests and smoke tests on staging
- Test signups for each role
- Test doctor/nurse profile updates with specialtyId and specialty string
- Test payments and critical flows

5) Apply migration on production
- After resolving duplicate phones in prod and confirming the staging run was successful:
  npx prisma migrate deploy
- Run backfill script on production:
  node scripts/backfillSpecializations.js

6) Post-deploy checks
- Verify no user rows have NULL email/phone unexpectedly
- Run provider directory queries to ensure lat/lng and specialization relate correctly
- Run application smoke tests (signup, create appointment, pharmacy order)

7) Optional tightening
- After a period of successful operation, consider making specialtyId non-nullable if you want to enforce FK always present (requires additional migration and careful backfill)

Support
If you want, I can open a PR containing these files and also add controller patches and integration tests — reply to confirm and I will push the controller changes next.