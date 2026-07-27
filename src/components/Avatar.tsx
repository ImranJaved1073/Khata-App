import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme/theme";

/** Circle or rounded-square initials avatar — business identity (Home/Settings) uses square+navy/gold, customer identity (Customer list/khata header/edit form) uses circle+soft-blue/navy. */
export function Avatar({
  label,
  size = 44,
  backgroundColor,
  color,
  shape = "circle",
}: {
  label: string;
  size?: number;
  backgroundColor: string;
  color: string;
  shape?: "circle" | "square";
}) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : theme.radius.md,
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[styles.label, { color, fontSize: size * 0.4 }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "700",
  },
});
