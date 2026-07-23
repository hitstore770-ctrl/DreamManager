import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";

function formatClock(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DNDMode() {
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [totalMinutes, setTotalMinutes] = usePersistentState("@dreammanager/focus-minutes", 0);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    setActive(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(false);
    setTotalMinutes((prev) => prev + Math.round(elapsed / 60));
    setElapsed(0);
  };

  return (
    <View>
      <View style={[styles.card, active && styles.cardActive]}>
        <Text style={styles.moon}>{active ? "🌙" : "🔔"}</Text>
        <Text style={[styles.status, active && styles.statusActive]}>
          {active ? "מצב מיקוד פעיל" : "מצב מיקוד כבוי"}
        </Text>
        {active && <Text style={styles.timer}>{formatClock(elapsed)}</Text>}
      </View>

      <TouchableOpacity
        style={[styles.toggle, { backgroundColor: active ? "#D14343" : COLORS.accent }]}
        onPress={active ? stop : start}
        activeOpacity={0.85}
      >
        <Text style={styles.toggleText}>{active ? "סיים מיקוד" : "הפעל מצב מיקוד"}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        מצב מיקוד פנימי לאפליקציה — עוזר להישאר מרוכזים במהלך העבודה על החלומות.
      </Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalValue}>{totalMinutes}</Text>
        <Text style={styles.totalLabel}>סך דקות מיקוד</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 28,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 16,
  },
  cardActive: { backgroundColor: "rgba(59, 91, 219, 0.1)", borderColor: COLORS.accent },
  moon: { fontSize: 44, marginBottom: 8 },
  status: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.medium },
  statusActive: { color: COLORS.accent, fontFamily: FONTS.bold },
  timer: { color: COLORS.textPrimary, fontSize: 32, fontFamily: FONTS.bold, marginTop: 10 },
  toggle: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  toggleText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 14,
  },
  totalCard: {
    marginTop: 18,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  totalValue: { color: COLORS.accent, fontSize: 28, fontFamily: FONTS.bold },
  totalLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.regular, marginTop: 4 },
});
