import type { EntryDirection, Paisa } from "../types/models";

export interface WeeklyChartEntry {
  entryDate: string;
  direction: EntryDirection;
  amount: Paisa;
}

export interface WeeklyChartBucket {
  label: string;
  newReceivable: Paisa;
  collected: Paisa;
}

function toDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Buckets entries into the most recent 3 rolling 7-day windows ending at `dateTo`
 * (or today, if unset) — "Receivable vs collected" (spec's Reports bar chart).
 * `dateFrom`/`dateTo` mirror the screen's existing export date-range filter; entries
 * outside the 21-day window are simply not counted (this chart is a supplementary
 * glance, not the source of truth — the stat cards above it cover the full range).
 */
export function buildWeeklyReceivableVsCollected(
  entries: WeeklyChartEntry[],
  range: { dateFrom?: string; dateTo?: string } = {},
): WeeklyChartBucket[] {
  const end = range.dateTo ? toDate(range.dateTo) : new Date();
  const windowStarts = [addDays(end, -20), addDays(end, -13), addDays(end, -6)];
  const windowEnds = [addDays(end, -14), addDays(end, -7), end];

  const buckets: WeeklyChartBucket[] = windowStarts.map((_, index) => ({
    label: `W${index + 1}`,
    newReceivable: 0,
    collected: 0,
  }));

  for (const entry of entries) {
    const entryTime = toDate(entry.entryDate).getTime();
    for (let i = 0; i < buckets.length; i += 1) {
      if (entryTime >= windowStarts[i].getTime() && entryTime <= windowEnds[i].getTime()) {
        if (entry.direction === "cash_out") {
          buckets[i].newReceivable += entry.amount;
        } else {
          buckets[i].collected += entry.amount;
        }
        break;
      }
    }
  }

  return buckets;
}
