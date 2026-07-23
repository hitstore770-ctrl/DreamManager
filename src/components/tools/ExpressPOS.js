import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { applySale, isLocked, shekel } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

export default function ExpressPOS() {
  const [inventory, setInventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [sales, setSales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [lockedDays] = usePersistentState(STORAGE_KEYS.posLockedDays, []);
  const locked = isLocked(lockedDays);

  const [cart, setCart] = useState([]); // [{id,name,price,qty}]
  const [tendered, setTendered] = useState("");
  const [change, setChange] = useState(null);
  const [qtyItem, setQtyItem] = useState(null); // long-press custom qty
  const [qtyInput, setQtyInput] = useState("");

  // Top 6 sellers (by units sold, then insertion order).
  const top6 = useMemo(
    () => [...inventory].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 6),
    [inventory]
  );

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const addToCart = (item, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty }];
    });
    setChange(null);
  };

  const openQty = (item) => {
    setQtyItem(item);
    setQtyInput("");
  };
  const confirmQty = () => {
    const q = parseInt(qtyInput, 10);
    if (q > 0) addToCart(qtyItem, q);
    setQtyItem(null);
  };

  const clearCart = () => {
    setCart([]);
    setTendered("");
    setChange(null);
  };

  const payNow = () => {
    if (locked) {
      Alert.alert("היום נעול", "הופק דו״ח Z — לא ניתן לבצע מכירות היום");
      return;
    }
    if (cart.length === 0) return;
    let inv = inventory;
    const newSales = [];
    cart.forEach((line) => {
      const res = applySale(inv, line.id, line.qty, line.price);
      inv = res.inventory;
      if (res.sale) newSales.push(res.sale);
    });
    setInventory(inv);
    setSales((prev) => [...newSales, ...prev]);

    const tend = Number(tendered) || 0;
    setChange(tend > 0 ? tend - total : 0);
    setCart([]);
    setTendered("");
  };

  return (
    <View>
      {locked && (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>🔒 היום נעול (דו״ח Z הופק)</Text>
        </View>
      )}

      {/* Change display (after a sale) */}
      {change !== null && (
        <View style={styles.changeCard}>
          <Text style={styles.changeLabel}>עודף להחזיר</Text>
          <Text style={styles.changeValue}>{shekel(change)}</Text>
        </View>
      )}

      {/* 6-button grid */}
      {top6.length === 0 ? (
        <Text style={styles.empty}>אין פריטים. הוסף מלאי ב"ניהול מלאי חכם".</Text>
      ) : (
        <View style={styles.grid}>
          {top6.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridBtn}
              onPress={() => addToCart(item, 1)}
              onLongPress={() => openQty(item)}
              delayLongPress={350}
              activeOpacity={0.85}
            >
              <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.gridPrice}>{shekel(item.price)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {top6.length > 0 && <Text style={styles.hint}>הקשה = יחידה · לחיצה ארוכה = כמות מותאמת</Text>}

      {/* Cart */}
      {cart.length > 0 && (
        <View style={styles.cart}>
          {cart.map((l) => (
            <View key={l.id} style={styles.cartRow}>
              <Text style={styles.cartTotal}>{shekel(l.price * l.qty)}</Text>
              <Text style={styles.cartName}>{l.name} × {l.qty}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{shekel(total)}</Text>
            <Text style={styles.totalLabel}>סה״כ</Text>
          </View>
          <View style={styles.tenderRow}>
            <TextInput
              style={styles.tenderInput}
              value={tendered}
              onChangeText={setTendered}
              keyboardType="numeric"
              textAlign="center"
              placeholder="מזומן שהתקבל ₪"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.clearBtn} onPress={clearCart} activeOpacity={0.85}>
              <Text style={styles.clearText}>נקה</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.payBtn} onPress={payNow} activeOpacity={0.9}>
            <Text style={styles.payText}>שלם עכשיו · {shekel(total)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom qty modal */}
      <Modal visible={!!qtyItem} transparent animationType="fade" onRequestClose={() => setQtyItem(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>כמות עבור "{qtyItem?.name}"</Text>
            <TextInput
              style={styles.modalInput}
              value={qtyInput}
              onChangeText={setQtyInput}
              keyboardType="numeric"
              textAlign="center"
              placeholder="כמות"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setQtyItem(null)}>
                <Text style={[styles.modalBtnText, { color: COLORS.textPrimary }]}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={confirmQty}>
                <Text style={styles.modalBtnText}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lockBanner: { backgroundColor: COLORS.danger, borderRadius: RADIUS, padding: 10, marginBottom: 12, ...BRUTAL_BORDER },
  lockText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  changeCard: { backgroundColor: COLORS.success, borderRadius: RADIUS, padding: 20, alignItems: "center", marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  changeLabel: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  changeValue: { color: "#FFFFFF", fontSize: 52, fontFamily: FONTS.bold, marginTop: 4 },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridBtn: {
    width: "31.5%",
    aspectRatio: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    marginBottom: 10,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  gridName: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  gridPrice: { color: COLORS.navy, fontSize: 15, fontFamily: FONTS.bold, marginTop: 6 },
  hint: { color: COLORS.textMuted, fontSize: 12, fontFamily: FONTS.regular, textAlign: "center", marginBottom: 10 },
  cart: { backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 12, marginTop: 4, ...BRUTAL_BORDER },
  cartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  cartTotal: { color: COLORS.success, fontSize: 15, fontFamily: FONTS.bold },
  cartName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right", marginStart: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 2, borderColor: COLORS.border, marginTop: 8, paddingTop: 10 },
  totalValue: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold },
  tenderRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tenderInput: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  clearBtn: { paddingHorizontal: 18, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  clearText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  payBtn: { height: 70, borderRadius: RADIUS, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", marginTop: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  payText: { color: "#FFFFFF", fontSize: 22, fontFamily: FONTS.bold },
  modalWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(17,24,39,0.45)" },
  modalCard: { width: "100%", backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 18, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
  modalInput: { backgroundColor: COLORS.white, borderRadius: RADIUS, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold, marginBottom: 12, ...BRUTAL_BORDER },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  modalCancel: { backgroundColor: COLORS.white },
  modalOk: { backgroundColor: COLORS.success },
  modalBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
});
