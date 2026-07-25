import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";
import type { AppLanguage } from "../types/models";

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
];

/** Shared English/Urdu selector — used by the onboarding wizard and Settings. */
export function LanguageSelector({
  value,
  onChange,
}: {
  value: AppLanguage;
  onChange: (language: AppLanguage) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {LANGUAGES.map(({ code, label }) => {
        const active = value === code;
        return (
          <Pressable
            key={code}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(code)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    option: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    optionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      ...theme.typography.body,
      color: colors.textPrimary,
    },
    optionTextActive: {
      color: colors.onPrimary,
      fontWeight: "600",
    },
  });
