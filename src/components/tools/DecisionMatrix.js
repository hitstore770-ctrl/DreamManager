import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function DecisionMatrix() {
  const [options, setOptions] = usePersistentState("@dreammanager/decision", []);
  const [name, setName] = useState("");

  const addOption = () => {
    if (!name.trim()) {
      alert("נא להזין שם לחלופה");
      return;
    }
    setOptions((prev) => [...prev, { id: Date.now().toString(), name: name.trim(), score: 0 }]);
    setName("");
  };

  const adjust = (id, delta) => {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, score: Math.max(0, Math.min(10, o.score + delta)) } : o
      )
    );
  };

  const removeOption = (id) => setOptions((prev) => prev.filter((o) => o.id !== id));

  // Rank by score; the top scorer (if it has any points and is a clear or tied
  // leader) is the recommendation.
  const ranked = [...options].sort((a, b) => b.score - a.score);
  const topScore = ranked.length ? ranked[0].score : 0;

  return (
    <View>
      <ToolField
        label="חלופה"
        value={name}
        onChangeText={setName}
        placeholder="לדוגמה: דגם A"
        keyboardType="default"
      />
      <ToolButton label="הוסף חלופה" onPress={addOption} style={styles.addButton} />

      {options.length === 0 ? (
        <Text style={styles.empty}>הוסיפו חלופות ודרגו אותן</Text>
      ) : (
        ranked.map((option) => {
          const isBest = topScore > 0 && option.score === topScore;
          return (
            <View key={option.id} style={[styles.card, isBest && styles.cardBest]}>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => adjust(option.id, -1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.score}>{option.score}</Text>
                <TouchableOpacity onPress={() => adjust(option.id, 1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{option.name}</Text>
                {isBest && <Text style={styles.badge}>✓ הבחירה המומלצת</Text>}
              </View>
              <TouchableOpacity onPress={() => removeOption(option.id)} style={styles.delete}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: { marginBottom: 18 },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  cardBest: { backgroundColor: "rgba(30, 158, 88, 0.12)", borderColor: "#1E9E58" },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold, marginTop: -2 },
  score: {
    width: 34,
    textAlign: "center",
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  info: { flex: 1, marginHorizontal: 10 },
  name: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  badge: { color: "#1E9E58", fontSize: 12, fontFamily: FONTS.bold, textAlign: "right", marginTop: 2 },
  delete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.bold },
});
