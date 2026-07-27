import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import type { SettingsStackParamList } from "./types";

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
