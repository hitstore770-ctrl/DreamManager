import { useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import ToolsSheet, { SheetRow, ToolsFab } from "../components/business/ToolsSheet";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import { monthKey, shekel, todayKey, uid } from "../utils/posStore";
import { usePersistentState } from "../utils/usePersistentState";
import { buildZReportText } from "../utils/zReport";
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
  // Sales ledger is shared with the other business modules via context; only
  // the cart + last transaction are POS-private (persisted so a mid-sale
  // crash on the counter phone loses nothing).
  const { sales, setSales } = useBusiness();
  const [cart, setCart, cartLoaded] = usePersistentState("@dreammanager/pos-cart", []);
  const [lastTx, setLastTx] = usePersistentState("@dreammanager/pos-last-tx", null);

  // Express keypad entry buffer ("34.5") + manual keypad toggle.
  const [entry, setEntry] = useState("");
  const [keypadManual, setKeypadManual] = useState(false);

  // Pro tools: order-level discount %, free-text order note, tools sheet.
  const [discountPct, setDiscountPct] = useState(0);
  const [orderNote, setOrderNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState("menu"); // menu|discount|split|note|defect

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  const discountAmount = Math.round(total * discountPct) / 100;
  const payable = total - discountAmount;
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
    const base = { ts, day: todayKey(), month: monthKey(), itemId: null, category: "print", cost: 0, kind: "sale", eventId: txId };
    const records = cart.map((i) => ({
      ...base,
      id: uid(),
      name: i.name,
      qty: i.qty,
      price: i.price,
      total: i.price * i.qty,
      profit: i.price * i.qty,
    }));
    // Order-level discount lands in the ledger as its own negative line, so
    // the Z-report and dashboard reconcile to what was actually charged.
    if (discountPct > 0 && discountAmount > 0) {
      records.push({
        ...base,
        id: uid(),
        name: `הנחה ${discountPct}%`,
        qty: 1,
        price: -discountAmount,
        total: -discountAmount,
        profit: -discountAmount,
      });
    }
    setSales((prev) => [...prev, ...records]);
    setLastTx({
      id: txId,
      time: nowHHMM(),
      total: payable,
      count: itemCount,
      items: cart,
      discountPct,
      note: orderNote,
    });
    setCart([]);
    setEntry("");
    setKeypadManual(false);
    setDiscountPct(0);
    setOrderNote("");
  };

  // Edit = pull the sale back into the cart for adjustment and remove its
  // records from the ledger; re-charging writes the corrected version.
  const editLastTx = () => {
    if (!lastTx) return;
    hapticLight();
    setSales((prev) => prev.filter((r) => r.eventId !== lastTx.id));
    setCart(lastTx.items);
    setDiscountPct(lastTx.discountPct || 0);
    setOrderNote(lastTx.note || "");
    setLastTx(null);
  };

  // ---- Pro tools sheet ----------------------------------------------------
  const openSheet = () => {
    hapticLight();
    setSheetView("menu");
    setSheetOpen(true);
  };

  const applyDiscount = (pct) => {
    hapticLight();
    setDiscountPct(pct);
    setSheetOpen(false);
  };

  // Remove one unit of a cart line as defective: it leaves the bill and a
  // zero-revenue damage record is logged so the loss shows up in the Z-report.
  const markDefective = (line) => {
    hapticLight();
    setCart((prev) =>
      prev
        .map((i) => (i.id === line.id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    );
    setSales((prev) => [
      ...prev,
      {
        id: uid(),
        ts: Date.now(),
        day: todayKey(),
        month: monthKey(),
        itemId: null,
        name: line.name,
        category: "print",
        qty: 1,
        price: 0,
        cost: 0,
        total: 0,
        profit: 0,
        kind: "damage",
        eventId: null,
      },
    ]);
    setSheetOpen(false);
  };

  const shareZ = async () => {
    hapticLight();
    setSheetOpen(false);
    try {
      await Share.share({ message: buildZReportText(sales) });
    } catch {
      /* user cancelled */
    }
  };

  if (!cartLoaded) return <View style={{ flex: 1, backgroundColor: WHITE }} />;

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {/* Compact header (top inset handled by the Business shell) */}
      <View style={s.header}>
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
            {orderNote ? " · 📝 הערה מצורפת" : ""}
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
                    <TouchableOpacity
                      style={s.stepBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      onPress={() => bumpQty(item.id, -1)}
                      activeOpacity={0.6}
                    >
                      <Text style={s.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qty}>{item.qty}</Text>
                    <TouchableOpacity
                      style={s.stepBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      onPress={() => bumpQty(item.id, 1)}
                      activeOpacity={0.6}
                    >
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
          <Text style={s.totalLabel}>
            {discountPct > 0 ? `הנחה ${discountPct}% · ‎-${shekel(discountAmount)}` : "סה״כ לתשלום"}
          </Text>
          <Text style={s.totalValue}>{shekel(payable)}</Text>
        </View>
      </View>

      {/* Pro tools */}
      <ToolsFab style={{ bottom: "17%" }} onPress={openSheet} />
      <ToolsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="⚙️ כלים מקצועיים">
        {sheetView === "menu" && (
          <>
            <SheetRow
              emoji="🏷️"
              label="הנחה מהירה %"
              sub={discountPct ? `פעילה: ${discountPct}% (‎-${shekel(discountAmount)})` : "אחוז הנחה על כל הסל"}
              active={discountPct > 0}
              onPress={() => setSheetView("discount")}
            />
            <SheetRow emoji="✂️" label="פיצול תשלום" sub="חלוקת הסכום בין משלמים" onPress={() => setSheetView("split")} />
            <SheetRow
              emoji="📝"
              label="הערה להזמנה"
              sub={orderNote ? "הערה מצורפת ✓" : "טקסט חופשי שנשמר עם העסקה"}
              active={!!orderNote}
              onPress={() => setSheetView("note")}
            />
            <SheetRow
              emoji="⚠️"
              label="פריט פגום / פחת"
              sub="הסרת יחידה מהסל ורישום נזק"
              danger
              onPress={() => setSheetView("defect")}
            />
            <SheetRow emoji="🧾" label="ייצוא דוח Z ל-WhatsApp" sub="סיכום פדיון, עסקאות ופחת להיום" onPress={shareZ} />
          </>
        )}

        {sheetView === "discount" && (
          <>
            <View style={s.discountRow}>
              {[5, 10, 15, 20].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.discountChip, discountPct === p && { backgroundColor: BLUE }]}
                  onPress={() => applyDiscount(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.discountChipText, discountPct === p && { color: WHITE }]}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <SheetRow emoji="🚫" label="ביטול הנחה" onPress={() => applyDiscount(0)} />
            <SheetRow emoji="‹" label="חזרה" onPress={() => setSheetView("menu")} />
          </>
        )}

        {sheetView === "split" && (
          <>
            {[2, 3, 4].map((n) => (
              <View key={n} style={s.splitRow}>
                <Text style={s.splitValue}>{shekel(Math.ceil((payable / n) * 100) / 100)}</Text>
                <Text style={s.splitLabel}>{n} משלמים · כל אחד</Text>
              </View>
            ))}
            <SheetRow emoji="‹" label="חזרה" onPress={() => setSheetView("menu")} />
          </>
        )}

        {sheetView === "note" && (
          <>
            <TextInput
              style={s.noteInput}
              value={orderNote}
              onChangeText={setOrderNote}
              placeholder="למשל: לקוח מגיע ב-14:00, לארוז מראש"
              placeholderTextColor={INK_MUTED}
              multiline
              textAlign="right"
            />
            <SheetRow emoji="✓" label="שמירת ההערה" onPress={() => { hapticLight(); setSheetOpen(false); }} />
            <SheetRow emoji="‹" label="חזרה" onPress={() => setSheetView("menu")} />
          </>
        )}

        {sheetView === "defect" && (
          <>
            {cart.length === 0 ? (
              <Text style={s.defectEmpty}>הסל ריק — אין פריטים לסימון</Text>
            ) : (
              cart.map((line) => (
                <SheetRow
                  key={line.id}
                  emoji="⚠️"
                  label={line.name}
                  sub={`×${line.qty} · ${shekel(line.price)} — הקשה תרשום יחידה אחת כנזק`}
                  danger
                  onPress={() => markDefective(line)}
                />
              ))
            )}
            <SheetRow emoji="‹" label="חזרה" onPress={() => setSheetView("menu")} />
          </>
        )}
      </ToolsSheet>
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
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: WHITE,
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 20, color: INK },
  headerSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 1 },
  keypadToggle: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 14,
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
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  // 40px visual + hitSlop 4 in JSX = 48px effective touch target without
  // blowing up the dense row height.
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  stepBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: BLUE, lineHeight: 22 },
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
  entryValue: { fontFamily: FONTS.bold, fontSize: 34, color: INK },
  entryHint: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 1 },
  // Big keys + big digits: mistype-resistant on small foldable screens.
  keyGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  key: {
    flexBasis: "32%",
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  keyText: { fontFamily: FONTS.semibold, fontSize: 24, color: INK },
  appendBtn: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  appendBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: WHITE },

  // Pro tools sheet sub-views
  discountRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  discountChip: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  discountChipText: { fontFamily: FONTS.bold, fontSize: 17, color: BLUE },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  splitLabel: { fontFamily: FONTS.medium, fontSize: 14, color: INK_SOFT },
  splitValue: { fontFamily: FONTS.bold, fontSize: 17, color: INK },
  noteInput: {
    minHeight: 84,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  defectEmpty: { fontFamily: FONTS.regular, fontSize: 13, color: INK_MUTED, textAlign: "center", paddingVertical: 16 },

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
