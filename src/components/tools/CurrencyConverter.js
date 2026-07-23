import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatNumber } from "../../utils/format";
import { fetchJson } from "../../utils/network";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolError, ToolField, ToolLoading, ToolResult, ToolResultCard } from "./ToolKit";

const RATE_URL = "https://api.frankfurter.app/latest?from=USD&to=ILS";

export default function CurrencyConverter() {
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState(null);
  const [date, setDate] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const loadRate = async () => {
    setStatus("loading");
    try {
      const data = await fetchJson(RATE_URL);
      const ils = data?.rates?.ILS;
      if (typeof ils !== "number") {
        throw new Error("bad payload");
      }
      setRate(ils);
      setDate(data.date ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadRate();
  }, []);

  if (status === "loading") {
    return <ToolLoading label="טוען שער חליפין..." />;
  }

  if (status === "error") {
    return (
      <ToolError
        message="שגיאה בטעינת שער החליפין. בדקו את חיבור האינטרנט ונסו שוב."
        onRetry={loadRate}
      />
    );
  }

  const amountValue = Number(amount);
  const converted = !Number.isNaN(amountValue) ? amountValue * rate : 0;

  return (
    <View>
      <ToolField
        label="סכום בדולר (USD)"
        value={amount}
        onChangeText={setAmount}
        placeholder="לדוגמה: 100"
      />

      <ToolResultCard>
        <ToolResult label="בשקלים (ILS)" value={`₪${formatNumber(converted)}`} highlight />
        <ToolResult label="שער נוכחי" value={`1 $ = ₪${formatNumber(rate, 4)}`} />
      </ToolResultCard>

      {date && <Text style={styles.updatedText}>עודכן לאחרונה: {date}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  updatedText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 12,
  },
});
