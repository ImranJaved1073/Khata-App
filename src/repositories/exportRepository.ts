import type { Database } from "../db/client";
import type { CustomerWithBalance } from "./customerRepository";
import { listCustomersWithBalance } from "./customerRepository";
import type { EntryWithLineItems } from "./entryRepository";
import { listEntriesForCustomer } from "./entryRepository";
import { nowIso } from "./ids";
import { getSettings } from "./settingsRepository";

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
  entries.sort((a, b) => b.entry.entryDate.localeCompare(a.entry.entryDate));

  return {
    generatedAt: nowIso(),
    currencySymbol: settings.currencySymbol,
    customers,
    entries,
  };
}
