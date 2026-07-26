import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { customers, entries as entriesTable } from "../db/schema";
import type { Customer, IsoTimestamp, Paisa } from "../types/models";
import { buildDiff, logAudit } from "./auditRepository";
import { computeBalanceFromEntries } from "./balance";
import { newId, nowIso } from "./ids";

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  photoUri?: string | null;
  address?: string | null;
  openingBalance?: Paisa;
}

export async function createCustomer(
  db: Database,
  input: CreateCustomerInput,
): Promise<Customer> {
  const timestamp = nowIso();
  const row = {
    id: newId(),
    name: input.name,
    phone: input.phone ?? null,
    photoUri: input.photoUri ?? null,
    address: input.address ?? null,
    openingBalance: input.openingBalance ?? 0,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.insert(customers).values(row);
  await logAudit(db, { entity: "customer", entityId: row.id, action: "create" });

  return row;
}

export async function listCustomers(
  db: Database,
  options: { includeArchived?: boolean } = {},
): Promise<Customer[]> {
  const rows = await db.select().from(customers);
  return rows.filter((row) => options.includeArchived || !row.isArchived);
}

export interface CustomerWithBalance extends Customer {
  balance: Paisa;
  /** Latest non-deleted entry's createdAt, falling back to the customer's own updatedAt. */
  lastActivityAt: IsoTimestamp;
}

export type CustomerSort = "balance" | "recent";

/** Customer list with recomputed balance + last-activity date, for the list/search/sort screen. */
export async function listCustomersWithBalance(
  db: Database,
  options: { includeArchived?: boolean; sort?: CustomerSort } = {},
): Promise<CustomerWithBalance[]> {
  const customerRows = await listCustomers(db, options);

  const entryRows = await db
    .select({
      customerId: entriesTable.customerId,
      direction: entriesTable.direction,
      amount: entriesTable.amount,
      createdAt: entriesTable.createdAt,
    })
    .from(entriesTable)
    .where(eq(entriesTable.isDeleted, false));

  const entriesByCustomer = new Map<string, typeof entryRows>();
  for (const row of entryRows) {
    const list = entriesByCustomer.get(row.customerId);
    if (list) {
      list.push(row);
    } else {
      entriesByCustomer.set(row.customerId, [row]);
    }
  }

  const withBalance = customerRows.map((customer) => {
    const customerEntries = entriesByCustomer.get(customer.id) ?? [];
    const balance = computeBalanceFromEntries(customer.openingBalance, customerEntries);
    const lastActivityAt = customerEntries.reduce(
      (latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest),
      customer.updatedAt,
    );
    return { ...customer, balance, lastActivityAt };
  });

  const sort = options.sort ?? "recent";
  return withBalance.sort((a, b) =>
    sort === "balance"
      ? Math.abs(b.balance) - Math.abs(a.balance)
      : b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
}

export async function getCustomer(
  db: Database,
  id: string,
): Promise<Customer | null> {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type UpdateCustomerInput = Partial<
  Pick<Customer, "name" | "phone" | "photoUri" | "address" | "openingBalance">
>;

export async function updateCustomer(
  db: Database,
  id: string,
  patch: UpdateCustomerInput,
): Promise<Customer> {
  const before = await getCustomer(db, id);
  if (!before) {
    throw new Error(`Customer not found: ${id}`);
  }

  const updatedAt = nowIso();
  await db
    .update(customers)
    .set({ ...patch, updatedAt })
    .where(eq(customers.id, id));

  const diff = buildDiff(before, patch);
  if (Object.keys(diff).length > 0) {
    await logAudit(db, { entity: "customer", entityId: id, action: "edit", diff });
  }

  return { ...before, ...patch, updatedAt };
}

/** True if the customer has ever had an entry recorded (regardless of that entry's own soft-delete state). */
export async function customerHasEntries(db: Database, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(eq(entriesTable.customerId, id))
    .limit(1);
  return rows.length > 0;
}

/**
 * Permanently removes a customer — the one exception to "deletes are soft" (data-model.md),
 * allowed only when the customer has zero entries and so has no ledger history to protect.
 * Callers must archive instead (`setCustomerArchived`) once a customer has any entries.
 */
export async function deleteCustomer(db: Database, id: string): Promise<void> {
  const before = await getCustomer(db, id);
  if (!before) {
    throw new Error(`Customer not found: ${id}`);
  }
  if (await customerHasEntries(db, id)) {
    throw new Error(
      "Cannot permanently delete a customer with existing entries — archive instead.",
    );
  }

  await db.delete(customers).where(eq(customers.id, id));
  await logAudit(db, { entity: "customer", entityId: id, action: "delete" });
}

/** Soft-hide a customer without losing their entry history. */
export async function setCustomerArchived(
  db: Database,
  id: string,
  isArchived: boolean,
): Promise<void> {
  const before = await getCustomer(db, id);
  if (!before) {
    throw new Error(`Customer not found: ${id}`);
  }

  await db
    .update(customers)
    .set({ isArchived, updatedAt: nowIso() })
    .where(eq(customers.id, id));

  await logAudit(db, {
    entity: "customer",
    entityId: id,
    action: "edit",
    diff: buildDiff(before, { isArchived }),
  });
}
