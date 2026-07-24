import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

/** Temporary placeholder used by screens not yet built out past Phase 0. */
export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: theme.spacing.lg,
    },
    title: {
      ...theme.typography.heading,
      color: colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    description: {
      ...theme.typography.body,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });
