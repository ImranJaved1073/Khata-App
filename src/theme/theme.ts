import { colors } from "./colors";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: "700" as const },
  heading: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  money: { fontSize: 20, fontWeight: "700" as const },
};

export const theme = { colors, spacing, radius, typography } as const;

export type Theme = typeof theme;
