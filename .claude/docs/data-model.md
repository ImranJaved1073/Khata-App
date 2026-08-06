# Data model

Six tables, defined in [`src/db/schema.ts`](../../src/db/schema.ts). All primary keys are UUID strings (`newId()` from `src/repositories/ids.ts`). All money is integer paisa. All timestamps are UTC ISO strings (`nowIso()`).

Schema changes go through Drizzle: edit `src/db/schema.ts`, then run `npx drizzle-kit generate` to produce a new file under `src/db/drizzle/`. Never hand-edit anything in `src/db/drizzle/` — it's generated. See [`skills.md`](skills.md#changing-the-schema).

## customers
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| name | text | required |
| phone | text? | for WhatsApp/SMS |
| photoUri | text? | optional local image |
| address | text? | optional |
| openingBalance | int (paisa) | carried in at customer creation |
| isArchived | bool | soft-hide without deleting history |
| createdAt / updatedAt | timestamp | |

A customer with **zero entries** is the one exception to "customers are never hard-deleted" (see [`architecture.md`](architecture.md)) — `deleteCustomer()` (`customerRepository.ts`) permanently removes it, gated by `customerHasEntries()`. The moment a customer has any entry, only `setCustomerArchived()` applies.

## entries
One movement of money for a customer, at a point in time.
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| customerId | uuid | FK → customers |
| direction | `cash_out` \| `cash_in` | `cash_out` = credit given (they owe more); `cash_in` = payment received (they owe less) |
| type | `bill` \| `simple` | `bill` has line_items; `simple` is amount-only |
| entryDate | date string | business date, editable, defaults to today |
| amount | int (paisa) | for bills, derived from Σ line item amounts (stored for speed, not source of truth) |
| note | text? | free text |
| attachmentUri | text? | optional photo of a paper receipt |
| isDeleted | bool | soft delete — kept for history |
| createdAt / updatedAt | timestamp | |

## line_items
One row on a bill.
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| entryId | uuid | FK → entries |
| itemName | text | e.g. "Lawn Kurta" |
| size | text? | S/M/L/XL/XXL/custom, or several comma-joined (e.g. `"32,34,36"`) for an assorted-size batch line — see below |
| color | text? | one of the garment palette labels, or a freeform custom label — see below |
| quantity | int | default 1 |
| rate | int (paisa) | per unit |
| amount | int (paisa) | = quantity × rate |
| description | text | auto-generated (see below) unless `descriptionTouched` |
| descriptionTouched | bool | set once the user manually edits the description, to stop auto-regeneration overwriting it |

**Line items have no `isDeleted` column** — they're only ever meaningful in the context of their parent entry, which is what carries the soft-delete flag. When a bill is edited (`updateEntry()` in [`entryRepository.ts`](../../src/repositories/entryRepository.ts)) and a line is removed, that row is genuinely `DELETE`d — this is the one exception to the "deletes are soft" rule in [`architecture.md`](architecture.md), which only applies to `customers` and `entries` rows. The line's own history isn't lost, though: every add/edit/remove still writes an `audit_log` row (`entity: "line_item"`) keyed by the line's id, same as any other mutation.

### Auto-generated description (spec 7.3)
`generateLineItemDescription()` in [`src/repositories/description.ts`](../../src/repositories/description.ts).

Format: `{quantity} {color} {item_name} ({size})` — empty parts dropped gracefully. (Revised 2026-08-06, user request — the leading "x" after quantity was dropped app-wide, since this same text is what's shown in the Add Items auto-caption, Entry detail, Khata entries, Bill Saved, the PDF item rows, *and* the WhatsApp/SMS share text; was `{quantity}x {color} {item_name} ({size})` before this pass.)
Examples: `1 Navy Blue Lawn Kurta (M)`, `3 Maroon Cotton Shalwar (XL)`, `2 White Kameez` (no size).

`{size}` is whatever string is on `line_items.size` — the generator itself doesn't know or care whether that's one preset value or several comma-joined ones (see the Multi-select sizes section below), so a batch line with sizes 32/34/36 selected produces `10 Dress Pants (32,34,36)` with no special-casing needed here.

Regenerate whenever name/size/color/quantity changes, **unless** `descriptionTouched` is true (user has manually edited the text).

### Garment color palette (spec 7.4)
Fixed swatch set in [`src/theme/colors.ts`](../../src/theme/colors.ts) (`GARMENT_COLORS`, 14 labels: White, Black, Navy Blue, Sky Blue, Maroon, Red, Bottle Green, Mustard, Beige, Grey, Pink, Purple, Brown, Off-White/Cream). Store the label string on `line_items.color`; render the swatch from the hex map when the label is one of these 14.

**Freeform custom colors are allowed** (revised 2026-07-28, Add Items redesign — a deliberate product decision overriding this rule's original "must be one of these 14 labels" wording). The colour picker on `AddItemsScreen` (`BillLineItemCard.tsx`'s colour dropdown) is a searchable list of the 14 palette labels plus an "Add '{text}' as new colour" action that stores whatever freeform text the user typed. `swatchColorFor()` — moved out of `BillLineItemCard.tsx` into [`src/lib/garmentColor.ts`](../../src/lib/garmentColor.ts) (2026-08-07, so `documentFormat.ts`/`DocumentReceiptImage.tsx` can share it without a `lib/` → `screens/` dependency, see below) — resolves the swatch dot in three tiers: an exact-case match against the 14-label `GARMENT_COLORS` palette, then a case-insensitive lookup against `CSS_NAMED_COLORS` — a hand-rolled table of the ~147 standard CSS/X11 color names (`blue`, `teal`, `maroon`, `turquoise`, ...) — so a common color name typed freeform (e.g. "red") still renders its real color instead of an arbitrary one, and only falls back to a deterministic hash-to-HSL color for a name that matches neither.

Two separate "remembered colors" lists exist, at different scopes:
- **Bill-scoped** — custom colors already used elsewhere in the *current* bill's in-progress `lineItems` are collected (`customColorsInUse()`, `AddItemsScreen.tsx`) and offered as "Used in this bill" chips, so a second line item in the same bill can reuse one in a tap. Not persisted beyond the bill being edited — pure client-side state.
- **App-wide, persisted** (new, 2026-08-07) — the `custom_options` table (below) remembers every freeform colour/category ever added, offered back as "Your colors"/"Your categories" chips on *every future* bill, app-wide, so a shop's own recurring custom colors (or categories) never need retyping. `AddItemsScreen` fetches both lists on mount (`listCustomColors`/`listCustomCategories`, `customOptionsRepository.ts`) and calls `addCustomColor`/`addCustomCategory` whenever the "Add '{text}' as new colour/category" action is taken, deduplicated case-insensitively against both the built-in labels (the 14-palette / the 7 category presets) and whatever's already persisted.

**`swatchColorFor()` is now wired into every place a line item's swatch is rendered**, not just the Add Items editor — the Add Items editor and its collapsed rows, the New Bill summary table, `EntryDetailScreen`, `BillSavedScreen`, the PDF builder (`documentFormat.ts`'s `swatchHex()`, which now just delegates to `swatchColorFor()`), and the WhatsApp receipt image (`DocumentReceiptImage.tsx`, which imports `swatchHex` from `documentFormat.ts`). This closes the gap the previous revision of this doc flagged ("other places... still do a direct `GARMENT_COLORS[color]` lookup and render no swatch for a custom color") — a freeform colour like "red" now renders consistently everywhere a line item appears, not only in the editor.

### Multi-select sizes (2026-08-07)
`BillLineItemCard.tsx`'s size chip row is a toggle, not a single-select: tapping an unselected preset size (named or numeric, depending on the item's category) adds it to the line's selection, tapping a selected one removes it. The selection is stored as a **comma-joined string with no spaces** on `line_items.size` (e.g. `"32,34,36"`), always in the preset list's fixed order regardless of tap order (`selectedSizesFrom()`/`toggleSize()`, `BillLineItemCard.tsx`) — no schema change needed, since `size` was already a plain `text` column. This covers a real garment-shop pattern: one line item as an assorted-size batch (e.g. "10 Dress Pants, sizes 32/34/36 mixed") instead of forcing three separate line items. The "Custom size" freeform box is unchanged — still a single free-text entry, not part of the multi-select toggle. `generateLineItemDescription()` needed no change to support this — it already interpolates `size` into the parentheses as-is, so a multi-select line's description reads `10 Dress Pants (32,34,36)` for free.

## custom_options
Freeform colour/category labels the user has typed once (see above), remembered so a future line item can pick them from a list instead of retyping.
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| kind | `color` \| `category` | |
| label | text | the freeform text as typed |
| createdAt | timestamp | |

Deduplicated case-insensitively at the repository layer (`customOptionsRepository.ts`'s `addCustomColor`/`addCustomCategory`), not via a DB constraint — SQLite `TEXT` columns are case-sensitive by default, and a `COLLATE NOCASE` migration wasn't worth it for a picker-convenience list. Listed alphabetically (case-insensitive), not by recency — once the list grows, scannability matters more than surfacing the newest one first. **Not** a mutation on `customer`/`entry`/`line_item` data, so additions here deliberately don't go through `logAudit()` — this is picker convenience, not ledger history. `category` on `BillLineItemState` (the client-side editor state) is still never persisted to `line_items` itself — only the *label* gets remembered in this table for reuse, same as before.

## audit_log
Every create/edit/delete on a customer, entry, or line_item writes a row here — this is what lets a customer be shown proof nothing was tampered with.
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| entity | `customer` \| `entry` \| `line_item` | |
| entityId | uuid | the affected record |
| entryId | uuid? | parent entry id, set only on `entity: "line_item"` rows — see below |
| action | `create` \| `edit` \| `delete` | |
| diff | json? | old → new values for changed fields only (`buildDiff()`) |
| actor | `owner` \| `helper` | who did it |
| createdAt | timestamp | |

`entryId` exists because `line_items` rows are hard-deleted on a bill edit (see above) — once a line is removed, its id no longer resolves to anything in `line_items`, so its own audit rows are the only surviving record of it. `EntryHistoryScreen` fetches an entry's full line-item history via `listLineItemAuditForEntry(db, entryId)` (`auditRepository.ts`), which filters `audit_log` by `entryId` directly rather than by walking the entry's *current* `lineItems` (which would silently omit any line since deleted). Any future code that needs "every line item that ever existed on this bill" should go through `entryId`, not `entry.lineItems`.

## settings (single row, id = 1)
Business profile, locale, currency, theme, and app-lock config. Always fetched via `getSettings()` (creates the default row on first read) — never query the table directly.
| field | type | notes |
|---|---|---|
| businessName / logoUri / currencySymbol / billFooterText | text? | business profile, edited from `SettingsScreen` |
| language | `en` \| `ur` | set via `setAppLanguage()` (`src/i18n/index.ts`), not written directly |
| themeMode | `system` \| `light` \| `dark` | resolved to a light/dark palette by `ThemeContext` (`Appearance` for `system`); default `system` |
| pinHash | text? | **unused** — a leftover Phase 0 column. The actual PIN is a salted SHA-256 hash stored only in `expo-secure-store` via [`src/lib/appLock.ts`](../../src/lib/appLock.ts), never in SQLite. Don't write to this column. |
| biometricEnabled | bool | the real biometric toggle (unlike `pinHash`, this one is live) — only meaningful once a PIN exists, since biometric unlock supplements the PIN rather than replacing it |

## The one rule that governs the whole app
```
customer.balance = openingBalance + Σ(cash_out amounts) − Σ(cash_in amounts)
```
Implemented in [`src/repositories/balance.ts`](../../src/repositories/balance.ts) (`computeBalanceFromEntries` / `computeCustomerBalance`). The balance is **never stored** as a column you write to directly — it's always recomputed from non-deleted entries. This guarantees the ledger and the balance can never disagree. Positive = customer owes the shop; negative = shop owes the customer.
