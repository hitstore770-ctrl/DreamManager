import { useEffect } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import Icon from "../Icon";
import { hapticSuccess } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// Celebration for a completed dream. No confetti library (they're heavy and
// unreliable in the web preview) — instead a gold screen flash, a scaling
// trophy, and a staggered burst of success haptics that reads as a drumroll.

const GOLD = "#06B6D4";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const BLUE = "#7C3AED";
const WHITE = "#FFFFFF";

// Fixed ring of icons around the trophy — cheap stand-in for confetti.
const SPARKS = [
  { icon: "sparkles-outline", top: "16%", left: "12%", size: 30, color: GOLD },
  { icon: "star", top: "22%", right: "10%", size: 34, color: BLUE },
  { icon: "award", top: "62%", left: "16%", size: 26, color: BLUE },
  { icon: "sparkles-outline", top: "70%", right: "18%", size: 28, color: GOLD },
  { icon: "star", top: "40%", left: "6%", size: 22, color: GOLD },
  { icon: "diamond-outline", top: "34%", right: "5%", size: 26, color: BLUE },
];

export default function Celebration({ visible, dream, onArchive, onClose }) {
  // Staggered success haptics — three pulses feel like a celebration where a
  // single buzz reads as a plain confirmation.
  useEffect(() => {
    if (!visible) return undefined;
    const timers = [0, 180, 380, 620].map((delay) => setTimeout(hapticSuccess, delay));
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut} style={s.flash}>
        {SPARKS.map((sp, i) => (
          <Animated.View
            key={i}
            entering={ZoomIn.delay(120 + i * 90).duration(380)}
            style={[s.spark, { top: sp.top, left: sp.left, right: sp.right }]}
          >
            <Icon name={sp.icon} size={sp.size} color={sp.color} />
          </Animated.View>
        ))}

        <Animated.View entering={ZoomIn.duration(420)} style={s.card}>
          <Icon name="award" size={54} color={GOLD} style={s.trophy} />
          <Text style={s.title}>הגשמת את החלום!</Text>
          <Text style={s.dreamTitle} numberOfLines={2}>{dream?.title}</Text>
          <Text style={s.sub}>כל אבני הדרך הושלמו — מגיע לך</Text>

          <TouchableOpacity style={s.archiveBtn} onPress={onArchive} activeOpacity={0.85}>
            <View style={s.btnFace}><Icon name="archive" size={15} color={WHITE} /><Text style={s.archiveBtnText}>העבר להיכל ההישגים</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={s.keepBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.keepBtnText}>השאר על הלוח</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flash: {
    flex: 1,
    backgroundColor: "rgba(212,175,55,0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  spark: { position: "absolute" },
  card: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 30,
    padding: 26,
    alignItems: "center",
    borderWidth: 2,
    borderColor: GOLD,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  trophy: { marginBottom: 8 },
  btnFace: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: GOLD, textAlign: "center" },
  dreamTitle: { fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "center", marginTop: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 13, color: INK_SOFT, textAlign: "center", marginTop: 6, marginBottom: 20 },
  archiveBtn: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: "#3A2E08" },
  keepBtn: { alignSelf: "stretch", minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 6 },
  keepBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: INK_SOFT },
});
