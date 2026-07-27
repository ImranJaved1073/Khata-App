import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { WeeklyChartBucket } from "../../lib/reportsChart";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

const CHART_HEIGHT = 140;

/** "Receivable vs collected" weekly bar chart (spec's Reports chart) — plain Views, no charting dependency. */
export function ReceivableVsCollectedChart({ buckets }: { buckets: WeeklyChartBucket[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const maxValue = Math.max(1, ...buckets.flatMap((b) => [b.newReceivable, b.collected]));
  const hasData = buckets.some((b) => b.newReceivable > 0 || b.collected > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("reports.chartTitle")}</Text>

      {hasData ? (
        <>
          <View style={styles.chartRow}>
            {buckets.map((bucket) => (
              <View key={bucket.label} style={styles.group}>
                <View style={styles.barsRow}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (bucket.newReceivable / maxValue) * CHART_HEIGHT),
                        backgroundColor: colors.owesMe,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (bucket.collected / maxValue) * CHART_HEIGHT),
                        backgroundColor: colors.iOwe,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.groupLabel}>{bucket.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.owesMe }]} />
              <Text style={styles.legendText}>{t("reports.chartNewReceivable")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.iOwe }]} />
              <Text style={styles.legendText}>{t("reports.chartCollected")}</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>{t("reports.chartEmpty")}</Text>
      )}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.heading,
      color: colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    chartRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-around",
      height: CHART_HEIGHT,
      marginBottom: theme.spacing.sm,
    },
    group: {
      flex: 1,
      alignItems: "center",
    },
    barsRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: theme.spacing.xs,
      height: CHART_HEIGHT,
      width: "100%",
    },
    bar: {
      flex: 1,
      maxWidth: 28,
      borderTopLeftRadius: theme.radius.sm,
      borderTopRightRadius: theme.radius.sm,
    },
    groupLabel: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    legendRow: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    legendText: {
      ...theme.typography.caption,
      color: colors.textSecondary,
    },
    emptyText: {
      ...theme.typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: theme.spacing.lg,
    },
  });
