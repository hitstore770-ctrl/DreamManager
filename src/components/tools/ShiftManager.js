import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function ShiftManager() {
  const [shifts, setShifts] = useState([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.shifts);
        const parsed = stored ? JSON.parse(stored) : [];
        setShifts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setShifts([]);
      }
    })();
  }, []);

  const persist = (next) => {
    setShifts(next);
    AsyncStorage.setItem(STORAGE_KEYS.shifts, JSON.stringify(next)).catch(() => {});
  };

  const addShift = () => {
    if (!title.trim()) {
      alert("נא להזין תפקיד או כותרת למשמרת");
      return;
    }
    const newShift = {
      id: Date.now().toString(),
      title: title.trim(),
      start: start.trim(),
      end: end.trim(),
    };
    persist([newShift, ...shifts]);
    setTitle("");
    setStart("");
    setEnd("");
  };

  const removeShift = (id) => {
    persist(shifts.filter((shift) => shift.id !== id));
  };

  return (
    <View>
      <ToolField
        label="תפקיד / כותרת"
        value={title}
        onChangeText={setTitle}
        placeholder="לדוגמה: משמרת בוקר בקפה"
        keyboardType="default"
      />
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <ToolField
            label="שעת התחלה"
            value={start}
            onChangeText={setStart}
            placeholder="08:00"
            keyboardType="default"
          />
        </View>
        <View style={styles.timeField}>
          <ToolField
            label="שעת סיום"
            value={end}
            onChangeText={setEnd}
            placeholder="16:00"
            keyboardType="default"
          />
        </View>
      </View>

      <ToolButton label="הוסף משמרת" onPress={addShift} style={styles.addButton} />

      {shifts.length === 0 ? (
        <Text style={styles.emptyText}>עדיין לא נרשמו משמרות</Text>
      ) : (
        shifts.map((shift) => (
          <View key={shift.id} style={styles.shiftRow}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removeShift(shift.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.shiftInfo}>
              <Text style={styles.shiftTitle}>{shift.title}</Text>
              {(shift.start || shift.end) && (
                <Text style={styles.shiftTime}>
                  {shift.start || "—"} - {shift.end || "—"}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  addButton: {
    marginTop: 4,
    marginBottom: 18,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  shiftInfo: {
    flex: 1,
    marginStart: 12,
  },
  shiftTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  shiftTime: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 4,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(17, 24, 39, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
