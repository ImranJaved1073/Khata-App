import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import type { ActionSheetOption } from "../../components/ActionSheet";
import { ActionSheet } from "../../components/ActionSheet";
import { Avatar } from "../../components/Avatar";
import { DateField } from "../../components/DateField";
import { db } from "../../db/client";
import { formatRelativeDate } from "../../lib/dateFormat";
import { buildStatementHtml, buildStatementText } from "../../lib/documentFormat";
import { formatMoney } from "../../lib/money";
import { sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import { getInitials } from "../../lib/textFormat";
import type { CustomersStackParamList } from "../../navigation/types";
import { computeBalanceFromEntries } from "../../repositories/balance";
import { getCustomer } from "../../repositories/customerRepository";
import { getStatementDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { listEntriesForCustomer } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { Customer } from "../../types/models";
import type { AppColors } from "../../theme/colors";
import { withAlpha } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerKhata">;
type Route = RouteProp<CustomersStackParamList, "CustomerKhata">;

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSectionTitle(dateString: string): string {
  return new Date(`${dateString}T00:00:00`)
    .toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

function formatShortDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
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
  const [newEntrySheetVisible, setNewEntrySheetVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

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

  const sections = useMemo(() => {
    const map = new Map<string, EntryWithLineItems[]>();
    for (const entry of visibleEntries) {
      const list = map.get(entry.entryDate) ?? [];
      list.push(entry);
      map.set(entry.entryDate, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, data]) => ({ title: formatSectionTitle(date), data }));
  }, [visibleEntries]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleShareStatement(method: "whatsapp" | "sms" | "pdf") {
    try {
      const dateFrom = isValidDate(statementDateFrom) ? statementDateFrom : undefined;
      const dateTo = isValidDate(statementDateTo) ? statementDateTo : undefined;
      const data = await getStatementDocumentData(db, customerId, { dateFrom, dateTo });
      if (!data) return;
      if (method === "whatsapp") {
        shareViaWhatsApp(buildStatementText(data), data.customer.phone);
      } else if (method === "sms") {
        shareViaSms(buildStatementText(data), data.customer.phone);
      } else {
        const shared = await sharePdf(buildStatementHtml(data), t("share.statementTitle"));
        if (!shared) Alert.alert(t("share.unavailable"));
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  useEffect(() => {
    if (!customer) return;
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.onPrimary,
      headerShadowVisible: false,
      headerTitle: () => (
        <View style={styles.headerTitleRow}>
          <Avatar
            label={getInitials(customer.name)}
            size={32}
            backgroundColor={colors.onPrimary}
            color={colors.primary}
          />
          <View style={styles.headerTitleInfo}>
            <Text style={styles.headerTitleName} numberOfLines={1}>
              {customer.name}
            </Text>
            {customer.phone ? (
              <Text style={styles.headerTitlePhone} numberOfLines={1}>
                {customer.phone}
              </Text>
            ) : null}
          </View>
        </View>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => setShareSheetVisible(true)}
          accessibilityLabel={t("khata.shareStatement")}
          accessibilityRole="button"
          style={styles.headerButton}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.onPrimary} />
        </Pressable>
      ),
    });
  }, [navigation, customer, t, colors, styles]);

  function handleNewEntry() {
    setNewEntrySheetVisible(true);
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
    balance > 0
      ? t("khata.balanceOwesYou")
      : balance < 0
        ? t("khata.balanceYouOwe")
        : t("khata.balanceZero");

  const showOpeningBalanceRow = customer.openingBalance !== 0;
  const isTrulyEmpty = visibleEntries.length === 0 && !showOpeningBalanceRow;

  const newEntryOptions: ActionSheetOption[] = [
    {
      key: "simple",
      icon: "reader-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: t("khata.simpleEntry"),
      description: t("khata.simpleEntryHint"),
      onPress: () => navigation.navigate("EntryForm", { customerId, mode: "simple" }),
    },
    {
      key: "bill",
      icon: "pricetag",
      iconBackgroundColor: colors.primary,
      iconColor: colors.accent,
      label: t("entry.itemizedBill"),
      description: t("khata.itemizedBillHint"),
      onPress: () => navigation.navigate("EntryForm", { customerId, mode: "bill" }),
    },
  ];

  const shareOptions: ActionSheetOption[] = [
    {
      key: "whatsapp",
      icon: "logo-whatsapp",
      iconBackgroundColor: colors.iOwe,
      iconColor: colors.onPrimary,
      label: t("share.whatsapp"),
      description: t("share.whatsappHint"),
      onPress: () => handleShareStatement("whatsapp"),
    },
    {
      key: "sms",
      icon: "chatbubble-ellipses-outline",
      iconBackgroundColor: colors.primary,
      iconColor: colors.onPrimary,
      label: t("share.sms"),
      description: t("share.smsHint"),
      onPress: () => handleShareStatement("sms"),
    },
    {
      key: "pdf",
      icon: "document-text",
      iconBackgroundColor: colors.owesMe,
      iconColor: colors.onPrimary,
      label: t("share.pdf"),
      description: t("share.pdfHint"),
      onPress: () => handleShareStatement("pdf"),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navyBlock}>
        <View
          style={[
            styles.balanceBanner,
            {
              backgroundColor: withAlpha(balanceColor, 0.22),
              borderColor: withAlpha(balanceColor, 0.5),
            },
          ]}
        >
          <View style={styles.balanceBannerInfo}>
            <Text style={styles.balanceLabel}>{balanceLabel}</Text>
            <Text
              style={[styles.balanceAmount, { color: colors.onPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatMoney(Math.abs(balance), currencySymbol)}
            </Text>
          </View>
          <Ionicons
            name={balance >= 0 ? "arrow-down-outline" : "arrow-up-outline"}
            size={22}
            color={balanceColor}
          />
        </View>
      </View>

      <Pressable
        style={styles.statementRangeToggle}
        accessibilityRole="button"
        onPress={() => setStatementRangeExpanded((current) => !current)}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.statementRangeToggleText}>{t("khata.filterStatementByDate")}</Text>
        <Ionicons
          name={statementRangeExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
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
          <DateField
            value={statementDateFrom || todayIso()}
            onChange={setStatementDateFrom}
            label={t("khata.statementDateFrom")}
            style={styles.statementDateField}
          />
          <DateField
            value={statementDateTo || todayIso()}
            onChange={setStatementDateTo}
            label={t("khata.statementDateTo")}
            style={styles.statementDateField}
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

      {isTrulyEmpty ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="receipt-outline" size={40} color={colors.primaryMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t("khata.emptyTitle")}</Text>
          <Text style={styles.emptyText}>
            {t("khata.emptyDescription", { name: customer.name })}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
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
          ListFooterComponent={
            showOpeningBalanceRow ? (
              <OpeningBalanceRow
                amount={customer.openingBalance}
                date={customer.createdAt.slice(0, 10)}
                currencySymbol={currencySymbol}
              />
            ) : null
          }
        />
      )}

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
      
      <Pressable
        style={styles.newEntryButton}
        accessibilityLabel={isTrulyEmpty ? t("khata.addFirstEntry") : t("khata.newEntry")}
        accessibilityRole="button"
        onPress={handleNewEntry}
      >
        <Ionicons name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.newEntryButtonText}>
          {isTrulyEmpty ? t("khata.addFirstEntry") : t("khata.newEntry")}
        </Text>
      </Pressable>

      <ActionSheet
        visible={newEntrySheetVisible}
        onClose={() => setNewEntrySheetVisible(false)}
        title={t("khata.newEntryFor", { name: customer.name })}
        subtitle={<Text style={styles.sheetSubtitle}>{t("khata.newEntryPrompt")}</Text>}
        options={newEntryOptions}
      />

      <ActionSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={t("share.statementTitle")}
        subtitle={
          <Text style={styles.sheetSubtitle}>
            {customer.name} ·{" "}
            <Text style={{ color: balanceColor, fontWeight: "700" }}>
              {formatMoney(Math.abs(balance), currencySymbol)}
            </Text>{" "}
            {balanceLabel}
          </Text>
        }
        options={shareOptions}
        cancelLabel={t("customerForm.cancel")}
      />
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
  const color = entry.isDeleted ? colors.textSecondary : isCashOut ? colors.owesMe : colors.iOwe;
  const softBackground = entry.isDeleted
    ? colors.surface
    : isCashOut
      ? colors.owesMeSoft
      : colors.iOweSoft;
  const sign = isCashOut ? "+" : "-";
  const isBill = entry.type === "bill";
  const icon = entry.isDeleted
    ? "trash-outline"
    : isCashOut
      ? "arrow-down-outline"
      : "arrow-up-outline";
  const relative = formatRelativeDate(entry.createdAt);
  const dateLabel =
    relative.kind === "today"
      ? relative.time
      : relative.kind === "yesterday"
        ? t("common.yesterday")
        : relative.kind === "daysAgo"
          ? t("common.daysAgo", { count: relative.count })
          : formatShortDate(entry.entryDate);
  const suffix = isBill ? t("entry.itemized") : entry.note ?? undefined;

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={[styles.rowIconBox, { backgroundColor: softBackground }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, entry.isDeleted && styles.strikethrough]} numberOfLines={1}>
          {isBill
            ? t("entry.billRowLabel", {
                summary: entry.lineItems[0]?.description ?? t("entry.itemsCount", { count: entry.lineItems.length }),
              })
            : isCashOut
              ? t("entry.gaveOnCredit")
              : t("khata.cashPayment")}
        </Text>
        <Text style={styles.rowSubtext} numberOfLines={1}>
          {dateLabel}
          {entry.isDeleted ? ` · ${t("entry.historyDeleted")}` : suffix ? ` · ${suffix}` : ""}
        </Text>
      </View>
      <Text
        style={[styles.rowAmount, { color }, entry.isDeleted && styles.strikethrough]}
        numberOfLines={1}
      >
        {sign}
        {formatMoney(entry.amount, currencySymbol)}
      </Text>
    </Pressable>
  );
}

function OpeningBalanceRow({
  amount,
  date,
  currencySymbol,
}: {
  amount: number;
  date: string;
  currencySymbol: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isOwed = amount >= 0;
  const color = isOwed ? colors.owesMe : colors.iOwe;
  const softBackground = isOwed ? colors.owesMeSoft : colors.iOweSoft;

  return (
    <View style={styles.row}>
      <View style={[styles.rowIconBox, { backgroundColor: softBackground }]}>
        <Ionicons name={isOwed ? "arrow-down-outline" : "arrow-up-outline"} size={20} color={color} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {t("khata.openingBalance")}
        </Text>
        <Text style={styles.rowSubtext} numberOfLines={1}>
          {formatShortDate(date)}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
        {formatMoney(Math.abs(amount), currencySymbol)}
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
  headerButton: {
    paddingHorizontal: theme.spacing.sm,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleInfo: {
    marginStart: theme.spacing.sm,
  },
  headerTitleName: {
    ...theme.typography.heading,
    color: colors.onPrimary,
  },
  headerTitlePhone: {
    ...theme.typography.caption,
    color: colors.primaryMuted,
  },
  navyBlock: {
    backgroundColor: colors.primary,
    padding: theme.spacing.md,
  },
  balanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  balanceBannerInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  balanceLabel: {
    ...theme.typography.body,
    color: colors.primaryMuted,
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
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statementRangeToggleText: {
    ...theme.typography.body,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
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
  statementDateField: {
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: theme.spacing.md,
  },
  rowIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
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
  strikethrough: {
    textDecorationLine: "line-through",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: "center",
  },
  emptyText: {
    ...theme.typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  sectionHeader: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: colors.background,
    paddingVertical: theme.spacing.sm,
  },
  newEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    margin: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: colors.primary,
  },
  newEntryButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "700",
  },
  sheetSubtitle: {
    ...theme.typography.body,
    color: colors.textSecondary,
  },
});
