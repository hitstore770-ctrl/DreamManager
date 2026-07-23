import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

export default function InventoryClicker() {
  const [count, setCount] = useState(0);

  return (
    <View>
      <View style={styles.countBox}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.bigButton, { backgroundColor: "#E07C1D" }]}
          onPress={() => setCount((prev) => Math.max(0, prev - 1))}
          activeOpacity={0.85}
        >
          <Text style={styles.bigButtonText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bigButton, { backgroundColor: "#1E9E58" }]}
          onPress={() => setCount((prev) => prev + 1)}
          activeOpacity={0.85}
        >
          <Text style={styles.bigButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ToolButton
        label="איפוס"
        onPress={() => setCount(0)}
        color={COLORS.textMuted}
        style={styles.resetButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  countBox: {
    paddingVertical: 28,
    borderRadius: 20,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
  },
  count: {
    color: COLORS.textPrimary,
    fontSize: 64,
    fontFamily: FONTS.bold,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  bigButton: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bigButtonText: {
    color: "#FFFFFF",
    fontSize: 40,
    fontFamily: FONTS.bold,
    marginTop: -4,
  },
  resetButton: {
    height: 46,
  },
});
