import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

/** Receivable/payable stat card — colour-topped border, direction glyph, big amount, caption. Used on Home and Reports (spec B2/C1/D2 balance colour coding). */
export function StatCard({
  label,
  amount,
  caption,
  color,
  direction,
  onPress,
}: {
  label: string;
  amount: string;
  caption?: string;
  color: string;
  direction: "receivable" | "payable";
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const icon = direction === "receivable" ? "arrow-down-outline" : "arrow-up-outline";

  const content = (
    <View style={[styles.card, { borderTopColor: color }]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.amount, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable style={styles.pressable} onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    pressable: {
      flex: 1,
    },
    card: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      borderTopWidth: 3,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    label: {
      ...theme.typography.body,
      color: colors.textSecondary,
    },
    amount: {
      ...theme.typography.money,
      fontSize: 24,
    },
    caption: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
  });
