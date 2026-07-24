import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import type {
  CustomerSort,
  CustomerWithBalance,
} from "../../repositories/customerRepository";
import { listCustomersWithBalance } from "../../repositories/customerRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerList">;

export function CustomerListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>("recent");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (activeSort: CustomerSort) => {
    setLoading(true);
    const [customerRows, settings] = await Promise.all([
      listCustomersWithBalance(db, { sort: activeSort }),
      getSettings(db),
    ]);
    setCustomers(customerRows);
    setCurrencySymbol(settings.currencySymbol);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(sort);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, sort]),
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(needle) ||
        (customer.phone ?? "").toLowerCase().includes(needle),
    );
  }, [customers, query]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("customers.searchPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.sortRow}>
        <SortChip
          label={t("customers.sortRecent")}
          active={sort === "recent"}
          onPress={() => setSort("recent")}
        />
        <SortChip
          label={t("customers.sortBalance")}
          active={sort === "balance"}
          onPress={() => setSort("balance")}
        />
      </View>

      {!loading && filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("customers.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CustomerRow
              customer={item}
              currencySymbol={currencySymbol}
              onPress={() =>
                navigation.navigate("CustomerKhata", { customerId: item.id })
              }
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        accessibilityLabel={t("customers.addCustomer")}
        onPress={() => navigation.navigate("CustomerForm", undefined)}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sortChip, active && styles.sortChipActive]}
    >
      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CustomerRow({
  customer,
  currencySymbol,
  onPress,
}: {
  customer: CustomerWithBalance;
  currencySymbol: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const balanceColor =
    customer.balance > 0
      ? colors.owesMe
      : customer.balance < 0
        ? colors.iOwe
        : colors.neutralBalance;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{customer.name}</Text>
        {customer.phone ? (
          <Text style={styles.rowSubtext}>{customer.phone}</Text>
        ) : null}
        <Text style={styles.rowSubtext}>
          {new Date(customer.lastActivityAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.rowBalance, { color: balanceColor }]}>
        {formatMoney(customer.balance, currencySymbol)}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  sortRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  sortChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: colors.onPrimary,
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
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  rowName: {
    ...theme.typography.heading,
    color: colors.textPrimary,
  },
  rowSubtext: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowBalance: {
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
    color: colors.textSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    end: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
});
