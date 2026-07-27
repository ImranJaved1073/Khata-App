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

## Regenerating app icon / splash assets
There's no design tool or image-generation model in this environment, so `assets/icon.png`, `favicon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, and `splash-icon.png` are produced by rendering an HTML/CSS composition through headless Edge (same binary as the PDF preview technique below) and reading the PNG back:
1. Write an HTML file that `@font-face`s the Ionicons TTF directly (`node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf`, via an absolute `file:///` URL) and renders the glyph as an HTML entity (e.g. `&#61861;` for `book` — cross-check the decimal codepoint against `Ionicons.json` in that same `glyphmaps/` folder, not just the name).
2. For an opaque asset (`icon.png`, `favicon.png`, the solid background layer), screenshot normally. For a **transparent** asset (the Android adaptive-icon foreground/monochrome layers, or anything meant to float over a differently-colored background), add `--default-background-color=00000000` to the `msedge.exe` invocation — without it, headless Chrome/Edge fills the canvas white regardless of CSS `background: transparent`. Verify the result actually has alpha (not just an RGBA-typed PNG with alpha always 255) by reading pixels back with `pngjs` (already a transitive dependency — `require` it via its absolute `node_modules` path if running the script from outside the project root) rather than trusting the file visually.
3. `--window-size` sets the exact output pixel size 1:1 (use `--force-device-scale-factor=1`); add `--virtual-time-budget=3000` so the `@font-face` load finishes before the screenshot fires.
4. If a composed image (icon + wordmark + tagline, like the splash) needs to be used with `expo-splash-screen`'s `imageWidth`, crop it tight to its actual non-transparent content first — `imageWidth` scales the whole image file, so a small content cluster centered in a mostly-empty canvas renders far smaller on-device than intended. A short `pngjs`-based bounding-box crop script (scan for the first/last non-zero-alpha row/column, slice, re-encode) handles this; there's no ImageMagick or `sharp` in this environment.
5. There's no OS-level image resizer either — a same-ratio downscale (e.g. supersampling a small target like `favicon.png` at 10x and shrinking) needs a hand-rolled alpha-weighted box-downsample, also via `pngjs`.

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
`App.tsx` shows Onboarding until `isOnboarded()` (`expo-secure-store`) is true, then shows the Lock screen on launch and on background→active resume if `hasPin()` is true **and** the app spent at least `RELOCK_AFTER_MS` (2 min, `src/lib/appLock.ts`) in the background — a brief switch-away (photo picker, share sheet) doesn't re-trigger it (Phase 7, spec A2 AC). To get back to a clean "first run" state during dev, clear the app's data (device Settings → Apps → Khata-App → Storage → Clear data, or uninstall/reinstall) — `adb shell pm clear` is blocked on at least one OEM test device, so don't rely on it. The lock re-checks `hasPin()` fresh on every qualifying resume rather than caching it, so a PIN set/changed/removed in Settings takes effect on the very next such resume without needing an app restart.

## Before considering any change "done"
1. `npx tsc --noEmit` passes.
2. `npx expo-doctor` is clean.
3. New/changed user-facing strings exist in both locale files.
4. Mutations on customers/entries/line_items log an audit row.
5. Update `.claude/docs/roadmap.md`'s phase status if a phase's stories are now complete (see its acceptance criteria before marking it done).
