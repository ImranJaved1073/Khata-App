# Khata App

A local-first khata (ledger) and bill management app for small shop owners —
replaces the paper notebook used to track customer credit and payments.
Built with React Native + Expo, fully offline, with Urdu/English support.

Product spec: [`docs/Khata_app-Guide.pdf`](docs/Khata_app-Guide.pdf).

## Status

Actively in development. See [`.claude/docs/roadmap.md`](.claude/docs/roadmap.md)
for detailed per-phase progress.

| Phase | Scope | Status |
|---|---|---|
| 0 — Foundation | Nav shell, i18n, SQLite schema, repository layer | ✅ Done |
| 1 — Customers | List/search/sort, add/edit, archive | ✅ Done |
| 2 — Entries & running balance | Khata screen, simple cash in/out, home dashboard | ✅ Done |
| 3 — Itemized bills | Line-item bill form, garment palette, auto-descriptions | ✅ Done |
| 4 — Edit, delete & history | Audit trail on every mutation | ✅ Done |
| 5 — Sharing & export | WhatsApp/SMS, PDF, Excel/CSV | ✅ Done |
| 6 — Security & onboarding | PIN/biometric lock, setup wizard, light/dark/system theme | ✅ Done |
| 7 — Polish & release | Empty states, error handling, accessibility, large-number formatting, app icons/splash, EAS store builds | 🔶 In progress |

## Tech stack

- React Native + Expo (TypeScript), SDK 57
- SQLite via `expo-sqlite`, `drizzle-orm` for schema/queries
- React Navigation (bottom tabs + native-stack)
- `i18next` / `react-i18next` for English/Urdu, with RTL support

Full architecture notes: [`.claude/docs/architecture.md`](.claude/docs/architecture.md).

## Getting started

```
npm install
npm run android   # or npm run ios
```

No device/emulator available? Verify the app bundles cleanly instead:

```
npx tsc --noEmit
npx expo export --platform android   # then remove the generated dist/ folder
```

Store builds go through EAS (`eas.json` has `development`/`preview`/`production` profiles):

```
eas build --platform android --profile preview
```

## Project structure

```
src/
  db/            schema, migrations, SQLite client
  repositories/  the only layer allowed to query the database directly
  types/         app-facing TypeScript models
  i18n/          English/Urdu resources
  theme/         colors, spacing, typography tokens
  navigation/    tab + stack navigators
  screens/       one folder per feature area
  components/    shared presentational components
```

## Contributing

Project conventions (data model, UI guidelines, code style, git workflow)
live under [`.claude/docs/`](.claude/docs/) and are the source of truth for
how this codebase is built.
