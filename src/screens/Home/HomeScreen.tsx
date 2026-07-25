import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney } from "../../lib/money";
import type { HomeStackParamList, RootTabParamList } from "../../navigation/types";
import { listCustomers } from "../../repositories/customerRepository";
import type { DashboardTotals, TodaysEntry } from "../../repositories/dashboardRepository";
import { getDashboardTotals, listTodaysEntries } from "../../repositories/dashboardRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "Dashboard">,
  BottomTabNavigationProp<RootTabParamList>
>;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [totals, setTotals] = useState<DashboardTotals>({
    totalReceivable: 0,
    totalPayable: 0,
  });
  const [todaysEntries, setTodaysEntries] = useState<TodaysEntry[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardTotals, entries, customers, settings] = await Promise.all([
        getDashboardTotals(db),
        listTodaysEntries(db, todayDate()),
        listCustomers(db),
        getSettings(db),
      ]);
      setTotals(dashboardTotals);
      setTodaysEntries(entries);
      setCustomerCount(customers.length);
      setBusinessName(settings.businessName);
      setCurrencySymbol(settings.currencySymbol);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={todaysEntries}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <ActivityRow entry={item} currencySymbol={currencySymbol} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.businessName}>{businessName ?? t("app.name")}</Text>

            <View style={styles.totalsRow}>
              <Pressable
                style={styles.totalCard}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("CustomersTab", {
                    screen: "CustomerList",
                    params: { initialSort: "balance", balanceFilter: "receivable" },
                  })
                }
              >
                <Text style={styles.totalLabel}>{t("home.totalReceivable")}</Text>
                <Text
                  style={[styles.totalAmount, { color: colors.owesMe }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(totals.totalReceivable, currencySymbol)}
                </Text>
              </Pressable>
              <Pressable
                style={styles.totalCard}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("CustomersTab", {
                    screen: "CustomerList",
                    params: { initialSort: "balance", balanceFilter: "payable" },
                  })
                }
              >
                <Text style={styles.totalLabel}>{t("home.totalPayable")}</Text>
                <Text
                  style={[styles.totalAmount, { color: colors.iOwe }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(totals.totalPayable, currencySymbol)}
                </Text>
              </Pressable>
              <Pressable
                style={styles.totalCard}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("CustomersTab", {
                    screen: "CustomerList",
                    params: undefined,
                  })
                }
              >
                <Text style={styles.totalLabel}>{t("home.customerCount")}</Text>
                <Text
                  style={[styles.totalAmount, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {customerCount}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.newCustomerButton}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate("CustomersTab", { screen: "CustomerForm", params: undefined })
              }
            >
              <Text style={styles.newCustomerButtonText}>{t("home.newCustomer")}</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>{t("home.todaysActivity")}</Text>

            {todaysEntries.length === 0 ? (
              <Text style={styles.emptyText}>{t("home.noActivityToday")}</Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function ActivityRow({
  entry,
  currencySymbol,
}: {
  entry: TodaysEntry;
  currencySymbol: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCashOut = entry.direction === "cash_out";
  const color = isCashOut ? colors.owesMe : colors.iOwe;

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityInfo}>
        <Text style={styles.activityName} numberOfLines={1}>
          {entry.customerName}
        </Text>
        <Text style={styles.activitySubtext}>
          {isCashOut ? t("entry.gaveOnCredit") : t("entry.receivedPayment")}
        </Text>
      </View>
      <Text style={[styles.activityAmount, { color }]} numberOfLines={1}>
        {formatMoney(entry.amount, currencySymbol)}
      </Text>
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  businessName: {
    ...theme.typography.title,
    color: colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  totalsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  totalCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  totalLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  totalAmount: {
    ...theme.typography.money,
  },
  newCustomerButton: {
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  newCustomerButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: colors.textSecondary,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  activityInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  activityName: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  activitySubtext: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    ...theme.typography.money,
  },
});
