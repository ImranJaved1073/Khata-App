import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import { generateLineItemDescription } from "../../repositories/description";
import type { AppColors, GarmentColorLabel } from "../../theme/colors";
import { GARMENT_COLOR_LABELS, GARMENT_COLORS } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

export const GARMENT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export const NUMERIC_SIZES = ["30", "32", "34", "36", "38", "40", "42"] as const;

export interface CategoryPreset {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  sizeMode: "named" | "numeric";
}

/** Common categories (spec-free UX helper, not persisted — see architecture notes on line_items.category). */
export const CATEGORY_PRESETS: CategoryPreset[] = [
  { label: "T-Shirt", icon: "shirt-outline", sizeMode: "named" },
  { label: "Shirt", icon: "shirt-outline", sizeMode: "named" },
  { label: "Kurta", icon: "shirt-outline", sizeMode: "named" },
  { label: "Dress Pants", icon: "walk-outline", sizeMode: "numeric" },
  { label: "Jeans", icon: "walk-outline", sizeMode: "numeric" },
  { label: "Dupatta", icon: "layers-outline", sizeMode: "named" },
  { label: "Kids Wear", icon: "shirt-outline", sizeMode: "named" },
];

const DEFAULT_CATEGORY_ICON: keyof typeof Ionicons.glyphMap = "pricetag-outline";

/** Default category + item name for a brand-new line item (user request — this shop's items are overwhelmingly dress pants). Still fully editable. */
export const DEFAULT_LINE_ITEM_CATEGORY = "Dress Pants";

function findCategoryPreset(label: string | null): CategoryPreset | undefined {
  if (!label) return undefined;
  const normalized = label.trim().toLowerCase();
  return CATEGORY_PRESETS.find((preset) => preset.label.toLowerCase() === normalized);
}

export function categoryIcon(label: string | null): keyof typeof Ionicons.glyphMap {
  return findCategoryPreset(label)?.icon ?? DEFAULT_CATEGORY_ICON;
}

export function categorySizeMode(label: string | null): "named" | "numeric" {
  return findCategoryPreset(label)?.sizeMode ?? "named";
}

function sizeListFor(mode: "named" | "numeric"): readonly string[] {
  return mode === "numeric" ? NUMERIC_SIZES : GARMENT_SIZES;
}

/** Deterministic fallback dot color for a freeform colour label that matches nothing known. */
function hashColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

/**
 * Standard CSS/X11 named colors (lowercase name -> hex), so a freeform colour that happens to
 * match a common name (e.g. "blue") renders its real color instead of an arbitrary hashed one.
 * Independent of the fixed 14-label garment palette above — this is a much larger, generic set.
 */
const CSS_NAMED_COLORS: Record<string, string> = {
  aliceblue: "#F0F8FF", antiquewhite: "#FAEBD7", aqua: "#00FFFF", aquamarine: "#7FFFD4",
  azure: "#F0FFFF", beige: "#F5F5DC", bisque: "#FFE4C4", black: "#000000",
  blanchedalmond: "#FFEBCD", blue: "#0000FF", blueviolet: "#8A2BE2", brown: "#A52A2A",
  burlywood: "#DEB887", cadetblue: "#5F9EA0", chartreuse: "#7FFF00", chocolate: "#D2691E",
  coral: "#FF7F50", cornflowerblue: "#6495ED", cornsilk: "#FFF8DC", crimson: "#DC143C",
  cyan: "#00FFFF", darkblue: "#00008B", darkcyan: "#008B8B", darkgoldenrod: "#B8860B",
  darkgray: "#A9A9A9", darkgreen: "#006400", darkgrey: "#A9A9A9", darkkhaki: "#BDB76B",
  darkmagenta: "#8B008B", darkolivegreen: "#556B2F", darkorange: "#FF8C00", darkorchid: "#9932CC",
  darkred: "#8B0000", darksalmon: "#E9967A", darkseagreen: "#8FBC8F", darkslateblue: "#483D8B",
  darkslategray: "#2F4F4F", darkslategrey: "#2F4F4F", darkturquoise: "#00CED1", darkviolet: "#9400D3",
  deeppink: "#FF1493", deepskyblue: "#00BFFF", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1E90FF", firebrick: "#B22222", floralwhite: "#FFFAF0", forestgreen: "#228B22",
  fuchsia: "#FF00FF", gainsboro: "#DCDCDC", ghostwhite: "#F8F8FF", gold: "#FFD700",
  goldenrod: "#DAA520", gray: "#808080", green: "#008000", greenyellow: "#ADFF2F",
  grey: "#808080", honeydew: "#F0FFF0", hotpink: "#FF69B4", indianred: "#CD5C5C",
  indigo: "#4B0082", ivory: "#FFFFF0", khaki: "#F0E68C", lavender: "#E6E6FA",
  lavenderblush: "#FFF0F5", lawngreen: "#7CFC00", lemonchiffon: "#FFFACD", lightblue: "#ADD8E6",
  lightcoral: "#F08080", lightcyan: "#E0FFFF", lightgoldenrodyellow: "#FAFAD2", lightgray: "#D3D3D3",
  lightgreen: "#90EE90", lightgrey: "#D3D3D3", lightpink: "#FFB6C1", lightsalmon: "#FFA07A",
  lightseagreen: "#20B2AA", lightskyblue: "#87CEFA", lightslategray: "#778899", lightslategrey: "#778899",
  lightsteelblue: "#B0C4DE", lightyellow: "#FFFFE0", lime: "#00FF00", limegreen: "#32CD32",
  linen: "#FAF0E6", magenta: "#FF00FF", maroon: "#800000", mediumaquamarine: "#66CDAA",
  mediumblue: "#0000CD", mediumorchid: "#BA55D3", mediumpurple: "#9370DB", mediumseagreen: "#3CB371",
  mediumslateblue: "#7B68EE", mediumspringgreen: "#00FA9A", mediumturquoise: "#48D1CC", mediumvioletred: "#C71585",
  midnightblue: "#191970", mintcream: "#F5FFFA", mistyrose: "#FFE4E1", moccasin: "#FFE4B5",
  navajowhite: "#FFDEAD", navy: "#000080", oldlace: "#FDF5E6", olive: "#808000",
  olivedrab: "#6B8E23", orange: "#FFA500", orangered: "#FF4500", orchid: "#DA70D6",
  palegoldenrod: "#EEE8AA", palegreen: "#98FB98", paleturquoise: "#AFEEEE", palevioletred: "#DB7093",
  papayawhip: "#FFEFD5", peachpuff: "#FFDAB9", peru: "#CD853F", pink: "#FFC0CB",
  plum: "#DDA0DD", powderblue: "#B0E0E6", purple: "#800080", rebeccapurple: "#663399",
  red: "#FF0000", rosybrown: "#BC8F8F", royalblue: "#4169E1", saddlebrown: "#8B4513",
  salmon: "#FA8072", sandybrown: "#F4A460", seagreen: "#2E8B57", seashell: "#FFF5EE",
  sienna: "#A0522D", silver: "#C0C0C0", skyblue: "#87CEEB", slateblue: "#6A5ACD",
  slategray: "#708090", slategrey: "#708090", snow: "#FFFAFA", springgreen: "#00FF7F",
  steelblue: "#4682B4", tan: "#D2B48C", teal: "#008080", thistle: "#D8BFD8",
  tomato: "#FF6347", turquoise: "#40E0D0", violet: "#EE82EE", wheat: "#F5DEB3",
  white: "#FFFFFF", whitesmoke: "#F5F5F5", yellow: "#FFFF00", yellowgreen: "#9ACD32",
};

function cssNamedColor(label: string): string | null {
  return CSS_NAMED_COLORS[label.trim().toLowerCase()] ?? null;
}

/** Fixed-palette hex, then a common CSS/X11 color name, then a stable hashed color as a last resort. */
export function swatchColorFor(label: string | null): string | null {
  if (!label) return null;
  return GARMENT_COLORS[label as GarmentColorLabel] ?? cssNamedColor(label) ?? hashColor(label);
}

function matchesKnownLabel(query: string, labels: readonly string[]): boolean {
  const normalized = query.trim().toLowerCase();
  return labels.some((label) => label.toLowerCase() === normalized);
}

export interface BillLineItemState {
  key: string;
  /** UX-only helper (picks the icon + Named/Numeric size list) — not persisted to line_items. */
  category: string | null;
  itemName: string;
  size: string | null;
  isCustomSize: boolean;
  color: string | null;
  quantity: number;
  rateInput: string;
  description: string;
  descriptionTouched: boolean;
}

export function buildInitialLineItem(key: string): BillLineItemState {
  const quantity = 1;
  const itemName = DEFAULT_LINE_ITEM_CATEGORY;
  return {
    key,
    category: DEFAULT_LINE_ITEM_CATEGORY,
    itemName,
    size: null,
    isCustomSize: false,
    color: null,
    quantity,
    rateInput: formatMoneyInput(0),
    description: generateLineItemDescription({ quantity, color: null, itemName, size: null }),
    descriptionTouched: false,
  };
}

/** The single open line-item form. Only one of these is ever on screen at a time. */
export function BillLineItemCard({
  item,
  label,
  currencySymbol,
  onChange,
  onRemove,
  extraColorOptions,
}: {
  item: BillLineItemState;
  label: string;
  currencySymbol: string;
  onChange: (next: BillLineItemState) => void;
  onRemove?: () => void;
  /** Custom colours already used elsewhere in this bill, offered as quick-reuse chips. */
  extraColorOptions?: string[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rate = parseMoneyInput(item.rateInput);
  const amount = item.quantity * rate;

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [colorQuery, setColorQuery] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);

  function update(patch: Partial<BillLineItemState>) {
    onChange({ ...item, ...patch });
  }

  const sizeMode = categorySizeMode(item.category);
  const sizeList = sizeListFor(sizeMode);
  const categoryPresetLabels = useMemo(() => CATEGORY_PRESETS.map((preset) => preset.label), []);

  function selectCategory(value: string) {
    const nextMode = categorySizeMode(value);
    const currentSizeStillValid = item.isCustomSize
      ? true
      : Boolean(item.size) && sizeListFor(nextMode).includes(item.size as string);
    update({
      category: value,
      ...(currentSizeStillValid ? {} : { size: null, isCustomSize: false }),
    });
    setCategoryOpen(false);
    setCategoryQuery("");
  }

  function selectColor(value: string) {
    update({ color: value });
    setColorOpen(false);
    setColorQuery("");
  }

  const colorSwatch = swatchColorFor(item.color);
  const trimmedCategoryQuery = categoryQuery.trim();
  const trimmedColorQuery = colorQuery.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{label}</Text>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityLabel={t("entry.removeLine")}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.fieldLabel}>{t("entry.category")}</Text>
      <Pressable
        style={styles.dropdownField}
        onPress={() => {
          setColorOpen(false);
          setCategoryQuery(item.category ?? "");
          setCategoryOpen((open) => !open);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("entry.category")}
        accessibilityState={{ expanded: categoryOpen }}
      >
        <Ionicons
          name={categoryIcon(item.category)}
          size={18}
          color={colors.primary}
          style={styles.dropdownFieldLeading}
        />
        <Text
          style={[styles.dropdownFieldText, !item.category && styles.dropdownFieldPlaceholder]}
          numberOfLines={1}
        >
          {item.category ?? t("entry.selectCategory")}
        </Text>
        <Ionicons
          name={categoryOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {categoryOpen ? (
        <View style={styles.dropdownPanel}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              value={categoryQuery}
              onChangeText={setCategoryQuery}
              style={styles.searchInput}
              placeholder={t("entry.categorySearchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          </View>
          <Text style={styles.dropdownSectionLabel}>{t("entry.commonCategories")}</Text>
          <View style={styles.chipRow}>
            {CATEGORY_PRESETS.map((preset) => (
              <Pressable
                key={preset.label}
                style={[styles.chip, item.category === preset.label && styles.chipActive]}
                onPress={() => selectCategory(preset.label)}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: item.category === preset.label }}
              >
                <Text
                  style={[styles.chipText, item.category === preset.label && styles.chipTextActive]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {trimmedCategoryQuery && !matchesKnownLabel(trimmedCategoryQuery, categoryPresetLabels) ? (
            <Pressable
              style={styles.addNewRow}
              onPress={() => selectCategory(trimmedCategoryQuery)}
              accessibilityRole="button"
              accessibilityLabel={t("entry.addCategoryAsNew", { value: trimmedCategoryQuery })}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addNewRowText}>
                {t("entry.addCategoryAsNew", { value: trimmedCategoryQuery })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={item.itemName}
        onChangeText={(text) => update({ itemName: text })}
        style={styles.input}
        placeholder={t("entry.itemName")}
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.sizeHeaderRow}>
        <Text style={styles.fieldLabel}>
          {sizeMode === "numeric" ? t("entry.sizeWaistLabel") : t("entry.size")}
        </Text>
        <View
          style={[
            styles.sizeModeBadge,
            sizeMode === "numeric" ? styles.sizeModeBadgeNumeric : styles.sizeModeBadgeNamed,
          ]}
        >
          <Text
            style={[
              styles.sizeModeBadgeText,
              { color: sizeMode === "numeric" ? colors.primary : colors.textSecondary },
            ]}
          >
            {sizeMode === "numeric" ? t("entry.sizeModeNumeric") : t("entry.sizeModeNamed")}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {sizeList.map((size) => (
          <Pressable
            key={size}
            style={[styles.chip, !item.isCustomSize && item.size === size && styles.chipActive]}
            onPress={() => update({ size, isCustomSize: false })}
            accessibilityRole="button"
            accessibilityLabel={size}
            accessibilityState={{ selected: !item.isCustomSize && item.size === size }}
          >
            <Text
              style={[
                styles.chipText,
                !item.isCustomSize && item.size === size && styles.chipTextActive,
              ]}
            >
              {size}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, item.isCustomSize && styles.chipActive]}
          onPress={() => update({ size: "", isCustomSize: true })}
          accessibilityRole="button"
          accessibilityLabel={t("entry.customSize")}
          accessibilityState={{ selected: item.isCustomSize }}
        >
          <Text style={[styles.chipText, item.isCustomSize && styles.chipTextActive]}>
            {t("entry.customSize")}
          </Text>
        </Pressable>
      </View>
      {item.isCustomSize ? (
        <View style={styles.customSizeBox}>
          <Text style={styles.customSizeLabel}>{t("entry.enterSize")}</Text>
          <TextInput
            value={item.size ?? ""}
            onChangeText={(text) => update({ size: text })}
            style={styles.input}
            placeholder={t("entry.customSize")}
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.customSizeHint}>{t("entry.customSizeHint")}</Text>
        </View>
      ) : (
        <Text style={styles.sizeHintText}>
          {sizeMode === "numeric" ? t("entry.sizeHintNumeric") : t("entry.sizeHintNamed")}
        </Text>
      )}

      <Text style={styles.fieldLabel}>{t("entry.color")}</Text>
      <Pressable
        style={styles.dropdownField}
        onPress={() => {
          setCategoryOpen(false);
          setColorQuery(item.color ?? "");
          setColorOpen((open) => !open);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("entry.color")}
        accessibilityState={{ expanded: colorOpen }}
      >
        <View
          style={[
            styles.swatchDot,
            styles.dropdownFieldLeading,
            colorSwatch ? { backgroundColor: colorSwatch } : styles.swatchDotEmpty,
          ]}
        />
        <Text
          style={[styles.dropdownFieldText, !item.color && styles.dropdownFieldPlaceholder]}
          numberOfLines={1}
        >
          {item.color ?? t("entry.selectColor")}
        </Text>
        <Ionicons
          name={colorOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {colorOpen ? (
        <View style={styles.dropdownPanel}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              value={colorQuery}
              onChangeText={setColorQuery}
              style={styles.searchInput}
              placeholder={t("entry.colorSearchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          </View>
          <Text style={styles.dropdownSectionLabel}>{t("entry.commonColors")}</Text>
          <View style={styles.chipRow}>
            {GARMENT_COLOR_LABELS.map((swatchLabel) => (
              <Pressable
                key={swatchLabel}
                style={[styles.chip, styles.colorChip, item.color === swatchLabel && styles.chipActive]}
                onPress={() => selectColor(swatchLabel)}
                accessibilityRole="button"
                accessibilityLabel={swatchLabel}
                accessibilityState={{ selected: item.color === swatchLabel }}
              >
                <View style={[styles.swatchDot, styles.colorChipDot, { backgroundColor: GARMENT_COLORS[swatchLabel] }]} />
                <Text style={[styles.chipText, item.color === swatchLabel && styles.chipTextActive]}>
                  {swatchLabel}
                </Text>
              </Pressable>
            ))}
          </View>
          {extraColorOptions && extraColorOptions.length > 0 ? (
            <>
              <Text style={styles.dropdownSectionLabel}>{t("entry.usedInThisBill")}</Text>
              <View style={styles.chipRow}>
                {extraColorOptions.map((label) => (
                  <Pressable
                    key={label}
                    style={[styles.chip, styles.colorChip, item.color === label && styles.chipActive]}
                    onPress={() => selectColor(label)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: item.color === label }}
                  >
                    <View
                      style={[
                        styles.swatchDot,
                        styles.colorChipDot,
                        { backgroundColor: swatchColorFor(label) ?? colors.border },
                      ]}
                    />
                    <Text style={[styles.chipText, item.color === label && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {trimmedColorQuery && !matchesKnownLabel(trimmedColorQuery, GARMENT_COLOR_LABELS) ? (
            <Pressable
              style={styles.addNewRow}
              onPress={() => selectColor(trimmedColorQuery)}
              accessibilityRole="button"
              accessibilityLabel={t("entry.addColorAsNew", { value: trimmedColorQuery })}
            >
              <View style={[styles.swatchDot, { backgroundColor: swatchColorFor(trimmedColorQuery) ?? hashColor(trimmedColorQuery) }]} />
              <Text style={styles.addNewRowText}>
                {t("entry.addColorAsNew", { value: trimmedColorQuery })}
              </Text>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.quantityField}>
          <Text style={styles.fieldLabel}>{t("entry.quantity")}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              accessibilityLabel={t("entry.quantityDecrease")}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => update({ quantity: Math.max(1, item.quantity - 1) })}
            >
              <Ionicons name="remove" size={18} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.stepperValue}>{item.quantity}</Text>
            <Pressable
              style={styles.stepperButton}
              accessibilityLabel={t("entry.quantityIncrease")}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => update({ quantity: item.quantity + 1 })}
            >
              <Ionicons name="add" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.rateField}>
          <Text style={styles.fieldLabel}>{t("entry.rate")}</Text>
          <TextInput
            value={item.rateInput}
            onChangeText={(text) => update({ rateInput: text })}
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      {item.descriptionTouched ? (
        <>
          <View style={styles.descriptionHeaderRow}>
            <Text style={styles.fieldLabel}>{t("entry.description")}</Text>
            <Pressable
              onPress={() => update({ descriptionTouched: false })}
              accessibilityRole="button"
              accessibilityLabel={t("entry.resetDescription")}
              hitSlop={8}
            >
              <Text style={styles.resetDescriptionText}>{t("entry.resetDescription")}</Text>
            </Pressable>
          </View>
          <TextInput
            value={item.description}
            onChangeText={(text) => update({ description: text, descriptionTouched: true })}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
        </>
      ) : editingDescription ? (
        <TextInput
          value={item.description}
          onChangeText={(text) => update({ description: text, descriptionTouched: true })}
          onBlur={() => setEditingDescription(false)}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />
      ) : item.description ? (
        <Pressable
          onPress={() => setEditingDescription(true)}
          accessibilityRole="button"
          accessibilityLabel={t("entry.editDescription")}
        >
          <Text style={styles.autoCaption}>
            {t("entry.autoDescriptionCaption", { description: item.description })}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.lineAmount} numberOfLines={1}>
        {formatMoney(amount, currencySymbol)}
      </Text>
    </View>
  );
}

/** A completed line, collapsed to a single tappable summary row. Tapping reopens it in the form above. */
export function CollapsedLineRow({
  item,
  currencySymbol,
  onPress,
}: {
  item: BillLineItemState;
  currencySymbol: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rate = parseMoneyInput(item.rateInput);
  const amount = item.quantity * rate;
  const swatchColor = swatchColorFor(item.color);

  return (
    <Pressable style={styles.collapsedRow} onPress={onPress} accessibilityRole="button">
      {swatchColor ? (
        <View style={[styles.collapsedSwatch, { backgroundColor: swatchColor }]} />
      ) : null}
      <View style={styles.collapsedInfo}>
        <Text style={styles.collapsedDescription} numberOfLines={1}>
          {item.itemName}
        </Text>
        <Text style={styles.collapsedSubtext}>
          {item.quantity} × {formatMoney(rate, currencySymbol)}
        </Text>
      </View>
      <Text style={styles.collapsedAmount} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(amount, currencySymbol)}
      </Text>
      <Ionicons
        name="chevron-down"
        size={16}
        color={colors.textSecondary}
        style={styles.collapsedChevron}
      />
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  input: {
    ...theme.typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  dropdownFieldLeading: {
    marginEnd: theme.spacing.sm,
  },
  dropdownFieldText: {
    ...theme.typography.body,
    color: colors.textPrimary,
    flex: 1,
    marginEnd: theme.spacing.xs,
  },
  dropdownFieldPlaceholder: {
    color: colors.textSecondary,
  },
  dropdownPanel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    ...theme.typography.body,
    color: colors.textPrimary,
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  dropdownSectionLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: theme.spacing.xs,
  },
  addNewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  addNewRowText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...theme.typography.caption,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  colorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  colorChipDot: {
    marginEnd: 0,
  },
  swatchDot: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchDotEmpty: {
    backgroundColor: colors.surface,
  },
  sizeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  sizeModeBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  sizeModeBadgeNamed: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeModeBadgeNumeric: {
    backgroundColor: colors.primarySoft,
  },
  sizeModeBadgeText: {
    ...theme.typography.caption,
    fontWeight: "700",
  },
  sizeHintText: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  customSizeBox: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  customSizeLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  customSizeHint: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  quantityField: {
    flex: 1,
  },
  rateField: {
    flex: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  stepperButton: {
    padding: theme.spacing.xs,
  },
  stepperValue: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  descriptionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resetDescriptionText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  autoCaption: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  lineAmount: {
    ...theme.typography.money,
    color: colors.textPrimary,
    textAlign: "right",
    marginTop: theme.spacing.xs,
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  collapsedSwatch: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginEnd: theme.spacing.sm,
  },
  collapsedInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  collapsedDescription: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  collapsedSubtext: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  collapsedAmount: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  collapsedChevron: {
    marginStart: theme.spacing.xs,
  },
});
