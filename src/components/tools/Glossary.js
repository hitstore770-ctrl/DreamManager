import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolField } from "./ToolKit";

export default function Glossary() {
  const [terms, setTerms] = usePersistentState("@dreammanager/glossary", []);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [query, setQuery] = useState("");

  const addTerm = () => {
    if (!term.trim() || !definition.trim()) {
      alert("נא להזין מונח והגדרה");
      return;
    }
    setTerms((prev) => [{ id: Date.now().toString(), term: term.trim(), definition: definition.trim() }, ...prev]);
    setTerm("");
    setDefinition("");
  };

  const removeTerm = (id) => setTerms((prev) => prev.filter((t) => t.id !== id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    );
  }, [terms, query]);

  return (
    <View>
      <ToolField label="מונח" value={term} onChangeText={setTerm} placeholder="לדוגמה: API" keyboardType="default" />
      <ToolField
        label="הגדרה"
        value={definition}
        onChangeText={setDefinition}
        placeholder="ממשק תכנות יישומים..."
        keyboardType="default"
      />
      <ToolButton label="הוסף למילון" onPress={addTerm} style={styles.addButton} />

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="חיפוש במילון..."
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />

      {filtered.length === 0 ? (
        <Text style={styles.empty}>{terms.length === 0 ? "המילון ריק" : "לא נמצאו תוצאות"}</Text>
      ) : (
        filtered.map((t) => (
          <View key={t.id} style={styles.card}>
            <TouchableOpacity onPress={() => removeTerm(t.id)} style={styles.delete}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.cardBody}>
              <Text style={styles.term}>{t.term}</Text>
              <Text style={styles.definition}>{t.definition}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: { marginBottom: 16 },
  search: {
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 14,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  cardBody: { flex: 1, marginHorizontal: 12 },
  term: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right" },
  definition: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 4,
    lineHeight: 20,
  },
});
