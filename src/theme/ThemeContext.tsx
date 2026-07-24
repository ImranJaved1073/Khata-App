import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";

import type { ThemeMode } from "../types/models";
import type { AppColors } from "./colors";
import { darkColors, lightColors } from "./colors";
import { radius, spacing, typography } from "./theme";

export type ColorScheme = "light" | "dark";

interface ThemeValue {
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  /** The user's chosen setting: system / light / dark. */
  mode: ThemeMode;
  /** The scheme actually being rendered after resolving "system". */
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  initialMode,
  children,
}: {
  initialMode: ThemeMode;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, []);

  const scheme: ColorScheme = mode === "system" ? systemScheme : mode;
  const colors = scheme === "dark" ? darkColors : lightColors;

  const value = useMemo<ThemeValue>(
    () => ({ colors, spacing, radius, typography, mode, scheme, setMode }),
    [colors, mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}
