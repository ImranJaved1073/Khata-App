import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

export interface ActionSheetOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBackgroundColor: string;
  iconColor: string;
  label: string;
  description?: string;
  onPress: () => void;
}

/** Themed bottom sheet replacing the OS `Alert.alert` action list (spec's Share sheet / New Entry choice sheet). */
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
  cancelLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  options: ActionSheetOption[];
  cancelLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <View style={styles.subtitle}>{subtitle}</View> : null}

        {options.map((option) => (
          <Pressable
            key={option.key}
            style={styles.optionRow}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => {
              onClose();
              option.onPress();
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: option.iconBackgroundColor }]}>
              <Ionicons name={option.icon} size={22} color={option.iconColor} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              {option.description ? (
                <Text style={styles.optionDescription}>{option.description}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}

        {cancelLabel ? (
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.border,
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title,
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginEnd: theme.spacing.md,
    },
    optionInfo: {
      flex: 1,
      marginEnd: theme.spacing.sm,
    },
    optionLabel: {
      ...theme.typography.heading,
      color: colors.textPrimary,
    },
    optionDescription: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cancelButton: {
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      ...theme.typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
