import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { hashColor, matchesKnownLabel, swatchColorFor } from "../../lib/garmentColor";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import { generateLineItemDescription } from "../../repositories/description";
import type { AppColors } from "../../theme/colors";
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

/** Currently-selected sizes, in `sizeList`'s fixed order regardless of tap order — supports
 * selecting more than one size for an assorted-size batch line (see `toggleSize` below). */
export function selectedSizesFrom(size: string | null): string[] {
  return (size ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
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
  persistedColorOptions,
  persistedCategoryOptions,
  onAddCustomColor,
  onAddCustomCategory,
}: {
  item: BillLineItemState;
  label: string;
  currencySymbol: string;
  onChange: (next: BillLineItemState) => void;
  onRemove?: () => void;
  /** Custom colours already used elsewhere in this bill, offered as quick-reuse chips. */
  extraColorOptions?: string[];
  /** Custom colours/categories typed on a *previous* bill, remembered app-wide (customOptionsRepository) so they don't need retyping — offered as their own "Your colors"/"Your categories" chip sections. */
  persistedColorOptions?: string[];
  persistedCategoryOptions?: string[];
  /** Called when the user commits a genuinely new freeform colour/category via "Add as new ...", so the caller can persist it for next time. */
  onAddCustomColor?: (label: string) => void;
  onAddCustomCategory?: (label: string) => void;
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
  const selectedSizes = selectedSizesFrom(item.size);

  function selectCategory(value: string) {
    const nextMode = categorySizeMode(value);
    const nextList = sizeListFor(nextMode);
    const currentSizeStillValid = item.isCustomSize
      ? true
      : selectedSizesFrom(item.size).every((size) => nextList.includes(size));
    update({
      category: value,
      ...(currentSizeStillValid ? {} : { size: null, isCustomSize: false }),
    });
    setCategoryOpen(false);
    setCategoryQuery("");
  }

  function addNewCategory(value: string) {
    selectCategory(value);
    onAddCustomCategory?.(value);
  }

  /** Toggles one size in/out of the selection — a line can cover more than one size at once
   * (e.g. an assorted batch of waist sizes), stored as a comma-joined string in `item.size`. */
  function toggleSize(size: string) {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    // Keep sizeList's fixed order regardless of tap order, so the description/display is stable.
    const ordered = sizeList.filter((s) => next.includes(s));
    update({ size: ordered.length > 0 ? ordered.join(",") : null, isCustomSize: false });
  }

  function selectColor(value: string) {
    update({ color: value });
    setColorOpen(false);
    setColorQuery("");
  }

  function addNewColor(value: string) {
    selectColor(value);
    onAddCustomColor?.(value);
  }

  const colorSwatch = swatchColorFor(item.color);
  const trimmedCategoryQuery = categoryQuery.trim();
  const trimmedColorQuery = colorQuery.trim();
  const knownCategoryLabels = useMemo(
    () => [...categoryPresetLabels, ...(persistedCategoryOptions ?? [])],
    [categoryPresetLabels, persistedCategoryOptions],
  );
  const knownColorLabels = useMemo(
    () => [...GARMENT_COLOR_LABELS, ...(persistedColorOptions ?? [])],
    [persistedColorOptions],
  );
  /** "Your categories"/"Your colors" chips — persisted options not already offered elsewhere
   * in this dropdown (the fixed presets, or this bill's own "used in this bill" list). */
  const ownCategoryOptions = useMemo(
    () => (persistedCategoryOptions ?? []).filter((label) => !matchesKnownLabel(label, categoryPresetLabels)),
    [persistedCategoryOptions, categoryPresetLabels],
  );
  const ownColorOptions = useMemo(
    () =>
      (persistedColorOptions ?? []).filter(
        (label) =>
          !matchesKnownLabel(label, GARMENT_COLOR_LABELS) &&
          !(extraColorOptions ?? []).some((c) => matchesKnownLabel(label, [c])),
      ),
    [persistedColorOptions, extraColorOptions],
  );

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
          {ownCategoryOptions.length > 0 ? (
            <>
              <Text style={styles.dropdownSectionLabel}>{t("entry.yourCategories")}</Text>
              <View style={styles.chipRow}>
                {ownCategoryOptions.map((catLabel) => (
                  <Pressable
                    key={catLabel}
                    style={[styles.chip, item.category === catLabel && styles.chipActive]}
                    onPress={() => selectCategory(catLabel)}
                    accessibilityRole="button"
                    accessibilityLabel={catLabel}
                    accessibilityState={{ selected: item.category === catLabel }}
                  >
                    <Text style={[styles.chipText, item.category === catLabel && styles.chipTextActive]}>
                      {catLabel}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {trimmedCategoryQuery && !matchesKnownLabel(trimmedCategoryQuery, knownCategoryLabels) ? (
            <Pressable
              style={styles.addNewRow}
              onPress={() => addNewCategory(trimmedCategoryQuery)}
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
      <Text style={styles.sizeMultiHintText}>{t("entry.sizeMultiHint")}</Text>
      <View style={styles.chipRow}>
        {sizeList.map((size) => {
          const isSelected = !item.isCustomSize && selectedSizes.includes(size);
          return (
            <Pressable
              key={size}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => toggleSize(size)}
              accessibilityRole="button"
              accessibilityLabel={size}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{size}</Text>
            </Pressable>
          );
        })}
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
          {ownColorOptions.length > 0 ? (
            <>
              <Text style={styles.dropdownSectionLabel}>{t("entry.yourColors")}</Text>
              <View style={styles.chipRow}>
                {ownColorOptions.map((label) => (
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
          {trimmedColorQuery && !matchesKnownLabel(trimmedColorQuery, knownColorLabels) ? (
            <Pressable
              style={styles.addNewRow}
              onPress={() => addNewColor(trimmedColorQuery)}
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
  sizeMultiHintText: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
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
