# Data model

Five tables, defined in [`src/db/schema.ts`](../../src/db/schema.ts). All primary keys are UUID strings (`newId()` from `src/repositories/ids.ts`). All money is integer paisa. All timestamps are UTC ISO strings (`nowIso()`).

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
| size | text? | S/M/L/XL/XXL/custom |
| color | text? | must be one of the garment palette labels — see below |
| quantity | int | default 1 |
| rate | int (paisa) | per unit |
| amount | int (paisa) | = quantity × rate |
| description | text | auto-generated (see below) unless `descriptionTouched` |
| descriptionTouched | bool | set once the user manually edits the description, to stop auto-regeneration overwriting it |

**Line items have no `isDeleted` column** — they're only ever meaningful in the context of their parent entry, which is what carries the soft-delete flag. When a bill is edited (`updateEntry()` in [`entryRepository.ts`](../../src/repositories/entryRepository.ts)) and a line is removed, that row is genuinely `DELETE`d — this is the one exception to the "deletes are soft" rule in [`architecture.md`](architecture.md), which only applies to `customers` and `entries` rows. The line's own history isn't lost, though: every add/edit/remove still writes an `audit_log` row (`entity: "line_item"`) keyed by the line's id, same as any other mutation.

### Auto-generated description (spec 7.3)
`generateLineItemDescription()` in [`src/repositories/description.ts`](../../src/repositories/description.ts).

Format: `{quantity}x {color} {item_name} ({size})` — empty parts dropped gracefully.
Examples: `1x Navy Blue Lawn Kurta (M)`, `3x Maroon Cotton Shalwar (XL)`, `2x White Kameez` (no size).

Regenerate whenever name/size/color/quantity changes, **unless** `descriptionTouched` is true (user has manually edited the text).

### Garment color palette (spec 7.4)
Fixed swatch set in [`src/theme/colors.ts`](../../src/theme/colors.ts) (`GARMENT_COLORS`). Store the label string on `line_items.color`; render the swatch from the hex map. Don't accept freeform color text in the color picker UI — it must be one of these 14 labels (White, Black, Navy Blue, Sky Blue, Maroon, Red, Bottle Green, Mustard, Beige, Grey, Pink, Purple, Brown, Off-White/Cream).

## audit_log
Every create/edit/delete on a customer, entry, or line_item writes a row here — this is what lets a customer be shown proof nothing was tampered with.
| field | type | notes |
|---|---|---|
| id | uuid | PK |
| entity | `customer` \| `entry` \| `line_item` | |
| entityId | uuid | the affected record |
| action | `create` \| `edit` \| `delete` | |
| diff | json? | old → new values for changed fields only (`buildDiff()`) |
| actor | `owner` \| `helper` | who did it |
| createdAt | timestamp | |

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
