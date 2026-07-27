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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/Avatar";
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
import { getInitials } from "../../lib/textFormat";
import { getBackupData, isBackupData, restoreBackupData } from "../../repositories/backupRepository";
import { getSettings, updateSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { AppLanguage, Settings } from "../../types/models";

const CURRENCY_PRESETS = ["Rs", "₹", "৳", "$"];

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [billFooterText, setBillFooterText] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);

  useEffect(() => {
    getSettings(db)
      .then((loaded) => {
        setSettings(loaded);
        setBusinessName(loaded.businessName ?? "");
        setCurrencySymbol(loaded.currencySymbol);
        setBillFooterText(loaded.billFooterText ?? "");
      })
      .catch((error: Error) => {
        console.error(error);
        Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
      });
  }, [t]);

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
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLanguageChange(language: AppLanguage) {
    if (!settings || language === settings.language) return;
    try {
      const rtlChanged = await setAppLanguage(language);
      const updated = await updateSettings(db, { language });
      setSettings(updated);
      if (rtlChanged) {
        Alert.alert(t("settings.restartTitle"), t("settings.restartForLanguage"));
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  async function handleThemeChange(nextMode: typeof mode) {
    setMode(nextMode);
    try {
      const updated = await updateSettings(db, { themeMode: nextMode });
      setSettings(updated);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>{t("settings.title")}</Text>

      <Section title={t("settings.businessProfile")}>
        <SettingsRow
          leading={
            <Avatar
              label={getInitials(businessName || t("app.name"))}
              size={44}
              shape="square"
              backgroundColor={colors.primary}
              color={colors.accent}
            />
          }
          label={businessName || t("app.name")}
          labelBold
          hint={t("settings.businessProfileHint")}
          chevron
          expanded={profileExpanded}
          onPress={() => setProfileExpanded((current) => !current)}
        />
        <Divider />
        <SettingsRow
          icon="reader-outline"
          label={t("settings.billFooter")}
          value={billFooterText || "—"}
          onPress={() => setProfileExpanded((current) => !current)}
        />

        {profileExpanded ? (
          <View style={styles.expandedPanel}>
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
              <Pressable
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={profileSaving}
                accessibilityRole="button"
                accessibilityLabel={t("customerForm.save")}
              >
                {profileSaving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>{t("customerForm.save")}</Text>
                )}
              </Pressable>
              {profileSaved ? <Text style={styles.savedText}>{t("settings.saved")}</Text> : null}
            </View>
          </View>
        ) : null}
      </Section>

      <View style={styles.sectionWrapper}>
        <Text style={styles.sectionCaption}>{t("settings.appearanceLanguage").toUpperCase()}</Text>
        <View style={styles.section}>
          <View style={styles.themeCard}>
            <Text style={styles.inlineLabel}>{t("settings.theme")}</Text>
            <ThemeModeSelector value={mode} onChange={handleThemeChange} />
          </View>
        </View>
        <View style={[styles.section, styles.sectionGap]}>
          <SettingsRow
            icon="language-outline"
            label={t("settings.language")}
            hint={t("settings.restartForLanguageShort")}
            hintColor={colors.accent}
            value={settings.language === "ur" ? "اردو" : "English"}
            expanded={languageExpanded}
            onPress={() => setLanguageExpanded((current) => !current)}
          />
          {languageExpanded ? (
            <View style={styles.expandedPanel}>
              <LanguageSelector value={settings.language} onChange={handleLanguageChange} />
            </View>
          ) : null}
        </View>
      </View>

      <Section title={t("settings.securityBackup")}>
        <PinSection
          biometricEnabled={settings.biometricEnabled}
          onBiometricEnabledChange={(value) =>
            setSettings((current) => (current ? { ...current, biometricEnabled: value } : current))
          }
        />
        <Divider />
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
    hasPinStored().then(setHasPinState).catch((error: Error) => console.error(error));
    isBiometricAvailable()
      .then(setBiometricHardware)
      .catch((error: Error) => console.error(error));
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
    } catch (error) {
      console.error(error);
      setError(t("common.errorMessage"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyForChange() {
    setBusy(true);
    try {
      const result = await verifyPin(inputA);
      if (!result.ok) {
        setError(lockoutMessage(result));
        return;
      }
      setInputA("");
      setInputB("");
      setError(null);
      setFlowMode("new-change");
    } catch (error) {
      console.error(error);
      setError(t("common.errorMessage"));
    } finally {
      setBusy(false);
    }
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
    } catch (error) {
      console.error(error);
      setError(t("common.errorMessage"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyForRemove() {
    setBusy(true);
    try {
      const result = await verifyPin(inputA);
      if (!result.ok) {
        setError(lockoutMessage(result));
        return;
      }
      await clearPin();
      await updateSettings(db, { biometricEnabled: false });
      onBiometricEnabledChange(false);
      setHasPinState(false);
      resetFlow();
    } catch (error) {
      console.error(error);
      setError(t("common.errorMessage"));
    } finally {
      setBusy(false);
    }
  }

  async function handleBiometricToggle(value: boolean) {
    try {
      if (value) {
        const ok = await authenticateWithBiometrics(t("lock.biometricPrompt"));
        if (!ok) return;
      }
      await updateSettings(db, { biometricEnabled: value });
      onBiometricEnabledChange(value);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  if (hasPinState === null) {
    return <ActivityIndicator color={colors.primary} />;
  }

  return (
    <View>
      {flowMode === "idle" ? (
        <>
          {!hasPinState ? (
            <SettingsRow
              icon="keypad-outline"
              label={t("settings.setPin")}
              chevron
              onPress={() => setFlowMode("setting")}
            />
          ) : (
            <>
              <SettingsRow
                icon="keypad-outline"
                label={t("settings.changePin")}
                chevron
                onPress={() => setFlowMode("verify-change")}
              />
              <Divider />
              <SettingsRow
                icon="trash-outline"
                label={t("settings.removePin")}
                chevron
                danger
                onPress={() => setFlowMode("verify-remove")}
              />
            </>
          )}
        </>
      ) : null}

      {flowMode === "setting" || flowMode === "new-change" ? (
        <View style={styles.expandedPanel}>
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
            <Pressable
              style={styles.secondaryButton}
              onPress={resetFlow}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("customerForm.cancel")}
            >
              <Text style={styles.secondaryButtonText}>{t("customerForm.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={flowMode === "setting" ? handleSetPin : handleSaveNewPin}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("customerForm.save")}
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
        <View style={styles.expandedPanel}>
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
            <Pressable
              style={styles.secondaryButton}
              onPress={resetFlow}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("customerForm.cancel")}
            >
              <Text style={styles.secondaryButtonText}>{t("customerForm.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={flowMode === "verify-change" ? handleVerifyForChange : handleVerifyForRemove}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.next")}
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

      <Divider />
      <SettingsRow
        icon="finger-print-outline"
        label={t("settings.biometric")}
        hint={
          !hasPinState
            ? t("settings.biometricNeedsPin")
            : !biometricHardware
              ? t("settings.biometricUnavailable")
              : undefined
        }
        trailing={
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            disabled={!hasPinState || !biometricHardware}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.onPrimary}
            accessibilityLabel={t("settings.biometric")}
          />
        }
      />
    </View>
  );
}

function BackupSection() {
  const { t } = useTranslation();
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
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
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
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View>
      <SettingsRow
        icon="cloud-upload-outline"
        label={t("settings.exportBackup")}
        chevron
        busy={busy === "export"}
        disabled={busy !== null}
        onPress={handleExport}
      />
      <Divider />
      <SettingsRow
        icon="time-outline"
        label={t("settings.restore")}
        chevron
        busy={busy === "restore"}
        disabled={busy !== null}
        onPress={confirmRestore}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.sectionWrapper}>
      <Text style={styles.sectionCaption}>{title.toUpperCase()}</Text>
      <View style={styles.section}>{children}</View>
    </View>
  );
}

/** A single tappable settings list row — icon/avatar + label(+hint) on the left, value/switch/chevron on the right. */
function SettingsRow({
  icon,
  leading,
  label,
  labelBold,
  hint,
  hintColor,
  value,
  chevron,
  expanded,
  danger,
  trailing,
  busy,
  disabled,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  label: string;
  labelBold?: boolean;
  hint?: string;
  hintColor?: string;
  value?: string;
  chevron?: boolean;
  expanded?: boolean;
  danger?: boolean;
  trailing?: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const labelColor = danger ? colors.danger : colors.textPrimary;

  const content = (
    <View style={styles.row}>
      {leading ? (
        <View style={styles.rowLeading}>{leading}</View>
      ) : icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.primary}
          style={styles.rowIcon}
        />
      ) : null}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, labelBold && styles.rowLabelBold, { color: labelColor }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.rowHint, hintColor ? { color: hintColor } : null]}>{hint}</Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {!busy && value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {!busy && trailing ? trailing : null}
      {!busy && chevron ? (
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={18}
          color={colors.textSecondary}
          style={styles.rowChevron}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
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
      backgroundColor: colors.surface,
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
    screenTitle: {
      ...theme.typography.title,
      color: colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    sectionWrapper: {
      marginBottom: theme.spacing.lg,
    },
    sectionCaption: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
    },
    section: {
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: theme.spacing.md,
    },
    themeCard: {
      paddingVertical: theme.spacing.md,
    },
    sectionGap: {
      marginTop: theme.spacing.sm,
    },
    inlineLabel: {
      ...theme.typography.body,
      color: colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    rowLeading: {
      marginEnd: theme.spacing.xs,
    },
    rowIcon: {
      width: 24,
      textAlign: "center",
    },
    rowInfo: {
      flex: 1,
    },
    rowLabel: {
      ...theme.typography.body,
    },
    rowLabelBold: {
      ...theme.typography.heading,
    },
    rowHint: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    rowValue: {
      ...theme.typography.body,
      color: colors.textSecondary,
      maxWidth: 140,
    },
    rowChevron: {
      marginStart: theme.spacing.xs,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    expandedPanel: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: theme.spacing.xs,
    },
    currencyChipRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
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
    field: {
      marginBottom: theme.spacing.md,
    },
    fieldLabel: {
      ...theme.typography.body,
      color: colors.textSecondary,
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
      flexDirection: "row",
      gap: theme.spacing.xs,
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
  });
