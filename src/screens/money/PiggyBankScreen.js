import { useCallback, useEffect, useRef, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { CARD_SHADOW, TYPE, UI } from "../../utils/ui";

// קופת חיסכון — the six coins actually in circulation, dropped into a jar.

const JAR_H = 230;
const JAR_W = 186;
const COIN = 40;
const FALL_MS = 520;

// Agorot as integers: a jar filled 0.1 at a time on floats drifts within a
// couple of dozen taps, and a savings counter that is wrong is worthless.
const COINS = [
  { agorot: 10, label: "10 אג׳", tone: "#B8BCC6", size: 34 },
  { agorot: 50, label: "½ ₪", tone: "#A8ADB8", size: 37 },
  { agorot: 100, label: "1 ₪", tone: "#9CA3AF", size: 40 },
  { agorot: 200, label: "2 ₪", tone: "#8E97A6", size: 43 },
  { agorot: 500, label: "5 ₪", tone: "#B08D57", size: 46 },
  { agorot: 1000, label: "10 ₪", tone: "#C9A227", size: 49 },
];

function FallingCoin({ coin, startX, onDone }) {
  const y = useSharedValue(-COIN);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const spin = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    // Ease-in, because gravity accelerates. A linear drop reads as a sticker
    // being slid down rather than a coin being dropped.
    y.value = withTiming(JAR_H - COIN - 14, { duration: FALL_MS, easing: Easing.in(Easing.quad) });
    spin.value = withTiming(300 + Math.random() * 240, { duration: FALL_MS });
    sy.value = withDelay(FALL_MS, withSequence(withTiming(0.6, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 320 })));
    sx.value = withDelay(FALL_MS, withSequence(withTiming(1.32, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 320 })));
    fade.value = withDelay(FALL_MS + 230, withTiming(0, { duration: 250 }, (f) => {
      if (f) runOnJS(onDone)();
    }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scaleX: sx.value }, { scaleY: sy.value }, { rotate: `${spin.value}deg` }],
    opacity: fade.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.coin, { left: startX, backgroundColor: coin.tone, width: COIN, height: COIN }, style]}
    >
      <Text style={s.coinFaceText}>{coin.agorot >= 100 ? coin.agorot / 100 : `${coin.agorot}a`}</Text>
    </Animated.View>
  );
}

export default function PiggyBankScreen() {
  const { piggy, addToPiggy, piggyToWallet } = useMoney();
  const [flying, setFlying] = useState([]);
  const [flash, setFlash] = useState(null);
  const nextId = useRef(0);

  // The jar has no goal, so the fill is a soft log curve against 200 — enough
  // that early coins visibly move it and a full jar still has headroom.
  const level = useSharedValue(0);
  useEffect(() => {
    const pct = Math.min(100, (Math.log10((piggy || 0) + 1) / Math.log10(201)) * 100);
    level.value = withSpring(pct, { damping: 15, stiffness: 90 });
  }, [piggy]);
  const waterStyle = useAnimatedStyle(() => ({ height: `${level.value}%` }));

  const drop = useCallback(
    (coin) => {
      hapticLight();
      const id = nextId.current;
      nextId.current += 1;
      setFlying((prev) => [...prev, { id, coin, startX: 20 + Math.random() * (JAR_W - COIN - 40) }]);
      // Credited on landing, so the number and the animation tell one story.
      setTimeout(() => {
        addToPiggy(coin.agorot / 100);
        hapticSuccess();
      }, FALL_MS);
    },
    [addToPiggy]
  );

  const transfer = () => {
    const moved = piggyToWallet();
    if (!moved) {
      hapticWarning();
      setFlash("הקופה ריקה");
    } else {
      hapticSuccess();
      setFlash(`${shekel(moved)} הועברו לארנק`);
    }
    setTimeout(() => setFlash(null), 2200);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.jarStage}>
        <View style={s.jarLid} />
        <View testID="piggy-jar" style={s.jar}>
          <Animated.View style={[s.water, waterStyle]}>
            <View style={s.crest} />
          </Animated.View>
          {flying.map((f) => (
            <FallingCoin
              key={f.id}
              coin={f.coin}
              startX={f.startX}
              onDone={() => setFlying((prev) => prev.filter((x) => x.id !== f.id))}
            />
          ))}
          <View style={s.readout} pointerEvents="none">
            <Text testID="piggy-balance" style={s.balance}>{shekel(piggy)}</Text>
            <Text style={s.balanceLabel}>בקופה</Text>
          </View>
        </View>
      </View>

      {!!flash && (
        <Animated.View entering={FadeIn.duration(200)} style={s.flash}>
          <Text style={s.flashText}>{flash}</Text>
        </Animated.View>
      )}

      <View style={s.grid}>
        {COINS.map((c) => (
          <Bounce
            key={c.agorot}
            testID={`coin-${c.agorot}`}
            style={s.coinBtn}
            scaleTo={0.88}
            onPress={() => drop(c)}
          >
            <View style={[s.coinFace, { width: c.size, height: c.size, borderRadius: c.size / 2, backgroundColor: c.tone }]}>
              <Text style={s.coinFaceText}>{c.agorot >= 100 ? c.agorot / 100 : c.agorot}</Text>
            </View>
            <Text style={s.coinLabel}>{c.label}</Text>
          </Bounce>
        ))}
      </View>

      <Bounce testID="piggy-transfer" style={s.transferBtn} scaleTo={0.96} onPress={transfer}>
        <Icon name="arrow-left" size={18} color="#FFFFFF" />
        <Text style={s.transferText}>העבר לארנק</Text>
      </Bounce>

      <Text style={s.hint}>
        הסכומים נספרים באגורות ומחולקים ב-100 רק בתצוגה, כך שקופה שמתמלאת במטבעות של 10 אגורות לא
        צוברת שגיאות עיגול. המטבע נזקף ברגע הנחיתה.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  content: { paddingBottom: 120, paddingTop: 12 },

  jarStage: { alignItems: "center" },
  jarLid: { width: JAR_W - 30, height: 15, borderRadius: 8, backgroundColor: "#DDE2EC", marginBottom: -4, zIndex: 2 },
  jar: {
    width: JAR_W,
    height: JAR_H,
    borderRadius: 32,
    backgroundColor: UI.surface,
    borderWidth: 3,
    borderColor: "#E4E8F0",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  water: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: UI.violet, opacity: 0.9 },
  crest: { position: "absolute", top: 0, left: 0, right: 0, height: 7, backgroundColor: "rgba(255,255,255,0.35)" },
  readout: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  balance: { fontFamily: FONTS.bold, fontSize: 32, color: UI.ink },
  balanceLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: UI.inkSoft, marginTop: 2 },

  coin: {
    position: "absolute",
    top: 0,
    borderRadius: COIN / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    zIndex: 3,
  },

  flash: {
    alignSelf: "center",
    backgroundColor: UI.ink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 12,
  },
  flashText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#FFFFFF" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: UI.cardMarginH,
    marginTop: 18,
  },
  coinBtn: {
    width: 100,
    alignItems: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surface,
    ...CARD_SHADOW,
  },
  coinFace: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  coinFaceText: { fontFamily: FONTS.bold, fontSize: 14, color: "#FFFFFF" },
  coinLabel: { fontFamily: FONTS.semibold, fontSize: 11.5, color: UI.inkSoft },

  transferBtn: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 56,
    borderRadius: UI.radius,
    backgroundColor: UI.violet,
    marginHorizontal: UI.cardMarginH,
    marginTop: 16,
    shadowColor: UI.violet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  transferText: { fontFamily: FONTS.bold, fontSize: 15.5, color: "#FFFFFF" },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 18,
  },
});
