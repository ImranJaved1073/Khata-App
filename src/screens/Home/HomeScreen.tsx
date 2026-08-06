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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/Avatar";
import { StatCard } from "../../components/StatCard";
import { db } from "../../db/client";
import { formatTimeOfDay, localDateString } from "../../lib/dateFormat";
import { formatMoney } from "../../lib/money";
import { getInitials } from "../../lib/textFormat";
import type { HomeStackParamList, RootTabParamList } from "../../navigation/types";
import type { CustomerWithBalance } from "../../repositories/customerRepository";
import { listCustomersWithBalance } from "../../repositories/customerRepository";
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

function todayLabel(): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [totals, setTotals] = useState<DashboardTotals>({
    totalReceivable: 0,
    totalPayable: 0,
  });
  const [todaysEntries, setTodaysEntries] = useState<TodaysEntry[]>([]);
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardTotals, entries, customerRows, settings] = await Promise.all([
        getDashboardTotals(db),
        listTodaysEntries(db, localDateString()),
        listCustomersWithBalance(db),
        getSettings(db),
      ]);
      setTotals(dashboardTotals);
      setTodaysEntries(entries);
      setCustomers(customerRows);
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

  const receivableParties = customers.filter((c) => c.balance > 0).length;
  const payableParties = customers.filter((c) => c.balance < 0).length;

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + theme.spacing.md }]}>
        <Avatar
          label={getInitials(businessName ?? t("app.name"))}
          size={48}
          shape="square"
          backgroundColor={colors.primary}
          color={colors.accent}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.businessName} numberOfLines={1}>
            {businessName ?? t("app.name")}
          </Text>
          <Text style={styles.dateLabel}>{todayLabel()}</Text>
        </View>
        <Ionicons
          name="notifications-outline"
          size={22}
          color={colors.textSecondary}
          accessibilityLabel={t("home.notifications")}
        />
      </View>

      <FlatList
        data={todaysEntries}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <ActivityRow entry={item} currencySymbol={currencySymbol} />}
        ListHeaderComponent={
          <View>
            <View style={styles.totalsRow}>
              <StatCard
                label={t("home.totalReceivable")}
                amount={formatMoney(totals.totalReceivable, currencySymbol)}
                caption={t("home.receivableCaption", { count: receivableParties })}
                color={colors.owesMe}
                direction="receivable"
                onPress={() =>
                  navigation.navigate("CustomersTab", {
                    screen: "CustomerList",
                    params: { initialSort: "balance", balanceFilter: "receivable" },
                  })
                }
              />
              <StatCard
                label={t("home.totalPayable")}
                amount={formatMoney(totals.totalPayable, currencySymbol)}
                caption={t("home.payableCaption", { count: payableParties })}
                color={colors.iOwe}
                direction="payable"
                onPress={() =>
                  navigation.navigate("CustomersTab", {
                    screen: "CustomerList",
                    params: { initialSort: "balance", balanceFilter: "payable" },
                  })
                }
              />
            </View>

            <Text style={styles.sectionTitle}>{t("home.todaysActivity")}</Text>

            {todaysEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="book" size={40} color={colors.primaryMuted} />
                </View>
                <Text style={styles.emptyTitle}>{t("home.noActivityToday")}</Text>
              </View>
            ) : null}
          </View>
        }
      />

      <Pressable
        style={styles.newCustomerButton}
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate("CustomersTab", { screen: "CustomerForm", params: undefined })
        }
      >
        <Ionicons name="person-add" size={18} color={colors.onPrimary} />
        <Text style={styles.newCustomerButtonText}>{t("home.newCustomer")}</Text>
      </Pressable>
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
  const softBackground = isCashOut ? colors.owesMeSoft : colors.iOweSoft;
  const icon = isCashOut ? "arrow-down-outline" : "arrow-up-outline";
  const iconStyle = { transform: [{ rotate: "45deg" as const }] };
  const subtitle =
    entry.type === "bill"
      ? t("entry.activityNewBill")
      : isCashOut
        ? t("entry.activitySimpleEntry")
        : t("entry.activityPaymentReceived");

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: softBackground }]}>
        <Ionicons name={icon} size={20} color={color} style={iconStyle} />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityName} numberOfLines={1}>
          {entry.customerName}
        </Text>
        <Text style={styles.activitySubtext}>
          {subtitle} · {formatTimeOfDay(entry.createdAt)}
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
    backgroundColor: colors.surface,
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
    paddingBottom: theme.spacing.xl * 2 + theme.spacing.lg,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: theme.spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginStart: theme.spacing.md,
    marginEnd: theme.spacing.sm,
  },
  businessName: {
    ...theme.typography.title,
    color: colors.textPrimary,
  },
  dateLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  newCustomerButton: {
    position: "absolute",
    end: theme.spacing.lg,
    bottom: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.primary,
    elevation: 4,
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
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: theme.spacing.sm,
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
