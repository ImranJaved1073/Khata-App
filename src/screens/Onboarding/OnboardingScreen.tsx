import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { LanguageSelector } from "../../components/LanguageSelector";
import { db } from "../../db/client";
import { setAppLanguage } from "../../i18n";
import { isBiometricAvailable, PIN_LENGTH, setOnboarded, setPin } from "../../lib/appLock";
import { updateSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { darkColors, lightColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { AppLanguage, ThemeMode } from "../../types/models";

const STEP_COUNT = 3;
const CURRENCY_PRESETS = ["Rs", "₹", "৳", "$"];
const PIN_KEYPAD_ROWS: (string | "backspace" | null)[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [null, "0", "backspace"],
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [pin, setPinInput] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStage, setPinStage] = useState<"enter" | "confirm">("enter");
  const [pinError, setPinError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isBiometricAvailable()
      .then(setBiometricAvailable)
      .catch((error: Error) => console.error(error));
  }, []);

  const pinConfirmed = pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && pin === confirmPin;

  function handlePinDigit(digit: string) {
    if (pinStage === "enter") {
      const next = (pin + digit).slice(0, PIN_LENGTH);
      setPinInput(next);
      if (next.length === PIN_LENGTH) setPinStage("confirm");
      return;
    }
    const next = (confirmPin + digit).slice(0, PIN_LENGTH);
    setConfirmPin(next);
    if (next.length === PIN_LENGTH) {
      if (next === pin) {
        setPinError(null);
      } else {
        setPinError(t("onboarding.pinMismatch"));
        setConfirmPin("");
      }
    }
  }

  function handlePinBackspace() {
    if (pinStage === "confirm") {
      if (confirmPin.length === 0) {
        setPinStage("enter");
        setPinInput((current) => current.slice(0, -1));
        return;
      }
      setConfirmPin((current) => current.slice(0, -1));
      return;
    }
    setPinInput((current) => current.slice(0, -1));
  }

  function clearPinEntry() {
    setPinInput("");
    setConfirmPin("");
    setPinStage("enter");
    setPinError(null);
  }

  async function finish() {
    if ((pin.length > 0 || confirmPin.length > 0) && !pinConfirmed) {
      setPinError(t("onboarding.pinMismatch"));
      return;
    }
    setPinError(null);
    setSaving(true);
    try {
      await updateSettings(db, {
        businessName: businessName.trim() || null,
        currencySymbol: currencySymbol.trim() || "Rs",
        language,
        themeMode: mode,
        biometricEnabled: pinConfirmed && biometricEnabled,
      });

      const rtlChanged = await setAppLanguage(language);

      if (pinConfirmed) {
        await setPin(pin);
      }
      await setOnboarded();

      if (rtlChanged) {
        Alert.alert(t("onboarding.restartTitle"), t("onboarding.restartForLanguage"), [
          { text: t("onboarding.finish"), onPress: onComplete },
        ]);
        return;
      }
      onComplete();
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    setStep((current) => Math.min(current + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <View style={styles.progressRow}>
          {Array.from({ length: STEP_COUNT }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < step && styles.progressDotDone,
                index === step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep(STEP_COUNT - 1)}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.skip")}
          >
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </Pressable>
        ) : null}
      </View>

      {step === 0 ? (
        <View>
          <Text style={styles.title}>{t("onboarding.welcomeTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.welcomeSubtitle")}</Text>

          <Field label={t("onboarding.businessName")}>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              style={styles.input}
              placeholder={t("onboarding.businessNamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
            />
          </Field>

          <Field label={t("onboarding.currency")}>
            <View style={styles.currencyChipRow}>
              {CURRENCY_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  style={[
                    styles.currencyChip,
                    currencySymbol === preset && styles.currencyChipActive,
                  ]}
                  onPress={() => setCurrencySymbol(preset)}
                  accessibilityRole="button"
                  accessibilityLabel={preset}
                  accessibilityState={{ selected: currencySymbol === preset }}
                >
                  <Text
                    style={[
                      styles.currencyChipText,
                      currencySymbol === preset && styles.currencyChipTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label={t("onboarding.language")}>
            <LanguageSelector value={language} onChange={setLanguage} />
          </Field>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={styles.title}>{t("onboarding.appearanceTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.appearanceSubtitle")}</Text>

          <ThemeOption
            mode="light"
            active={mode === "light"}
            label={t("settings.themeLight")}
            hint={t("onboarding.themeLightHint")}
            onPress={() => setMode("light")}
          />
          <ThemeOption
            mode="dark"
            active={mode === "dark"}
            label={t("settings.themeDark")}
            hint={t("onboarding.themeDarkHint")}
            onPress={() => setMode("dark")}
          />
          <ThemeOption
            mode="system"
            active={mode === "system"}
            label={t("settings.themeSystem")}
            hint={t("onboarding.themeSystemHint")}
            onPress={() => setMode("system")}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={styles.title}>{t("onboarding.securityTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.pinHint")}</Text>

          <Text style={styles.pinLabel}>
            {pinStage === "enter" ? t("onboarding.pin") : t("onboarding.confirmPin")}
          </Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index < (pinStage === "enter" ? pin.length : confirmPin.length) &&
                    styles.dotFilled,
                ]}
              />
            ))}
          </View>
          {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
          {pinConfirmed ? (
            <Pressable
              onPress={clearPinEntry}
              accessibilityRole="button"
              accessibilityLabel={t("settings.changePin")}
            >
              <Text style={styles.changePinText}>{t("settings.changePin")}</Text>
            </Pressable>
          ) : (
            <View style={styles.keypad}>
              {PIN_KEYPAD_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((key, keyIndex) => {
                    if (key === null) return <View key={keyIndex} style={styles.key} />;
                    if (key === "backspace") {
                      return (
                        <Pressable
                          key={keyIndex}
                          style={styles.key}
                          onPress={handlePinBackspace}
                          accessibilityRole="button"
                          accessibilityLabel={t("lock.backspace")}
                        >
                          <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable
                        key={keyIndex}
                        style={styles.key}
                        onPress={() => handlePinDigit(key)}
                        accessibilityRole="button"
                        accessibilityLabel={key}
                      >
                        <Text style={styles.keyText}>{key}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {biometricAvailable && pinConfirmed ? (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t("onboarding.enableBiometric")}</Text>
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.onPrimary}
                accessibilityLabel={t("onboarding.enableBiometric")}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable
            style={[styles.button, styles.backButton]}
            onPress={goBack}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.back")}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        {step < STEP_COUNT - 1 ? (
          <Pressable
            style={[styles.button, styles.nextButton, styles.nextButtonFlex]}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.next")}
          >
            <Text style={styles.nextButtonText}>{t("onboarding.next")}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.nextButton, styles.nextButtonFlex]}
            onPress={finish}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.finish")}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.nextButtonText}>{t("onboarding.finish")}</Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function ThemeOption({
  mode,
  active,
  label,
  hint,
  onPress,
}: {
  mode: ThemeMode;
  active: boolean;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.themeOption, active && styles.themeOptionActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <ThemePreview mode={mode} />
      <View style={styles.themeOptionInfo}>
        <Text style={styles.themeOptionLabel}>{label}</Text>
        <Text style={styles.themeOptionHint}>{hint}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (mode === "system") {
    return (
      <View style={[styles.themePreview, styles.themePreviewSplit]}>
        <View style={[styles.themePreviewHalf, { backgroundColor: lightColors.background }]}>
          <View style={[styles.themePreviewBar, { backgroundColor: lightColors.primary }]} />
        </View>
        <View style={[styles.themePreviewHalf, { backgroundColor: darkColors.background }]}>
          <View style={[styles.themePreviewBar, { backgroundColor: darkColors.primary }]} />
        </View>
      </View>
    );
  }
  const isDark = mode === "dark";
  return (
    <View
      style={[
        styles.themePreview,
        { backgroundColor: isDark ? darkColors.background : lightColors.background },
      ]}
    >
      <View
        style={[
          styles.themePreviewBar,
          { backgroundColor: isDark ? darkColors.primary : lightColors.primary },
        ]}
      />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      flexGrow: 1,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xl,
    },
    progressRow: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.border,
    },
    progressDotDone: {
      backgroundColor: colors.primary,
    },
    progressDotActive: {
      width: 24,
      backgroundColor: colors.accent,
    },
    skipText: {
      ...theme.typography.body,
      color: colors.textSecondary,
    },
    title: {
      ...theme.typography.title,
      color: colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      ...theme.typography.body,
      color: colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    field: {
      marginBottom: theme.spacing.md,
    },
    fieldLabel: {
      ...theme.typography.body,
      color: colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    input: {
      ...theme.typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    currencyChipRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    currencyChip: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    currencyChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    currencyChipText: {
      ...theme.typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    currencyChipTextActive: {
      color: colors.onPrimary,
    },
    themeOption: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    themePreview: {
      width: 56,
      height: 72,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.xs,
      overflow: "hidden",
    },
    themePreviewSplit: {
      flexDirection: "row",
      padding: 0,
    },
    themePreviewHalf: {
      flex: 1,
      padding: theme.spacing.xs,
    },
    themePreviewBar: {
      height: 6,
      borderRadius: theme.radius.sm,
    },
    themeOptionInfo: {
      flex: 1,
    },
    themeOptionLabel: {
      ...theme.typography.heading,
      color: colors.textPrimary,
    },
    themeOptionHint: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 12,
      height: 12,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
    },
    pinLabel: {
      ...theme.typography.body,
      color: colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    dotsRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotFilled: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    errorText: {
      ...theme.typography.caption,
      color: colors.danger,
      marginBottom: theme.spacing.sm,
    },
    changePinText: {
      ...theme.typography.body,
      color: colors.primary,
      fontWeight: "600",
      marginBottom: theme.spacing.md,
    },
    keypad: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    keypadRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    key: {
      flex: 1,
      height: 56,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    keyText: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
    },
    switchLabel: {
      ...theme.typography.body,
      color: colors.textPrimary,
      flex: 1,
      marginEnd: theme.spacing.sm,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xl,
    },
    button: {
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    backButton: {
      width: 48,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextButton: {
      flexDirection: "row",
      backgroundColor: colors.primary,
      gap: theme.spacing.sm,
    },
    nextButtonFlex: {
      flex: 1,
    },
    nextButtonText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "600",
    },
  });
