import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS, getNoteColor } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

// Last 7 days, oldest → newest.
function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), weekday: WEEKDAYS[d.getDay()] });
  }
  return days;
}

export default function HabitGrid() {
  const [habits, setHabits] = usePersistentState("@dreammanager/habits", []);
  const [name, setName] = useState("");
  const days = last7Days();

  const addHabit = () => {
    if (!name.trim()) {
      alert("נא להזין שם להרגל");
      return;
    }
    setHabits((prev) => [...prev, { id: Date.now().toString(), name: name.trim(), done: {} }]);
    setName("");
  };

  const toggleDay = (habitId, dayKey) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId ? { ...h, done: { ...h.done, [dayKey]: !h.done[dayKey] } } : h
      )
    );
  };

  const removeHabit = (id) => setHabits((prev) => prev.filter((h) => h.id !== id));

  return (
    <View>
      <View style={styles.formRow}>
        <View style={styles.formField}>
          <ToolField
            label="הרגל חדש"
            value={name}
            onChangeText={setName}
            placeholder="לדוגמה: שתיית מים"
            keyboardType="default"
          />
        </View>
      </View>
      <ToolButton label="הוסף הרגל" onPress={addHabit} style={styles.addButton} />

      {habits.length === 0 ? (
        <Text style={styles.empty}>עדיין לא נוספו הרגלים</Text>
      ) : (
        habits.map((habit) => {
          const streak = days.filter((d) => habit.done[d.key]).length;
          return (
            <View key={habit.id} style={[styles.habitCard, { backgroundColor: getNoteColor(habit.id) }]}>
              <View style={styles.habitHeader}>
                <TouchableOpacity onPress={() => removeHabit(habit.id)} style={styles.delete}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.habitName}>{habit.name}</Text>
                <Text style={styles.streak}>🔥 {streak}/7</Text>
              </View>
              <View style={styles.daysRow}>
                {days.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    style={styles.dayCol}
                    onPress={() => toggleDay(habit.id, d.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dayLabel}>{d.weekday}</Text>
                    <View style={[styles.dayCell, habit.done[d.key] && styles.dayCellDone]}>
                      {habit.done[d.key] && <Text style={styles.dayCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: { flexDirection: "row" },
  formField: { flex: 1 },
  addButton: { marginTop: 2, marginBottom: 18 },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  habitCard: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  habitHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  delete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.bold },
  habitName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right", marginHorizontal: 10 },
  streak: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.medium },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", flex: 1 },
  dayLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.regular, marginBottom: 4 },
  dayCell: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellDone: { backgroundColor: "#1E9E58", borderColor: "#1E9E58" },
  dayCheck: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
});
