# N-Health load test / 100-user simulation

`simulate.js` registers 100 real users spread across every role (70
patients, 8 doctors, 5 pharmacies, 5 labs, 6 ambulances, 6 nurses), then
drives them all concurrently through the app's core features against a
**real, running backend** - your local dev server or a deployed one.

It finishes with a dedicated stress test of the three places this codebase
uses an atomic database guard against concurrent writes: an ambulance
claiming an emergency call, a nurse claiming a broadcast request, and a
pharmacy's stock decrementing on order. Each test has several accounts race
to grab the same single resource at the exact same moment; the report tells
you whether exactly one won (correct) or more than one did (a real bug, and
worth reporting immediately if you ever see it).

## Requirements

- Node.js 18+ (uses the built-in `fetch` - no `npm install` needed)
- A running N-Health backend, reachable at `BASE_URL` (see below), connected
  to a database you're okay filling with ~100 test accounts and records.
  **Don't point this at a production database you care about.**

## Usage

```bash
cd load-test

# Against your local dev server (the default):
node simulate.js

# Against a deployed backend:
BASE_URL=https://your-backend.onrender.com/api node simulate.js
```

It prints progress through 7 phases, then a full report: total requests,
success rate, per-endpoint timing (avg/max latency), and the three race-test
verdicts. A run takes well under a minute against a local server.

## What it actually exercises

1. Registers all 100 users (mixed roles, unique emails per run so it's safe
   to run more than once)
2. Pharmacies stock a few inventory items
3. Patients discover the registered doctors/pharmacies/labs/nurses
4. Every patient, concurrently: books an appointment, messages that doctor,
   places a pharmacy order, requests a lab test, requests a nurse (half
   targeted, half broadcast), donates, adds an insurance policy - and every
   5th patient also triggers an emergency request
5. Payments are created (and confirmed by the owning provider) for
   everything created in step 4
6. Doctors confirm their pending appointment requests
7. The three race-condition stress tests described above

## Known scope limits (by design, not bugs)

- Nurse-request payments are created but not auto-confirmed, since a
  *broadcast* nurse request has no assigned nurse yet at creation time to
  confirm as - this still exercises payment creation under load, just not
  the full confirm cycle for that one payable type.
- This covers each role's core actions, not literally every endpoint in the
  app (e.g. it doesn't exercise avatar upload, PDF downloads, or the admin
  dashboard) - it's sized to stress-test concurrency and the main patient
  journey, not to be an exhaustive endpoint-by-endpoint test suite.

## A note on how this was verified

This script can't be tested against the real N-Health backend from inside
the environment that built it (no live database was available there). It
was instead run against a purpose-built mock server that mimics every
endpoint's response shape, confirming the script itself runs end-to-end
without errors and that all three race tests correctly detect a single
winner. That verifies the script's own logic is sound - it does not verify
the real backend's behavior, which is exactly what running this for real
against your own server will tell you.
