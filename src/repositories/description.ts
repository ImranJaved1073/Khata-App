/**
 * Auto-generated line item description (spec 7.3).
 * Format: {quantity} {color} {item_name} ({size}) — empty parts are dropped gracefully.
 * Examples: "1 Navy Blue Lawn Kurta (M)", "2 White Kameez" (no size).
 * (Revised 2026-08-06, user request — dropped the leading "x" after quantity; was
 * "{quantity}x {color} {item_name} ({size})" before. See data-model.md.)
 */
export function generateLineItemDescription(params: {
  quantity: number;
  color?: string | null;
  itemName: string;
  size?: string | null;
}): string {
  const { quantity, color, itemName, size } = params;

  const parts = [`${quantity}`, color?.trim(), itemName.trim()].filter(
    (part): part is string => Boolean(part),
  );

  const base = parts.join(" ");
  return size?.trim() ? `${base} (${size.trim()})` : base;
}
