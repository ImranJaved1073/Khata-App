/**
 * Thin REST wrapper over the Google Drive v3 API — plain `fetch`, no Drive SDK dependency, mirroring
 * this app's existing "lib/ is pure functions + thin device/API wrappers" convention (see
 * `documentFormat.ts`/`exportFile.ts`). Every function takes an already-valid access token as an
 * argument (from `googleAuth.ts`'s `getDriveAccessToken()`) rather than knowing how to obtain one
 * itself — this file only knows how to talk to Drive, not how the app authenticates.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/** Every backup this app writes lives inside one Drive folder of this name, created on first backup — mirrors how DigiKhata-style apps keep their backups visible/manageable in the user's own Drive rather than hidden in `appDataFolder`. */
export const DRIVE_BACKUP_FOLDER_NAME = "Khata Backups";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const BACKUP_MIME = "application/json";

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  /** Bytes, as reported by Drive — undefined for very old files Drive hasn't backfilled a size for. */
  size: number | null;
}

async function driveRequest(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Drive API ${response.status}: ${body || response.statusText}`);
  }
  return response;
}

/** Finds this app's backup folder, creating it on first use. Idempotent — safe to call before every backup. */
export async function ensureBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `mimeType='${FOLDER_MIME}' and name='${DRIVE_BACKUP_FOLDER_NAME}' and trashed=false`,
  );
  const listResponse = await driveRequest(
    accessToken,
    `${DRIVE_API}/files?q=${query}&fields=files(id,name)&spaces=drive`,
  );
  const listBody = (await listResponse.json()) as { files: { id: string }[] };
  if (listBody.files.length > 0) return listBody.files[0].id;

  const createResponse = await driveRequest(accessToken, `${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_BACKUP_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const created = (await createResponse.json()) as { id: string };
  return created.id;
}

/** Uploads one backup JSON payload as a new file in the backup folder (never overwrites — each backup is its own dated file, pruned separately by `deleteBackupFile`). */
export async function uploadBackupFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  contents: string,
): Promise<DriveBackupFile> {
  const metadata = { name: fileName, parents: [folderId], mimeType: BACKUP_MIME };
  const boundary = "khata-backup-boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${BACKUP_MIME}\r\n\r\n` +
    `${contents}\r\n` +
    `--${boundary}--`;

  const response = await driveRequest(
    accessToken,
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,createdTime,size`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const created = (await response.json()) as {
    id: string;
    name: string;
    createdTime: string;
    size?: string;
  };
  return {
    id: created.id,
    name: created.name,
    createdTime: created.createdTime,
    size: created.size ? Number(created.size) : null,
  };
}

/** Newest-first list of every backup file currently in the folder. */
export async function listBackupFiles(accessToken: string, folderId: string): Promise<DriveBackupFile[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await driveRequest(
    accessToken,
    `${DRIVE_API}/files?q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc&spaces=drive`,
  );
  const body = (await response.json()) as {
    files: { id: string; name: string; createdTime: string; size?: string }[];
  };
  return body.files.map((file) => ({
    id: file.id,
    name: file.name,
    createdTime: file.createdTime,
    size: file.size ? Number(file.size) : null,
  }));
}

export async function downloadBackupFile(accessToken: string, fileId: string): Promise<string> {
  const response = await driveRequest(accessToken, `${DRIVE_API}/files/${fileId}?alt=media`);
  return response.text();
}

export async function deleteBackupFile(accessToken: string, fileId: string): Promise<void> {
  await driveRequest(accessToken, `${DRIVE_API}/files/${fileId}`, { method: "DELETE" });
}
