# Architecture

Source of truth for product scope is [`docs/Khata_app-Guide.pdf`](../../docs/Khata_app-Guide.pdf) (v1.0). This file summarizes the technical decisions derived from it. If the two disagree, the PDF wins — update this file to match, don't silently drift.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React Native + Expo (TypeScript), SDK 57 |
| Local database | SQLite via `expo-sqlite`, `drizzle-orm` for schema/queries, `drizzle-kit` for migrations |
| Navigation | React Navigation — one bottom-tab navigator (`RootNavigator`) wrapping four native-stack navigators |
| i18n | `i18next` + `react-i18next`, resource files in `src/i18n/locales/{en,ur}.json`, `I18nManager` for Urdu RTL |
| App lock | `expo-local-authentication` (biometrics) + hashed PIN in `expo-secure-store` (Phase 6, not yet built) |
| PDF / share | `expo-print` (bill/statement → PDF), `expo-sharing` + WhatsApp/SMS deep links (Phase 5, not yet built) |
| Export | `xlsx` for Excel, CSV writer, saved via `expo-file-system` (Phase 5, not yet built) |

## Why these choices

- **Money is always an integer (paisa/cents), never a float.** Every `amount`, `rate`, `openingBalance` field is `number` but represents whole paisa. Never multiply/divide by 100 with floating point — this is the #1 way to reintroduce the rounding bugs this app exists to eliminate.
- **Balance is never stored as an editable truth.** `customer.balance = openingBalance + Σ(cash_out) − Σ(cash_in)`, always recomputed from `entries` (see [`data-model.md`](data-model.md)). Never add a mutable `balance` column to `customers`.
- **Every mutation writes an audit_log row.** Create/edit/delete on a customer, entry, or line_item is not "done" until `logAudit(...)` has been called for it. See [`skills.md`](skills.md#adding-a-mutation) for the pattern.
- **Deletes are soft.** `entries.is_deleted` hides a row from normal queries but keeps it for history/audit. Never `DELETE FROM` a customer or entry row.
- **Offline-first, sync-ready.** No network calls exist in v1. The repository layer (`src/repositories/`) is the only thing screens talk to — it's the seam where a future sync layer would slot in, so don't let screens query the `db` client directly.

## Folder structure

```
src/
  db/            schema.ts (5 Drizzle tables), client.ts (expo-sqlite + drizzle), drizzle/ (generated migrations — don't hand-edit), seed.ts
  repositories/  the only layer allowed to import db/client.ts or db/schema.ts directly
  types/models.ts  app-facing TS types (camelCase), separate from the DB row shape
  i18n/          i18next bootstrap + en/ur resource files
  theme/         colors.ts (incl. garment palette), theme.ts (spacing/typography tokens)
  navigation/    RootNavigator (tabs) + one Stack per tab + types.ts (param lists)
  screens/       one folder per feature area, matching the screens in the PDF's section 9
  components/    shared presentational components
```

## Build roadmap (phase order)

Build in this order — each phase should be independently runnable before starting the next. Full detail and status: [`roadmap.md`](roadmap.md).

0. Foundation (done) — nav shell, i18n, schema, repository layer
1. Customers — list/search/add/edit/archive
2. Entries & running balance — khata screen, simple cash in/out, home dashboard
3. Itemized bills — the core interaction (line items, auto-description, garment palette)
4. Edit, delete & history — audit trail wired through every mutation
5. Sharing & export — WhatsApp/SMS, PDF, Excel/CSV
6. Security & onboarding — PIN/biometric lock, first-run setup wizard
7. Polish & release — empty states, accessibility, store builds
