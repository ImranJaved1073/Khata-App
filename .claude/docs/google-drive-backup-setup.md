# Google Drive backup — one-time setup

Cloud backup (Settings → Cloud backup) uploads a dated JSON snapshot of the whole ledger to a
"Khata Backups" folder in the shop owner's own Google Drive, and can restore from any of those
snapshots. This is built (`src/lib/googleAuth.ts`, `src/lib/googleDrive.ts`, `src/lib/driveBackup.ts`,
`SettingsScreen.tsx`'s Cloud Backup section) but **inert until a human does the steps below** —
nothing here can be done by an agent, because it requires a Google account and a Google Cloud
Console UI walkthrough. Until then, `SettingsScreen` shows "Not set up yet" instead of a broken
Connect button (`isGoogleDriveConfigured()` gates on step 4 below).

## Why this can't be automated
- Creating a Google Cloud project and configuring an OAuth consent screen requires signing into
  a Google account through a browser — no API does this non-interactively.
- The Android OAuth client specifically must be bound to this app's exact package name **and**
  the SHA-1 fingerprint of whichever key will sign the installed APK. Anyone can extract a SHA-1
  from a keystore file (see step 3), but only the project owner can decide which Google account /
  Cloud project this app's credentials should live under.

## Step 1 — Create a Google Cloud project
1. Go to <https://console.cloud.google.com/> and create a new project (or reuse an existing one)
   — any name, e.g. "Khata App".
2. In **APIs & Services → Library**, search for **Google Drive API** and click **Enable**.

## Step 2 — Configure the OAuth consent screen
1. **APIs & Services → OAuth consent screen**.
2. User type: **External**.
3. App name: "Khata" (or your business name), pick your own email for the support/contact fields.
4. **Scopes**: add `https://www.googleapis.com/auth/drive.file`. This is Drive's narrowest scope —
   it only ever grants access to files this app itself creates, never the whole Drive — so Google
   classifies it as non-sensitive and it does **not** require Google's app-verification review.
5. **Test users**: add the Google account(s) that will actually use the app (yourself, and anyone
   else who'll run it). While the app's Publishing status is **Testing** (the default, and there's
   no need to change it — see note below), sign-in only works for accounts on this list.
6. Leave Publishing status as **Testing**. Moving to "In production" triggers Google's verification
   process, which is unnecessary for a `drive.file`-scoped app used by a small, known set of test
   users — Testing mode supports up to 100 test users indefinitely, no expiry.

## Step 3 — Get this app's SHA-1 fingerprint
Already extracted for the current debug keystore (used by every `expo run:android` dev-client
build on this machine):

```
Package name: com.anonymous.KhataApp
SHA-1 (debug): 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Re-derive it yourself (e.g. on a different machine, or after the keystore changes) with:
```
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
(`android/` only exists after `npx expo prebuild`; the password is always literally `android` for
the auto-generated debug keystore.)

**A real Play Store release build signs with a different key** (either an EAS-managed key, if you
run `eas build`, or your own release keystore) — that build will need **its own SHA-1** added as a
second entry under the same Android OAuth client (Google's console supports multiple SHA-1
fingerprints per Android client) before Google Sign-In will work in a release build. Not needed
for dev-client testing; revisit this when `eas build` is actually run (see `roadmap.md`).

## Step 4 — Create the OAuth client IDs
**APIs & Services → Credentials → Create Credentials → OAuth client ID**, twice:

1. **Android** — Package name `com.anonymous.KhataApp`, SHA-1 from step 3. This is what lets the
   native Google Sign-In flow launch at all on Android; it has no client secret.
2. **Web application** — no redirect URIs needed. Copy the generated **Client ID**
   (`....apps.googleusercontent.com`) — this is the one the app actually reads, per
   `@react-native-google-signin/google-signin`'s own requirement: a `webClientId` is mandatory
   even for an Android-only sign-in, because it's the OAuth audience Google issues the ID token
   for internally. Ignore/discard the Web client's secret — this app never uses it.

## Step 5 — Paste the Web client ID into the app
Edit [`app.json`](../../app.json)'s `expo.extra.googleDrive.webClientId`:
```json
"extra": {
  "googleDrive": {
    "webClientId": "PASTE-THE-WEB-CLIENT-ID-HERE.apps.googleusercontent.com"
  }
}
```
This is a public client identifier, not a secret (Google's own docs are explicit that OAuth client
IDs for installed/native apps aren't confidential) — safe to commit.

## Step 6 — Rebuild the dev client
The native Google Sign-In module (`@react-native-google-signin/google-signin`) doesn't exist in
whatever dev-client APK is already installed — it was added to `package.json` in this same change,
same situation `react-native-share`/`react-native-view-shot` were in earlier this phase (see
`roadmap.md`'s 2026-08-06/07 entries). Needs:
```
npx expo prebuild --platform android --clean
npx expo run:android
```
Tapping "Connect Google Drive" in Settings **before** this rebuild will fail (the native module
isn't linked yet) — that's expected, not a new bug.

## After setup
Once steps 1–6 are done: Settings → Cloud backup → **Connect Google Drive** opens the native
Google account picker, scoped to whichever test user(s) you added in step 2. From there: **Back up
now** uploads immediately; **Automatic backup** (Daily/Weekly) uploads silently on app open/unlock
once the chosen interval has elapsed (`runAutoDriveBackupIfDue`, `backupRepository.ts`); **Restore
from Drive** lists every backup currently in the "Khata Backups" Drive folder (newest first) to
pick from. The last 20 backups are kept — older ones are pruned automatically after each new
upload (`MAX_KEPT_BACKUPS`, `driveBackup.ts`).
