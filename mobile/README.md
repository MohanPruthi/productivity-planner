# Planner mobile

Expo (React Native) app for the productivity planner: Today, DSA, Notes, Meds and Settings.
It talks to the same API as the website (`https://productivity-planner-moyy.onrender.com` by default).

## Run on an iPhone with Expo Go

1. Install **Expo Go** from the App Store.
2. On the PC:
   ```bash
   cd mobile
   npm install
   npx expo start --tunnel
   ```
   `--tunnel` works even when the phone isn't on the same Wi-Fi. On the same Wi-Fi, plain `npx expo start` is faster.
3. Scan the QR code with the iPhone Camera app and open it in Expo Go.

The first sign-in after the server has been idle can take up to a minute while the free Render instance wakes up.

## Use a local API

Start the server (`npm run dev --prefix server`, port 5000), then point the app at your PC's LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000 npx expo start
```

(PowerShell: `$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:5000"; npx expo start`.) The phone and PC must be on the same network, and Windows Firewall must allow port 5000.

## Build an Android APK

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

EAS builds in the cloud and gives you a link to download the `.apk`. The first build asks to create the EAS project and an Android keystore; accept the defaults.
iOS builds (`-p ios --profile preview`) need a paid Apple Developer account; use Expo Go on the iPhone instead.

## Useful commands

- `npm run typecheck` / `npx expo lint`
- `npm run icons` regenerates the app icon, adaptive icon and splash image from `scripts/generate-icons.js`
