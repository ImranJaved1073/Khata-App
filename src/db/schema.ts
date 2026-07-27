import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Five tables per the product spec's data model (section 6).
 * All primary keys are UUID strings. All money is stored as integer paisa/cents.
 * All timestamps are UTC ISO strings.
 */

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  photoUri: text("photo_uri"),
  address: text("address"),
  openingBalance: integer("opening_balance").notNull().default(0),
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  /** 'cash_out' = credit given (they owe more); 'cash_in' = payment received (they owe less). */
  direction: text("direction", { enum: ["cash_out", "cash_in"] }).notNull(),
  /** 'bill' has line_items; 'simple' is amount-only. */
  type: text("type", { enum: ["bill", "simple"] }).notNull(),
  entryDate: text("entry_date").notNull(),
  /** For bills, this is derived from the sum of line item amounts (stored for speed). */
  amount: integer("amount").notNull(),
  note: text("note"),
  attachmentUri: text("attachment_uri"),
  isDeleted: integer("is_deleted", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const lineItems = sqliteTable("line_items", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => entries.id),
  itemName: text("item_name").notNull(),
  size: text("size"),
  color: text("color"),
  quantity: integer("quantity").notNull().default(1),
  rate: integer("rate").notNull(),
  amount: integer("amount").notNull(),
  /** Auto-generated from name + size + color (spec 7.3) unless descriptionTouched. */
  description: text("description").notNull(),
  descriptionTouched: integer("description_touched", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  entity: text("entity", {
    enum: ["customer", "entry", "line_item"],
  }).notNull(),
  entityId: text("entity_id").notNull(),
  /** Parent entry id for `entity: "line_item"` rows — line items are hard-deleted from `line_items` on bill edit, so this is the only way to find a removed line's history once it's gone from that table. Null for `customer`/`entry` rows (entityId already identifies them). */
  entryId: text("entry_id"),
  action: text("action", { enum: ["create", "edit", "delete"] }).notNull(),
  /** JSON-stringified old -> new values for changed fields. */
  diff: text("diff"),
  actor: text("actor", { enum: ["owner", "helper"] }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/** Single-row table (id is always 1): business profile, locale, currency, and app lock config. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  businessName: text("business_name"),
  logoUri: text("logo_uri"),
  currencySymbol: text("currency_symbol").notNull().default("Rs"),
  language: text("language", { enum: ["en", "ur"] })
    .notNull()
    .default("en"),
  themeMode: text("theme_mode", { enum: ["system", "light", "dark"] })
    .notNull()
    .default("system"),
  pinHash: text("pin_hash"),
  biometricEnabled: integer("biometric_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  billFooterText: text("bill_footer_text"),
});
