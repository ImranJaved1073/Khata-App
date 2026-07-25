import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import {
  authenticateWithBiometrics,
  getLockoutState,
  isBiometricAvailable,
  PIN_LENGTH,
  verifyPin,
} from "../../lib/appLock";
import { getSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

const KEYPAD_ROWS: (string | "biometric" | "backspace" | null)[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["biometric", "0", "backspace"],
];

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const biometricTried = useRef(false);

  useEffect(() => {
    getSettings(db)
      .then((settings) => {
        setBusinessName(settings.businessName);
        if (settings.biometricEnabled) {
          isBiometricAvailable()
            .then((available) => setBiometricReady(available))
            .catch((error: Error) => console.error(error));
        }
      })
      .catch((error: Error) => console.error(error));
    getLockoutState()
      .then((state) => {
        setAttemptsLeft(state.attemptsLeft);
        setLockedUntil(state.lockedUntil);
      })
      .catch((error: Error) => console.error(error));
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0) setLockedUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function tryBiometric() {
    try {
      const ok = await authenticateWithBiometrics(t("lock.biometricPrompt"));
      if (ok) onUnlock();
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (biometricReady && !lockedUntil && !biometricTried.current) {
      biometricTried.current = true;
      tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady, lockedUntil]);

  async function submitPin(candidate: string) {
    setVerifying(true);
    try {
      const result = await verifyPin(candidate);
      if (result.ok) {
        onUnlock();
        return;
      }
      setError(true);
      setPin("");
      setAttemptsLeft(result.lockout.attemptsLeft);
      setLockedUntil(result.lockout.lockedUntil);
      setTimeout(() => setError(false), 400);
    } catch (error) {
      console.error(error);
      setPin("");
    } finally {
      setVerifying(false);
    }
  }

  function handleDigit(digit: string) {
    if (lockedUntil || verifying) return;
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  }

  function handleBackspace() {
    if (lockedUntil || verifying) return;
    setPin((current) => current.slice(0, -1));
  }

  const isLocked = Boolean(lockedUntil);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed" size={28} color={colors.onPrimary} />
        </View>
        <Text style={styles.businessName}>{businessName || t("app.name")}</Text>
        <Text style={styles.title}>{t("lock.enterPin")}</Text>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < pin.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      <View style={styles.statusArea}>
        {verifying ? (
          <ActivityIndicator color={colors.primary} />
        ) : isLocked ? (
          <Text style={styles.errorText}>
            {t("lock.lockedMessage", { seconds: remainingSeconds })}
          </Text>
        ) : error ? (
          <Text style={styles.errorText}>{t("lock.incorrectPin")}</Text>
        ) : attemptsLeft !== null && attemptsLeft < 5 ? (
          <Text style={styles.hintText}>{t("lock.attemptsLeft", { count: attemptsLeft })}</Text>
        ) : null}
      </View>

      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (key === null) return <View key={keyIndex} style={styles.key} />;
              if (key === "biometric") {
                return (
                  <Pressable
                    key={keyIndex}
                    style={styles.key}
                    accessibilityLabel={t("lock.useBiometric")}
                    accessibilityRole="button"
                    onPress={tryBiometric}
                    disabled={!biometricReady || isLocked}
                  >
                    {biometricReady ? (
                      <Ionicons
                        name="finger-print"
                        size={28}
                        color={isLocked ? colors.textSecondary : colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              }
              if (key === "backspace") {
                return (
                  <Pressable
                    key={keyIndex}
                    style={styles.key}
                    accessibilityLabel={t("lock.backspace")}
                    accessibilityRole="button"
                    onPress={handleBackspace}
                    disabled={isLocked}
                  >
                    <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={keyIndex}
                  style={styles.key}
                  onPress={() => handleDigit(key)}
                  disabled={isLocked}
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
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
    },
    header: {
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
    },
    businessName: {
      ...theme.typography.heading,
      color: colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    title: {
      ...theme.typography.body,
      color: colors.textSecondary,
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
    dotError: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    statusArea: {
      height: 24,
      marginBottom: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      ...theme.typography.caption,
      color: colors.danger,
    },
    hintText: {
      ...theme.typography.caption,
      color: colors.textSecondary,
    },
    keypad: {
      gap: theme.spacing.md,
    },
    keypadRow: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },
    key: {
      width: 68,
      height: 68,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    keyText: {
      fontSize: 26,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  });
