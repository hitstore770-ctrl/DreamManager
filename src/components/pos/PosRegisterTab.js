import { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import Icon from "../Icon";
import CustomText from "../CustomText";
import VoiceOrderButton from "./VoiceOrderButton";
import { useBusiness } from "../../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { DECKS, DEFAULT_DECK_ITEMS, marginOf } from "../../utils/posCatalog";
import { monthKey, shekel, todayKey, uid } from "../../utils/posStore";
import { usePersistentState } from "../../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { BEVEL, CARD_SHADOW, UI, tint } from "../../utils/ui";

// The register itself.
//
// Layout: the deck fills the screen and the cart is docked to the bottom,
// collapsed to a single summary bar until there is something in it. That is
// the split a phone can actually take — a true side-by-side puts both halves
// under ~180pt of width, and the product buttons stop being tappable.
//
// The deck is a FlashList grid rather than a mapped View. With two decks of a
// dozen items that is not about the item count; it is about recycling cells so
// a deck switch does not re-mount two dozen components mid-tap.
//
// One correction to the older POS worth naming: this one carries `cost` on
// every line, so the sale records it writes have real profit on them. The
// previous register recorded profit as though everything cost nothing, which
// makes every margin downstream of it wrong in the same direction.

const NUM_COLUMNS = 3;

export default function PosRegisterTab({ bottomInset = 0 }) {
  const { sales, setSales, inventory, setInventory } = useBusiness();

  const [deckKey, setDeckKey] = useState("food");
  const [decks] = usePersistentState("@dreammanager/pos-decks", DEFAULT_DECK_ITEMS);
  const [cart, setCart] = usePersistentState("@dreammanager/pos-register-cart", []);
  const [lastTotal, setLastTotal] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const items = decks?.[deckKey] || DEFAULT_DECK_ITEMS[deckKey] || [];

  const totals = useMemo(() => {
    const gross = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
    const cost = cart.reduce((sum, l) => sum + (l.cost || 0) * l.qty, 0);
    const units = cart.reduce((n, l) => n + l.qty, 0);
    return { gross, cost, profit: gross - cost, units };
  }, [cart]);

  const add = (item, qty = 1) => {
    hapticLight();
    setCart((prev) => {
      const found = prev.find((l) => l.sku === item.sku);
      if (found) return prev.map((l) => (l.sku === item.sku ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { id: uid(), sku: item.sku, name: item.name, price: item.price, cost: item.cost, itemId: item.itemId || null, qty }];
    });
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

  // Charging writes into the same sales store the Z-report, the dashboard and
  // the analytics tab read, so a sale rung up here shows up in all of them
  // without any syncing step.
  const charge = () => {
    if (!cart.length) return;
    hapticSuccess();
    const txId = uid();
    const ts = Date.now();

    const records = cart.map((l) => ({
      id: uid(),
      ts,
      day: todayKey(),
      month: monthKey(),
      itemId: l.itemId,
      name: l.name,
      category: deckKey === "food" ? "snacks" : "electronics",
      qty: l.qty,
      price: l.price,
      cost: l.cost || 0,
      total: l.price * l.qty,
      profit: (l.price - (l.cost || 0)) * l.qty,
      kind: "sale",
      eventId: txId,
      sku: l.sku,
    }));

    setSales((prev) => [...(prev || []), ...records]);

    // Deck lines only touch stock when they are explicitly linked to a
    // warehouse item. Matching on name would be a guess, and a guess that
    // silently decrements the wrong row is worse than not decrementing.
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
  };

  const todaySales = useMemo(() => {
    const day = todayKey();
    return (sales || []).filter((r) => r.day === day && r.kind === "sale");
  }, [sales]);
  const todayGross = todaySales.reduce((n, r) => n + (r.total || 0), 0);

  const cartHeight = expanded ? 300 : cart.length ? 132 : 74;

  return (
    <View style={st.wrap}>
      {/* Deck switch + today's takings */}
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

      {/* The deck */}
      <View style={{ flex: 1 }}>
        <FlashList
          testID="pos-deck"
          data={items}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.sku}
          extraData={cart}
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: cartHeight + bottomInset + 16 }}
          showsVerticalScrollIndicator={false}
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
                    <CustomText style={[st.tileMargin, { color: margin >= 0.5 ? UI.green : margin >= 0.25 ? UI.amber : UI.red }]}>
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
              {cart.length ? `${cart.length} שורות בעגלה` : lastTotal != null ? `נסגרה עסקה על ${shekel(lastTotal)}` : "העגלה ריקה"}
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
            <TouchableOpacity testID="cart-charge" style={st.charge} onPress={charge}>
              <Icon name="check" size={18} color="#FFFFFF" />
              <CustomText style={st.chargeText}>חייב {shekel(totals.gross)}</CustomText>
            </TouchableOpacity>
            <TouchableOpacity testID="cart-clear" style={st.clear} onPress={clear}>
              <Icon name="trash-2" size={17} color={UI.red} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
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
});
