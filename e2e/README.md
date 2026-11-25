# End-to-end flow check

`full-flow.cjs` signs up every role and walks the whole app (≈220 checks).

**Run it only against a disposable test install. It creates accounts and data, and it writes coins directly into the database.**

What it covers:
- patient and provider sign-up through the UI;
- admin verification in the admin console;
- provider setup: calendar, inventory, stock intake, audit, POS, lab catalog, institution departments, staff and admissions, payout accounts;
- the patient journey: booking through the UI calendar, paying with coins, the doctor accepting, chat with photos, prescription, lab order and result back to the doctor, pharmacy order with the prescription gate, delivery, cash nurse visit, emergency with ambulance ETA, donations, insurance, health records, emergency ID;
- earnings splits and payouts, revenue;
- every screen of every role, plus logout and account deletion.

Requirements: the API built and running with `NODE_ENV=production`, the web app and admin console served by Nginx (`deploy/vps/nginx.conf`), Playwright and Chromium, and `psql`.

```bash
# Test install with hostnames www/admin/api.nhealth.test mapped to 127.0.0.1:
E2E_DB_URL=postgresql://user:pass@127.0.0.1:5432/nhealth_test node e2e/full-flow.cjs

# Different hosts:
E2E_WEB=https://www.staging.example E2E_ADMIN=https://admin.staging.example E2E_API=https://api.staging.example/api \
E2E_HOST_MAP=0 E2E_DB_URL=... node e2e/full-flow.cjs
```

Screenshots and `results.json` are written to `e2e/output/`.
