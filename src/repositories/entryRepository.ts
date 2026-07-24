import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { entries, lineItems } from "../db/schema";
import type {
  Entry,
  EntryDirection,
  LineItem,
  Paisa,
} from "../types/models";
import { logAudit } from "./auditRepository";
import { generateLineItemDescription } from "./description";
import { newId, nowIso } from "./ids";

export interface LineItemInput {
  itemName: string;
  size?: string | null;
  color?: string | null;
  quantity?: number;
  rate: Paisa;
  /** Manual override; when omitted the description is auto-generated (spec 7.3). */
  description?: string;
}

export interface CreateSimpleEntryInput {
  type: "simple";
  customerId: string;
  direction: EntryDirection;
  amount: Paisa;
  entryDate?: string;
  note?: string | null;
  attachmentUri?: string | null;
}

export interface CreateBillEntryInput {
  type: "bill";
  customerId: string;
  direction: EntryDirection;
  lineItems: LineItemInput[];
  entryDate?: string;
  note?: string | null;
  attachmentUri?: string | null;
}

export type CreateEntryInput = CreateSimpleEntryInput | CreateBillEntryInput;

export interface EntryWithLineItems extends Entry {
  lineItems: LineItem[];
}

function buildLineItemRow(entryId: string, input: LineItemInput) {
  const quantity = input.quantity ?? 1;
  const amount = quantity * input.rate;
  const descriptionTouched = Boolean(input.description);
  const description =
    input.description ??
    generateLineItemDescription({
      quantity,
      color: input.color,
      itemName: input.itemName,
      size: input.size,
    });

  return {
    id: newId(),
    entryId,
    itemName: input.itemName,
    size: input.size ?? null,
    color: input.color ?? null,
    quantity,
    rate: input.rate,
    amount,
    description,
    descriptionTouched,
  };
}

/**
 * Creates an entry (simple amount-only, or itemized bill with line items),
 * updating the customer's running balance implicitly (it is always recomputed
 * from entries, never stored) and logging an audit "create" row for the entry
 * and every line item.
 */
export async function createEntry(
  db: Database,
  input: CreateEntryInput,
): Promise<EntryWithLineItems> {
  const timestamp = nowIso();
  const entryDate = input.entryDate ?? timestamp.slice(0, 10);

  const lineItemRows =
    input.type === "bill" ? input.lineItems.map((li) => buildLineItemRow(newId(), li)) : [];

  const amount =
    input.type === "bill"
      ? lineItemRows.reduce((sum, li) => sum + li.amount, 0)
      : input.amount;

  const entryId = newId();
  const entryRow = {
    id: entryId,
    customerId: input.customerId,
    direction: input.direction,
    type: input.type,
    entryDate,
    amount,
    note: input.note ?? null,
    attachmentUri: input.attachmentUri ?? null,
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Line items were pre-built with a placeholder entryId; rebind to the real one.
  const boundLineItems = lineItemRows.map((li) => ({ ...li, entryId }));

  await db.transaction(async (tx) => {
    await tx.insert(entries).values(entryRow);
    if (boundLineItems.length > 0) {
      await tx.insert(lineItems).values(boundLineItems);
    }
  });

  await logAudit(db, { entity: "entry", entityId: entryId, action: "create" });
  for (const li of boundLineItems) {
    await logAudit(db, { entity: "line_item", entityId: li.id, action: "create" });
  }

  return { ...entryRow, lineItems: boundLineItems };
}

export async function listEntriesForCustomer(
  db: Database,
  customerId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<EntryWithLineItems[]> {
  const whereClause = options.includeDeleted
    ? eq(entries.customerId, customerId)
    : and(eq(entries.customerId, customerId), eq(entries.isDeleted, false));

  const entryRows = await db
    .select()
    .from(entries)
    .where(whereClause)
    .orderBy(desc(entries.entryDate), desc(entries.createdAt));

  const results: EntryWithLineItems[] = [];
  for (const entry of entryRows) {
    const items =
      entry.type === "bill"
        ? await db.select().from(lineItems).where(eq(lineItems.entryId, entry.id))
        : [];
    results.push({ ...entry, lineItems: items });
  }

  return results;
}
