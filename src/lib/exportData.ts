import * as XLSX from "xlsx";

import type { EntryWithLineItems } from "../repositories/entryRepository";
import type { ExportData } from "../repositories/exportRepository";
import { formatMoneyInput } from "./money";

const ENTRY_HEADER = ["Customer", "Date", "Type", "Detail", "Credit given", "Payment"];
const CUSTOMER_HEADER = ["Customer", "Phone", "Opening balance", "Current balance"];

function entryDetail(entry: EntryWithLineItems): string {
  if (entry.type === "bill") {
    return entry.lineItems.map((li) => li.description).join("; ");
  }
  return entry.note ?? "";
}

/** paisa -> plain decimal string ("1500.50") via integer math — safe for a spreadsheet cell. */
function decimalString(paisa: number): string {
  return formatMoneyInput(paisa);
}

function creditPayment(entry: EntryWithLineItems): { credit: string; payment: string } {
  const value = decimalString(entry.amount);
  return entry.direction === "cash_out"
    ? { credit: value, payment: "" }
    : { credit: "", payment: value };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildEntriesCsv(data: ExportData): string {
  const rows: string[][] = [ENTRY_HEADER];
  for (const { customerName, entry } of data.entries) {
    const { credit, payment } = creditPayment(entry);
    rows.push([
      customerName,
      entry.entryDate,
      entry.type === "bill" ? "Bill" : entry.direction === "cash_out" ? "Credit" : "Payment",
      entryDetail(entry),
      credit,
      payment,
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function buildWorkbookBase64(data: ExportData): string {
  const entryRows = [
    ENTRY_HEADER,
    ...data.entries.map(({ customerName, entry }) => {
      const { credit, payment } = creditPayment(entry);
      return [
        customerName,
        entry.entryDate,
        entry.type === "bill" ? "Bill" : entry.direction === "cash_out" ? "Credit" : "Payment",
        entryDetail(entry),
        credit ? Number(credit) : "",
        payment ? Number(payment) : "",
      ];
    }),
  ];

  const customerRows = [
    CUSTOMER_HEADER,
    ...data.customers.map((customer) => [
      customer.name,
      customer.phone ?? "",
      Number(decimalString(customer.openingBalance)),
      Number(decimalString(customer.balance)),
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(customerRows), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(entryRows), "Entries");

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

/** e.g. "khata-export-2026-07-25" — safe basename shared by both export formats. */
export function exportBaseName(data: ExportData): string {
  const date = data.generatedAt.slice(0, 10);
  return `khata-export-${date}`;
}
