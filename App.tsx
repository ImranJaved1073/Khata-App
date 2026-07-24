import { useEffect, useState } from "react";
import { ActivityIndicator, Appearance, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import type { Theme as NavigationTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import "./src/i18n";
import { db } from "./src/db/client";
import migrations from "./src/db/drizzle/migrations";
import { seedDemoData } from "./src/db/seed";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { getSettings } from "./src/repositories/settingsRepository";
import { darkColors, lightColors } from "./src/theme/colors";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import type { ThemeMode } from "./src/types/models";

export default function App() {
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);
  const [seedError, setSeedError] = useState<Error | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    if (!migrationsReady) return;
    seedDemoData(db)
      .then(() => getSettings(db))
      .then((settings) => setThemeMode(settings.themeMode))
      .catch((error: Error) => setSeedError(error));
  }, [migrationsReady]);

  const error = migrationError ?? seedError;
  if (error) {
    return <BootScreen>{`Database setup failed: ${error.message}`}</BootScreen>;
  }

  if (!migrationsReady || themeMode === null) {
    return <BootScreen />;
  }

  return (
    <ThemeProvider initialMode={themeMode}>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { colors, scheme } = useTheme();

  const navigationTheme: NavigationTheme = {
    ...(scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === "dark" ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
      notification: colors.accent,
    },
  };

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Shown before the theme setting has loaded — follows the OS scheme so there's no light flash in dark mode. */
function BootScreen({ children }: { children?: string }) {
  const palette = (Appearance.getColorScheme() ?? "light") === "dark" ? darkColors : lightColors;
  return (
    <View style={[styles.center, { backgroundColor: palette.background }]}>
      {children ? (
        <Text style={{ color: palette.danger, textAlign: "center" }}>{children}</Text>
      ) : (
        <ActivityIndicator size="large" color={palette.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
