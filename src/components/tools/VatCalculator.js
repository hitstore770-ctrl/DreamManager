import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { formatShekel } from "../../utils/format";
import { ToolButton, ToolField, ToolResult, ToolResultCard } from "./ToolKit";

const VAT_RATE = 0.17;

export default function VatCalculator() {
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState(null);

  const compute = (mode) => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setResult(null);
      alert("נא להזין סכום תקין");
      return;
    }

    if (mode === "add") {
      const vat = value * VAT_RATE;
      setResult({ base: value, vat, total: value + vat });
    } else {
      // amount already includes VAT -> extract the pre-VAT base.
      const base = value / (1 + VAT_RATE);
      setResult({ base, vat: value - base, total: value });
    }
  };

  return (
    <View>
      <ToolField
        label='סכום (₪)'
        value={amount}
        onChangeText={setAmount}
        placeholder="לדוגמה: 1000"
      />

      <View style={styles.buttonRow}>
        <ToolButton label="הוסף מע״מ 17%" onPress={() => compute("add")} />
        <View style={styles.gap} />
        <ToolButton label="חלץ מע״מ 17%" onPress={() => compute("extract")} color="#1E9E58" />
      </View>

      {result && (
        <ToolResultCard>
          <ToolResult label="לפני מע״מ" value={formatShekel(result.base)} />
          <ToolResult label="מע״מ (17%)" value={formatShekel(result.vat)} />
          <ToolResult label="כולל מע״מ" value={formatShekel(result.total)} highlight />
        </ToolResultCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gap: {
    width: 12,
  },
});
