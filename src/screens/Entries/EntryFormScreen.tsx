import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { createEntry } from "../../repositories/entryRepository";
import { newId } from "../../repositories/ids";
import { getSettings } from "../../repositories/settingsRepository";
import type { EntryDirection } from "../../types/models";
import { theme } from "../../theme/theme";
import type { BillLineItemState } from "./BillLineItemCard";
import { BillLineItemCard, buildInitialLineItem } from "./BillLineItemCard";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "EntryForm">;
type Route = RouteProp<CustomersStackParamList, "EntryForm">;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
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

export function EntryFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { customerId, mode } = route.params;

  const [direction, setDirection] = useState<EntryDirection>("cash_out");
  const [amountInput, setAmountInput] = useState(formatMoneyInput(0));
  const [entryDate, setEntryDate] = useState(todayDate());
  const [note, setNote] = useState("");
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<BillLineItemState[]>([
    buildInitialLineItem(newId()),
  ]);
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");

  useEffect(() => {
    getSettings(db).then((settings) => setCurrencySymbol(settings.currencySymbol));
  }, []);

  function handleLineItemChange(index: number, next: BillLineItemState) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = regenerateIfUntouched(next);
      return updated;
    });
    if (billError) setBillError(null);
  }

  function handleAddLine() {
    setLineItems((prev) => [...prev, buildInitialLineItem(newId())]);
  }

  function handleRemoveLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePickAttachment() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachmentUri(result.assets[0].uri);
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
      await createEntry(db, {
        type: "simple",
        customerId,
        direction,
        amount,
        entryDate,
        note: note.trim() || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBill() {
    const validItems = lineItems.filter((item) => item.itemName.trim().length > 0);
    const hasInvalidRate = validItems.some((item) => parseMoneyInput(item.rateInput) <= 0);
    if (validItems.length === 0 || hasInvalidRate) {
      setBillError(t("entry.billValidationError"));
      return;
    }
    setBillError(null);
    setSaving(true);
    try {
      await createEntry(db, {
        type: "bill",
        customerId,
        direction: "cash_out",
        entryDate,
        note: note.trim() || null,
        attachmentUri,
        lineItems: validItems.map((item) => ({
          itemName: item.itemName.trim(),
          size: item.isCustomSize ? item.size?.trim() || null : item.size,
          color: item.color,
          quantity: item.quantity,
          rate: parseMoneyInput(item.rateInput),
          description: item.descriptionTouched ? item.description : undefined,
        })),
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  const billTotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * parseMoneyInput(item.rateInput),
    0,
  );

  if (mode === "bill") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {lineItems.map((item, index) => (
          <BillLineItemCard
            key={item.key}
            item={item}
            index={index}
            currencySymbol={currencySymbol}
            canRemove={lineItems.length > 1}
            onChange={(next) => handleLineItemChange(index, next)}
            onRemove={() => handleRemoveLine(index)}
          />
        ))}

        <Pressable style={styles.addLineButton} onPress={handleAddLine}>
          <Text style={styles.addLineButtonText}>{t("entry.addLine")}</Text>
        </Pressable>

        <Field label={t("entry.date")}>
          <View style={styles.dateRow}>
            <TextInput
              value={entryDate}
              onChangeText={setEntryDate}
              style={[styles.input, styles.dateInput]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Pressable style={styles.todayButton} onPress={() => setEntryDate(todayDate())}>
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
            placeholderTextColor={theme.colors.textSecondary}
            multiline
          />
        </Field>

        <Pressable style={styles.attachmentButton} onPress={handlePickAttachment}>
          {attachmentUri ? (
            <Image source={{ uri: attachmentUri }} style={styles.attachmentThumb} />
          ) : (
            <Ionicons name="camera-outline" size={20} color={theme.colors.textSecondary} />
          )}
          <Text style={styles.attachmentButtonText}>{t("entry.attachment")}</Text>
        </Pressable>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("entry.total")}</Text>
          <Text style={styles.totalAmount}>{formatMoney(billTotal, currencySymbol)}</Text>
        </View>

        {billError ? <Text style={styles.errorText}>{billError}</Text> : null}

        <Pressable style={styles.saveButton} onPress={handleSaveBill} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.colors.background} />
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
          color={theme.colors.owesMe}
          onPress={() => setDirection("cash_out")}
        />
        <DirectionOption
          label={t("entry.receivedPayment")}
          active={direction === "cash_in"}
          color={theme.colors.iOwe}
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
          placeholderTextColor={theme.colors.textSecondary}
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
            placeholderTextColor={theme.colors.textSecondary}
          />
          <Pressable style={styles.todayButton} onPress={() => setEntryDate(todayDate())}>
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
          placeholderTextColor={theme.colors.textSecondary}
          multiline
        />
      </Field>

      <Pressable style={styles.saveButton} onPress={handleSaveSimple} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={theme.colors.background} />
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
  return (
    <Pressable
      style={[
        styles.directionOption,
        active && { backgroundColor: color, borderColor: color },
      ]}
      onPress={onPress}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  directionOptionText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  directionOptionTextActive: {
    color: theme.colors.background,
    fontWeight: "600",
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  todayButtonText: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  saveButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "600",
  },
  addLineButton: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  addLineButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
  },
  attachmentButtonText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
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
    color: theme.colors.textPrimary,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
});
