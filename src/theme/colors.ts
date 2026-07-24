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

/** App-wide semantic colors. Balance colors follow spec: red = owes shop, green = shop owes them. */
export const colors = {
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
} as const;
