import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useBusiness } from "../context/BusinessContext";
import { monthKey, shekel, todayKey } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// לוח בקרה — minimal analytics over the shared sales ledger. The 7-day chart
// is raw Views + reanimated (no chart library): each bar's height animates
// from 0 with a small stagger, growing bottom-up.

const WHITE = "#FFFFFF";
const CARD = "#F9FAFC";
const INK = "#111827";
const INK_SOFT = "#4B5563";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";

const CHART_H = 140;
const DAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function Bar({ heightPx, delay, isToday }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(heightPx, { duration: 550 }));
  }, [heightPx, delay]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[
        s.bar,
        { backgroundColor: isToday ? BLUE : BLUE + "2E" },
        style,
      ]}
    />
  );
}

export default function BizDashboardScreen() {
  const { sales } = useBusiness();

  // Last 7 days revenue (oldest → newest so "today" is the rightmost bar
  // visually in RTL reading it's the first; layout uses row so newest last).
  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const revenue = sales
        .filter((r) => r.day === key && r.kind !== "damage")
        .reduce((sum, r) => sum + (r.total || 0), 0);
      out.push({
        key,
        revenue,
        letter: DAY_LETTERS[d.getDay()],
        date: `${d.getDate()}.${d.getMonth() + 1}`,
        isToday: i === 0,
      });
    }
    return out;
  }, [sales]);

  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));

  // Monthly stats
  const month = monthKey();
  const monthly = useMemo(() => {
    const rows = sales.filter((r) => r.month === month && r.kind !== "damage");
    const revenue = rows.reduce((sum, r) => sum + (r.total || 0), 0);

    // Best seller (positive lines only — discounts excluded)
    const byName = new Map();
    for (const r of rows) {
      if ((r.total || 0) < 0) continue;
      const cur = byName.get(r.name) || 0;
      byName.set(r.name, cur + (r.qty || 0));
    }
    const best = [...byName.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    // Cash vs credit — from the pay stamp on records (present since Phase 4).
    const byTx = new Map();
    for (const r of rows) {
      if (!r.pay) continue;
      byTx.set(r.eventId || r.id, r.pay);
    }
    const txPays = [...byTx.values()];
    const cash = txPays.filter((p) => p === "cash").length;
    const credit = txPays.length - cash;
    return { revenue, best, cash, credit, tracked: txPays.length };
  }, [sales, month]);

  const cashPct = monthly.tracked ? Math.round((monthly.cash / monthly.tracked) * 100) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: WHITE }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      {/* Monthly revenue hero */}
      <View style={s.heroCard}>
        <Text style={s.heroValue}>{shekel(monthly.revenue)}</Text>
        <Text style={s.heroLabel}>📅 סה״כ פדיון החודש</Text>
      </View>

      {/* Best seller + cash/credit */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue} numberOfLines={1}>
            {monthly.best ? monthly.best[0] : "—"}
          </Text>
          <Text style={s.statLabel}>
            {monthly.best ? `⭐ הכי נמכר · ×${monthly.best[1]}` : "⭐ הכי נמכר"}
          </Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>
            {cashPct === null ? "—" : `${cashPct}% / ${100 - cashPct}%`}
          </Text>
          <Text style={s.statLabel}>💵 מזומן / אשראי 💳</Text>
        </View>
      </View>

      {/* 7-day revenue chart */}
      <View style={s.chartCard}>
        <Text style={s.chartTitle}>📊 פדיון 7 ימים אחרונים</Text>
        <View style={s.chartArea}>
          {days.map((d, i) => (
            <View key={d.key} style={s.barCol}>
              <Text style={s.barValue}>{d.revenue > 0 ? Math.round(d.revenue) : ""}</Text>
              <View style={s.barTrack}>
                <Bar
                  heightPx={Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / maxRevenue) * CHART_H)}
                  delay={i * 70}
                  isToday={d.isToday}
                />
              </View>
              <Text style={[s.barDay, d.isToday && { color: BLUE, fontFamily: FONTS.bold }]}>{d.letter}</Text>
              <Text style={s.barDate}>{d.date}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

const s = StyleSheet.create({
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 10,
    ...SHADOW,
  },
  heroValue: { fontFamily: FONTS.bold, fontSize: 34, color: INK },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT, marginTop: 4 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 28,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...SHADOW,
  },
  statValue: { fontFamily: FONTS.bold, fontSize: 15, color: INK, maxWidth: "100%" },
  statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 3 },

  chartCard: { backgroundColor: CARD, borderRadius: 28, padding: 16, ...SHADOW },
  chartTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: INK_SOFT, textAlign: "right", marginBottom: 12 },
  chartArea: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  barCol: { flex: 1, alignItems: "center" },
  barValue: { fontFamily: FONTS.semibold, fontSize: 9, color: INK_MUTED, height: 14 },
  barTrack: { height: CHART_H, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 20, borderRadius: 7 },
  barDay: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, marginTop: 6 },
  barDate: { fontFamily: FONTS.regular, fontSize: 9, color: INK_MUTED, marginTop: 1 },
});
