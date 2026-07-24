import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export const CSV_MIME = "text/csv";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Writes a file into the cache directory and opens the OS share sheet for it.
 * Returns false if the cache dir or sharing is unavailable.
 */
export async function writeAndShareFile(params: {
  fileName: string;
  contents: string;
  encoding: "utf8" | "base64";
  mimeType: string;
}): Promise<boolean> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return false;

  const uri = dir + params.fileName;
  await FileSystem.writeAsStringAsync(uri, params.contents, { encoding: params.encoding });

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: params.mimeType, dialogTitle: params.fileName });
  return true;
}
