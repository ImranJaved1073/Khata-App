import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { HomeScreen } from "../screens/Home/HomeScreen";
import type { HomeStackParamList } from "./types";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ title: t("home.title") }}
      />
    </Stack.Navigator>
  );
}
