/** First letter of up to the first two words, upper-cased, for avatar initials — e.g. "Ayesha Siddiqui" -> "AS". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const second = parts.length > 1 ? parts[1]!.charAt(0) : "";
  return (first + second).toUpperCase();
}

/** Byte count -> "12 KB"/"1.2 MB", for a Drive backup file's size caption. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
