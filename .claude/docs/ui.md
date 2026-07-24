# UI guidelines

## Who this is for
Primary user: a shop owner, semi-literate in English, comfortable in Urdu, using the app one-handed mid-conversation with a customer. Optimize for large tap targets, minimal typing, and glanceable balance state over dense information or visual flourish.

## Design tokens
Defined in [`src/theme/`](../../src/theme/) — always import from there, never hardcode a hex value or spacing number in a screen/component.

- `theme.colors` (`src/theme/colors.ts`) — semantic app colors (`primary`, `background`, `surface`, `border`, `textPrimary`, `textSecondary`, `danger`, `success`).
- `theme.spacing` — `xs`(4) `sm`(8) `md`(16) `lg`(24) `xl`(32). Use these, not raw numbers.
- `theme.radius`, `theme.typography` — same rule.
- `GARMENT_COLORS` / `GARMENT_COLOR_LABELS` — the fixed 14-color swatch set for the bill line-item color picker (spec 7.4). Never let a user type a freeform color for a line item.

## Balance color coding (non-negotiable, spec B2/C1)
- **Red** (`theme.colors.owesMe`) = customer owes the shop (positive balance).
- **Green** (`theme.colors.iOwe`) = shop owes the customer (negative balance).
- Apply this consistently everywhere a balance appears: customer list rows, the khata balance header, the home dashboard totals, PDF statements.

## Screen-by-screen reference (spec section 9)
| Screen | Key contents |
|---|---|
| Lock screen | PIN pad + biometric prompt. Appears on launch / resume from background. |
| Home / Dashboard | Business header, receivable/payable totals, today's activity, quick "+ New Customer". |
| Customer list | Search bar, sort control, rows (name · balance · last activity), FAB "+". |
| Add/edit customer | Name, phone, photo, address, opening balance. |
| Customer khata (detail) | Big color-coded balance header, entry list newest-first, "+ New Entry", "Share statement". |
| New/edit entry — simple | Direction toggle, amount pad, date, note. |
| New/edit entry — bill ("New Bill") | Line-item editor (7.2): one line open for editing at a time; completed lines collapse to a compact tappable summary row (tap to reopen), live total across collapsed + active lines, note (auto-populated with each line's description, user's own text preserved), attachment, auto descriptions. |
| Entry detail | Full bill view: Share / Edit / History / Delete (Share offers WhatsApp / SMS / PDF — see below). |
| Entry history | Audit timeline for that entry. |
| Reports | Receivable/payable totals, customer & entry counts, export whole ledger to CSV / Excel (.xlsx). Date-range filter is deferred to Phase 7. |
| Settings | Business profile, language (EN/UR), currency, change PIN, biometric toggle, bill footer, backup/restore. |

Bottom tabs: **Home · Customers · Reports · Settings** (`src/navigation/RootNavigator.tsx`). Lock screen is a gate outside the tabs, not a tab.

## RTL (Urdu)
- Language switch flips the whole UI via `I18nManager` (`src/i18n/index.ts` → `setAppLanguage`). Never build a screen that assumes LTR — use `flexDirection: "row"` (which RN mirrors automatically under RTL) rather than manually placing elements left/right with `marginLeft`/`marginRight`; prefer `marginStart`/`marginEnd` and `start`/`end` over `left`/`right` for anything that must mirror correctly.
- Any icon that implies direction (back arrow, chevrons) must visually flip in RTL — React Navigation's stack header handles this automatically; hand-rolled directional icons won't.

## Component conventions
- Screens currently under construction render `<PlaceholderScreen title description />` (`src/components/PlaceholderScreen.tsx`). When you build out a screen for real, delete the placeholder usage — don't leave it as a fallback branch.
- Money is always formatted through a single shared formatter (add one in `src/theme/` or `src/lib/` when the first real money-displaying screen is built) that converts paisa → display string using `settings.currencySymbol`. Never do `amount / 100` inline in a component.
- Empty states matter — this app replaces a paper notebook for a non-technical user. Every list screen needs a real empty state (see `customers.empty` / `khata.empty` translation keys), not a blank screen.

## Sharing & printed documents (spec D1/D3)
- A bill/receipt or a customer statement is turned into a **PDF** (`expo-print`) and/or a **plain-text message** (WhatsApp/SMS deep link, generic-share fallback) by the pure builders in `src/lib/documentFormat.ts`. The PDF layout follows the reference bill design: business header + logo initials, "Billed to" / "Khata reference" boxes, a dark-navy line-item table with color swatches, note-left / totals-right, a dark bill-total bar, a previous-balance → balance-owed box, and a footer. Keep new document types consistent with that shell (`documentStyles()` / `htmlShell()`), and keep balance colors (`owesMe` red / `iOwe` green) consistent with the rest of the app.
- Money in documents/exports still goes through the shared paisa formatters (`formatMoney` for display strings, `formatMoneyInput` for the bare decimal used in spreadsheet cells) — never `amount / 100` inline.
- The Share entry points: `EntryDetailScreen`'s "Share" action button, and `CustomerKhataScreen`'s header share icon ("Share statement"). Both open an action sheet: WhatsApp · SMS · PDF.
