import { useMemo } from "react";
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useBusiness } from "../context/BusinessContext";
import { hapticHeavy, hapticLight } from "../utils/haptics";
import { shekel, todayKey, uid } from "../utils/posStore";
import { useSettings } from "../context/SettingsContext";
import { aggregateDay, buildZReportText, lastCloseTs } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// דוח משמרת — live daily aggregation of the shared sales ledger. "Closing the
// register" archives the current shift's stats and (because everything here
// aggregates records after the last close) resets the live view to zero
// without touching the underlying sales history.

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GREEN_DARK = "#1E9E58";

export default function ZReportScreen() {
  const { sales, closes, setCloses } = useBusiness();
  const { receiptFooter } = useSettings();

  const since = lastCloseTs(closes);
  const stats = useMemo(() => aggregateDay(sales, new Date(), since), [sales, since]);
  const topItem = stats.top[0] || null;
  const hasActivity = stats.txCount > 0 || stats.revenue > 0 || stats.dmgUnits > 0;
  const closedToday = since > 0;

  const shareZ = async () => {
    hapticLight();
    try {
      await Share.share({ message: buildZReportText(sales, new Date(), since, receiptFooter) });
    } catch {
      /* user cancelled */
    }
  };

  // Archive the shift and reset the live counters (aggregation cutoff moves
  // to "now"). The sales ledger itself is never modified.
  const closeRegister = () => {
    if (!hasActivity) return;
    hapticHeavy();
    setCloses((prev) => [
      ...prev,
      {
        id: uid(),
        day: todayKey(),
        ts: Date.now(),
        revenue: stats.revenue,
        txCount: stats.txCount,
        units: stats.units,
        topItem: topItem ? { name: topItem.name, qty: topItem.qty } : null,
      },
    ]);
  };

  const history = useMemo(() => [...closes].sort((a, b) => b.ts - a.ts).slice(0, 6), [closes]);

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
        {closedToday && !hasActivity && (
          <View style={s.closedBanner}>
            <Text style={s.closedBannerText}>המשמרת נסגרה ✓ — מכירות חדשות ייספרו למשמרת הבאה</Text>
          </View>
        )}

        {/* Revenue hero */}
        <View style={s.heroCard}>
          <Text style={s.heroValue}>{shekel(stats.revenue)}</Text>
          <Text style={s.heroLabel}>💰 סה״כ הכנסות {closedToday ? "(מאז סגירה אחרונה)" : "היום"}</Text>
        </View>

        {/* Secondary metrics */}
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{stats.txCount}</Text>
            <Text style={s.metricLabel}>🧺 עסקאות</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue} numberOfLines={1}>
              {topItem ? topItem.name : "—"}
            </Text>
            <Text style={s.metricLabel}>
              {topItem ? `⭐ מוביל · ×${topItem.qty}` : "⭐ מוצר מוביל"}
            </Text>
          </View>
        </View>

        {stats.dmgUnits > 0 && (
          <View style={s.dmgRow}>
            <Text style={s.dmgText}>⚠️ פחת/נזק במשמרת: {stats.dmgUnits} יח׳</Text>
          </View>
        )}

        {/* Share */}
        <TouchableOpacity style={s.shareBtn} onPress={shareZ} activeOpacity={0.8}>
          <Text style={s.shareBtnText}>📤 שיתוף דוח Z ל-WhatsApp</Text>
        </TouchableOpacity>

        {/* Close history */}
        {history.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.historyTitle}>סגירות אחרונות</Text>
            {history.map((c) => (
              <View key={c.id} style={s.historyRow}>
                <Text style={s.historyValue}>{shekel(c.revenue)}</Text>
                <Text style={s.historyLabel}>
                  {new Date(c.ts).toLocaleDateString("he-IL")} ·{" "}
                  {new Date(c.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {c.txCount} עסקאות
                </Text>
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
          <Text style={s.closeBtnText}>🔒 סגור משמרת</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
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
    borderRadius: 20,
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
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...SHADOW,
  },
  metricValue: { fontFamily: FONTS.bold, fontSize: 18, color: INK, maxWidth: "100%" },
  metricLabel: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 3 },

  dmgRow: { backgroundColor: "#FDEBEB", borderRadius: 14, padding: 12, marginTop: 10 },
  dmgText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#E14848", textAlign: "right" },

  shareBtn: {
    minHeight: 52,
    borderRadius: 16,
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
    borderTopColor: "#EEF0F3",
  },
  closeBtn: {
    minHeight: 58,
    borderRadius: 18,
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
});
