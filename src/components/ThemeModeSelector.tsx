import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";
import type { ThemeMode } from "../types/models";

const MODES: ThemeMode[] = ["system", "light", "dark"];

/** Shared Light/Dark/System segmented control — used by the onboarding wizard and Settings. */
export function ThemeModeSelector({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const labels: Record<ThemeMode, string> = {
    system: t("settings.themeSystem"),
    light: t("settings.themeLight"),
    dark: t("settings.themeDark"),
  };

  return (
    <View style={styles.row}>
      {MODES.map((mode) => {
        const active = value === mode;
        return (
          <Pressable
            key={mode}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityLabel={labels[mode]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {labels[mode]}
            </Text>
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
