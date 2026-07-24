/**
 * Auto-generated line item description (spec 7.3).
 * Format: {quantity}x {color} {item_name} ({size}) — empty parts are dropped gracefully.
 * Examples: "1x Navy Blue Lawn Kurta (M)", "2x White Kameez" (no size).
 */
export function generateLineItemDescription(params: {
  quantity: number;
  color?: string | null;
  itemName: string;
  size?: string | null;
}): string {
  const { quantity, color, itemName, size } = params;

  const parts = [`${quantity}x`, color?.trim(), itemName.trim()].filter(
    (part): part is string => Boolean(part),
  );

  const base = parts.join(" ");
  return size?.trim() ? `${base} (${size.trim()})` : base;
}
