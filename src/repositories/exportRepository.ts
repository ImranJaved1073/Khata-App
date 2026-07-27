import type { Database } from "../db/client";
import type { CustomerWithBalance } from "./customerRepository";
import { listCustomersWithBalance } from "./customerRepository";
import type { EntryWithLineItems } from "./entryRepository";
import { listEntriesForCustomer } from "./entryRepository";
import { nowIso } from "./ids";
import { getSettings } from "./settingsRepository";

function sortByDateDescending(entries: ExportEntry[]): ExportEntry[] {
  return [...entries].sort((a, b) => b.entry.entryDate.localeCompare(a.entry.entryDate));
}

export interface ExportEntry {
  customerName: string;
  entry: EntryWithLineItems;
}

/** Flattened snapshot of the whole ledger, for CSV / Excel export. */
export interface ExportData {
  generatedAt: string;
  currencySymbol: string;
  customers: CustomerWithBalance[];
  entries: ExportEntry[];
}

export async function getExportData(db: Database): Promise<ExportData> {
  const [customers, settings] = await Promise.all([
    listCustomersWithBalance(db, { includeArchived: true }),
    getSettings(db),
  ]);

  const entries: ExportEntry[] = [];
  for (const customer of customers) {
    const customerEntries = await listEntriesForCustomer(db, customer.id);
    for (const entry of customerEntries) {
      entries.push({ customerName: customer.name, entry });
    }
  }

  return {
    generatedAt: nowIso(),
    currencySymbol: settings.currencySymbol,
    customers,
    entries: sortByDateDescending(entries),
  };
}

/** Same shape as `getExportData`, scoped to a single customer — backs the khata screen's "Export statement" action. */
export async function getCustomerExportData(
  db: Database,
  customerId: string,
): Promise<ExportData | null> {
  const [customers, settings, customerEntries] = await Promise.all([
    listCustomersWithBalance(db, { includeArchived: true }),
    getSettings(db),
    listEntriesForCustomer(db, customerId),
  ]);
  const customer = customers.find((row) => row.id === customerId);
  if (!customer) return null;

  return {
    generatedAt: nowIso(),
    currencySymbol: settings.currencySymbol,
    customers: [customer],
    entries: sortByDateDescending(
      customerEntries.map((entry) => ({ customerName: customer.name, entry })),
    ),
  };
}
