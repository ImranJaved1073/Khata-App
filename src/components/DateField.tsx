import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Calendar-driven date picker (spec: tapping opens a calendar, defaults to today). Replaces free-text date entry everywhere. */
export function DateField({
  value,
  onChange,
  label,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  style?: object;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const dateValue = value ? parseDate(value) : new Date();
  const isToday = value === todayDate();
  const displayText = isToday
    ? t("entry.today")
    : dateValue.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  function handleChange(event: { type: string }, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed" || !selected) return;
    onChange(toDateString(selected));
    if (Platform.OS === "ios") setOpen(false);
  }

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? t("entry.date")}
      >
        <Text style={styles.text} numberOfLines={1}>
          {displayText}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          onChange={handleChange}
          maximumDate={new Date()}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    label: {
      ...theme.typography.body,
      color: colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    text: {
      ...theme.typography.body,
      color: colors.textPrimary,
      flex: 1,
      marginEnd: theme.spacing.xs,
    },
  });
