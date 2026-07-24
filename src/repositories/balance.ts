import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { entries as entriesTable } from "../db/schema";
import type { Paisa } from "../types/models";

/**
 * customer.balance = opening_balance + Σ(cash_out amounts) − Σ(cash_in amounts).
 * The balance is never stored as a truth to edit directly — it is always
 * recomputed from entries so the ledger and the balance can never disagree.
 * Positive = customer owes the shop; negative = shop owes the customer.
 */
export function computeBalanceFromEntries(
  openingBalance: Paisa,
  entryRows: { direction: "cash_out" | "cash_in"; amount: Paisa }[],
): Paisa {
  return entryRows.reduce((balance, entry) => {
    return entry.direction === "cash_out"
      ? balance + entry.amount
      : balance - entry.amount;
  }, openingBalance);
}

export async function computeCustomerBalance(
  db: Database,
  customerId: string,
  openingBalance: Paisa,
): Promise<Paisa> {
  const rows = await db
    .select({
      direction: entriesTable.direction,
      amount: entriesTable.amount,
    })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.customerId, customerId),
        eq(entriesTable.isDeleted, false),
      ),
    );

  return computeBalanceFromEntries(openingBalance, rows);
}
