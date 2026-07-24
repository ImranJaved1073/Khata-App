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
| 1 — Customers | Searchable customer list (name/phone, live search, sort by balance/recency), add/edit customer form, archive with audit log | B1, B2, B3 | ⬜ Not started |
| 2 — Entries & running balance | Customer khata screen (color-coded balance header, newest-first entry list), simple cash-in/cash-out entry, home dashboard totals | C1, C2, D2 | ⬜ Not started |
| 3 — Itemized bills | Bill form (line items, size/color pickers, garment palette, quantity/rate/amount), auto-description engine, live bill total. **The centerpiece — budget the most time here.** | C3 | ⬜ Not started |
| 4 — Edit, delete & history | Edit/soft-delete any entry with audit_log diff, entry history timeline | C4, C5 | ⬜ Not started |
| 5 — Sharing & export | WhatsApp/SMS share (bill/statement text + deep link), PDF export (`expo-print`), Excel/CSV export (`xlsx` + `expo-file-system`) | D1, D3 | ⬜ Not started |
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
- [ ] Customer list — search, sort, balance display
- [ ] Add/edit customer form
- [ ] Archive (soft-hide)
- [ ] Balance computed from (still empty) entries

## Phase 2 — Simple entries & running balance (Stories C1, C2, D2)
- [ ] Customer khata screen
- [ ] Simple cash-in / cash-out entry form
- [ ] Running balance math
- [ ] Home dashboard totals

## Phase 3 — Itemized bills (Story C3)
- [ ] Bill form / line-item editor
- [ ] Size & color pickers (garment palette)
- [ ] Auto-description engine (+ description_touched override)
- [ ] Live bill total, multi-line support

## Phase 4 — Edit, delete & history (Stories C4, C5)
- [ ] Edit entry (reopens correct form type)
- [ ] Soft delete
- [ ] Audit log wired into every mutation
- [ ] Entry history / audit timeline screen

## Phase 5 — Sharing & export (Stories D1, D3)
- [ ] WhatsApp/SMS share (bill & statement text)
- [ ] PDF export (single bill + full statement)
- [ ] CSV / Excel export

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
- Phase 3 (itemized bills) is explicitly called out in the spec as the feature the whole app is built around — don't under-scope it relative to the other phases.
