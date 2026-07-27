import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DateField } from "../../components/DateField";
import { db } from "../../db/client";
import { formatTimeOfDay } from "../../lib/dateFormat";
import { buildStatementHtml, buildStatementText } from "../../lib/documentFormat";
import { buildEntriesCsv, buildWorkbookBase64 } from "../../lib/exportData";
import { CSV_MIME, XLSX_MIME, writeAndShareFile } from "../../lib/exportFile";
import { formatMoney } from "../../lib/money";
import { sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import { getInitials } from "../../lib/textFormat";
import type { CustomersStackParamList } from "../../navigation/types";
import { computeBalanceFromEntries } from "../../repositories/balance";
import {
  customerHasEntries,
  deleteCustomer,
  getCustomer,
  setCustomerArchived,
} from "../../repositories/customerRepository";
import { getStatementDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { listEntriesForCustomer } from "../../repositories/entryRepository";
import { getCustomerExportData } from "../../repositories/exportRepository";
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

type StatementPreset = "month" | "last30" | "allTime" | "custom";

function computePresetRange(
  preset: StatementPreset,
  current: { from: string; to: string },
): { from: string; to: string } {
  const today = todayIso();
  if (preset === "month") {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { from, to: today };
  }
  if (preset === "last30") {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { from: from.toISOString().slice(0, 10), to: today };
  }
  if (preset === "allTime") {
    return { from: "", to: "" };
  }
  return current;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "customer";
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
  const [statementPreset, setStatementPreset] = useState<StatementPreset>("allTime");
  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");
  const [appliedStatementRange, setAppliedStatementRange] = useState({ dateFrom: "", dateTo: "" });
  const [newEntrySheetVisible, setNewEntrySheetVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [archiveDialogVisible, setArchiveDialogVisible] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ hasEntries: boolean } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const isFiltering =
    isValidDate(appliedStatementRange.dateFrom) || isValidDate(appliedStatementRange.dateTo);
  const dateFilteredEntries = useMemo(() => {
    if (!isFiltering) return visibleEntries;
    const from = isValidDate(appliedStatementRange.dateFrom) ? appliedStatementRange.dateFrom : null;
    const to = isValidDate(appliedStatementRange.dateTo) ? appliedStatementRange.dateTo : null;
    return visibleEntries.filter((entry) => {
      if (from && entry.entryDate < from) return false;
      if (to && entry.entryDate > to) return false;
      return true;
    });
  }, [visibleEntries, isFiltering, appliedStatementRange]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleShareStatement(method: "whatsapp" | "sms" | "pdf") {
    try {
      const dateFrom = isValidDate(appliedStatementRange.dateFrom)
        ? appliedStatementRange.dateFrom
        : undefined;
      const dateTo = isValidDate(appliedStatementRange.dateTo)
        ? appliedStatementRange.dateTo
        : undefined;
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

  function selectStatementPreset(preset: StatementPreset) {
    setStatementPreset(preset);
    const range = computePresetRange(preset, { from: statementDateFrom, to: statementDateTo });
    setStatementDateFrom(range.from);
    setStatementDateTo(range.to);
  }

  function handleApplyStatementFilter() {
    setAppliedStatementRange({ dateFrom: statementDateFrom, dateTo: statementDateTo });
    setStatementRangeExpanded(false);
  }

  function handleResetStatementFilter() {
    setStatementPreset("allTime");
    setStatementDateFrom("");
    setStatementDateTo("");
    setAppliedStatementRange({ dateFrom: "", dateTo: "" });
  }

  async function handleExportStatement(kind: "csv" | "excel") {
    try {
      const data = await getCustomerExportData(db, customerId);
      if (!data) return;
      const base = `${slugify(data.customers[0].name)}-statement-${data.generatedAt.slice(0, 10)}`;
      const shared = await writeAndShareFile(
        kind === "csv"
          ? { fileName: `${base}.csv`, contents: buildEntriesCsv(data), encoding: "utf8", mimeType: CSV_MIME }
          : {
              fileName: `${base}.xlsx`,
              contents: buildWorkbookBase64(data),
              encoding: "base64",
              mimeType: XLSX_MIME,
            },
      );
      if (!shared) Alert.alert(t("share.unavailable"));
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  async function handleToggleArchive() {
    if (!customer) return;
    setArchiveLoading(true);
    try {
      await setCustomerArchived(db, customer.id, !customer.isArchived);
      setArchiveDialogVisible(false);
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setArchiveLoading(false);
    }
  }

  function requestDeleteCustomer() {
    customerHasEntries(db, customerId)
      .then((hasEntries) => setDeleteDialog({ hasEntries }))
      .catch((error) => {
        console.error(error);
        Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
      });
  }

  async function handleConfirmDeleteCustomer() {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    try {
      if (deleteDialog.hasEntries) {
        await setCustomerArchived(db, customerId, true);
        setDeleteDialog(null);
        await load();
      } else {
        await deleteCustomer(db, customerId);
        setDeleteDialog(null);
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setDeleteLoading(false);
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
        <View style={styles.headerActionsRow}>
          <Pressable
            onPress={() => setShareSheetVisible(true)}
            accessibilityLabel={t("khata.shareStatement")}
            accessibilityRole="button"
            style={styles.headerButton}
          >
            <Ionicons name="share-social-outline" size={22} color={colors.onPrimary} />
          </Pressable>
          <Pressable
            onPress={() => setOverflowMenuVisible(true)}
            accessibilityLabel={t("khata.moreOptions")}
            accessibilityRole="button"
            style={styles.headerButton}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
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

  const hasOpeningBalance = customer.openingBalance !== 0;
  const isTrulyEmpty = visibleEntries.length === 0 && !hasOpeningBalance;
  // The synthetic opening-balance row represents the customer's true starting balance — only
  // meaningful when looking at the full, unfiltered history, so a date filter hides it rather
  // than showing a number that no longer reconciles with the (now partial) list above it.
  const showOpeningBalanceRow = hasOpeningBalance && !isFiltering;
  const isFilteredEmpty = !isTrulyEmpty && isFiltering && dateFilteredEntries.length === 0;

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

  const overflowMenuOptions: ActionSheetOption[] = [
    {
      key: "edit",
      icon: "create-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: t("customers.editCustomer"),
      onPress: () => navigation.navigate("CustomerForm", { customerId }),
    },
    {
      key: "export",
      icon: "download-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: t("khata.exportStatement"),
      onPress: () => setExportSheetVisible(true),
    },
    {
      key: "archive",
      icon: customer.isArchived ? "arrow-undo-outline" : "archive-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: customer.isArchived ? t("customerForm.unarchive") : t("customerForm.archive"),
      onPress: () => setArchiveDialogVisible(true),
    },
    {
      key: "delete",
      icon: "trash-outline",
      iconBackgroundColor: colors.owesMeSoft,
      iconColor: colors.danger,
      label: t("customerForm.delete"),
      onPress: requestDeleteCustomer,
    },
  ];

  const exportOptions: ActionSheetOption[] = [
    {
      key: "csv",
      icon: "document-text-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: t("khata.exportAsCsv"),
      onPress: () => handleExportStatement("csv"),
    },
    {
      key: "excel",
      icon: "grid-outline",
      iconBackgroundColor: colors.primarySoft,
      iconColor: colors.primary,
      label: t("khata.exportAsExcel"),
      onPress: () => handleExportStatement("excel"),
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
      (isValidDate(appliedStatementRange.dateFrom) || isValidDate(appliedStatementRange.dateTo)) ? (
        <Text style={styles.statementRangeSummary}>
          {t("khata.statementRangeSummary", {
            from: isValidDate(appliedStatementRange.dateFrom)
              ? appliedStatementRange.dateFrom
              : "…",
            to: isValidDate(appliedStatementRange.dateTo) ? appliedStatementRange.dateTo : "…",
          })}
        </Text>
      ) : null}
      {statementRangeExpanded ? (
        <View style={styles.statementFilterPanel}>
          <View style={styles.presetRow}>
            <PresetChip
              label={t("khata.filterThisMonth")}
              active={statementPreset === "month"}
              onPress={() => selectStatementPreset("month")}
            />
            <PresetChip
              label={t("khata.filterLast30Days")}
              active={statementPreset === "last30"}
              onPress={() => selectStatementPreset("last30")}
            />
            <PresetChip
              label={t("khata.filterAllTime")}
              active={statementPreset === "allTime"}
              onPress={() => selectStatementPreset("allTime")}
            />
            <PresetChip
              label={t("khata.filterCustom")}
              active={statementPreset === "custom"}
              onPress={() => selectStatementPreset("custom")}
            />
          </View>
          <View style={styles.statementRangeRow}>
            <DateField
              value={statementDateFrom || todayIso()}
              onChange={(next) => {
                setStatementDateFrom(next);
                setStatementPreset("custom");
              }}
              label={t("khata.statementDateFrom")}
              style={styles.statementDateField}
            />
            <DateField
              value={statementDateTo || todayIso()}
              onChange={(next) => {
                setStatementDateTo(next);
                setStatementPreset("custom");
              }}
              label={t("khata.statementDateTo")}
              style={styles.statementDateField}
            />
          </View>
          <View style={styles.filterActionsRow}>
            <Pressable
              style={styles.resetButton}
              accessibilityRole="button"
              onPress={handleResetStatementFilter}
            >
              <Text style={styles.resetButtonText}>{t("khata.filterReset")}</Text>
            </Pressable>
            <Pressable
              style={styles.applyButton}
              accessibilityRole="button"
              onPress={handleApplyStatementFilter}
            >
              <Text style={styles.applyButtonText}>{t("khata.filterApply")}</Text>
            </Pressable>
          </View>
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
      ) : isFilteredEmpty ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="calendar-outline" size={40} color={colors.primaryMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t("khata.noEntriesInRange")}</Text>
          <Text style={styles.emptyText}>{t("khata.noEntriesInRangeDescription")}</Text>
        </View>
      ) : (
        <FlatList
          data={dateFilteredEntries}
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

      <ActionSheet
        visible={overflowMenuVisible}
        onClose={() => setOverflowMenuVisible(false)}
        title={customer.name}
        options={overflowMenuOptions}
        cancelLabel={t("customerForm.cancel")}
      />

      <ActionSheet
        visible={exportSheetVisible}
        onClose={() => setExportSheetVisible(false)}
        title={t("khata.exportStatement")}
        options={exportOptions}
        cancelLabel={t("customerForm.cancel")}
      />

      <ConfirmDialog
        visible={archiveDialogVisible}
        title={
          customer.isArchived
            ? t("customerForm.unarchiveConfirmTitle")
            : t("customerForm.archiveConfirmTitle")
        }
        message={
          customer.isArchived
            ? t("customerForm.unarchiveConfirmMessage")
            : t("customerForm.archiveConfirmMessage")
        }
        confirmLabel={customer.isArchived ? t("customerForm.unarchive") : t("customerForm.archive")}
        cancelLabel={t("customerForm.cancel")}
        loading={archiveLoading}
        onCancel={() => setArchiveDialogVisible(false)}
        onConfirm={handleToggleArchive}
      />

      <ConfirmDialog
        visible={deleteDialog !== null}
        title={
          deleteDialog?.hasEntries
            ? t("customerForm.archiveConfirmTitle")
            : t("customerForm.deleteConfirmTitle")
        }
        message={
          deleteDialog?.hasEntries
            ? t("customers.deleteHasEntriesMessage")
            : t("customerForm.deleteConfirmMessage")
        }
        confirmLabel={deleteDialog?.hasEntries ? t("customerForm.archive") : t("customerForm.delete")}
        cancelLabel={t("customerForm.cancel")}
        destructive
        loading={deleteLoading}
        onCancel={() => setDeleteDialog(null)}
        onConfirm={handleConfirmDeleteCustomer}
      />
    </View>
  );
}

function PresetChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.presetChip, active && styles.presetChipActive]}
    >
      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{label}</Text>
    </Pressable>
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
  const dateLabel = `${formatShortDate(entry.entryDate)} · ${formatTimeOfDay(entry.createdAt)}`;
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
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
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
  statementFilterPanel: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  presetChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: colors.onPrimary,
  },
  statementRangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statementDateField: {
    flex: 1,
    minWidth: 120,
  },
  filterActionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  resetButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  applyButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
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
