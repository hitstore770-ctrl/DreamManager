import { useMemo, useState } from "react";
import {
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Polyline } from "react-native-svg";

import { useAuth } from "../context/AuthContext";
import { useDreams } from "../context/DreamContext";
import { useSettings } from "../context/SettingsContext";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { LOW_STOCK, shekel, todayKey } from "../utils/posStore";
import { FONTS, RADIUS, RADIUS_LG, RADIUS_SM, SHADOW, SHADOW_SM } from "../utils/theme";
import { usePersistentState } from "../utils/usePersistentState";

const DASH_NOTES = "@dreammanager/dashboard-notes";
const NOTE_TINTS = ["#FFF4CC", "#D7EEFF", "#E4F8E4", "#FCE1EC", "#EDE6FF"];

// Build the last-N local day keys ending today.
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

export default function DashboardScreen({ navigation }) {
  const { theme, fontScale, censor, haptic } = useSettings();
  const { user } = useAuth();
  const { dreams } = useDreams();
  const insets = useSafeAreaInsets();

  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [inventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [suppliers] = usePersistentState(STORAGE_KEYS.posSuppliers, []);
  const [notes, setNotes] = usePersistentState(DASH_NOTES, []);

  const [editing, setEditing] = useState(null); // { id?, text }

  const today = todayKey();
  const hour = new Date().getHours();
  const isMorning = hour < 12;

  // ---- Derived business stats --------------------------------------------
  const stats = useMemo(() => {
    const realSales = (sales || []).filter((s) => s.kind === "sale");
    const todays = realSales.filter((s) => s.day === today);
    const revenue = todays.reduce((a, s) => a + (s.total || 0), 0);
    const profit = todays.reduce((a, s) => a + (s.profit || 0), 0);

    const days = lastDays(7);
    const byDay = days.map((d) =>
      realSales.filter((s) => s.day === d).reduce((a, s) => a + (s.total || 0), 0)
    );

    // Consecutive-day sales streak ending today/yesterday.
    const saleDays = new Set(realSales.map((s) => s.day));
    let streak = 0;
    for (let i = 0; i < 400; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (saleDays.has(todayKey(d))) streak += 1;
      else if (i === 0) continue; // today not sold yet — keep counting from yesterday
      else break;
    }

    return { revenue, profit, txns: todays.length, byDay, streak };
  }, [sales, today]);

  // ---- Smart alerts (only actionable ones) --------------------------------
  const alerts = useMemo(() => {
    const out = [];
    (inventory || []).forEach((i) => {
      if (i.qty > 0 && i.qty <= LOW_STOCK) out.push({ icon: "", text: `מלאי נמוך: ${i.name} (${i.qty})`, to: "inventory"});
      if (i.qty === 0) out.push({ icon: "", text: `אזל מהמלאי: ${i.name}`, to: "inventory"});
    });
    (suppliers || []).forEach((sup) => {
      (sup.orders || []).forEach((o) => {
        if (o.arrived) return;
        const days = Math.floor((Date.now() - (o.placedAt || Date.now())) / 86400000);
        if (days > 30) out.push({ icon: "", text: `הזמנה מ${sup.name} מתעכבת (${days} ימים)`, to: "suppliers"});
      });
    });
    return out.slice(0, 4);
  }, [inventory, suppliers]);

  // ---- Sticky notes -------------------------------------------------------
  const saveNote = () => {
    const text = (editing?.text || "").trim();
    if (!text) {
      setEditing(null);
      return;
    }
    haptic("light");
    if (editing.id) {
      setNotes((prev) => prev.map((n) => (n.id === editing.id ? { ...n, text } : n)));
    } else {
      setNotes((prev) => [{ id: `${Date.now()}`, text, tint: prev.length % NOTE_TINTS.length }, ...prev]);
    }
    setEditing(null);
  };
  const deleteNote = (id) => {
    haptic("light");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const quickActions = [
    { icon: "", label: "מכירה מהירה", to: "pos"},
    { icon: "", label: "הקפה חדשה", to: "debts"},
    { icon: "", label: "פריט חדש", to: "inventory"},
    { icon: "", label: "סריקת ברקוד", to: "barcode"},
    { icon: "", label: "דו״ח Z", to: "zreport"},
  ];

  const s = makeStyles(theme, fontScale);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.menuBtn}
            onPress={() => navigation.openDrawer()}
            activeOpacity={0.7}
          >
 <Text style={s.menuIcon}></Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>
              {isMorning ? "בוקר טוב": hour < 18 ? "צהריים טובים": "ערב טוב"}, {user?.displayName ?? "אלוף"}
            </Text>
            <Text style={s.subHello}>{isMorning ? "יאללה, קדימה ליעדים של היום" : "בוא נראה איך העסק זז היום"}</Text>
          </View>
        </View>

        {/* Quick actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickRow}
          style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}
        >
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.to}
              style={[s.quickItem, { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }]}
              activeOpacity={0.8}
              onPress={() => {
                haptic("light");
                navigation.navigate(a.to);
              }}
            >
              <View style={s.quickCircle}>
                <Text style={s.quickIcon}>{a.icon}</Text>
              </View>
              <Text style={s.quickLabel} numberOfLines={1}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Smart alerts (only if actionable) */}
        {alerts.length > 0 && (
          <View style={s.alertCard}>
 <Text style={s.alertTitle}> דורש טיפול</Text>
            {alerts.map((al, i) => (
              <TouchableOpacity
                key={i}
                style={s.alertRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate(al.to)}
              >
                <Text style={s.alertIcon}>{al.icon}</Text>
                <Text style={s.alertText}>{al.text}</Text>
                <Text style={s.alertArrow}>‹</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Dynamic context widget */}
        {isMorning ? (
          <View style={[s.card, s.contextCard]}>
            <Text style={s.cardKicker}>המיקוד של הבוקר</Text>
 <Text style={s.cardTitle}> היעדים שלך</Text>
            {dreams.slice(0, 2).map((d) => {
              const pct = d.target ? Math.min(100, Math.round((d.current / d.target) * 100)) : 0;
              return (
                <View key={d.id} style={{ marginTop: 12 }}>
                  <Text style={s.goalName} numberOfLines={1}>{d.title}</Text>
                  <ProgressBar pct={pct} theme={theme} />
                </View>
              );
            })}
            {dreams.length === 0 && <Text style={s.muted}>אין יעדים עדיין — הוסף אחד עם ה־+</Text>}
          </View>
        ) : (
          <View style={[s.card, s.contextCard]}>
            <Text style={s.cardKicker}>הנתונים של היום</Text>
            <View style={s.statRow}>
              <Stat label="הכנסה" value={censor(shekel(stats.revenue))} theme={theme} fontScale={fontScale} accent />
              <Stat label="רווח" value={censor(shekel(stats.profit))} theme={theme} fontScale={fontScale} />
              <Stat label="עסקאות" value={censor(String(stats.txns))} theme={theme} fontScale={fontScale} />
            </View>
          </View>
        )}

        {/* Business pulse — 7-day revenue */}
        <View style={s.card}>
          <View style={s.pulseHead}>
 <Text style={s.cardTitle}> דופק העסק</Text>
            <View style={s.streakPill}>
 <Text style={s.streakText}> {stats.streak} ימים</Text>
            </View>
          </View>
          <Text style={s.cardKicker}>מגמת הכנסות — 7 ימים אחרונים</Text>
          <Sparkline data={stats.byDay} theme={theme} />
          <Text style={s.pulseTotal}>
            סה״כ השבוע: {censor(shekel(stats.byDay.reduce((a, b) => a + b, 0)))}
          </Text>
        </View>

        {/* Gamified goals */}
        <View style={s.sectionHead}>
 <Text style={s.sectionTitle}> היעדים שלי</Text>
          <TouchableOpacity onPress={() => navigation.navigate("AddDream")} activeOpacity={0.7}>
            <Text style={s.sectionAction}>+ חדש</Text>
          </TouchableOpacity>
        </View>
        {dreams.map((d) => {
          const pct = d.target ? Math.min(100, Math.round((d.current / d.target) * 100)) : 0;
          const doneTasks = (d.tasks || []).filter((t) => t.isCompleted).length;
          return (
            <TouchableOpacity
              key={d.id}
              style={[s.card, s.goalCard]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("DreamDetail", { id: d.id })}
            >
              <View style={s.goalHead}>
                <Text style={s.goalTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={s.goalPct}>{pct}%</Text>
              </View>
              <ProgressBar pct={pct} theme={theme} />
              <View style={s.goalMeta}>
                <Text style={s.goalMetaText}>
                  {d.type === "money" ? censor(`${shekel(d.current)} / ${shekel(d.target)}`) : `${d.current}/${d.target}`}
                </Text>
                {doneTasks > 0 && <Text style={s.goalMetaText}> {doneTasks} משימות</Text>}
                {pct >= 100 && <Text style={[s.goalMetaText, { color: theme.success }]}> הושלם!</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Sticky notes grid */}
        <View style={s.sectionHead}>
 <Text style={s.sectionTitle}> פתקים מהירים</Text>
          <TouchableOpacity onPress={() => setEditing({ text: "" })} activeOpacity={0.7}>
            <Text style={s.sectionAction}>+ פתק</Text>
          </TouchableOpacity>
        </View>
        <View style={s.notesGrid}>
          {notes.map((n) => (
            <Swipeable
              key={n.id}
              renderRightActions={() => (
                <Pressable style={s.noteDelete} onPress={() => deleteNote(n.id)}>
                  <Text style={s.noteDeleteText}>מחק</Text>
                </Pressable>
              )}
              renderLeftActions={() => (
                <Pressable style={s.noteDelete} onPress={() => deleteNote(n.id)}>
                  <Text style={s.noteDeleteText}>מחק</Text>
                </Pressable>
              )}
            >
              <TouchableOpacity
                style={[s.note, { backgroundColor: NOTE_TINTS[n.tint ?? 0] }]}
                activeOpacity={0.85}
                onPress={() => setEditing({ id: n.id, text: n.text })}
                onLongPress={() => deleteNote(n.id)}
              >
                <Text style={s.noteText}>{n.text}</Text>
              </TouchableOpacity>
            </Swipeable>
          ))}
          {notes.length === 0 && (
            <Text style={s.muted}>אין פתקים. הקש על ״+ פתק״. החלק פתק הצידה כדי למחוק.</Text>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 24 }, I18nManager.isRTL ? { left: 22 } : { right: 22 }]}
        activeOpacity={0.85}
        onPress={() => {
          haptic("light");
          setEditing({ text: "" });
        }}
      >
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Note editor — tap outside to close */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <TouchableWithoutFeedback onPress={() => setEditing(null)}>
          <View style={s.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{editing?.id ? "עריכת פתק" : "פתק חדש"}</Text>
                <TextInput
                  style={s.modalInput}
                  value={editing?.text}
                  onChangeText={(t) => setEditing((e) => ({ ...e, text: t }))}
                  placeholder="כתוב כאן..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  autoFocus
                  textAlign="right"
                />
                <View style={s.modalActions}>
                  <TouchableOpacity style={[s.modalBtn, { backgroundColor: theme.surfaceMuted }]} onPress={() => setEditing(null)}>
                    <Text style={[s.modalBtnText, { color: theme.textSecondary }]}>ביטול</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalBtn, { backgroundColor: theme.accent }]} onPress={saveNote}>
                    <Text style={[s.modalBtnText, { color: "#FFF" }]}>שמור</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function ProgressBar({ pct, theme }) {
  return (
    <View style={{ height: 10, borderRadius: 6, backgroundColor: theme.surfaceMuted, overflow: "hidden", marginTop: 8 }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: theme.accent, borderRadius: 6 }} />
    </View>
  );
}

function Stat({ label, value, theme, fontScale, accent }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: accent ? theme.accent : theme.textPrimary, fontSize: 20 * fontScale, fontFamily: FONTS.bold }}>
        {value}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 12 * fontScale, fontFamily: FONTS.medium, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// Tiny SVG sparkline of the 7-day revenue.
function Sparkline({ data, theme }) {
  const W = 280;
  const H = 70;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((v, i) => `${i * step},${H - (v / max) * (H - 10) - 5}`).join(" ");
  const last = data.length ? data[data.length - 1] : 0;
  return (
    <View style={{ marginTop: 14, alignItems: "center" }}>
      <Svg width={W} height={H}>
        <Polyline points={pts} fill="none" stroke={theme.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => (
          <Circle
            key={i}
            cx={i * step}
            cy={H - (v / max) * (H - 10) - 5}
            r={i === data.length - 1 ? 4.5 : 2.5}
            fill={i === data.length - 1 ? theme.accent : theme.surface}
            stroke={theme.accent}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
}

function makeStyles(t, fs) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, marginBottom: 18, gap: 12 },
    menuBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    menuIcon: { fontSize: 20, color: t.textPrimary, fontFamily: FONTS.bold },
    hello: { color: t.textPrimary, fontSize: 20 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    subHello: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.regular, textAlign: "right", marginTop: 2 },

    quickRow: { paddingHorizontal: 18, gap: 14, paddingVertical: 2 },
    quickItem: { alignItems: "center", width: 74 },
    quickCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    quickIcon: { fontSize: 26 },
    quickLabel: { color: t.textSecondary, fontSize: 11 * fs, fontFamily: FONTS.medium, marginTop: 6, textAlign: "center" },

    card: { backgroundColor: t.surface, marginHorizontal: 18, marginTop: 16, borderRadius: RADIUS, padding: 18, ...SHADOW },
    contextCard: {},
    cardKicker: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    cardTitle: { color: t.textPrimary, fontSize: 17 * fs, fontFamily: FONTS.bold, textAlign: "right", marginTop: 2 },

    statRow: { flexDirection: "row", marginTop: 14 },

    alertCard: {
      backgroundColor: t.scheme === "dark" ? "#2A1E12" : "#FFF7E8",
      marginHorizontal: 18, marginTop: 16, borderRadius: RADIUS, padding: 16,
      borderWidth: 1, borderColor: t.warning + "55", ...SHADOW_SM,
    },
    alertTitle: { color: t.warning, fontSize: 14 * fs, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 8 },
    alertRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7 },
    alertIcon: { fontSize: 18, marginEnd: 10 },
    alertText: { flex: 1, color: t.textPrimary, fontSize: 14 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    alertArrow: { color: t.textMuted, fontSize: 22, fontFamily: FONTS.bold },

    goalName: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    muted: { color: t.textMuted, fontSize: 13 * fs, fontFamily: FONTS.regular, textAlign: "right", marginTop: 10 },

    pulseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    streakPill: { backgroundColor: t.accent + "1A", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
    streakText: { color: t.accent, fontSize: 13 * fs, fontFamily: FONTS.bold },
    pulseTotal: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.medium, textAlign: "right", marginTop: 10 },

    sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, marginTop: 26, marginBottom: 4 },
    sectionTitle: { color: t.textPrimary, fontSize: 18 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    sectionAction: { color: t.accent, fontSize: 14 * fs, fontFamily: FONTS.bold },

    goalCard: { marginTop: 12 },
    goalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    goalTitle: { flex: 1, color: t.textPrimary, fontSize: 15 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    goalPct: { color: t.accent, fontSize: 15 * fs, fontFamily: FONTS.bold, marginStart: 10 },
    goalMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 },
    goalMetaText: { color: t.textSecondary, fontSize: 12 * fs, fontFamily: FONTS.medium },

    notesGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginTop: 10 },
    note: { width: "46%", minHeight: 92, margin: "2%", borderRadius: RADIUS_SM, padding: 14, ...SHADOW_SM },
    noteText: { color: "#3A2E00", fontSize: 14, fontFamily: FONTS.medium, textAlign: "right" },
    noteDelete: { backgroundColor: t.danger, justifyContent: "center", alignItems: "center", width: 74, margin: "2%", borderRadius: RADIUS_SM },
    noteDeleteText: { color: "#FFF", fontFamily: FONTS.bold, fontSize: 14 },

    fab: {
      position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent,
      alignItems: "center", justifyContent: "center", ...SHADOW,
    },
    fabIcon: { color: "#FFF", fontSize: 34, fontFamily: FONTS.bold, marginTop: -4 },

    modalBackdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "center", paddingHorizontal: 28 },
    modalCard: { backgroundColor: t.surface, borderRadius: RADIUS_LG, padding: 20, ...SHADOW },
    modalTitle: { color: t.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 14 },
    modalInput: {
      backgroundColor: t.surfaceAlt, borderRadius: RADIUS_SM, padding: 14, minHeight: 90,
      color: t.textPrimary, fontSize: 15, fontFamily: FONTS.regular, textAlignVertical: "top",
      borderWidth: 1, borderColor: t.hairline,
    },
    modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
    modalBtn: { flex: 1, height: 48, borderRadius: RADIUS_SM, alignItems: "center", justifyContent: "center" },
    modalBtnText: { fontSize: 15, fontFamily: FONTS.bold },
  });
}
