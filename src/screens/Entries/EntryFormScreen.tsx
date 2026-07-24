import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";
import { db } from "../../db/client";
import { formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import { createEntry } from "../../repositories/entryRepository";
import type { EntryDirection } from "../../types/models";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "EntryForm">;
type Route = RouteProp<CustomersStackParamList, "EntryForm">;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  if (mode === "bill") {
    return (
      <PlaceholderScreen
        title={t("khata.newEntry")}
        description="Itemized bill form arrives in Phase 3."
      />
    );
  }

  async function handleSave() {
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

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
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
});
