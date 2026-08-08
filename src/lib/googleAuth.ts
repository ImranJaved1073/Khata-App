import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

/**
 * `drive.file` is Google's narrowest Drive scope — it only ever grants access to files this app
 * itself created (or that the user explicitly opened with this app), never the user's whole Drive.
 * That keeps the OAuth consent screen a "non-sensitive"/no-verification-required scope while the
 * app is in Google Cloud Console's "Testing" publishing status, which is all a single-shop-owner
 * install needs — see `.claude/docs/google-drive-backup-setup.md`.
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface GoogleAccount {
  email: string;
  name: string | null;
}

function configuredWebClientId(): string | null {
  const value = Constants.expoConfig?.extra?.googleDrive?.webClientId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** False until the app owner has pasted a real OAuth web client ID into `app.json`'s `expo.extra.googleDrive.webClientId` — see the setup doc. The Settings screen uses this to show "not set up yet" instead of letting the user hit a broken Connect button. */
export function isGoogleDriveConfigured(): boolean {
  return configuredWebClientId() !== null;
}

let didConfigure = false;

function ensureConfigured(): void {
  if (didConfigure) return;
  const webClientId = configuredWebClientId();
  if (!webClientId) {
    throw new Error(
      "Google Drive backup has no OAuth client ID configured (app.json expo.extra.googleDrive.webClientId) — see .claude/docs/google-drive-backup-setup.md",
    );
  }
  GoogleSignin.configure({ webClientId, scopes: [DRIVE_SCOPE] });
  didConfigure = true;
}

function accountFromUser(data: { user: { email: string; name: string | null } }): GoogleAccount {
  return { email: data.user.email, name: data.user.name };
}

/** Opens the native Google account picker + consent screen. Returns null if the user cancels rather than throwing — a cancel isn't an error. */
export async function connectGoogleDrive(): Promise<GoogleAccount | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") return null;
  return accountFromUser(result.data);
}

export async function disconnectGoogleDrive(): Promise<void> {
  ensureConfigured();
  await GoogleSignin.signOut();
}

/** Best-effort, synchronous, never throws — safe to call from render/mount code. Doesn't confirm the session is still valid with Google, only that a previous `connectGoogleDrive()` succeeded and nothing has signed out locally since. */
export function currentAccount(): GoogleAccount | null {
  if (!isGoogleDriveConfigured()) return null;
  try {
    const user = GoogleSignin.getCurrentUser();
    return user ? accountFromUser(user) : null;
  } catch (error) {
    // Native module not linked yet (pre dev-client-rebuild) — treat as "not connected", don't crash Settings.
    console.error(error);
    return null;
  }
}

/**
 * Returns a Drive-scoped access token, silently re-authenticating via the cached on-device Google
 * session if needed — no UI, no prompt. Google Play Services owns the actual refresh-token
 * exchange internally, so this app never stores or manages a refresh token itself (unlike the PIN
 * hash in `appLock.ts`, there is deliberately no secret of ours to keep in `expo-secure-store`
 * here — the OS's own account manager is the credential store). Returns null (never throws) if
 * there's no signed-in account or the session needs the user to reconnect — callers should treat
 * that as "skip this backup attempt", not as a hard failure.
 */
export async function getDriveAccessToken(): Promise<string | null> {
  try {
    ensureConfigured();
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const silent = await GoogleSignin.signInSilently();
    if (silent.type !== "success") return null;
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch (error) {
    console.error(error);
    return null;
  }
}
