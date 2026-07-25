import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import { generateLineItemDescription } from "../../repositories/description";
import { createEntry, getEntry, updateEntry } from "../../repositories/entryRepository";
import { newId } from "../../repositories/ids";
import { getSettings } from "../../repositories/settingsRepository";
import type { EntryDirection, LineItem } from "../../types/models";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
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
  const [amountInput, setAmountInput] = useState(formatMoneyInput(0));
  const [entryDate, setEntryDate] = useState(todayDate());
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

  useEffect(() => {
    getSettings(db)
      .then((settings) => setCurrencySymbol(settings.currencySymbol))
      .catch((error: Error) => console.error(error));
  }, []);

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
          setAmountInput(formatMoneyInput(entry.amount));
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

  useEffect(() => {
    navigation.setOptions({
      title:
        mode === "bill"
          ? t(isEditMode ? "entry.editBillTitle" : "entry.newBillTitle")
          : t(isEditMode ? "entry.editEntryTitle" : "khata.newEntry"),
    });
  }, [navigation, mode, isEditMode, t]);

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

  async function handleSaveSimple() {
    const amount = parseMoneyInput(amountInput);
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
      } else {
        await createEntry(db, {
          type: "bill",
          customerId,
          direction: "cash_out",
          entryDate,
          note: finalNote.trim() || null,
          attachmentUri,
          lineItems: mappedLineItems,
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text style={styles.addLineButtonText}>{t("entry.addLine")}</Text>
        </Pressable>

        <Field label={t("entry.date")}>
          <View style={styles.dateRow}>
            <TextInput
              value={entryDate}
              onChangeText={setEntryDate}
              style={[styles.input, styles.dateInput]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable
              style={styles.todayButton}
              onPress={() => setEntryDate(todayDate())}
              accessibilityRole="button"
              accessibilityLabel={t("entry.today")}
            >
              <Text style={styles.todayButtonText}>{t("entry.today")}</Text>
            </Pressable>
          </View>
        </Field>

        <Field label={t("entry.note")}>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={[styles.input, styles.multilineInput]}
            placeholder={t("entry.note")}
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </Field>

        <Pressable
          style={styles.attachmentButton}
          onPress={handlePickAttachment}
          accessibilityRole="button"
          accessibilityLabel={t("entry.attachment")}
        >
          {attachmentUri ? (
            <Image source={{ uri: attachmentUri }} style={styles.attachmentThumb} />
          ) : (
            <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
          )}
          <Text style={styles.attachmentButtonText}>{t("entry.attachment")}</Text>
        </Pressable>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("entry.total")}</Text>
          <Text style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(billTotal, currencySymbol)}
          </Text>
        </View>

        {billError ? <Text style={styles.errorText}>{billError}</Text> : null}

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
            <Text style={styles.saveButtonText}>{t("entry.save")}</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.directionRow}>
        <DirectionOption
          label={t("entry.gaveOnCredit")}
          active={direction === "cash_out"}
          color={colors.owesMe}
          onPress={() => setDirection("cash_out")}
        />
        <DirectionOption
          label={t("entry.receivedPayment")}
          active={direction === "cash_in"}
          color={colors.iOwe}
          onPress={() => setDirection("cash_in")}
        />
      </View>

      <Field label={t("entry.amount")} required>
        <TextInput
          value={amountInput}
          onChangeText={(text) => {
            setAmountInput(text);
            if (amountError) setAmountError(null);
          }}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
        />
        {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
      </Field>

      <Field label={t("entry.date")}>
        <View style={styles.dateRow}>
          <TextInput
            value={entryDate}
            onChangeText={setEntryDate}
            style={[styles.input, styles.dateInput]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
          <Pressable
            style={styles.todayButton}
            onPress={() => setEntryDate(todayDate())}
            accessibilityRole="button"
            accessibilityLabel={t("entry.today")}
          >
            <Text style={styles.todayButtonText}>{t("entry.today")}</Text>
          </Pressable>
        </View>
      </Field>

      <Field label={t("entry.note")}>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={[styles.input, styles.multilineInput]}
          placeholder={t("entry.note")}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </Field>

      <Pressable
        style={styles.saveButton}
        onPress={handleSaveSimple}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={t("entry.save")}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>{t("entry.save")}</Text>
        )}
      </Pressable>
    </ScrollView>
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
      style={[
        styles.directionOption,
        active && { backgroundColor: color, borderColor: color },
      ]}
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
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
  directionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  directionOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  directionOptionText: {
    ...theme.typography.body,
    color: colors.textPrimary,
    textAlign: "center",
  },
  directionOptionTextActive: {
    color: colors.onPrimary,
    fontWeight: "600",
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.body,
    color: colors.textPrimary,
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dateInput: {
    flex: 1,
  },
  todayButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayButtonText: {
    ...theme.typography.caption,
    color: colors.textPrimary,
  },
  errorText: {
    ...theme.typography.caption,
    color: colors.danger,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  saveButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  addLineButton: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  addLineButtonText: {
    ...theme.typography.body,
    color: colors.primary,
    fontWeight: "600",
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: theme.spacing.md,
  },
  attachmentButtonText: {
    ...theme.typography.body,
    color: colors.textSecondary,
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  totalLabel: {
    ...theme.typography.heading,
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
