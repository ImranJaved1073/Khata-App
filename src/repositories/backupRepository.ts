import type { Database } from "../db/client";
import { auditLog, customers, entries, lineItems, settings } from "../db/schema";
import { nowIso } from "./ids";

/**
 * Full-ledger snapshot for backup/restore (Settings screen, Phase 6).
 * Bumping BACKUP_VERSION is only needed if the shape below stops matching schema.ts 1:1.
 */
export const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  customers: (typeof customers.$inferSelect)[];
  entries: (typeof entries.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect)[];
  auditLog: (typeof auditLog.$inferSelect)[];
  settings: typeof settings.$inferSelect;
}

export async function getBackupData(db: Database): Promise<BackupData> {
  const [customerRows, entryRows, lineItemRows, auditRows, settingsRows] = await Promise.all([
    db.select().from(customers),
    db.select().from(entries),
    db.select().from(lineItems),
    db.select().from(auditLog),
    db.select().from(settings),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    customers: customerRows,
    entries: entryRows,
    lineItems: lineItemRows,
    auditLog: auditRows,
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
    await tx.delete(settings);

    if (data.customers.length > 0) await tx.insert(customers).values(data.customers);
    if (data.entries.length > 0) await tx.insert(entries).values(data.entries);
    if (data.lineItems.length > 0) await tx.insert(lineItems).values(data.lineItems);
    if (data.auditLog.length > 0) await tx.insert(auditLog).values(data.auditLog);
    await tx.insert(settings).values(data.settings);
  });
}
