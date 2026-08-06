/**
 * "YYYY-MM-DD" for a Date in **local** time. Never use `date.toISOString().slice(0, 10)` for
 * "today's business date" — `toISOString()` is UTC, so in any timezone ahead of UTC (e.g. PKT,
 * UTC+5) it still reports *yesterday's* date for the first few hours after local midnight (at
 * 1:49 AM PKT on Aug 7, UTC is still ~8:49 PM on Aug 6). This is the single source of truth for
 * "today" used by DateField, new-entry defaults, and the Home/Reports/Khata date-range filters.
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "2:14 PM" from an ISO timestamp, for compact activity-row subtitles. */
export function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export type RelativeDate =
  | { kind: "today"; time: string }
  | { kind: "yesterday" }
  | { kind: "daysAgo"; count: number }
  | { kind: "date"; value: string };

/**
 * Buckets a timestamp into today/yesterday/N-days-ago/absolute-date, glanceable-recency style
 * (spec's "glanceable balance state" applies just as much to recency). Returns a structured
 * value rather than a string — translation happens in the component via t(), same as every
 * other user-facing string in the app.
 */
export function formatRelativeDate(iso: string): RelativeDate {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (dayDiff === 0) return { kind: "today", time: formatTimeOfDay(iso) };
  if (dayDiff === 1) return { kind: "yesterday" };
  if (dayDiff > 1 && dayDiff < 7) return { kind: "daysAgo", count: dayDiff };
  return { kind: "date", value: date.toLocaleDateString() };
}
