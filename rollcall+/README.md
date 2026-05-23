# RollCall+

RollCall+ is an Expo React Native app for AGC students. It syncs attendance, GPA, profile data, and portal results through the RollCall+ Cloudflare API.

## Get Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

The production API base URL is configured in `app.json`:

```text
https://rollcallplus-api.rollcallplus.workers.dev
```

## Useful Checks

```bash
npm run lint
npm run typecheck
```

## Builds

Use the preview profile when you want an APK to install or share directly:

```bash
npx eas build -p android --profile preview
```

Use production when you are ready for a Play Store app bundle:

```bash
npx eas build -p android --profile production
```

## Backend

The Cloudflare Worker lives in `../rollcall-cloudflare`. Deploy it with:

```bash
npx wrangler deploy
```
