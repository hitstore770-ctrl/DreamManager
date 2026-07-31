import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, TouchableOpacity, View } from "react-native";

import Icon from "../components/Icon";
import { useBusiness } from "../context/BusinessContext";
import { callGemini, isGeminiConfigured } from "../config/geminiConfig";
import { hapticHeavy, hapticLight } from "../utils/haptics";
import { shekel, todayKey, uid } from "../utils/posStore";
import { useSettings } from "../context/SettingsContext";
import { DEFAULT_GOAL } from "./MoneyDashboardScreen";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { aggregateDay, buildZReportText, lastCloseTs } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { UI, tint } from "../utils/ui";
import CustomText from "../components/CustomText";

// Noa's end-of-shift recap: takes the same numbers the cards above already
// show, plus today's operational expenses (a separate ledger — cashFlow, not
// posSales), and turns them into two warm sentences instead of a spreadsheet
// row. Falls back to a locally-templated sentence if Gemini is unreachable or
// unconfigured, so closing a shift is never blocked on a network call.
async function generateShiftSummary({ revenue, profit, expenses, topItem, dronePct, goalName }) {
  const fallback = () => {
    const parts = [`עבודה טובה היום! הרווח הנקי עמד על ${shekel(profit)}`];
    if (topItem) parts.push(`, ו${topItem.name} היה המוצר המוביל`);
    parts.push(".");
    if (dronePct > 0) parts.push(` המשמרת קרבה אתכם ב-${dronePct}% נוספים ליעד ${goalName}.`);
    return parts.join("");
  };

  if (!isGeminiConfigured()) return fallback();

  const facts = [
    `פדיון: ${shekel(revenue)}`,
    `רווח נקי: ${shekel(profit)}`,
    `הוצאות תפעוליות היום: ${shekel(expenses)}`,
  ];
  if (topItem) facts.push(`המוצר המוביל: ${topItem.name} (${topItem.qty} יח')`);
  if (dronePct > 0) facts.push(`המשמרת קרבה את קרן "${goalName}" ב-${dronePct}% נוספים ליעד`);

  const prompt =
    "אתה נועה, עוזרת AI פיננסית חמה ותכליתית לעסק קטן של נער בפנימייה. " +
    "סכמי את המשמרת שהסתיימה כרגע ב-2-3 משפטים קצרים בעברית, בטון מעודד כמו הודעת וואטסאפ — " +
    "בלי כותרות, בלי רשימות, לכל היותר אימוג'י אחד. הנתונים:\n" +
    facts.map((f) => `- ${f}`).join("\n");

  try {
    const res = await callGemini({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    if (res.ok) {
      const text = (res.json?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text)
        .filter(Boolean)
        .join("")
        .trim();
      if (text) return text;
    }
  } catch {
    /* fall through to the local sentence */
  }
  return fallback();
}

// דוח משמרת — live daily aggregation of the shared sales ledger. "Closing the
// register" archives the current shift's stats and (because everything here
// aggregates records after the last close) resets the live view to zero
// without touching the underlying sales history.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const GREEN_DARK = "#10B981";

export default function ZReportScreen() {
  const { sales, closes, setCloses } = useBusiness();
  const { receiptFooter } = useSettings();

  // Read-only here — the same cash-flow ledger CashFlowScreen.js owns, and
  // the same drone-fund keys MoneyDashboardScreen.js and completeSale
  // (PosRegisterTab.js) write, all reached the usual way: the exact same
  // storage key, no context, no prop-drilling between three unrelated tabs.
  const [cashEntries] = usePersistentState(STORAGE_KEYS.cashFlow, []);
  const [goal] = usePersistentState(STORAGE_KEYS.droneGoal, DEFAULT_GOAL);
  const [droneAutoDaily] = usePersistentState(STORAGE_KEYS.droneAutoDaily, { day: "", amount: 0 });

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const since = lastCloseTs(closes);
  const stats = useMemo(() => aggregateDay(sales, new Date(), since), [sales, since]);
  const topItem = stats.top[0] || null;
  const hasActivity = stats.txCount > 0 || stats.revenue > 0 || stats.dmgUnits > 0;
  const closedToday = since > 0;

  const today = todayKey();
  // Cash-flow entries are stamped `at` (a raw timestamp), not `day` — same
  // day-string conversion the sales ledger's own records carry, applied here
  // since this ledger never got one.
  const todayExpenses = useMemo(
    () =>
      (cashEntries || [])
        .filter((e) => e.kind === "expense" && todayKey(new Date(e.at || 0)) === today)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [cashEntries, today]
  );

  const target = Number(goal?.target) > 0 ? Number(goal.target) : DEFAULT_GOAL.target;
  const autoToday = droneAutoDaily?.day === today ? Number(droneAutoDaily.amount) || 0 : 0;
  const dronePct = target > 0 ? Math.round((autoToday / target) * 1000) / 10 : 0;

  const shareZ = async () => {
    hapticLight();
    try {
      await Share.share({ message: buildZReportText(sales, new Date(), since, receiptFooter) });
    } catch {
      /* user cancelled */
    }
  };

  // Archive the shift, reset the live counters (aggregation cutoff moves to
  // "now"), then ask Noa for the recap. The sales ledger itself is never
  // modified — closing is purely a cursor moving forward.
  const closeRegister = async () => {
    if (!hasActivity) return;
    hapticHeavy();
    setCloses((prev) => [
      ...prev,
      {
        id: uid(),
        day: todayKey(),
        ts: Date.now(),
        revenue: stats.revenue,
        profit: stats.profit,
        txCount: stats.txCount,
        units: stats.units,
        topItem: topItem ? { name: topItem.name, qty: topItem.qty } : null,
      },
    ]);

    setSummaryOpen(true);
    setSummaryLoading(true);
    const text = await generateShiftSummary({
      revenue: stats.revenue,
      profit: stats.profit,
      expenses: todayExpenses,
      topItem,
      dronePct,
      goalName: goal?.name || DEFAULT_GOAL.name,
    });
    setSummaryText(text);
    setSummaryLoading(false);
  };

  const history = useMemo(() => [...closes].sort((a, b) => b.ts - a.ts).slice(0, 6), [closes]);

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
        {closedToday && !hasActivity && (
          <View style={s.closedBanner}>
            <CustomText style={s.closedBannerText}>המשמרת נסגרה — מכירות חדשות ייספרו למשמרת הבאה</CustomText>
          </View>
        )}

        {/* Revenue hero */}
        <View style={s.heroCard}>
          <CustomText style={s.heroValue}>{shekel(stats.revenue)}</CustomText>
          <CustomText style={s.heroLabel}>סה״כ הכנסות {closedToday ? "(מאז סגירה אחרונה)" : "היום"}</CustomText>
        </View>

        {/* Secondary metrics */}
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <CustomText style={s.metricValue}>{stats.txCount}</CustomText>
            <CustomText style={s.metricLabel}>עסקאות</CustomText>
          </View>
          <View style={s.metricCard}>
            <CustomText style={s.metricValue} numberOfLines={1}>
              {topItem ? topItem.name : "—"}
            </CustomText>
            <CustomText style={s.metricLabel}>
              {topItem ? `מוביל · ×${topItem.qty}` : "מוצר מוביל"}
            </CustomText>
          </View>
        </View>

        {stats.dmgUnits > 0 && (
          <View style={s.dmgRow}>
            <CustomText style={s.dmgText}>פחת/נזק במשמרת: {stats.dmgUnits} יח׳</CustomText>
          </View>
        )}

        {/* Share */}
        <TouchableOpacity style={s.shareBtn} onPress={shareZ} activeOpacity={0.8}>
          <Icon name="share-2" size={17} color={WHITE} />
          <CustomText style={s.shareBtnText}>שיתוף דוח Z ל-WhatsApp</CustomText>
        </TouchableOpacity>

        {/* Close history */}
        {history.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <CustomText style={s.historyTitle}>סגירות אחרונות</CustomText>
            {history.map((c) => (
              <View key={c.id} style={s.historyRow}>
                <CustomText style={s.historyValue}>{shekel(c.revenue)}</CustomText>
                <CustomText style={s.historyLabel}>
                  {new Date(c.ts).toLocaleDateString("he-IL")} ·{" "}
                  {new Date(c.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {c.txCount} עסקאות
                </CustomText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom-pinned end-of-day action — thumb reach on tall screens */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.closeBtn, !hasActivity && { opacity: 0.35 }]}
          onPress={closeRegister}
          activeOpacity={0.85}
        >
          <Icon name="lock" size={18} color={WHITE} />
          <CustomText style={s.closeBtnText}>סגור משמרת</CustomText>
        </TouchableOpacity>
      </View>

      {/* Noa's end-of-shift recap. */}
      <Modal visible={summaryOpen} transparent animationType="fade" onRequestClose={() => setSummaryOpen(false)}>
        <Pressable style={s.summaryBackdrop} onPress={() => setSummaryOpen(false)}>
          <Pressable style={s.summaryCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.summaryAvatar}>
              <Icon name="sparkles-outline" size={22} color={WHITE} />
            </View>
            <CustomText style={s.summaryTitle}>סיכום המשמרת מנועה</CustomText>

            {summaryLoading ? (
              <View style={s.summaryLoading}>
                <ActivityIndicator color={UI.violet} />
                <CustomText style={s.summaryLoadingText}>נועה מסכמת את המשמרת…</CustomText>
              </View>
            ) : (
              <CustomText testID="shift-summary-text" style={s.summaryText}>
                {summaryText}
              </CustomText>
            )}

            <TouchableOpacity
              testID="summary-done"
              style={s.summaryCloseBtn}
              onPress={() => setSummaryOpen(false)}
              activeOpacity={0.85}
            >
              <CustomText style={s.summaryCloseBtnText}>סיום</CustomText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  closedBanner: {
    backgroundColor: GREEN_DARK + "14",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  closedBannerText: { fontFamily: FONTS.semibold, fontSize: 13, color: GREEN_DARK, textAlign: "right" },

  heroCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 26,
    marginBottom: 10,
    ...SHADOW,
  },
  heroValue: { fontFamily: FONTS.bold, fontSize: 40, color: INK },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT, marginTop: 4 },

  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...SHADOW,
  },
  metricValue: { fontFamily: FONTS.bold, fontSize: 18, color: INK, maxWidth: "100%" },
  metricLabel: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 3 },

  dmgRow: { backgroundColor: "#FDEBEB", borderRadius: 14, padding: 12, marginTop: 10 },
  dmgText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#EF4444", textAlign: "right" },

  shareBtn: {
    minHeight: 52,
    borderRadius: 24,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  shareBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE },

  historyTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: INK_SOFT, textAlign: "right", marginBottom: 8 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 6,
  },
  historyLabel: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED },
  historyValue: { fontFamily: FONTS.bold, fontSize: 14, color: INK },

  bottomBar: {
    padding: 14,
    paddingBottom: 16,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#EEF1F6",
  },
  closeBtn: {
    minHeight: 58,
    borderRadius: 24,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  closeBtnText: { fontFamily: FONTS.bold, fontSize: 17, color: WHITE },

  summaryBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,20,26,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  summaryCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: WHITE,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 4,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 8,
  },
  summaryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  summaryTitle: { fontFamily: FONTS.bold, fontSize: 17, color: INK, marginBottom: 10 },
  summaryLoading: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 10 },
  summaryLoadingText: { fontFamily: FONTS.medium, fontSize: 13, color: INK_MUTED },
  summaryText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    lineHeight: 24,
    color: INK,
    textAlign: "center",
    marginBottom: 14,
  },
  summaryCloseBtn: {
    minHeight: 50,
    minWidth: 140,
    borderRadius: 16,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCloseBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
});
