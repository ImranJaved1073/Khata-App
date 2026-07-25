# UI guidelines

## Who this is for
Primary user: a shop owner, semi-literate in English, comfortable in Urdu, using the app one-handed mid-conversation with a customer. Optimize for large tap targets, minimal typing, and glanceable balance state over dense information or visual flourish.

## Design tokens
Defined in [`src/theme/`](../../src/theme/) — always import from there, never hardcode a hex value or spacing number in a screen/component.

- `theme.colors` (`src/theme/colors.ts`) — semantic app colors (`primary`, `background`, `surface`, `border`, `textPrimary`, `textSecondary`, `danger`, `success`).
- `theme.spacing` — `xs`(4) `sm`(8) `md`(16) `lg`(24) `xl`(32). Use these, not raw numbers.
- `theme.radius`, `theme.typography` — same rule.
- `GARMENT_COLORS` / `GARMENT_COLOR_LABELS` — the fixed 14-color swatch set for the bill line-item color picker (spec 7.4). Never let a user type a freeform color for a line item.

## Theming (light / dark / system)
Colors are never static. `src/theme/colors.ts` exports `lightColors` and `darkColors` (identical keys, incl. `onPrimary` — the text/icon color for anything painted with `colors.primary`, e.g. filled buttons). `src/theme/ThemeContext.tsx` resolves the user's setting (`settings.themeMode`: `system` \| `light` \| `dark`, via `useTheme()`) against `Appearance.getColorScheme()` when set to `system`, and exposes the resolved palette as `colors`.

Every screen and subcomponent that renders styled UI must:
1. Call `const { colors } = useTheme();` (spacing/radius/typography still come from the static `theme` import — only colors are dynamic).
2. Build its stylesheet with `const makeStyles = (colors: AppColors) => StyleSheet.create({ ... })` instead of a module-level `const styles = StyleSheet.create({...})` — a module-level sheet is evaluated once at import time and would freeze in whichever palette was active first.
3. Call `const styles = useMemo(() => makeStyles(colors), [colors]);` inside the component (and inside every subcomponent in the same file that also uses `styles` — each one needs its own hook call, not just the top-level export).

The Settings screen's theme picker (`ThemeModeSelector`, `src/components/`) writes the choice to both `useTheme().setMode()` (live preview, no restart needed — unlike the language/RTL switch) and `settings.themeMode` (persisted). `NavigationContainer`'s `theme` prop and the status bar style in `App.tsx` follow the same resolved scheme.

## Balance color coding (non-negotiable, spec B2/C1)
- **Red** (`theme.colors.owesMe`) = customer owes the shop (positive balance).
- **Green** (`theme.colors.iOwe`) = shop owes the customer (negative balance).
- Apply this consistently everywhere a balance appears: customer list rows, the khata balance header, the home dashboard totals, PDF statements.

## Screen-by-screen reference (spec section 9)
| Screen | Key contents |
|---|---|
| Onboarding (first run) | 3-step wizard: business name/currency/language → appearance (theme mode) → optional 4-digit PIN + confirm + biometric toggle. Skippable PIN step — the lock only gates the app once a PIN actually exists. Shown once, tracked by `isOnboarded()` in `expo-secure-store`. |
| Lock screen | PIN pad + dots, auto-triggered biometric prompt, lockout countdown after 5 failed attempts. Appears on launch (if a PIN is set) and on every resume from background. |
| Home / Dashboard | Business header, receivable/payable totals, today's activity, quick "+ New Customer". |
| Customer list | Search bar, sort control, rows (name · balance · last activity), FAB "+". |
| Add/edit customer | Name, phone, photo, address, opening balance. |
| Customer khata (detail) | Big color-coded balance header, entry list newest-first, "+ New Entry", "Share statement". |
| New/edit entry — simple | Direction toggle, amount pad, date, note. |
| New/edit entry — bill ("New Bill") | Line-item editor (7.2): one line open for editing at a time; completed lines collapse to a compact tappable summary row (tap to reopen), live total across collapsed + active lines, note (auto-populated with each line's description, user's own text preserved), attachment, auto descriptions. |
| Entry detail | Full bill view: Share / Edit / History / Delete (Share offers WhatsApp / SMS / PDF — see below). |
| Entry history | Audit timeline for that entry. |
| Reports | Receivable/payable totals, customer & entry counts, export whole ledger to CSV / Excel (.xlsx). Date-range filter is deferred to Phase 7. |
| Settings | Business profile, language (EN/UR), theme mode (Light/Dark/System), currency, bill footer, set/change/remove PIN, biometric toggle, backup/restore (JSON export via share sheet; restore is Android-only — see `data-model.md` / `skills.md`). |

Bottom tabs: **Home · Customers · Reports · Settings** (`src/navigation/RootNavigator.tsx`). Onboarding and the lock screen are gates outside the tabs, rendered directly by `App.tsx`, not routes inside any stack.

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
