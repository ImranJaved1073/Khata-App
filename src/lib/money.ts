import type { Paisa } from "../types/models";

/**
 * Converts integer paisa to a display string, e.g. 123456 -> "Rs 1,234.56".
 * Pure integer math throughout (no float division) to avoid rounding drift.
 */
export function formatMoney(amount: Paisa, currencySymbol: string): string {
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);
  const rupees = Math.trunc(absAmount / 100);
  const paisaRemainder = absAmount % 100;
  return `${sign}${currencySymbol} ${rupees.toLocaleString("en-IN")}.${String(
    paisaRemainder,
  ).padStart(2, "0")}`;
}
