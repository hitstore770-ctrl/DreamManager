import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RADIUS, useTheme } from "../theme/ThemeContext";
import { t } from "../i18n/strings";
import { isRTL } from "../lib/rtl";

const OPTIONS = [
  { key: "note", icon: "file-text", label: t("newNote") },
  { key: "drawing", icon: "edit-3", label: t("newDrawing") },
  { key: "template", icon: "layout", label: t("fromTemplate") },
];

const MINI_SPACING = 62;

// The list's "new note" button as a proper Smart FAB: tapping it pops out
// mini-options instead of instantly creating a blank note. A single shared
// Animated value drives everything (main-icon rotation, each option's
// slide/scale/fade) -- each option travels a different distance, which
// alone reads as a staggered cascade without needing per-item delays.
export default function ExpandableFab({ bottom, onPick }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const setExpandedAnimated = (next) => {
    setExpanded(next);
    Animated.spring(anim, { toValue: next ? 1 : 0, useNativeDriver: true, bounciness: 6, speed: 16 }).start();
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedAnimated(!expanded);
  };

  const pick = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedAnimated(false);
    onPick(key);
  };

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const s = styles(theme);

  return (
    <>
      {expanded && <Pressable testID="fab-backdrop" style={StyleSheet.absoluteFill} onPress={toggle} />}
      <View style={[s.wrap, { bottom }]} pointerEvents="box-none">
        {OPTIONS.map((opt, i) => {
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(MINI_SPACING * (i + 1))] });
          const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
          return (
            <Animated.View
              key={opt.key}
              pointerEvents={expanded ? "auto" : "none"}
              style={[s.miniRow, { opacity, transform: [{ translateY }, { scale: anim }] }]}
            >
              <View style={s.miniLabel}>
                <AppText style={s.miniLabelText}>{opt.label}</AppText>
              </View>
              <TouchableOpacity testID={`fab-${opt.key}`} style={s.miniBtn} onPress={() => pick(opt.key)} activeOpacity={0.85}>
                <Feather name={opt.icon} size={18} color={theme.accent} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity testID="new-note-fab" style={s.fab} onPress={toggle} activeOpacity={0.88}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Feather name="plus" size={26} color={theme.onAccent} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = (t) =>
  StyleSheet.create({
    wrap: { position: "absolute", [isRTL() ? "left" : "right"]: 20, alignItems: "flex-end" },
    fab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    miniRow: {
      position: "absolute",
      [isRTL() ? "left" : "right"]: 7,
      bottom: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    miniLabel: { backgroundColor: t.surface, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, ...t.cardShadow },
    miniLabelText: { fontSize: 12.5, fontWeight: "600", color: t.text },
    miniBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.surface,
      alignItems: "center",
      justifyContent: "center",
      ...t.cardShadow,
    },
  });
