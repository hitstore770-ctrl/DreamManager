import { useState } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { Feather } from "@expo/vector-icons";

import { RADIUS } from "../theme/ThemeContext";
import { computeCalcTotal, parseCalcContent, serializeCalcContent } from "../lib/calc";
import { t } from "../i18n/strings";

// The Interactive Pricing Block: quantity x unit price, marked up by a
// margin %, recomputed on every keystroke. State is seeded from `content`
// once (useState initializer) rather than kept controlled by it, because
// every edit round-trips through the note's body and back down through
// MarkdownView's reparse -- staying uncontrolled avoids that round trip
// fighting the text input's cursor position while typing.
export default function CalcBlock({ content, theme, onChange }) {
  const [data, setData] = useState(() => parseCalcContent(content));

  const update = (patch) => {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(serializeCalcContent(next));
  };

  const { total } = computeCalcTotal(data);
  const s = styles(theme);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Feather name="hash" size={14} color={theme.accent} />
        <AppTextInput
          testID="calc-label"
          style={s.labelInput}
          value={data.label}
          onChangeText={(v) => update({ label: v })}
          placeholder={t("calcTitle")}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <View style={s.row}>
        <Field testID="calc-qty" label={t("quantity")} value={data.qty} onChangeText={(v) => update({ qty: v.replace(/[^0-9.]/g, "") })} theme={theme} />
        <Field
          testID="calc-price"
          label={t("unitPrice")}
          value={data.price}
          onChangeText={(v) => update({ price: v.replace(/[^0-9.]/g, "") })}
          theme={theme}
        />
        <Field
          testID="calc-margin"
          label={t("margin")}
          value={data.margin}
          onChangeText={(v) => update({ margin: v.replace(/[^0-9.]/g, "") })}
          theme={theme}
        />
      </View>

      <View style={s.totalRow}>
        <AppText style={{ color: theme.textMuted, fontSize: 12.5, fontWeight: "600" }}>{t("total")}</AppText>
        <AppText testID="calc-total" style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>
          {total.toFixed(2)}
        </AppText>
      </View>
    </View>
  );
}

function Field({ testID, label, value, onChangeText, theme }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>{label}</AppText>
      <AppTextInput
        testID={testID}
        style={{ backgroundColor: theme.surfaceAlt, borderRadius: 10, paddingHorizontal: 10, height: 38, color: theme.text, fontSize: 14 }}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, marginVertical: 6, gap: 12, ...t.cardShadow },
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    labelInput: { flex: 1, fontSize: 14.5, fontWeight: "700", color: t.text },
    row: { flexDirection: "row", gap: 10 },
    totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 },
  });
