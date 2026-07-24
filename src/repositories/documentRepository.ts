import type { Database } from "../db/client";
import type { Customer, Paisa, Settings } from "../types/models";
import { computeBalanceFromEntries } from "./balance";
import { getCustomer } from "./customerRepository";
import type { EntryWithLineItems } from "./entryRepository";
import { getEntry, listEntriesForCustomer } from "./entryRepository";
import { nowIso } from "./ids";
import { getSettings } from "./settingsRepository";

/** Everything a single-bill PDF / share message needs, assembled from the repositories. */
export interface BillDocumentData {
  settings: Settings;
  customer: Customer;
  entry: EntryWithLineItems;
  /** Balance excluding this entry (i.e. what it was before this bill was recorded). */
  previousBalance: Paisa;
  /** Balance including this entry. */
  currentBalance: Paisa;
  lastActivityDate: string;
}

export interface StatementRow {
  entry: EntryWithLineItems;
  /** Running balance after this entry, oldest-to-newest. */
  runningBalance: Paisa;
}

/** Everything a full-statement PDF / share message needs. */
export interface StatementDocumentData {
  settings: Settings;
  customer: Customer;
  openingBalance: Paisa;
  /** Oldest-first, each carrying the running balance up to and including it. */
  rows: StatementRow[];
  currentBalance: Paisa;
  generatedAt: string;
}

function signedAmount(entry: { direction: "cash_out" | "cash_in"; amount: Paisa }): Paisa {
  return entry.direction === "cash_out" ? entry.amount : -entry.amount;
}

export async function getBillDocumentData(
  db: Database,
  entryId: string,
): Promise<BillDocumentData | null> {
  const entry = await getEntry(db, entryId);
  if (!entry) return null;

  const [customer, settings, allEntries] = await Promise.all([
    getCustomer(db, entry.customerId),
    getSettings(db),
    listEntriesForCustomer(db, entry.customerId),
  ]);
  if (!customer) return null;

  const currentBalance = computeBalanceFromEntries(customer.openingBalance, allEntries);
  const previousBalance = currentBalance - signedAmount(entry);
  const lastActivityDate = allEntries.reduce(
    (latest, e) => (e.entryDate > latest ? e.entryDate : latest),
    entry.entryDate,
  );

  return { settings, customer, entry, previousBalance, currentBalance, lastActivityDate };
}

export async function getStatementDocumentData(
  db: Database,
  customerId: string,
): Promise<StatementDocumentData | null> {
  const [customer, settings, entries] = await Promise.all([
    getCustomer(db, customerId),
    getSettings(db),
    listEntriesForCustomer(db, customerId),
  ]);
  if (!customer) return null;

  // listEntriesForCustomer returns newest-first; a statement reads oldest-first with a running balance.
  const chronological = [...entries].reverse();
  let running = customer.openingBalance;
  const rows: StatementRow[] = chronological.map((entry) => {
    running += signedAmount(entry);
    return { entry, runningBalance: running };
  });

  return {
    settings,
    customer,
    openingBalance: customer.openingBalance,
    rows,
    currentBalance: running,
    generatedAt: nowIso(),
  };
}
