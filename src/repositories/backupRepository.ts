import type { Database } from "../db/client";
import { auditLog, customers, customOptions, entries, lineItems, settings } from "../db/schema";
import { backupToDrive } from "../lib/driveBackup";
import { nowIso } from "./ids";
import { getSettings, updateSettings } from "./settingsRepository";

/**
 * Full-ledger snapshot for backup/restore (Settings screen, Phase 6; Google Drive cloud backup,
 * Phase 7 — same payload shape, just uploaded instead of shared as a file).
 * Bumping BACKUP_VERSION is only needed if the shape below stops matching schema.ts 1:1.
 *
 * v1 -> v2 (2026-08-08): added `customOptions` (the `custom_options` table didn't exist at v1 and
 * had been silently missing from every backup since it was added — a real bug, not a deliberate
 * omission. `isBackupData` still accepts a v1 file missing the field (treated as empty) so old
 * backups keep restoring; only new exports write v2.
 */
export const BACKUP_VERSION = 2;

export interface BackupData {
  version: number;
  exportedAt: string;
  customers: (typeof customers.$inferSelect)[];
  entries: (typeof entries.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect)[];
  auditLog: (typeof auditLog.$inferSelect)[];
  customOptions: (typeof customOptions.$inferSelect)[];
  settings: typeof settings.$inferSelect;
}

export async function getBackupData(db: Database): Promise<BackupData> {
  const [customerRows, entryRows, lineItemRows, auditRows, customOptionRows, settingsRows] =
    await Promise.all([
      db.select().from(customers),
      db.select().from(entries),
      db.select().from(lineItems),
      db.select().from(auditLog),
      db.select().from(customOptions),
      db.select().from(settings),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    customers: customerRows,
    entries: entryRows,
    lineItems: lineItemRows,
    auditLog: auditRows,
    customOptions: customOptionRows,
    settings: settingsRows[0] ?? {
      id: 1,
      businessName: null,
      logoUri: null,
      currencySymbol: "Rs",
      language: "en",
      themeMode: "system",
      pinHash: null,
      biometricEnabled: false,
      billFooterText: null,
      driveConnectedEmail: null,
      driveAutoBackupEnabled: false,
      driveBackupIntervalDays: 1,
      driveLastBackupAt: null,
    },
  };
}

export function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BackupData>;
  return (
    typeof candidate.version === "number" &&
    Array.isArray(candidate.customers) &&
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.lineItems) &&
    Array.isArray(candidate.auditLog) &&
    // Older (v1) backups predate this table entirely — tolerate it being absent rather than
    // rejecting an otherwise-valid backup file.
    (candidate.customOptions === undefined || Array.isArray(candidate.customOptions)) &&
    typeof candidate.settings === "object" &&
    candidate.settings !== null
  );
}

/** Replaces the entire local database with the contents of a backup. Not undoable — callers must confirm with the user first. */
export async function restoreBackupData(db: Database, data: BackupData): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(lineItems);
    await tx.delete(auditLog);
    await tx.delete(entries);
    await tx.delete(customers);
    await tx.delete(customOptions);
    await tx.delete(settings);

    if (data.customers.length > 0) await tx.insert(customers).values(data.customers);
    if (data.entries.length > 0) await tx.insert(entries).values(data.entries);
    if (data.lineItems.length > 0) await tx.insert(lineItems).values(data.lineItems);
    if (data.auditLog.length > 0) await tx.insert(auditLog).values(data.auditLog);
    if (data.customOptions && data.customOptions.length > 0) {
      await tx.insert(customOptions).values(data.customOptions);
    }
    await tx.insert(settings).values(data.settings);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Called from `App.tsx` on every app unlock/foreground (see its `ThemedApp` effect) — silently
 * uploads a fresh backup to Drive if auto-backup is on and `driveBackupIntervalDays` has actually
 * elapsed since the last one. Deliberately swallows any failure rather than surfacing it: this is
 * a best-effort background attempt, not a user-initiated action, and it'll just retry next time
 * the interval re-elapses. A user-initiated "Backup now" in Settings (`backupToDrive` called
 * directly from `SettingsScreen.tsx`) is what shows real success/error feedback.
 */
export async function runAutoDriveBackupIfDue(db: Database): Promise<void> {
  try {
    const current = await getSettings(db);
    if (!current.driveAutoBackupEnabled) return;

    const intervalMs = current.driveBackupIntervalDays * DAY_MS;
    const lastBackupAt = current.driveLastBackupAt ? new Date(current.driveLastBackupAt).getTime() : 0;
    if (Date.now() - lastBackupAt < intervalMs) return;

    const data = await getBackupData(db);
    const result = await backupToDrive(JSON.stringify(data), data.exportedAt);
    if (result.status === "ok") {
      await updateSettings(db, { driveLastBackupAt: data.exportedAt });
    }
  } catch (error) {
    console.error(error);
  }
}
