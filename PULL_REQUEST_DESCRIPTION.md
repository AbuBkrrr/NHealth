# Pull Request: fix/registration-specialization -> main

This PR contains improvements to the registration flow:

- Use a shared Prisma client singleton (backend/src/utils/prisma.ts) to avoid opening multiple connections in dev/hot-reload.
- Normalize and validate phone numbers using libphonenumber-js (E.164), and enforce uniqueness on normalized phones.
- Use upsert for Specialization to avoid race conditions and only create fields present in the schema (backend/src/services/specializationService.ts).
- Make user + role-profile creation atomic via a Prisma transaction in the registration controller (backend/src/controllers/registrationController.ts).
- Map Prisma unique constraint errors (P2002) to 409 responses with a helpful message.
- Update package.json to add libphonenumber-js.
- Add integration tests (tests/integration/registration.test.ts) that run against a test database.

Notes for reviewers:
- Ensure your test environment DATABASE_URL points to a disposable test database before running tests.
- The PR adds a dependency (libphonenumber-js) — run npm install.
- The PR uses prisma.upsert on Specialization assuming a unique index on name. If your DB doesn't have a unique index for case-insensitive name, consider adding one or using a normalized_name column.

Testing instructions are in the PR description.
