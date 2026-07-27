import { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

/** Themed centered confirmation dialog for destructive/important confirmations, matching the app's design tokens instead of the plain OS `Alert.alert` look. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    title: {
      ...theme.typography.heading,
      color: colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    message: {
      ...theme.typography.body,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: colors.surface,
    },
    cancelText: {
      ...theme.typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    destructiveButton: {
      backgroundColor: colors.danger,
    },
    confirmText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "600",
    },
  });
