# Build roadmap & progress

Tracks progress against `docs/Khata_app-Guide.pdf` sections 8 (user stories) and 10 (phase plan). Update the status column as phases complete — check a phase's acceptance criteria (AC) in the PDF before marking it done, not just that screens exist.Update this file at the end of every phase/story you complete, as part of
the same commit. Keep entries short — this is a log, not documentation.

## Status legend
- [ ] not started · [~] branch created, in progress · [x] merged to main & branch deleted

Each story below should note its branch name once created, e.g.:
`[x] Customer list — search, sort, balance display (feature/1-b1-customer-list)`

| Phase | Scope | Stories | Status |
|---|---|---|---|
| 0 — Foundation | Expo+TS init, nav shell (tabs+stacks), theme tokens, i18next EN/UR + RTL flip, SQLite/Drizzle schema (5 tables), typed repository layer, seed data (3 demo customers) | none (skeleton) | ✅ Done |
| 1 — Customers | Searchable customer list (name/phone, live search, sort by balance/recency), add/edit customer form, archive with audit log | B1, B2, B3 | ✅ Done |
| 2 — Entries & running balance | Customer khata screen (color-coded balance header, newest-first entry list), simple cash-in/cash-out entry, home dashboard totals | C1, C2, D2 | ✅ Done |
| 3 — Itemized bills | Bill form (line items, size/color pickers, garment palette, quantity/rate/amount), auto-description engine, live bill total. **The centerpiece — budget the most time here.** | C3 | ✅ Done |
| 4 — Edit, delete & history | Edit/soft-delete any entry with audit_log diff, entry history timeline | C4, C5 | ✅ Done |
| 5 — Sharing & export | WhatsApp/SMS share (bill/statement text + deep link), PDF export (`expo-print`), Excel/CSV export (`xlsx` + `expo-file-system`) | D1, D3 | ✅ Done |
| 6 — Security & onboarding | PIN + biometric app lock (`expo-secure-store` + `expo-local-authentication`), first-run setup wizard, Settings screen, runtime light/dark/system theming | A1, A2 | ✅ Done |
| 7 — Polish & release | Empty states, error handling, large-number formatting, accessibility, app icons/splash, EAS store builds, full QA against every AC in section 8 | all | 🔶 In progress |

## Definition of done (v1, spec section 12)
- [ ] Every user story in spec section 8 passes its acceptance criteria.
- [ ] Balances always equal the recomputed sum of entries — never drift.
- [ ] Every create/edit/delete on a customer or entry appears in the audit log.
- [ ] The app opens, adds a customer, records a bill, and shares it — fully offline.
- [ ] Switching to Urdu flips the entire UI to RTL with translated strings.
- [ ] Money never shows floating-point rounding errors.
- [ ] Nothing is reachable without passing the PIN/biometric lock.



## Phase 1 — Customers (Stories B1–B3)
- [x] Customer list — search, sort, balance display (feature/1-b1-customer-list, 2026-07-24)
- [x] Add/edit customer form (feature/1-b2-add-edit-customer, 2026-07-24)
- [x] Archive (soft-hide) (feature/1-b3-archive-customer, 2026-07-24)
- [x] Balance computed from entries (listCustomersWithBalance, feature/1-b1-customer-list, 2026-07-24)

## Phase 2 — Simple entries & running balance (Stories C1, C2, D2)
- [x] Customer khata screen (feature/2-c1-c2-d2-khata-entries, 2026-07-24)
- [x] Simple cash-in / cash-out entry form (feature/2-c1-c2-d2-khata-entries, 2026-07-24)
- [x] Running balance math (computeBalanceFromEntries, reused from Phase 0/1, feature/2-c1-c2-d2-khata-entries, 2026-07-24)
- [x] Home dashboard totals (feature/2-c1-c2-d2-khata-entries, 2026-07-24)

## Phase 3 — Itemized bills (Story C3)
- [x] Bill form / line-item editor (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Size & color pickers (garment palette) (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Auto-description engine (+ description_touched override) (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Live bill total, multi-line support (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Bill created from a customer's khata (entries list) screen — "+ New Entry" now offers Simple entry vs Itemized bill, and the created entry lands in that customer's entry list (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Read-only bill/entry detail view (line items, total, note, attachment) — Edit/Delete/Share/History actions still land in Phases 4–5 (feature/3-c3-itemized-bill-form, 2026-07-25)
- [x] Bill form UX refinement — screen retitled "New Bill"; only one line-item form is open at a time, completed lines collapse to a compact tappable summary row (tap to reopen), and each line's description is folded into the bill note (newline-separated, appended after any text the user already typed) (feature/3-c3-bill-ui-improvements, 2026-07-25)

## Phase 4 — Edit, delete & history (Stories C4, C5)
- [x] Edit entry (reopens correct form type — simple form or the bill line-item editor, pre-filled) (feature/4-c4-edit-entry, 2026-07-25)
- [x] Per-line-item audit diffs on bill edits (create/edit/delete logged per line, matched by id) (feature/4-c4-edit-entry, 2026-07-25)
- [x] Soft delete (`deleteEntry`, isDeleted flag, never a real DELETE) (feature/4-c5-delete-history, 2026-07-25)
- [x] Audit log wired into every mutation (create/edit/delete on entries and line_items) (feature/4-c4-edit-entry, feature/4-c5-delete-history, 2026-07-25)
- [x] Entry history / audit timeline screen — merges the entry's own audit trail with its current line items' trails, newest first (feature/4-c5-delete-history, 2026-07-25)
- [x] `EntryDetailScreen` now has Edit / History / Delete actions — Share is still Phase 5 (feature/4-c4-edit-entry, feature/4-c5-delete-history, 2026-07-25)

## Phase 5 — Sharing & export (Stories D1, D3)
- [x] WhatsApp/SMS share (bill & statement text + deep link, generic-share fallback) (feature/5-d1-share-pdf, 2026-07-25)
- [x] PDF export (single bill + full statement) via `expo-print` — receipt styled after the reference bill layout (feature/5-d1-share-pdf, 2026-07-25)
- [x] Share action on `EntryDetailScreen` (bill/receipt) + "Share statement" header action on `CustomerKhataScreen` (feature/5-d1-share-pdf, 2026-07-25)
- [x] CSV export (feature/5-d3-excel-csv-export, 2026-07-25)
- [x] Excel (.xlsx) export — Customers + Entries sheets, via `xlsx` + `expo-file-system/legacy` (feature/5-d3-excel-csv-export, 2026-07-25)
- [x] Real Reports screen (totals, customer/entry counts, CSV/Excel export buttons) (feature/5-d3-excel-csv-export, 2026-07-25)

## Phase 6 — Security & onboarding (Stories A1, A2)
- [x] Runtime light/dark/system theming — `ThemeContext`/`useTheme()`, `lightColors`/`darkColors` in `src/theme/colors.ts`, `settings.themeMode` column + migration `0001`, every screen refactored to `makeStyles(colors)` (feature/6-theme-mode, 2026-07-25)
- [x] PIN + biometric lock, lockout after failed attempts — `src/lib/appLock.ts` (salted SHA-256 in `expo-secure-store`, 5 attempts / 60s lockout), `LockScreen` (PIN pad, auto biometric prompt), re-locks on every background→active transition (feature/6-a1-a2-security-onboarding, 2026-07-25)
- [x] First-run setup wizard — `OnboardingScreen` (business profile + language → appearance → optional PIN + biometric), gates the app outside the tab navigator until `setOnboarded()` (feature/6-a1-a2-security-onboarding, 2026-07-25)
- [x] Settings screen (profile, language, theme mode, PIN set/change/remove, biometric toggle, backup/restore) — full build replacing the placeholder (feature/6-a1-a2-security-onboarding, 2026-07-25)
- [x] Backup/restore — full-ledger JSON export (share sheet) and restore; restore is Android-only (Storage Access Framework directory pick + fixed filename, since `expo-document-picker` isn't a dependency and adding it would need a dev-client rebuild) (feature/6-a1-a2-security-onboarding, 2026-07-25)

Known scope notes for Phase 7 pickup:
- PIN setup is optional during onboarding (skippable, matching spec's "first-run wizard" rather than a forced gate) — the lock screen only appears once a PIN actually exists. `settings.pinHash` (the DB column from the original Phase 0 schema) is unused; the real PIN hash lives only in `expo-secure-store` via `src/lib/appLock.ts` — don't write to `settings.pinHash`.
- Restore on iOS shows an "unavailable" message — there's no SAF equivalent there. A real cross-platform restore needs `expo-document-picker` (new native dependency, dev-client rebuild).
- Switching language mid-session still needs an app restart to fully flip RTL layout (same `I18nManager.forceRTL` constraint as before) — Settings shows a restart alert rather than auto-reloading, since `expo-updates` isn't a dependency.
- `app.json`'s `userInterfaceStyle` was changed from `"light"` to `"automatic"` to match the new system theme option — this only takes full effect after the next native rebuild (`expo prebuild` / `expo run:android`), not on the already-built dev client.

## Phase 7 — Polish & release (feature/7-polish-release, in progress)
- [x] Error handling — every screen's data-loading effect and mutation handler now wraps in try/catch/finally and surfaces `common.errorTitle`/`common.errorMessage` via `Alert` on failure, instead of letting a rejected promise fail silently
- [x] Empty states — audited every list-like screen (`CustomerListScreen` incl. new archived-filter empty state, `CustomerKhataScreen`, `EntryHistoryScreen`, `HomeScreen` today's-activity, `ReportsScreen` incl. new no-entries-in-range state); all have a real translated empty message, none render a blank screen
- [x] Large-number formatting — `formatMoney` already grouped via `toLocaleString("en-IN")`; added `numberOfLines={1}` (+ `adjustsFontSizeToFit` on the largest headline totals) to every money-displaying `Text` so a big balance can't wrap or overflow its card
- [x] Accessibility pass — every `Pressable` in `src/` now has `accessibilityRole="button"` (plus `accessibilityLabel`/`accessibilityState` where the visible text doesn't already say enough, e.g. icon-only buttons, swatches, chips), and both `Switch`es (biometric toggle in Onboarding + Settings) have `accessibilityLabel`
- [x] App icon/adaptive icon/favicon redesigned (navy `#22335B` + gold, document+checkmark mark) — `app.json` updated (`name: "Khata"`, adaptive icon background color); splash screen still uses Expo's default icon-based splash (no `expo-splash-screen` dependency added)
- [x] `eas.json` added (development/preview/production build profiles, `appVersionSource: "local"`) — actually running `eas build`/`eas submit` needs the user's Expo account and is not something this agent can do
- [x] Customer archive UX closed the loop — `CustomerFormScreen` now supports **unarchive** (was archive-only), `CustomerListScreen` has an "Archived" filter chip + empty state, and tapping an archived row now opens the edit form (where Unarchive lives) instead of the khata screen
- [x] `CustomerKhataScreen` can now reveal soft-deleted entries (`khata.showDeleted`/`hideDeleted` toggle) — tapping a deleted row opens its history instead of the (now soft-deleted) detail screen
- [x] Phone number validation on `CustomerFormScreen` (`customerForm.phoneInvalid`) — loose but real check (7–15 digits), optional field
- [x] Reports date-range filter (`reports.dateRange`/`dateFrom`/`dateTo`/`clearFilter`) — the item `ui.md`'s Reports row had deferred to Phase 7; filters both export buttons and the on-screen entry count
- [x] App-lock re-lock timing changed from "every background→active transition" to a `RELOCK_AFTER_MS` (2 min) threshold, and `LOCKOUT_MS` changed from 60s to 30s, to match spec A2's AC on brief backgrounding (e.g. picking a photo, opening the share sheet) not re-triggering the PIN
- [x] Static QA pass against every AC in spec Section 8 (read the PDF, cross-checked each story's AC line-by-line against the actual repository/screen code) — found and fixed two real gaps, both below (D2, D3). Everything else in Section 8 (A1, A2, B1–B3, C1–C5, D1) checked out against the code as written.
- [x] **D2 fix** — "Tapping a stat filters the list" wasn't actually true before this pass (it only sorted by balance, mixing receivable and payable customers). `HomeScreen`'s two totals now navigate with `{ initialSort: "balance", balanceFilter: "receivable" | "payable" }`; `CustomerListScreen` filters by balance sign and shows a dismissible chip (`customers.filterReceivable`/`filterPayable`) plus dedicated empty states. Along the way, fixed a real bug this would have hit: since React Navigation reuses an already-mounted screen instance and just updates `route.params`, the old `useState(route.params?.x ?? default)` pattern (also used for `initialSort`) would go stale on a second stat tap — now synced via a `useEffect` keyed on `JSON.stringify(route.params)`.
- [x] **D3 fix** — the per-customer PDF/text statement ("Share statement" on `CustomerKhataScreen`) was whole-history only; spec D3 explicitly calls for "date-ranged". `getStatementDocumentData` (`documentRepository.ts`) now takes optional `{ dateFrom, dateTo }`, computing the period's effective opening balance from everything before `dateFrom` so the in-range running balance stays continuous; `buildStatementHtml`/`buildStatementText` show a "Period" line when ranged. `CustomerKhataScreen` has a collapsed "Filter statement by date" control (same `isValidDate` pattern as the Reports date filter) that scopes only the share action, not the visible entry list. Note: the Reports screen's *separate* date-range filter (added earlier this phase) is unrelated — it scopes the bulk CSV/Excel export, not this per-customer statement.
- [ ] EAS store builds — `eas.json` profiles exist but no build has actually been run/submitted (needs the user's Expo account + is a billed/external action)
- [ ] Full **on-device** QA pass against spec Section 8 — the static/code-level QA above is done, but no manual on-device pass has happened this session; see `project_device_adb_restrictions` memory (adb input injection is blocked on the test device, so this needs a human tester, not just `am start`/`screencap`)


## Notes for whoever picks up the next phase
- Read `.claude/docs/architecture.md`, `data-model.md`, and `ui.md` first — they cover the non-negotiable rules (integer paisa, recomputed balance, audit log on every mutation, garment color palette) that every phase depends on.
- The document/export layer (Phase 5) is the model for any future "produce a file" feature: a repository assembler (`getBillDocumentData` / `getStatementDocumentData` / `getExportData`) gathers data, a pure `src/lib/*` builder turns it into HTML/text/CSV/xlsx, and `share.ts` / `exportFile.ts` handle print + share + file writing. Keep data assembly in repositories and formatting in `lib/` (no `db` import in `lib/`).
- `expo-file-system`'s classic API (`writeAsStringAsync`, `cacheDirectory`, base64/utf8 encoding) is imported from `expo-file-system/legacy` in SDK 57 — the default entry is the new `File`/`Directory` API. `src/lib/backupFile.ts` (Phase 6) uses the same legacy import, plus its Android-only `StorageAccessFramework` namespace for restore.
- `updateEntry`/`deleteEntry` (`entryRepository.ts`, Phase 4) are the pattern to follow for any further entry-level mutation: before/patch/diff/`logAudit`, with soft delete only (`isDeleted`, never a real `DELETE` on `entries`). Line items are the one exception — they have no `isDeleted` column, so `updateEntry` hard-deletes/inserts/updates `line_items` rows directly while still logging a `create`/`edit`/`delete` audit row per line, matched by `id`.
- Every screen/component now reads colors via `useTheme()` (`src/theme/ThemeContext.tsx`) and builds its `StyleSheet` with a `makeStyles(colors: AppColors)` factory called through `useMemo(() => makeStyles(colors), [colors])` — never the old `const styles = StyleSheet.create({...})` module-level pattern, which would bake in light-mode colors permanently. Follow this for any new screen (Phase 7's polish pass touches every screen, so it'll hit this constantly).
- Phase 7 is a good place to revisit: a real cross-platform file picker for restore (`expo-document-picker`, needs a dev-client rebuild), an `expo-updates`-based reload after a language switch instead of the manual-restart alert, and dropping the now-dead `settings.pinHash` column in a follow-up migration. None of these three were picked up this pass — still open.
- Phase 7's code-level polish (error handling, empty states, accessibility, large-number formatting, archive/soft-delete UX gaps, icons, `eas.json`) is done — see the checklist above. What's left to actually close the phase: run and QA a real EAS build, and a manual on-device pass against every AC in spec Section 8 (a human tester is needed — this repo's test device blocks `adb` input injection, see the `project_device_adb_restrictions` memory).
