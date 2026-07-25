import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import {
  buildEntriesCsv,
  buildWorkbookBase64,
  exportBaseName,
} from "../../lib/exportData";
import { CSV_MIME, XLSX_MIME, writeAndShareFile } from "../../lib/exportFile";
import { formatMoney } from "../../lib/money";
import { getDashboardTotals } from "../../repositories/dashboardRepository";
import type { ExportData } from "../../repositories/exportRepository";
import { getExportData } from "../../repositories/exportRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function ReportsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [totals, setTotals] = useState({ totalReceivable: 0, totalPayable: 0 });
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"csv" | "excel" | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t("home.totalReceivable")}</Text>
          <Text
            style={[styles.totalAmount, { color: colors.owesMe }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(totals.totalReceivable, currency)}
          </Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t("home.totalPayable")}</Text>
          <Text
            style={[styles.totalAmount, { color: colors.iOwe }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(totals.totalPayable, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label={t("reports.customers")} value={String(exportData.customers.length)} />
        <Stat label={t("reports.entries")} value={String(filteredData.entries.length)} />
      </View>

      <Text style={styles.sectionTitle}>{t("reports.dateRange")}</Text>
      <View style={styles.dateRow}>
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
          style={[styles.dateInput, styles.input]}
          placeholder={`${t("reports.dateFrom")} (YYYY-MM-DD)`}
          placeholderTextColor={colors.textSecondary}
        />
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
          style={[styles.dateInput, styles.input]}
          placeholder={`${t("reports.dateTo")} (YYYY-MM-DD)`}
          placeholderTextColor={colors.textSecondary}
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

      <Text style={styles.sectionTitle}>{t("reports.export")}</Text>
      <Text style={styles.sectionHint}>{t("reports.exportHint")}</Text>

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
      />

      {isLedgerEmpty ? (
        <Text style={styles.emptyText}>{t("reports.empty")}</Text>
      ) : isFilteredEmpty ? (
        <Text style={styles.emptyText}>{t("reports.noEntriesInRange")}</Text>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExportButton({
  icon,
  label,
  onPress,
  busy,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.exportButton, disabled && styles.exportButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={22} color={colors.primary} />
      )}
      <Text style={styles.exportButtonText}>{label}</Text>
      <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
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
  content: {
    padding: theme.spacing.md,
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
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: "center",
  },
  statValue: {
    ...theme.typography.title,
    color: colors.textPrimary,
  },
  statLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionHint: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  input: {
    ...theme.typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dateInput: {
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
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  emptyText: {
    ...theme.typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.md,
  },
});
