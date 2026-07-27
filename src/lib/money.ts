import type { Paisa } from "../types/models";

/**
 * Converts integer paisa to a display string, e.g. 123456 -> "Rs 1,234.56".
 * Pure integer math throughout (no float division) to avoid rounding drift.
 * Whole-rupee amounts (the overwhelming majority) drop the ".00" — the decimal
 * only shows up when a real paisa remainder exists, matching the reference designs.
 */
export function formatMoney(amount: Paisa, currencySymbol: string): string {
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);
  const rupees = Math.trunc(absAmount / 100);
  const paisaRemainder = absAmount % 100;
  const decimals = paisaRemainder === 0 ? "" : `.${String(paisaRemainder).padStart(2, "0")}`;
  return `${sign}${currencySymbol} ${rupees.toLocaleString("en-IN")}${decimals}`;
}

/**
 * Paisa -> plain editable decimal string (no currency symbol/grouping), e.g. 150050 -> "1500.50".
 * Whole-rupee amounts drop the decimal entirely (e.g. 650000 -> "6500"), same rule as `formatMoney`.
 */
export function formatMoneyInput(amount: Paisa): string {
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);
  const rupees = Math.trunc(absAmount / 100);
  const paisaRemainder = absAmount % 100;
  const decimals = paisaRemainder === 0 ? "" : `.${String(paisaRemainder).padStart(2, "0")}`;
  return `${sign}${rupees}${decimals}`;
}

/** Parses a user-typed decimal string into integer paisa via string math only — never float multiplication. */
export function parseMoneyInput(text: string): Paisa {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^-/, "").replace(/[^0-9.]/g, "");
  const [wholePart, fracPartRaw] = unsigned.split(".");
  const fracPart = `${fracPartRaw ?? ""}00`.slice(0, 2);

  const whole = wholePart ? parseInt(wholePart, 10) : 0;
  const frac = parseInt(fracPart, 10);
  const amount = whole * 100 + frac;

  return negative ? -amount : amount;
}
