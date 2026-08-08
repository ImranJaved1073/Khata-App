import { getDriveAccessToken } from "./googleAuth";
import {
  deleteBackupFile,
  downloadBackupFile,
  ensureBackupFolder,
  listBackupFiles,
  uploadBackupFile,
} from "./googleDrive";
import type { DriveBackupFile } from "./googleDrive";

/** How many dated backups to keep in Drive before pruning the oldest — an unbounded daily auto-backup would otherwise grow forever. */
const MAX_KEPT_BACKUPS = 20;

export type DriveResult<T> = { status: "ok"; value: T } | { status: "not-connected" } | { status: "error"; message: string };

function backupFileName(exportedAt: string): string {
  // "2026-08-08T12:34:56.789Z" -> "khata-backup-2026-08-08T123456.json"
  const compact = exportedAt.replace(/[:.]/g, "").replace(/Z$/, "").slice(0, 15);
  return `khata-backup-${compact}.json`;
}

/**
 * Uploads an already-assembled backup JSON payload (from `getBackupData()` +
 * `JSON.stringify`, same as the local-file export) as a new dated file in the user's
 * "Khata Backups" Drive folder, then prunes anything beyond `MAX_KEPT_BACKUPS`. Never overwrites
 * a previous backup — each call adds one, so restoring is always "pick a point in time."
 */
export async function backupToDrive(
  backupJson: string,
  exportedAt: string,
): Promise<DriveResult<DriveBackupFile>> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return { status: "not-connected" };

  try {
    const folderId = await ensureBackupFolder(accessToken);
    const file = await uploadBackupFile(accessToken, folderId, backupFileName(exportedAt), backupJson);
    await pruneOldBackups(accessToken, folderId);
    return { status: "ok", value: file };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

async function pruneOldBackups(accessToken: string, folderId: string): Promise<void> {
  const files = await listBackupFiles(accessToken, folderId);
  const stale = files.slice(MAX_KEPT_BACKUPS);
  for (const file of stale) {
    await deleteBackupFile(accessToken, file.id).catch((error) => console.error(error));
  }
}

export async function listDriveBackups(): Promise<DriveResult<DriveBackupFile[]>> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return { status: "not-connected" };

  try {
    const folderId = await ensureBackupFolder(accessToken);
    const files = await listBackupFiles(accessToken, folderId);
    return { status: "ok", value: files };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function downloadDriveBackup(fileId: string): Promise<DriveResult<string>> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return { status: "not-connected" };

  try {
    const contents = await downloadBackupFile(accessToken, fileId);
    return { status: "ok", value: contents };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
