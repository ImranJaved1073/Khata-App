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

import { db } from "../../db/client";
import { formatMoneyInput, parseMoneyInput } from "../../lib/money";
import type { CustomersStackParamList } from "../../navigation/types";
import {
  createCustomer,
  getCustomer,
  setCustomerArchived,
  updateCustomer,
} from "../../repositories/customerRepository";
import type { AppColors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { theme } from "../../theme/theme";

type Navigation = NativeStackNavigationProp<CustomersStackParamList, "CustomerForm">;
type Route = RouteProp<CustomersStackParamList, "CustomerForm">;

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("0.00");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? t("customerForm.titleEdit") : t("customerForm.titleNew"),
    });
  }, [navigation, isEdit, t]);

  useEffect(() => {
    if (!customerId) return;
    getCustomer(db, customerId).then((customer) => {
      if (!customer) return;
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setAddress(customer.address ?? "");
      setOpeningBalanceInput(formatMoneyInput(customer.openingBalance));
      setPhotoUri(customer.photoUri);
      setLoading(false);
    });
  }, [customerId]);

  async function handlePickPhoto() {
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
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t("customerForm.nameRequired"));
      return;
    }
    setNameError(null);
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
    } finally {
      setSaving(false);
    }
  }

  function confirmArchive() {
    if (!customerId) return;
    Alert.alert(
      t("customerForm.archiveConfirmTitle"),
      t("customerForm.archiveConfirmMessage"),
      [
        { text: t("customerForm.cancel"), style: "cancel" },
        {
          text: t("customerForm.archive"),
          style: "destructive",
          onPress: async () => {
            setArchiving(true);
            try {
              await setCustomerArchived(db, customerId, true);
              navigation.goBack();
            } finally {
              setArchiving(false);
            }
          },
        },
      ],
    );
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
      <Pressable style={styles.photoPicker} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={28} color={colors.textSecondary} />
          </View>
        )}
        <Text style={styles.photoLabel}>{t("customerForm.photo")}</Text>
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
        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          placeholder={t("customerForm.phone")}
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />
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
        <TextInput
          value={openingBalanceInput}
          onChangeText={setOpeningBalanceInput}
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
        />
      </Field>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={saving || archiving}
        >
          <Text style={styles.cancelButtonText}>{t("customerForm.cancel")}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={saving || archiving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>{t("customerForm.save")}</Text>
          )}
        </Pressable>
      </View>

      {isEdit ? (
        <Pressable
          style={styles.archiveButton}
          onPress={confirmArchive}
          disabled={saving || archiving}
        >
          {archiving ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.archiveButtonText}>{t("customerForm.archive")}</Text>
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
    width: 88,
    height: 88,
    borderRadius: theme.radius.pill,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginTop: theme.spacing.xs,
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
    backgroundColor: colors.surface,
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
  errorText: {
    ...theme.typography.caption,
    color: colors.danger,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    ...theme.typography.body,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  archiveButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveButtonText: {
    ...theme.typography.body,
    color: colors.danger,
  },
});
