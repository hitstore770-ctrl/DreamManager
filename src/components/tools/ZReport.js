import { useMemo } from "react";
import {
  Alert,
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { CATEGORIES, catOf, isLocked, shekel, todayKey } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

export default function ZReport() {
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [lockedDays, setLockedDays] = usePersistentState(STORAGE_KEYS.posLockedDays, []);
  const today = todayKey();
  const locked = isLocked(lockedDays, today);

  const report = useMemo(() => {
    const todaySales = sales.filter((s) => s.day === today);
    let revenue = 0;
    let profit = 0;
    let units = 0;
    let loss = 0;
    let txns = 0;
    const byCat = {};
    todaySales.forEach((s) => {
      if (s.kind === "damage") {
        loss += Math.abs(s.profit);
        return;
      }
      revenue += s.total;
      profit += s.profit;
      units += s.qty;
      txns += 1;
      byCat[s.category] = (byCat[s.category] || 0) + s.total;
    });
    return { revenue, profit, units, loss, txns, byCat };
  }, [sales, today]);

  const reportText = () =>
    `📋 דו״ח Z — ${today}\n\n` +
    `מכירות: ${report.txns}\n` +
    `יחידות שנמכרו: ${report.units}\n` +
    `הכנסות: ${shekel(report.revenue)}\n` +
    `רווח: ${shekel(report.profit)}\n` +
    `אובדן/נזק: ${shekel(report.loss)}\n` +
    CATEGORIES.filter((c) => report.byCat[c.key])
      .map((c) => `${c.label}: ${shekel(report.byCat[c.key])}`)
      .join("\n");

  const closeDay = () => {
    Alert.alert(
      "סגירת יום",
      "לאחר הפקת דו״ח Z רשומות היום יינעלו ולא ניתן יהיה לשנותן. להמשיך?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "הפק ונעל",
          style: "destructive",
          onPress: () => {
            setLockedDays((prev) => (prev.includes(today) ? prev : [today, ...prev]));
            const text = reportText();
            Share.share({ message: text }).catch(() => {
              Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
                Alert.alert("דו״ח Z", text)
              );
            });
          },
        },
      ]
    );
  };

  const shareReport = () => {
    const text = reportText();
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
      Share.share({ message: text }).catch(() => Alert.alert("דו״ח Z", text))
    );
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.title}>דו״ח Z — סוף יום</Text>
      </View>

      {locked && (
        <View style={styles.lockedBadge}>
          <Text style={styles.lockedText}>🔒 היום נעול — הרשומות סופיות</Text>
        </View>
      )}

      {/* Totals grid */}
      <View style={styles.grid}>
        <Stat label="מכירות" value={String(report.txns)} bg={COLORS.white} />
        <Stat label="יחידות" value={String(report.units)} bg={COLORS.white} />
      </View>
      <View style={styles.grid}>
        <Stat label="הכנסות" value={shekel(report.revenue)} bg={COLORS.navy} light />
        <Stat label="רווח" value={shekel(report.profit)} bg={COLORS.success} light />
      </View>
      {report.loss > 0 && (
        <View style={styles.lossCard}>
          <Text style={styles.lossText}>אובדן/נזק היום: {shekel(report.loss)}</Text>
        </View>
      )}

      {/* Category breakdown */}
      {CATEGORIES.some((c) => report.byCat[c.key]) && (
        <View style={styles.catCard}>
          <Text style={styles.catTitle}>פילוח לפי קטגוריה</Text>
          {CATEGORIES.filter((c) => report.byCat[c.key]).map((c) => (
            <View key={c.key} style={styles.catRow}>
              <Text style={styles.catValue}>{shekel(report.byCat[c.key])}</Text>
              <View style={styles.catNameWrap}>
                <View style={[styles.catDot, { backgroundColor: catOf(c.key).color }]} />
                <Text style={styles.catName}>{c.label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {locked ? (
        <TouchableOpacity style={styles.shareBtn} onPress={shareReport} activeOpacity={0.85}>
          <Text style={styles.shareText}>💬 שתף דו״ח שוב</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.closeBtn} onPress={closeDay} activeOpacity={0.9}>
          <Text style={styles.closeText}>🔒 סגור יום והפק דו״ח Z</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Stat({ label, value, bg, light }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <Text style={[styles.statLabel, light && { color: "#FFFFFF" }]}>{label}</Text>
      <Text style={[styles.statValue, light && { color: "#FFFFFF" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  date: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold },
  title: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold },
  lockedBadge: { backgroundColor: COLORS.danger, borderRadius: RADIUS, padding: 12, marginBottom: 14, ...BRUTAL_BORDER },
  lockedText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold, textAlign: "center" },
  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stat: { flex: 1, borderRadius: RADIUS, padding: 14, alignItems: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  statLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.medium },
  statValue: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold, marginTop: 4 },
  lossCard: { backgroundColor: "#FBE3E3", borderColor: COLORS.danger, borderRadius: RADIUS, padding: 10, marginBottom: 10, ...BRUTAL_BORDER },
  lossText: { color: COLORS.danger, fontSize: 14, fontFamily: FONTS.bold, textAlign: "center" },
  catCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginTop: 4, marginBottom: 14, ...BRUTAL_BORDER },
  catTitle: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 10 },
  catRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catValue: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold },
  catNameWrap: { flexDirection: "row", alignItems: "center" },
  catDot: { width: 14, height: 14, borderRadius: 4, marginStart: 8, ...BRUTAL_BORDER },
  catName: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, marginStart: 8 },
  closeBtn: { height: 64, borderRadius: RADIUS, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  closeText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  shareBtn: { height: 54, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  shareText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
});
