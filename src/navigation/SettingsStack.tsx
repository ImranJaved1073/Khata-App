import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import type { SettingsStackParamList } from "./types";

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t("settings.title") }}
      />
    </Stack.Navigator>
  );
}
