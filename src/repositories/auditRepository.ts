import { desc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { auditLog } from "../db/schema";
import type { AuditAction, AuditEntity, AuditLogEntry, Actor } from "../types/models";
import { newId, nowIso } from "./ids";

export type FieldDiff = Record<string, { old: unknown; new: unknown }>;

/** Every create/edit/delete on a customer, entry, or line item writes a row here. */
export async function logAudit(
  db: Database,
  params: {
    entity: AuditEntity;
    entityId: string;
    action: AuditAction;
    /** Parent entry id — required for `entity: "line_item"` so its history survives the line being hard-deleted from `line_items`. */
    entryId?: string;
    diff?: FieldDiff;
    actor?: Actor;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    id: newId(),
    entity: params.entity,
    entityId: params.entityId,
    entryId: params.entryId ?? null,
    action: params.action,
    diff: params.diff ? JSON.stringify(params.diff) : null,
    actor: params.actor ?? "owner",
    createdAt: nowIso(),
  });
}

function toAuditLogEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entityId,
    entryId: row.entryId,
    action: row.action,
    diff: row.diff ? (JSON.parse(row.diff) as FieldDiff) : null,
    actor: row.actor,
    createdAt: row.createdAt,
  };
}

export async function listAuditForEntity(
  db: Database,
  entity: AuditEntity,
  entityId: string,
): Promise<AuditLogEntry[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, entityId))
    .orderBy(desc(auditLog.createdAt));

  return rows.filter((row) => row.entity === entity).map(toAuditLogEntry);
}

/** All line_item audit rows for an entry, including lines since removed from a bill edit (hard-deleted from `line_items`, but their audit trail is kept via `entryId`). */
export async function listLineItemAuditForEntry(
  db: Database,
  entryId: string,
): Promise<AuditLogEntry[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entryId, entryId))
    .orderBy(desc(auditLog.createdAt));

  return rows.filter((row) => row.entity === "line_item").map(toAuditLogEntry);
}

/** Builds a field-level old->new diff, including only fields that actually changed. */
export function buildDiff<T extends object>(
  before: T,
  after: Partial<T>,
): FieldDiff {
  const diff: FieldDiff = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    const oldValue = before[key];
    const newValue = after[key];
    if (oldValue !== newValue) {
      diff[key as string] = { old: oldValue, new: newValue };
    }
  }
  return diff;
}
