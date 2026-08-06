import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney, parseMoneyInput } from "../../lib/money";
import { generateLineItemDescription } from "../../repositories/description";
import { newId } from "../../repositories/ids";
import { getSettings } from "../../repositories/settingsRepository";
import type { AppColors, GarmentColorLabel } from "../../theme/colors";
import { GARMENT_COLOR_LABELS } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { CustomersStackParamList } from "../../navigation/types";
import type { BillLineItemState } from "./BillLineItemCard";
import { BillLineItemCard, CollapsedLineRow, buildInitialLineItem } from "./BillLineItemCard";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "AddItems">;
type Route = RouteProp<CustomersStackParamList, "AddItems">;

/** A line only counts as "real" once it has both a name and an actual rate — otherwise the
 * default-filled-in category/name (see buildInitialLineItem) would silently commit a Rs 0
 * ghost line just from opening this screen and navigating away without entering anything. */
function isLineFilled(item: BillLineItemState): boolean {
  return item.itemName.trim().length > 0 && parseMoneyInput(item.rateInput) > 0;
}

/** Custom colours already used elsewhere in this bill (i.e. not one of the 14 fixed palette
 * labels), offered back as quick-reuse chips so a second line item doesn't need retyping one. */
function customColorsInUse(lineItems: BillLineItemState[]): string[] {
  const seen = new Set<string>();
  for (const li of lineItems) {
    if (li.color && !GARMENT_COLOR_LABELS.includes(li.color as GarmentColorLabel)) {
      seen.add(li.color);
    }
  }
  return Array.from(seen);
}

function regenerateIfUntouched(item: BillLineItemState): BillLineItemState {
  if (item.descriptionTouched) return item;
  return {
    ...item,
    description: generateLineItemDescription({
      quantity: item.quantity,
      color: item.color,
      itemName: item.itemName,
      size: item.size,
    }),
  };
}

/** Commits the active line into the list — updating it in place if it already exists (by key), appending otherwise. No-op if the active line is blank. */
function commitLine(
  lineItems: BillLineItemState[],
  activeLine: BillLineItemState,
): BillLineItemState[] {
  if (!isLineFilled(activeLine)) return lineItems;
  const existingIndex = lineItems.findIndex((li) => li.key === activeLine.key);
  const next = [...lineItems];
  if (existingIndex !== -1) {
    next[existingIndex] = activeLine;
  } else {
    next.push(activeLine);
  }
  return next;
}

function parseItemsPayload(payload: string): BillLineItemState[] {
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? (parsed as BillLineItemState[]) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export function AddItemsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { customerId, entryId, itemsPayload, activeKey } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [lineItems, setLineItems] = useState<BillLineItemState[]>(() =>
    parseItemsPayload(itemsPayload),
  );
  const [activeLine, setActiveLine] = useState<BillLineItemState>(() => {
    const parsed = parseItemsPayload(itemsPayload);
    const match = activeKey ? parsed.find((li) => li.key === activeKey) : undefined;
    return match ?? buildInitialLineItem(newId());
  });
  const [currencySymbol, setCurrencySymbol] = useState("Rs");

  useEffect(() => {
    getSettings(db)
      .then((settings) => setCurrencySymbol(settings.currencySymbol))
      .catch((error: Error) => console.error(error));
  }, []);

  function finalItems(): BillLineItemState[] {
    return commitLine(lineItems, activeLine);
  }

  function handleBack() {
    // React Navigation v7's `navigate()` no longer pops back to an existing screen already
    // in the stack — it always pushes a new instance, which would stack up a fresh "New Bill"
    // screen (and orphan this AddItems screen underneath it) every time this ran. `popTo` is
    // the explicit v7 API for "go back to this existing screen, merging in these params".
    navigation.popTo(
      "EntryForm",
      {
        customerId,
        entryId,
        mode: "bill",
        itemsPayload: JSON.stringify(finalItems()),
      },
      { merge: true },
    );
  }

  useEffect(() => {
    navigation.setOptions({
      title: t("entry.addItems"),
      headerLeft: () => (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
      ),
      headerRight: () => (
        <Text style={styles.headerCount} numberOfLines={1}>
          {t("entry.itemsCount", { count: finalItems().length })}
        </Text>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, t, colors, styles, lineItems, activeLine]);

  function handleLineItemChange(next: BillLineItemState) {
    setActiveLine(regenerateIfUntouched(next));
  }

  function handleAddAnother() {
    setLineItems(commitLine(lineItems, activeLine));
    setActiveLine(buildInitialLineItem(newId()));
  }

  function handleEditLine(target: BillLineItemState) {
    setLineItems(commitLine(lineItems, activeLine));
    setActiveLine(target);
  }

  function handleRemoveActiveLine() {
    setLineItems(lineItems.filter((li) => li.key !== activeLine.key));
    setActiveLine(buildInitialLineItem(newId()));
  }

  const isEditingExistingLine = lineItems.some((li) => li.key === activeLine.key);
  const activeLineNumber =
    lineItems.findIndex((li) => li.key === activeLine.key) !== -1
      ? lineItems.findIndex((li) => li.key === activeLine.key) + 1
      : lineItems.length + 1;

  const lineAmount = (item: BillLineItemState) => item.quantity * parseMoneyInput(item.rateInput);
  const billTotal =
    lineItems
      .filter((li) => li.key !== activeLine.key)
      .reduce((sum, item) => sum + lineAmount(item), 0) +
    (isLineFilled(activeLine) ? lineAmount(activeLine) : 0);
  const extraColorOptions = useMemo(
    () => customColorsInUse(lineItems).filter((c) => c !== activeLine.color),
    [lineItems, activeLine.color],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {lineItems
          .filter((item) => item.key !== activeLine.key)
          .map((item) => (
            <CollapsedLineRow
              key={item.key}
              item={item}
              currencySymbol={currencySymbol}
              onPress={() => handleEditLine(item)}
            />
          ))}

        <BillLineItemCard
          item={activeLine}
          label={`${t("entry.lineItem")} ${activeLineNumber}`}
          currencySymbol={currencySymbol}
          onChange={handleLineItemChange}
          onRemove={isEditingExistingLine ? handleRemoveActiveLine : undefined}
          extraColorOptions={extraColorOptions}
        />

        <Pressable
          style={styles.addAnotherButton}
          onPress={handleAddAnother}
          accessibilityRole="button"
          accessibilityLabel={t("entry.addAnotherItem")}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addAnotherButtonText}>{t("entry.addAnotherItem")}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.footerButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("entry.addToBillWithTotal", {
            amount: formatMoney(billTotal, currencySymbol),
          })}
        >
          <Text style={styles.footerButtonText} numberOfLines={1} adjustsFontSizeToFit>
            {t("entry.addToBillWithTotal", { amount: formatMoney(billTotal, currencySymbol) })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: theme.spacing.md,
    },
    headerButton: {
      paddingHorizontal: theme.spacing.sm,
    },
    headerCount: {
      ...theme.typography.body,
      color: colors.textSecondary,
      marginEnd: theme.spacing.md,
    },
    addAnotherButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: "dashed",
      marginBottom: theme.spacing.lg,
    },
    addAnotherButtonText: {
      ...theme.typography.body,
      color: colors.primary,
      fontWeight: "600",
    },
    footer: {
      padding: theme.spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerButton: {
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    footerButtonText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "700",
    },
  });
