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
import { buildStatementHtml, buildStatementText } from "../../lib/documentFormat";
import { formatMoney } from "../../lib/money";
import { sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import type { CustomersStackParamList } from "../../navigation/types";
import { computeBalanceFromEntries } from "../../repositories/balance";
import { getCustomer } from "../../repositories/customerRepository";
import { getStatementDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { listEntriesForCustomer } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { Customer } from "../../types/models";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerKhata">;
type Route = RouteProp<CustomersStackParamList, "CustomerKhata">;

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function CustomerKhataScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { customerId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [allEntries, setAllEntries] = useState<EntryWithLineItems[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [statementRangeExpanded, setStatementRangeExpanded] = useState(false);
  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [customerRow, entryRows, settings] = await Promise.all([
        getCustomer(db, customerId),
        listEntriesForCustomer(db, customerId, { includeDeleted: true }),
        getSettings(db),
      ]);
      setCustomer(customerRow);
      setAllEntries(entryRows);
      setCurrencySymbol(settings.currencySymbol);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setLoading(false);
    }
  }, [customerId, t]);

  const entries = useMemo(() => allEntries.filter((entry) => !entry.isDeleted), [allEntries]);
  const deletedCount = allEntries.length - entries.length;
  const visibleEntries = showDeleted ? allEntries : entries;

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleShareStatement() {
    try {
      const dateFrom = isValidDate(statementDateFrom) ? statementDateFrom : undefined;
      const dateTo = isValidDate(statementDateTo) ? statementDateTo : undefined;
      const data = await getStatementDocumentData(db, customerId, { dateFrom, dateTo });
      if (!data) return;
      const message = buildStatementText(data);
      Alert.alert(t("share.statementTitle"), undefined, [
        {
          text: t("share.whatsapp"),
          onPress: () => shareViaWhatsApp(message, data.customer.phone),
        },
        { text: t("share.sms"), onPress: () => shareViaSms(message, data.customer.phone) },
        {
          text: t("share.pdf"),
          onPress: async () => {
            try {
              const shared = await sharePdf(buildStatementHtml(data), t("share.statementTitle"));
              if (!shared) Alert.alert(t("share.unavailable"));
            } catch (error) {
              console.error(error);
              Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
            }
          },
        },
        { text: t("customerForm.cancel"), style: "cancel" },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  useEffect(() => {
    navigation.setOptions({
      title: customer?.name ?? t("app.name"),
      headerRight: () => (
        <Pressable
          onPress={handleShareStatement}
          accessibilityLabel={t("khata.shareStatement")}
          accessibilityRole="button"
          style={styles.headerButton}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
    // handleShareStatement reads fresh from the db each call, but closes over the statement date
    // range state, so it must be in this dependency array or the header button would call a stale
    // closure whenever the date fields change without customer/t/colors also changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, customer, t, colors, statementDateFrom, statementDateTo]);

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const balance = computeBalanceFromEntries(customer.openingBalance, entries);
  const balanceColor =
    balance > 0
      ? colors.owesMe
      : balance < 0
        ? colors.iOwe
        : colors.neutralBalance;
  const balanceLabel =
    balance > 0 ? t("khata.theyOweYou") : balance < 0 ? t("khata.youOweThem") : t("khata.settled");

  return (
    <View style={styles.container}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceLabel}>{balanceLabel}</Text>
        <Text
          style={[styles.balanceAmount, { color: balanceColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(Math.abs(balance), currencySymbol)}
        </Text>
      </View>

      <Pressable
        style={styles.statementRangeToggle}
        accessibilityRole="button"
        onPress={() => setStatementRangeExpanded((current) => !current)}
      >
        <Text style={styles.statementRangeToggleText}>{t("khata.filterStatementByDate")}</Text>
      </Pressable>
      {!statementRangeExpanded &&
      (isValidDate(statementDateFrom) || isValidDate(statementDateTo)) ? (
        <Text style={styles.statementRangeSummary}>
          {t("khata.statementRangeSummary", {
            from: isValidDate(statementDateFrom) ? statementDateFrom : "…",
            to: isValidDate(statementDateTo) ? statementDateTo : "…",
          })}
        </Text>
      ) : null}
      {statementRangeExpanded ? (
        <View style={styles.statementRangeRow}>
          <TextInput
            value={statementDateFrom}
            onChangeText={setStatementDateFrom}
            style={[styles.statementDateInput, styles.statementInput]}
            placeholder={`${t("khata.statementDateFrom")} (YYYY-MM-DD)`}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            value={statementDateTo}
            onChangeText={setStatementDateTo}
            style={[styles.statementDateInput, styles.statementInput]}
            placeholder={`${t("khata.statementDateTo")} (YYYY-MM-DD)`}
            placeholderTextColor={colors.textSecondary}
          />
          {statementDateFrom || statementDateTo ? (
            <Pressable
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel={t("reports.clearFilter")}
              onPress={() => {
                setStatementDateFrom("");
                setStatementDateTo("");
              }}
            >
              <Text style={styles.clearButtonText}>{t("reports.clearFilter")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {deletedCount > 0 ? (
        <Pressable
          style={styles.deletedToggle}
          accessibilityRole="button"
          onPress={() => setShowDeleted((current) => !current)}
        >
          <Text style={styles.deletedToggleText}>
            {showDeleted
              ? t("khata.hideDeleted")
              : t("khata.showDeleted", { count: deletedCount })}
          </Text>
        </Pressable>
      ) : null}

      {visibleEntries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("khata.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleEntries}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              currencySymbol={currencySymbol}
              onPress={() =>
                item.isDeleted
                  ? navigation.navigate("EntryHistory", { entryId: item.id })
                  : navigation.navigate("EntryDetail", { entryId: item.id })
              }
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        accessibilityLabel={t("khata.newEntry")}
        accessibilityRole="button"
        onPress={handleNewEntry}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCashOut = entry.direction === "cash_out";
  const color = isCashOut ? colors.owesMe : colors.iOwe;
  const sign = isCashOut ? "+" : "-";
  const isBill = entry.type === "bill";

  return (
    <Pressable
      style={[styles.row, entry.isDeleted && styles.rowDeleted]}
      onPress={onPress}
      accessibilityRole="button"
    >
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
        <Text style={styles.rowSubtext}>
          {entry.entryDate}
          {entry.isDeleted ? ` · ${t("entry.historyDeleted")}` : ""}
        </Text>
        {entry.note ? (
          <Text style={styles.rowNote} numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
        {sign}
        {formatMoney(entry.amount, currencySymbol)}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  headerButton: {
    paddingHorizontal: theme.spacing.sm,
  },
  balanceHeader: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  balanceLabel: {
    ...theme.typography.body,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "700",
  },
  deletedToggle: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  deletedToggleText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  statementRangeToggle: {
    alignItems: "center",
    paddingTop: theme.spacing.sm,
  },
  statementRangeToggleText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  statementRangeSummary: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  statementRangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  statementInput: {
    ...theme.typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statementDateInput: {
    flex: 1,
    minWidth: 120,
  },
  clearButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  clearButtonText: {
    ...theme.typography.caption,
    color: colors.textPrimary,
    fontWeight: "600",
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
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowDeleted: {
    opacity: 0.55,
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
    color: colors.textPrimary,
    fontWeight: "600",
  },
  rowSubtext: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowNote: {
    ...theme.typography.caption,
    color: colors.textSecondary,
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
