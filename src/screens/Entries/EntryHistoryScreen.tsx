import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { db } from "../../db/client";
import { formatMoney } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import { listAuditForEntity } from "../../repositories/auditRepository";
import { getEntry } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import { theme } from "../../theme/theme";
import type { AuditLogEntry } from "../../types/models";

type Route = RouteProp<CustomersStackParamList, "EntryHistory">;

const MONEY_FIELDS = new Set(["amount", "rate"]);

function formatDiffValue(field: string, value: unknown, currencySymbol: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field) && typeof value === "number") {
    return formatMoney(value, currencySymbol);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function EntryHistoryScreen() {
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const { entryId } = route.params;

  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [entry, entryAudit, settings] = await Promise.all([
      getEntry(db, entryId),
      listAuditForEntity(db, "entry", entryId),
      getSettings(db),
    ]);
    const lineItemAudit = entry
      ? (
          await Promise.all(
            entry.lineItems.map((li) => listAuditForEntity(db, "line_item", li.id)),
          )
        ).flat()
      : [];
    const merged = [...entryAudit, ...lineItemAudit].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    setAuditRows(merged);
    setCurrencySymbol(settings.currencySymbol);
    setLoading(false);
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {auditRows.length === 0 ? (
        <Text style={styles.emptyText}>{t("entry.historyEmpty")}</Text>
      ) : (
        auditRows.map((row) => <AuditRow key={row.id} row={row} currencySymbol={currencySymbol} />)
      )}
    </ScrollView>
  );
}

function AuditRow({
  row,
  currencySymbol,
}: {
  row: AuditLogEntry;
  currencySymbol: string;
}) {
  const { t } = useTranslation();
  const actionColor =
    row.action === "create"
      ? theme.colors.success
      : row.action === "delete"
        ? theme.colors.danger
        : theme.colors.primary;
  const actionLabel =
    row.action === "create"
      ? t("entry.historyCreated")
      : row.action === "delete"
        ? t("entry.historyDeleted")
        : t("entry.historyEdited");
  const entityLabel = row.entity === "line_item" ? t("entry.lineItem") : t("entry.detailTitle");

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={[styles.badge, { backgroundColor: actionColor }]}>
          <Text style={styles.badgeText}>{actionLabel}</Text>
        </View>
        <Text style={styles.rowEntity}>{entityLabel}</Text>
      </View>
      <Text style={styles.rowDate}>{new Date(row.createdAt).toLocaleString()}</Text>
      {row.diff ? (
        <View style={styles.diffBox}>
          {Object.entries(row.diff).map(([field, change]) => (
            <Text key={field} style={styles.diffLine}>
              {field}: {formatDiffValue(field, change.old, currencySymbol)} →{" "}
              {formatDiffValue(field, change.new, currencySymbol)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
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
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.lg,
  },
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: "600",
  },
  rowEntity: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  rowDate: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  diffBox: {
    marginTop: theme.spacing.xs,
    gap: 2,
  },
  diffLine: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
  },
});
