/**
 * Fixed garment color palette (spec section 7.4).
 * Store the label in line_items.color; render the swatch from this hex map.
 */
export const GARMENT_COLORS = {
  White: "#F7F7F5",
  Black: "#1E1E1E",
  "Navy Blue": "#22335B",
  "Sky Blue": "#8FB8DE",
  Maroon: "#7B2D33",
  Red: "#C0392B",
  "Bottle Green": "#20603D",
  Mustard: "#D4A431",
  Beige: "#D9C9A8",
  Grey: "#8A8D91",
  Pink: "#E4A7B8",
  Purple: "#6E4A8E",
  Brown: "#6B4A2F",
  "Off-White / Cream": "#EFE7D3",
} as const;

export type GarmentColorLabel = keyof typeof GARMENT_COLORS;

export const GARMENT_COLOR_LABELS = Object.keys(
  GARMENT_COLORS,
) as GarmentColorLabel[];

/**
 * App-wide semantic colors, one palette per scheme. Both palettes have identical keys.
 * Balance colors follow spec: red = owes shop, green = shop owes them (kept clearly
 * red/green in both schemes, lightened on dark for contrast).
 */
export const lightColors = {
  background: "#FFFFFF",
  surface: "#F7F8FA",
  border: "#E2E5EA",
  textPrimary: "#1E1E1E",
  textSecondary: "#6B7280",
  primary: "#22335B",
  primaryMuted: "#8FB8DE",
  accent: "#D4A431",
  owesMe: "#C0392B",
  iOwe: "#20603D",
  neutralBalance: "#6B7280",
  danger: "#C0392B",
  success: "#20603D",
  /** Text/icon color that reads correctly on top of a `primary`-filled surface. */
  onPrimary: "#FFFFFF",
  /** Soft tint backgrounds for icon chips/avatars — pixel-sampled from design/ mockups, never used for text. */
  primarySoft: "#EAF0F7",
  owesMeSoft: "#F9EBE9",
  iOweSoft: "#E8EFEB",
} as const;

export const darkColors: { [K in keyof typeof lightColors]: string } = {
  background: "#121417",
  surface: "#1C1F25",
  border: "#2C313A",
  textPrimary: "#F2F3F5",
  textSecondary: "#9AA1AC",
  primary: "#4C6FA5",
  primaryMuted: "#3A4A63",
  accent: "#E0B84D",
  owesMe: "#E5705F",
  iOwe: "#4CAF7D",
  neutralBalance: "#9AA1AC",
  danger: "#E5705F",
  success: "#4CAF7D",
  onPrimary: "#FFFFFF",
  primarySoft: "#242B38",
  owesMeSoft: "#3C2C2E",
  iOweSoft: "#233633",
};

export type AppColors = { [K in keyof typeof lightColors]: string };

/** Default (light) palette. Kept as `colors` for static importers such as the PDF/receipt builder, which always renders light. */
export const colors: AppColors = lightColors;

/** `#RRGGBB` + 0-1 alpha -> `rgba(...)`, for the one translucent-tint pattern in the design (the khata balance banner). */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
