import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { monthKey, shekel } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

function prevMonthKey() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

export default function ProfitAnalyzer() {
  const [inventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);

  const analysis = useMemo(() => {
    // Highest margin % (from inventory cost vs price)
    let bestMargin = null;
    inventory.forEach((i) => {
      const cost = Number(i.cost) || 0;
      if (cost <= 0) return;
      const margin = ((Number(i.price) || 0) - cost) / cost * 100;
      if (!bestMargin || margin > bestMargin.margin) bestMargin = { name: i.name, margin };
    });

    // Highest volume (units sold, from sales kind 'sale')
    const volById = {};
    sales.forEach((s) => {
      if (s.kind !== "sale") return;
      volById[s.itemId] = volById[s.itemId] || { name: s.name, qty: 0 };
      volById[s.itemId].qty += s.qty;
    });
    let bestVolume = null;
    Object.values(volById).forEach((v) => {
      if (!bestVolume || v.qty > bestVolume.qty) bestVolume = v;
    });

    // Dead stock: in stock but never sold
    const dead = inventory.filter((i) => i.qty > 0 && !(i.sold > 0)).map((i) => i.name);

    // Month over month profit
    const thisM = monthKey();
    const prevM = prevMonthKey();
    let profitThis = 0;
    let profitPrev = 0;
    sales.forEach((s) => {
      if (s.month === thisM) profitThis += s.profit;
      else if (s.month === prevM) profitPrev += s.profit;
    });
    const momDelta = profitThis - profitPrev;

    return { bestMargin, bestVolume, dead, profitThis, profitPrev, momDelta };
  }, [inventory, sales]);

  const { bestMargin, bestVolume, dead, profitThis, profitPrev, momDelta } = analysis;

  // Recommendation banner
  let rec = null;
  if (dead.length > 0) {
    rec = { tone: "warn", text: `שקול הנחה/מבצע על: ${dead.slice(0, 3).join(", ")} — לא נמכרו כלל.`};
  } else if (bestVolume && bestMargin) {
    rec = { tone: "good", text: `"${bestVolume.name}"נמכר הכי הרבה — שקול להעלות מלאי ולשמור על המחיר.`};
  } else {
    rec = { tone: "info", text: "עדיין אין מספיק נתונים — התחל למכור כדי לקבל המלצות."};
  }

  const hasData = inventory.length > 0 || sales.length > 0;

  return (
    <View>
      {!hasData && (
        <Text style={styles.empty}>אין נתונים עדיין. הוסף מלאי ומכירות כדי לנתח רווחיות.</Text>
      )}

      {/* Recommendation banner */}
      <View style={[styles.recBanner, rec.tone === "warn" ? styles.recWarn : rec.tone === "good" ? styles.recGood : styles.recInfo]}>
        <Text style={[styles.recText, rec.tone === "good" && { color: "#FFFFFF" }]}>{rec.text}</Text>
      </View>

      {/* MoM comparison */}
      <View style={styles.momCard}>
        <Text style={styles.momTitle}>רווח חודש מול חודש</Text>
        <View style={styles.momRow}>
          <View style={styles.momCell}>
            <Text style={styles.momLabel}>החודש</Text>
            <Text style={styles.momValue}>{shekel(profitThis)}</Text>
          </View>
          <View style={styles.momCell}>
            <Text style={styles.momLabel}>חודש שעבר</Text>
            <Text style={styles.momValue}>{shekel(profitPrev)}</Text>
          </View>
        </View>
        <Text style={[styles.momDelta, momDelta < 0 ? { color: COLORS.danger } : { color: COLORS.success }]}>
          {momDelta >= 0 ? "▲" : "▼"} {shekel(Math.abs(momDelta))} לעומת חודש שעבר
        </Text>
      </View>

      {/* Top cards */}
      <View style={styles.statCard}>
 <Text style={styles.statLabel}> מרווח הכי גבוה</Text>
        <Text style={styles.statValue}>
          {bestMargin ? `${bestMargin.name} · ${bestMargin.margin.toFixed(0)}%` : "—"}
        </Text>
      </View>
      <View style={styles.statCard}>
 <Text style={styles.statLabel}> הכי נמכר (יחידות)</Text>
        <Text style={styles.statValue}>
          {bestVolume ? `${bestVolume.name} · ${bestVolume.qty} יח׳` : "—"}
        </Text>
      </View>

      {/* Dead stock */}
      <View style={[styles.statCard, dead.length > 0 && styles.deadCard]}>
 <Text style={styles.statLabel}> מלאי מת (לא נמכר)</Text>
        {dead.length === 0 ? (
 <Text style={styles.statValue}>אין — כל הפריטים נמכרו </Text>
        ) : (
          dead.map((n) => (
            <Text key={n} style={styles.deadItem}>• {n}</Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 12 },
  recBanner: { borderRadius: RADIUS, padding: 14, marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  recWarn: { backgroundColor: COLORS.mustard },
  recGood: { backgroundColor: COLORS.success },
  recInfo: { backgroundColor: COLORS.white },
  recText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", lineHeight: 20 },
  momCard: { backgroundColor: COLORS.navy, borderRadius: RADIUS, padding: 16, marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  momTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
  momRow: { flexDirection: "row", gap: 10 },
  momCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, padding: 10, alignItems: "center" },
  momLabel: { color: "#CBD5E1", fontSize: 12, fontFamily: FONTS.medium },
  momValue: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold, marginTop: 2 },
  momDelta: { fontSize: 15, fontFamily: FONTS.bold, textAlign: "center", marginTop: 12 },
  statCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 10, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  statLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 6 },
  statValue: { color: COLORS.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right" },
  deadCard: { backgroundColor: "#FBE3E3", borderColor: COLORS.danger },
  deadItem: { color: COLORS.danger, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginTop: 2 },
});
