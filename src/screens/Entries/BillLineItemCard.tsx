import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { GarmentColorLabel } from "../../theme/colors";
import { GARMENT_COLOR_LABELS, GARMENT_COLORS } from "../../theme/colors";
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
          <Pressable onPress={onRemove} accessibilityLabel={t("entry.removeLine")}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>

      <TextInput
        value={item.itemName}
        onChangeText={(text) => update({ itemName: text })}
        style={styles.input}
        placeholder={t("entry.itemName")}
        placeholderTextColor={theme.colors.textSecondary}
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
          placeholderTextColor={theme.colors.textSecondary}
        />
      ) : null}

      <Text style={styles.fieldLabel}>{t("entry.color")}</Text>
      <View style={styles.swatchRow}>
        {GARMENT_COLOR_LABELS.map((swatchLabel) => (
          <Pressable
            key={swatchLabel}
            accessibilityLabel={swatchLabel}
            style={[
              styles.swatch,
              { backgroundColor: GARMENT_COLORS[swatchLabel] },
              item.color === swatchLabel && styles.swatchActive,
            ]}
            onPress={() => update({ color: swatchLabel })}
          >
            {item.color === swatchLabel ? (
              <Ionicons name="checkmark" size={16} color={theme.colors.background} />
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
              onPress={() => update({ quantity: Math.max(1, item.quantity - 1) })}
            >
              <Ionicons name="remove" size={18} color={theme.colors.textPrimary} />
            </Pressable>
            <Text style={styles.stepperValue}>{item.quantity}</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => update({ quantity: item.quantity + 1 })}
            >
              <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
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
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>{t("entry.description")}</Text>
      <TextInput
        value={item.description}
        onChangeText={(text) => update({ description: text, descriptionTouched: true })}
        style={styles.input}
        placeholderTextColor={theme.colors.textSecondary}
      />

      <Text style={styles.lineAmount}>{formatMoney(amount, currencySymbol)}</Text>
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
  const rate = parseMoneyInput(item.rateInput);
  const amount = item.quantity * rate;
  const swatchColor = item.color
    ? GARMENT_COLORS[item.color as GarmentColorLabel]
    : undefined;

  return (
    <Pressable style={styles.collapsedRow} onPress={onPress}>
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
      <Text style={styles.collapsedAmount}>{formatMoney(amount, currencySymbol)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.textSecondary,
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
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
  },
  chipTextActive: {
    color: theme.colors.background,
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
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
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
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.textPrimary,
  },
  lineAmount: {
    ...theme.typography.money,
    color: theme.colors.textPrimary,
    textAlign: "right",
    marginTop: theme.spacing.xs,
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  collapsedSwatch: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginEnd: theme.spacing.sm,
  },
  collapsedInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  collapsedDescription: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
  },
  collapsedSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  collapsedAmount: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
});
