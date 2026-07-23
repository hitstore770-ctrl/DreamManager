import { useState } from "react";
import { View } from "react-native";

import { formatNumber } from "../../utils/format";
import { ToolField, ToolResult, ToolResultCard } from "./ToolKit";

export default function BatteryRange() {
  const [battery, setBattery] = useState("");
  const [fullRange, setFullRange] = useState("");

  const batteryValue = Number(battery);
  const rangeValue = Number(fullRange);
  const isValid =
    battery &&
    fullRange &&
    !Number.isNaN(batteryValue) &&
    !Number.isNaN(rangeValue) &&
    batteryValue >= 0 &&
    batteryValue <= 100 &&
    rangeValue > 0;

  const remainingKm = isValid ? (batteryValue / 100) * rangeValue : null;

  return (
    <View>
      <ToolField
        label="אחוז סוללה נוכחי (%)"
        value={battery}
        onChangeText={setBattery}
        placeholder="לדוגמה: 80"
      />
      <ToolField
        label="טווח מלא ב-100% (ק״מ)"
        value={fullRange}
        onChangeText={setFullRange}
        placeholder="לדוגמה: 40"
      />

      {remainingKm !== null && (
        <ToolResultCard>
          <ToolResult
            label="טווח נותר משוער"
            value={`${formatNumber(remainingKm, 1)} ק״מ`}
            highlight
          />
        </ToolResultCard>
      )}
    </View>
  );
}
