import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { ReportsScreen } from "../screens/Reports/ReportsScreen";
import type { ReportsStackParamList } from "./types";

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: t("reports.title") }}
      />
    </Stack.Navigator>
  );
}
