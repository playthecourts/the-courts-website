# The Courts — iPhone & Android app

One app for everyone. It opens `app.playthecourts.com/start`, which sends each
person to their own side after they sign in:

| Signed in as | Lands on |
|---|---|
| Parent | My Courts |
| Coach / Head coach | Coach App |
| Front desk | Front Desk check-in |
| Owner / Admin | Courts OS |

Every screen loads live from the website, so **a normal web deploy updates the
app instantly** — no App Store release needed. You only re-submit to the stores
to change the icon, name, or native settings.

App ID (both stores): `com.playthecourts.app`

---

## One-time setup (Melissa)

1. **Apple Developer Program** — developer.apple.com/programs/enroll, enroll as
   an **Organization** (The Courts LLC). Needs a D-U-N-S number (free; Apple's
   form looks it up or helps you get one). $99/year.
2. **Google Play Console** — play.google.com/console, register as an
   **Organization** (skips the 14-day/12-tester rule personal accounts have).
   $25 once.
3. **Xcode** — install from the Mac App Store (large download).
4. **Android Studio** — developer.android.com/studio (only needed for Android).
5. **Node** — already installed for the platform.

## Build the iPhone app

```
cd ~/Desktop/the-courts-website/mobile
npm install
npm run ios          # syncs and opens Xcode
```

In Xcode: select the **App** target → **Signing & Capabilities** → Team = The
Courts LLC. Plug in an iPhone (or pick a simulator) and press ▶ to run it.

To submit: **Product → Archive → Distribute App → App Store Connect**.

## Build the Android app

```
cd ~/Desktop/the-courts-website/mobile
npm install
npm run android      # syncs and opens Android Studio
```

Run on a device/emulator with ▶. To submit: **Build → Generate Signed App
Bundle** and upload the `.aab` in Play Console.

## Turning on push notifications

Push is built in but switched off until the keys exist.

**iPhone (Apple):**
1. developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+** →
   enable *Apple Push Notifications service* → download the `.p8` file (once only).
2. In Xcode, Signing & Capabilities → **+ Capability → Push Notifications**
   (the entitlement file is already in the project).
3. In Vercel → platform project → Environment Variables, add:
   `APNS_KEY_P8` (the .p8 file's text), `APNS_KEY_ID`, `APNS_TEAM_ID`.
   Add `APNS_SANDBOX=1` only while testing builds run straight from Xcode.

**Android (Firebase):**
1. console.firebase.google.com → new project "The Courts" → add an Android app
   with package `com.playthecourts.app` → download `google-services.json` into
   `mobile/android/app/`.
2. Firebase → Project settings → Service accounts → **Generate new private
   key**. In Vercel add `FIREBASE_SERVICE_ACCOUNT_JSON` = that file's contents.

**Then switch it on:**
1. Run the database step once (from `platform/`): `npx prisma migrate deploy`
   — creates the `push_devices` table.
2. In Vercel add `NEXT_PUBLIC_NATIVE_PUSH=on` and redeploy.
3. Rebuild the app (`npm run ios` / `npm run android`) so the Firebase file is
   included.

The app then asks for notification permission once, and the server can send
with `pushToAuthUser(authId, { title, body, url })` from `platform/src/lib/push.ts`.

## Store listing checklist

- App name: **The Courts**
- Subtitle: *Basketball & volleyball in Nolensville*
- Category: Sports (or Health & Fitness)
- Privacy policy URL: https://playthecourts.com/privacy
- Support URL: https://playthecourts.com/contact
- Screenshots: 6.7" and 6.5" iPhone (My Courts home, schedule, booking, coach roster)
- Apple review sign-in: give them a demo **parent** login (not a real family).

## Changing the icon or splash

Replace the images in `resources/` (icon-only.png 1024×1024, splash.png
2732×2732), then `npm run assets` and `npx cap sync`.
