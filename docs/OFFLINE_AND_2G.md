# Fast on 2G, usable offline

N-Health is built to open instantly and keep working on weak or no connection.

## What the person gets

| Situation | What happens |
|---|---|
| Opening the app again | Opens straight away from the phone (no download, no splash wait). |
| Switching tabs | The last copy shows at once; fresh data loads in the background and the screen updates by itself. |
| First visit to a tab | Usually instant too: after sign-in, each role's main tabs are downloaded quietly in the background. |
| No connection | Every screen opened before still works with the last saved data. A banner says the data is saved. |
| Sending while offline | Text messages, medication reminders, "taken/skipped" logs, family members and vaccinations are kept and sent automatically when the connection returns. The banner shows how many are waiting. |
| Payments, bookings, uploads, emergencies | Need a connection (they must reach the server at that moment). |

## How it works

- **App files** (`apps/landing/public/sw.js`): the service worker saves every built file at install and serves the app from the phone first. A new version is installed in the background and used the next time the app opens. Files from the previous version are kept so an open page never breaks during an update.
- **Data** (`apps/landing/src/lib/api.js`): every read is saved on the phone. A copy younger than 20 seconds is used without asking the server; an older copy is shown at once and refreshed in the background. After the person changes something, or a live update arrives, the next read goes to the server first so nobody sees an outdated screen after their own action. Saved data is removed at sign-out.
- **Smaller downloads**: screens are split per area (patient / providers / shared), the live-update library loads after the first screen, and the API and web server compress responses (`compression` in the API, gzip in Nginx).
- **Offline outbox**: writes that are safe to send late use `postLater()`. They are kept in order and sent when the phone is back online. A write the server rejects is dropped, not retried forever.

## Measured (simulated 2G: 250 kbit/s, 600 ms latency, patient account)

| | Before | After |
|---|---|---|
| Reopen the app | 2.6 s | 0.06 s |
| Switch tab (first visit) | 0.7-0.8 s | 0.04-0.07 s |
| Switch tab (again) | 0.7-0.8 s | 0.05-0.1 s |
| First ever open (sign-in page) | 5.5 s | 3.5 s |
| Message typed offline | lost (error) | sent automatically when back online |

Real 2G networks are often slower and less steady than this test, so the "before" numbers grow there while the "after" numbers stay the same: they come from the phone, not the network.
