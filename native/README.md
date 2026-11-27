# N-Health store apps

- `capacitor.config.json` and `package.json`: the iPhone (and optional Android) app, which bundles `apps/landing/dist`.
- `android/twa-manifest.json`: the Google Play app (Trusted Web Activity) for www.nhealth.com.ng.
- `android/assetlinks.template.json`: becomes `apps/landing/public/.well-known/assetlinks.json` once Play gives you the signing fingerprint.
- `store/`: App Store and Play Store icons.

This folder is deliberately outside the pnpm workspace: install it with `npm install` here, on the computer that builds the apps.

Full steps, the store listing text and Apple review notes are in [docs/APP_STORES.md](../docs/APP_STORES.md).
