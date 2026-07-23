import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useDreams } from "../../context/DreamContext";
import { getCategory } from "../../utils/dreamCategories";
import { COLORS, FONTS } from "../../utils/theme";

// Build a flat list of matches across every dream's title, tasks and notes.
function searchDreams(dreams, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results = [];
  dreams.forEach((dream) => {
    if (dream.title.toLowerCase().includes(q)) {
      results.push({ id: `${dream.id}-title`, dream, kind: "חלום", text: dream.title });
    }
    dream.tasks.forEach((task) => {
      if (task.text.toLowerCase().includes(q)) {
        results.push({ id: `${dream.id}-t-${task.id}`, dream, kind: "משימה", text: task.text });
      }
    });
    dream.notes.forEach((note) => {
      if (note.text.toLowerCase().includes(q)) {
        results.push({ id: `${dream.id}-n-${note.id}`, dream, kind: "פתק", text: note.text });
      }
    });
  });
  return results;
}

export default function GlobalSearch() {
  const { dreams } = useDreams();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchDreams(dreams, query), [dreams, query]);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="חפשו בחלומות, משימות ופתקים..."
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />

      {query.trim().length > 0 && (
        <Text style={styles.countText}>
          {results.length > 0 ? `${results.length} תוצאות` : "לא נמצאו תוצאות"}
        </Text>
      )}

      {results.map((result) => {
        const category = getCategory(result.dream.type);
        return (
          <View key={result.id} style={styles.resultRow}>
            <View style={[styles.kindBadge, { borderColor: category.color }]}>
              <Text style={[styles.kindText, { color: category.color }]}>{result.kind}</Text>
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultText} numberOfLines={2}>
                {result.text}
              </Text>
              <Text style={styles.resultDream}>{result.dream.title}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    marginBottom: 14,
  },
  countText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  kindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginStart: 12,
  },
  kindText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  resultBody: {
    flex: 1,
  },
  resultText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.medium,
    textAlign: "right",
  },
  resultDream: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 4,
  },
});
