import { useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown, FadeOut, Layout } from "react-native-reanimated";

import Icon from "../Icon";
import CustomText from "../CustomText";
import ScanCamera from "./ScanCamera";
import VoiceOrderButton from "./VoiceOrderButton";
import { useAuth } from "../../context/AuthContext";
import { useBusiness } from "../../context/BusinessContext";
import { useNotes } from "../../context/NotesContext";
import { useSettings } from "../../context/SettingsContext";
import { costFor, useItemCosts } from "../../utils/costStore";
import { pushMany } from "../../utils/cloudSync";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { DECKS, DEFAULT_DECK_ITEMS, marginOf } from "../../utils/posCatalog";
import { crossSellSuggestion, monthKey, shekel, suggestRetailPrice, todayKey, uid } from "../../utils/posStore";
import { STORAGE_KEYS } from "../../utils/storageKeys";
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

// Quick-Tap category filter, food deck only — the AliExpress deck has no
// grid to filter (see ScanMode below).
const FOOD_CATEGORIES = [
  { key: "all", label: "הכל" },
  { key: "food", label: "מנות" },
  { key: "drink", label: "שתייה" },
  { key: "snack", label: "חטיפים" },
];
const CATEGORY_TINT = { food: UI.violet, drink: UI.cyan, snack: UI.amber };

// ComboMaker: a drink and a snack in the same cart is a pairing worth
// rewarding. Flat ₪ off per pairing, capped by however many complete pairs
// exist — two drinks and one snack is one combo, not two.
const COMBO_SAVINGS = 3;

// Late-night delivery/counter surcharge. A flat add-on rather than a
// multiplier: simple enough that a cashier reading the receipt understands
// it at a glance, which a percentage on top of already-adjusted totals would
// not be.
const LATE_NIGHT_SURCHARGE = 5;
function isLateNightNow() {
  const h = new Date().getHours();
  return h >= 23 || h < 4;
}

export default function PosRegisterTab({ bottomInset = 0 }) {
  const { sales, setSales, inventory, setInventory, debts, setDebts } = useBusiness();
  const { user } = useAuth();
  const costs = useItemCosts();
  // Settings → תצורת קופה. Off hides the manual line entirely, which is the
  // point: a register that can invent items cannot be reconciled against the
  // deck, and some days the owner wants exactly that discipline.
  const { allowManualItems, droneAllocPct } = useSettings();
  const manualAllowed = allowManualItems !== false;
  const allocPct = Math.max(0, parseFloat(droneAllocPct) || 0);

  // The drone fund — same two keys MoneyDashboardScreen.js reads, so every
  // sale's automatic sweep shows up there live via usePersistentState's
  // cross-hook broadcast, with no context or navigation involved.
  const [droneSaved, setDroneSaved] = usePersistentState(STORAGE_KEYS.droneSaved, 0);
  const [droneAutoDaily, setDroneAutoDaily] = usePersistentState(STORAGE_KEYS.droneAutoDaily, {
    day: "",
    amount: 0,
  });

  // Notes pinned from the editor's "הצמד לקופה" toggle — a shift note, a
  // supplier reminder — surfaced where the register is actually being used
  // rather than left in the Notes tab where nobody checks mid-sale.
  const { notes } = useNotes();
  const pinnedNotes = (notes || []).filter((n) => n.isPinnedToPOS);

  const [deckKey, setDeckKey] = useState("food");
  const [decks] = usePersistentState("@dreammanager/pos-decks", DEFAULT_DECK_ITEMS);
  const [cart, setCart] = usePersistentState("@dreammanager/pos-register-cart", []);
  const [lastTotal, setLastTotal] = useState(null);
  // Snapshot of the cart at the moment a sale closes, kept only so the
  // checkout sheet can offer a WhatsApp receipt after completeSale has
  // already cleared the live cart — the receipt reads from this, not from
  // `cart`, so it stays correct even after the register resets for the next
  // customer.
  const [receipt, setReceipt] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // A scanned barcode with no inventory match waits here until the "Add New
  // Product" modal either saves it (stamping the barcode onto the new
  // inventory row so the next scan finds it) or is dismissed.
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState(null);

  // Cross-sell nudge — a non-blocking banner, not an Alert: a cashier mid-sale
  // should be free to keep tapping through it rather than dismiss a dialog.
  const [crossSellToast, setCrossSellToast] = useState(null);
  const crossSellTimer = useRef(null);
  const showCrossSell = (itemName, hint) => {
    if (crossSellTimer.current) clearTimeout(crossSellTimer.current);
    setCrossSellToast({ itemName, ...hint });
    crossSellTimer.current = setTimeout(() => setCrossSellToast(null), 4500);
  };

  // Payment method for the sale about to close. "tab" (הקפה) defers payment
  // to a customer's running balance in DebtsScreen instead of collecting now.
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tabCustomerName, setTabCustomerName] = useState("");

  const items = decks?.[deckKey] || DEFAULT_DECK_ITEMS[deckKey] || [];
  const isImport = deckKey === "import";
  const filteredItems = useMemo(() => {
    if (isImport || categoryFilter === "all") return items;
    return items.filter((it) => it.category === categoryFilter);
  }, [items, categoryFilter, isImport]);

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

    // ComboMaker: a drink and a snack together, ₪ off per complete pairing.
    const drinkQty = cart.filter((l) => l.category === "drink").reduce((n, l) => n + l.qty, 0);
    const snackQty = cart.filter((l) => l.category === "snack").reduce((n, l) => n + l.qty, 0);
    const comboCount = Math.min(drinkQty, snackQty);
    const comboDiscount = comboCount * COMBO_SAVINGS;

    // Read at totals-compute-time (cart/costs changing), not on a ticking
    // clock — a cart left open exactly across the 23:00 boundary won't flip
    // until the next add/remove, which is an acceptable edge case for a flat
    // counter surcharge rather than reason to run a timer for it.
    const lateNightSurcharge = isLateNightNow() ? LATE_NIGHT_SURCHARGE : 0;

    const amountDue = gross - comboDiscount + lateNightSurcharge;
    const profit = amountDue - cost;

    return { gross, cost, profit, units, unknown, comboCount, comboDiscount, lateNightSurcharge, amountDue };
  }, [cart, costs]);

  const add = (item, qty = 1) => {
    hapticLight();
    setCart((prev) => {
      const found = prev.find((l) => l.sku === item.sku);
      if (found) return prev.map((l) => (l.sku === item.sku ? { ...l, qty: l.qty + qty } : l));
      return [
        ...prev,
        {
          id: uid(),
          sku: item.sku,
          name: item.name,
          price: item.price,
          cost: item.cost,
          category: item.category || null,
          itemId: item.itemId || null,
          qty,
        },
      ];
    });
    // Checked against the cart *before* this line joins it — cart here is
    // still last render's value, which is exactly "what else is already in
    // the sale" and never includes the line just added.
    const hint = crossSellSuggestion(item.name, cart.map((l) => l.name));
    if (hint) showCrossSell(item.name, hint);
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

  // A scanned barcode either matches a product already in the warehouse — add
  // it straight to the cart, same as tapping a deck tile — or it doesn't,
  // in which case the honest move is to ask what it is rather than inventing
  // a placeholder line, the way the old mock scanner did.
  const addScanned = (barcode) => {
    setScanOpen(false);
    const found = (inventory || []).find((i) => i.barcode && i.barcode === barcode);
    if (found) {
      add({
        sku: found.id,
        name: found.name,
        price: found.price,
        cost: found.cost,
        category: null,
        itemId: found.id,
      });
      return;
    }
    setPendingBarcode(barcode);
    setNewProductOpen(true);
  };

  // Saved from the "Add New Product" sheet: a brand-new inventory row,
  // stamped with the barcode that triggered it (so the *next* scan of the
  // same box finds it), added straight into the sale that's already in
  // progress — the whole reason someone scanned it in the first place.
  const saveNewProduct = ({ name, cost, shipping, price }) => {
    hapticSuccess();
    const landedCost = cost + shipping;
    const newItem = {
      id: uid(),
      name,
      category: "electronics",
      qty: 1,
      cost: landedCost,
      shipping,
      price,
      sold: 0,
      barcode: pendingBarcode,
    };
    setInventory((prev) => [...(prev || []), newItem]);
    add({ sku: newItem.id, name: newItem.name, price: newItem.price, cost: newItem.cost, category: null, itemId: newItem.id });
    setNewProductOpen(false);
    setPendingBarcode(null);
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
    // A tab sale needs someone to put it on — the button below is already
    // disabled in this state, so reaching here means a stray call.
    if (paymentMethod === "tab" && !tabCustomerName.trim()) return;
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
        paymentMethod,
      };
    });

    // ComboMaker discount and the late-night surcharge are register-level
    // adjustments, not lines from the deck — recorded as their own rows so
    // every total that sums posSales (today's takings, the Z-report) reads
    // the amount actually charged rather than the pre-adjustment cart sum.
    const adjustments = [];
    if (totals.comboDiscount > 0) {
      adjustments.push({
        id: uid(),
        updatedAt: ts,
        ts,
        day: todayKey(),
        month: monthKey(),
        itemId: null,
        name: `הנחת קומבו ×${totals.comboCount}`,
        category: "combo",
        qty: 1,
        price: -totals.comboDiscount,
        cost: 0,
        total: -totals.comboDiscount,
        profit: -totals.comboDiscount,
        kind: "sale",
        eventId: txId,
        sku: `combo-${txId}`,
        paymentMethod,
      });
    }
    if (totals.lateNightSurcharge > 0) {
      adjustments.push({
        id: uid(),
        updatedAt: ts,
        ts,
        day: todayKey(),
        month: monthKey(),
        itemId: null,
        name: "תוספת לילה (23:00–04:00)",
        category: "surcharge",
        qty: 1,
        price: totals.lateNightSurcharge,
        cost: 0,
        total: totals.lateNightSurcharge,
        profit: totals.lateNightSurcharge,
        kind: "sale",
        eventId: txId,
        sku: `latenight-${txId}`,
        paymentMethod,
      });
    }

    const allRecords = [...records, ...adjustments];
    setSales((prev) => [...(prev || []), ...allRecords]);

    // Straight to the cloud rather than waiting for the next reconciliation
    // pass. Not awaited, and its failure is not surfaced: the sale is already
    // committed to local state, which is what the register and every report
    // read from. Offline this resolves once Firestore has queued it, and the
    // queue drains on reconnect — so the cashier never waits on a network.
    if (user?.uid) pushMany(user.uid, "sales", allRecords);

    // "On the tab" — the sale is still booked as revenue above (the goods
    // left the shelf today), but the cash isn't in hand yet, so it's also
    // added to the customer's running balance in DebtsScreen for collection.
    if (paymentMethod === "tab") {
      const name = tabCustomerName.trim();
      setDebts((prev) => {
        const existing = (prev || []).find((d) => d.name.trim().toLowerCase() === name.toLowerCase());
        if (existing) {
          return prev.map((d) =>
            d.id === existing.id ? { ...d, owed: (Number(d.owed) || 0) + totals.amountDue } : d
          );
        }
        return [...(prev || []), { id: uid(), name, owed: totals.amountDue, paid: 0 }];
      });
    }

    // Loyalty count — tracked whenever a customer name was given at
    // checkout, regardless of payment method (the field is available for
    // all of them, required only for "tab").
    const loyaltyName = tabCustomerName.trim();
    if (loyaltyName) {
      setLoyaltyCustomers((prev) => {
        const existing = (prev || []).find((c) => c.name.trim().toLowerCase() === loyaltyName.toLowerCase());
        if (existing) {
          return prev.map((c) => (c.id === existing.id ? { ...c, count: (c.count || 0) + 1, lastAt: ts } : c));
        }
        return [...(prev || []), { id: uid(), name: loyaltyName, count: 1, lastAt: ts }];
      });
    }

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

    // Automated Profit Allocation — a slice of THIS sale's own net profit
    // goes straight to the drone fund the instant the sale closes, rather
    // than waiting for someone to notice today's total and swipe a card
    // later (that manual card, on the Money Dashboard, still exists — it
    // now offers what's left after this sweep, not the whole day's profit).
    // A loss-making sale (totals.profit <= 0, e.g. a heavily discounted
    // line) sends nothing: there is no profit to take a percentage of.
    const autoAllocAmount =
      totals.profit > 0 && allocPct > 0 ? Math.round(totals.profit * (allocPct / 100) * 100) / 100 : 0;
    if (autoAllocAmount > 0) {
      setDroneSaved((prev) => Math.round(((Number(prev) || 0) + autoAllocAmount) * 100) / 100);
      setDroneAutoDaily((prev) => {
        const day = todayKey();
        const base = prev?.day === day ? Number(prev.amount) || 0 : 0;
        return { day, amount: Math.round((base + autoAllocAmount) * 100) / 100 };
      });
    }

    setReceipt({
      droneAlloc: autoAllocAmount,
      lines: cart,
      totals,
      ts,
      paymentMethod,
      tabCustomerName: paymentMethod === "tab" ? tabCustomerName.trim() : null,
    });
    setLastTotal(totals.amountDue);
    setCart([]);
    setExpanded(false);
    setPaymentMethod("cash");
    setTabCustomerName("");
  };

  const todayGross = useMemo(() => {
    const day = todayKey();
    return (sales || []).filter((r) => r.day === day && r.kind === "sale").reduce((n, r) => n + (r.total || 0), 0);
  }, [sales]);

  const cartHeight = expanded ? 300 : cart.length ? 132 : 74;
  const canComplete = paymentMethod !== "tab" || tabCustomerName.trim().length > 0;
  const debtorNames = useMemo(
    () => [...new Set((debts || []).map((d) => d.name.trim()).filter(Boolean))],
    [debts]
  );

  // Loyalty club — purchase counts by name, independent of payment method:
  // a cash customer racks up the same count a tab customer does. A separate
  // ledger from `debts` on purpose — owing money and having bought five times
  // are unrelated facts about a customer, and folding them into one record
  // would mean a fully-paid-up regular's history vanishes the moment their
  // balance clears back to zero.
  const [loyaltyCustomers, setLoyaltyCustomers] = usePersistentState(STORAGE_KEYS.loyaltyCustomers, []);

  return (
    <View style={st.wrap}>
      {/* Notes pinned to the register — a compact banner, titles only. The
          note's content is one tap away in the Notes tab; this exists to be
          glanced at, not read. */}
      {pinnedNotes.length > 0 && (
        <Animated.View entering={FadeInDown.duration(220)} style={st.pinnedBanner}>
          <Icon name="shopping-cart" size={13} color={UI.gold} />
          <View style={st.pinnedChips}>
            {pinnedNotes.slice(0, 4).map((n) => (
              <View key={n.id} style={st.pinnedChip}>
                <CustomText style={st.pinnedChipText} numberOfLines={1}>
                  {n.title || "הערה ללא כותרת"}
                </CustomText>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Cross-sell nudge — a banner, not an Alert, so it never blocks the
          next tap. Auto-dismisses; also dismissible by hand. */}
      {crossSellToast && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(180)} style={st.crossSellToast}>
          <Icon name={crossSellToast.icon} size={16} color={UI.gold} />
          <CustomText style={st.crossSellText} numberOfLines={2}>
            הזדמנות למכירה נוספת: הציעו {crossSellToast.suggestion} יחד עם {crossSellToast.itemName}
          </CustomText>
          <TouchableOpacity onPress={() => setCrossSellToast(null)} hitSlop={10}>
            <Icon name="x" size={14} color={UI.inkMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}

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
            {/* Quick-Tap category filter — narrows the grid to one kind of
                item so a busy counter isn't scanning past two rows of drinks
                to find a snack. */}
            <View style={st.categoryRow}>
              {FOOD_CATEGORIES.map((c) => {
                const on = c.key === categoryFilter;
                return (
                  <TouchableOpacity
                    key={c.key}
                    testID={`cat-${c.key}`}
                    style={[st.categoryChip, on && st.categoryChipOn]}
                    onPress={() => {
                      hapticLight();
                      setCategoryFilter(c.key);
                    }}
                  >
                    <CustomText style={[st.categoryChipText, on && st.categoryChipTextOn]}>{c.label}</CustomText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FlashList
              testID="pos-deck"
              data={filteredItems}
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
                const catTint = CATEGORY_TINT[item.category] || UI.inkSoft;
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
                      <View style={[st.tileIconWrap, { backgroundColor: tint(catTint, 0.14) }]}>
                        <Icon name={item.icon} size={22} color={inCart ? UI.violet : catTint} />
                      </View>
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
                {totals.comboDiscount > 0 ? ` · 🎉 קומבו -${shekel(totals.comboDiscount)}` : ""}
                {totals.lateNightSurcharge > 0 ? ` · תוספת לילה +${shekel(totals.lateNightSurcharge)}` : ""}
              </CustomText>
            )}
          </View>
          <CustomText testID="cart-total" style={st.cartTotal}>
            {shekel(totals.amountDue)}
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
              <CustomText style={st.chargeText}>חייב {shekel(totals.amountDue)}</CustomText>
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
      <AddNewProductModal
        visible={newProductOpen}
        barcode={pendingBarcode}
        onClose={() => {
          setNewProductOpen(false);
          setPendingBarcode(null);
        }}
        onSave={saveNewProduct}
      />
      <CheckoutSummary
        visible={summaryOpen}
        totals={totals}
        cart={cart}
        lineCost={lineCost}
        receipt={receipt}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        tabCustomerName={tabCustomerName}
        setTabCustomerName={setTabCustomerName}
        debtorNames={debtorNames}
        loyaltyCustomers={loyaltyCustomers}
        canComplete={canComplete}
        onClose={() => {
          setSummaryOpen(false);
          setReceipt(null);
        }}
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
// A scanned barcode that matched nothing in the warehouse — describe it once,
// and it both joins the inventory (with the barcode attached, so the next
// scan of the same box finds it) and the sale already in progress.

function AddNewProductModal({ visible, barcode, onClose, onSave }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [shipping, setShipping] = useState("");
  const [price, setPrice] = useState("");

  const close = () => {
    setName("");
    setCost("");
    setShipping("");
    setPrice("");
    onClose();
  };

  const costBasis = (parseFloat(cost) || 0) + (parseFloat(shipping) || 0);
  const valid = name.trim().length > 0 && parseFloat(price) > 0;

  const applySuggestion = (pct) => {
    hapticLight();
    setPrice(String(suggestRetailPrice(costBasis, pct)));
  };

  const submit = () => {
    if (!valid) {
      hapticWarning();
      return;
    }
    onSave({
      name: name.trim(),
      cost: parseFloat(cost) || 0,
      shipping: parseFloat(shipping) || 0,
      price: parseFloat(price),
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={st.backdrop} onPress={close}>
        <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={st.sheetHead}>
            <TouchableOpacity style={st.sheetBtn} onPress={close}>
              <Icon name="x" size={18} color={UI.ink} />
            </TouchableOpacity>
            <CustomText style={st.sheetTitle}>מוצר חדש מסריקה</CustomText>
          </View>

          {!!barcode && (
            <View testID="new-product-barcode" style={st.barcodeChip}>
              <Icon name="hash" size={13} color={UI.inkMuted} />
              <CustomText style={st.barcodeChipText}>{barcode}</CustomText>
            </View>
          )}

          <CustomText style={st.fieldLabel}>שם המוצר</CustomText>
          <TextInput
            testID="new-product-name"
            style={st.input}
            value={name}
            onChangeText={setName}
            placeholder="למשל: פאוור בנק 10000"
            placeholderTextColor={UI.inkMuted}
            textAlign="right"
          />

          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <CustomText style={st.fieldLabel}>עלות מוצר</CustomText>
              <TextInput
                testID="new-product-cost"
                style={st.input}
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={UI.inkMuted}
                textAlign="center"
              />
            </View>
            <View style={{ flex: 1 }}>
              <CustomText style={st.fieldLabel}>עלות משלוח</CustomText>
              <TextInput
                testID="new-product-shipping"
                style={st.input}
                value={shipping}
                onChangeText={setShipping}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={UI.inkMuted}
                textAlign="center"
              />
            </View>
          </View>

          {costBasis > 0 && (
            <View style={st.suggestRow}>
              <CustomText style={st.suggestLabel}>מחיר מוצע:</CustomText>
              <TouchableOpacity testID="suggest-40" style={st.suggestChip} onPress={() => applySuggestion(40)}>
                <CustomText style={st.suggestChipText}>{shekel(suggestRetailPrice(costBasis, 40))} · 40%+</CustomText>
              </TouchableOpacity>
              <TouchableOpacity testID="suggest-50" style={st.suggestChip} onPress={() => applySuggestion(50)}>
                <CustomText style={st.suggestChipText}>{shekel(suggestRetailPrice(costBasis, 50))} · 50%+</CustomText>
              </TouchableOpacity>
            </View>
          )}

          <CustomText style={st.fieldLabel}>מחיר מכירה</CustomText>
          <TextInput
            testID="new-product-price"
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
            testID="new-product-save"
            style={[st.primaryBtn, !valid && { opacity: 0.4 }]}
            disabled={!valid}
            onPress={submit}
          >
            <CustomText style={st.primaryText}>הוסף למלאי ולעגלה</CustomText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// The checkout summary.

// Itemized text for the WhatsApp receipt — no fabricated store name or
// address, since nothing in this app's data actually holds one.
function formatReceiptText(receipt) {
  const lines = receipt.lines
    .map((l) => `${l.qty}× ${l.name} — ${shekel(l.price * l.qty)}`)
    .join("\n");
  const due = receipt.totals.amountDue ?? receipt.totals.gross;
  const tabNote = receipt.paymentMethod === "tab" ? `\n(נרשם בהקפה על שם ${receipt.tabCustomerName})` : "";
  return `📋 קבלה\n\n${lines}\n\nסה"כ לתשלום: ${shekel(due)}${tabNote}\n\nתודה על הקנייה! 🙏`;
}

const PAYMENT_METHODS = [
  { key: "cash", label: "מזומן", icon: "dollar-sign" },
  { key: "card", label: "אשראי", icon: "credit-card" },
  { key: "tab", label: "הקפה", icon: "book-open" },
];

function CheckoutSummary({
  visible,
  totals,
  cart,
  lineCost,
  receipt,
  paymentMethod,
  setPaymentMethod,
  tabCustomerName,
  setTabCustomerName,
  debtorNames,
  loyaltyCustomers,
  canComplete,
  onClose,
  onComplete,
}) {
  const margin = totals.gross > 0 ? totals.profit / totals.gross : null;

  // Loyalty milestone check, live as the name is typed — every 5th purchase
  // (5th, 10th, 15th…) for whoever this name matches in the loyalty ledger.
  const loyaltyTrimmed = tabCustomerName.trim();
  const loyaltyMatch = loyaltyTrimmed
    ? (loyaltyCustomers || []).find((c) => c.name.trim().toLowerCase() === loyaltyTrimmed.toLowerCase())
    : null;
  const upcomingPurchaseCount = (loyaltyMatch?.count || 0) + 1;
  const isLoyaltyMilestone = loyaltyTrimmed.length > 0 && upcomingPurchaseCount % 5 === 0;

  // Called unconditionally, above the receipt/summary branch below — both
  // views are the same mounted component instance (the modal's `visible`
  // prop hides it, it doesn't unmount it), so a hook called on only one of
  // the two branches would change hook count mid-lifetime and break React.
  const { maaserRate } = useSettings();
  const maaserPct = Math.max(0, parseFloat(maaserRate) || 0);
  const maaser = maaserPct > 0 && totals.profit > 0 ? (totals.profit * maaserPct) / 100 : 0;

  const sendReceiptToWhatsApp = async () => {
    if (!receipt) return;
    hapticLight();
    const url = `whatsapp://send?text=${encodeURIComponent(formatReceiptText(receipt))}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(formatReceiptText(receipt))}`).catch(() => {});
  };

  if (receipt) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={st.backdrop} onPress={onClose}>
          <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={st.sheetHead}>
              <TouchableOpacity testID="summary-close" style={st.sheetBtn} onPress={onClose}>
                <Icon name="x" size={18} color={UI.ink} />
              </TouchableOpacity>
              <CustomText style={st.sheetTitle}>העסקה נסגרה</CustomText>
            </View>

            <View style={st.receiptDone}>
              <Icon name="check-circle" size={40} color={UI.green} />
              <CustomText testID="receipt-total" style={st.receiptDoneTotal}>
                {shekel(receipt.totals.amountDue)}
              </CustomText>
              <CustomText style={st.receiptDoneSub}>
                {receipt.paymentMethod === "tab" ? `נרשם בהקפה על שם ${receipt.tabCustomerName}` : "נגבה בהצלחה"}
              </CustomText>
              {receipt.droneAlloc > 0 && (
                <View style={st.droneAllocChip}>
                  <Icon name="target" size={13} color={UI.violet} />
                  <CustomText style={st.droneAllocChipText}>
                    {shekel(receipt.droneAlloc)} נשלחו אוטומטית לקרן הרחפן
                  </CustomText>
                </View>
              )}
            </View>

            <TouchableOpacity
              testID="send-whatsapp-receipt"
              style={st.whatsappBtn}
              onPress={sendReceiptToWhatsApp}
            >
              <Icon name="message-circle" size={17} color="#FFFFFF" />
              <CustomText style={st.primaryText}>שליחת קבלה בוואטסאפ</CustomText>
            </TouchableOpacity>

            <TouchableOpacity testID="summary-done" style={st.secondaryBtn} onPress={onClose}>
              <CustomText style={st.secondaryText}>סיום</CustomText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

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

          {totals.comboCount > 0 && (
            <View style={st.sumRow}>
              <CustomText testID="sum-combo" style={[st.sumValue, { color: UI.green }]}>
                −{shekel(totals.comboDiscount)}
              </CustomText>
              <CustomText style={st.sumLabel}>🎉 הנחת קומבו (שתייה + חטיף × {totals.comboCount})</CustomText>
            </View>
          )}

          {totals.lateNightSurcharge > 0 && (
            <View style={st.sumRow}>
              <CustomText testID="sum-latenight" style={[st.sumValue, { color: UI.amber }]}>
                +{shekel(totals.lateNightSurcharge)}
              </CustomText>
              <CustomText style={st.sumLabel}>תוספת לילה (23:00–04:00)</CustomText>
            </View>
          )}

          <View style={st.sumRow}>
            <CustomText testID="sum-cost" style={[st.sumValue, { color: UI.amber }]}>
              −{shekel(totals.cost)}
            </CustomText>
            <CustomText style={st.sumLabel}>עלות סחורה</CustomText>
          </View>

          <View style={st.sumDivider} />

          <View style={st.sumRow}>
            <CustomText testID="sum-due" style={st.sumProfit}>
              {shekel(totals.amountDue)}
            </CustomText>
            <CustomText style={st.sumProfitLabel}>לתשלום</CustomText>
          </View>

          <View style={st.sumRow}>
            <CustomText testID="sum-profit" style={[st.sumValue, { color: totals.profit >= 0 ? UI.green : UI.red }]}>
              {shekel(totals.profit)}
            </CustomText>
            <View style={{ flex: 1 }}>
              <CustomText style={st.sumLabel}>רווח נקי</CustomText>
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

          {/* Payment method — cash/card settle now, a tab defers to a
              customer's running balance in DebtsScreen instead. */}
          <CustomText style={st.fieldLabel}>אופן תשלום</CustomText>
          <View style={st.paymentRow}>
            {PAYMENT_METHODS.map((m) => {
              const on = m.key === paymentMethod;
              return (
                <TouchableOpacity
                  key={m.key}
                  testID={`payment-${m.key}`}
                  style={[st.paymentChip, on && st.paymentChipOn]}
                  onPress={() => {
                    hapticLight();
                    setPaymentMethod(m.key);
                  }}
                >
                  <Icon name={m.icon} size={15} color={on ? "#FFFFFF" : UI.inkSoft} />
                  <CustomText style={[st.paymentChipText, on && { color: "#FFFFFF" }]}>{m.label}</CustomText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Customer name — required to complete a "tab" sale, optional
              (but tracked toward the loyalty club) for every other method. */}
          <CustomText style={st.fieldLabel}>
            {paymentMethod === "tab" ? "שם הלקוח" : "שם הלקוח (לא חובה)"}
          </CustomText>
          <View style={st.tabBox}>
            <TextInput
              testID="tab-customer-name"
              style={st.input}
              value={tabCustomerName}
              onChangeText={setTabCustomerName}
              placeholder="שם הלקוח"
              placeholderTextColor={UI.inkMuted}
              textAlign="right"
            />
            {debtorNames.length > 0 && (
              <View style={st.tabSuggestRow}>
                {debtorNames.slice(0, 6).map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={st.tabSuggestChip}
                    onPress={() => {
                      hapticLight();
                      setTabCustomerName(name);
                    }}
                  >
                    <CustomText style={st.tabSuggestChipText}>{name}</CustomText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {isLoyaltyMilestone && (
              <View testID="loyalty-alert" style={st.loyaltyAlert}>
                <Icon name="award" size={16} color={UI.gold} />
                <CustomText style={st.loyaltyAlertText}>
                  התראת נאמנות: רכישה #{upcomingPurchaseCount}! שקלו להציע 10% הנחה.
                </CustomText>
              </View>
            )}
          </View>

          <TouchableOpacity
            testID="summary-complete"
            style={[st.primaryBtn, !canComplete && { opacity: 0.4 }]}
            disabled={!canComplete}
            onPress={onComplete}
          >
            <Icon name="check" size={17} color="#FFFFFF" />
            <CustomText style={st.primaryText}>סגור עסקה · {shekel(totals.amountDue)}</CustomText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1 },

  pinnedBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: tint(UI.gold, 0.1),
    borderWidth: 1,
    borderColor: tint(UI.gold, 0.28),
  },
  pinnedChips: { flex: 1, flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  pinnedChip: {
    maxWidth: 140,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: UI.surface,
  },
  pinnedChipText: { fontFamily: FONTS.medium, fontSize: 11, color: UI.ink },

  crossSellToast: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: tint(UI.gold, 0.1),
    borderWidth: 1,
    borderColor: tint(UI.gold, 0.28),
  },
  crossSellText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, color: UI.ink, textAlign: "right" },

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

  categoryRow: { flexDirection: "row-reverse", gap: 6, paddingHorizontal: 14, paddingBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.surfaceHi,
  },
  categoryChipOn: { backgroundColor: UI.ink },
  categoryChipText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },
  categoryChipTextOn: { color: "#FFFFFF" },

  // Quick-Tap Grid: a bigger, bolder tile than a dense price list needs,
  // because this grid exists to be hit fast without looking, not read.
  cell: { flex: 1, padding: 5 },
  tile: {
    minHeight: 122,
    borderRadius: 18,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 12,
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
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  tileName: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.ink, textAlign: "center", lineHeight: 16 },
  tilePrice: { fontFamily: FONTS.bold, fontSize: 16, color: UI.ink },
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

  fieldLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkSoft, textAlign: "right", marginTop: 8 },
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

  barcodeChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: UI.surfaceHi,
  },
  barcodeChipText: { fontFamily: FONTS.medium, fontSize: 12, color: UI.inkSoft },
  suggestRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 },
  suggestLabel: { fontFamily: FONTS.medium, fontSize: 12, color: UI.inkMuted },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: tint(UI.green, 0.12),
  },
  suggestChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.green },

  paymentRow: { flexDirection: "row-reverse", gap: 8, marginTop: 6 },
  paymentChip: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: UI.surfaceHi,
  },
  paymentChipOn: { backgroundColor: UI.ink },
  paymentChipText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },
  tabBox: { marginTop: 8, gap: 8 },
  tabSuggestRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  tabSuggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.hairline,
  },
  tabSuggestChipText: { fontFamily: FONTS.medium, fontSize: 12, color: UI.ink },
  loyaltyAlert: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: tint(UI.gold, 0.12),
    borderWidth: 1,
    borderColor: tint(UI.gold, 0.3),
  },
  loyaltyAlertText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.gold, textAlign: "right" },
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

  receiptDone: { alignItems: "center", gap: 6, paddingVertical: 18 },
  receiptDoneTotal: { fontFamily: FONTS.bold, fontSize: 30, color: UI.ink },
  droneAllocChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tint(UI.violet, 0.1),
  },
  droneAllocChipText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.violet },
  receiptDoneSub: { fontFamily: FONTS.medium, fontSize: 13.5, color: UI.inkMuted },
  whatsappBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#25D366",
    marginTop: 6,
  },
  secondaryBtn: { alignItems: "center", justifyContent: "center", minHeight: 46 },
  secondaryText: { fontFamily: FONTS.semibold, fontSize: 14, color: UI.inkMuted },

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
