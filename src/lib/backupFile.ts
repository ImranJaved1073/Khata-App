import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export const BACKUP_FILE_NAME = "khata-backup.json";
export const BACKUP_MIME = "application/json";

export type PickBackupFolderResult =
  | { status: "ok"; directoryUri: string; candidateUris: string[] }
  | { status: "cancelled" }
  | { status: "empty" }
  | { status: "unsupported" };

/**
 * Restore has no general-purpose file picker to work with — `expo-document-picker` isn't a
 * dependency, and adding one would need a dev-client rebuild. Android's Storage Access
 * Framework (already part of `expo-file-system`) lets the user grant access to a folder instead.
 *
 * This used to search that folder for the *exact* name the export writes (`BACKUP_FILE_NAME`)
 * and fail with "not found" otherwise — fragile in practice, since the OS share sheet a user goes
 * through to save the exported file commonly renames it (Drive/Downloads/WhatsApp all append or
 * substitute their own suffix on a save/re-share, e.g. "khata-backup (1).json" or a share-target's
 * own filename). This now just lists every `.json` file in the chosen folder and hands them back —
 * the caller (`isBackupData`-validated in `backupRepository.ts`, orchestrated by `SettingsScreen`)
 * decides which candidate(s) actually parse as a real backup. iOS has no SAF equivalent, so local
 * restore is Android-only until a real file picker is added (Google Drive restore, added
 * alongside this, works on both platforms — see `googleDrive.ts`).
 */
export async function pickBackupFolder(): Promise<PickBackupFolderResult> {
  if (Platform.OS !== "android") return { status: "unsupported" };

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return { status: "cancelled" };

  const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(
    permission.directoryUri,
  );
  const candidateUris = fileUris.filter((uri) => decodeURIComponent(uri).toLowerCase().endsWith(".json"));
  if (candidateUris.length === 0) return { status: "empty" };

  // Exact-name matches (the common case — a file saved straight from this app's own export) sort
  // first, so a caller that just wants "the one obvious match" can use candidateUris[0].
  candidateUris.sort((a, b) => {
    const aExact = decodeURIComponent(a).endsWith(BACKUP_FILE_NAME) ? 0 : 1;
    const bExact = decodeURIComponent(b).endsWith(BACKUP_FILE_NAME) ? 0 : 1;
    return aExact - bExact;
  });

  return { status: "ok", directoryUri: permission.directoryUri, candidateUris };
}

export function readBackupFileContents(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: "utf8" });
}

export function backupFileDisplayName(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const lastSegment = decoded.split("/").pop() ?? decoded;
  return lastSegment;
}
