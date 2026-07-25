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
import {
  authenticateWithBiometrics,
  clearPin,
  hasPin as hasPinStored,
  isBiometricAvailable,
  PIN_LENGTH,
  setPin as savePin,
  verifyPin,
} from "../../lib/appLock";
import { BACKUP_FILE_NAME, BACKUP_MIME, pickBackupFile } from "../../lib/backupFile";
import { writeAndShareFile } from "../../lib/exportFile";
import { getBackupData, isBackupData, restoreBackupData } from "../../repositories/backupRepository";
import { getSettings, updateSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { AppLanguage, Settings } from "../../types/models";

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [billFooterText, setBillFooterText] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    getSettings(db).then((loaded) => {
      setSettings(loaded);
      setBusinessName(loaded.businessName ?? "");
      setCurrencySymbol(loaded.currencySymbol);
      setBillFooterText(loaded.billFooterText ?? "");
    });
  }, []);

  async function handleSaveProfile() {
    setProfileSaving(true);
    try {
      const updated = await updateSettings(db, {
        businessName: businessName.trim() || null,
        currencySymbol: currencySymbol.trim() || "Rs",
        billFooterText: billFooterText.trim() || null,
      });
      setSettings(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1500);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLanguageChange(language: AppLanguage) {
    if (!settings || language === settings.language) return;
    const rtlChanged = await setAppLanguage(language);
    const updated = await updateSettings(db, { language });
    setSettings(updated);
    if (rtlChanged) {
      Alert.alert(t("settings.restartTitle"), t("settings.restartForLanguage"));
    }
  }

  async function handleThemeChange(nextMode: typeof mode) {
    setMode(nextMode);
    const updated = await updateSettings(db, { themeMode: nextMode });
    setSettings(updated);
  }

  if (!settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section title={t("settings.businessProfile")}>
        <Field label={t("onboarding.businessName")}>
          <TextInput
            value={businessName}
            onChangeText={setBusinessName}
            style={styles.input}
            placeholder={t("onboarding.businessNamePlaceholder")}
            placeholderTextColor={colors.textSecondary}
          />
        </Field>
        <Field label={t("settings.currency")}>
          <TextInput
            value={currencySymbol}
            onChangeText={setCurrencySymbol}
            style={styles.input}
            placeholder="Rs"
            placeholderTextColor={colors.textSecondary}
          />
        </Field>
        <Field label={t("settings.billFooter")}>
          <TextInput
            value={billFooterText}
            onChangeText={setBillFooterText}
            style={[styles.input, styles.multilineInput]}
            placeholder={t("settings.billFooter")}
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </Field>
        <View style={styles.saveRow}>
          <Pressable style={styles.saveButton} onPress={handleSaveProfile} disabled={profileSaving}>
            {profileSaving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>{t("customerForm.save")}</Text>
            )}
          </Pressable>
          {profileSaved ? <Text style={styles.savedText}>{t("settings.saved")}</Text> : null}
        </View>
      </Section>

      <Section title={t("settings.language")}>
        <LanguageSelector value={settings.language} onChange={handleLanguageChange} />
      </Section>

      <Section title={t("settings.appearance")}>
        <ThemeModeSelector value={mode} onChange={handleThemeChange} />
      </Section>

      <Section title={t("settings.security")}>
        <PinSection
          biometricEnabled={settings.biometricEnabled}
          onBiometricEnabledChange={(value) =>
            setSettings((current) => (current ? { ...current, biometricEnabled: value } : current))
          }
        />
      </Section>

      <Section title={t("settings.backupRestore")}>
        <BackupSection />
      </Section>
    </ScrollView>
  );
}

function PinSection({
  biometricEnabled,
  onBiometricEnabledChange,
}: {
  biometricEnabled: boolean;
  onBiometricEnabledChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hasPinState, setHasPinState] = useState<boolean | null>(null);
  const [biometricHardware, setBiometricHardware] = useState(false);
  const [flowMode, setFlowMode] = useState<
    "idle" | "setting" | "verify-change" | "new-change" | "verify-remove"
  >("idle");
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hasPinStored().then(setHasPinState);
    isBiometricAvailable().then(setBiometricHardware);
  }, []);

  function resetFlow() {
    setInputA("");
    setInputB("");
    setError(null);
    setFlowMode("idle");
  }

  function lockoutMessage(result: Awaited<ReturnType<typeof verifyPin>>): string {
    return result.lockout.lockedUntil ? t("settings.pinLocked") : t("settings.pinIncorrect");
  }

  async function handleSetPin() {
    if (inputA.length !== PIN_LENGTH) {
      setError(t("onboarding.pinLength"));
      return;
    }
    if (inputA !== inputB) {
      setError(t("onboarding.pinMismatch"));
      return;
    }
    setBusy(true);
    try {
      await savePin(inputA);
      setHasPinState(true);
      resetFlow();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyForChange() {
    setBusy(true);
    const result = await verifyPin(inputA);
    setBusy(false);
    if (!result.ok) {
      setError(lockoutMessage(result));
      return;
    }
    setInputA("");
    setInputB("");
    setError(null);
    setFlowMode("new-change");
  }

  async function handleSaveNewPin() {
    if (inputA.length !== PIN_LENGTH) {
      setError(t("onboarding.pinLength"));
      return;
    }
    if (inputA !== inputB) {
      setError(t("onboarding.pinMismatch"));
      return;
    }
    setBusy(true);
    try {
      await savePin(inputA);
      resetFlow();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyForRemove() {
    setBusy(true);
    const result = await verifyPin(inputA);
    if (!result.ok) {
      setBusy(false);
      setError(lockoutMessage(result));
      return;
    }
    await clearPin();
    await updateSettings(db, { biometricEnabled: false });
    onBiometricEnabledChange(false);
    setBusy(false);
    setHasPinState(false);
    resetFlow();
  }

  async function handleBiometricToggle(value: boolean) {
    if (value) {
      const ok = await authenticateWithBiometrics(t("lock.biometricPrompt"));
      if (!ok) return;
    }
    await updateSettings(db, { biometricEnabled: value });
    onBiometricEnabledChange(value);
  }

  if (hasPinState === null) {
    return <ActivityIndicator color={colors.primary} />;
  }

  return (
    <View>
      {flowMode === "idle" ? (
        <View style={styles.pinButtonRow}>
          {!hasPinState ? (
            <Pressable style={styles.secondaryButton} onPress={() => setFlowMode("setting")}>
              <Text style={styles.secondaryButtonText}>{t("settings.setPin")}</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setFlowMode("verify-change")}
              >
                <Text style={styles.secondaryButtonText}>{t("settings.changePin")}</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setFlowMode("verify-remove")}
              >
                <Text style={styles.dangerButtonText}>{t("settings.removePin")}</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {flowMode === "setting" || flowMode === "new-change" ? (
        <View>
          <Field label={flowMode === "setting" ? t("onboarding.pin") : t("settings.newPin")}>
            <TextInput
              value={inputA}
              onChangeText={(text) => setInputA(text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
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
              value={inputB}
              onChangeText={(text) => setInputB(text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
          </Field>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.pinButtonRow}>
            <Pressable style={styles.secondaryButton} onPress={resetFlow} disabled={busy}>
              <Text style={styles.secondaryButtonText}>{t("customerForm.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={flowMode === "setting" ? handleSetPin : handleSaveNewPin}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>{t("customerForm.save")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {flowMode === "verify-change" || flowMode === "verify-remove" ? (
        <View>
          <Field label={t("settings.currentPin")}>
            <TextInput
              value={inputA}
              onChangeText={(text) => setInputA(text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH))}
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
          </Field>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.pinButtonRow}>
            <Pressable style={styles.secondaryButton} onPress={resetFlow} disabled={busy}>
              <Text style={styles.secondaryButtonText}>{t("customerForm.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={flowMode === "verify-change" ? handleVerifyForChange : handleVerifyForRemove}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>{t("onboarding.next")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {hasPinState && biometricHardware ? (
        <View style={[styles.switchRow, styles.biometricRow]}>
          <Text style={styles.switchLabel}>{t("settings.biometric")}</Text>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.onPrimary}
          />
        </View>
      ) : null}
    </View>
  );
}

function BackupSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);

  async function handleExport() {
    setBusy("export");
    try {
      const data = await getBackupData(db);
      const shared = await writeAndShareFile({
        fileName: BACKUP_FILE_NAME,
        contents: JSON.stringify(data, null, 2),
        encoding: "utf8",
        mimeType: BACKUP_MIME,
      });
      if (!shared) Alert.alert(t("share.unavailable"));
    } finally {
      setBusy(null);
    }
  }

  function confirmRestore() {
    Alert.alert(t("settings.restoreConfirmTitle"), t("settings.restoreConfirmMessage"), [
      { text: t("customerForm.cancel"), style: "cancel" },
      { text: t("settings.restore"), style: "destructive", onPress: runRestore },
    ]);
  }

  async function runRestore() {
    setBusy("restore");
    try {
      const picked = await pickBackupFile();
      if (picked.status === "unsupported") {
        Alert.alert(t("settings.restoreUnsupported"));
        return;
      }
      if (picked.status === "cancelled") return;
      if (picked.status === "not-found") {
        Alert.alert(t("settings.restoreNotFound", { fileName: BACKUP_FILE_NAME }));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(picked.contents);
      } catch {
        Alert.alert(t("settings.restoreInvalid"));
        return;
      }
      if (!isBackupData(parsed)) {
        Alert.alert(t("settings.restoreInvalid"));
        return;
      }

      await restoreBackupData(db, parsed);
      Alert.alert(t("settings.restoreSuccessTitle"), t("settings.restoreSuccessMessage"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.pinButtonRow}>
      <Pressable style={styles.secondaryButton} onPress={handleExport} disabled={busy !== null}>
        {busy === "export" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>{t("settings.exportBackup")}</Text>
        )}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={confirmRestore} disabled={busy !== null}>
        {busy === "restore" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.dangerButtonText}>{t("settings.restore")}</Text>
        )}
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    content: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      ...theme.typography.heading,
      color: colors.textPrimary,
      marginBottom: theme.spacing.md,
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
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    multilineInput: {
      minHeight: 60,
      textAlignVertical: "top",
    },
    errorText: {
      ...theme.typography.caption,
      color: colors.danger,
      marginBottom: theme.spacing.sm,
    },
    saveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    saveButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "600",
    },
    savedText: {
      ...theme.typography.caption,
      color: colors.success,
    },
    pinButtonRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      ...theme.typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    dangerButtonText: {
      ...theme.typography.body,
      color: colors.danger,
      fontWeight: "600",
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
    },
    biometricRow: {
      marginTop: theme.spacing.sm,
    },
    switchLabel: {
      ...theme.typography.body,
      color: colors.textPrimary,
      flex: 1,
      marginEnd: theme.spacing.sm,
    },
  });
