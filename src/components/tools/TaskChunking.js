import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function TaskChunking() {
  const [session, setSession] = usePersistentState("@dreammanager/chunking", null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("");

  const createChunks = () => {
    const n = Number(count);
    if (!title.trim()) {
      alert("נא להזין שם למשימה");
      return;
    }
    if (!count || Number.isNaN(n) || n < 2 || n > 20) {
      alert("נא להזין מספר חלקים בין 2 ל-20");
      return;
    }
    const chunks = Array.from({ length: n }, (_, i) => ({
      id: `${i}`,
      label: `חלק ${i + 1} מתוך ${n}`,
      done: false,
    }));
    setSession({ title: title.trim(), chunks });
    setTitle("");
    setCount("");
  };

  const toggleChunk = (id) => {
    setSession((prev) => ({
      ...prev,
      chunks: prev.chunks.map((c) => (c.id === id ? { ...c, done: !c.done } : c)),
    }));
  };

  const clearSession = () => setSession(null);

  if (!session) {
    return (
      <View>
        <Text style={styles.hint}>פצלו משימה גדולה לחלקים קטנים וברי-ביצוע.</Text>
        <ToolField
          label="שם המשימה"
          value={title}
          onChangeText={setTitle}
          placeholder="לדוגמה: לכתוב עבודת גמר"
          keyboardType="default"
        />
        <ToolField label="למספר חלקים" value={count} onChangeText={setCount} placeholder="לדוגמה: 5" />
        <ToolButton label="פצל למשימות" onPress={createChunks} style={styles.button} />
      </View>
    );
  }

  const done = session.chunks.filter((c) => c.done).length;
  const percent = Math.round((done / session.chunks.length) * 100);

  return (
    <View>
      <Text style={styles.title}>{session.title}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {done}/{session.chunks.length} · {percent}%
      </Text>

      {session.chunks.map((chunk) => (
        <TouchableOpacity
          key={chunk.id}
          style={styles.chunkRow}
          onPress={() => toggleChunk(chunk.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, chunk.done && styles.checkboxDone]}>
            {chunk.done && <Text style={styles.check}>✓</Text>}
          </View>
          <Text style={[styles.chunkText, chunk.done && styles.chunkTextDone]}>{chunk.label}</Text>
        </TouchableOpacity>
      ))}

      <ToolButton label="משימה חדשה" onPress={clearSession} color={COLORS.textMuted} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.regular, textAlign: "right", marginBottom: 14 },
  button: { marginTop: 6 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(45, 42, 50, 0.08)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: COLORS.accent },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 14,
  },
  chunkRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.accent,
    marginEnd: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: COLORS.accent },
  check: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  chunkText: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.regular, textAlign: "right" },
  chunkTextDone: { color: COLORS.textMuted, textDecorationLine: "line-through" },
});
