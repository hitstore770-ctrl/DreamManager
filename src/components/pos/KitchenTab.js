import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import CustomText from "../CustomText";
import Icon from "../Icon";
import { hapticLight, hapticSuccess } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { BEVEL, CARD_SHADOW, UI, tint } from "../../utils/ui";

// מטבח ואריזה — the expo counter.
//
// One question, asked continuously: what is being made right now, and who has
// been waiting longest. So the list is ordered oldest-first and every ticket
// carries a running clock; nothing else competes for the space.
//
// Swipe a ticket to the right to mark it ready. A swipe is the right verb for
// this — hands are busy, the phone is on a shelf, and a small checkbox is a
// bad target when you are holding a basket. It is not the *only* verb, though:
// there is a tap target too, because a gesture-only action is unreachable with
// a switch control or a screen reader, and "wipe your hands first" is not an
// accessibility strategy.

const { width: SCREEN_W } = Dimensions.get("window");

// Far enough that a scroll never trips it, near enough to flick one-handed.
const COMPLETE_AT = 110;
const EXIT_MS = 190;
const COLLAPSE_MS = 210;

// Past this, a ticket is late and the card says so. Five minutes is where a
// counter order starts feeling slow to the person standing there.
const LATE_SECONDS = 300;

// Demo tickets.
//
// There is no order intake yet — the register writes sales, not open tickets —
// so these are seeded, and the header says so rather than letting invented
// orders pass for a live queue. When intake exists, this array is the only
// thing that changes: everything below reads `orders` from state.
const SEED = [
  {
    id: "1042",
    placedAt: Date.now() - 7 * 60000,
    items: [
      { name: "המבורגר", qty: 1, note: "בלי בצל" },
      { name: "צ׳יפס", qty: 1, note: "מנה גדולה" },
    ],
  },
  {
    id: "1043",
    placedAt: Date.now() - 4 * 60000,
    items: [
      { name: "שניצל בלאפה", qty: 2, note: "חריף" },
      { name: "פחית שתייה", qty: 2, note: null },
    ],
  },
  {
    id: "1044",
    placedAt: Date.now() - 2 * 60000,
    items: [{ name: "טוסט", qty: 1, note: "בלי עגבנייה" }],
  },
  {
    id: "1045",
    placedAt: Date.now() - 40000,
    items: [
      { name: "משולש פיצה", qty: 3, note: null },
      { name: "קפה קר", qty: 1, note: "בלי סוכר" },
    ],
  },
];

const MENU = ["המבורגר", "שניצל בלאפה", "טוסט", "צ׳יפס", "משולש פיצה", "סלט אישי"];
const NOTES = ["בלי בצל", "חריף", "בלי עגבנייה", "מנה גדולה", null, null];

let nextId = 1046;

function elapsedLabel(seconds) {
  if (seconds < 60) return "הרגע";
  const m = Math.floor(seconds / 60);
  if (m === 1) return "לפני דקה";
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.floor(m / 60);
  return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
}

export default function KitchenTab({ bottomInset = 0 }) {
  const [orders, setOrders] = useState(SEED);
  const [now, setNow] = useState(Date.now());

  // One interval for the whole board, not one per card. Twenty tickets meant
  // twenty timers in the naive version, each firing on its own offset.
  useEffect(() => {
    if (!orders.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [orders.length]);

  const complete = useCallback((id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const addMock = () => {
    hapticLight();
    const n = 1 + Math.floor(Math.random() * 2);
    setOrders((prev) => [
      ...prev,
      {
        id: String(nextId++),
        placedAt: Date.now(),
        items: Array.from({ length: n }, () => ({
          name: MENU[Math.floor(Math.random() * MENU.length)],
          qty: 1 + Math.floor(Math.random() * 2),
          note: NOTES[Math.floor(Math.random() * NOTES.length)],
        })),
      },
    ]);
  };

  const oldest = orders.length
    ? Math.floor((now - Math.min(...orders.map((o) => o.placedAt))) / 1000)
    : 0;

  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <View style={st.headBadge}>
          <CustomText style={st.headBadgeText}>{orders.length}</CustomText>
        </View>
        <View style={{ flex: 1 }}>
          <CustomText style={st.headTitle}>הזמנות פעילות</CustomText>
          <CustomText style={st.headSub}>
            {orders.length ? `הוותיקה ביותר ${elapsedLabel(oldest)} · החלק ימינה לסימון מוכן` : "אין הזמנות פתוחות"}
          </CustomText>
        </View>
        <TouchableOpacity testID="kitchen-seed" style={st.headBtn} onPress={addMock} activeOpacity={0.8}>
          <Icon name="plus" size={17} color={UI.violet} />
        </TouchableOpacity>
      </View>

      <View style={st.demoChip}>
        <Icon name="info" size={12} color={UI.amber} />
        <CustomText style={st.demoText}>הזמנות הדגמה — אין עדיין קליטת הזמנות אמיתית</CustomText>
      </View>

      {orders.length === 0 ? (
        <View testID="kitchen-empty" style={st.empty}>
          <View style={st.emptyBadge}>
            <Icon name="check-circle" size={26} color={UI.green} />
          </View>
          <CustomText style={st.emptyTitle}>הכול יצא</CustomText>
          <CustomText style={st.emptySub}>אין הזמנות בהמתנה. הוסף הזמנה לבדיקה עם הכפתור למעלה.</CustomText>
        </View>
      ) : (
        <FlashList
          testID="kitchen-list"
          data={orders}
          keyExtractor={(o) => o.id}
          extraData={now}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: bottomInset + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <OrderTicket order={item} index={index} now={now} onComplete={complete} />
          )}
        />
      )}
    </View>
  );
}

function OrderTicket({ order, index, now, onComplete }) {
  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const height = useSharedValue(0); // 0 until measured
  const gap = useSharedValue(10);
  const measured = useRef(false);

  // FlashList recycles cell components, so a row that just slid away can come
  // back holding a different order with its shared values still at the end of
  // the exit animation — an invisible, zero-height ticket. Resetting on the id
  // is what keeps recycling from leaking one order's animation into the next.
  useEffect(() => {
    tx.value = 0;
    opacity.value = 1;
    gap.value = 10;
    if (measured.current) height.value = height.value || 0;
  }, [order.id, tx, opacity, gap, height]);

  const finish = useCallback(() => {
    hapticSuccess();
    onComplete(order.id);
  }, [onComplete, order.id]);

  // Out to the right, then collapse the space it occupied. Doing both at once
  // reads as the row being deleted; doing them in sequence reads as it being
  // sent somewhere, which is what actually happened to the order.
  const runExit = useCallback(() => {
    "worklet";
    opacity.value = withTiming(0, { duration: EXIT_MS });
    tx.value = withTiming(SCREEN_W, { duration: EXIT_MS }, () => {
      gap.value = withTiming(0, { duration: COLLAPSE_MS });
      height.value = withTiming(0, { duration: COLLAPSE_MS }, (done) => {
        if (done) runOnJS(finish)();
      });
    });
  }, [opacity, tx, gap, height, finish]);

  const pan = Gesture.Pan()
    // Only claim the gesture once it is clearly horizontal, so the list still
    // scrolls normally under the same finger.
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      // Rightward only. A leftward drag on a ticket means nothing here, and
      // letting the card follow the finger anyway suggests it does.
      tx.value = Math.max(0, e.translationX);
    })
    .onEnd(() => {
      if (tx.value > COMPLETE_AT) runExit();
      else tx.value = withTiming(0, { duration: 160 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    // `undefined` until the first layout — pinning a height of 0 before the
    // card has been measured would render an invisible row.
    height: height.value > 0 ? height.value : undefined,
    marginBottom: gap.value,
  }));

  // The panel revealed behind the card as it slides.
  const revealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, tx.value / COMPLETE_AT),
  }));

  const seconds = Math.max(0, Math.floor((now - order.placedAt) / 1000));
  const late = seconds >= LATE_SECONDS;
  const units = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <Animated.View style={[st.ticketWrap, wrapStyle]}>
      <Animated.View style={[st.reveal, revealStyle]} pointerEvents="none">
        <Icon name="check" size={20} color="#FFFFFF" />
        <CustomText style={st.revealText}>מוכן</CustomText>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          testID={`kitchen-order-${index}`}
          style={[st.card, late && st.cardLate, cardStyle]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && !measured.current) {
              measured.current = true;
              height.value = h;
            }
          }}
        >
          <View style={st.cardHead}>
            <View style={[st.idChip, late && { backgroundColor: tint(UI.red, 0.12) }]}>
              <CustomText testID={`order-id-${index}`} style={[st.idText, late && { color: UI.red }]}>
                #{order.id}
              </CustomText>
            </View>
            <CustomText testID={`order-elapsed-${index}`} style={[st.elapsed, late && { color: UI.red }]}>
              {elapsedLabel(seconds)}
            </CustomText>
            <View style={{ flex: 1 }} />
            <CustomText style={st.units}>{units} פריטים</CustomText>
          </View>

          {order.items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={st.line}>
              <CustomText style={st.lineQty}>{item.qty}×</CustomText>
              <CustomText style={st.lineName} numberOfLines={2}>
                {item.name}
                {item.note ? <CustomText style={st.lineNote}> — {item.note}</CustomText> : null}
              </CustomText>
            </View>
          ))}

          {/* The same action as the swipe. Present for anyone who cannot make
              the gesture, and quicker when the phone is flat on a counter. */}
          <TouchableOpacity
            testID={`order-ready-${index}`}
            style={st.readyBtn}
            activeOpacity={0.8}
            onPress={() => runExit()}
          >
            <Icon name="check" size={15} color={UI.green} />
            <CustomText style={st.readyText}>מוכן / ארוז</CustomText>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1 },

  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  headBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: tint(UI.amber, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  headBadgeText: { fontFamily: FONTS.bold, fontSize: 14, color: UI.amber },
  headTitle: { fontFamily: FONTS.bold, fontSize: 15, color: UI.ink, textAlign: "right" },
  headSub: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  headBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: tint(UI.violet, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },

  demoChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: tint(UI.amber, 0.1),
  },
  demoText: { fontFamily: FONTS.medium, fontSize: 10.5, color: UI.amber },

  ticketWrap: { overflow: "hidden" },
  reveal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI.green,
    borderRadius: UI.radius,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 22,
  },
  revealText: { fontFamily: FONTS.bold, fontSize: 15, color: "#FFFFFF" },

  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: 14,
    gap: 8,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  cardLate: { borderColor: tint(UI.red, 0.35) },

  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  idChip: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: UI.surfaceHi },
  idText: { fontFamily: FONTS.bold, fontSize: 12.5, color: UI.ink },
  elapsed: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkMuted },
  units: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted },

  line: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  lineQty: { fontFamily: FONTS.bold, fontSize: 13.5, color: UI.violet, minWidth: 24 },
  lineName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13.5, color: UI.ink, textAlign: "right", lineHeight: 20 },
  lineNote: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.amber },

  readyBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: tint(UI.green, 0.09),
    marginTop: 2,
  },
  readyText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.green },

  empty: { alignItems: "center", gap: 8, paddingVertical: 44 },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: tint(UI.green, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 16, color: UI.ink },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: UI.inkMuted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 40,
  },
});
