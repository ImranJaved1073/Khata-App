import { asc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { customOptions } from "../db/schema";
import type { CustomOptionKind } from "../types/models";
import { newId, nowIso } from "./ids";

/**
 * Freeform colour/category labels the user has typed once (see BillLineItemCard.tsx's "Add as
 * new colour/category" action), remembered so a future line item can pick them from a list
 * instead of retyping — the whole point of this table (data-model.md). Sorted alphabetically
 * (case-insensitive) rather than by recency: once the list grows past a handful of entries,
 * scannability matters more than surfacing the most-recently-typed one first.
 */
async function listCustomOptionLabels(db: Database, kind: CustomOptionKind): Promise<string[]> {
  const rows = await db
    .select({ label: customOptions.label })
    .from(customOptions)
    .where(eq(customOptions.kind, kind))
    .orderBy(asc(customOptions.label));
  return rows.map((row) => row.label);
}

export function listCustomColors(db: Database): Promise<string[]> {
  return listCustomOptionLabels(db, "color");
}

export function listCustomCategories(db: Database): Promise<string[]> {
  return listCustomOptionLabels(db, "category");
}

/**
 * Remembers a freeform label for reuse, deduplicated case-insensitively against both the
 * already-persisted list and a caller-supplied set of "built-in" labels that should never be
 * persisted as a duplicate (the 14-label garment palette / the fixed category presets) — a
 * no-op if the label already exists in either. Not a mutation on customer/entry/line_item data,
 * so this deliberately doesn't go through logAudit() (see code-style.md's mutation pattern) —
 * it's a picker convenience list, not ledger history.
 */
async function addCustomOption(
  db: Database,
  kind: CustomOptionKind,
  label: string,
  builtInLabels: readonly string[],
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;
  const normalized = trimmed.toLowerCase();
  if (builtInLabels.some((known) => known.toLowerCase() === normalized)) return;

  const existing = await listCustomOptionLabels(db, kind);
  if (existing.some((known) => known.toLowerCase() === normalized)) return;

  await db.insert(customOptions).values({
    id: newId(),
    kind,
    label: trimmed,
    createdAt: nowIso(),
  });
}

export function addCustomColor(db: Database, label: string, builtInLabels: readonly string[]): Promise<void> {
  return addCustomOption(db, "color", label, builtInLabels);
}

export function addCustomCategory(db: Database, label: string, builtInLabels: readonly string[]): Promise<void> {
  return addCustomOption(db, "category", label, builtInLabels);
}
