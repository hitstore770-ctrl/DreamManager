import { useEffect, useMemo, useRef, useState } from "react";
import {
  I18nManager,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import ToolsSheet, { SheetRow } from "../components/business/ToolsSheet";
import { useBusiness } from "../context/BusinessContext";
import { useSettings } from "../context/SettingsContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { monthKey, shekel, todayKey, uid } from "../utils/posStore";
import { playCaching } from "../utils/sound";
import { usePersistentState } from "../utils/usePersistentState";
import { buildZReportText, lastCloseTs } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// ---------------------------------------------------------------------------
// Smart POS (קופה) — dense, mobile-first checkout optimized for small foldable
// screens. Bottom ~15% is always the fixed charge bar; the middle area swaps
// between a detailed cart list (≤8 items) and an express numeric keypad (>8)
// so long sales never require scrolling a list mid-rush.
// ---------------------------------------------------------------------------

const WHITE = "#FFFFFF";
const CARD = "#F0F2F5";
const GREEN = "#34C759";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const RED = "#E14848";
const RED_SOFT = "#FDEBEB";

// Quick-add products for the print/delivery counter. Prices in ₪.
const PRODUCTS = [
  { name: "פחית שתייה", price: 6, emoji: "🥤" },
  { name: "בקבוק מים", price: 5, emoji: "💧" },
  { name: "משקה אנרגיה", price: 12, emoji: "⚡" },
  { name: "קפה קר", price: 10, emoji: "☕" },
  { name: "חטיף", price: 7, emoji: "🍫" },
  { name: "מארז 6 פחיות", price: 30, emoji: "📦" },
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
  const { sales, setSales, closes, promos } = useBusiness();
  const { autoClearCart, receiptFooter } = useSettings();
  // Active promo bundles ride at the front of the product rail as gold chips.
  const activePromos = (promos || []).filter((p) => p.active);
  const [cart, setCart, cartLoaded] = usePersistentState("@dreammanager/pos-cart", []);
  const [lastTx, setLastTx] = usePersistentState("@dreammanager/pos-last-tx", null);

  // Express keypad entry buffer ("34.5") + manual keypad toggle.
  const [entry, setEntry] = useState("");
  const [keypadManual, setKeypadManual] = useState(false);

  // Pro tools: order-level discount (% or fixed ₪), free-text order note,
  // tools sheet.
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFix, setDiscountFix] = useState(0);
  const [fixInput, setFixInput] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState("menu"); // menu|discount|split|note|defect

  // Change calculator (מחשבון עודף) overlay.
  const [cashOpen, setCashOpen] = useState(false);
  const [received, setReceived] = useState("");

  // Clear-cart: first tap arms the confirmation, second tap clears; the
  // emptied cart is kept for a few seconds so "ביטול" can restore it.
  const [confirmClear, setConfirmClear] = useState(false);
  const [undoCart, setUndoCart] = useState(null);
  const confirmTimer = useRef(null);
  const undoTimer = useRef(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  // Discount is either a % of the cart or a fixed ₪ amount (never both).
  const discountAmount =
    discountPct > 0 ? Math.round(total * discountPct) / 100 : Math.min(discountFix, total);
  const payable = total - discountAmount;
  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum - payable;
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
    const target = cart.find((i) => i.id === id);
    const removing = target && delta < 0 && target.qty === 1;
    if (removing) hapticWarning();
    else hapticLight();
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0) // minus on qty 1 removes the line
    );
  };

  // ---- Clear cart with 1-tap confirm + undo window ------------------------
  const trashTap = () => {
    if (!cart.length) return;
    if (!confirmClear) {
      hapticWarning();
      setConfirmClear(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    hapticWarning();
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    setUndoCart(cart);
    setCart([]);
    setDiscountPct(0);
    setDiscountFix(0);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoCart(null), 6000);
  };

  const undoClear = () => {
    if (!undoCart) return;
    hapticLight();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setCart(undoCart);
    setUndoCart(null);
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
  const checkout = (cash = null) => {
    if (!cart.length) return;
    hapticSuccess();
    playCaching();
    const txId = uid();
    const ts = Date.now();
    const base = {
      ts,
      day: todayKey(),
      month: monthKey(),
      itemId: null,
      category: "print",
      cost: 0,
      kind: "sale",
      eventId: txId,
      // Cash sales go through the change calculator; everything else is card.
      pay: cash ? "cash" : "credit",
    };
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
    if (discountAmount > 0) {
      records.push({
        ...base,
        id: uid(),
        name: discountPct > 0 ? `הנחה ${discountPct}%` : `הנחה ${shekel(discountAmount)}`,
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
      discountFix,
      note: orderNote,
      received: cash?.received ?? null,
      change: cash?.change ?? null,
    });
    // "Auto-clear cart" off keeps the basket on screen after a charge, for
    // shops that ring the same basket up repeatedly.
    if (autoClearCart) {
      setCart([]);
      setEntry("");
      setKeypadManual(false);
      setDiscountPct(0);
      setDiscountFix(0);
      setOrderNote("");
    }
    setUndoCart(null);
  };

  // Charge from the change-calculator overlay: same checkout, plus the cash
  // amounts are remembered on the transaction.
  const chargeWithCash = () => {
    if (!cart.length || change < 0) return;
    checkout({ received: receivedNum, change: Math.round(change * 100) / 100 });
    setCashOpen(false);
    setReceived("");
  };

  const openCash = (amount) => {
    if (!cart.length) return;
    hapticLight();
    setReceived(String(amount));
    setCashOpen(true);
  };

  const addCash = (amount) => {
    hapticLight();
    setReceived(String((parseFloat(received) || 0) + amount));
  };

  // Edit = pull the sale back into the cart for adjustment and remove its
  // records from the ledger; re-charging writes the corrected version.
  const editLastTx = () => {
    if (!lastTx) return;
    hapticLight();
    setSales((prev) => prev.filter((r) => r.eventId !== lastTx.id));
    setCart(lastTx.items);
    setDiscountPct(lastTx.discountPct || 0);
    setDiscountFix(lastTx.discountFix || 0);
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
    setDiscountFix(0);
    setSheetOpen(false);
  };

  const applyFixDiscount = () => {
    const v = parseFloat(fixInput);
    if (!(v > 0)) return;
    hapticLight();
    setDiscountFix(Math.round(v * 100) / 100);
    setDiscountPct(0);
    setFixInput("");
    setSheetOpen(false);
  };

  // Remove one unit of a cart line as defective: it leaves the bill and a
  // zero-revenue damage record is logged so the loss shows up in the Z-report.
  const markDefective = (line) => {
    hapticWarning();
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
      await Share.share({ message: buildZReportText(sales, new Date(), lastCloseTs(closes), receiptFooter) });
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
          <Icon name={expressMode ? "list" : "hash"} size={18} color={INK_SOFT} />
        </TouchableOpacity>
        {/* Pro tools sheet — docked in the header so it never collides with
            the quick-cash / undo strip above the charge bar */}
        <TouchableOpacity
          style={[s.keypadToggle, { marginStart: 8 }, (discountAmount > 0 || !!orderNote) && { backgroundColor: BLUE }]}
          onPress={openSheet}
          activeOpacity={0.7}
        >
          <Icon name="sliders" size={18} color={INK_SOFT} />
        </TouchableOpacity>
        {/* Clear cart: tap once to arm ("בטוח?"), tap again to empty */}
        {cart.length > 0 && (
          <TouchableOpacity
            style={[s.keypadToggle, { marginStart: 8 }, confirmClear && { backgroundColor: RED_SOFT }]}
            onPress={trashTap}
            activeOpacity={0.7}
          >
            {confirmClear ? (
              <Text style={s.trashConfirm}>בטוח?</Text>
            ) : (
              <Icon name="trash-2" size={18} color={RED} />
            )}
          </TouchableOpacity>
        )}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={s.headerTitleRow}>
            <Icon name="shopping-cart" size={19} color={BLUE} />
            <Text style={s.headerTitle}>קופה</Text>
          </View>
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
        {activePromos.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[s.productChip, s.promoChip]}
            onPress={() => addItem(p.name, p.price)}
            activeOpacity={0.75}
          >
            <Text style={s.productEmoji}>{p.emoji}</Text>
            <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
            <Text style={[s.productPrice, { color: "#A8871F" }]}>{shekel(p.price)}</Text>
          </TouchableOpacity>
        ))}
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

      {/* Undo snackbar after clearing the cart */}
      {undoCart && (
        <View style={s.undoBar}>
          <TouchableOpacity style={s.undoBtn} onPress={undoClear} activeOpacity={0.7}>
            <Text style={s.undoBtnText}>ביטול</Text>
          </TouchableOpacity>
          <Text style={s.undoText}>הסל נוקה 🗑️</Text>
        </View>
      )}

      {/* Quick cash: opens the change calculator pre-filled with the bill */}
      {cart.length > 0 && (
        <View style={s.cashRow}>
          {[200, 100, 50].map((amt) => (
            <TouchableOpacity key={amt} style={s.cashChip} onPress={() => openCash(amt)} activeOpacity={0.7}>
              <Text style={s.cashChipText}>₪{amt}</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.cashLabel}>💵 מזומן:</Text>
        </View>
      )}

      {/* Fixed charge bar — always the bottom ~15% of the screen */}
      <View style={s.chargeBar}>
        <Bounce style={[s.chargeBtn, !cart.length && { opacity: 0.35 }]} onPress={() => checkout()}>
          <Icon name="credit-card" size={20} color={WHITE} />
          <Text style={s.chargeBtnText}>חיוב</Text>
        </Bounce>
        <View style={s.totalBlock}>
          <Text style={s.totalLabel}>
            {discountAmount > 0
              ? `הנחה ${discountPct > 0 ? `${discountPct}%` : "קבועה"} · ‎-${shekel(discountAmount)}`
              : "סה״כ לתשלום"}
          </Text>
          <Text style={s.totalValue}>{shekel(payable)}</Text>
        </View>
      </View>

      {/* Change calculator (מחשבון עודף) */}
      <Modal visible={cashOpen} transparent animationType="fade" onRequestClose={() => setCashOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setCashOpen(false)}>
          <View style={s.cashBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.cashCard}>
                <Text style={s.cashTitle}>💵 מחשבון עודף</Text>
                <View style={s.cashPayRow}>
                  <Text style={s.cashPayValue}>{shekel(payable)}</Text>
                  <Text style={s.cashPayLabel}>לתשלום</Text>
                </View>
                <TextInput
                  style={s.cashInput}
                  value={received}
                  onChangeText={setReceived}
                  keyboardType="numeric"
                  placeholder="סכום שהתקבל"
                  placeholderTextColor={INK_MUTED}
                  textAlign="center"
                />
                <View style={s.cashAddRow}>
                  {[50, 100, 200].map((amt) => (
                    <TouchableOpacity key={amt} style={s.cashAddChip} onPress={() => addCash(amt)} activeOpacity={0.7}>
                      <Text style={s.cashAddChipText}>+₪{amt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* The headline number: exact change, impossible to misread */}
                <View style={[s.changeBox, { backgroundColor: change >= 0 ? GREEN + "1A" : RED_SOFT }]}>
                  <Text style={[s.changeValue, { color: change >= 0 ? "#1E9E58" : RED }]}>
                    {change >= 0 ? shekel(Math.round(change * 100) / 100) : shekel(Math.round(-change * 100) / 100)}
                  </Text>
                  <Text style={[s.changeLabel, { color: change >= 0 ? "#1E9E58" : RED }]}>
                    {change >= 0 ? "עודף להחזרה" : "חסר לתשלום"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity style={s.cashClose} onPress={() => setCashOpen(false)} activeOpacity={0.7}>
                    <Text style={s.cashCloseText}>סגור</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.cashCharge, change < 0 && { opacity: 0.35 }]}
                    onPress={chargeWithCash}
                    activeOpacity={0.85}
                  >
                    <Text style={s.cashChargeText}>💳 חיוב וסיום</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Pro tools */}
      <ToolsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="כלים מקצועיים">
        {sheetView === "menu" && (
          <>
            <SheetRow
              emoji="🏷️"
              label="הנחה מהירה (% / ₪)"
              sub={
                discountAmount > 0
                  ? `פעילה: ${discountPct > 0 ? `${discountPct}%` : shekel(discountFix)} (‎-${shekel(discountAmount)})`
                  : "אחוז או סכום קבוע על כל הסל"
              }
              active={discountAmount > 0}
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
            {/* Fixed-amount discount (₪) */}
            <View style={s.fixRow}>
              <TouchableOpacity
                style={[s.fixApply, !(parseFloat(fixInput) > 0) && { opacity: 0.35 }]}
                onPress={applyFixDiscount}
                activeOpacity={0.8}
              >
                <Text style={s.fixApplyText}>החל ₪</Text>
              </TouchableOpacity>
              <TextInput
                style={s.fixInput}
                value={fixInput}
                onChangeText={setFixInput}
                keyboardType="numeric"
                placeholder="סכום הנחה בש״ח"
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />
            </View>
            <SheetRow emoji="🚫" label="ביטול הנחה" onPress={() => { applyDiscount(0); setDiscountFix(0); }} />
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
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
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
  headerTitleRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 8,
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
  promoChip: { backgroundColor: "#D4AF3722" },

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

  trashConfirm: { fontFamily: FONTS.bold, fontSize: 11, color: RED },

  // Undo snackbar
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...SHADOW,
  },
  undoText: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  undoBtn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  undoBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: WHITE },

  // Quick cash row (above the charge bar)
  cashRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  cashLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
  cashChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  cashChipText: { fontFamily: FONTS.bold, fontSize: 16, color: BLUE },

  // Change calculator overlay
  cashBackdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  cashCard: { width: "100%", backgroundColor: WHITE, borderRadius: 24, padding: 20, ...SHADOW },
  cashTitle: { fontFamily: FONTS.bold, fontSize: 18, color: INK, textAlign: "right", marginBottom: 12 },
  cashPayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 10,
  },
  cashPayLabel: { fontFamily: FONTS.medium, fontSize: 14, color: INK_SOFT },
  cashPayValue: { fontFamily: FONTS.bold, fontSize: 18, color: INK },
  cashInput: {
    minHeight: 56,
    backgroundColor: CARD,
    borderRadius: 14,
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: INK,
    marginBottom: 10,
  },
  cashAddRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  cashAddChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BLUE + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  cashAddChipText: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },
  changeBox: { borderRadius: 16, alignItems: "center", paddingVertical: 14, marginBottom: 14 },
  changeValue: { fontFamily: FONTS.bold, fontSize: 36 },
  changeLabel: { fontFamily: FONTS.semibold, fontSize: 13, marginTop: 2 },
  cashClose: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  cashCloseText: { fontFamily: FONTS.bold, fontSize: 15, color: INK_SOFT },
  cashCharge: {
    flex: 2,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  cashChargeText: { fontFamily: FONTS.bold, fontSize: 16, color: WHITE },

  // Fixed-₪ discount input row (tools sheet)
  fixRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  fixInput: {
    flex: 2,
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: INK,
  },
  fixApply: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  fixApplyText: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE },

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
    flexDirection: "row",
    gap: 10,
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
