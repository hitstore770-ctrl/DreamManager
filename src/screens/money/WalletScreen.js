import { useRef, useState } from "react";
import { Dimensions, I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Banknote from "../../components/money/Banknote";
import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { GradCard } from "../../components/Paper";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { BEVEL, GRAD, TYPE, UI, glow } from "../../utils/ui";

// ארנק — payment cards on top, printed banknotes at the bottom, and a tap that
// moves a note into the account.

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(304, SCREEN_W - 62);
const CARD_GAP = 14;

// Two per row at whatever width is left after the page margins, keeping the
// 2:1.1 proportion of a real note.
const NOTE_W = Math.min(164, (SCREEN_W - UI.cardMarginH * 2 - 12) / 2);
const NOTE_H = Math.round(NOTE_W * 0.55);

const NOTES = [20, 50, 100, 200];

export default function WalletScreen() {
  const { wallet, piggy, liquid, addToWallet, walletToAccount } = useMoney();
  const [flash, setFlash] = useState(null);
  const [activeCard, setActiveCard] = useState(0);
  const scrollRef = useRef(null);

  // The cards are a view of the same money, not extra accounts. Showing them
  // as separate balances would double-count what the user has.
  const CARDS = [
    { key: "cash", label: "מזומן בארנק", value: wallet, grad: GRAD.violet, halo: UI.violet, brand: "CASH", note: "שטרות ומטבעות" },
    { key: "piggy", label: "בקופת החיסכון", value: piggy, grad: GRAD.cyan, halo: UI.cyan, brand: "SAVE", note: "ממתין להעברה" },
    { key: "account", label: "בחשבון", value: liquid, grad: GRAD.ink, halo: "#000000", brand: "BANK", note: "יתרה נזילה" },
  ];

  const say = (text) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 2200);
  };

  const addNote = (value) => {
    hapticSuccess();
    addToWallet(value);
    say(`${value} ₪ נוספו לארנק`);
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
          <Animated.View key={c.key} entering={FadeInDown.delay(i * 90).springify().damping(14)}>
            <GradCard colors={c.grad} halo={c.halo} radius={26} style={{ width: CARD_W }}>
              <View style={s.card}>
                {/* Holographic band, as on a real card face. */}
                <LinearGradient
                  colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)", "rgba(255,255,255,0.10)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.holo}
                  pointerEvents="none"
                />

                <View style={s.cardTop}>
                  <Text style={s.cardBrand}>{c.brand}</Text>
                  <Text style={s.cardLabel}>{c.label}</Text>
                </View>

                {/* Contact chip. */}
                <View style={s.chipRow}>
                  <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chip}>
                    <View style={s.chipLineA} />
                    <View style={s.chipLineB} />
                  </LinearGradient>
                  {/* Contactless arcs. */}
                  <View style={s.wave}>
                    {[10, 15, 20].map((r) => (
                      <View key={r} style={[s.arc, { width: r, height: r * 2, borderRadius: r }]} />
                    ))}
                  </View>
                </View>

                <Text testID={`wallet-card-${c.key}`} style={s.cardValue}>{shekel(c.value)}</Text>
                <View style={s.cardFoot}>
                  <Text style={s.cardNote}>{c.note}</Text>
                  <Text style={s.cardDots}>•••• 7708</Text>
                </View>
              </View>
            </GradCard>
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
      <GradCard colors={GRAD.surface} style={s.depositCard}>
        <View style={s.depositInner}>
          <Text style={s.sectionLabel}>הפקדה לחשבון</Text>
          <View style={s.depositRow}>
            <Bounce testID="deposit-all" style={s.depositPrimaryWrap} scaleTo={0.94} onPress={() => deposit(wallet)}>
              <LinearGradient
                colors={GRAD.violet}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.depositPrimary}
              >
                <Icon name="arrow-left" size={16} color="#FFFFFF" />
                <Text style={s.depositText}>הפקד הכול</Text>
              </LinearGradient>
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
      </GradCard>

      {/* Banknotes */}
      <Text style={s.sectionHead}>שטרות</Text>
      <Text style={s.sectionHint}>הקש על שטר כדי להוסיף אותו לארנק</Text>

      <View style={s.notes}>
        {NOTES.map((value, i) => (
          <Animated.View key={value} entering={FadeInDown.delay(i * 70).springify().damping(14)}>
            <Bounce
              testID={`note-${value}`}
              scaleTo={0.94}
              onPress={() => addNote(value)}
              onLongPress={() => { hapticLight(); deposit(value); }}
              delayLongPress={400}
            >
              <Banknote value={value} width={NOTE_W} height={NOTE_H} />
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

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingBottom: 130, paddingTop: 16 },

  cardRail: { paddingHorizontal: 22, gap: CARD_GAP },
  card: { height: 184, padding: 20, justifyContent: "space-between" },
  holo: { ...StyleSheet.absoluteFillObject },
  cardTop: { flexDirection: ROW, alignItems: "center", justifyContent: "space-between" },
  cardBrand: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.6)",
  },
  cardLabel: { fontFamily: FONTS.semibold, fontSize: 13.5, color: "rgba(255,255,255,0.94)", textAlign: "right" },

  chipRow: { flexDirection: ROW, alignItems: "center", gap: 12 },
  chip: {
    width: 42,
    height: 32,
    borderRadius: 7,
    padding: 5,
    justifyContent: "space-between",
    ...BEVEL,
  },
  chipLineA: { height: 1.5, backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 1, width: "70%" },
  chipLineB: { height: 1.5, backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 1, width: "100%" },
  wave: { flexDirection: ROW, alignItems: "center", gap: 3, opacity: 0.55 },
  arc: {
    borderWidth: 1.6,
    borderColor: "rgba(255,255,255,0.85)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  cardValue: {
    fontFamily: FONTS.bold,
    fontSize: 33,
    color: "#FFFFFF",
    textAlign: "right",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  cardFoot: { flexDirection: ROW, alignItems: "center", justifyContent: "space-between" },
  cardNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: "rgba(255,255,255,0.72)", textAlign: "right" },
  cardDots: { fontFamily: FONTS.medium, fontSize: 11.5, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5 },

  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D6DBE5" },
  dotOn: { backgroundColor: UI.violet, width: 20 },

  flash: {
    alignSelf: "center",
    backgroundColor: UI.surfaceHi,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
    ...BEVEL,
  },
  flashText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.ink },

  depositCard: { marginHorizontal: UI.cardMarginH, marginTop: 18 },
  depositInner: { padding: UI.cardPadding, gap: 12 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft, textAlign: "right" },
  depositRow: { flexDirection: ROW, gap: 8 },
  depositPrimaryWrap: { flex: 1, borderRadius: UI.radiusSm, ...glow(UI.violet, 0.35) },
  depositPrimary: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 50,
    borderRadius: UI.radiusSm,
    ...BEVEL,
  },
  depositBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
    ...BEVEL,
  },
  depositText: { fontFamily: FONTS.bold, fontSize: 14, color: "#FFFFFF" },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 26,
  },
  sectionHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 3,
  },

  notes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: UI.cardMarginH,
    marginTop: 14,
    justifyContent: "center",
  },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 22,
  },
});
