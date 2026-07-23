import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { formatNumber } from "../../utils/format";
import { COLORS, FONTS } from "../../utils/theme";

export default function WordCharCounter() {
  const [text, setText] = useState("");

  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;

  return (
    <View>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="הדביקו או הקלידו טקסט כאן..."
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
        multiline
      />

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(words, 0)}</Text>
          <Text style={styles.statLabel}>מילים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(chars, 0)}</Text>
          <Text style={styles.statLabel}>תווים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(charsNoSpaces, 0)}</Text>
          <Text style={styles.statLabel}>ללא רווחים</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 140,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    textAlignVertical: "top",
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: "rgba(79, 107, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(79, 107, 255, 0.18)",
    alignItems: "center",
  },
  statValue: {
    color: COLORS.accent,
    fontSize: 24,
    fontFamily: FONTS.bold,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
});
