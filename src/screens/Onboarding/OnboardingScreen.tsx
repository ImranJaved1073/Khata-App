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
import { useTranslation } from "react-i18next";

import { LanguageSelector } from "../../components/LanguageSelector";
import { ThemeModeSelector } from "../../components/ThemeModeSelector";
import { db } from "../../db/client";
import { setAppLanguage } from "../../i18n";
import { isBiometricAvailable, PIN_LENGTH, setOnboarded, setPin } from "../../lib/appLock";
import { updateSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { AppLanguage } from "../../types/models";

const STEP_COUNT = 3;

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
  const [pinError, setPinError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isBiometricAvailable()
      .then(setBiometricAvailable)
      .catch((error: Error) => console.error(error));
  }, []);

  async function finish() {
    if (pin.length > 0 || confirmPin.length > 0) {
      if (pin.length !== PIN_LENGTH) {
        setPinError(t("onboarding.pinLength"));
        return;
      }
      if (pin !== confirmPin) {
        setPinError(t("onboarding.pinMismatch"));
        return;
      }
    }
    setPinError(null);
    setSaving(true);
    try {
      await updateSettings(db, {
        businessName: businessName.trim() || null,
        currencySymbol: currencySymbol.trim() || "Rs",
        language,
        themeMode: mode,
        biometricEnabled: pin.length > 0 && biometricEnabled,
      });

      const rtlChanged = await setAppLanguage(language);

      if (pin.length === PIN_LENGTH) {
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
      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[styles.progressDot, index <= step && styles.progressDotActive]}
          />
        ))}
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
            <TextInput
              value={currencySymbol}
              onChangeText={setCurrencySymbol}
              style={styles.input}
              placeholder="Rs"
              placeholderTextColor={colors.textSecondary}
            />
          </Field>

          <Field label={t("onboarding.language")}>
            <LanguageSelector value={language} onChange={setLanguage} />
          </Field>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={styles.title}>{t("onboarding.appearanceTitle")}</Text>
          <Field label={t("onboarding.theme")}>
            <ThemeModeSelector value={mode} onChange={setMode} />
          </Field>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={styles.title}>{t("onboarding.securityTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.pinHint")}</Text>

          <Field label={t("onboarding.pin")}>
            <TextInput
              value={pin}
              onChangeText={(text) => {
                setPinInput(text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH));
                if (pinError) setPinError(null);
              }}
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
          </Field>

          <Field label={t("onboarding.confirmPin")}>
            <TextInput
              value={confirmPin}
              onChangeText={(text) => {
                setConfirmPin(text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH));
                if (pinError) setPinError(null);
              }}
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
          </Field>

          {biometricAvailable && pin.length === PIN_LENGTH ? (
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
            <Text style={styles.backButtonText}>{t("onboarding.back")}</Text>
          </Pressable>
        ) : null}
        {step < STEP_COUNT - 1 ? (
          <Pressable
            style={[styles.button, styles.nextButton]}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.next")}
          >
            <Text style={styles.nextButtonText}>{t("onboarding.next")}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.nextButton]}
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
    progressRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
      justifyContent: "center",
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.border,
    },
    progressDotActive: {
      backgroundColor: colors.primary,
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
    errorText: {
      ...theme.typography.caption,
      color: colors.danger,
      marginTop: theme.spacing.xs,
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
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    backButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonText: {
      ...theme.typography.body,
      color: colors.textPrimary,
    },
    nextButton: {
      backgroundColor: colors.primary,
    },
    nextButtonText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "600",
    },
  });
