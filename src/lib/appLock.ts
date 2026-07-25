import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

/**
 * App lock state lives in the OS secure store (not the SQLite DB), per architecture.md:
 * a salted SHA-256 of the PIN, the salt, a failed-attempt counter, and a lockout timestamp.
 */
const PIN_HASH_KEY = "khata.pin.hash";
const PIN_SALT_KEY = "khata.pin.salt";
const FAILED_ATTEMPTS_KEY = "khata.pin.failed";
const LOCKOUT_UNTIL_KEY = "khata.pin.lockoutUntil";
const ONBOARDED_KEY = "khata.onboarded";

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;
export const PIN_LENGTH = 4;
/** Re-lock threshold for background -> active transitions (spec A2 AC). */
export const RELOCK_AFTER_MS = 2 * 60_000;

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPin(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PIN_HASH_KEY)) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await resetLockout();
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await resetLockout();
}

async function resetLockout(): Promise<void> {
  await SecureStore.deleteItemAsync(FAILED_ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
}

export interface LockoutState {
  lockedUntil: number | null;
  attemptsLeft: number;
}

export async function getLockoutState(): Promise<LockoutState> {
  const [failedRaw, lockoutRaw] = await Promise.all([
    SecureStore.getItemAsync(FAILED_ATTEMPTS_KEY),
    SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY),
  ]);
  const failed = failedRaw ? parseInt(failedRaw, 10) : 0;
  const lockedUntil = lockoutRaw ? parseInt(lockoutRaw, 10) : null;
  return {
    lockedUntil: lockedUntil && lockedUntil > Date.now() ? lockedUntil : null,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - failed),
  };
}

export interface VerifyResult {
  ok: boolean;
  lockout: LockoutState;
}

/** Verifies a PIN, updating the failed-attempt counter / lockout window on failure. */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  const current = await getLockoutState();
  if (current.lockedUntil) {
    return { ok: false, lockout: current };
  }

  const [hash, salt] = await Promise.all([
    SecureStore.getItemAsync(PIN_HASH_KEY),
    SecureStore.getItemAsync(PIN_SALT_KEY),
  ]);
  if (!hash || !salt) {
    return { ok: false, lockout: current };
  }

  const candidate = await hashPin(pin, salt);
  if (candidate === hash) {
    await resetLockout();
    return { ok: true, lockout: { lockedUntil: null, attemptsLeft: MAX_ATTEMPTS } };
  }

  const failedRaw = await SecureStore.getItemAsync(FAILED_ATTEMPTS_KEY);
  const failed = (failedRaw ? parseInt(failedRaw, 10) : 0) + 1;
  await SecureStore.setItemAsync(FAILED_ATTEMPTS_KEY, String(failed));

  let lockedUntil: number | null = null;
  if (failed >= MAX_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_MS;
    await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, String(lockedUntil));
  }

  return {
    ok: false,
    lockout: { lockedUntil, attemptsLeft: Math.max(0, MAX_ATTEMPTS - failed) },
  };
}

export interface BiometricAvailability {
  available: boolean;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function isOnboarded(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDED_KEY)) === "true";
}

export async function setOnboarded(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDED_KEY, "true");
}
