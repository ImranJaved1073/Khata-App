# Playbook — common tasks in this repo

## Running the app
```
npm run android   # or npm run ios / npm run web (web is unsupported — see architecture.md)
```
No emulator/device available? Verify the JS bundles cleanly instead:
```
npx tsc --noEmit
npx expo export --platform android   # then rm -rf dist — it's build output, gitignored
```
`npx expo-doctor` should report 20/20 checks passing before you consider a dependency change done.

## Changing the schema
1. Edit `src/db/schema.ts`.
2. `npx drizzle-kit generate` — produces a new numbered `.sql` file + updates `src/db/drizzle/meta/` and `migrations.js`. Never hand-edit anything under `src/db/drizzle/`.
3. Update `src/types/models.ts` to match.
4. Update any repository function whose shape changed, and `.claude/docs/data-model.md`.
5. Delete the app's local SQLite DB (uninstall/reinstall, or clear app data) to pick up the new migration during dev — there's no down-migration tooling.

## Adding a screen
1. Create `src/screens/<Area>/<Name>Screen.tsx`, function component, named export.
2. Register it in the relevant stack under `src/navigation/` (`HomeStack.tsx`, `CustomersStack.tsx`, etc.) and add its route + param type to `src/navigation/types.ts`. (Lock and Onboarding are the exception — they're rendered directly by `App.tsx` as gates, not registered in any stack.)
3. Add any new user-facing strings to **both** `src/i18n/locales/en.json` and `ur.json` (see [`i18n.md`](i18n.md)).
4. Style it with the theming pattern, not a static `StyleSheet.create` — see [`ui.md`#theming](ui.md#theming-light--dark--system): `const { colors } = useTheme();`, `const styles = useMemo(() => makeStyles(colors), [colors]);`, and a `makeStyles(colors: AppColors)` factory at the bottom of the file.
5. If it replaces a `<PlaceholderScreen />`, remove the placeholder usage entirely rather than leaving it as a fallback.

## Adding a repository function / mutation
1. Add the function to the relevant file in `src/repositories/` (or a new file + export it from `src/repositories/index.ts`).
2. If it creates/edits/deletes a `customer`, `entry`, or `line_item`, call `logAudit()` — see the pattern in `code-style.md#adding-a-mutation`.
3. Keep money in integer paisa throughout; see `code-style.md#money`.

## Adding a translation string
1. Add the key to `src/i18n/locales/en.json` under the relevant namespace (`nav`, `home`, `customers`, `customerForm`, `khata`, `entry`, `reports`, `settings`, `lock`, ...).
2. Add the same key with an Urdu translation to `src/i18n/locales/ur.json` in the same change.
3. Use `useTranslation()` + `t("namespace.key")` in the component — never a hardcoded string.

## Switching / testing language + RTL
Call `setAppLanguage("ur" | "en")` from `src/i18n/index.ts`. It flips `i18next` immediately; if the RTL direction actually changed, `I18nManager.forceRTL()` only takes full effect after the app reloads. `SettingsScreen` and `OnboardingScreen` both call it and then show a restart alert (`settings.restartForLanguage` / `onboarding.restartForLanguage`) rather than assuming the layout flips live — there's no `expo-updates` dependency to trigger an automatic reload, so the user restarts the app manually.

## Testing the PIN lock / onboarding gate
`App.tsx` shows Onboarding until `isOnboarded()` (`expo-secure-store`) is true, then shows the Lock screen on launch and on every background→active resume if `hasPin()` is true. To get back to a clean "first run" state during dev, clear the app's data (device Settings → Apps → Khata-App → Storage → Clear data, or uninstall/reinstall) — `adb shell pm clear` is blocked on at least one OEM test device, so don't rely on it. The lock re-checks `hasPin()` fresh on every resume rather than caching it, so a PIN set/changed/removed in Settings takes effect on the very next background/foreground cycle without needing an app restart.

## Before considering any change "done"
1. `npx tsc --noEmit` passes.
2. `npx expo-doctor` is clean.
3. New/changed user-facing strings exist in both locale files.
4. Mutations on customers/entries/line_items log an audit row.
5. Update `.claude/docs/roadmap.md`'s phase status if a phase's stories are now complete (see its acceptance criteria before marking it done).
