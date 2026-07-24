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
function shortRef(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
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
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: ${colors.textPrimary}; margin: 0; padding: 24px; font-size: 12px; }
    .card { border: 1px solid ${colors.border}; border-radius: 8px; padding: 28px; max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; border-bottom: 1px solid ${colors.border}; padding-bottom: 20px; }
    .brand { display: flex; gap: 14px; }
    .logo { width: 56px; height: 56px; border: 1px solid ${colors.primary}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${colors.primary}; font-size: 18px; overflow: hidden; }
    .logo img { width: 100%; height: 100%; object-fit: cover; }
    .business-name { font-size: 20px; font-weight: 700; }
    .muted { color: ${colors.textSecondary}; }
    .doc-side { text-align: right; }
    .doc-type { color: ${colors.primary}; letter-spacing: 3px; font-weight: 600; }
    .doc-number { font-size: 18px; font-weight: 700; margin-top: 2px; }
    .meta { color: ${colors.textSecondary}; margin-top: 8px; line-height: 1.6; }
    .parties { display: flex; gap: 16px; margin-top: 20px; }
    .party { flex: 1; border: 1px solid ${colors.border}; border-radius: 8px; padding: 14px; }
    .party-label { color: ${colors.primary}; letter-spacing: 1px; font-size: 10px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
    .party-name { font-weight: 700; font-size: 14px; }
    .party-line { color: ${colors.textSecondary}; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    thead th { background: ${colors.primary}; color: #fff; text-align: left; padding: 10px 12px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
    thead th.num { text-align: right; }
    tbody td { padding: 12px; border-bottom: 1px solid ${colors.border}; vertical-align: top; }
    tbody tr:nth-child(even) { background: ${colors.surface}; }
    .item-desc { font-weight: 700; }
    .item-sub { color: ${colors.textSecondary}; margin-top: 3px; }
    .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; border: 1px solid ${colors.border}; vertical-align: middle; margin-right: 5px; }
    td.num { text-align: right; white-space: nowrap; }
    .idx { color: ${colors.primary}; }
    .totals-wrap { display: flex; justify-content: space-between; margin-top: 20px; gap: 24px; }
    .note { flex: 1; }
    .note-label { color: ${colors.primary}; font-size: 10px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
    .note-text { color: ${colors.textSecondary}; line-height: 1.5; white-space: pre-line; }
    .totals { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .bill-total { display: flex; justify-content: space-between; background: ${colors.primary}; color: #fff; padding: 12px 14px; border-radius: 4px; font-weight: 700; font-size: 16px; margin-top: 6px; }
    .balance-box { border: 1px solid ${colors.primary}; border-radius: 6px; padding: 12px 14px; margin-top: 14px; }
    .balance-owed { display: flex; justify-content: space-between; border-top: 1px solid ${colors.border}; padding-top: 8px; margin-top: 8px; font-weight: 700; font-size: 15px; }
    .owes { color: ${colors.owesMe}; }
    .credit { color: ${colors.iOwe}; }
    .footer { margin-top: 28px; border-top: 1px solid ${colors.border}; padding-top: 14px; }
    .footer-thanks { font-weight: 700; }
    .footer-fine { color: ${colors.textSecondary}; margin-top: 6px; font-size: 10px; line-height: 1.5; }
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
  const directionLabel = isCashOut ? "Cash out · Credit" : "Cash in · Payment";

  const header = `
    <div class="header">
      <div class="brand">
        ${logoCell({ logoUri: settings.logoUri, name: businessName })}
        <div>
          <div class="business-name">${escapeHtml(businessName)}</div>
          ${settings.billFooterText ? `<div class="muted">${escapeHtml(settings.billFooterText)}</div>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <div class="doc-type">${entry.type === "bill" ? "BILL" : "RECEIPT"}</div>
        <div class="doc-number">#${shortRef(entry.id)}</div>
        <div class="meta">
          Date&nbsp; ${formatDisplayDate(entry.entryDate)}<br/>
          Entry&nbsp; ${directionLabel}
        </div>
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
        <div class="party-name">Customer #${shortRef(customer.id)}</div>
        <div class="party-line">Ledger opened&nbsp; ${formatDisplayDate(customer.createdAt)}</div>
        <div class="party-line">Last activity&nbsp; ${formatDisplayDate(data.lastActivityDate)}</div>
      </div>
    </div>`;

  const rows =
    entry.type === "bill"
      ? entry.lineItems
          .map((item, index) => {
            const hex = swatchHex(item.color);
            const sub = lineSubDescriptor(item);
            return `
        <tr>
          <td class="idx">${index + 1}</td>
          <td>
            <div class="item-desc">${escapeHtml(item.description)}</div>
            ${sub ? `<div class="item-sub">${hex ? `<span class="swatch" style="background:${hex}"></span>` : ""}${escapeHtml(sub)}</div>` : ""}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatMoney(item.rate, currency)}</td>
          <td class="num">${formatMoney(item.amount, currency)}</td>
        </tr>`;
          })
          .join("")
      : `
        <tr>
          <td class="idx">1</td>
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
          <th>#</th>
          <th>Item description</th>
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
  const thisBillSign = isCashOut ? "+" : "−";
  const thisBillLabel = entry.type === "bill" ? "This bill (credit)" : isCashOut ? "This entry (credit)" : "This entry (payment)";

  const totals = `
    <div class="totals-wrap">
      <div class="note">
        ${entry.note ? `<div class="note-label">Note</div><div class="note-text">${escapeHtml(entry.note)}</div>` : ""}
      </div>
      <div class="totals">
        <div class="totals-row"><span class="muted">Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})</span><span>${formatMoney(entry.amount, currency)}</span></div>
        <div class="bill-total"><span>Bill total</span><span>${formatMoney(entry.amount, currency)}</span></div>
        <div class="balance-box">
          <div class="totals-row"><span class="muted">Previous balance</span><span>${formatMoney(data.previousBalance, currency)}</span></div>
          <div class="totals-row"><span class="muted">${thisBillLabel}</span><span>${thisBillSign} ${formatMoney(entry.amount, currency)}</span></div>
          <div class="balance-owed"><span>Balance owed</span><span class="${balanceClass}">${formatMoney(balanceOwed, currency)}</span></div>
        </div>
      </div>
    </div>`;

  const footer = `
    <div class="footer">
      ${settings.billFooterText ? `<div class="footer-thanks">${escapeHtml(settings.billFooterText)}</div>` : `<div class="footer-thanks">Thank you for your business.</div>`}
      <div class="footer-fine">This is a computer-generated ledger bill. Every entry is recorded with full change history; errors are reversible within the khata.</div>
    </div>`;

  return htmlShell(documentStyles(), header + parties + table + totals + footer);
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
          <div class="muted">Account statement</div>
        </div>
      </div>
      <div class="doc-side">
        <div class="doc-type">STATEMENT</div>
        <div class="doc-number">#${shortRef(customer.id)}</div>
        <div class="meta">Generated&nbsp; ${formatDisplayDate(data.generatedAt)}</div>
      </div>
    </div>`;

  const parties = `
    <div class="parties">
      <div class="party">
        <div class="party-label">Customer</div>
        <div class="party-name">${escapeHtml(customer.name)}</div>
        ${customer.phone ? `<div class="party-line">${escapeHtml(customer.phone)}</div>` : ""}
        ${customer.address ? `<div class="party-line">${escapeHtml(customer.address)}</div>` : ""}
      </div>
      <div class="party">
        <div class="party-label">Ledger</div>
        <div class="party-line">Opened&nbsp; ${formatDisplayDate(customer.createdAt)}</div>
        <div class="party-line">Opening balance&nbsp; ${formatMoney(data.openingBalance, currency)}</div>
        <div class="party-line">Entries&nbsp; ${rows.length}</div>
      </div>
    </div>`;

  const bodyRows = rows
    .map((row) => {
      const isCashOut = row.entry.direction === "cash_out";
      const label =
        row.entry.type === "bill"
          ? `Bill #${shortRef(row.entry.id)} (${row.entry.lineItems.length} item${row.entry.lineItems.length === 1 ? "" : "s"})`
          : isCashOut
            ? "Gave on credit"
            : "Payment received";
      return `
        <tr>
          <td>${formatDisplayDate(row.entry.entryDate)}</td>
          <td>${escapeHtml(label)}</td>
          <td class="num">${isCashOut ? formatMoney(row.entry.amount, currency) : ""}</td>
          <td class="num">${!isCashOut ? formatMoney(row.entry.amount, currency) : ""}</td>
          <td class="num">${formatMoney(row.runningBalance, currency)}</td>
        </tr>`;
    })
    .join("");

  const table = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Detail</th>
          <th class="num">Credit given</th>
          <th class="num">Payment</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatDisplayDate(customer.createdAt)}</td>
          <td>Opening balance</td>
          <td class="num"></td>
          <td class="num"></td>
          <td class="num">${formatMoney(data.openingBalance, currency)}</td>
        </tr>
        ${bodyRows}
      </tbody>
    </table>`;

  const balanceClass = data.currentBalance > 0 ? "owes" : data.currentBalance < 0 ? "credit" : "";
  const totals = `
    <div class="totals-wrap">
      <div class="note"></div>
      <div class="totals">
        <div class="bill-total"><span>Balance owed</span><span class="${balanceClass}" style="color:#fff">${formatMoney(data.currentBalance, currency)}</span></div>
      </div>
    </div>`;

  const footer = `
    <div class="footer">
      ${settings.billFooterText ? `<div class="footer-thanks">${escapeHtml(settings.billFooterText)}</div>` : `<div class="footer-thanks">Thank you for your business.</div>`}
      <div class="footer-fine">This is a computer-generated statement. Every entry is recorded with full change history; errors are reversible within the khata.</div>
    </div>`;

  return htmlShell(documentStyles(), header + parties + table + totals + footer);
}

export function buildStatementText(data: StatementDocumentData): string {
  const { settings, customer, rows } = data;
  const businessName = settings.businessName || DEFAULT_BUSINESS_NAME;
  const currency = settings.currencySymbol;

  const lines: string[] = [];
  lines.push(`*${businessName}* — Statement`);
  lines.push(`${customer.name}`);
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
