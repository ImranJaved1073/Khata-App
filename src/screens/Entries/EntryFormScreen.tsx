import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { AppStateStatus, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { DateField } from "../../components/DateField";
import { db } from "../../db/client";
import type { CalculatorState } from "../../lib/calculator";
import {
  backspace as calcBackspace,
  clear as calcClear,
  createCalculatorState,
  displayValuePaisa,
  expressionLabel,
  inputDecimalPoint,
  inputDigit,
  inputEquals,
  inputOperator,
  inputPercent,
} from "../../lib/calculator";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import { getCustomer } from "../../repositories/customerRepository";
import { generateLineItemDescription } from "../../repositories/description";
import { createEntry, getEntry, updateEntry } from "../../repositories/entryRepository";
import { newId } from "../../repositories/ids";
import { getSettings } from "../../repositories/settingsRepository";
import type { EntryDirection, LineItem } from "../../types/models";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import { CalculatorKeypad } from "./CalculatorKeypad";
import type { BillLineItemState } from "./BillLineItemCard";
import {
  BillLineItemCard,
  CollapsedLineRow,
  GARMENT_SIZES,
  buildInitialLineItem,
} from "./BillLineItemCard";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "EntryForm">;
type Route = RouteProp<CustomersStackParamList, "EntryForm">;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isLineFilled(item: BillLineItemState): boolean {
  return item.itemName.trim().length > 0;
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

/** Replaces the previously-appended auto block (if still present) with the new one, leaving any of the user's own text untouched. */
function mergeNoteWithLineDescriptions(
  currentNote: string,
  previousAutoBlock: string,
  nextAutoBlock: string,
): string {
  let base = currentNote;
  if (previousAutoBlock && base.endsWith(previousAutoBlock)) {
    base = base.slice(0, base.length - previousAutoBlock.length).replace(/\n+$/, "");
  }
  if (!nextAutoBlock) return base;
  return base ? `${base}\n${nextAutoBlock}` : nextAutoBlock;
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

/** A saved line item's `id` doubles as its client-side `key`, so edits map back to the same row. */
function lineItemStateFromModel(li: LineItem): BillLineItemState {
  const isPresetSize = li.size ? (GARMENT_SIZES as readonly string[]).includes(li.size) : false;
  return {
    key: li.id,
    itemName: li.itemName,
    size: li.size,
    isCustomSize: Boolean(li.size) && !isPresetSize,
    color: li.color,
    quantity: li.quantity,
    rateInput: formatMoneyInput(li.rate),
    description: li.description,
    descriptionTouched: li.descriptionTouched,
  };
}

export function EntryFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { customerId, mode, entryId } = route.params;
  const isEditMode = Boolean(entryId);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(isEditMode);
  const [direction, setDirection] = useState<EntryDirection>("cash_out");
  const [calc, setCalc] = useState<CalculatorState>(() => createCalculatorState(0));
  const [entryDate, setEntryDate] = useState(todayDate());
  const autoTodayRef = useRef(entryDate);
  const [note, setNote] = useState("");
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<BillLineItemState[]>([]);
  const [activeLine, setActiveLine] = useState<BillLineItemState>(() =>
    buildInitialLineItem(newId()),
  );
  const [lastAutoNoteBlock, setLastAutoNoteBlock] = useState("");
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    getSettings(db)
      .then((settings) => setCurrencySymbol(settings.currencySymbol))
      .catch((error: Error) => console.error(error));
    getCustomer(db, customerId)
      .then((customer) => setCustomerName(customer?.name ?? ""))
      .catch((error: Error) => console.error(error));
  }, [customerId]);

  useEffect(() => {
    if (!entryId) return;
    getEntry(db, entryId)
      .then((entry) => {
        if (!entry) return;
        setEntryDate(entry.entryDate);
        setNote(entry.note ?? "");
        setAttachmentUri(entry.attachmentUri);
        if (entry.type === "simple") {
          setDirection(entry.direction);
          setCalc(createCalculatorState(entry.amount));
        } else {
          const items = entry.lineItems.map(lineItemStateFromModel);
          setLineItems(items);
          setLastAutoNoteBlock(items.map((li) => li.description).filter(Boolean).join("\n"));
        }
      })
      .catch((error: Error) => {
        console.error(error);
        Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
      })
      .finally(() => setLoading(false));
  }, [entryId, t]);

  // The date field defaults to "today" once at mount and is otherwise left for the user to edit.
  // If this screen is left open across midnight (backgrounded mid-bill, resumed the next day),
  // that mount-time default would silently keep pointing at yesterday. On resume, bump it forward
  // — but only if the user hasn't since picked a date of their own, and only for a brand-new entry
  // (edit mode's date comes from the saved record, not this default).
  useEffect(() => {
    if (isEditMode) return;
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      const current = todayDate();
      if (current === autoTodayRef.current) return;
      setEntryDate((prev) => (prev === autoTodayRef.current ? current : prev));
      autoTodayRef.current = current;
    });
    return () => subscription.remove();
  }, [isEditMode]);

  useEffect(() => {
    navigation.setOptions({
      title:
        mode === "bill"
          ? t(isEditMode ? "entry.editBillTitle" : "entry.newBillTitle")
          : t(isEditMode ? "entry.editEntryTitle" : "entry.simpleEntryTitle"),
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
      ),
      headerRight:
        mode === "bill"
          ? () => (
              <Text style={styles.headerCustomerName} numberOfLines={1}>
                {customerName}
              </Text>
            )
          : undefined,
    });
  }, [navigation, mode, isEditMode, t, colors, styles, customerName]);

  function applyLineCommit(next: BillLineItemState[]) {
    setLineItems(next);
    const nextAutoBlock = next.map((li) => li.description).filter(Boolean).join("\n");
    setNote((prev) => mergeNoteWithLineDescriptions(prev, lastAutoNoteBlock, nextAutoBlock));
    setLastAutoNoteBlock(nextAutoBlock);
    return nextAutoBlock;
  }

  function handleLineItemChange(next: BillLineItemState) {
    setActiveLine(regenerateIfUntouched(next));
    if (billError) setBillError(null);
  }

  function handleAddLine() {
    applyLineCommit(commitLine(lineItems, activeLine));
    setActiveLine(buildInitialLineItem(newId()));
  }

  function handleEditLine(item: BillLineItemState) {
    applyLineCommit(commitLine(lineItems, activeLine));
    setActiveLine(item);
  }

  function handleRemoveActiveLine() {
    applyLineCommit(lineItems.filter((li) => li.key !== activeLine.key));
    setActiveLine(buildInitialLineItem(newId()));
  }

  async function handlePickAttachment() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  function finalCalcAmount(): number {
    const settled = calc.pendingOperator ? inputEquals(calc) : calc;
    return displayValuePaisa(settled);
  }

  async function handleSaveSimple() {
    const amount = finalCalcAmount();
    if (amount <= 0) {
      setAmountError(t("entry.amountRequired"));
      return;
    }
    setAmountError(null);
    setSaving(true);
    try {
      if (isEditMode && entryId) {
        await updateEntry(db, entryId, {
          type: "simple",
          direction,
          amount,
          entryDate,
          note: note.trim() || null,
        });
      } else {
        await createEntry(db, {
          type: "simple",
          customerId,
          direction,
          amount,
          entryDate,
          note: note.trim() || null,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBill() {
    const finalItems = commitLine(lineItems, activeLine);
    const validItems = finalItems.filter((item) => item.itemName.trim().length > 0);
    const hasInvalidRate = validItems.some((item) => parseMoneyInput(item.rateInput) <= 0);
    if (validItems.length === 0 || hasInvalidRate) {
      setBillError(t("entry.billValidationError"));
      return;
    }
    setBillError(null);

    const finalAutoBlock = finalItems.map((li) => li.description).filter(Boolean).join("\n");
    const finalNote = mergeNoteWithLineDescriptions(note, lastAutoNoteBlock, finalAutoBlock);

    const mappedLineItems = validItems.map((item) => ({
      id: isEditMode ? item.key : undefined,
      itemName: item.itemName.trim(),
      size: item.isCustomSize ? item.size?.trim() || null : item.size,
      color: item.color,
      quantity: item.quantity,
      rate: parseMoneyInput(item.rateInput),
      description: item.descriptionTouched ? item.description : undefined,
    }));

    setSaving(true);
    try {
      if (isEditMode && entryId) {
        await updateEntry(db, entryId, {
          type: "bill",
          entryDate,
          note: finalNote.trim() || null,
          attachmentUri,
          lineItems: mappedLineItems,
        });
        navigation.goBack();
      } else {
        const created = await createEntry(db, {
          type: "bill",
          customerId,
          direction: "cash_out",
          entryDate,
          note: finalNote.trim() || null,
          attachmentUri,
          lineItems: mappedLineItems,
        });
        navigation.replace("BillSaved", { entryId: created.id });
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (mode === "bill") {
    return (
      <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.dateNoteRow}>
          <DateField value={entryDate} onChange={setEntryDate} style={styles.dateNoteField} />

          <Pressable
            style={[styles.attachmentButton, styles.dateNoteField]}
            onPress={handlePickAttachment}
            accessibilityRole="button"
            accessibilityLabel={t("entry.attachment")}
          >
            {attachmentUri ? (
              <Image source={{ uri: attachmentUri }} style={styles.attachmentThumb} />
            ) : (
              <Ionicons name="camera-outline" size={18} color={colors.primary} />
            )}
            <Text style={styles.attachmentButtonText} numberOfLines={1}>
              {t("entry.attachment")}
            </Text>
          </Pressable>
        </View>

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
        />

        <Pressable
          style={styles.addLineButton}
          onPress={handleAddLine}
          accessibilityRole="button"
          accessibilityLabel={t("entry.addLine")}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addLineButtonText}>{t("entry.addLine")}</Text>
        </Pressable>

        <View style={styles.noteHeaderRow}>
          <Text style={styles.fieldLabel}>{t("entry.note")}</Text>
          <View style={styles.autoNoteHint}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={styles.autoNoteHintText}>{t("entry.autoFromAllItems")}</Text>
          </View>
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={[styles.input, styles.multilineInput]}
          placeholder={t("entry.note")}
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        {billError ? <Text style={styles.errorText}>{billError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.saveButton}
          onPress={handleSaveBill}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("entry.save")}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {t("entry.saveBillWithTotal", { amount: formatMoney(billTotal, currencySymbol) })}
            </Text>
          )}
        </Pressable>
      </View>
      </View>
    );
  }

  const directionColor = direction === "cash_out" ? colors.owesMe : colors.iOwe;
  const expression = expressionLabel(calc);
  const displayAmount = displayValuePaisa(calc);

  return (
    <View style={styles.container}>
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.directionRow}>
        <DirectionOption
          label={t("entry.directionOut")}
          active={direction === "cash_out"}
          color={colors.owesMe}
          onPress={() => setDirection("cash_out")}
        />
        <DirectionOption
          label={t("entry.directionIn")}
          active={direction === "cash_in"}
          color={colors.iOwe}
          onPress={() => setDirection("cash_in")}
        />
      </View>

      {expression ? <Text style={styles.expressionText}>{expression}</Text> : null}
      <Text
        style={[styles.amountDisplay, { color: directionColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMoney(displayAmount, currencySymbol)}
      </Text>
      {amountError ? (
        <Text style={[styles.errorText, styles.amountError]}>{amountError}</Text>
      ) : null}

      <View style={styles.dateNoteRow}>
        <DateField
          value={entryDate}
          onChange={setEntryDate}
          label={t("entry.date")}
          style={styles.dateNoteField}
        />

        <Field label={t("entry.note")} style={styles.dateNoteField}>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={styles.input}
            placeholder={t("entry.note")}
            placeholderTextColor={colors.textSecondary}
          />
        </Field>
      </View>

      <CalculatorKeypad
        accentColor={directionColor}
        onDigit={(digit) => {
          setCalc((prev) => inputDigit(prev, digit));
          if (amountError) setAmountError(null);
        }}
        onPoint={() => setCalc((prev) => inputDecimalPoint(prev))}
        onOperator={(op) => setCalc((prev) => inputOperator(prev, op))}
        onPercent={() => setCalc((prev) => inputPercent(prev))}
        onClear={() => setCalc(() => calcClear())}
        onBackspace={() => setCalc((prev) => calcBackspace(prev))}
        onEquals={() => setCalc((prev) => inputEquals(prev))}
      />
    </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, { backgroundColor: directionColor }]}
          onPress={handleSaveSimple}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("entry.save")}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>{t("entry.saveEntry")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DirectionOption({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.directionOption, active && { backgroundColor: color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.directionOptionText, active && styles.directionOptionTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  required,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  closeButton: {
    paddingHorizontal: theme.spacing.sm,
  },
  headerCustomerName: {
    ...theme.typography.body,
    color: colors.textSecondary,
    marginEnd: theme.spacing.md,
    maxWidth: 120,
  },
  directionRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: theme.spacing.lg,
  },
  directionOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  directionOptionText: {
    ...theme.typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },
  directionOptionTextActive: {
    color: colors.onPrimary,
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.body,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  expressionText: {
    ...theme.typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing.xs,
  },
  amountDisplay: {
    fontSize: 40,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  amountError: {
    textAlign: "center",
  },
  dateNoteRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  dateNoteField: {
    flex: 1,
  },
  errorText: {
    ...theme.typography.caption,
    color: colors.danger,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "700",
  },
  addLineButton: {
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
  addLineButtonText: {
    ...theme.typography.body,
    color: colors.primary,
    fontWeight: "600",
  },
  noteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  autoNoteHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  autoNoteHintText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  attachmentButtonText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
  },
});
