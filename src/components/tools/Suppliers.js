import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { uid } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const DAY_MS = 86400000;
const DELAY_LIMIT = 30;

function daysSince(ts) {
  return Math.floor((Date.now() - ts) / DAY_MS);
}
function daysToEta(eta) {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(eta || "");
  if (!m) return null;
  return Math.ceil((new Date(eta).getTime() - Date.now()) / DAY_MS);
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = usePersistentState(STORAGE_KEYS.posSuppliers, []);
  const [name, setName] = useState("");
  const [orderDraft, setOrderDraft] = useState({}); // supplierId -> {desc, eta}

  const addSupplier = () => {
    if (!name.trim()) {
      Alert.alert("שם חסר", "נא להזין שם ספק");
      return;
    }
    setSuppliers((prev) => [{ id: uid(), name: name.trim(), rating: 0, orders: [] }, ...prev]);
    setName("");
  };

  const removeSupplier = (id) => setSuppliers((prev) => prev.filter((s) => s.id !== id));
  const setRating = (id, r) =>
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, rating: r } : s)));

  const setDraft = (id, field, val) =>
    setOrderDraft((d) => ({ ...d, [id]: { ...(d[id] || {}), [field]: val } }));

  const addOrder = (id) => {
    const draft = orderDraft[id] || {};
    if (!draft.desc?.trim()) {
      Alert.alert("תיאור חסר", "נא לתאר את ההזמנה");
      return;
    }
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              orders: [
                { id: uid(), desc: draft.desc.trim(), eta: (draft.eta || "").trim(), placedAt: Date.now(), arrived: false },
                ...s.orders,
              ],
            }
          : s
      )
    );
    setOrderDraft((d) => ({ ...d, [id]: { desc: "", eta: "" } }));
  };

  const markArrived = (sid, oid) =>
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === sid ? { ...s, orders: s.orders.map((o) => (o.id === oid ? { ...o, arrived: true } : o)) } : s
      )
    );

  return (
    <View>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="שם ספק חדש"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addSupplier} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {suppliers.length === 0 ? (
        <Text style={styles.empty}>אין ספקים רשומים</Text>
      ) : (
        suppliers.map((s) => {
          const inTransit = s.orders.filter((o) => !o.arrived);
          const draft = orderDraft[s.id] || {};
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardHead}>
                <TouchableOpacity style={styles.del} onPress={() => removeSupplier(s.id)}>
                  <Text style={styles.delText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.supName}>{s.name}</Text>
              </View>

              {/* Star rating */}
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(s.id, n)}>
                    <Text style={[styles.star, n <= s.rating && styles.starOn]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Orders in transit */}
              <Text style={styles.subTitle}>הזמנות בדרך ({inTransit.length})</Text>
              {inTransit.length === 0 ? (
                <Text style={styles.noneText}>אין הזמנות פתוחות</Text>
              ) : (
                inTransit.map((o) => {
                  const passed = daysSince(o.placedAt);
                  const eta = daysToEta(o.eta);
                  const delayed = passed > DELAY_LIMIT;
                  return (
                    <View key={o.id} style={[styles.orderRow, delayed && styles.orderDelayed]}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderDesc}>{o.desc}</Text>
                        <Text style={styles.orderMeta}>
                          עברו {passed} ימים
                          {eta != null ? ` · יעד: ${eta >= 0 ? `בעוד ${eta} ימים` : `באיחור ${-eta} ימים`}` : ""}
                        </Text>
                        {delayed && <Text style={styles.delayAlert}>⚠️ עיכוב מעל 30 יום!</Text>}
                      </View>
                      <TouchableOpacity style={styles.arrivedBtn} onPress={() => markArrived(s.id, o.id)} activeOpacity={0.85}>
                        <Text style={styles.arrivedText}>✓ הגיע</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {/* Add order */}
              <View style={styles.orderForm}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={draft.desc || ""}
                  onChangeText={(v) => setDraft(s.id, "desc", v)}
                  placeholder="תיאור הזמנה"
                  placeholderTextColor={COLORS.textMuted}
                  textAlign="right"
                />
                <TextInput
                  style={[styles.input, styles.etaInput]}
                  value={draft.eta || ""}
                  onChangeText={(v) => setDraft(s.id, "eta", v)}
                  placeholder="יעד YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  textAlign="center"
                />
                <TouchableOpacity style={styles.orderAddBtn} onPress={() => addOrder(s.id)} activeOpacity={0.85}>
                  <Text style={styles.addBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { flexDirection: "row", gap: 8, marginBottom: 16, alignItems: "center" },
  input: { backgroundColor: COLORS.white, borderRadius: RADIUS, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.regular, marginBottom: 10, ...BRUTAL_BORDER },
  addBtn: { width: 48, height: 46, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", marginBottom: 10, ...BRUTAL_BORDER },
  addBtnText: { color: "#FFFFFF", fontSize: 22, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  cardHead: { flexDirection: "row", alignItems: "center" },
  del: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  delText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  supName: { flex: 1, color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, textAlign: "right", marginHorizontal: 10 },
  stars: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 8, marginBottom: 4 },
  star: { color: "#D9D9D9", fontSize: 26, fontFamily: FONTS.bold },
  starOn: { color: COLORS.mustard },
  subTitle: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginTop: 10, marginBottom: 8 },
  noneText: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONTS.regular, textAlign: "right", marginBottom: 8 },
  orderRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 10, marginBottom: 8, ...BRUTAL_BORDER },
  orderDelayed: { backgroundColor: "#FFF3CD", borderColor: COLORS.mustard, borderWidth: 3 },
  orderInfo: { flex: 1 },
  orderDesc: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right" },
  orderMeta: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.medium, textAlign: "right", marginTop: 2 },
  delayAlert: { color: "#8A6D00", fontSize: 12, fontFamily: FONTS.bold, textAlign: "right", marginTop: 4 },
  arrivedBtn: { paddingHorizontal: 12, height: 40, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", marginStart: 8, ...BRUTAL_BORDER },
  arrivedText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  orderForm: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 6 },
  etaInput: { width: 130, marginBottom: 0 },
  orderAddBtn: { width: 44, height: 44, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
});
