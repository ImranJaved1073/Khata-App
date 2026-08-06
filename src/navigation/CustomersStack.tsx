import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { CustomerFormScreen } from "../screens/Customers/CustomerFormScreen";
import { CustomerKhataScreen } from "../screens/Customers/CustomerKhataScreen";
import { CustomerListScreen } from "../screens/Customers/CustomerListScreen";
import { AddItemsScreen } from "../screens/Entries/AddItemsScreen";
import { BillSavedScreen } from "../screens/Entries/BillSavedScreen";
import { EntryDetailScreen } from "../screens/Entries/EntryDetailScreen";
import { EntryFormScreen } from "../screens/Entries/EntryFormScreen";
import { EntryHistoryScreen } from "../screens/Entries/EntryHistoryScreen";
import type { CustomersStackParamList } from "./types";

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export function CustomersStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={{ title: t("customerForm.titleNew") }}
      />
      <Stack.Screen
        name="CustomerKhata"
        component={CustomerKhataScreen}
        options={{ title: t("app.name") }}
      />
      <Stack.Screen
        name="EntryForm"
        component={EntryFormScreen}
        options={{ title: t("khata.newEntry") }}
      />
      <Stack.Screen
        name="AddItems"
        component={AddItemsScreen}
        options={{ title: t("entry.addItems") }}
      />
      <Stack.Screen
        name="BillSaved"
        component={BillSavedScreen}
        options={{ title: t("entry.billSavedTitle"), gestureEnabled: false }}
      />
      <Stack.Screen
        name="EntryDetail"
        component={EntryDetailScreen}
        options={{ title: t("entry.detailTitle") }}
      />
      <Stack.Screen
        name="EntryHistory"
        component={EntryHistoryScreen}
        options={{ title: t("entry.history") }}
      />
    </Stack.Navigator>
  );
}
