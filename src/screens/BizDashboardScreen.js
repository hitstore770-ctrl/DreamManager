import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import Icon from "../components/Icon";
import { useAgents } from "../context/AgentsContext";
import { useBusiness } from "../context/BusinessContext";
import { monthKey, shekel, todayKey } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// לוח בקרה — minimal analytics over the shared sales ledger. The 7-day chart
// is raw Views + reanimated (no chart library): each bar's height animates
// from 0 with a small stagger, growing bottom-up.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
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
  const { agents } = useAgents() || {};

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

  // Franchise leaderboard — today's takings, Main POS vs each sub-agent, so
  // whoever's ringing up the register can see where they stand live rather
  // than finding out at the end-of-day Z-report.
  const leaderboard = useMemo(() => {
    if (!agents || agents.length === 0) return [];
    const day = todayKey();
    const todaySales = sales.filter((r) => r.day === day && r.kind !== "damage");
    const mainTotal = todaySales.filter((r) => !r.agentId).reduce((sum, r) => sum + (r.total || 0), 0);
    const byAgent = new Map();
    for (const r of todaySales) {
      if (!r.agentId) continue;
      byAgent.set(r.agentId, (byAgent.get(r.agentId) || 0) + (r.total || 0));
    }
    const rows = [
      { id: "main", name: "מנהל ראשי (קופה)", total: mainTotal, isMain: true },
      ...agents.map((a) => ({ id: a.id, name: a.name, total: byAgent.get(a.id) || 0, isMain: false })),
    ];
    return rows.sort((a, b) => b.total - a.total);
  }, [sales, agents]);
  const leaderboardMax = Math.max(1, ...leaderboard.map((r) => r.total));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: WHITE }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      {/* Monthly revenue hero */}
      <View style={s.heroCard}>
        <CustomText style={s.heroValue}>{shekel(monthly.revenue)}</CustomText>
        <CustomText style={s.heroLabel}>סה״כ פדיון החודש</CustomText>
      </View>

      {/* Best seller + cash/credit */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <CustomText style={s.statValue} numberOfLines={1}>
            {monthly.best ? monthly.best[0] : "—"}
          </CustomText>
          <CustomText style={s.statLabel}>
            {monthly.best ? `הכי נמכר · ×${monthly.best[1]}` : "הכי נמכר"}
          </CustomText>
        </View>
        <View style={s.statCard}>
          <CustomText style={s.statValue}>
            {cashPct === null ? "—" : `${cashPct}% / ${100 - cashPct}%`}
          </CustomText>
          <CustomText style={s.statLabel}>מזומן / אשראי</CustomText>
        </View>
      </View>

      {/* 7-day revenue chart */}
      <View style={s.chartCard}>
        <CustomText style={s.chartTitle}>פדיון 7 ימים אחרונים</CustomText>
        <View style={s.chartArea}>
          {days.map((d, i) => (
            <View key={d.key} style={s.barCol}>
              <CustomText style={s.barValue}>{d.revenue > 0 ? Math.round(d.revenue) : ""}</CustomText>
              <View style={s.barTrack}>
                <Bar
                  heightPx={Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / maxRevenue) * CHART_H)}
                  delay={i * 70}
                  isToday={d.isToday}
                />
              </View>
              <CustomText style={[s.barDay, d.isToday && { color: BLUE, fontFamily: FONTS.bold }]}>{d.letter}</CustomText>
              <CustomText style={s.barDate}>{d.date}</CustomText>
            </View>
          ))}
        </View>
      </View>

      {leaderboard.length > 0 && (
        <View style={s.leaderCard}>
          <CustomText style={s.chartTitle}>לוח מובילים — פדיון היום</CustomText>
          {leaderboard.map((row, i) => (
            <View key={row.id} style={s.leaderRow}>
              <CustomText style={s.leaderRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</CustomText>
              <View style={{ flex: 1 }}>
                <View style={s.leaderNameRow}>
                  <CustomText style={s.leaderValue}>{shekel(row.total)}</CustomText>
                  <CustomText style={s.leaderName} numberOfLines={1}>
                    {row.name}
                  </CustomText>
                </View>
                <View style={s.leaderTrack}>
                  <View
                    style={[
                      s.leaderFill,
                      { width: `${Math.max(row.total > 0 ? 4 : 0, (row.total / leaderboardMax) * 100)}%` },
                      row.isMain && { backgroundColor: INK_SOFT },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
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
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 24,
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
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...SHADOW,
  },
  statValue: { fontFamily: FONTS.bold, fontSize: 15, color: INK, maxWidth: "100%" },
  statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 3 },

  chartCard: { backgroundColor: CARD, borderRadius: 24, padding: 16, ...SHADOW },
  chartTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: INK_SOFT, textAlign: "right", marginBottom: 12 },
  chartArea: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  barCol: { flex: 1, alignItems: "center" },
  barValue: { fontFamily: FONTS.semibold, fontSize: 9, color: INK_MUTED, height: 14 },
  barTrack: { height: CHART_H, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 20, borderRadius: 7 },
  barDay: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, marginTop: 6 },
  barDate: { fontFamily: FONTS.regular, fontSize: 9, color: INK_MUTED, marginTop: 1 },

  leaderCard: { backgroundColor: CARD, borderRadius: 24, padding: 16, marginTop: 10, ...SHADOW },
  leaderRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 10 },
  leaderRank: { width: 26, fontFamily: FONTS.bold, fontSize: 14, color: INK_SOFT, textAlign: "center" },
  leaderNameRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  leaderName: { fontFamily: FONTS.semibold, fontSize: 13, color: INK, flexShrink: 1, textAlign: "right" },
  leaderValue: { fontFamily: FONTS.bold, fontSize: 13, color: BLUE },
  leaderTrack: { height: 6, borderRadius: 3, backgroundColor: "#EEF0F3", marginTop: 5, overflow: "hidden" },
  leaderFill: { height: 6, borderRadius: 3, backgroundColor: BLUE },
});
