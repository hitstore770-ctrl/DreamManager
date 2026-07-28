import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../components/Icon";
import { hapticLight } from "../utils/haptics";
import { shekel } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// תמחור ורווחיות — import/print-job pricing calculator. Two modes:
//  • margin mode: enter desired profit % over total cost → sell price
//  • target mode: enter the target sell price → resulting profit
// Profit is color-coded: green above 30% of cost, red below 10%.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const GREEN_DARK = "#10B981";
const RED = "#EF4444";
const AMBER = "#B8791A";

// Defined at module level (not inside the screen) so its identity is stable
// and the TextInput keeps focus between keystrokes.
function Field({ label, value, onChange, placeholder, suffix }) {
  return (
    <View style={s.fieldWrap}>
      <CustomText style={s.fieldLabel}>{label}</CustomText>
      <View style={s.fieldRow}>
        {!!suffix && <CustomText style={s.fieldSuffix}>{suffix}</CustomText>}
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={INK_MUTED}
          textAlign="center"
        />
      </View>
    </View>
  );
}

export default function PricingScreen() {
  const [baseCost, setBaseCost] = useState("");
  const [shipCost, setShipCost] = useState("");
  const [mode, setMode] = useState("margin"); // margin | target
  const [margin, setMargin] = useState("");
  const [target, setTarget] = useState("");

  const calc = useMemo(() => {
    const cost = parseFloat(baseCost) || 0;
    const ship = parseFloat(shipCost) || 0;
    const totalCost = cost + ship;
    let sell = 0;
    if (mode === "margin") {
      const m = parseFloat(margin) || 0;
      sell = totalCost * (1 + m / 100);
    } else {
      sell = parseFloat(target) || 0;
    }
    const profit = sell - totalCost;
    const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const marginOfPrice = sell > 0 ? (profit / sell) * 100 : 0;
    // Friendly suggestion: round the sell price up to the next ₪5.
    const rounded = sell > 0 ? Math.ceil(sell / 5) * 5 : 0;
    const ready = totalCost > 0 && sell > 0;
    return { totalCost, sell, profit, profitPct, marginOfPrice, rounded, ready };
  }, [baseCost, shipCost, mode, margin, target]);

  const profitColor = calc.profitPct > 30 ? GREEN_DARK : calc.profitPct < 10 ? RED : AMBER;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: WHITE }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      {/* Costs */}
      <View style={s.rowPair}>
        <Field label="עלות בסיס" value={baseCost} onChange={setBaseCost} placeholder="0" suffix="₪" />
        <Field label="משלוח / חומרים" value={shipCost} onChange={setShipCost} placeholder="0" suffix="₪" />
      </View>

      {/* Mode switch */}
      <View style={s.segment}>
        <TouchableOpacity
          style={[s.segmentBtn, mode === "target" && s.segmentActive]}
          onPress={() => { hapticLight(); setMode("target"); }}
          activeOpacity={0.7}
        >
          <CustomText style={[s.segmentText, mode === "target" && { color: WHITE }]}>לפי מחיר יעד</CustomText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segmentBtn, mode === "margin" && s.segmentActive]}
          onPress={() => { hapticLight(); setMode("margin"); }}
          activeOpacity={0.7}
        >
          <CustomText style={[s.segmentText, mode === "margin" && { color: WHITE }]}>לפי אחוז רווח</CustomText>
        </TouchableOpacity>
      </View>

      {mode === "margin" ? (
        <Field label="אחוז רווח רצוי" value={margin} onChange={setMargin} placeholder="למשל 40" suffix="%" />
      ) : (
        <Field label="מחיר מכירה יעד" value={target} onChange={setTarget} placeholder="למשל 25" suffix="₪" />
      )}

      {/* Results */}
      <View style={s.resultCard}>
        <View style={s.resultRow}>
          <CustomText style={s.resultValueSmall}>{shekel(calc.totalCost)}</CustomText>
          <CustomText style={s.resultLabel}>עלות כוללת</CustomText>
        </View>
        <View style={s.hr} />
        <View style={s.resultHero}>
          <CustomText style={s.sellValue}>{calc.ready ? shekel(Math.round(calc.sell * 100) / 100) : "—"}</CustomText>
          <CustomText style={s.resultLabel}>מחיר מכירה סופי</CustomText>
        </View>
        <View style={[s.profitBox, calc.ready && { backgroundColor: profitColor + "14" }]}>
          <CustomText style={[s.profitValue, { color: calc.ready ? profitColor : INK_MUTED }]}>
            {calc.ready ? shekel(Math.round(calc.profit * 100) / 100) : "—"}
          </CustomText>
          <CustomText style={[s.profitLabel, { color: calc.ready ? profitColor : INK_MUTED }]}>
            רווח נקי {calc.ready ? `· ${Math.round(calc.profitPct)}% מהעלות · ${Math.round(calc.marginOfPrice)}% מהמחיר` : ""}
          </CustomText>
        </View>
        {calc.ready && calc.rounded !== Math.round(calc.sell) && (
          <CustomText style={s.roundHint}>מחיר מדף מומלץ (עיגול ל-5): {shekel(calc.rounded)}</CustomText>
        )}
        <CustomText style={s.legend}>ירוק: רווח מעל 30% · כתום: 10–30% · אדום: מתחת ל-10%</CustomText>
      </View>
    </ScrollView>
  );
}

const SHADOW = {
  // The one card shadow for the whole app — see utils/ui.js.
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 4,
};

const s = StyleSheet.create({
  rowPair: { flexDirection: "row", gap: 10 },
  fieldWrap: { flex: 1, marginBottom: 10 },
  fieldLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT, textAlign: "right", marginBottom: 6 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 12,
    minHeight: 56,
    ...SHADOW,
  },
  fieldSuffix: { fontFamily: FONTS.bold, fontSize: 16, color: INK_MUTED },
  fieldInput: { flex: 1, fontFamily: FONTS.bold, fontSize: 22, color: INK, minHeight: 56 },

  segment: { flexDirection: "row", backgroundColor: CARD, borderRadius: 24, padding: 4, marginBottom: 10, ...SHADOW },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: BLUE },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },

  resultCard: { backgroundColor: CARD, borderRadius: 24, padding: 16, marginTop: 4, ...SHADOW },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  resultLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  resultValueSmall: { fontFamily: FONTS.bold, fontSize: 16, color: INK },
  hr: { height: 1, backgroundColor: "#E7EAEE", marginVertical: 8 },
  resultHero: { alignItems: "center", paddingVertical: 8 },
  sellValue: { fontFamily: FONTS.bold, fontSize: 38, color: BLUE },
  profitBox: { borderRadius: 24, alignItems: "center", paddingVertical: 12, marginTop: 10, backgroundColor: WHITE },
  profitValue: { fontFamily: FONTS.bold, fontSize: 26 },
  profitLabel: { fontFamily: FONTS.semibold, fontSize: 12, marginTop: 2 },
  roundHint: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT, textAlign: "center", marginTop: 10 },
  legend: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "center", marginTop: 10 },
});
