import { useCallback, useState } from "react";
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

import { db } from "../../db/client";
import { buildBillHtml, buildBillText } from "../../lib/documentFormat";
import { formatMoney } from "../../lib/money";
import { sharePdf, shareViaSms, shareViaWhatsApp } from "../../lib/share";
import type { CustomersStackParamList } from "../../navigation/types";
import { getCustomer } from "../../repositories/customerRepository";
import { getBillDocumentData } from "../../repositories/documentRepository";
import type { EntryWithLineItems } from "../../repositories/entryRepository";
import { deleteEntry, getEntry } from "../../repositories/entryRepository";
import { getSettings } from "../../repositories/settingsRepository";
import { GARMENT_COLORS, type GarmentColorLabel } from "../../theme/colors";
import { theme } from "../../theme/theme";
import type { Customer, LineItem } from "../../types/models";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "EntryDetail">;
type Route = RouteProp<CustomersStackParamList, "EntryDetail">;

export function EntryDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { entryId } = route.params;

  const [entry, setEntry] = useState<EntryWithLineItems | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [entryRow, settings] = await Promise.all([getEntry(db, entryId), getSettings(db)]);
    setEntry(entryRow);
    setCurrencySymbol(settings.currencySymbol);
    if (entryRow) {
      setCustomer(await getCustomer(db, entryRow.customerId));
    }
    setLoading(false);
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleShare() {
    if (!entry) return;
    const data = await getBillDocumentData(db, entry.id);
    if (!data) return;
    const message = buildBillText(data);
    Alert.alert(t("share.billTitle"), undefined, [
      {
        text: t("share.whatsapp"),
        onPress: () => shareViaWhatsApp(message, data.customer.phone),
      },
      { text: t("share.sms"), onPress: () => shareViaSms(message, data.customer.phone) },
      {
        text: t("share.pdf"),
        onPress: async () => {
          const shared = await sharePdf(buildBillHtml(data), t("share.billTitle"));
          if (!shared) Alert.alert(t("share.unavailable"));
        },
      },
      { text: t("customerForm.cancel"), style: "cancel" },
    ]);
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const isCashOut = entry.direction === "cash_out";
  const color = isCashOut ? theme.colors.owesMe : theme.colors.iOwe;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {customer ? <Text style={styles.customerName}>{customer.name}</Text> : null}
      <Text style={styles.date}>{entry.entryDate}</Text>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>{t("entry.share")}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate("EntryForm", {
              customerId: entry.customerId,
              mode: entry.type,
              entryId: entry.id,
            })
          }
        >
          <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>{t("entry.edit")}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate("EntryHistory", { entryId: entry.id })}
        >
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>{t("entry.history")}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={confirmDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={theme.colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          )}
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
            {t("entry.delete")}
          </Text>
        </Pressable>
      </View>

      {entry.type === "bill" ? (
        <>
          {entry.lineItems.map((item) => (
            <LineItemRow key={item.id} item={item} currencySymbol={currencySymbol} />
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("entry.total")}</Text>
            <Text style={styles.totalAmount}>{formatMoney(entry.amount, currencySymbol)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>
            {isCashOut ? t("entry.gaveOnCredit") : t("entry.receivedPayment")}
          </Text>
          <Text style={[styles.amountValue, { color }]}>
            {formatMoney(entry.amount, currencySymbol)}
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
        <Image source={{ uri: entry.attachmentUri }} style={styles.attachment} />
      ) : null}
    </ScrollView>
  );
}

function LineItemRow({
  item,
  currencySymbol,
}: {
  item: LineItem;
  currencySymbol: string;
}) {
  const swatchColor = item.color ? GARMENT_COLORS[item.color as GarmentColorLabel] : undefined;

  return (
    <View style={styles.lineRow}>
      {swatchColor ? (
        <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
      ) : null}
      <View style={styles.lineInfo}>
        <Text style={styles.lineDescription}>{item.description}</Text>
        <Text style={styles.lineSubtext}>
          {item.quantity} × {formatMoney(item.rate, currencySymbol)}
        </Text>
      </View>
      <Text style={styles.lineAmount}>{formatMoney(item.amount, currencySymbol)}</Text>
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
  customerName: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  actionButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  deleteButtonText: {
    color: theme.colors.danger,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginEnd: theme.spacing.sm,
  },
  lineInfo: {
    flex: 1,
    marginEnd: theme.spacing.sm,
  },
  lineDescription: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
  },
  lineSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  lineAmount: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  amountRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  amountLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  amountValue: {
    ...theme.typography.money,
    fontSize: 24,
  },
  noteBox: {
    marginTop: theme.spacing.md,
  },
  noteLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  noteText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
  },
  attachment: {
    width: "100%",
    height: 200,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
  },
});
