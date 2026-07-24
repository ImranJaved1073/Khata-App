import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeContext";
import { CustomersStack } from "./CustomersStack";
import { HomeStack } from "./HomeStack";
import { ReportsStack } from "./ReportsStack";
import { SettingsStack } from "./SettingsStack";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  HomeTab: "home-outline",
  CustomersTab: "people-outline",
  ReportsTab: "bar-chart-outline",
  SettingsTab: "settings-outline",
};

export function RootNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: t("nav.home") }} />
      <Tab.Screen
        name="CustomersTab"
        component={CustomersStack}
        options={{ title: t("nav.customers") }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsStack}
        options={{ title: t("nav.reports") }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{ title: t("nav.settings") }}
      />
    </Tab.Navigator>
  );
}
