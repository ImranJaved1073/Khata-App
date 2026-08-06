import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
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
import type { DocumentReceiptImageCaptureHandle } from "../../components/DocumentReceiptImageCapture";
import { DocumentReceiptImageCapture } from "../../components/DocumentReceiptImageCapture";
import { db } from "../../db/client";
import { buildBillHtml, buildBillText } from "../../lib/documentFormat";
import { formatMoney } from "../../lib/money";
import { shareImage, shareImageToWhatsApp, sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import type { CustomersStackParamList } from "../../navigation/types";
import { getCustomer } from "../../repositories/customerRepository";
import { getBillDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { deleteEntry, getEntry } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import { GARMENT_COLORS, type AppColors, type GarmentColorLabel } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";
import type { Customer, LineItem } from "../../types/models";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "EntryDetail">;
type Route = RouteProp<CustomersStackParamList, "EntryDetail">;

export function EntryDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { entryId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [entry, setEntry] = useState<EntryWithLineItems | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const imageCaptureRef = useRef<DocumentReceiptImageCaptureHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryRow, settings] = await Promise.all([getEntry(db, entryId), getSettings(db)]);
      setEntry(entryRow);
      setCurrencySymbol(settings.currencySymbol);
      if (entryRow) {
        setCustomer(await getCustomer(db, entryRow.customerId));
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
    if (!entry) return;
    navigation.setOptions({
      title: entry.type === "bill" ? t("entry.billDetailTitle") : t("entry.simpleDetailTitle"),
    });
  }, [navigation, entry, t]);

  async function handleShare(method: "whatsapp" | "sms" | "pdf") {
    if (!entry) return;
    try {
      const data = await getBillDocumentData(db, entry.id);
      if (!data) return;
      if (method === "whatsapp") {
        const uri = await imageCaptureRef.current?.captureBill(data);
        if (!uri) {
          Alert.alert(t("share.unavailable"));
          return;
        }
        const sentDirectly = await shareImageToWhatsApp(uri, data.customer.phone, buildBillText(data));
        if (!sentDirectly) {
          const shared = await shareImage(uri, t("share.billTitle"));
          if (!shared) {
            Alert.alert(t("share.unavailable"));
            return;
          }
          await shareViaWhatsApp(buildBillText(data), data.customer.phone);
        }
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

  function confirmDelete() {
    if (!entry) return;
    Alert.alert(t("entry.deleteConfirmTitle"), t("entry.deleteConfirmMessage"), [
      { text: t("customerForm.cancel"), style: "cancel" },
      {
        text: t("entry.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry(db, entry.id);
            navigation.goBack();
          } catch (error) {
            console.error(error);
            Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading || !entry) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isCashOut = entry.direction === "cash_out";
  const color = isCashOut ? colors.owesMe : colors.iOwe;
  const softColor = isCashOut ? colors.owesMeSoft : colors.iOweSoft;

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
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          {customer ? (
            <Text style={styles.customerLine} numberOfLines={1}>
              {customer.name} · {entry.entryDate}
            </Text>
          ) : null}
          <Text style={[styles.amount, { color }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(entry.amount, currencySymbol)}
          </Text>
        </View>
        <View style={[styles.balancePill, { backgroundColor: softColor }]}>
          <Text style={[styles.balancePillText, { color }]}>
            {isCashOut ? t("entry.detailOwesYou") : t("entry.detailYouPaid")}
          </Text>
        </View>
      </View>

      {entry.type === "bill" ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.tableItemCol]}>
              {t("entry.tableItem")}
            </Text>
            <Text style={[styles.tableHeaderText, styles.tableQtyCol]}>
              {t("entry.tableQty")}
            </Text>
            <Text style={[styles.tableHeaderText, styles.tableAmountCol]}>
              {t("entry.tableAmount")}
            </Text>
          </View>
          {entry.lineItems.map((item) => (
            <LineItemRow key={item.id} item={item} currencySymbol={currencySymbol} />
          ))}
        </View>
      ) : (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            {isCashOut ? t("entry.gaveOnCredit") : t("entry.receivedPayment")}
          </Text>
        </View>
      )}

      {entry.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>{t("entry.note")}</Text>
          <Text style={styles.noteText}>{entry.note}</Text>
        </View>
      ) : null}

      {entry.attachmentUri ? (
        <View style={styles.attachmentRow}>
          <Image source={{ uri: entry.attachmentUri }} style={styles.attachment} />
          <View style={styles.attachmentInfo}>
            <Text style={styles.attachmentTitle}>{t("entry.attachedReceipt")}</Text>
            <Text style={styles.attachmentHint}>{t("entry.tapToView")}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>

    <View style={styles.actionsRow}>
        <ActionButton
          icon="share-outline"
          label={t("entry.share")}
          onPress={() => setShareSheetVisible(true)}
        />
        <ActionButton
          icon="pencil-outline"
          label={t("entry.edit")}
          onPress={() =>
            navigation.navigate("EntryForm", {
              customerId: entry.customerId,
              mode: entry.type,
              entryId: entry.id,
            })
          }
        />
        <ActionButton
          icon="time-outline"
          label={t("entry.history")}
          onPress={() => navigation.navigate("EntryHistory", { entryId: entry.id })}
        />
        <ActionButton
          icon="trash-outline"
          label={t("entry.delete")}
          onPress={confirmDelete}
          busy={deleting}
          danger
        />
      </View>

      <ActionSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={t("share.billTitle")}
        options={shareOptions}
        cancelLabel={t("customerForm.cancel")}
      />
      <DocumentReceiptImageCapture ref={imageCaptureRef} />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  busy,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.actionButton, danger && styles.actionButtonDanger]}
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.danger} />
      ) : (
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      )}
      <Text style={[styles.actionButtonText, danger && styles.actionButtonTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LineItemRow({
  item,
  currencySymbol,
}: {
  item: LineItem;
  currencySymbol: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const swatchColor = item.color ? GARMENT_COLORS[item.color as GarmentColorLabel] : undefined;

  return (
    <View style={styles.lineRow}>
      <View style={styles.tableItemCol}>
        <View style={styles.lineItemInner}>
          {swatchColor ? (
            <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
          ) : null}
          <View style={styles.lineInfo}>
            <Text style={styles.lineDescription}>{item.description}</Text>
            <Text style={styles.lineSubtext}>
              {item.quantity} × {formatMoney(item.rate, currencySymbol)}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.lineQty, styles.tableQtyCol]}>{item.quantity}</Text>
      <Text style={[styles.lineAmount, styles.tableAmountCol]} numberOfLines={1}>
        {formatMoney(item.amount, currencySymbol)}
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
  content: {
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  customerLine: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  amount: {
    fontSize: 30,
    fontWeight: "700",
  },
  balancePill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  balancePillText: {
    ...theme.typography.caption,
    fontWeight: "700",
  },
  table: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginEnd: theme.spacing.sm,
  },
  lineInfo: {
    flex: 1,
  },
  lineDescription: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  lineSubtext: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
  noteBox: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  noteLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: theme.spacing.xs,
  },
  noteText: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  attachment: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surface,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentTitle: {
    ...theme.typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  attachmentHint: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    minWidth: "22%",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonDanger: {
    borderColor: colors.danger,
  },
  actionButtonText: {
    ...theme.typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  actionButtonTextDanger: {
    color: colors.danger,
  },
});
