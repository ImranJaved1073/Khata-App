import { useMemo, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import type { AppColors } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import { theme } from "../theme/theme";

const BUBBLE_WIDTH = 260;

/**
 * A small "i" icon that reveals an anchored info bubble on tap, instead of a caption permanently
 * printed under every field heading. Anchors itself under the icon (measured in the window, since
 * a plain absolutely-positioned child would get clipped by any ancestor `ScrollView`) and dismisses
 * on a second tap of the icon or a tap anywhere else on screen.
 */
export function InfoTooltip({ text }: { text: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const anchorRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function open() {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const left = Math.min(
        Math.max(theme.spacing.md, x),
        screenWidth - BUBBLE_WIDTH - theme.spacing.md,
      );
      setPosition({ top: y + height + theme.spacing.xs, left });
      setVisible(true);
    });
  }

  return (
    <>
      <Pressable
        ref={anchorRef}
        onPress={open}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.moreInfo")}
        accessibilityHint={text}
      >
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        {position ? (
          <View style={[styles.bubble, { top: position.top, left: position.left }]}>
            <Text style={styles.bubbleText}>{text}</Text>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
    },
    bubble: {
      position: "absolute",
      width: BUBBLE_WIDTH,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    bubbleText: {
      ...theme.typography.caption,
      color: colors.textPrimary,
    },
  });
