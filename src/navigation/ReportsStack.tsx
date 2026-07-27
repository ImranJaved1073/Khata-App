import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ReportsScreen } from "../screens/Reports/ReportsScreen";
import type { ReportsStackParamList } from "./types";

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
