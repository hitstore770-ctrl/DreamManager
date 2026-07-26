import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { habitStreak, weekDays } from "../../context/DreamContext";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// "Don't break the chain" — the current week as seven tappable dots. Marking
// a day pops it briefly so the tap feels physical.

const GOLD = "#D4AF37";
const WHITE = "#FFFFFF";
const CARD = "#F0F2F5";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";

function Day({ day, done, onPress }) {
  const scale = useSharedValue(1);

  // Pop only when a day becomes done — un-marking shouldn't celebrate.
  useEffect(() => {
    if (done) {
      scale.value = withSequence(
        withTiming(1.28, { duration: 130 }),
        withSpring(1, { damping: 9, stiffness: 220 })
      );
    }
  }, [done]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={s.dayCol}>
      <Text style={[s.dayLetter, day.isToday && { color: INK, fontFamily: FONTS.bold }]}>
        {day.letter}
      </Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} disabled={day.isFuture}>
        <Animated.View
          style={[
            s.dot,
            done && s.dotDone,
            day.isToday && !done && s.dotToday,
            day.isFuture && { opacity: 0.35 },
            animated,
          ]}
        >
          <Text style={[s.dotText, done && { color: "#3A2E08" }]}>
            {done ? "✓" : day.date.getDate()}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

export default function HabitChain({ habitDays = {}, onToggle }) {
  const days = weekDays();
  const streak = habitStreak(habitDays);
  const doneThisWeek = days.filter((d) => habitDays[d.key]).length;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.streak}>
          {streak > 0 ? `🔥 ${streak} ${streak === 1 ? "יום" : "ימים"} ברצף` : "מתחילים שרשרת חדשה"}
        </Text>
        <Text style={s.headLabel}>{doneThisWeek}/7 השבוע</Text>
      </View>
      <View style={s.row}>
        {days.map((day) => (
          <Day key={day.key} day={day} done={!!habitDays[day.key]} onPress={() => onToggle(day.key)} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: CARD, borderRadius: 16, padding: 12, marginBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  streak: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD },
  headLabel: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED },
  row: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 5 },
  dayLetter: { fontFamily: FONTS.medium, fontSize: 11, color: INK_MUTED },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: GOLD },
  dotToday: { borderWidth: 2, borderColor: GOLD },
  dotText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
});
