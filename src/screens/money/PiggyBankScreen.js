import { useCallback, useEffect, useRef, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Bounce from "../../components/Bounce";
import Coin from "../../components/money/Coin";
import FallingCoin from "../../components/money/FallingCoin";
import Icon from "../../components/Icon";
import { GradCard } from "../../components/Paper";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { BEVEL, CARD_SHADOW, GRAD, TYPE, UI, glow } from "../../utils/ui";
import CustomText from "../../components/CustomText";

// קופת חיסכון — a glass jar you drop struck coins into.
//
// The jar is genuine glassmorphism rather than a light rectangle: blur behind
// it, a translucent gradient body, a bright rim where the glass wall turns,
// and two specular streaks down the left. What sells it is that the coins and
// the fill are *inside* the clip, so the glass wall passes over them.

const JAR_H = 246;
const JAR_W = 196;
const COIN = 42;

// Agorot as integers: a jar filled 0.1 at a time on floats drifts within a
// couple of dozen taps, and a savings counter that is wrong is worthless.
const COINS = [
  { agorot: 10, label: "10 אג׳", size: 40 },
  { agorot: 50, label: "½ ₪", size: 44 },
  { agorot: 100, label: "1 ₪", size: 47 },
  { agorot: 200, label: "2 ₪", size: 50 },
  { agorot: 500, label: "5 ₪", size: 53 },
  { agorot: 1000, label: "10 ₪", size: 56 },
];

export default function PiggyBankScreen() {
  const { piggy, addToPiggy, piggyToWallet } = useMoney();
  const [flying, setFlying] = useState([]);
  const [flash, setFlash] = useState(null);
  const nextId = useRef(0);

  // The jar has no goal, so the fill is a soft log curve against 200 — enough
  // that early coins visibly move it and a full jar still has headroom.
  const level = useSharedValue(0);
  useEffect(() => {
    const pct = Math.min(92, (Math.log10((piggy || 0) + 1) / Math.log10(201)) * 92);
    level.value = withSpring(pct, { damping: 15, stiffness: 90 });
  }, [piggy]);
  const fillStyle = useAnimatedStyle(() => ({ height: `${level.value}%` }));

  // Slow drift on the surface, so the liquid is never perfectly still.
  const swell = useSharedValue(0);
  useEffect(() => {
    swell.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const crestStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 + swell.value * 4 }, { scaleX: 1 + swell.value * 0.04 }],
  }));

  const drop = useCallback((coin) => {
    hapticLight();
    const id = nextId.current;
    nextId.current += 1;
    setFlying((prev) => [...prev, { id, coin, startX: 26 + Math.random() * (JAR_W - COIN - 52) }]);
  }, []);

  // Credited by the coin itself, on the frame it first hits the pile — so the
  // number and the impact are one event rather than two timers racing.
  const land = useCallback(
    (coin) => {
      addToPiggy(coin.agorot / 100);
      hapticSuccess();
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
      <View style={s.stage}>
        {/* Light pooled under the jar, so it stands on something. */}
        <View style={s.stageGlow} />

        {/* Metal lid band. */}
        <LinearGradient
          colors={["#E2E8F0", "#94A3B8", "#64748B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.lid}
        />
        <LinearGradient
          colors={["#CBD5E1", "#64748B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.neck}
        />

        <View testID="piggy-jar" style={s.jar}>
          <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255,255,255,0.85)", "rgba(226,232,240,0.55)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Contents */}
          <Animated.View style={[s.fill, fillStyle]}>
            <LinearGradient
              colors={["#8B5CF6", "#4F46E5", "#0891B2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[s.crest, crestStyle]} />
          </Animated.View>

          {flying.map((f) => (
            <FallingCoin
              key={f.id}
              agorot={f.coin.agorot}
              size={COIN}
              startX={f.startX}
              distance={JAR_H - 22}
              onLand={() => land(f.coin)}
              onDone={() => setFlying((prev) => prev.filter((x) => x.id !== f.id))}
            />
          ))}

          {/* Glass wall, drawn over the contents. */}
          <View style={s.streakA} pointerEvents="none" />
          <View style={s.streakB} pointerEvents="none" />
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0)", "rgba(15,23,42,0.14)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={s.jarRim} pointerEvents="none" />

          <View style={s.readout} pointerEvents="none">
            <View style={s.readoutChip}>
              <CustomText testID="piggy-balance" style={s.balance}>{shekel(piggy)}</CustomText>
              <CustomText style={s.balanceLabel}>בקופה</CustomText>
            </View>
          </View>
        </View>
      </View>

      {!!flash && (
        <Animated.View entering={FadeIn.duration(200)} style={s.flash}>
          <CustomText style={s.flashText}>{flash}</CustomText>
        </Animated.View>
      )}

      <CustomText style={s.sectionHead}>מטבעות</CustomText>

      <View style={s.grid}>
        {COINS.map((c, i) => (
          <Animated.View key={c.agorot} entering={FadeInDown.delay(i * 50).springify().damping(14)}>
            <Bounce testID={`coin-${c.agorot}`} style={s.coinBtn} scaleTo={0.88} onPress={() => drop(c)}>
              <GradCard colors={GRAD.surface} radius={UI.radiusSm} style={s.coinCard}>
                <View style={s.coinInner}>
                  <Coin agorot={c.agorot} size={c.size} />
                  <CustomText style={s.coinLabel}>{c.label}</CustomText>
                </View>
              </GradCard>
            </Bounce>
          </Animated.View>
        ))}
      </View>

      <Bounce testID="piggy-transfer" style={s.transferWrap} scaleTo={0.96} onPress={transfer}>
        <LinearGradient
          colors={GRAD.violet}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.transferBtn}
        >
          <Icon name="arrow-left" size={18} color="#FFFFFF" />
          <CustomText style={s.transferText}>העבר לארנק</CustomText>
        </LinearGradient>
      </Bounce>

      <CustomText style={s.hint}>
        הסכומים נספרים באגורות ומחולקים ב-100 רק בתצוגה, כך שקופה שמתמלאת במטבעות של 10 אגורות לא
        צוברת שגיאות עיגול. המטבע נזקף ברגע הנחיתה.
      </CustomText>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingBottom: 130, paddingTop: 16 },

  stage: { alignItems: "center" },
  stageGlow: {
    position: "absolute",
    bottom: -30,
    width: 240,
    height: 90,
    borderRadius: 120,
    backgroundColor: UI.violet,
    opacity: 0.1,
  },

  lid: {
    width: JAR_W - 46,
    height: 16,
    borderRadius: 9,
    zIndex: 3,
    ...BEVEL,
  },
  neck: {
    width: JAR_W - 62,
    height: 12,
    marginTop: -2,
    marginBottom: -6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 2,
    opacity: 0.9,
  },

  jar: {
    width: JAR_W,
    height: JAR_H,
    borderRadius: 38,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.5)",
    ...CARD_SHADOW,
  },
  jarRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  // Two streaks at different widths: one sharp, one soft. A single streak
  // reads as a stripe; two at different intensities read as a curved surface.
  streakA: {
    position: "absolute",
    top: 18,
    left: 20,
    width: 12,
    bottom: 26,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  streakB: {
    position: "absolute",
    top: 26,
    left: 40,
    width: 5,
    bottom: 40,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  fill: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  crest: {
    position: "absolute",
    top: 0,
    left: -6,
    right: -6,
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.45)",
  },


  readout: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  readoutChip: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: UI.radius,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    ...BEVEL,
    ...CARD_SHADOW,
  },
  balance: { fontFamily: FONTS.bold, fontSize: 30, color: UI.ink },
  balanceLabel: { fontFamily: FONTS.medium, fontSize: 12, color: UI.inkMuted, marginTop: 1 },

  flash: {
    alignSelf: "center",
    backgroundColor: UI.surfaceHi,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 16,
    ...BEVEL,
  },
  flashText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.ink },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 28,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: UI.cardMarginH,
  },
  coinBtn: { width: 104 },
  coinCard: { width: 104 },
  coinInner: { alignItems: "center", gap: 8, paddingVertical: 14 },
  coinLabel: { fontFamily: FONTS.semibold, fontSize: 11.5, color: UI.inkSoft },

  transferWrap: { marginHorizontal: UI.cardMarginH, marginTop: 20, borderRadius: UI.radius, ...glow(UI.violet, 0.4) },
  transferBtn: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 58,
    borderRadius: UI.radius,
    ...BEVEL,
  },
  transferText: { fontFamily: FONTS.bold, fontSize: 15.5, color: "#FFFFFF" },

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
