import type {
  BillDocumentData,
  StatementDocumentData,
} from "../repositories/documentRepository";
import type { EntryWithLineItems } from "../repositories/entryRepository";
import { GARMENT_COLORS, type GarmentColorLabel, colors } from "../theme/colors";
import type { LineItem } from "../types/models";
import { formatMoney } from "./money";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Business identity shown on every receipt/statement header (logo initials + name).
 * Constant until the Settings screen (Phase 6) lets the owner set `settings.businessName`.
 */
const DEFAULT_BUSINESS_NAME = "Master Fashion";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2026-07-24" or a full ISO timestamp -> "24 Jul 2026", without relying on Intl. */
function formatDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const monthName = MONTHS[parseInt(month, 10) - 1] ?? month;
  return `${day} ${monthName} ${year}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const joined = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return joined || "•";
}

/** Stable short human-facing reference derived from a UUID (not stored — display only). */
function shortRef(id: string, prefix = "KH-"): string {
  return `${prefix}${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

function swatchHex(color: string | null): string | null {
  if (!color) return null;
  return GARMENT_COLORS[color as GarmentColorLabel] ?? null;
}

/** color · Size M — parts dropped gracefully, used as the grey sub-line under an item. */
function lineSubDescriptor(item: LineItem): string {
  const parts = [item.color, item.size ? `Size ${item.size}` : null].filter(Boolean) as string[];
  return parts.join(" · ");
}

function totalQuantity(entry: EntryWithLineItems): number {
  return entry.lineItems.reduce((sum, li) => sum + li.quantity, 0);
}

function documentStyles(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: ${colors.textPrimary}; margin: 0; padding: 32px; font-size: 15px; background: ${colors.surface}; }
    .card { background: #fff; border: 1px solid ${colors.border}; border-radius: 16px; overflow: hidden; max-width: 860px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; background: ${colors.primary}; padding: 32px 36px; }
    .brand { display: flex; gap: 18px; align-items: flex-start; }
    .logo { width: 68px; height: 68px; border-radius: 16px; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${colors.primary}; font-size: 22px; overflow: hidden; flex-shrink: 0; }
    .logo img { width: 100%; height: 100%; object-fit: cover; }
    .business-name { font-size: 26px; font-weight: 700; color: #fff; }
    .business-line { color: ${colors.primaryMuted}; margin-top: 5px; font-size: 14px; }
    .doc-side { text-align: right; flex-shrink: 0; }
    .doc-type { color: ${colors.accent}; letter-spacing: 2px; font-weight: 700; font-size: 13px; text-transform: uppercase; }
    .doc-number { font-size: 22px; font-weight: 700; margin-top: 5px; color: #fff; }
    .content { padding: 32px 36px; }
    .muted { color: ${colors.textSecondary}; }
    .parties { display: flex; gap: 18px; }
    .party { flex: 1; background: ${colors.surface}; border-radius: 10px; padding: 18px; }
    .party-label { color: ${colors.textSecondary}; letter-spacing: 1px; font-size: 12px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }
    .party-name { font-weight: 700; font-size: 18px; }
    .party-line { color: ${colors.textSecondary}; margin-top: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; border-radius: 10px; overflow: hidden; }
    thead th { background: ${colors.primary}; color: #fff; text-align: left; padding: 13px 16px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    thead th.num { text-align: right; }
    tbody td { padding: 16px; border-bottom: 1px solid ${colors.border}; vertical-align: top; font-size: 16px; }
    .item-desc { font-weight: 700; }
    .item-sub { color: ${colors.textSecondary}; margin-top: 4px; font-size: 13px; }
    .swatch { width: 13px; height: 13px; border-radius: 50%; display: inline-block; border: 1px solid ${colors.border}; vertical-align: middle; margin-right: 7px; }
    td.num { text-align: right; white-space: nowrap; }
    .totals-wrap { display: flex; justify-content: space-between; margin-top: 24px; gap: 28px; }
    .note { flex: 1; }
    .note-label { color: ${colors.textSecondary}; font-size: 12px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase; margin-bottom: 5px; }
    .note-text { color: ${colors.textSecondary}; line-height: 1.5; white-space: pre-line; font-size: 14px; }
    .totals { width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; }
    .bill-total { display: flex; justify-content: space-between; align-items: center; background: ${colors.primary}; color: #fff; padding: 18px 20px; border-radius: 10px; font-weight: 700; font-size: 20px; margin-top: 8px; }
    .balance-split { display: flex; gap: 14px; margin-top: 16px; }
    .balance-box { flex: 1; border-radius: 10px; padding: 16px 18px; }
    .balance-box-label { color: ${colors.textSecondary}; font-size: 13px; margin-bottom: 5px; }
    .balance-box-amount { font-weight: 700; font-size: 22px; }
    .owes { color: ${colors.owesMe}; }
    .credit { color: ${colors.iOwe}; }
    .footer { margin-top: 32px; border-top: 1px solid ${colors.border}; padding-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; }
    .footer-thanks { font-weight: 600; font-style: italic; font-size: 15px; }
    .footer-fine { color: ${colors.textSecondary}; font-size: 12px; white-space: nowrap; }
  `;
}

function logoCell(data: { logoUri: string | null; name: string }): string {
  if (data.logoUri) {
    return `<div class="logo"><img src="${escapeHtml(data.logoUri)}" /></div>`;
  }
  return `<div class="logo">${escapeHtml(initials(data.name))}</div>`;
}

function htmlShell(styles: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${styles}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Single bill / entry
// ---------------------------------------------------------------------------

export function buildBillHtml(data: BillDocumentData): string {
  const { settings, customer, entry } = data;
  const businessName = settings.businessName || DEFAULT_BUSINESS_NAME;
  const currency = settings.currencySymbol;
  const isCashOut = entry.direction === "cash_out";
  const generatedDate = formatDisplayDate(new Date().toISOString());

  const header = `
    <div class="header">
      <div class="brand">
        ${logoCell({ logoUri: settings.logoUri, name: businessName })}
        <div>
          <div class="business-name">${escapeHtml(businessName)}</div>
          ${settings.billFooterText ? `<div class="business-line">${escapeHtml(settings.billFooterText)}</div>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <div class="doc-type">${entry.type === "bill" ? "BILL" : "RECEIPT"}</div>
        <div class="doc-number">#${shortRef(entry.id)}</div>
      </div>
    </div>`;

  const parties = `
    <div class="parties">
      <div class="party">
        <div class="party-label">Billed to</div>
        <div class="party-name">${escapeHtml(customer.name)}</div>
        ${customer.phone ? `<div class="party-line">${escapeHtml(customer.phone)}</div>` : ""}
        ${customer.address ? `<div class="party-line">${escapeHtml(customer.address)}</div>` : ""}
      </div>
      <div class="party">
        <div class="party-label">Khata reference</div>
        <div class="party-name">${formatDisplayDate(entry.entryDate)}</div>
        <div class="party-line">Customer #${shortRef(customer.id)}</div>
        <div class="party-line">Last activity&nbsp; ${formatDisplayDate(data.lastActivityDate)}</div>
      </div>
    </div>`;

  const rows =
    entry.type === "bill"
      ? entry.lineItems
          .map((item) => {
            const hex = swatchHex(item.color);
            const sub = lineSubDescriptor(item);
            return `
        <tr>
          <td>
            <div class="item-desc">${hex ? `<span class="swatch" style="background:${hex}"></span>` : ""}${escapeHtml(item.description)}</div>
            ${sub ? `<div class="item-sub">${escapeHtml(sub)}</div>` : ""}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatMoney(item.rate, currency)}</td>
          <td class="num">${formatMoney(item.amount, currency)}</td>
        </tr>`;
          })
          .join("")
      : `
        <tr>
          <td><div class="item-desc">${escapeHtml(isCashOut ? "Gave on credit" : "Payment received")}</div>
          ${entry.note ? `<div class="item-sub">${escapeHtml(entry.note)}</div>` : ""}</td>
          <td class="num">1</td>
          <td class="num">${formatMoney(entry.amount, currency)}</td>
          <td class="num">${formatMoney(entry.amount, currency)}</td>
        </tr>`;

  const table = `
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  const itemCount = entry.type === "bill" ? totalQuantity(entry) : 1;
  const balanceOwed = data.currentBalance;
  const balanceClass = balanceOwed > 0 ? "owes" : balanceOwed < 0 ? "credit" : "";
  const balanceBg = balanceOwed > 0 ? colors.owesMeSoft : balanceOwed < 0 ? colors.iOweSoft : colors.surface;

  const totals = `
    <div class="totals-wrap">
      <div class="note">
        ${entry.note ? `<div class="note-label">Note</div><div class="note-text">${escapeHtml(entry.note)}</div>` : ""}
      </div>
      <div class="totals">
        <div class="totals-row"><span class="muted">Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})</span><span>${formatMoney(entry.amount, currency)}</span></div>
        <div class="bill-total"><span>Bill total</span><span>${formatMoney(entry.amount, currency)}</span></div>
      </div>
    </div>
    <div class="balance-split">
      <div class="balance-box" style="background:${colors.surface}">
        <div class="balance-box-label">Previous balance</div>
        <div class="balance-box-amount">${formatMoney(data.previousBalance, currency)}</div>
      </div>
      <div class="balance-box" style="background:${balanceBg}">
        <div class="balance-box-label">Balance owed</div>
        <div class="balance-box-amount ${balanceClass}">${formatMoney(balanceOwed, currency)}</div>
      </div>
    </div>`;

  const footer = `
    <div class="footer">
      ${settings.billFooterText ? `<div class="footer-thanks">${escapeHtml(settings.billFooterText)}</div>` : `<div class="footer-thanks">Thank you for shopping with us!</div>`}
      <div class="footer-fine">Generated by Khata · ${generatedDate}</div>
    </div>`;

  return htmlShell(documentStyles(), header + `<div class="content">` + parties + table + totals + footer + `</div>`);
}

export function buildBillText(data: BillDocumentData): string {
  const { settings, customer, entry } = data;
  const businessName = settings.businessName || DEFAULT_BUSINESS_NAME;
  const currency = settings.currencySymbol;
  const isCashOut = entry.direction === "cash_out";

  const lines: string[] = [];
  lines.push(`*${businessName}*`);
  lines.push(`${entry.type === "bill" ? "Bill" : "Receipt"} #${shortRef(entry.id)} · ${formatDisplayDate(entry.entryDate)}`);
  lines.push("");
  lines.push(`Billed to: ${customer.name}`);
  lines.push("");

  if (entry.type === "bill") {
    for (const item of entry.lineItems) {
      lines.push(`${item.description}  —  ${formatMoney(item.amount, currency)}`);
    }
  } else {
    lines.push(`${isCashOut ? "Gave on credit" : "Payment received"}  —  ${formatMoney(entry.amount, currency)}`);
  }
  lines.push("");
  lines.push(`Bill total: ${formatMoney(entry.amount, currency)}`);
  lines.push(`Previous balance: ${formatMoney(data.previousBalance, currency)}`);
  lines.push(`Balance owed: ${formatMoney(data.currentBalance, currency)}`);

  if (settings.billFooterText) {
    lines.push("");
    lines.push(settings.billFooterText);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full customer statement
// ---------------------------------------------------------------------------

export function buildStatementHtml(data: StatementDocumentData): string {
  const { settings, customer, rows } = data;
  const businessName = settings.businessName || DEFAULT_BUSINESS_NAME;
  const currency = settings.currencySymbol;

  const header = `
    <div class="header">
      <div class="brand">
        ${logoCell({ logoUri: settings.logoUri, name: businessName })}
        <div>
          <div class="business-name">${escapeHtml(businessName)}</div>
          ${settings.billFooterText ? `<div class="business-line">${escapeHtml(settings.billFooterText)}</div>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <div class="doc-type">Ledger statement</div>
        <div class="doc-number">#${shortRef(customer.id, "KH-LS-")}</div>
      </div>
    </div>`;

  const periodStart = formatDisplayDate(data.dateFrom ?? data.openingBalanceDate);
  const periodEnd = formatDisplayDate(data.dateTo ?? data.generatedAt);
  const entriesLabel = `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`;

  const parties = `
    <div class="parties">
      <div class="party">
        <div class="party-label">Account</div>
        <div class="party-name">${escapeHtml(customer.name)}</div>
        ${customer.phone ? `<div class="party-line">${escapeHtml(customer.phone)}</div>` : ""}
      </div>
      <div class="party">
        <div class="party-label">Statement period</div>
        <div class="party-name">${periodStart} – ${periodEnd}</div>
        <div class="party-line">${entriesLabel}</div>
      </div>
    </div>`;

  const openingIsDebit = data.openingBalance > 0;
  const openingDebit = openingIsDebit ? data.openingBalance : 0;
  const openingCredit = !openingIsDebit && data.openingBalance < 0 ? -data.openingBalance : 0;

  const bodyRows = rows
    .map((row) => {
      const isCashOut = row.entry.direction === "cash_out";
      const label =
        row.entry.type === "bill"
          ? `Bill · ${row.entry.lineItems.length} item${row.entry.lineItems.length === 1 ? "" : "s"}`
          : isCashOut
            ? "Cash given"
            : "Cash payment";
      return `
        <tr>
          <td>${formatDisplayDate(row.entry.entryDate)}</td>
          <td>${escapeHtml(label)}</td>
          <td class="num owes">${isCashOut ? formatMoney(row.entry.amount, currency) : "—"}</td>
          <td class="num credit">${!isCashOut ? formatMoney(row.entry.amount, currency) : "—"}</td>
          <td class="num">${formatMoney(row.runningBalance, currency)}</td>
        </tr>`;
    })
    .join("");

  const table = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="num">Debit</th>
          <th class="num">Credit</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatDisplayDate(data.openingBalanceDate)}</td>
          <td>Opening balance</td>
          <td class="num owes">${openingDebit > 0 ? formatMoney(openingDebit, currency) : "—"}</td>
          <td class="num credit">${openingCredit > 0 ? formatMoney(openingCredit, currency) : "—"}</td>
          <td class="num">${formatMoney(data.openingBalance, currency)}</td>
        </tr>
        ${bodyRows}
      </tbody>
    </table>`;

  const debitTotal =
    openingDebit + rows.filter((r) => r.entry.direction === "cash_out").reduce((sum, r) => sum + r.entry.amount, 0);
  const creditTotal =
    openingCredit + rows.filter((r) => r.entry.direction === "cash_in").reduce((sum, r) => sum + r.entry.amount, 0);

  const totals = `
    <div class="balance-split">
      <div class="balance-box" style="background:${colors.owesMeSoft}">
        <div class="balance-box-label">Total debits</div>
        <div class="balance-box-amount owes">${formatMoney(debitTotal, currency)}</div>
      </div>
      <div class="balance-box" style="background:${colors.iOweSoft}">
        <div class="balance-box-label">Total credits</div>
        <div class="balance-box-amount credit">${formatMoney(creditTotal, currency)}</div>
      </div>
    </div>
    <div class="bill-total" style="margin-top:14px"><span>Closing balance owed</span><span>${formatMoney(data.currentBalance, currency)}</span></div>`;

  const footer = `
    <div class="footer">
      ${settings.billFooterText ? `<div class="footer-thanks">${escapeHtml(settings.billFooterText)}</div>` : `<div class="footer-thanks">Please clear dues at your earliest convenience.</div>`}
      <div class="footer-fine">Generated by Khata · ${formatDisplayDate(data.generatedAt)}</div>
    </div>`;

  return htmlShell(documentStyles(), header + `<div class="content">` + parties + table + totals + footer + `</div>`);
}

export function buildStatementText(data: StatementDocumentData): string {
  const { settings, customer, rows } = data;
  const businessName = settings.businessName || DEFAULT_BUSINESS_NAME;
  const currency = settings.currencySymbol;

  const lines: string[] = [];
  lines.push(`*${businessName}* — Statement`);
  lines.push(`${customer.name}`);
  if (data.dateFrom || data.dateTo) {
    lines.push(
      `Period: ${data.dateFrom ? formatDisplayDate(data.dateFrom) : "Start"} – ${data.dateTo ? formatDisplayDate(data.dateTo) : "Today"}`,
    );
  }
  lines.push("");
  lines.push(`Opening balance: ${formatMoney(data.openingBalance, currency)}`);
  for (const row of rows) {
    const isCashOut = row.entry.direction === "cash_out";
    const label =
      row.entry.type === "bill" ? `Bill #${shortRef(row.entry.id)}` : isCashOut ? "Credit" : "Payment";
    const signed = `${isCashOut ? "+" : "−"}${formatMoney(row.entry.amount, currency)}`;
    lines.push(`${formatDisplayDate(row.entry.entryDate)}  ${label}  ${signed}  →  ${formatMoney(row.runningBalance, currency)}`);
  }
  lines.push("");
  lines.push(`Balance owed: ${formatMoney(data.currentBalance, currency)}`);

  if (settings.billFooterText) {
    lines.push("");
    lines.push(settings.billFooterText);
  }
  return lines.join("\n");
}
