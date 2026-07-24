/** All money fields are integer paisa/cents — never floats — to avoid rounding errors. */
export type Paisa = number;

/** ISO UTC timestamp string. */
export type IsoTimestamp = string;

export type EntryDirection = "cash_out" | "cash_in";
export type EntryType = "bill" | "simple";
export type AuditEntity = "customer" | "entry" | "line_item";
export type AuditAction = "create" | "edit" | "delete";
export type AppLanguage = "en" | "ur";
export type Actor = "owner" | "helper";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  photoUri: string | null;
  address: string | null;
  openingBalance: Paisa;
  isArchived: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Entry {
  id: string;
  customerId: string;
  direction: EntryDirection;
  type: EntryType;
  entryDate: string;
  /** For bills, this is derived from the sum of line item amounts (stored for speed). */
  amount: Paisa;
  note: string | null;
  attachmentUri: string | null;
  isDeleted: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface LineItem {
  id: string;
  entryId: string;
  itemName: string;
  size: string | null;
  color: string | null;
  quantity: number;
  rate: Paisa;
  amount: Paisa;
  /** Auto-generated from name + size + color (see spec 7.3) unless descriptionTouched. */
  description: string;
  descriptionTouched: boolean;
}

export interface AuditLogEntry {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  /** Old -> new values for changed fields. */
  diff: Record<string, { old: unknown; new: unknown }> | null;
  actor: Actor;
  createdAt: IsoTimestamp;
}

export interface Settings {
  id: number;
  businessName: string | null;
  logoUri: string | null;
  currencySymbol: string;
  language: AppLanguage;
  pinHash: string | null;
  biometricEnabled: boolean;
  billFooterText: string | null;
}
