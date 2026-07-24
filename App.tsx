import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import "./src/i18n";
import { db } from "./src/db/client";
import migrations from "./src/db/drizzle/migrations";
import { seedDemoData } from "./src/db/seed";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { theme } from "./src/theme/theme";

export default function App() {
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);
  const [seedError, setSeedError] = useState<Error | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!migrationsReady) return;
    seedDemoData(db)
      .then(() => setSeeded(true))
      .catch((error: Error) => setSeedError(error));
  }, [migrationsReady]);

  const error = migrationError ?? seedError;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database setup failed: {error.message}</Text>
      </View>
    );
  }

  if (!migrationsReady || !seeded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: "center",
  },
});
