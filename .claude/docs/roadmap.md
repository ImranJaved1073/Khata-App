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
| 6 — Security & onboarding | PIN + biometric app lock (`expo-secure-store` + `expo-local-authentication`), first-run setup wizard, Settings screen | A1, A2 | ⬜ Not started |
| 7 — Polish & release | Empty states, error handling, large-number formatting, accessibility, app icons/splash, EAS store builds, full QA against every AC in section 8 | all | ⬜ Not started |

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
- [ ] PIN + biometric lock, lockout after failed attempts
- [ ] First-run setup wizard
- [ ] Settings screen (profile, language, currency, PIN, backup/restore)

## Phase 7 — Polish & release
- [ ] Empty states, error handling
- [ ] Large-number formatting
- [ ] Accessibility pass
- [ ] App icons/splash, EAS store builds
- [ ] Full QA against every AC in spec Section 8


## Notes for whoever picks up the next phase
- Read `.claude/docs/architecture.md`, `data-model.md`, and `ui.md` first — they cover the non-negotiable rules (integer paisa, recomputed balance, audit log on every mutation, garment color palette) that every phase depends on.
- Phase 6 (security & onboarding) is where `settings` finally gets a real editing UI. Business name currently defaults to "Master Fashion" (`DEFAULT_BUSINESS_NAME` in `src/lib/documentFormat.ts`) for receipts/statements — once the Settings screen can write `settings.businessName`, that fallback keeps working for anyone who hasn't set one. Settings also owns currency symbol and bill footer text, both already consumed by the document formatters and money display.
- The document/export layer (Phase 5) is the model for any future "produce a file" feature: a repository assembler (`getBillDocumentData` / `getStatementDocumentData` / `getExportData`) gathers data, a pure `src/lib/*` builder turns it into HTML/text/CSV/xlsx, and `share.ts` / `exportFile.ts` handle print + share + file writing. Keep data assembly in repositories and formatting in `lib/` (no `db` import in `lib/`).
- `expo-file-system`'s classic API (`writeAsStringAsync`, `cacheDirectory`, base64/utf8 encoding) is imported from `expo-file-system/legacy` in SDK 57 — the default entry is the new `File`/`Directory` API. Backup/restore in Phase 6 will likely want the same legacy import.
- `updateEntry`/`deleteEntry` (`entryRepository.ts`, Phase 4) are the pattern to follow for any further entry-level mutation: before/patch/diff/`logAudit`, with soft delete only (`isDeleted`, never a real `DELETE` on `entries`). Line items are the one exception — they have no `isDeleted` column, so `updateEntry` hard-deletes/inserts/updates `line_items` rows directly while still logging a `create`/`edit`/`delete` audit row per line, matched by `id`.
