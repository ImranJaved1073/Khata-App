# UI guidelines

## Who this is for
Primary user: a shop owner, semi-literate in English, comfortable in Urdu, using the app one-handed mid-conversation with a customer. Optimize for large tap targets, minimal typing, and glanceable balance state over dense information or visual flourish.

## Design tokens
Defined in [`src/theme/`](../../src/theme/) — always import from there, never hardcode a hex value or spacing number in a screen/component. Source of truth for the *values* below is the Phase 7 redesign reference set in [`design/`](../../design/) (one PNG per screen, plus `design/designtokens.png` for the raw token sheet) — extracted by reading the labelled swatches and, for a handful of recurring patterns not on that sheet (soft icon-chip tints, the khata balance-banner blend), by sampling actual pixels from the mockups. If a future design pass changes these, update this table first, then `src/theme/colors.ts`/`theme.ts` to match — never let the two drift.

### Colors (`src/theme/colors.ts`)
| Token | Light | Dark | Used for |
|---|---|---|---|
| `background` | `#FFFFFF` | `#121417` | Screen background |
| `surface` | `#F7F8FA` | `#1C1F25` | Cards, inputs, sunken panels |
| `border` | `#E2E5EA` | `#2C313A` | Hairlines, input/card borders |
| `textPrimary` | `#1E1E1E` | `#F2F3F5` | Body/heading text |
| `textSecondary` | `#6B7280` | `#9AA1AC` | Captions, placeholders, secondary labels |
| `primary` | `#22335B` (navy) | `#4C6FA5` | Headers, filled buttons, active nav, links |
| `primaryMuted` | `#8FB8DE` | `#3A4A63` | Secondary-on-navy text (e.g. khata header phone number) |
| `primarySoft` | `#EAF0F7` | `#3A4A63` | Soft icon-chip / avatar backgrounds (pixel-sampled) |
| `accent` | `#D4A431` (gold) | `#E0B84D` | Selected-swatch ring, business-avatar initials, gold accents |
| `owesMe` | `#C0392B` (red) | `#E5705F` | **Balance only** — customer owes the shop |
| `owesMeSoft` | `#F9EBE9` | `#3C2C2E` | Soft tint behind an `owesMe` icon (pixel-sampled) |
| `iOwe` | `#20603D` (green) | `#4CAF7D` | **Balance only** — shop owes the customer |
| `iOweSoft` | `#E8EFEB` | `#233633` | Soft tint behind an `iOwe` icon (pixel-sampled) |
| `neutralBalance` | `#6B7280` | `#9AA1AC` | Balance exactly zero |
| `danger` / `success` | = `owesMe` / `iOwe` | = `owesMe` / `iOwe` | Non-balance destructive/positive actions (delete, saved) |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | Text/icon on a `primary`-filled surface |

**The one colour rule** (from `designtokens.png`): red/green (`owesMe`/`iOwe`) mean *only* "customer owes shop" / "shop owes customer" — never reused as generic error/success elsewhere in the app UI. The one deliberate exception is the Share sheet (`ActionSheet` instances in `CustomerKhataScreen`/`EntryDetailScreen`), which uses `iOwe`/`owesMe` as WhatsApp-brand-green and PDF-icon red respectively, matching `design/16 · Share action-sheet.png` pixel-for-pixel — those are icon-brand colours, not balance state, and the rule's intent (don't use red/green as decoration) doesn't extend to reproducing a reference image's own brand icons.

`withAlpha(hex, alpha)` (`src/theme/colors.ts`) — the one translucent-blend pattern in the designs: turns a `#RRGGBB` token into an `rgba()` string. Used for the khata screen's balance banner (a ~22% tint of the resolved balance colour over the navy header) and the lock screen's lockout icon tint. Don't invent new alpha blends elsewhere without a pixel-sampled reference — this exists for that one recurring pattern, not as a general opacity utility.

### Typography (`theme.typography`)
`title` 24/700 · `heading` 18/600 · `body` 15/400 · `caption` 12/400 · `money` 20/700 — these five are the *entire* scale per the token sheet; don't introduce a sixth size even if a mockup's rendered text looks bigger (screen-level "big titles" like "Customers"/"Settings"/"Reports" still use `title`).

### Spacing & radius (`theme.spacing` / `theme.radius`)
Spacing: `xs`(4) `sm`(8) `md`(16) `lg`(24) `xl`(32). Radius: `sm`(6) `md`(10) `lg`(16) `pill`(999). The token sheet's four spacing swatches and three radius values (6/10/16 + pill) map 1:1 onto the pre-existing scale — nothing changed here, it was already correct.

- `GARMENT_COLORS` / `GARMENT_COLOR_LABELS` — the fixed 14-color swatch set for the bill line-item color picker (spec 7.4). Never let a user type a freeform color for a line item. The selected-swatch ring is `colors.accent` (gold), not `colors.primary` — a real fix made during the Phase 7 redesign pass (it was navy before, which the reference images don't show).

### Shared presentational components (`src/components/`)
Beyond `ThemeModeSelector`/`LanguageSelector`/`PlaceholderScreen` (pre-existing), the Phase 7 redesign added:
- **`Avatar`** — circle or rounded-square initials avatar (`getInitials()` in `src/lib/textFormat.ts`). Business identity (Home header, Settings business-profile row) uses `shape="square"`, `primary` bg / `accent` text; customer identity (Customer list rows, khata header, Add/Edit customer photo placeholder) uses `shape="circle"`, `primarySoft` bg / `primary` text.
- **`StatCard`** — the colour-topped receivable/payable stat card (Home totals, Reports totals): coloured top border + direction glyph + big amount + optional caption. Reused as-is between the two screens rather than duplicated.
- **`ActionSheet`** — a themed bottom sheet (`Modal` + slide-up card) replacing `Alert.alert` for multi-option choices: the New Entry choice sheet and both Share sheets (statement share on `CustomerKhataScreen`, bill share on `EntryDetailScreen`), plus `CustomerListScreen`'s long-press row context menu (Edit / Delete). Takes a title/subtitle and a list of `{ icon, iconBackgroundColor, iconColor, label, description, onPress }` options plus an optional cancel row. This is presentation only — every option still calls the exact same navigation/share function the old `Alert.alert` button did.
- **`ConfirmDialog`** — a themed centered modal (rounded card, title/message, Cancel + destructive/primary confirm buttons with an in-button `ActivityIndicator` while the action runs) replacing `Alert.alert` for yes/no confirmations, so destructive actions match the app's design tokens instead of the plain OS alert look. Used for the customer Archive/Unarchive/Delete confirmations (`CustomerFormScreen` and `CustomerListScreen`'s long-press menu) — `Alert.alert` is still used elsewhere in the app for simple error notices (`common.errorTitle`/`errorMessage`), which don't need a themed treatment since they're single-button informational dismissals, not decisions.

### Header convention (Phase 7 redesign)
Each bottom tab's **root** screen (`HomeScreen`, `CustomerListScreen`, `ReportsScreen`, `SettingsScreen`) sets `headerShown: false` on its stack-screen `options` and renders its own big `title`-styled heading in-content, matching the reference images' large black screen titles with no native nav bar. Every other (non-root) screen keeps the native stack header — themed via `App.tsx`'s `navigationTheme.colors.card = colors.background` (plain white/dark header, not the old `colors.surface`) — **except** `CustomerKhataScreen`, which overrides its own header via `navigation.setOptions({ headerStyle, headerTintColor, headerTitle: () => <custom avatar+name+phone> })` to get the navy header + white text the reference image shows, with the translucent balance banner immediately below it (a `View` with `backgroundColor: colors.primary` so the navy region reads as one continuous block spanning header + banner).

`LockScreen` is a **fixed navy identity independent of the app's theme setting** — pixel-sampling the reference images showed its background/accent/dot colours match the *light* palette's `primary`/`accent` exactly regardless of light/dark mode, with the *dark* palette's `primaryMuted`/`owesMe` borrowed for on-navy contrast (icon-box tint, keypad key backgrounds, lockout-state red). See the `LOCK_*` constants at the top of `LockScreen.tsx` — don't replace them with `useTheme()`'s resolved colors, that would make the lock screen follow light/dark mode and no longer match the reference. `App.tsx` forces the status bar to `"light"` whenever the lock screen is showing, for the same reason.

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
| Lock screen | PIN pad + dots, auto-triggered biometric prompt, lockout countdown after 5 failed attempts. Appears on launch (if a PIN is set) and on resume from background after `RELOCK_AFTER_MS` (2 min) spent backgrounded — a brief switch-away (photo picker, share sheet) doesn't re-trigger it. |
| Home / Dashboard | Business header, receivable/payable totals (tapping either navigates to the Customer list pre-filtered to just that side of the ledger — spec D2 "tapping a stat filters the list"), today's activity, quick "+ New Customer". |
| Customer list | Search bar, sort control, "Archived" filter chip (tapping an archived row opens its edit form, where Unarchive lives), a dismissible "Owes me"/"I owe" filter chip when arrived at via a Home stat tap, rows (name · balance · last activity), FAB "+". Long-pressing a row opens an `ActionSheet` context menu (Edit → `CustomerForm`, Delete → the same zero-entries-permanent-delete-else-archive flow as the form screen's button, via a `ConfirmDialog`). |
| Add/edit customer | Name (required), phone/address (optional, labeled as such), opening balance with a live receivable/payable preview. One destructive action at the bottom, switching on `customerHasEntries()`: **Delete customer** (permanent, `ConfirmDialog`-confirmed) if the customer has zero entries and isn't archived; **Archive/Unarchive customer** otherwise. |
| Customer khata (detail) | Navy header (avatar + name + phone, `CustomerKhataScreen`'s own `headerStyle` override) continuing into a translucent color-coded balance banner (`withAlpha`), an optional collapsed "Filter statement by date" range (From/To, scopes only the "Share statement" PDF/text — spec D3 "date-ranged"), entry list newest-first (soft-deleted entries hidden by default, revealed by a "Show N deleted entries" toggle — tapping a revealed deleted row opens its history, not the detail screen), full-width "+ New Entry" bar (opens the `ActionSheet` choice sheet: Simple entry / Itemized bill), "Share statement" header icon (opens the `ActionSheet` share sheet: WhatsApp / SMS / PDF). |
| New/edit entry — simple | Direction toggle (red "You gave"/green "You got"), big centered direction-coloured amount input, date + note side by side, direction-coloured Save button. |
| New/edit entry — bill ("New Bill") | Date + "Attach receipt" side by side at the top, then the line-item editor (7.2): one line open for editing at a time; completed lines collapse to a compact tappable summary row (tap to reopen, chevron affordance), live total folded into the "Save bill · {amount}" button rather than a separate total row, note (auto-populated with each line's description, user's own text preserved), auto descriptions. |
| Entry detail | Owes-you/you-paid pill, item table (bill) or a plain direction line (simple), note box, attachment preview, Share / Edit / History / Delete action row (Share opens the `ActionSheet` share sheet: WhatsApp / SMS / PDF). |
| Entry history | Audit timeline for that entry. |
| Reports | Receivable/payable totals, customer & entry counts, date-range filter (applies to both the on-screen entry count and the CSV/Excel exports), export to CSV / Excel (.xlsx). |
| Settings | Business profile, language (EN/UR), theme mode (Light/Dark/System), currency, bill footer, set/change/remove PIN, biometric toggle, backup/restore (JSON export via share sheet; restore is Android-only — see `data-model.md` / `skills.md`). |

Bottom tabs: **Home · Customers · Reports · Settings** (`src/navigation/RootNavigator.tsx`). Onboarding and the lock screen are gates outside the tabs, rendered directly by `App.tsx`, not routes inside any stack.

## RTL (Urdu)
- Language switch flips the whole UI via `I18nManager` (`src/i18n/index.ts` → `setAppLanguage`). Never build a screen that assumes LTR — use `flexDirection: "row"` (which RN mirrors automatically under RTL) rather than manually placing elements left/right with `marginLeft`/`marginRight`; prefer `marginStart`/`marginEnd` and `start`/`end` over `left`/`right` for anything that must mirror correctly.
- Any icon that implies direction (back arrow, chevrons) must visually flip in RTL — React Navigation's stack header handles this automatically; hand-rolled directional icons won't.

## Component conventions
- Screens currently under construction render `<PlaceholderScreen title description />` (`src/components/PlaceholderScreen.tsx`). When you build out a screen for real, delete the placeholder usage — don't leave it as a fallback branch.
- FAB and large CTA/save/archive buttons use `theme.radius.lg` (a rounded-square "squircle"), not `radius.pill` — confirmed by pixel-cropping `design/06`'s FAB and `design/06b`/`07`'s CTA/Save/Archive buttons: all show visible flat edges with rounded corners, not a full stadium shape. Only true pill shapes in the designs are search bars and filter/sort chips (`radius.pill`).
- Form field labels (`CustomerFormScreen`'s `Field` component and the same pattern anywhere else a labeled input appears) use `colors.textSecondary`, not `textPrimary` — pixel-sampled from `design/07` (label RGB `#6B7280` exactly). A required field appends a `colors.danger`-colored `" *"`; an optional field appends a `colors.textSecondary` `" (optional)"` (`customerForm.optional` i18n key) — both inline within the same label `Text`, matching `design/07`'s "Name *" / "Phone (optional)" / "Address (optional)".
- A focused `TextInput` (or the opening-balance box) gets a `colors.primary` border — matches every focused field shown in `design/07` and `design/16b`'s active search box. Implemented per-screen via local `focusedField` state + `onFocus`/`onBlur`, not a shared component (no shared styled-TextInput exists yet).
- The opening-balance box's inline direction suffix ("owes you" / "you owe", `customerForm.owesYouSuffix`/`youOweSuffix`) is distinct from the `balancePreview` line's "receivable"/"payable" wording — same underlying sign, but `design/07` uses the shorter, second-person phrasing right next to the amount and the longer word only in the "Preview:" line below.
- Money is always formatted through a single shared formatter (add one in `src/theme/` or `src/lib/` when the first real money-displaying screen is built) that converts paisa → display string using `settings.currencySymbol`. Never do `amount / 100` inline in a component.
- Empty states matter — this app replaces a paper notebook for a non-technical user. Every list screen needs a real empty state (see `customers.empty` / `khata.empty` translation keys), not a blank screen. Two of these have the full icon+title+description+CTA treatment from a dedicated reference image (`CustomerListScreen`'s true-empty and no-search-results states, `design/06b`/`16b`); the rest (archived-empty, receivable/payable-filter-empty) stay the simpler centered-text style since no reference image covers those specific sub-states. The icon glyph inside the `primarySoft` icon box is `colors.primaryMuted`, not `colors.primary` — pixel-sampled from `design/06b`/`16b` (a lighter blue than the navy used everywhere else icons appear on a soft background).
- Relative recency ("Today, 9:30 AM" / "Yesterday" / "3 days ago") goes through `formatRelativeDate()`/`formatTimeOfDay()` (`src/lib/dateFormat.ts`) — pure functions returning a structured `{ kind, ... }` value, translated in the component via `t("common.today"|"common.yesterday"|"common.daysAgo", {...})`, same as every other user-facing string (never hardcode "Today"/"Yesterday" text inside a `lib/` helper). Used on `CustomerListScreen` rows and `HomeScreen`'s activity feed.
- Avatar initials go through `getInitials()` (`src/lib/textFormat.ts`), paired with the `Avatar` component above.

## Known gaps vs. the Phase 7 design reference (`design/`)
Everything in `design/` was matched as closely as reasonable except:
- **Reports' "Receivable vs collected" bar chart** (`design/14 · Reports.png`) — not implemented. It needs a weekly-bucketed aggregation query (new repository logic, not just layout) and a charting dependency (none exists in `package.json`). Left out rather than faked; the rest of the Reports screen (stat cards, date range, CSV/Excel export) matches.
- **New Entry — Simple's numeric keypad** (`design/10 · New Entry — Simple.png`) — the reference shows a full calculator-style keypad (digits + `± × ÷ %` operators + running expression). The amount field is still a big centered, direction-coloured `TextInput` on the OS numeric keyboard (`keyboardType="decimal-pad"`), not a custom expression evaluator — building one risks exactly the kind of float/parsing bug this app's paisa-integer discipline exists to prevent, and it's a new feature (an expression engine), not a restyle.
- **Home's "See all" link** (next to "Today's activity") and the notification **bell icon** are decorative only — there's no "all activity" screen to link to and no notifications feature, so "See all" wasn't wired to anything (a dead-looking link would be worse than omitting it) and the bell renders as a plain icon, not a `Pressable`.
- Onboarding's step-3 PIN entry *was* rebuilt as a real digit keypad (matching `design/03`) rather than the old two-`TextInput` pair — see `OnboardingScreen.tsx`'s `PIN_KEYPAD_ROWS`. Settings' own set/change/remove-PIN flow was deliberately left on plain `TextInput` pairs, since no reference image covers that specific sub-screen.

## Sharing & printed documents (spec D1/D3)
- A bill/receipt or a customer statement is turned into a **PDF** (`expo-print`) and/or a **plain-text message** (WhatsApp/SMS deep link, generic-share fallback) by the pure builders in `src/lib/documentFormat.ts`. The PDF layout follows the reference bill design: business header + logo initials, "Billed to" / "Khata reference" boxes, a dark-navy line-item table with color swatches, note-left / totals-right, a dark bill-total bar, a previous-balance → balance-owed box, and a footer. Keep new document types consistent with that shell (`documentStyles()` / `htmlShell()`), and keep balance colors (`owesMe` red / `iOwe` green) consistent with the rest of the app.
- Money in documents/exports still goes through the shared paisa formatters (`formatMoney` for display strings, `formatMoneyInput` for the bare decimal used in spreadsheet cells) — never `amount / 100` inline.
- The Share entry points: `EntryDetailScreen`'s "Share" action button, and `CustomerKhataScreen`'s header share icon ("Share statement"). Both open an action sheet: WhatsApp · SMS · PDF.
