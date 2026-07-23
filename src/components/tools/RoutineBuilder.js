import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function RoutineBuilder() {
  const [steps, setSteps] = usePersistentState("@dreammanager/routine", []);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");

  const addStep = () => {
    if (!title.trim()) {
      alert("נא להזין שם לשלב בשגרה");
      return;
    }
    setSteps((prev) => [...prev, { id: Date.now().toString(), time: time.trim(), title: title.trim() }]);
    setTime("");
    setTitle("");
  };

  const removeStep = (id) => setSteps((prev) => prev.filter((s) => s.id !== id));

  return (
    <View>
      <View style={styles.formRow}>
        <View style={styles.timeCol}>
          <ToolField label="שעה" value={time} onChangeText={setTime} placeholder="07:00" keyboardType="default" />
        </View>
        <View style={styles.titleCol}>
          <ToolField
            label="שלב"
            value={title}
            onChangeText={setTitle}
            placeholder="לדוגמה: מדיטציה"
            keyboardType="default"
          />
        </View>
      </View>
      <ToolButton label="הוסף שלב לשגרה" onPress={addStep} style={styles.addButton} />

      {steps.length === 0 ? (
        <Text style={styles.empty}>עדיין לא נבנתה שגרה</Text>
      ) : (
        steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <TouchableOpacity onPress={() => removeStep(step.id)} style={styles.delete}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              {step.time ? <Text style={styles.stepTime}>{step.time}</Text> : null}
            </View>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>{index + 1}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: { flexDirection: "row", gap: 12 },
  timeCol: { width: 90 },
  titleCol: { flex: 1 },
  addButton: { marginTop: 2, marginBottom: 18 },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  stepRow: {
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(45, 42, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.bold },
  stepBody: { flex: 1, marginHorizontal: 12 },
  stepTitle: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  stepTime: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.regular, textAlign: "right", marginTop: 2 },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
});
