import { useState } from "react";
import { View } from "react-native";

import { formatShekel } from "../../utils/format";
import { ToolField, ToolResult, ToolResultCard } from "./ToolKit";

export default function SplitBill() {
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState("");

  const totalValue = Number(total);
  const peopleValue = Number(people);
  const isValid =
    total && people && !Number.isNaN(totalValue) && peopleValue >= 1 && totalValue > 0;
  const perPerson = isValid ? totalValue / Math.floor(peopleValue) : null;

  return (
    <View>
      <ToolField
        label="סכום כולל (₪)"
        value={total}
        onChangeText={setTotal}
        placeholder="לדוגמה: 360"
      />
      <ToolField
        label="מספר אנשים"
        value={people}
        onChangeText={setPeople}
        placeholder="לדוגמה: 4"
      />

      {perPerson !== null && (
        <ToolResultCard>
          <ToolResult label="לתשלום לכל אחד" value={formatShekel(perPerson)} highlight />
        </ToolResultCard>
      )}
    </View>
  );
}
