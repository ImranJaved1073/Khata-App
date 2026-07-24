import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import { computeBalanceFromEntries } from "../../repositories/balance";
import { getCustomer } from "../../repositories/customerRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { listEntriesForCustomer } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { Customer } from "../../types/models";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerKhata">;
type Route = RouteProp<CustomersStackParamList, "CustomerKhata">;

export function CustomerKhataScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { customerId } = route.params;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<EntryWithLineItems[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [customerRow, entryRows, settings] = await Promise.all([
      getCustomer(db, customerId),
      listEntriesForCustomer(db, customerId),
      getSettings(db),
    ]);
    setCustomer(customerRow);
    setEntries(entryRows);
    setCurrencySymbol(settings.currencySymbol);
    setLoading(false);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    navigation.setOptions({ title: customer?.name ?? t("app.name") });
  }, [navigation, customer, t]);

  function handleNewEntry() {
    Alert.alert(t("khata.newEntry"), undefined, [
      { text: t("customerForm.cancel"), style: "cancel" },
      {
        text: t("entry.itemizedBill"),
        onPress: () => navigation.navigate("EntryForm", { customerId, mode: "bill" }),
      },
      {
        text: t("khata.simpleEntry"),
        onPress: () => navigation.navigate("EntryForm", { customerId, mode: "simple" }),
      },
    ]);
  }

  if (loading || !customer) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const balance = computeBalanceFromEntries(customer.openingBalance, entries);
  const balanceColor =
    balance > 0
      ? theme.colors.owesMe
      : balance < 0
        ? theme.colors.iOwe
        : theme.colors.neutralBalance;
  const balanceLabel =
    balance > 0 ? t("khata.theyOweYou") : balance < 0 ? t("khata.youOweThem") : t("khata.settled");

  return (
    <View style={styles.container}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceLabel}>{balanceLabel}</Text>
        <Text style={[styles.balanceAmount, { color: balanceColor }]}>
          {formatMoney(Math.abs(balance), currencySymbol)}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("khata.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              currencySymbol={currencySymbol}
              onPress={() => navigation.navigate("EntryDetail", { entryId: item.id })}
            />
          )}
        />
      )}

      <Pressable style={styles.fab} accessibilityLabel={t("khata.newEntry")} onPress={handleNewEntry}>
        <Ionicons name="add" size={28} color={theme.colors.background} />
      </Pressable>
    </View>
  );
}

function EntryRow({
  entry,
  currencySymbol,
  onPress,
}: {
  entry: EntryWithLineItems;
  currencySymbol: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isCashOut = entry.direction === "cash_out";
  const color = isCashOut ? theme.colors.owesMe : theme.colors.iOwe;
  const sign = isCashOut ? "+" : "-";
  const isBill = entry.type === "bill";

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons
        name={isBill ? "receipt-outline" : isCashOut ? "arrow-up-circle" : "arrow-down-circle"}
        size={28}
        color={color}
        style={styles.rowIcon}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>
          {isBill
            ? t("entry.itemsCount", { count: entry.lineItems.length })
            : isCashOut
              ? t("entry.gaveOnCredit")
              : t("entry.receivedPayment")}
        </Text>
        <Text style={styles.rowSubtext}>{entry.entryDate}</Text>
        {entry.note ? (
          <Text style={styles.rowNote} numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowAmount, { color }]}>
        {sign}
        {formatMoney(entry.amount, currencySymbol)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  balanceHeader: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  balanceLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowIcon: {
    marginEnd: theme.spacing.sm,
  },
  rowInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  rowSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rowNote: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rowAmount: {
    ...theme.typography.money,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    end: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
});
