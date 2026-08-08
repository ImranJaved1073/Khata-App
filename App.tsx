import { useEffect, useRef, useState } from "react";
import { AppState, Appearance, StyleSheet, Text, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import type { Theme as NavigationTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import "./src/i18n";
import { db } from "./src/db/client";
import migrations from "./src/db/drizzle/migrations";
import { hasPin, isOnboarded, RELOCK_AFTER_MS } from "./src/lib/appLock";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { LockScreen } from "./src/screens/Lock/LockScreen";
import { OnboardingScreen } from "./src/screens/Onboarding/OnboardingScreen";
import { runAutoDriveBackupIfDue } from "./src/repositories/backupRepository";
import { getSettings } from "./src/repositories/settingsRepository";
import { darkColors, lightColors } from "./src/theme/colors";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import type { ThemeMode } from "./src/types/models";

interface BootState {
  themeMode: ThemeMode;
  onboarded: boolean;
  pinSet: boolean;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);
  const [bootError, setBootError] = useState<Error | null>(null);
  const [boot, setBoot] = useState<BootState | null>(null);

  useEffect(() => {
    if (!migrationsReady) return;
    Promise.all([getSettings(db), isOnboarded(), hasPin()])
      .then(([settings, onboardedFlag, pinSet]) => {
        setBoot({ themeMode: settings.themeMode, onboarded: onboardedFlag, pinSet });
      })
      .catch((error: Error) => setBootError(error));
  }, [migrationsReady]);

  const error = migrationError ?? bootError;

  useEffect(() => {
    if (error || boot) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [error, boot]);

  if (error) {
    return <BootScreen>{`Database setup failed: ${error.message}`}</BootScreen>;
  }

  if (!migrationsReady || !boot) {
    return null;
  }

  return (
    <ThemeProvider initialMode={boot.themeMode}>
      <ThemedApp initialOnboarded={boot.onboarded} initialPinSet={boot.pinSet} />
    </ThemeProvider>
  );
}

/**
 * Onboarding and the PIN lock are gates outside the tab navigator (ui.md), not routes inside it.
 * Per spec A2's AC, the lock only re-arms after >= 2 minutes in the background (RELOCK_AFTER_MS),
 * not on every brief switch away (e.g. picking a photo, opening the share sheet). It re-checks
 * `hasPin()` fresh each time rather than trusting stale state, so a PIN set/removed in Settings
 * takes effect on the very next background/foreground cycle.
 */
function ThemedApp({
  initialOnboarded,
  initialPinSet,
}: {
  initialOnboarded: boolean;
  initialPinSet: boolean;
}) {
  const { colors, scheme } = useTheme();
  const [onboarded, setOnboarded] = useState(initialOnboarded);
  const [locked, setLocked] = useState(initialOnboarded && initialPinSet);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current === "active" && nextState.match(/inactive|background/)) {
        backgroundedAt.current = Date.now();
      } else if (appState.current.match(/inactive|background/) && nextState === "active") {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : Infinity;
        if (onboarded && elapsed >= RELOCK_AFTER_MS) {
          hasPin().then((pinSet) => {
            if (pinSet) setLocked(true);
          });
        }
        backgroundedAt.current = null;
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [onboarded]);

  // Fires on first render past onboarding/lock and again on every subsequent unlock — a cheap
  // opportunity to run a silent Drive auto-backup if one is actually due (the interval check
  // lives in runAutoDriveBackupIfDue itself, so most calls here are a no-op settings read).
  useEffect(() => {
    if (onboarded && !locked) {
      runAutoDriveBackupIfDue(db).catch((error: Error) => console.error(error));
    }
  }, [onboarded, locked]);

  const navigationTheme: NavigationTheme = {
    ...(scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === "dark" ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.background,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
      notification: colors.accent,
    },
  };

  let content: React.ReactNode;
  if (!onboarded) {
    content = (
      <OnboardingScreen
        onComplete={() => {
          setOnboarded(true);
          hasPin().then(setLocked);
        }}
      />
    );
  } else if (locked) {
    content = <LockScreen onUnlock={() => setLocked(false)} />;
  } else {
    content = (
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        {content}
        {/* Lock screen is a fixed navy identity regardless of theme (see LockScreen.tsx) — its
            status bar must stay light even when the resolved app theme is otherwise light. */}
        <StatusBar style={locked || scheme === "dark" ? "light" : "dark"} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Shown only if boot fails — follows the OS scheme so there's no light flash in dark mode. */
function BootScreen({ children }: { children: string }) {
  const palette = (Appearance.getColorScheme() ?? "light") === "dark" ? darkColors : lightColors;
  return (
    <View style={[styles.center, { backgroundColor: palette.background }]}>
      <Text style={{ color: palette.danger, textAlign: "center" }}>{children}</Text>
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
