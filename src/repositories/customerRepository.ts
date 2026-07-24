import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { customers } from "../db/schema";
import type { Customer, Paisa } from "../types/models";
import { buildDiff, logAudit } from "./auditRepository";
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
