import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { makeSale, shekel, todayKey, uid } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

// posEvents shape: { current: {id, startedAt, cart:[{itemId,name,qty,price}]} | null, history:[...] }
const INIT = { current: null, history: [] };

export default function SalesEvent() {
  const [inventory, setInventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [sales, setSales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [events, setEvents] = usePersistentState(STORAGE_KEYS.posEvents, INIT);

  const [qtyById, setQtyById] = useState({});
  const [actualCash, setActualCash] = useState("");

  const current = events.current;

  const cartTotals = useMemo(() => {
    if (!current) return { total: 0, count: 0, best: null };
    let total = 0;
    let count = 0;
    let best = null;
    current.cart.forEach((line) => {
      total += line.price * line.qty;
      count += line.qty;
      if (!best || line.qty > best.qty) best = line;
    });
    return { total, count, best };
  }, [current]);

  const startEvent = () => {
    setEvents((prev) => ({
      ...prev,
      current: { id: uid(), startedAt: Date.now(), cart: [] },
    }));
  };

  const addToCart = (item) => {
    const qty = parseInt(qtyById[item.id], 10) || 1;
    setEvents((prev) => {
      if (!prev.current) return prev;
      const cart = [...prev.current.cart];
      const idx = cart.findIndex((l) => l.itemId === item.id);
      if (idx >= 0) cart[idx] = { ...cart[idx], qty: cart[idx].qty + qty };
      else cart.push({ itemId: item.id, name: item.name, qty, price: item.price });
      return { ...prev, current: { ...prev.current, cart } };
    });
    setQtyById((q) => ({ ...q, [item.id]: "" }));
  };

  const removeLine = (itemId) =>
    setEvents((prev) => ({
      ...prev,
      current: { ...prev.current, cart: prev.current.cart.filter((l) => l.itemId !== itemId) },
    }));

  const summaryText = (ev, total, actual) => {
    const lines = ev.cart.map((l) => `• ${l.name} × ${l.qty} = ${shekel(l.price * l.qty)}`);
    const variance = (Number(actual) || 0) - total;
    return (
      `📊 סיכום אירוע — ${todayKey(new Date(ev.startedAt))}\n\n` +
      `${lines.join("\n")}\n\n` +
      `סה״כ מכירות: ${shekel(total)}\n` +
      `קופה בפועל: ${shekel(Number(actual) || 0)}\n` +
      `הפרש: ${shekel(variance)} ${variance === 0 ? "✓" : variance > 0 ? "(עודף)" : "(חוסר)"}`
    );
  };

  const endEvent = () => {
    if (!current) return;
    if (current.cart.length === 0) {
      Alert.alert("אין מכירות", "לא נרשמו מכירות באירוע");
      return;
    }
    const total = cartTotals.total;
    const actual = Number(actualCash) || 0;
    // Auto-deduct all sold items from master inventory + log sales.
    let inv = inventory;
    const newSales = [];
    current.cart.forEach((line) => {
      const item = inv.find((i) => i.id === line.itemId);
      if (item) {
        inv = inv.map((i) =>
          i.id === line.itemId
            ? { ...i, qty: Math.max(0, i.qty - line.qty), sold: (i.sold || 0) + line.qty }
            : i
        );
        newSales.push(makeSale(item, line.qty, line.price, "sale", current.id));
      }
    });
    setInventory(inv);
    setSales((prev) => [...newSales, ...prev]);

    const record = {
      ...current,
      endedAt: Date.now(),
      total,
      actualCash: actual,
      variance: actual - total,
      best: cartTotals.best,
    };
    setEvents((prev) => ({ current: null, history: [record, ...prev.history] }));

    const text = summaryText(current, total, actual);
    Share.share({ message: text }).catch(() => {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
        Alert.alert("סיכום", text)
      );
    });
    setActualCash("");
  };

  const shareSummary = (rec) => {
    const text = summaryText(rec, rec.total, rec.actualCash);
    const wa = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(wa).catch(() =>
      Share.share({ message: text }).catch(() => Alert.alert("סיכום", text))
    );
  };

  // ---- No active event: start screen + history ----
  if (!current) {
    return (
      <View>
        <TouchableOpacity style={styles.startBtn} onPress={startEvent} activeOpacity={0.9}>
          <Text style={styles.startText}>▶ התחל אירוע</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>התחל אירוע כדי לרשום מכירות ולסכם קופה בסופו.</Text>

        {events.history.length > 0 && <Text style={styles.sectionTitle}>אירועים קודמים</Text>}
        {events.history.map((rec) => (
          <View key={rec.id} style={styles.histCard}>
            <View style={styles.histHead}>
              <Text style={styles.histDate}>{todayKey(new Date(rec.startedAt))}</Text>
              <Text style={styles.histTotal}>{shekel(rec.total)}</Text>
            </View>
            {rec.best && <Text style={styles.bestBadge}>🏆 הנמכר ביותר: {rec.best.name}</Text>}
            <Text style={[styles.histVar, rec.variance < 0 && { color: COLORS.danger }]}>
              הפרש קופה: {shekel(rec.variance)}
            </Text>
            <TouchableOpacity style={styles.waBtn} onPress={() => shareSummary(rec)} activeOpacity={0.85}>
              <Text style={styles.waText}>💬 שתף סיכום</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  // ---- Active event ----
  return (
    <View>
      <View style={styles.liveBanner}>
        <Text style={styles.liveText}>🟢 אירוע פעיל · {cartTotals.count} פריטים</Text>
        <Text style={styles.liveTotal}>{shekel(cartTotals.total)}</Text>
      </View>

      {cartTotals.best && (
        <View style={styles.bestCard}>
          <Text style={styles.bestCardText}>🏆 הנמכר ביותר: {cartTotals.best.name} ({cartTotals.best.qty})</Text>
        </View>
      )}

      {/* Add items to the event */}
      <Text style={styles.sectionTitle}>הוסף מכירה</Text>
      {inventory.length === 0 ? (
        <Text style={styles.hint}>אין מלאי. הוסף פריטים ב"ניהול מלאי חכם".</Text>
      ) : (
        inventory.map((item) => (
          <View key={item.id} style={styles.pickRow}>
            <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={qtyById[item.id] || ""}
              onChangeText={(v) => setQtyById((q) => ({ ...q, [item.id]: v }))}
              keyboardType="numeric"
              textAlign="center"
              placeholder="1"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.pickInfo}>
              <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.pickPrice}>{shekel(item.price)} · במלאי {item.qty}</Text>
            </View>
          </View>
        ))
      )}

      {/* Cart */}
      {current.cart.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>עגלת האירוע</Text>
          {current.cart.map((l) => (
            <View key={l.itemId} style={styles.cartRow}>
              <TouchableOpacity style={styles.del} onPress={() => removeLine(l.itemId)}>
                <Text style={styles.delText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.cartLineTotal}>{shekel(l.price * l.qty)}</Text>
              <Text style={styles.cartName}>{l.name} × {l.qty}</Text>
            </View>
          ))}
        </>
      )}

      {/* Cash reconciliation */}
      <Text style={styles.sectionTitle}>סגירת קופה</Text>
      <View style={styles.reconRow}>
        <View style={styles.reconCell}>
          <Text style={styles.reconLabel}>צפוי בקופה</Text>
          <Text style={styles.reconValue}>{shekel(cartTotals.total)}</Text>
        </View>
        <View style={styles.reconCell}>
          <Text style={styles.reconLabel}>נספר בפועל</Text>
          <TextInput
            style={styles.reconInput}
            value={actualCash}
            onChangeText={setActualCash}
            keyboardType="numeric"
            textAlign="center"
            placeholder="₪"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      </View>
      {actualCash !== "" && (
        <View style={[styles.varBanner, (Number(actualCash) - cartTotals.total) < 0 && styles.varNeg]}>
          <Text style={styles.varText}>
            הפרש: {shekel((Number(actualCash) || 0) - cartTotals.total)}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.endBtn} onPress={endEvent} activeOpacity={0.9}>
        <Text style={styles.endText}>⏹ סיים אירוע ונכה מהמלאי</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  startBtn: { height: 64, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", marginBottom: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  startText: { color: "#FFFFFF", fontSize: 20, fontFamily: FONTS.bold },
  hint: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.regular, textAlign: "right", marginBottom: 10 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right", marginTop: 14, marginBottom: 12 },
  histCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 10, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  histHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  histDate: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold },
  histTotal: { color: COLORS.success, fontSize: 18, fontFamily: FONTS.bold },
  bestBadge: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginTop: 8 },
  histVar: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginTop: 4 },
  waBtn: { marginTop: 10, height: 42, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  waText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  liveBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.navy, borderRadius: RADIUS, padding: 14, marginBottom: 10, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  liveText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  liveTotal: { color: "#FFFFFF", fontSize: 22, fontFamily: FONTS.bold },
  bestCard: { backgroundColor: COLORS.mustard, borderRadius: RADIUS, padding: 12, marginBottom: 6, ...BRUTAL_BORDER },
  bestCardText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "center" },
  pickRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 10, marginBottom: 8, ...BRUTAL_BORDER },
  addBtn: { width: 44, height: 44, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  addBtnText: { color: "#FFFFFF", fontSize: 24, fontFamily: FONTS.bold },
  qtyInput: { width: 50, height: 44, backgroundColor: COLORS.background, borderRadius: RADIUS, marginHorizontal: 8, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  pickInfo: { flex: 1 },
  pickName: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  pickPrice: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.medium, textAlign: "right", marginTop: 2 },
  cartRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 8, ...BRUTAL_BORDER },
  del: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  delText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  cartLineTotal: { color: COLORS.success, fontSize: 15, fontFamily: FONTS.bold, marginHorizontal: 10 },
  cartName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  reconRow: { flexDirection: "row", gap: 10 },
  reconCell: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, alignItems: "center", ...BRUTAL_BORDER },
  reconLabel: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.medium, marginBottom: 6 },
  reconValue: { color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold },
  reconInput: { width: "100%", backgroundColor: COLORS.background, borderRadius: 8, paddingVertical: 6, color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  varBanner: { backgroundColor: COLORS.success, borderRadius: RADIUS, padding: 10, marginTop: 10, ...BRUTAL_BORDER },
  varNeg: { backgroundColor: COLORS.danger },
  varText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold, textAlign: "center" },
  endBtn: { height: 60, borderRadius: RADIUS, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", marginTop: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  endText: { color: "#FFFFFF", fontSize: 17, fontFamily: FONTS.bold },
});
