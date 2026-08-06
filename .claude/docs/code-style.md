# Code style

## TypeScript
- `strict` is on (`tsconfig.json`) — keep it on. No `any`; if a type is genuinely unknown, use `unknown` and narrow it.
- Prefer explicit interfaces for function inputs (`CreateCustomerInput`, `CreateBillEntryInput`, ...) over inline object types once a shape is reused more than once.
- App-facing types live in `src/types/models.ts` and are camelCase. Drizzle table definitions in `src/db/schema.ts` map snake_case DB columns to camelCase JS keys via the second argument to each column builder (`text("photo_uri")` → `photoUri`) — always do this mapping in the schema, never rename in application code.
- Run `npx tsc --noEmit` before considering a change done. It's the project's only enforced gate right now (no test suite yet).

## React / React Native
- Function components only, named exports (`export function HomeScreen()`), not default exports — matches every existing screen/component/navigator.
- No class components, no HOCs unless a library requires one.
- Styles via `StyleSheet.create` at the bottom of the file, referencing `theme` tokens (see [`ui.md`](ui.md)) — never inline style objects with hardcoded numbers/colors.
- One component per file; file name matches the exported component name.

## Repository layer (`src/repositories/`)
This is the only code allowed to import `src/db/client.ts` or `src/db/schema.ts`. Screens and components call repository functions, never the Drizzle `db` object directly — this keeps the door open for a future sync layer without touching UI code.

## Pure helper layer (`src/lib/`)
`src/lib/` holds pure functions and thin wrappers over device APIs (money formatting, document/HTML building, CSV/xlsx building, print/share/file-system plumbing). **`lib/` must never import `db/client.ts`.** Anything that needs data takes it as a plain argument; a repository function does the assembly (e.g. `getBillDocumentData` → `buildBillHtml`, `getExportData` → `buildEntriesCsv`). This keeps formatters unit-testable and side-effect-free, and keeps the db boundary in one place. Types-only imports from `repositories/` into `lib/` are fine (they're erased at compile time and pull in no runtime db dependency).

### Adding a mutation
Every create/edit/delete on a `customer`, `entry`, or `line_item` must call `logAudit()` (`src/repositories/auditRepository.ts`):
- `create` — no diff needed.
- `edit` — build the diff with `buildDiff(before, patch)` and only log if it's non-empty.
- `delete` — soft delete (`isDeleted: true` / `isArchived: true`), never a real `DELETE`. The one exception is `line_items` rows within an edited bill (they have no `isDeleted` column — see [`data-model.md`](data-model.md#line_items)) — those are genuinely deleted, but still get a `logAudit()` "delete" row.

Follow the existing pattern in `customerRepository.ts` (`updateCustomer`, `setCustomerArchived`) for the before/patch/diff/log sequence.

### Money
Every amount is an integer number of paisa. Never introduce a float amount, never do `amount / 100` and store the result, never round with `Math.round(amount * 100) / 100`-style float math. Multiply/divide only for *display* formatting, at the point of rendering.

## i18n
- No hardcoded user-facing strings in components. Add a key to **both** `src/i18n/locales/en.json` and `src/i18n/locales/ur.json` in the same change — an English-only key is an incomplete change, not a follow-up. See [`i18n.md`](i18n.md).

## Naming & structure
- Directories under `src/screens/` match the feature areas in [`ui.md`](ui.md)'s screen table (Home, Customers, Entries, Reports, Settings, Lock).
- Navigation route names and param types live in `src/navigation/types.ts` — update this file, not ad-hoc `useNavigation<any>()` casts, when a screen's params change.
- A screen that navigates into a *different* tab's stack (e.g. Home's "+ New Customer" opening the Customers tab's form) needs a `CompositeNavigationProp` combining its own stack's `NativeStackNavigationProp` with the root `BottomTabNavigationProp<RootTabParamList>` — see `HomeScreen.tsx`. Don't reach for `useNavigation<any>()` for this; the composite type keeps `navigation.navigate("OtherTab", { screen: "OtherScreen" })` fully typed.
- A subcomponent used by only one screen (e.g. `BillLineItemCard.tsx`, used only by `AddItemsScreen`) lives beside that screen in its `src/screens/<Area>/` folder, not in `src/components/`. Reserve `src/components/` for things reused across feature areas (`PlaceholderScreen`, and similar).

## Comments
- Default to none. Only comment the non-obvious: a hidden constraint from the spec (e.g. "balance is never stored — always recomputed"), a workaround, or a rule a reader could plausibly get wrong. Don't comment what the code already says.

## What not to do
- Don't add cloud sync, online payments, or inventory/stock tracking — explicitly out of scope for v1 (spec section 4).
- Don't add a testing framework, CI config, or linter setup unless asked — none exists yet and it's not part of the current phase.
- Don't reach for `AsyncStorage` for anything structured — SQLite via the repository layer is the single source of truth. `expo-secure-store` is reserved for the PIN hash (Phase 6).
