import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { hapticLight, hapticSuccess } from "../utils/haptics";
import { monthKey, shekel, todayKey, uid } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// ---------------------------------------------------------------------------
// Smart POS (קופה) — dense, mobile-first checkout optimized for small foldable
// screens. Bottom ~15% is always the fixed charge bar; the middle area swaps
// between a detailed cart list (≤8 items) and an express numeric keypad (>8)
// so long sales never require scrolling a list mid-rush.
// ---------------------------------------------------------------------------

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const GREEN = "#34C759";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";

// Quick-add products for the print/delivery counter. Prices in ₪.
const PRODUCTS = [
  { name: "הדפסה שחור-לבן", price: 2, emoji: "🖨️" },
  { name: "הדפסה צבעונית", price: 5, emoji: "🌈" },
  { name: "מדבקות A5", price: 15, emoji: "🏷️" },
  { name: "למינציה", price: 10, emoji: "📄" },
  { name: "סריקה", price: 3, emoji: "📠" },
  { name: "משלוח קורקינט", price: 25, emoji: "🛴" },
];

// Above this many cart lines the list becomes unusable on a small screen, so
// the express keypad takes over the input area.
const EXPRESS_THRESHOLD = 8;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function POSScreen() {
  const insets = useSafeAreaInsets();

  // Cart + last transaction survive app restarts (robust against mid-sale
  // crashes on the counter phone).
  const [cart, setCart, cartLoaded] = usePersistentState("@dreammanager/pos-cart", []);
  const [lastTx, setLastTx] = usePersistentState("@dreammanager/pos-last-tx", null);
  const [sales, setSales] = usePersistentState(STORAGE_KEYS.posSales, []);

  // Express keypad entry buffer ("34.5") + manual keypad toggle.
  const [entry, setEntry] = useState("");
  const [keypadManual, setKeypadManual] = useState(false);

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  const expressAuto = cart.length > EXPRESS_THRESHOLD;
  const expressMode = expressAuto || keypadManual;

  // ---- Cart operations ----------------------------------------------------
  // Same product tapped twice merges into one line with qty 2.
  const addItem = (name, price) => {
    hapticLight();
    const key = `${name}|${price}`;
    setCart((prev) => {
      const found = prev.find((i) => i.key === key);
      if (found) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { key, id: uid(), name, price, qty: 1 }];
    });
  };

  const bumpQty = (id, delta) => {
    hapticLight();
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0) // minus on qty 1 removes the line
    );
  };

  // ---- Express keypad -----------------------------------------------------
  const keyTap = (k) => {
    hapticLight();
    setEntry((e) => {
      if (k === "⌫") return e.slice(0, -1);
      if (k === "." && e.includes(".")) return e;
      if (e.replace(".", "").length >= 6) return e; // sane price cap
      if (k === "." && e === "") return "0.";
      return e + k;
    });
  };

  const appendExpressItem = () => {
    const price = parseFloat(entry);
    if (!price || price <= 0) return;
    const n = cart.filter((i) => i.express).length + 1;
    hapticLight();
    setCart((prev) => [
      ...prev,
      { key: `express|${uid()}`, id: uid(), name: `פריט מהיר ${n}`, price, qty: 1, express: true },
    ]);
    setEntry("");
  };

  // ---- Checkout / last transaction ----------------------------------------
  // Charging writes real sale records into the shared POS sales store, so the
  // dashboard, Z-report and Notes business widgets all see this revenue.
  const checkout = () => {
    if (!cart.length) return;
    hapticSuccess();
    const txId = uid();
    const ts = Date.now();
    const records = cart.map((i) => ({
      id: uid(),
      ts,
      day: todayKey(),
      month: monthKey(),
      itemId: null,
      name: i.name,
      category: "print",
      qty: i.qty,
      price: i.price,
      cost: 0,
      total: i.price * i.qty,
      profit: i.price * i.qty,
      kind: "sale",
      eventId: txId,
    }));
    setSales((prev) => [...prev, ...records]);
    setLastTx({ id: txId, time: nowHHMM(), total, count: itemCount, items: cart });
    setCart([]);
    setEntry("");
    setKeypadManual(false);
  };

  // Edit = pull the sale back into the cart for adjustment and remove its
  // records from the ledger; re-charging writes the corrected version.
  const editLastTx = () => {
    if (!lastTx) return;
    hapticLight();
    setSales((prev) => prev.filter((r) => r.eventId !== lastTx.id));
    setCart(lastTx.items);
    setLastTx(null);
  };

  if (!cartLoaded) return <View style={{ flex: 1, backgroundColor: WHITE }} />;

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {/* Compact header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[s.keypadToggle, expressMode && { backgroundColor: BLUE }]}
          onPress={() => {
            hapticLight();
            if (!expressAuto) setKeypadManual((v) => !v);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>{expressMode ? "🧾" : "⌨️"}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={s.headerTitle}>קופה 💼</Text>
          <Text style={s.headerSub}>
            {itemCount > 0 ? `${itemCount} פריטים בסל` : "הסל ריק"}
          </Text>
        </View>
      </View>

      {/* Quick-add product rail (horizontal, keeps vertical space for the cart) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.productRail}
        contentContainerStyle={s.productRailContent}
      >
        {PRODUCTS.map((p) => (
          <TouchableOpacity key={p.name} style={s.productChip} onPress={() => addItem(p.name, p.price)} activeOpacity={0.75}>
            <Text style={s.productEmoji}>{p.emoji}</Text>
            <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
            <Text style={s.productPrice}>{shekel(p.price)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dynamic input area: detailed list ≤8 lines, express keypad above that */}
      <View style={{ flex: 1 }}>
        {/* Floating "last transaction" widget */}
        {lastTx && (
          <View style={s.lastTxPill}>
            <TouchableOpacity style={s.lastTxEdit} onPress={editLastTx} activeOpacity={0.7}>
              <Text style={{ fontSize: 13 }}>✏️</Text>
            </TouchableOpacity>
            <Text style={s.lastTxText}>
              עסקה אחרונה · 🕐 {lastTx.time} · <Text style={{ fontFamily: FONTS.bold, color: INK }}>{shekel(lastTx.total)}</Text>
            </Text>
          </View>
        )}

        {expressMode ? (
          <View style={s.keypadWrap}>
            {expressAuto && (
              <Text style={s.expressNote}>מעל {EXPRESS_THRESHOLD} פריטים — מצב מהיר פעיל</Text>
            )}
            {/* Entry display */}
            <View style={s.entryBox}>
              <Text style={s.entryValue}>{entry ? shekel(parseFloat(entry) || 0) : "₪0"}</Text>
              <Text style={s.entryHint}>הקלד מחיר והוסף פריט</Text>
            </View>
            {/* Numeric pad */}
            <View style={s.keyGrid}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                <TouchableOpacity key={k} style={s.key} onPress={() => keyTap(k)} activeOpacity={0.6}>
                  <Text style={s.keyText}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.appendBtn, !(parseFloat(entry) > 0) && { opacity: 0.35 }]}
              onPress={appendExpressItem}
              activeOpacity={0.8}
            >
              <Text style={s.appendBtnText}>＋ הוסף פריט {entry ? `· ${shekel(parseFloat(entry) || 0)}` : ""}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 10, paddingTop: lastTx ? 46 : 6 }}
          >
            {cart.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 34 }}>🧺</Text>
                <Text style={s.emptyText}>הסל ריק — הקש על מוצר להוספה</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={s.cartRow}>
                  {/* Stepper (left) */}
                  <View style={s.stepper}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => bumpQty(item.id, -1)} activeOpacity={0.6}>
                      <Text style={s.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qty}>{item.qty}</Text>
                    <TouchableOpacity style={s.stepBtn} onPress={() => bumpQty(item.id, 1)} activeOpacity={0.6}>
                      <Text style={s.stepBtnText}>＋</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Line total */}
                  <Text style={s.lineTotal}>{shekel(item.price * item.qty)}</Text>
                  {/* Name + unit price (right) */}
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.itemUnit}>{shekel(item.price)} ליח׳</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Fixed charge bar — always the bottom ~15% of the screen */}
      <View style={s.chargeBar}>
        <TouchableOpacity
          style={[s.chargeBtn, !cart.length && { opacity: 0.35 }]}
          onPress={checkout}
          activeOpacity={0.85}
        >
          <Text style={s.chargeBtnText}>💳 חיוב</Text>
        </TouchableOpacity>
        <View style={s.totalBlock}>
          <Text style={s.totalLabel}>סה״כ לתשלום</Text>
          <Text style={s.totalValue}>{shekel(total)}</Text>
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: WHITE,
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 20, color: INK },
  headerSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 1 },
  keypadToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },

  productRail: { flexGrow: 0 },
  productRailContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  productChip: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 92,
    ...SHADOW,
  },
  productEmoji: { fontSize: 18 },
  productName: { fontFamily: FONTS.semibold, fontSize: 11, color: INK, marginTop: 2, maxWidth: 96 },
  productPrice: { fontFamily: FONTS.bold, fontSize: 11, color: BLUE, marginTop: 1 },

  lastTxPill: {
    position: "absolute",
    top: 4,
    alignSelf: "center",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    ...SHADOW,
  },
  lastTxText: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT },
  lastTxEdit: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 48, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: INK_MUTED },

  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 10,
    ...SHADOW,
  },
  itemName: { fontFamily: FONTS.semibold, fontSize: 14, color: INK },
  itemUnit: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 1 },
  lineTotal: { fontFamily: FONTS.bold, fontSize: 14, color: INK, minWidth: 54, textAlign: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  stepBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: BLUE, lineHeight: 20 },
  qty: { fontFamily: FONTS.bold, fontSize: 15, color: INK, minWidth: 20, textAlign: "center" },

  keypadWrap: { flex: 1, paddingHorizontal: 14, paddingTop: 6, justifyContent: "flex-end", paddingBottom: 8 },
  expressNote: { fontFamily: FONTS.medium, fontSize: 11, color: INK_MUTED, textAlign: "center", marginBottom: 4 },
  entryBox: {
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
    ...SHADOW,
  },
  entryValue: { fontFamily: FONTS.bold, fontSize: 28, color: INK },
  entryHint: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 1 },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  key: {
    flexBasis: "32%",
    height: 50,
    borderRadius: 12,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  keyText: { fontFamily: FONTS.semibold, fontSize: 20, color: INK },
  appendBtn: {
    marginTop: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  appendBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE },

  chargeBar: {
    height: "15%",
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#EEF0F3",
  },
  totalBlock: { alignItems: "flex-end", minWidth: 110 },
  totalLabel: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED },
  totalValue: { fontFamily: FONTS.bold, fontSize: 26, color: INK, marginTop: 1 },
  chargeBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chargeBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: WHITE },
});
