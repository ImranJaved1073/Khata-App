import { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { AppColors, GarmentColorLabel } from "../../theme/colors";
import { GARMENT_COLOR_LABELS, GARMENT_COLORS } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

export const GARMENT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;

export interface BillLineItemState {
  key: string;
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
  return {
    key,
    itemName: "",
    size: null,
    isCustomSize: false,
    color: null,
    quantity: 1,
    rateInput: formatMoneyInput(0),
    description: "",
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
}: {
  item: BillLineItemState;
  label: string;
  currencySymbol: string;
  onChange: (next: BillLineItemState) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rate = parseMoneyInput(item.rateInput);
  const amount = item.quantity * rate;

  function update(patch: Partial<BillLineItemState>) {
    onChange({ ...item, ...patch });
  }

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

      <TextInput
        value={item.itemName}
        onChangeText={(text) => update({ itemName: text })}
        style={styles.input}
        placeholder={t("entry.itemName")}
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.fieldLabel}>{t("entry.size")}</Text>
      <View style={styles.chipRow}>
        {GARMENT_SIZES.map((size) => (
          <Pressable
            key={size}
            style={[
              styles.chip,
              !item.isCustomSize && item.size === size && styles.chipActive,
            ]}
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
        <TextInput
          value={item.size ?? ""}
          onChangeText={(text) => update({ size: text })}
          style={[styles.input, styles.customSizeInput]}
          placeholder={t("entry.customSize")}
          placeholderTextColor={colors.textSecondary}
        />
      ) : null}

      <Text style={styles.fieldLabel}>{t("entry.color")}</Text>
      <View style={styles.swatchRow}>
        {GARMENT_COLOR_LABELS.map((swatchLabel) => (
          <Pressable
            key={swatchLabel}
            accessibilityLabel={swatchLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: item.color === swatchLabel }}
            hitSlop={4}
            style={[
              styles.swatch,
              { backgroundColor: GARMENT_COLORS[swatchLabel] },
              item.color === swatchLabel && styles.swatchActive,
            ]}
            onPress={() => update({ color: swatchLabel })}
          >
            {item.color === swatchLabel ? (
              <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
            ) : null}
          </Pressable>
        ))}
      </View>

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

      <Text style={styles.fieldLabel}>{t("entry.description")}</Text>
      <TextInput
        value={item.description}
        onChangeText={(text) => update({ description: text, descriptionTouched: true })}
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
      />
      {!item.descriptionTouched && item.description ? (
        <Text style={styles.autoCaption}>
          {t("entry.autoDescriptionCaption", { description: item.description })}
        </Text>
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
  const swatchColor = item.color
    ? GARMENT_COLORS[item.color as GarmentColorLabel]
    : undefined;

  return (
    <Pressable style={styles.collapsedRow} onPress={onPress} accessibilityRole="button">
      {swatchColor ? (
        <View style={[styles.collapsedSwatch, { backgroundColor: swatchColor }]} />
      ) : null}
      <View style={styles.collapsedInfo}>
        <Text style={styles.collapsedDescription} numberOfLines={1}>
          {item.description || item.itemName}
        </Text>
        <Text style={styles.collapsedSubtext}>
          {item.quantity} × {formatMoney(rate, currencySymbol)}
        </Text>
      </View>
      <Text style={styles.collapsedAmount} numberOfLines={1}>
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
  customSizeInput: {
    marginTop: -theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
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
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.accent,
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
