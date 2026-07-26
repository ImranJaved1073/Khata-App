import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import type { CalculatorOperator } from "../../lib/calculator";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type KeypadKey =
  | { kind: "clear" }
  | { kind: "backspace" }
  | { kind: "percent" }
  | { kind: "operator"; op: CalculatorOperator }
  | { kind: "digit"; value: string }
  | { kind: "point" }
  | { kind: "equals" };

const KEYPAD_ROWS: KeypadKey[][] = [
  [{ kind: "clear" }, { kind: "backspace" }, { kind: "percent" }, { kind: "operator", op: "÷" }],
  [
    { kind: "digit", value: "7" },
    { kind: "digit", value: "8" },
    { kind: "digit", value: "9" },
    { kind: "operator", op: "×" },
  ],
  [
    { kind: "digit", value: "4" },
    { kind: "digit", value: "5" },
    { kind: "digit", value: "6" },
    { kind: "operator", op: "-" },
  ],
  [
    { kind: "digit", value: "1" },
    { kind: "digit", value: "2" },
    { kind: "digit", value: "3" },
    { kind: "operator", op: "+" },
  ],
  [{ kind: "digit", value: "00" }, { kind: "digit", value: "0" }, { kind: "point" }, { kind: "equals" }],
];

/** The calculator-style keypad used by the Simple entry amount field (design 10/10b). */
export function CalculatorKeypad({
  accentColor,
  onDigit,
  onPoint,
  onOperator,
  onPercent,
  onClear,
  onBackspace,
  onEquals,
}: {
  accentColor: string;
  onDigit: (digit: string) => void;
  onPoint: () => void;
  onOperator: (op: CalculatorOperator) => void;
  onPercent: () => void;
  onClear: () => void;
  onBackspace: () => void;
  onEquals: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function press(key: KeypadKey) {
    switch (key.kind) {
      case "clear":
        return onClear();
      case "backspace":
        return onBackspace();
      case "percent":
        return onPercent();
      case "operator":
        return onOperator(key.op);
      case "digit":
        return onDigit(key.value);
      case "point":
        return onPoint();
      case "equals":
        return onEquals();
    }
  }

  function labelFor(key: KeypadKey): string {
    switch (key.kind) {
      case "clear":
        return "C";
      case "percent":
        return "%";
      case "operator":
        return key.op;
      case "digit":
        return key.value;
      case "point":
        return ".";
      case "equals":
        return "=";
      case "backspace":
        return "";
    }
  }

  function accessibilityLabelFor(key: KeypadKey): string {
    switch (key.kind) {
      case "clear":
        return t("entry.calcClear");
      case "backspace":
        return t("entry.calcBackspace");
      case "percent":
        return t("entry.calcPercent");
      case "operator":
        return key.op;
      case "digit":
        return key.value;
      case "point":
        return t("entry.calcPoint");
      case "equals":
        return t("entry.calcEquals");
    }
  }

  return (
    <View style={styles.grid}>
      {KEYPAD_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, keyIndex) => {
            const isOperator = key.kind === "operator" || key.kind === "percent";
            const isEquals = key.kind === "equals";
            const isClear = key.kind === "clear";
            return (
              <Pressable
                key={keyIndex}
                style={[
                  styles.key,
                  isOperator && styles.keyOperator,
                  isEquals && { backgroundColor: accentColor },
                ]}
                onPress={() => press(key)}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabelFor(key)}
              >
                {key.kind === "backspace" ? (
                  <Ionicons name="backspace-outline" size={20} color={colors.textSecondary} />
                ) : (
                  <Text
                    style={[
                      styles.keyText,
                      isOperator && styles.keyTextOperator,
                      isClear && styles.keyTextClear,
                      isEquals && styles.keyTextEquals,
                    ]}
                  >
                    {labelFor(key)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    grid: {
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    key: {
      flex: 1,
      aspectRatio: 1.4,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    keyOperator: {
      backgroundColor: colors.primarySoft,
    },
    keyText: {
      ...theme.typography.heading,
      color: colors.textPrimary,
    },
    keyTextOperator: {
      color: colors.primary,
    },
    keyTextClear: {
      color: colors.danger,
      fontWeight: "700",
    },
    keyTextEquals: {
      color: colors.onPrimary,
    },
  });
