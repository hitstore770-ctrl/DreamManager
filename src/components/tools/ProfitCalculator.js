import { useState } from "react";
import { View } from "react-native";

import { formatNumber, formatShekel } from "../../utils/format";
import { ToolField, ToolResult, ToolResultCard } from "./ToolKit";

export default function ProfitCalculator() {
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");

  const costValue = Number(cost);
  const priceValue = Number(price);
  const isValid =
    cost && price && !Number.isNaN(costValue) && !Number.isNaN(priceValue) && priceValue > 0;

  const profit = isValid ? priceValue - costValue : null;
  // Margin is measured against the selling price.
  const margin = isValid ? (profit / priceValue) * 100 : null;

  return (
    <View>
      <ToolField
        label="מחיר עלות (₪)"
        value={cost}
        onChangeText={setCost}
        placeholder="לדוגמה: 60"
      />
      <ToolField
        label="מחיר מכירה (₪)"
        value={price}
        onChangeText={setPrice}
        placeholder="לדוגמה: 100"
      />

      {profit !== null && (
        <ToolResultCard>
          <ToolResult label="רווח נקי" value={formatShekel(profit)} highlight />
          <ToolResult label="שולי רווח" value={`${formatNumber(margin, 1)}%`} />
        </ToolResultCard>
      )}
    </View>
  );
}
