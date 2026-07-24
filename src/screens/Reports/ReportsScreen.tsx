import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { theme } from "../../theme/theme";

export function ReportsScreen() {
  const { t } = useTranslation();

  const [totals, setTotals] = useState({ totalReceivable: 0, totalPayable: 0 });
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"csv" | "excel" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardTotals, data] = await Promise.all([
      getDashboardTotals(db),
      getExportData(db),
    ]);
    setTotals(dashboardTotals);
    setExportData(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleExportCsv() {
    if (!exportData) return;
    setBusy("csv");
    try {
      const shared = await writeAndShareFile({
        fileName: `${exportBaseName(exportData)}.csv`,
        contents: buildEntriesCsv(exportData),
        encoding: "utf8",
        mimeType: CSV_MIME,
      });
      if (!shared) Alert.alert(t("share.unavailable"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportExcel() {
    if (!exportData) return;
    setBusy("excel");
    try {
      const shared = await writeAndShareFile({
        fileName: `${exportBaseName(exportData)}.xlsx`,
        contents: buildWorkbookBase64(exportData),
        encoding: "base64",
        mimeType: XLSX_MIME,
      });
      if (!shared) Alert.alert(t("share.unavailable"));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !exportData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const currency = exportData.currencySymbol;
  const isEmpty = exportData.entries.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t("home.totalReceivable")}</Text>
          <Text style={[styles.totalAmount, { color: theme.colors.owesMe }]}>
            {formatMoney(totals.totalReceivable, currency)}
          </Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t("home.totalPayable")}</Text>
          <Text style={[styles.totalAmount, { color: theme.colors.iOwe }]}>
            {formatMoney(totals.totalPayable, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label={t("reports.customers")} value={String(exportData.customers.length)} />
        <Stat label={t("reports.entries")} value={String(exportData.entries.length)} />
      </View>

      <Text style={styles.sectionTitle}>{t("reports.export")}</Text>
      <Text style={styles.sectionHint}>{t("reports.exportHint")}</Text>

      <ExportButton
        icon="document-text-outline"
        label={t("reports.exportCsv")}
        onPress={handleExportCsv}
        busy={busy === "csv"}
        disabled={isEmpty || busy !== null}
      />
      <ExportButton
        icon="grid-outline"
        label={t("reports.exportExcel")}
        onPress={handleExportExcel}
        busy={busy === "excel"}
        disabled={isEmpty || busy !== null}
      />

      {isEmpty ? <Text style={styles.emptyText}>{t("reports.empty")}</Text> : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
  return (
    <Pressable
      style={[styles.exportButton, disabled && styles.exportButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      )}
      <Text style={styles.exportButtonText}>{label}</Text>
      <Ionicons name="share-outline" size={18} color={theme.colors.textSecondary} />
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  totalLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: "center",
  },
  statValue: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionHint: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.md,
  },
});
