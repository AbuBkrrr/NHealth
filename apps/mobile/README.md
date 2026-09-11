# N-Health Mobile

React Native + Expo + TypeScript. Targets iOS and Android from one codebase.

## Prerequisites

- Node.js 18+
- The [Expo Go](https://expo.dev/go) app on your phone (easiest way to test), or
  an iOS/Android simulator set up locally
- The backend running (see `../backend/README.md`) and reachable from your phone

## Setup

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android: Expo Go app's scanner; iOS: the
Camera app). The app reloads live as you edit code.

### Connecting to the backend

By default the app calls `http://localhost:4000/api`. That works in an
iOS Simulator but **not on a physical phone**, since "localhost" on your
phone means the phone itself. Find your computer's LAN IP
(e.g. `ipconfig getifaddr en0` on Mac, `ipconfig` on Windows) and run:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api npx expo start
```

(or set it in a `.env` file that Expo picks up automatically — see
[Expo's env docs](https://docs.expo.dev/guides/environment-variables/)).

Make sure your phone and computer are on the same Wi-Fi network, and that
your firewall allows inbound connections on port 4000.

## Project layout

```
App.tsx                     entry point
src/
  api/                       axios client + typed API calls
  context/AuthContext.tsx    login/register/logout, session persistence
  hooks/useSocket.ts         Socket.io connection + live event subscriptions
  navigation/                stacks + tab navigator (Patient built; others to follow)
  screens/
    auth/                    Login, Register
    patient/                 Home, Emergency, Appointments, Doctors (with real date/time
                              booking), Pharmacy, Order History, Labs (with scheduling +
                              result viewer), Prescriptions, Providers (doctors/nurses),
                              Donations, Insurance
    shared/                  Conversations, Chat, Profile (reused by every role)
  theme/colors.ts            color palette ported from the original HTML mockup
  utils/errorMessage.ts      turns any API error into a consistent, friendly message
                             (distinguishes "offline" from "server rejected this")
  components/OfflineBanner.tsx   shows a banner across the whole app when disconnected
```

Two extra native dependencies beyond the original list: `@react-native-community/datetimepicker`
(real date/time selection for booking appointments and lab tests) and
`@react-native-community/netinfo` (drives the offline banner). Both are pure Expo/Expo Go
compatible - no extra native setup needed.

`expo-file-system` and `expo-sharing` power PDF downloads (receipts, invoices,
prescriptions) - the app downloads the file from the backend with the auth
token attached, then hands it to the OS share sheet so the person can save,
print, or send it on. See `src/utils/downloadPdf.ts`.

## Adding the next role's screens

1. Add `src/screens/<role>/` with that role's screens (mirror the `patient/` folder).
2. Add a `<Role>Navigator.tsx` bottom-tab navigator (copy `PatientNavigator.tsx`).
3. Wire it into `RootNavigator.tsx`'s role switch, replacing the `ComingSoonScreen`
   fallback for that role.
4. Add the matching typed API calls in `src/api/<role>.ts` (mirror `api/patient.ts`).

## Building a real app store binary

`expo start` is for development. When ready to ship:

```bash
npm install -g eas-cli
eas build --platform ios       # or --platform android
```

This requires a free Expo account and (for iOS) an Apple Developer account.
See [Expo's build docs](https://docs.expo.dev/build/introduction/) for the
full walkthrough, including app icons, splash screens, and store submission.
