import { useRef, useState } from "react";
import { Dimensions, I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { CARD_SHADOW, TYPE, UI } from "../../utils/ui";

// ארנק — cards on top, banknotes at the bottom, and a tap that moves a note
// into the account.

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(300, SCREEN_W - 70);
const CARD_GAP = 12;

const NOTES = [
  { value: 20, tone: "#C0392B", label: "20 ₪", face: "רחל" },
  { value: 50, tone: "#16A085", label: "50 ₪", face: "עגנון" },
  { value: 100, tone: "#8E44AD", label: "100 ₪", face: "גולדברג" },
  { value: 200, tone: "#2980B9", label: "200 ₪", face: "אלתרמן" },
];

export default function WalletScreen() {
  const { wallet, piggy, liquid, addToWallet, walletToAccount } = useMoney();
  const [flash, setFlash] = useState(null);
  const [activeCard, setActiveCard] = useState(0);
  const scrollRef = useRef(null);

  // The cards are a view of the same money, not extra accounts. Showing them
  // as separate balances would double-count what the user has.
  const CARDS = [
    { key: "cash", label: "מזומן בארנק", value: wallet, tone: UI.violet, icon: "credit-card", note: "שטרות ומטבעות" },
    { key: "piggy", label: "בקופת החיסכון", value: piggy, tone: UI.cyan, icon: "archive", note: "ממתין להעברה" },
    { key: "account", label: "בחשבון", value: liquid, tone: "#111827", icon: "trending-up", note: "יתרה נזילה" },
  ];

  const say = (text) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 2200);
  };

  const addNote = (note) => {
    hapticSuccess();
    addToWallet(note.value);
    say(`${note.label} נוספו לארנק`);
  };

  const deposit = (amount) => {
    const moved = walletToAccount(amount);
    if (!moved) {
      hapticWarning();
      say("אין מספיק בארנק");
      return;
    }
    hapticSuccess();
    say(`${shekel(moved)} הופקדו לחשבון`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Swipeable cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={s.cardRail}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
          setActiveCard(Math.max(0, Math.min(CARDS.length - 1, i)));
        }}
      >
        {CARDS.map((c, i) => (
          <Animated.View
            key={c.key}
            entering={FadeInDown.delay(i * 90).springify().damping(14)}
            style={[s.card, { backgroundColor: c.tone }]}
          >
            <View style={s.cardTop}>
              <Icon name={c.icon} size={22} color="rgba(255,255,255,0.9)" />
              <Text style={s.cardLabel}>{c.label}</Text>
            </View>
            <Text testID={`wallet-card-${c.key}`} style={s.cardValue}>{shekel(c.value)}</Text>
            <Text style={s.cardNote}>{c.note}</Text>
            <View style={s.cardChip} />
          </Animated.View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {CARDS.map((c, i) => (
          <View key={c.key} style={[s.dot, i === activeCard && s.dotOn]} />
        ))}
      </View>

      {!!flash && (
        <Animated.View entering={FadeIn.duration(200)} style={s.flash}>
          <Text style={s.flashText}>{flash}</Text>
        </Animated.View>
      )}

      {/* Deposit to account */}
      <View style={s.depositCard}>
        <Text style={s.sectionLabel}>הפקדה לחשבון</Text>
        <View style={s.depositRow}>
          <Bounce
            testID="deposit-all"
            style={[s.depositBtn, { backgroundColor: UI.violet }]}
            scaleTo={0.94}
            onPress={() => deposit(wallet)}
          >
            <Icon name="arrow-left" size={16} color="#FFFFFF" />
            <Text style={s.depositText}>הפקד הכול</Text>
          </Bounce>
          {[50, 100].map((amount) => (
            <Bounce
              key={amount}
              testID={`deposit-${amount}`}
              style={s.depositBtn}
              scaleTo={0.94}
              onPress={() => deposit(amount)}
            >
              <Text style={[s.depositText, { color: UI.inkSoft }]}>{amount} ₪</Text>
            </Bounce>
          ))}
        </View>
      </View>

      {/* Banknotes */}
      <Text style={s.sectionHead}>שטרות</Text>
      <Text style={s.sectionHint}>הקש על שטר כדי להוסיף אותו לארנק</Text>

      <View style={s.notes}>
        {NOTES.map((n, i) => (
          <Animated.View key={n.value} entering={FadeInDown.delay(i * 70).springify().damping(14)}>
            <Bounce
              testID={`note-${n.value}`}
              style={[s.note, { backgroundColor: n.tone }]}
              scaleTo={0.94}
              onPress={() => addNote(n)}
              onLongPress={() => { hapticLight(); deposit(n.value); }}
              delayLongPress={400}
            >
              <View style={s.noteInner}>
                <Text style={s.noteValue}>{n.value}</Text>
                <Text style={s.noteCurrency}>₪</Text>
              </View>
              <Text style={s.noteFace}>{n.face}</Text>
            </Bounce>
          </Animated.View>
        ))}
      </View>

      <Text style={s.hint}>
        הקשה מוסיפה שטר לארנק, לחיצה ארוכה מפקידה אותו ישירות לחשבון. הכרטיסים למעלה הם תצוגה של אותו
        כסף בשלושת המקומות — לא שלושה חשבונות נפרדים.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  content: { paddingBottom: 120, paddingTop: 14 },

  cardRail: { paddingHorizontal: 24, gap: CARD_GAP },
  card: {
    width: CARD_W,
    height: 168,
    borderRadius: 26,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 7,
  },
  cardTop: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 9 },
  cardLabel: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5, color: "rgba(255,255,255,0.92)", textAlign: "right" },
  cardValue: { fontFamily: FONTS.bold, fontSize: 34, color: "#FFFFFF", textAlign: "right" },
  cardNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: "rgba(255,255,255,0.75)", textAlign: "right" },
  cardChip: {
    position: "absolute",
    top: 58,
    left: 20,
    width: 40,
    height: 30,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D6DBE5" },
  dotOn: { backgroundColor: UI.violet, width: 20 },

  flash: {
    alignSelf: "center",
    backgroundColor: UI.ink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 12,
  },
  flashText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#FFFFFF" },

  depositCard: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginTop: 16,
    gap: 12,
    ...CARD_SHADOW,
  },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft, textAlign: "right" },
  depositRow: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", gap: 8 },
  depositBtn: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
  },
  depositText: { fontFamily: FONTS.bold, fontSize: 14, color: "#FFFFFF" },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 22,
  },
  sectionHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 3,
  },

  notes: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: UI.cardMarginH, marginTop: 12, justifyContent: "center" },
  note: {
    width: 150,
    height: 82,
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  noteInner: { flexDirection: "row", alignItems: "baseline", gap: 3, alignSelf: "flex-end" },
  noteValue: { fontFamily: FONTS.bold, fontSize: 26, color: "#FFFFFF" },
  noteCurrency: { fontFamily: FONTS.bold, fontSize: 15, color: "rgba(255,255,255,0.85)" },
  noteFace: { fontFamily: FONTS.regular, fontSize: 11, color: "rgba(255,255,255,0.8)", textAlign: "right" },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 20,
  },
});
