import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import type { ActionSheetOption } from "../../components/ActionSheet";
import { ActionSheet } from "../../components/ActionSheet";
import { db } from "../../db/client";
import { buildBillHtml, buildBillText } from "../../lib/documentFormat";
import { formatMoney } from "../../lib/money";
import { formatTimeOfDay } from "../../lib/dateFormat";
import { sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import type { CustomersStackParamList } from "../../navigation/types";
import { computeCustomerBalance } from "../../repositories/balance";
import { getCustomer } from "../../repositories/customerRepository";
import { getBillDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { getEntry } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import { GARMENT_COLORS, type AppColors, type GarmentColorLabel } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { Customer } from "../../types/models";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "BillSaved">;
type Route = RouteProp<CustomersStackParamList, "BillSaved">;

export function BillSavedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { entryId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [entry, setEntry] = useState<EntryWithLineItems | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newBalance, setNewBalance] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryRow, settings] = await Promise.all([getEntry(db, entryId), getSettings(db)]);
      setEntry(entryRow);
      setCurrencySymbol(settings.currencySymbol);
      if (entryRow) {
        const customerRow = await getCustomer(db, entryRow.customerId);
        setCustomer(customerRow);
        if (customerRow) {
          const balance = await computeCustomerBalance(db, customerRow.id, customerRow.openingBalance);
          setNewBalance(balance);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setLoading(false);
    }
  }, [entryId, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: t("entry.billSavedTitle"),
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
      ),
      headerRight: undefined,
    });
  }, [navigation, t, colors, styles]);

  async function handleShare(method: "whatsapp" | "sms" | "pdf") {
    if (!entry) return;
    try {
      const data = await getBillDocumentData(db, entry.id);
      if (!data) return;
      if (method === "whatsapp") {
        shareViaWhatsApp(buildBillText(data), data.customer.phone);
      } else if (method === "sms") {
        shareViaSms(buildBillText(data), data.customer.phone);
      } else {
        const shared = await sharePdf(buildBillHtml(data), t("share.billTitle"));
        if (!shared) Alert.alert(t("share.unavailable"));
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  if (loading || !entry || !customer) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const previousBalance = newBalance - entry.amount;

  const shareOptions: ActionSheetOption[] = [
    {
      key: "whatsapp",
      icon: "logo-whatsapp",
      iconBackgroundColor: colors.iOwe,
      iconColor: colors.onPrimary,
      label: t("share.whatsapp"),
      description: t("share.whatsappHint"),
      onPress: () => handleShare("whatsapp"),
    },
    {
      key: "sms",
      icon: "chatbubble-ellipses-outline",
      iconBackgroundColor: colors.primary,
      iconColor: colors.onPrimary,
      label: t("share.sms"),
      description: t("share.smsHint"),
      onPress: () => handleShare("sms"),
    },
    {
      key: "pdf",
      icon: "document-text",
      iconBackgroundColor: colors.owesMe,
      iconColor: colors.onPrimary,
      label: t("share.pdf"),
      description: t("share.pdfHint"),
      onPress: () => handleShare("pdf"),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.iOwe} />
        </View>
        <Text style={styles.addedText}>
          {t("entry.addedToKhata", { name: customer.name })}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryCaption} numberOfLines={1}>
              {customer.name} · {entry.entryDate}, {formatTimeOfDay(entry.createdAt)}
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.owesMe }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(entry.amount, currencySymbol)}
            </Text>
          </View>
          <View style={styles.savedPill}>
            <Text style={styles.savedPillText}>{t("entry.saved")}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.tableItemCol]}>{t("entry.tableItem")}</Text>
            <Text style={[styles.tableHeaderText, styles.tableQtyCol]}>{t("entry.tableQty")}</Text>
            <Text style={[styles.tableHeaderText, styles.tableAmountCol]}>{t("entry.tableAmount")}</Text>
          </View>
          {entry.lineItems.map((item) => {
            const swatchColor = item.color ? GARMENT_COLORS[item.color as GarmentColorLabel] : undefined;
            return (
              <View key={item.id} style={styles.lineRow}>
                <View style={[styles.lineItemInner, styles.tableItemCol]}>
                  {swatchColor ? <View style={[styles.swatch, { backgroundColor: swatchColor }]} /> : null}
                  <Text style={styles.lineDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <Text style={[styles.lineQty, styles.tableQtyCol]}>{item.quantity}</Text>
                <Text style={[styles.lineAmount, styles.tableAmountCol]} numberOfLines={1}>
                  {formatMoney(item.amount, currencySymbol)}
                </Text>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("entry.billTotalLabel")}</Text>
            <Text style={[styles.totalAmount, { color: colors.owesMe }]}>
              {formatMoney(entry.amount, currencySymbol)}
            </Text>
          </View>
        </View>

        <View style={styles.balanceBox}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceRowLabel}>{t("entry.previousBalance")}</Text>
            <Text style={[styles.balanceRowAmount, { color: colors.accent }]}>
              {formatMoney(Math.abs(previousBalance), currencySymbol)}
            </Text>
          </View>
          <View style={[styles.balanceRow, styles.newBalanceRow, { backgroundColor: colors.owesMeSoft }]}>
            <Text style={[styles.balanceRowLabel, styles.newBalanceLabel]}>{t("entry.newBalance")}</Text>
            <Text style={[styles.balanceRowAmount, styles.newBalanceLabel, { color: colors.owesMe }]}>
              {formatMoney(Math.abs(newBalance), currencySymbol)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.viewKhataButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("entry.viewKhata")}
        >
          <Text style={styles.viewKhataButtonText}>{t("entry.viewKhata")}</Text>
        </Pressable>
        <Pressable
          style={styles.shareBillButton}
          onPress={() => setShareSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t("entry.shareThisBill")}
        >
          <Ionicons name="share-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.shareBillButtonText}>{t("entry.shareThisBill")}</Text>
        </Pressable>
      </View>

      <ActionSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={t("share.billTitle")}
        options={shareOptions}
        cancelLabel={t("customerForm.cancel")}
      />
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
    closeButton: {
      paddingHorizontal: theme.spacing.sm,
    },
    content: {
      padding: theme.spacing.md,
      alignItems: "stretch",
    },
    successIconWrap: {
      alignItems: "center",
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    addedText: {
      ...theme.typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: theme.spacing.md,
    },
    summaryInfo: {
      flex: 1,
      marginEnd: theme.spacing.sm,
    },
    summaryCaption: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    summaryAmount: {
      fontSize: 30,
      fontWeight: "700",
    },
    savedPill: {
      backgroundColor: colors.iOweSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    savedPillText: {
      ...theme.typography.caption,
      color: colors.iOwe,
      fontWeight: "700",
    },
    table: {
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      marginBottom: theme.spacing.md,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    tableHeaderText: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    tableItemCol: {
      flex: 1,
    },
    tableQtyCol: {
      width: 40,
      textAlign: "center",
    },
    tableAmountCol: {
      width: 90,
      textAlign: "right",
    },
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    lineItemInner: {
      flexDirection: "row",
      alignItems: "center",
    },
    swatch: {
      width: 16,
      height: 16,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      marginEnd: theme.spacing.sm,
    },
    lineDescription: {
      ...theme.typography.body,
      color: colors.textPrimary,
      flex: 1,
    },
    lineQty: {
      ...theme.typography.body,
      color: colors.textSecondary,
    },
    lineAmount: {
      ...theme.typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: colors.surface,
    },
    totalLabel: {
      ...theme.typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    totalAmount: {
      ...theme.typography.money,
    },
    balanceBox: {
      backgroundColor: colors.background,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: theme.spacing.md,
    },
    balanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    balanceRowLabel: {
      ...theme.typography.body,
      color: colors.textSecondary,
    },
    balanceRowAmount: {
      ...theme.typography.body,
      fontWeight: "700",
    },
    newBalanceRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    newBalanceLabel: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
    actionsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    viewKhataButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    viewKhataButtonText: {
      ...theme.typography.body,
      color: colors.primary,
      fontWeight: "700",
    },
    shareBillButton: {
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBillButtonText: {
      ...theme.typography.body,
      color: colors.onPrimary,
      fontWeight: "700",
    },
  });
