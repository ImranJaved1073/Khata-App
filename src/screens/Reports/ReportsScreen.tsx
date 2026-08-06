import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "../../components/DateField";
import { StatCard } from "../../components/StatCard";
import { db } from "../../db/client";
import { localDateString } from "../../lib/dateFormat";
import {
  buildEntriesCsv,
  buildWorkbookBase64,
  exportBaseName,
} from "../../lib/exportData";
import { CSV_MIME, XLSX_MIME, writeAndShareFile } from "../../lib/exportFile";
import { formatMoney } from "../../lib/money";
import { buildWeeklyReceivableVsCollected } from "../../lib/reportsChart";
import { getDashboardTotals } from "../../repositories/dashboardRepository";
import type { ExportData } from "../../repositories/exportRepository";
import { getExportData } from "../../repositories/exportRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import { ReceivableVsCollectedChart } from "./ReceivableVsCollectedChart";

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatRangeDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [totals, setTotals] = useState({ totalReceivable: 0, totalPayable: 0 });
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"csv" | "excel" | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeExpanded, setRangeExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardTotals, data] = await Promise.all([
        getDashboardTotals(db),
        getExportData(db),
      ]);
      setTotals(dashboardTotals);
      setExportData(data);
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

  const filteredData = useMemo<ExportData | null>(() => {
    if (!exportData) return null;
    const from = isValidDate(dateFrom) ? dateFrom : null;
    const to = isValidDate(dateTo) ? dateTo : null;
    if (!from && !to) return exportData;
    return {
      ...exportData,
      entries: exportData.entries.filter(({ entry }) => {
        if (from && entry.entryDate < from) return false;
        if (to && entry.entryDate > to) return false;
        return true;
      }),
    };
  }, [exportData, dateFrom, dateTo]);

  const chartBuckets = useMemo(
    () =>
      buildWeeklyReceivableVsCollected(
        (filteredData?.entries ?? []).map(({ entry }) => ({
          entryDate: entry.entryDate,
          direction: entry.direction,
          amount: entry.amount,
        })),
        {
          dateFrom: isValidDate(dateFrom) ? dateFrom : undefined,
          dateTo: isValidDate(dateTo) ? dateTo : undefined,
        },
      ),
    [filteredData, dateFrom, dateTo],
  );

  async function handleExportCsv() {
    if (!filteredData) return;
    setBusy("csv");
    try {
      const shared = await writeAndShareFile({
        fileName: `${exportBaseName(filteredData)}.csv`,
        contents: buildEntriesCsv(filteredData),
        encoding: "utf8",
        mimeType: CSV_MIME,
      });
      if (!shared) Alert.alert(t("share.unavailable"));
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportExcel() {
    if (!filteredData) return;
    setBusy("excel");
    try {
      const shared = await writeAndShareFile({
        fileName: `${exportBaseName(filteredData)}.xlsx`,
        contents: buildWorkbookBase64(filteredData),
        encoding: "base64",
        mimeType: XLSX_MIME,
      });
      if (!shared) Alert.alert(t("share.unavailable"));
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !exportData || !filteredData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currency = exportData.currencySymbol;
  const isLedgerEmpty = exportData.entries.length === 0;
  const isFilteredEmpty = filteredData.entries.length === 0;
  const isFiltering = isValidDate(dateFrom) || isValidDate(dateTo);
  const rangeLabel = isFiltering
    ? t("reports.rangeSummary", {
        from: isValidDate(dateFrom) ? formatRangeDate(dateFrom) : "…",
        to: isValidDate(dateTo) ? formatRangeDate(dateTo) : "…",
      })
    : exportData.entries.length > 0
      ? t("reports.rangeSummary", {
          from: formatRangeDate(exportData.entries[exportData.entries.length - 1].entry.entryDate),
          to: formatRangeDate(exportData.entries[0].entry.entryDate),
        })
      : t("reports.dateRange");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
      >
        <Text style={styles.title}>{t("reports.title")}</Text>

        <Pressable
          style={styles.rangeToggle}
          accessibilityRole="button"
          onPress={() => setRangeExpanded((current) => !current)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.rangeToggleText} numberOfLines={1}>
            {rangeLabel}
          </Text>
          <Ionicons
            name={rangeExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
        {rangeExpanded ? (
          <View style={styles.dateRow}>
            <DateField
              value={dateFrom || localDateString()}
              onChange={setDateFrom}
              label={t("reports.dateFrom")}
              style={styles.dateField}
            />
            <DateField
              value={dateTo || localDateString()}
              onChange={setDateTo}
              label={t("reports.dateTo")}
              style={styles.dateField}
            />
            {isFiltering ? (
              <Pressable
                style={styles.clearButton}
                accessibilityRole="button"
                onPress={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <Text style={styles.clearButtonText}>{t("reports.clearFilter")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.totalsRow}>
          <StatCard
            label={t("home.totalReceivable")}
            amount={formatMoney(totals.totalReceivable, currency)}
            color={colors.owesMe}
            direction="receivable"
          />
          <StatCard
            label={t("home.totalPayable")}
            amount={formatMoney(totals.totalPayable, currency)}
            color={colors.iOwe}
            direction="payable"
          />
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("reports.customers")} value={String(exportData.customers.length)} />
          <Stat label={t("reports.entries")} value={String(filteredData.entries.length)} />
        </View>

        <ReceivableVsCollectedChart buckets={chartBuckets} />

        {isLedgerEmpty ? (
          <Text style={styles.emptyText}>{t("reports.empty")}</Text>
        ) : isFilteredEmpty ? (
          <Text style={styles.emptyText}>{t("reports.noEntriesInRange")}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.exportRow}>
        <ExportButton
          icon="document-text-outline"
          label={t("reports.exportCsv")}
          onPress={handleExportCsv}
          busy={busy === "csv"}
          disabled={isFilteredEmpty || busy !== null}
        />
        <ExportButton
          icon="grid-outline"
          label={t("reports.exportExcel")}
          onPress={handleExportExcel}
          busy={busy === "excel"}
          disabled={isFilteredEmpty || busy !== null}
          variant="filled"
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ExportButton({
  icon,
  label,
  onPress,
  busy,
  disabled,
  variant = "outline",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  variant?: "outline" | "filled";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFilled = variant === "filled";
  const contentColor = isFilled ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      style={[
        styles.exportButton,
        isFilled && styles.exportButtonFilled,
        disabled && styles.exportButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <Ionicons name={icon} size={20} color={contentColor} />
      )}
      <Text style={[styles.exportButtonText, { color: contentColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.title,
    color: colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  rangeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  rangeToggleText: {
    ...theme.typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  totalsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
  },
  statValue: {
    ...theme.typography.money,
    fontSize: 24,
    color: colors.textPrimary,
  },
  statLabel: {
    ...theme.typography.body,
    color: colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  dateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dateField: {
    flex: 1,
    minWidth: 140,
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
  exportRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  exportButtonFilled: {
    backgroundColor: colors.primary,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    ...theme.typography.body,
    fontWeight: "600",
  },
  emptyText: {
    ...theme.typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.md,
  },
});
