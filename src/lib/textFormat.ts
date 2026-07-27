/** First letter of up to the first two words, upper-cased, for avatar initials — e.g. "Ayesha Siddiqui" -> "AS". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const second = parts.length > 1 ? parts[1]!.charAt(0) : "";
  return (first + second).toUpperCase();
}
