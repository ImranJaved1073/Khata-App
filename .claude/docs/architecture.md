# Architecture

Source of truth for product scope is [`docs/Khata_app-Guide.pdf`](../../docs/Khata_app-Guide.pdf) (v1.0). This file summarizes the technical decisions derived from it. If the two disagree, the PDF wins — update this file to match, don't silently drift.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React Native + Expo (TypeScript), SDK 57 |
| Local database | SQLite via `expo-sqlite`, `drizzle-orm` for schema/queries, `drizzle-kit` for migrations |
| Navigation | React Navigation — one bottom-tab navigator (`RootNavigator`) wrapping four native-stack navigators |
| i18n | `i18next` + `react-i18next`, resource files in `src/i18n/locales/{en,ur}.json`, `I18nManager` for Urdu RTL |
| App lock | `expo-local-authentication` (biometrics) + salted-hashed PIN in `expo-secure-store` (Phase 6, built — `src/lib/appLock.ts`; lockout after 5 failed attempts (30s), `LockScreen` + `OnboardingScreen` are launch gates outside the tab navigator, re-armed after `RELOCK_AFTER_MS` (2 min) spent backgrounded, not on every brief background→active flicker — Phase 7, spec A2 AC) |
| Theming | `Appearance` API + `src/theme/ThemeContext.tsx` (`ThemeProvider`/`useTheme`), light/dark palettes in `src/theme/colors.ts`, mode (`system`\|`light`\|`dark`) persisted in `settings.themeMode` (Phase 6, built) |
| PDF / share | `expo-print` (bill/statement → PDF), `expo-sharing` + WhatsApp/SMS deep links (Phase 5, built — `src/lib/documentFormat.ts` builds the HTML/text, `src/lib/share.ts` does the print/deep-link/share plumbing) |
| Export | `xlsx` for Excel, hand-rolled CSV writer, saved via `expo-file-system/legacy` then shared (Phase 5, built — `src/lib/exportData.ts` + `src/lib/exportFile.ts`) |

## Why these choices

- **Money is always an integer (paisa/cents), never a float.** Every `amount`, `rate`, `openingBalance` field is `number` but represents whole paisa. Never multiply/divide by 100 with floating point — this is the #1 way to reintroduce the rounding bugs this app exists to eliminate.
- **Balance is never stored as an editable truth.** `customer.balance = openingBalance + Σ(cash_out) − Σ(cash_in)`, always recomputed from `entries` (see [`data-model.md`](data-model.md)). Never add a mutable `balance` column to `customers`.
- **Every mutation writes an audit_log row.** Create/edit/delete on a customer, entry, or line_item is not "done" until `logAudit(...)` has been called for it. See [`skills.md`](skills.md#adding-a-mutation) for the pattern.
- **Deletes are soft.** `entries.is_deleted` hides a row from normal queries but keeps it for history/audit. Never `DELETE FROM` a customer or entry row — with one narrow exception: a customer that has **zero entries** (nothing to protect) can be permanently removed via `deleteCustomer()` (`customerRepository.ts`), still logging an audit `delete` row first. The instant a customer has any entry, only `setCustomerArchived()` (soft-hide) is allowed. `customerHasEntries()` is what callers check to decide which action applies — `CustomerFormScreen`'s single Archive/Delete button switches on it, and `CustomerListScreen`'s long-press context menu's "Delete" option falls back to archiving (with an explanatory message) if the customer turns out to have entries.
- **Offline-first, sync-ready.** No network calls exist in v1. The repository layer (`src/repositories/`) is the only thing screens talk to — it's the seam where a future sync layer would slot in, so don't let screens query the `db` client directly.

## Folder structure

```
src/
  db/            schema.ts (5 Drizzle tables), client.ts (expo-sqlite + drizzle), drizzle/ (generated migrations — don't hand-edit)
  repositories/  the only layer allowed to import db/client.ts or db/schema.ts directly
  types/models.ts  app-facing TS types (camelCase), separate from the DB row shape
  i18n/          i18next bootstrap + en/ur resource files
  theme/         colors.ts (light/dark palettes + garment palette), theme.ts (spacing/typography tokens), ThemeContext.tsx (ThemeProvider/useTheme)
  navigation/    RootNavigator (tabs) + one Stack per tab + types.ts (param lists)
  screens/       one folder per feature area, matching the screens in the PDF's section 9 — plus Lock/ and Onboarding/, which App.tsx renders directly as gates outside the tab navigator
  components/    shared presentational components (incl. ThemeModeSelector, LanguageSelector)
  lib/           pure, db-free helpers: money.ts (paisa formatting), documentFormat.ts (bill/statement HTML+text), share.ts (print/deep-link/share), exportData.ts (CSV/xlsx builders), exportFile.ts (write+share a file), appLock.ts (PIN hash/lockout/biometric, wraps expo-secure-store + expo-local-authentication), backupFile.ts (backup JSON share + Android SAF restore pick)
```

`lib/` holds pure functions and thin wrappers over device APIs (print, sharing, file-system, secure-store, biometrics). It never imports `db/client.ts` — anything needing data takes it as an argument, assembled by a repository function (e.g. `getBillDocumentData`, `getExportData`, `getBackupData`).

## Build roadmap (phase order)

Build in this order — each phase should be independently runnable before starting the next. Full detail and status: [`roadmap.md`](roadmap.md).

0. Foundation (done) — nav shell, i18n, schema, repository layer
1. Customers (done) — list/search/add/edit/archive
2. Entries & running balance (done) — khata screen, simple cash in/out, home dashboard
3. Itemized bills (done) — the core interaction (line items, auto-description, garment palette)
4. Edit, delete & history (done) — audit trail wired through every mutation
5. Sharing & export (done) — WhatsApp/SMS, PDF, Excel/CSV
6. Security & onboarding (done) — PIN/biometric lock, first-run setup wizard, Settings screen, light/dark/system theming
7. Polish & release — empty states, accessibility, store builds
