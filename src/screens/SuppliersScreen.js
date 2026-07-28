import { useMemo, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { FLUID, listEntry } from "../utils/motion";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { uid } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";
import CustomText from "../components/CustomText";

// ספקים — the supplier book: who you buy from, how good they are, and which
// orders are still in transit. An order past DELAY_LIMIT days flags itself in
// coral so a stuck shipment is impossible to miss.

const DAY_MS = 86400000;
const DELAY_LIMIT = 30;

function daysSince(ts) {
  return Math.floor((Date.now() - ts) / DAY_MS);
}

// Accepts YYYY-MM-DD only; anything else means "no ETA given".
function daysToEta(eta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eta || "")) return null;
  const t = new Date(eta).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / DAY_MS);
}

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = usePersistentState(STORAGE_KEYS.posSuppliers, []);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState({});

  const list = suppliers || [];

  const totals = useMemo(() => {
    const open = list.reduce((n, s) => n + (s.orders || []).filter((o) => !o.arrived).length, 0);
    const late = list.reduce(
      (n, s) =>
        n + (s.orders || []).filter((o) => !o.arrived && daysSince(o.placedAt) > DELAY_LIMIT).length,
      0
    );
    return { open, late };
  }, [list]);

  const addSupplier = () => {
    const clean = name.trim();
    if (!clean) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    setSuppliers((prev) => [{ id: uid(), name: clean, rating: 0, orders: [] }, ...(prev || [])]);
    setName("");
  };

  const removeSupplier = (id) => {
    hapticWarning();
    setSuppliers((prev) => (prev || []).filter((s) => s.id !== id));
  };

  const setRating = (id, rating) => {
    hapticLight();
    setSuppliers((prev) => (prev || []).map((s) => (s.id === id ? { ...s, rating } : s)));
  };

  const setDraft = (id, field, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [field]: value } }));

  const addOrder = (id) => {
    const draft = drafts[id] || {};
    const desc = (draft.desc || "").trim();
    if (!desc) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    setSuppliers((prev) =>
      (prev || []).map((s) =>
        s.id === id
          ? {
              ...s,
              orders: [
                { id: uid(), desc, eta: (draft.eta || "").trim(), placedAt: Date.now(), arrived: false },
                ...(s.orders || []),
              ],
            }
          : s
      )
    );
    setDrafts((d) => ({ ...d, [id]: { desc: "", eta: "" } }));
  };

  const markArrived = (sid, oid) => {
    hapticSuccess();
    setSuppliers((prev) =>
      (prev || []).map((s) =>
        s.id === sid
          ? { ...s, orders: (s.orders || []).map((o) => (o.id === oid ? { ...o, arrived: true } : o)) }
          : s
      )
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 110 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Summary + new supplier */}
      <View style={s.card}>
        <View style={s.summaryRow}>
          <Metric value={list.length} label="ספקים" />
          <Metric value={totals.open} label="הזמנות בדרך" color={UI.violet} />
          <Metric value={totals.late} label="בעיכוב" color={totals.late ? UI.coral : UI.inkMuted} />
        </View>

        <View style={s.formRow}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="שם ספק חדש"
            placeholderTextColor={UI.inkMuted}
            textAlign="right"
            onSubmitEditing={addSupplier}
            returnKeyType="done"
          />
          <Bounce style={s.addBtn} onPress={addSupplier} scaleTo={0.92}>
            <Icon name="plus" size={20} color="#FFFFFF" />
          </Bounce>
        </View>
      </View>

      {list.length === 0 ? (
        <Animated.View entering={FadeIn.duration(280)} style={[s.card, s.empty]}>
          <View style={s.emptyBadge}>
            <Icon name="truck" size={30} color={UI.violet} />
          </View>
          <CustomText style={s.emptyTitle}>אין ספקים רשומים</CustomText>
          <CustomText style={s.emptyHint}>הוסף ספק כדי לעקוב אחרי הזמנות בדרך ואיחורים.</CustomText>
        </Animated.View>
      ) : (
        list.map((sup, index) => {
          const orders = sup.orders || [];
          const inTransit = orders.filter((o) => !o.arrived);
          const arrived = orders.filter((o) => o.arrived).length;
          const draft = drafts[sup.id] || {};
          return (
            <Animated.View key={sup.id} entering={listEntry(index)} layout={FLUID} style={s.card}>
              <View style={s.cardHead}>
                <Bounce style={s.del} onPress={() => removeSupplier(sup.id)} scaleTo={0.9}>
                  <Icon name="x" size={15} color={UI.inkMuted} />
                </Bounce>
                <View style={{ flex: 1 }}>
                  <CustomText style={s.supName} numberOfLines={1}>{sup.name}</CustomText>
                  <CustomText style={s.supMeta}>
                    {inTransit.length} בדרך{arrived ? ` · ${arrived} הגיעו` : ""}
                  </CustomText>
                </View>
                <View style={s.supBadge}>
                  <Icon name="truck" size={18} color={UI.violet} />
                </View>
              </View>

              {/* Rating */}
              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Bounce key={n} onPress={() => setRating(sup.id, n)} scaleTo={0.85} style={s.starHit}>
                    <Icon name="star" size={19} color={n <= (sup.rating || 0) ? UI.cyan : "#DDE2EC"} />
                  </Bounce>
                ))}
              </View>

              <CustomText style={s.subTitle}>הזמנות בדרך</CustomText>
              {inTransit.length === 0 ? (
                <CustomText style={s.noneText}>אין הזמנות פתוחות</CustomText>
              ) : (
                inTransit.map((o) => {
                  const passed = daysSince(o.placedAt);
                  const eta = daysToEta(o.eta);
                  const delayed = passed > DELAY_LIMIT;
                  return (
                    <Animated.View
                      key={o.id}
                      layout={FLUID}
                      style={[s.orderRow, delayed && s.orderDelayed]}
                    >
                      <Bounce style={s.arrivedBtn} onPress={() => markArrived(sup.id, o.id)} scaleTo={0.93}>
                        <Icon name="check" size={15} color="#FFFFFF" />
                        <CustomText style={s.arrivedText}>הגיע</CustomText>
                      </Bounce>
                      <View style={{ flex: 1 }}>
                        <CustomText style={s.orderDesc} numberOfLines={2}>{o.desc}</CustomText>
                        <CustomText style={s.orderMeta}>
                          עברו {passed} ימים
                          {eta != null
                            ? ` · יעד: ${eta >= 0 ? `בעוד ${eta} ימים` : `באיחור ${-eta} ימים`}`
                            : ""}
                        </CustomText>
                        {delayed && (
                          <View style={s.delayRow}>
                            <Icon name="alert-triangle" size={12} color={UI.coral} />
                            <CustomText style={s.delayText}>עיכוב מעל {DELAY_LIMIT} יום</CustomText>
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}

              {/* New order */}
              <View style={s.orderForm}>
                <Bounce style={s.orderAddBtn} onPress={() => addOrder(sup.id)} scaleTo={0.92}>
                  <Icon name="plus" size={18} color="#FFFFFF" />
                </Bounce>
                <TextInput
                  style={[s.input, s.etaInput]}
                  value={draft.eta || ""}
                  onChangeText={(v) => setDraft(sup.id, "eta", v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={UI.inkMuted}
                  textAlign="center"
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={draft.desc || ""}
                  onChangeText={(v) => setDraft(sup.id, "desc", v)}
                  placeholder="תיאור הזמנה"
                  placeholderTextColor={UI.inkMuted}
                  textAlign="right"
                />
              </View>
            </Animated.View>
          );
        })
      )}
    </ScrollView>
  );
}

function Metric({ value, label, color = UI.ink }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <CustomText style={[s.metricValue, { color }]}>{value}</CustomText>
      <CustomText style={s.metricLabel}>{label}</CustomText>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginBottom: UI.cardMarginB,
    ...CARD_SHADOW,
  },

  summaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  metricValue: { fontFamily: FONTS.bold, fontSize: TYPE.metric },
  metricLabel: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, marginTop: 2 },

  formRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    backgroundColor: UI.surfaceAlt,
    borderRadius: UI.radiusSm,
    minHeight: 50,
    paddingHorizontal: 14,
    color: UI.ink,
    fontSize: TYPE.body,
    fontFamily: FONTS.regular,
  },
  etaInput: { width: 128 },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },

  cardHead: { flexDirection: ROW, alignItems: "center", gap: 12 },
  supBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  supName: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  supMeta: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  del: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: UI.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  stars: { flexDirection: "row", justifyContent: "flex-end", gap: 2, marginTop: 12 },
  starHit: { padding: 4 },

  subTitle: { fontFamily: FONTS.bold, fontSize: TYPE.section, color: UI.ink, textAlign: "right", marginTop: 14, marginBottom: 8 },
  noneText: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right" },

  orderRow: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 12,
    backgroundColor: UI.surfaceAlt,
    borderRadius: UI.radiusSm,
    padding: 12,
    marginBottom: 8,
  },
  orderDelayed: { backgroundColor: UI.coral + "12" },
  orderDesc: { fontFamily: FONTS.semibold, fontSize: TYPE.body, color: UI.ink, textAlign: "right" },
  orderMeta: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkSoft, textAlign: "right", marginTop: 3 },
  delayRow: { flexDirection: ROW, alignItems: "center", gap: 5, marginTop: 5 },
  delayText: { fontFamily: FONTS.bold, fontSize: TYPE.caption, color: UI.coral },
  arrivedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.green,
    justifyContent: "center",
  },
  arrivedText: { color: "#FFFFFF", fontSize: TYPE.caption, fontFamily: FONTS.bold },

  orderForm: { flexDirection: ROW, gap: 8, alignItems: "center", marginTop: 10 },
  orderAddBtn: {
    width: 46,
    height: 46,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingVertical: 34, gap: 10 },
  emptyBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: UI.violet + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink },
  emptyHint: { fontFamily: FONTS.regular, fontSize: TYPE.body, color: UI.inkSoft, textAlign: "center", lineHeight: 21 },
});
