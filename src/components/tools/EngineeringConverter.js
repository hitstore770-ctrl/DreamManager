import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatNumber } from "../../utils/format";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolField, ToolResult, ToolResultCard } from "./ToolKit";

const MM_PER_INCH = 25.4;

export default function EngineeringConverter() {
  // direction: "mmToInch" or "inchToMm"
  const [direction, setDirection] = useState("mmToInch");
  const [value, setValue] = useState("");

  const numeric = Number(value);
  const isValid = value !== "" && !Number.isNaN(numeric);
  const converted =
    direction === "mmToInch" ? numeric / MM_PER_INCH : numeric * MM_PER_INCH;

  const fromUnit = direction === "mmToInch" ? "מ״מ" : "אינץ׳";
  const toUnit = direction === "mmToInch" ? "אינץ׳" : "מ״מ";

  return (
    <View>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, direction === "mmToInch" && styles.toggleActive]}
          onPress={() => setDirection("mmToInch")}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.toggleText, direction === "mmToInch" && styles.toggleTextActive]}
          >
            מ״מ ← אינץ׳
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, direction === "inchToMm" && styles.toggleActive]}
          onPress={() => setDirection("inchToMm")}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.toggleText, direction === "inchToMm" && styles.toggleTextActive]}
          >
            אינץ׳ ← מ״מ
          </Text>
        </TouchableOpacity>
      </View>

      <ToolField
        label={`ערך ב${fromUnit}`}
        value={value}
        onChangeText={setValue}
        placeholder={direction === "mmToInch" ? "לדוגמה: 148" : "לדוגמה: 5.83"}
      />

      {isValid && (
        <ToolResultCard>
          <ToolResult label={`תוצאה ב${toUnit}`} value={formatNumber(converted, 3)} highlight />
        </ToolResultCard>
      )}

      <View style={styles.referenceCard}>
        <Text style={styles.referenceTitle}>מידות A5 להדפסה</Text>
        <Text style={styles.referenceText}>148 × 210 מ״מ</Text>
        <Text style={styles.referenceText}>5.83 × 8.27 אינץ׳</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "rgba(79, 107, 255, 0.1)",
    borderColor: COLORS.accent,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  toggleTextActive: {
    color: COLORS.accent,
    fontFamily: FONTS.bold,
  },
  referenceCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  referenceTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    marginBottom: 8,
  },
  referenceText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
});
