import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney } from "../../lib/money";
import type { CustomerBalanceFilter, CustomersStackParamList } from "../../navigation/types";
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
type Route = RouteProp<CustomersStackParamList, "CustomerList">;

export function CustomerListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>(route.params?.initialSort ?? "recent");
  const [showArchived, setShowArchived] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<CustomerBalanceFilter | null>(
    route.params?.balanceFilter ?? null,
  );
  const [loading, setLoading] = useState(true);

  // navigate() to an already-mounted CustomerList (e.g. tapping a different Home stat) updates
  // route.params without remounting the screen, so state seeded from useState's initializer alone
  // would go stale — re-sync (including clearing back to defaults) whenever the params actually
  // change, without stomping on the user's own manual chip taps in between navigations.
  const paramsKey = JSON.stringify(route.params ?? {});
  useEffect(() => {
    setSort(route.params?.initialSort ?? "recent");
    setBalanceFilter(route.params?.balanceFilter ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const load = useCallback(
    async (activeSort: CustomerSort) => {
      setLoading(true);
      try {
        const [customerRows, settings] = await Promise.all([
          listCustomersWithBalance(db, { sort: activeSort, includeArchived: true }),
          getSettings(db),
        ]);
        setCustomers(customerRows);
        setCurrencySymbol(settings.currencySymbol);
      } catch (error) {
        console.error(error);
        Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      load(sort);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, sort]),
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (customer.isArchived !== showArchived) return false;
      if (balanceFilter === "receivable" && customer.balance <= 0) return false;
      if (balanceFilter === "payable" && customer.balance >= 0) return false;
      if (!needle) return true;
      return (
        customer.name.toLowerCase().includes(needle) ||
        (customer.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [customers, query, showArchived, balanceFilter]);

  const emptyMessage = showArchived
    ? t("customers.emptyArchived")
    : balanceFilter === "receivable"
      ? t("customers.emptyFilterReceivable")
      : balanceFilter === "payable"
        ? t("customers.emptyFilterPayable")
        : t("customers.empty");

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
        <SortChip
          label={t("customers.showArchived")}
          active={showArchived}
          onPress={() => setShowArchived((current) => !current)}
        />
        {balanceFilter ? (
          <SortChip
            label={`${
              balanceFilter === "receivable"
                ? t("customers.filterReceivable")
                : t("customers.filterPayable")
            } ×`}
            accessibilityLabel={t("customers.clearFilter", {
              filter:
                balanceFilter === "receivable"
                  ? t("customers.filterReceivable")
                  : t("customers.filterPayable"),
            })}
            active
            onPress={() => setBalanceFilter(null)}
          />
        ) : null}
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
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
                showArchived
                  ? navigation.navigate("CustomerForm", { customerId: item.id })
                  : navigation.navigate("CustomerKhata", { customerId: item.id })
              }
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        accessibilityLabel={t("customers.addCustomer")}
        accessibilityRole="button"
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
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
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
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {customer.name}
        </Text>
        {customer.phone ? (
          <Text style={styles.rowSubtext}>{customer.phone}</Text>
        ) : null}
        <Text style={styles.rowSubtext}>
          {new Date(customer.lastActivityAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.rowBalance, { color: balanceColor }]} numberOfLines={1}>
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
