# N-Health on phones: install prompt, App Store (iPhone) and Google Play

There are three ways onto a phone, and they all run the same N-Health web app.

| Route | Who | What you need | Status |
|---|---|---|---|
| **Install from the browser (PWA)** | Everyone, today | Nothing: it's live on www.nhealth.com.ng | ✅ Ready. The app asks every visitor to install it |
| **Google Play** (Trusted Web Activity) | Android | Google Play developer account ($25 once) | Config ready in `native/android/` |
| **Apple App Store** (Capacitor) | iPhone / iPad | Apple Developer Program ($99/year) and a Mac with Xcode, or a cloud Mac build service | Config ready in `native/` |

## 1. Install prompt (already live after `nhealth-update`)

The app detects the device and browser on every visit and asks to install, until it is installed:

| Device / browser | What the person sees |
|---|---|
| Android Chrome, Edge, Samsung Internet, Opera; desktop Chrome/Edge | **Install** button (the browser's own one-tap install) |
| Android with no one-tap install yet (e.g. Firefox, older Samsung) | The menu steps for that browser |
| iPhone / iPad (Safari, Chrome, others) | "Tap **Share**, then **Add to Home Screen**" (Apple doesn't allow a button) |
| WhatsApp, Instagram, Facebook, TikTok and other in-app browsers | "Open in Chrome / Safari to install", with an **Open in Chrome** button on Android |
| Mac Safari | File → Add to Dock |

- **Not now** hides it until the next visit.
- It never covers emergency, ambulance, hospital emergency board, chat, booking or wallet screens.
- It stops for good once the app is installed, or when it runs inside the store apps.

**App icon and launch screens:**
- The icon is in `brand/logo.svg` (blue tile, white cross, pulse line).
- PNG sizes are in `apps/landing/public/icons/`; Android "maskable" icons are included.
- iPhone and iPad launch images are in `apps/landing/public/splash/`.
- The same logo is in the app bar, sign-in screen, splash, admin console, browser tab and flyers.

## 2. Google Play (Android), recommended first

A Trusted Web Activity (TWA) is the official way to publish a web app on Play. It opens www.nhealth.com.ng full-screen, so every website update reaches Play users instantly with no store re-submission.

1. Install the tools on any computer (Windows, Mac or Linux):
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. Build the app:
   ```bash
   cd native/android && bubblewrap init --manifest https://www.nhealth.com.ng/manifest.webmanifest
   ```
   Accept the values from `twa-manifest.json` (package `ng.com.nhealth.twa`). Bubblewrap creates the signing key. **Back it up; you can never change it.**
3. Run `bubblewrap build`. It produces `app-release-bundle.aab`.
4. In Play Console: create the app, then upload the `.aab` to *Internal testing*.
5. In **Setup → App signing**, copy the **SHA-256 certificate fingerprint**.
6. Copy `native/android/assetlinks.template.json` to `apps/landing/public/.well-known/assetlinks.json` and paste in the fingerprint. Commit it and run `nhealth-update`.
7. Check that https://www.nhealth.com.ng/.well-known/assetlinks.json opens. Without this file the app shows a browser address bar.
8. Fill in the store listing (text below), content rating, the **Health apps** declaration and the data safety form. Then promote to Production.

## 3. Apple App Store (iPhone)

Apple doesn't accept a plain website wrapper, so the iPhone app **bundles** the web app with Capacitor. It opens from the phone even offline, then talks to `api.nhealth.com.ng`.

**You need:**
- the Apple Developer Program, $99 a year;
- a Mac with Xcode 15 or newer, or a cloud Mac build service such as Codemagic or Ionic Appflow.

```bash
cd native
npm install
npx cap add ios          # first time only, creates native/ios
npm run assets           # app icon + launch screen from native/store
npm run ios              # builds the web app, copies it in, opens Xcode
```

**In Xcode:**
1. Select the **App** target → **Signing & Capabilities** → your team.
2. Bundle ID `ng.com.nhealth.app`.
3. Add **Push Notifications** if you will send iPhone push.
4. In `Info.plist`, add usage texts:
   - `NSCameraUsageDescription`: "To scan QR codes and photograph documents and prescriptions."
   - `NSPhotoLibraryUsageDescription`: "To upload documents, prescriptions and photos."
   - `NSLocationWhenInUseUsageDescription`: "To find care near you and send your location to an ambulance or hospital in an emergency."
   - `NSMicrophoneUsageDescription`: "For video and voice consultations."
5. **Product → Archive → Distribute App → App Store Connect.** Then submit in App Store Connect.

**Each new version:**
- Run `npm run ios` and archive again.
- Web-only changes reach website and Android users at once. iPhone users get them with the next App Store build.

`npx cap add android` also builds a Capacitor Android app if you ever prefer that over the TWA.

### Things Apple checks, and where N-Health stands

| Guideline | Status |
|---|---|
| 4.2 Minimum functionality (no "just a website") | The app is bundled and works offline. It has booking, emergency, location, uploads and a QR flyer. Adding native push (APNs) before submitting strengthens this |
| 5.1.1(v) Account deletion in the app | ✅ Settings → Privacy → Delete account |
| 4.8 Sign in with Apple | **Required** if Google sign-in shows in the iPhone app. Either add Sign in with Apple, or hide Google sign-in inside the iPhone app |
| 3.1 In-app purchase | Coins pay for real-world healthcare by people (consultations, medicines, tests, ambulances). Apple allows non-IAP payment for those (3.1.3(d) person-to-person services, 3.1.5(a) physical goods). Explain this in the review notes. Apple may still question coin top-ups, so be ready to answer |
| 1.4.1 Medical apps | State that providers are licensed and verified, and that N-Health doesn't diagnose |
| 5.1.2 Privacy labels | Declare health, location, contact, identity documents and payments (via partners); "not used for tracking" |
| Demo account | Give reviewers a patient login and a doctor login with sample data. Never use real patients |

## 4. Store listing text (both stores)

- **Name:** N-Health
- **Subtitle (Apple, 30 chars):** Doctors, drugs, labs, ambulance
- **Short description (Play, 80 chars):** Book doctors, order medicines, book tests and call an ambulance across Nigeria.
- **Category:** Medical (Apple) / Medical (Play)
- **Keywords (Apple):** doctor,hospital,pharmacy,lab,ambulance,nurse,health,clinic,Nigeria,appointments,blood bank,HMO
- **Description:**

  > N-Health brings Nigerian healthcare into one app.
  > • Book in-person and home visits with verified doctors and nurses
  > • Order medicines from nearby pharmacies, with delivery
  > • Book lab and scan tests, with home sample collection, and get results on your phone
  > • Emergency: call an ambulance with live tracking, or alert the nearest hospital before you arrive
  > • Request home nursing care
  > • Find hospitals, blood banks and HMOs near you
  > • Keep your health records, prescriptions and emergency card safe
  > Works on slow networks and offline. Providers: get verified, receive bookings, recruit staff and share your N-Health flyer with a QR code.

- **Privacy policy URL:** https://www.nhealth.com.ng/privacy
- **Terms URL:** https://www.nhealth.com.ng/terms
- **Support URL / email:** https://www.nhealth.com.ng and support@nhealth.com.ng
- **Icon:**
  - Apple: `native/store/app-store-icon-1024.png` (1024×1024, no transparency).
  - Play: `native/store/play-store-icon-512.png`.
- **Screenshots:** take them from the phone, at least 3 per store (iPhone 6.7" 1290×2796 and 6.5"; Android phone). Good choices are the patient home, booking, emergency, pharmacy and the provider flyer.

## 5. The older Expo app (`apps/mobile`)

`apps/mobile` is an earlier React Native/Expo app. It doesn't have most of the current features: coins, emergency arrivals, jobs, flyers, facility directory or offline mode. The store apps above use the up-to-date web app instead, so `apps/mobile` doesn't need to be published.
