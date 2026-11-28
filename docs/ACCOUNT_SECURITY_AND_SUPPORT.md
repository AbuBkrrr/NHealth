# Account security, consents and support

## Two-step verification (2FA)
Every account (patients, providers, admins) can turn it on:
- **App:** Settings → Security → Two-step verification.
- **Admin console:** Account security (left menu).

Methods: an authenticator app (Google Authenticator, Microsoft Authenticator, Authy; recommended) or a 6-digit code by email.
Turning it on shows 10 one-time **backup codes**; each works once if the phone or email is lost. New codes can be made at any time (old ones stop working).
Turning 2FA on signs the account out of other devices.

**Require it for admins:** a super admin can tick *Require two-step verification for every admin account* on the Account security page. Admins without it are sent to that page at sign-in and cannot turn it off.
Recommended: turn it on for your own super-admin account first, store the backup codes offline, then tick the rule.

Lost phone and backup codes: a super admin can reset the user's password from Users; there is no SMS fallback (N-Health sends no SMS).

## Consents at sign-up
- Everyone confirms the **data-use consent** (what we collect and why, NDPA 2023). The date and version are stored on the account.
- Providers also accept the **provider terms** (in-person care only, licence kept valid, direct payments, no telemedicine).
- Google sign-ups get the same steps before the account is created.

## Help bubble
The 💬 button on every app screen opens live chat with the support team (signed in or as a guest), plus email and WhatsApp links.
- Replies are made in Admin → Support tickets; they appear instantly in the user's chat.
- Set `SUPPORT_EMAIL` and `SUPPORT_WHATSAPP` in `/etc/nhealth/backend.env`, then restart the API.

## Enquiries
Admin → Marketing → Enquiries → **Reply** sends an email (and offers a WhatsApp link) and keeps the history with the lead.

## Identity check (KYC) selfie
The selfie must be taken live with the **front camera** in the app; picking a photo from the gallery is not offered. On a computer without a camera, the user is asked to finish on their phone.
