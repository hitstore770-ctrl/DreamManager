import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import Icon from "../Icon";
import CustomText from "../CustomText";
import ScanCamera from "./ScanCamera";
import VoiceOrderButton from "./VoiceOrderButton";
import { useAuth } from "../../context/AuthContext";
import { useBusiness } from "../../context/BusinessContext";
import { useSettings } from "../../context/SettingsContext";
import { costFor, useItemCosts } from "../../utils/costStore";
import { pushMany } from "../../utils/cloudSync";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { DECKS, DEFAULT_DECK_ITEMS, marginOf } from "../../utils/posCatalog";
import { monthKey, shekel, todayKey, uid } from "../../utils/posStore";
import { usePersistentState } from "../../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { BEVEL, CARD_SHADOW, UI, tint } from "../../utils/ui";

// The register.
//
// Two modes, deliberately not symmetrical, because the two businesses are not:
//
//   מזון מהיר   a known menu. The grid, plus a manual line for the thing that
//               is not on it — a special, a one-off, a favour.
//   אליאקספרס   imported stock with no menu at all. No grid and no manual
//               entry: an item enters the cart by being scanned, because
//               typing a name for a box in your hand is how one product ends
//               up in the ledger under four spellings.
//
// The asymmetry is the design. Allowing free text on the import side would
// quietly undo the reason for scanning at all.
//
// Cost lives in a separate ledger that Noa writes to conversationally, so the
// checkout summary reports what a sale actually earned rather than what it
// merely took.

const NUM_COLUMNS = 3;

// What a mock scan returns, labelled as a demo on the cart line itself. An
// unrecognised box entering the ledger under a confident product name is
// precisely the failure a scanner exists to prevent.
const SCAN_PLACEHOLDER = { name: "פריט סרוק (הדגמה)", price: 45 };

export default function PosRegisterTab({ bottomInset = 0 }) {
  const { sales, setSales, setInventory } = useBusiness();
  const { user } = useAuth();
  const costs = useItemCosts();
  // Settings → תצורת קופה. Off hides the manual line entirely, which is the
  // point: a register that can invent items cannot be reconciled against the
  // deck, and some days the owner wants exactly that discipline.
  const { allowManualItems } = useSettings();
  const manualAllowed = allowManualItems !== false;

  const [deckKey, setDeckKey] = useState("food");
  const [decks] = usePersistentState("@dreammanager/pos-decks", DEFAULT_DECK_ITEMS);
  const [cart, setCart] = usePersistentState("@dreammanager/pos-register-cart", []);
  const [lastTotal, setLastTotal] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const items = decks?.[deckKey] || DEFAULT_DECK_ITEMS[deckKey] || [];
  const isImport = deckKey === "import";

  // What a line costs, in priority order.
  //
  // Noa's ledger outranks the deck's own figure: she is recording what was
  // actually paid to a supplier, which supersedes whatever the price list was
  // seeded with. Zero is reached only when neither knows — and the summary
  // marks those lines rather than letting an unknown cost pass as a free one.
  const lineCost = (line) => {
    const known = costFor(costs, line.name);
    if (known != null) return known;
    if (typeof line.cost === "number") return line.cost;
    return 0;
  };

  const totals = useMemo(() => {
    const gross = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
    const cost = cart.reduce((sum, l) => sum + lineCost(l) * l.qty, 0);
    const units = cart.reduce((n, l) => n + l.qty, 0);
    const unknown = cart.filter((l) => costFor(costs, l.name) == null && typeof l.cost !== "number");
    return { gross, cost, profit: gross - cost, units, unknown };
  }, [cart, costs]);

  const add = (item, qty = 1) => {
    hapticLight();
    setCart((prev) => {
      const found = prev.find((l) => l.sku === item.sku);
      if (found) return prev.map((l) => (l.sku === item.sku ? { ...l, qty: l.qty + qty } : l));
      return [
        ...prev,
        { id: uid(), sku: item.sku, name: item.name, price: item.price, cost: item.cost, itemId: item.itemId || null, qty },
      ];
    });
  };

  const addManual = (name, price) => {
    const clean = String(name || "").trim();
    const value = parseFloat(price);
    if (!clean || !Number.isFinite(value) || value <= 0) return false;
    hapticSuccess();
    // A unique sku per manual line, so two different one-offs that happen to
    // cost the same stay two lines instead of merging into a quantity of two.
    setCart((prev) => [
      ...prev,
      { id: uid(), sku: `manual-${uid()}`, name: clean, price: value, itemId: null, qty: 1, manual: true },
    ]);
    return true;
  };

  const addScanned = () => {
    setScanOpen(false);
    setCart((prev) => [
      ...prev,
      {
        id: uid(),
        sku: `scan-${uid()}`,
        name: SCAN_PLACEHOLDER.name,
        price: SCAN_PLACEHOLDER.price,
        itemId: null,
        qty: 1,
        scanned: true,
      },
    ]);
  };

  const bump = (sku, delta) => {
    if (delta < 0) hapticWarning();
    else hapticLight();
    setCart((prev) => prev.map((l) => (l.sku === sku ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));
  };

  const clear = () => {
    if (!cart.length) return;
    hapticWarning();
    setCart([]);
    setExpanded(false);
  };

  // Charging opens the summary; nothing is written until the sale is
  // completed. Showing profit before the till closes is only worth doing while
  // it is still a decision.
  const openSummary = () => {
    if (!cart.length) return;
    hapticLight();
    setSummaryOpen(true);
  };

  const completeSale = () => {
    if (!cart.length) return;
    hapticSuccess();
    const txId = uid();
    const ts = Date.now();

    const records = cart.map((l) => {
      const unit = lineCost(l);
      return {
        id: uid(),
        // Stamped by the app, not by the server. serverTimestamp() resolves to
        // null on a write made offline, and the sync's last-write-wins would
        // then rank a real sale below anything already in the cloud.
        updatedAt: ts,
        ts,
        day: todayKey(),
        month: monthKey(),
        itemId: l.itemId,
        name: l.name,
        category: deckKey === "food" ? "snacks" : "electronics",
        qty: l.qty,
        price: l.price,
        cost: unit,
        total: l.price * l.qty,
        profit: (l.price - unit) * l.qty,
        kind: "sale",
        eventId: txId,
        sku: l.sku,
      };
    });

    setSales((prev) => [...(prev || []), ...records]);

    // Straight to the cloud rather than waiting for the next reconciliation
    // pass. Not awaited, and its failure is not surfaced: the sale is already
    // committed to local state, which is what the register and every report
    // read from. Offline this resolves once Firestore has queued it, and the
    // queue drains on reconnect — so the cashier never waits on a network.
    if (user?.uid) pushMany(user.uid, "sales", records);

    // Deck lines only touch stock when explicitly linked to a warehouse item.
    // Matching on name would be a guess, and a guess that silently decrements
    // the wrong row is worse than not decrementing.
    const linked = cart.filter((l) => l.itemId);
    if (linked.length && setInventory) {
      setInventory((prev) =>
        (prev || []).map((inv) => {
          const line = linked.find((l) => l.itemId === inv.id);
          if (!line) return inv;
          return { ...inv, qty: Math.max(0, inv.qty - line.qty), sold: (inv.sold || 0) + line.qty };
        })
      );
    }

    setLastTotal(totals.gross);
    setCart([]);
    setExpanded(false);
    setSummaryOpen(false);
  };

  const todayGross = useMemo(() => {
    const day = todayKey();
    return (sales || []).filter((r) => r.day === day && r.kind === "sale").reduce((n, r) => n + (r.total || 0), 0);
  }, [sales]);

  const cartHeight = expanded ? 300 : cart.length ? 132 : 74;

  return (
    <View style={st.wrap}>
      {/* Mode switch + today's takings */}
      <View style={st.topRow}>
        <View style={st.deckSwitch}>
          {DECKS.map((d) => {
            const on = d.key === deckKey;
            return (
              <TouchableOpacity
                key={d.key}
                testID={`deck-${d.key}`}
                style={[st.deckBtn, on && { backgroundColor: d.color }]}
                onPress={() => {
                  hapticLight();
                  setDeckKey(d.key);
                }}
              >
                <Icon name={d.icon} size={15} color={on ? "#FFFFFF" : UI.inkSoft} />
                <CustomText style={[st.deckText, on && { color: "#FFFFFF" }]}>{d.label}</CustomText>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={st.todayBox}>
          <CustomText style={st.todayLabel}>היום</CustomText>
          <CustomText testID="pos-today" style={st.todayValue}>
            {shekel(todayGross)}
          </CustomText>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isImport ? (
          <ScanMode onScan={() => setScanOpen(true)} bottomPad={cartHeight + bottomInset} />
        ) : (
          <>
            <FlashList
              testID="pos-deck"
              data={items}
              numColumns={NUM_COLUMNS}
              keyExtractor={(item) => item.sku}
              extraData={cart}
              contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: cartHeight + bottomInset + 16 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                manualAllowed ? (
                  <TouchableOpacity
                    testID="manual-open"
                    style={st.manualBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      hapticLight();
                      setManualOpen(true);
                    }}
                  >
                    <Icon name="edit-3" size={17} color={UI.violet} />
                    <CustomText style={st.manualText}>פריט ידני</CustomText>
                    <CustomText style={st.manualHint}>שם ומחיר, לפריט שלא בתפריט</CustomText>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item, index }) => {
                const inCart = cart.find((l) => l.sku === item.sku);
                const margin = marginOf(item);
                return (
                  <Animated.View entering={FadeIn.delay(Math.min(index, 11) * 22)} style={st.cell}>
                    <TouchableOpacity
                      testID={`deck-item-${item.sku}`}
                      activeOpacity={0.8}
                      style={[st.tile, inCart && { borderColor: UI.violet, backgroundColor: tint(UI.violet, 0.05) }]}
                      onPress={() => add(item)}
                    >
                      {!!inCart && (
                        <View style={st.tileBadge}>
                          <CustomText style={st.tileBadgeText}>{inCart.qty}</CustomText>
                        </View>
                      )}
                      <Icon name={item.icon} size={19} color={inCart ? UI.violet : UI.inkSoft} />
                      <CustomText style={st.tileName} numberOfLines={2}>
                        {item.name}
                      </CustomText>
                      <CustomText style={st.tilePrice}>{shekel(item.price)}</CustomText>
                      {margin != null && (
                        <CustomText
                          style={[st.tileMargin, { color: margin >= 0.5 ? UI.green : margin >= 0.25 ? UI.amber : UI.red }]}
                        >
                          {Math.round(margin * 100)}% רווח
                        </CustomText>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              }}
            />

            <VoiceOrderButton
              deck={items}
              onLines={(lines) => lines.forEach((l) => add(l.item, l.qty))}
              label="הכתבת הזמנה או ספירה"
            />
          </>
        )}
      </View>

      {/* The cart, docked */}
      <Animated.View layout={Layout.springify().damping(18)} style={[st.cart, { height: cartHeight, paddingBottom: bottomInset }]}>
        <TouchableOpacity
          testID="cart-toggle"
          activeOpacity={0.9}
          style={st.cartHead}
          onPress={() => {
            if (!cart.length) return;
            hapticLight();
            setExpanded((e) => !e);
          }}
        >
          <View style={st.cartCount}>
            <CustomText style={st.cartCountText}>{totals.units}</CustomText>
          </View>
          <View style={{ flex: 1 }}>
            <CustomText style={st.cartTitle}>
              {cart.length
                ? `${cart.length} שורות בעגלה`
                : lastTotal != null
                  ? `נסגרה עסקה על ${shekel(lastTotal)}`
                  : "העגלה ריקה"}
            </CustomText>
            {cart.length > 0 && (
              <CustomText testID="cart-profit" style={st.cartSub}>
                רווח צפוי {shekel(totals.profit)} · עלות {shekel(totals.cost)}
              </CustomText>
            )}
          </View>
          <CustomText testID="cart-total" style={st.cartTotal}>
            {shekel(totals.gross)}
          </CustomText>
          {cart.length > 0 && <Icon name={expanded ? "chevron-down" : "chevron-up"} size={18} color={UI.inkMuted} />}
        </TouchableOpacity>

        {expanded && (
          <View style={st.lines}>
            <FlashList
              data={cart}
              keyExtractor={(l) => l.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: l }) => (
                <Animated.View entering={FadeInDown.duration(160)} style={st.line}>
                  <View style={st.qtyGroup}>
                    <TouchableOpacity style={st.qtyBtn} onPress={() => bump(l.sku, -1)}>
                      <Icon name="minus" size={14} color={UI.inkSoft} />
                    </TouchableOpacity>
                    <CustomText style={st.qtyText}>{l.qty}</CustomText>
                    <TouchableOpacity style={st.qtyBtn} onPress={() => bump(l.sku, 1)}>
                      <Icon name="plus" size={14} color={UI.inkSoft} />
                    </TouchableOpacity>
                  </View>
                  <CustomText style={st.lineName} numberOfLines={1}>
                    {l.name}
                  </CustomText>
                  <CustomText style={st.lineTotal}>{shekel(l.price * l.qty)}</CustomText>
                </Animated.View>
              )}
            />
          </View>
        )}

        {cart.length > 0 && (
          <View style={st.cartActions}>
            <TouchableOpacity testID="cart-charge" style={st.charge} onPress={openSummary}>
              <Icon name="check" size={18} color="#FFFFFF" />
              <CustomText style={st.chargeText}>חייב {shekel(totals.gross)}</CustomText>
            </TouchableOpacity>
            <TouchableOpacity testID="cart-clear" style={st.clear} onPress={clear}>
              <Icon name="trash-2" size={17} color={UI.red} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <ManualItemModal
        visible={manualOpen && manualAllowed}
        onClose={() => setManualOpen(false)}
        onAdd={addManual}
      />
      <ScanCamera visible={scanOpen} onScanned={addScanned} onClose={() => setScanOpen(false)} />
      <CheckoutSummary
        visible={summaryOpen}
        totals={totals}
        cart={cart}
        lineCost={lineCost}
        onClose={() => setSummaryOpen(false)}
        onComplete={completeSale}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// AliExpress mode: exactly one thing to do.

function ScanMode({ onScan, bottomPad }) {
  return (
    <View style={[st.scanWrap, { paddingBottom: bottomPad }]}>
      <TouchableOpacity testID="scan-open" style={st.scanBtn} activeOpacity={0.88} onPress={onScan}>
        <View style={st.scanIcon}>
          <Icon name="maximize" size={34} color="#FFFFFF" />
        </View>
        <CustomText style={st.scanTitle}>סרוק פריט</CustomText>
        <CustomText style={st.scanSub}>פותח את המצלמה במסך מלא</CustomText>
      </TouchableOpacity>

      <CustomText style={st.scanNote}>
        במצב אליאקספרס אין הזנה ידנית — פריט נכנס לעגלה רק דרך סריקה, כדי שאותו מוצר לא ייכנס למערכת בארבעה איותים שונים.
      </CustomText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Manual line — fast food only.

function ManualItemModal({ visible, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const close = () => {
    setName("");
    setPrice("");
    onClose();
  };

  const submit = () => {
    if (onAdd(name, price)) close();
    else hapticWarning();
  };

  const valid = name.trim().length > 0 && parseFloat(price) > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={st.backdrop} onPress={close}>
        <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={st.sheetHead}>
            <TouchableOpacity style={st.sheetBtn} onPress={close}>
              <Icon name="x" size={18} color={UI.ink} />
            </TouchableOpacity>
            <CustomText style={st.sheetTitle}>פריט ידני</CustomText>
          </View>

          <CustomText style={st.fieldLabel}>שם הפריט</CustomText>
          <TextInput
            testID="manual-name"
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder="למשל: מנה מיוחדת"
            placeholderTextColor={UI.inkMuted}
            textAlign="right"
          />

          <CustomText style={st.fieldLabel}>מחיר</CustomText>
          <TextInput
            testID="manual-price"
            style={st.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={UI.inkMuted}
            textAlign="center"
            onSubmitEditing={submit}
          />

          <TouchableOpacity
            testID="manual-add"
            style={[st.primaryBtn, !valid && { opacity: 0.4 }]}
            disabled={!valid}
            onPress={submit}
          >
            <CustomText style={st.primaryText}>הוסף לעגלה</CustomText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// The checkout summary.

function CheckoutSummary({ visible, totals, cart, lineCost, onClose, onComplete }) {
  const margin = totals.gross > 0 ? totals.profit / totals.gross : null;

  // Ma'aser, at the rate set in Settings → תצורת קופה.
  //
  // Taken off the *profit*, not the revenue — the money that came in to cover
  // the cost of the goods was never income. Shown only when there is a profit
  // to take it from: a loss-making sale owes nothing, and rendering "₪0" or a
  // negative figure here would just be noise.
  const { maaserRate } = useSettings();
  const maaserPct = Math.max(0, parseFloat(maaserRate) || 0);
  const maaser = maaserPct > 0 && totals.profit > 0 ? (totals.profit * maaserPct) / 100 : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={st.sheetHead}>
            <TouchableOpacity testID="summary-close" style={st.sheetBtn} onPress={onClose}>
              <Icon name="x" size={18} color={UI.ink} />
            </TouchableOpacity>
            <CustomText style={st.sheetTitle}>סיכום עסקה</CustomText>
          </View>

          <View style={st.sumRow}>
            <CustomText testID="sum-revenue" style={st.sumValue}>
              {shekel(totals.gross)}
            </CustomText>
            <CustomText style={st.sumLabel}>הכנסה</CustomText>
          </View>
          <View style={st.sumRow}>
            <CustomText testID="sum-cost" style={[st.sumValue, { color: UI.amber }]}>
              −{shekel(totals.cost)}
            </CustomText>
            <CustomText style={st.sumLabel}>עלות סחורה</CustomText>
          </View>

          <View style={st.sumDivider} />

          <View style={st.sumRow}>
            <CustomText testID="sum-profit" style={[st.sumProfit, { color: totals.profit >= 0 ? UI.green : UI.red }]}>
              {shekel(totals.profit)}
            </CustomText>
            <View style={{ flex: 1 }}>
              <CustomText style={st.sumProfitLabel}>רווח נקי</CustomText>
              {margin != null && <CustomText style={st.sumMargin}>{Math.round(margin * 100)}% מתח רווח</CustomText>}
            </View>
          </View>

          {maaser > 0 && (
            <View style={st.sumRow}>
              <CustomText testID="sum-maaser" style={[st.sumValue, { color: UI.cyan }]}>
                {shekel(maaser)}
              </CustomText>
              <CustomText style={st.sumLabel}>מעשר ({maaserPct}% מהרווח)</CustomText>
            </View>
          )}

          {/* Which lines had no cost behind them. Without this the profit reads
              as precise on a cart where half the costs are simply unknown —
              and an unknown cost inflates profit rather than shrinking it, so
              the error always flatters. */}
          {totals.unknown.length > 0 && (
            <View testID="sum-unknown" style={st.unknownBox}>
              <Icon name="alert-triangle" size={13} color={UI.amber} />
              <CustomText style={st.unknownText}>
                אין עלות ידועה ל־{totals.unknown.map((l) => l.name).join(", ")} — נספרו כ־0, כך שהרווח למעלה גבוה מהאמיתי.
                אפשר לומר לנועה כמה הם עלו.
              </CustomText>
            </View>
          )}

          <View style={st.sumLines}>
            {cart.map((l) => (
              <View key={l.id} style={st.sumLine}>
                <CustomText style={st.sumLineQty}>{l.qty}×</CustomText>
                <CustomText style={st.sumLineName} numberOfLines={1}>
                  {l.name}
                </CustomText>
                <CustomText style={st.sumLineCost}>עלות {shekel(lineCost(l) * l.qty)}</CustomText>
                <CustomText style={st.sumLineTotal}>{shekel(l.price * l.qty)}</CustomText>
              </View>
            ))}
          </View>

          <TouchableOpacity testID="summary-complete" style={st.primaryBtn} onPress={onComplete}>
            <Icon name="check" size={17} color="#FFFFFF" />
            <CustomText style={st.primaryText}>סגור עסקה</CustomText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1 },

  topRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  deckSwitch: { flex: 1, flexDirection: "row-reverse", gap: 6, backgroundColor: UI.surfaceHi, borderRadius: 14, padding: 4 },
  deckBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 11,
  },
  deckText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },
  todayBox: { alignItems: "flex-end" },
  todayLabel: { fontFamily: FONTS.regular, fontSize: 10.5, color: UI.inkMuted },
  todayValue: { fontFamily: FONTS.bold, fontSize: 16, color: UI.green },

  manualBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 5,
    marginBottom: 8,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: tint(UI.violet, 0.35),
    backgroundColor: tint(UI.violet, 0.04),
  },
  manualText: { fontFamily: FONTS.bold, fontSize: 13.5, color: UI.violet },
  manualHint: { flex: 1, fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "right" },

  cell: { flex: 1, padding: 5 },
  tile: {
    minHeight: 104,
    borderRadius: 16,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 10,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  tileBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 7,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBadgeText: { fontFamily: FONTS.bold, fontSize: 11, color: "#FFFFFF" },
  tileName: { fontFamily: FONTS.semibold, fontSize: 11.5, color: UI.ink, textAlign: "center", lineHeight: 15 },
  tilePrice: { fontFamily: FONTS.bold, fontSize: 14, color: UI.ink },
  tileMargin: { fontFamily: FONTS.medium, fontSize: 9.5 },

  scanWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, gap: 20 },
  scanBtn: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 34,
    borderRadius: 26,
    backgroundColor: UI.surface,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  scanIcon: {
    width: 84,
    height: 84,
    borderRadius: 30,
    backgroundColor: UI.cyan,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  scanTitle: { fontFamily: FONTS.bold, fontSize: 20, color: UI.ink },
  scanSub: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkMuted },
  scanNote: { fontFamily: FONTS.regular, fontSize: 12, color: UI.inkMuted, textAlign: "center", lineHeight: 19 },

  cart: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: UI.hairline,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 12,
    overflow: "hidden",
  },
  cartHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16, height: 62 },
  cartCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: tint(UI.violet, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  cartCountText: { fontFamily: FONTS.bold, fontSize: 14, color: UI.violet },
  cartTitle: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.ink, textAlign: "right" },
  cartSub: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  cartTotal: { fontFamily: FONTS.bold, fontSize: 19, color: UI.ink },

  lines: { flex: 1, paddingHorizontal: 12 },
  line: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 50 },
  qtyGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: UI.surfaceHi, borderRadius: 11, padding: 3 },
  qtyBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: UI.surface, alignItems: "center", justifyContent: "center" },
  qtyText: { fontFamily: FONTS.bold, fontSize: 13, color: UI.ink, minWidth: 20, textAlign: "center" },
  lineName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13.5, color: UI.ink, textAlign: "right" },
  lineTotal: { fontFamily: FONTS.bold, fontSize: 14, color: UI.ink },

  cartActions: { flexDirection: "row-reverse", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  charge: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: UI.green,
  },
  chargeText: { fontFamily: FONTS.bold, fontSize: 15.5, color: "#FFFFFF" },
  clear: {
    width: 52,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: tint(UI.red, 0.09),
    alignItems: "center",
    justifyContent: "center",
  },

  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  sheetHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 2 },
  sheetBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: UI.surfaceHi, alignItems: "center", justifyContent: "center" },
  sheetTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, color: UI.ink, textAlign: "right" },

  fieldLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkSoft, textAlign: "right" },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.hairline,
    paddingHorizontal: 14,
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: UI.ink,
  },
  primaryBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: UI.violet,
    marginTop: 6,
  },
  primaryText: { fontFamily: FONTS.bold, fontSize: 15.5, color: "#FFFFFF" },

  sumRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 40 },
  sumLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: UI.inkSoft, textAlign: "right" },
  sumValue: { fontFamily: FONTS.bold, fontSize: 17, color: UI.ink },
  sumDivider: { height: 1, backgroundColor: UI.hairline, marginVertical: 4 },
  sumProfit: { fontFamily: FONTS.bold, fontSize: 26 },
  sumProfitLabel: { fontFamily: FONTS.bold, fontSize: 15, color: UI.ink, textAlign: "right" },
  sumMargin: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 2 },

  unknownBox: { flexDirection: "row-reverse", gap: 8, backgroundColor: tint(UI.amber, 0.1), borderRadius: 12, padding: 11 },
  unknownText: { flex: 1, fontFamily: FONTS.regular, fontSize: 11.5, color: UI.amber, textAlign: "right", lineHeight: 18 },

  sumLines: { gap: 4, marginTop: 4 },
  sumLine: { flexDirection: "row-reverse", alignItems: "center", gap: 8, minHeight: 26 },
  sumLineQty: { fontFamily: FONTS.bold, fontSize: 12, color: UI.violet, minWidth: 24 },
  sumLineName: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, color: UI.ink, textAlign: "right" },
  sumLineCost: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted },
  sumLineTotal: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.ink, minWidth: 52, textAlign: "left" },
});
