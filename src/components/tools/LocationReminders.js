import * as Location from "expo-location";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function LocationReminders() {
  const [reminders, setReminders] = usePersistentState("@dreammanager/location-reminders", []);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const addReminder = async () => {
    if (!note.trim()) {
      alert("נא להזין תזכורת");
      return;
    }
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        alert("נדרשת הרשאת מיקום כדי לשמור תזכורת");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setReminders((prev) => [
        {
          id: Date.now().toString(),
          note: note.trim(),
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        ...prev,
      ]);
      setNote("");
    } catch {
      alert("שגיאה בקבלת המיקום הנוכחי");
    } finally {
      setBusy(false);
    }
  };

  const removeReminder = (id) => setReminders((prev) => prev.filter((r) => r.id !== id));

  return (
    <View>
      <ToolField
        label="תזכורת"
        value={note}
        onChangeText={setNote}
        placeholder="לדוגמה: לקנות חלב"
        keyboardType="default"
      />
      <ToolButton
        label={busy ? "מאתר מיקום..." : "שמור במיקום הנוכחי 📍"}
        onPress={addReminder}
        style={styles.button}
      />

      {reminders.length === 0 ? (
        <Text style={styles.empty}>אין תזכורות מיקום עדיין</Text>
      ) : (
        reminders.map((r) => (
          <View key={r.id} style={styles.row}>
            <TouchableOpacity onPress={() => removeReminder(r.id)} style={styles.delete}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.body}>
              <Text style={styles.note}>{r.note}</Text>
              <Text style={styles.coords}>
                📍 {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { marginBottom: 18 },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  delete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.bold },
  body: { flex: 1, marginHorizontal: 12 },
  note: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  coords: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.regular, textAlign: "right", marginTop: 4 },
});
