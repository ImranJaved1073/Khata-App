import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme/theme";

/** Temporary placeholder used by screens not yet built out past Phase 0. */
export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
