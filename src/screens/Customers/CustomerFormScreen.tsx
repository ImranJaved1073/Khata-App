import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Avatar } from "../../components/Avatar";
import { db } from "../../db/client";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../../lib/money";
import { getInitials } from "../../lib/textFormat";
import type { CustomersStackParamList } from "../../navigation/types";
import {
  createCustomer,
  getCustomer,
  setCustomerArchived,
  updateCustomer,
} from "../../repositories/customerRepository";
import { getSettings } from "../../repositories/settingsRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerForm">;
type Route = RouteProp<CustomersStackParamList, "CustomerForm">;

/** Optional field: empty passes. Otherwise a loose but real check — digits (7-15 of them), optionally with a leading +, spaces, hyphens, or parentheses. */
function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[+\d][\d\s()-]*$/.test(trimmed)) return false;
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  return digitCount >= 7 && digitCount <= 15;
}

export function CustomerFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const customerId = route.params?.customerId;
  const isEdit = Boolean(customerId);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [name, setName] = useState(route.params?.initialName ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("0.00");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [currencySymbolLabel, setCurrencySymbolLabel] = useState("Rs");

  const openingBalanceAmount = parseMoneyInput(openingBalanceInput);
  const openingBalanceColor =
    openingBalanceAmount > 0
      ? colors.owesMe
      : openingBalanceAmount < 0
        ? colors.iOwe
        : colors.textPrimary;

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? t("customerForm.titleEdit") : t("customerForm.titleNew"),
    });
  }, [navigation, isEdit, t]);

  useEffect(() => {
    getSettings(db)
      .then((settings) => setCurrencySymbolLabel(settings.currencySymbol))
      .catch((error: Error) => console.error(error));
  }, []);

  useEffect(() => {
    if (!customerId) return;
    getCustomer(db, customerId)
      .then((customer) => {
        if (!customer) return;
        setName(customer.name);
        setPhone(customer.phone ?? "");
        setAddress(customer.address ?? "");
        setOpeningBalanceInput(formatMoneyInput(customer.openingBalance));
        setPhotoUri(customer.photoUri);
        setIsArchived(customer.isArchived);
      })
      .catch((error: Error) => {
        console.error(error);
        Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
      })
      .finally(() => setLoading(false));
  }, [customerId, t]);

  async function handlePickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    let hasError = false;
    if (!trimmedName) {
      setNameError(t("customerForm.nameRequired"));
      hasError = true;
    } else {
      setNameError(null);
    }
    if (!isValidPhone(phone)) {
      setPhoneError(t("customerForm.phoneInvalid"));
      hasError = true;
    } else {
      setPhoneError(null);
    }
    if (hasError) return;
    setSaving(true);

    const input = {
      name: trimmedName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      photoUri,
      openingBalance: parseMoneyInput(openingBalanceInput),
    };

    try {
      if (isEdit && customerId) {
        await updateCustomer(db, customerId, input);
      } else {
        await createCustomer(db, input);
      }
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    } finally {
      setSaving(false);
    }
  }

  function confirmArchiveToggle() {
    if (!customerId) return;
    const nextArchived = !isArchived;
    const title = nextArchived
      ? t("customerForm.archiveConfirmTitle")
      : t("customerForm.unarchiveConfirmTitle");
    const message = nextArchived
      ? t("customerForm.archiveConfirmMessage")
      : t("customerForm.unarchiveConfirmMessage");
    const confirmLabel = nextArchived ? t("customerForm.archive") : t("customerForm.unarchive");

    Alert.alert(title, message, [
      { text: t("customerForm.cancel"), style: "cancel" },
      {
        text: confirmLabel,
        style: nextArchived ? "destructive" : "default",
        onPress: async () => {
          setArchiving(true);
          try {
            await setCustomerArchived(db, customerId, nextArchived);
            navigation.goBack();
          } catch (error) {
            console.error(error);
            Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
          } finally {
            setArchiving(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={styles.photoPicker}
        onPress={handlePickPhoto}
        accessibilityRole="button"
        accessibilityLabel={t("customerForm.photo")}
      >
        <View>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <Avatar
              label={getInitials(name || "?")}
              size={112}
              backgroundColor={colors.primarySoft}
              color={colors.primary}
            />
          )}
          <View style={styles.photoBadge}>
            <Ionicons name="camera" size={16} color={colors.onPrimary} />
          </View>
        </View>
      </Pressable>

      <Field label={t("customerForm.name")} required>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(null);
          }}
          style={styles.input}
          placeholder={t("customerForm.name")}
          placeholderTextColor={colors.textSecondary}
        />
        {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
      </Field>

      <Field label={t("customerForm.phone")}>
        <View style={styles.inputRow}>
          <TextInput
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (phoneError) setPhoneError(null);
            }}
            style={[styles.input, styles.inputRowField]}
            placeholder={t("customerForm.phone")}
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
          {phone.trim().length > 0 && isValidPhone(phone) ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
              style={styles.inputRowIcon}
            />
          ) : null}
        </View>
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
      </Field>

      <Field label={t("customerForm.address")}>
        <TextInput
          value={address}
          onChangeText={setAddress}
          style={[styles.input, styles.multilineInput]}
          placeholder={t("customerForm.address")}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </Field>

      <Field label={t("customerForm.openingBalance")}>
        <View style={styles.balanceInputBox}>
          <Text style={styles.balancePrefix}>{currencySymbolLabel}</Text>
          <TextInput
            value={openingBalanceInput}
            onChangeText={setOpeningBalanceInput}
            style={[styles.balanceInput, { color: openingBalanceColor }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
          {openingBalanceAmount !== 0 ? (
            <Text style={styles.balanceSuffix}>
              {openingBalanceAmount > 0
                ? t("khata.theyOweYou")
                : t("khata.youOweThem")}
            </Text>
          ) : null}
        </View>
        <Text style={styles.balancePreview}>
          {t("customerForm.balancePreview", {
            amount: formatMoney(Math.abs(openingBalanceAmount), currencySymbolLabel),
            direction:
              openingBalanceAmount > 0
                ? t("customerForm.receivable")
                : openingBalanceAmount < 0
                  ? t("customerForm.payable")
                  : t("khata.settled"),
          })}
        </Text>
      </Field>

      <Pressable
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving || archiving}
        accessibilityRole="button"
        accessibilityLabel={t("customerForm.save")}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>{t("customerForm.save")}</Text>
        )}
      </Pressable>

      {isEdit ? (
        <Pressable
          style={styles.archiveButton}
          onPress={confirmArchiveToggle}
          disabled={saving || archiving}
          accessibilityRole="button"
          accessibilityLabel={isArchived ? t("customerForm.unarchive") : t("customerForm.archive")}
        >
          {archiving ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Ionicons name="archive-outline" size={18} color={colors.danger} />
              <Text style={styles.archiveButtonText}>
                {isArchived ? t("customerForm.unarchive") : t("customerForm.archive")}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  photoPicker: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  photo: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.pill,
  },
  photoBadge: {
    position: "absolute",
    end: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.body,
    color: colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputRowField: {
    flex: 1,
  },
  inputRowIcon: {
    position: "absolute",
    end: theme.spacing.md,
  },
  balanceInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  balancePrefix: {
    ...theme.typography.body,
    color: colors.textSecondary,
  },
  balanceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    padding: 0,
  },
  balanceSuffix: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  balancePreview: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  errorText: {
    ...theme.typography.caption,
    color: colors.danger,
    marginTop: theme.spacing.xs,
  },
  saveButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  archiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  archiveButtonText: {
    ...theme.typography.body,
    color: colors.danger,
    fontWeight: "600",
  },
});
