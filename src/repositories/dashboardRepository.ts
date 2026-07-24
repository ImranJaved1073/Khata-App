import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { customers, entries as entriesTable } from "../db/schema";
import type { EntryDirection, IsoTimestamp, Paisa } from "../types/models";
import { listCustomersWithBalance } from "./customerRepository";

export interface DashboardTotals {
  totalReceivable: Paisa;
  totalPayable: Paisa;
}

/** Sum of positive balances (customers who owe the shop) vs. negative balances (shop owes them). */
export async function getDashboardTotals(
  db: Database,
): Promise<DashboardTotals> {
  const customersWithBalance = await listCustomersWithBalance(db);

  return customersWithBalance.reduce<DashboardTotals>(
    (totals, customer) => {
      if (customer.balance > 0) {
        totals.totalReceivable += customer.balance;
      } else if (customer.balance < 0) {
        totals.totalPayable += -customer.balance;
      }
      return totals;
    },
    { totalReceivable: 0, totalPayable: 0 },
  );
}

export interface TodaysEntry {
  id: string;
  customerId: string;
  customerName: string;
  direction: EntryDirection;
  amount: Paisa;
  entryDate: string;
  createdAt: IsoTimestamp;
}

export async function listTodaysEntries(
  db: Database,
  date: string,
): Promise<TodaysEntry[]> {
  return db
    .select({
      id: entriesTable.id,
      customerId: entriesTable.customerId,
      customerName: customers.name,
      direction: entriesTable.direction,
      amount: entriesTable.amount,
      entryDate: entriesTable.entryDate,
      createdAt: entriesTable.createdAt,
    })
    .from(entriesTable)
    .innerJoin(customers, eq(entriesTable.customerId, customers.id))
    .where(
      and(eq(entriesTable.entryDate, date), eq(entriesTable.isDeleted, false)),
    )
    .orderBy(desc(entriesTable.createdAt));
}
