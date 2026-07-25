import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export const BACKUP_FILE_NAME = "khata-backup.json";
export const BACKUP_MIME = "application/json";

export type PickBackupResult =
  | { status: "ok"; contents: string }
  | { status: "cancelled" }
  | { status: "not-found" }
  | { status: "unsupported" };

/**
 * Restore has no general-purpose file picker to work with — `expo-document-picker` isn't a
 * dependency, and adding one would need a dev-client rebuild. Android's Storage Access
 * Framework (already part of `expo-file-system`) lets the user grant access to a folder, which
 * we then search for the exact file name the export writes (`BACKUP_FILE_NAME`). iOS has no SAF
 * equivalent, so restore is Android-only until a real file picker is added.
 */
export async function pickBackupFile(): Promise<PickBackupResult> {
  if (Platform.OS !== "android") return { status: "unsupported" };

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return { status: "cancelled" };

  const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(
    permission.directoryUri,
  );
  const backupUri = fileUris.find((uri) => decodeURIComponent(uri).endsWith(BACKUP_FILE_NAME));
  if (!backupUri) return { status: "not-found" };

  const contents = await FileSystem.readAsStringAsync(backupUri, { encoding: "utf8" });
  return { status: "ok", contents };
}
