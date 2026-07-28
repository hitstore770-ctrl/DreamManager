import { useCallback, useEffect, useRef, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";
import { usePersistentState } from "../utils/usePersistentState";
import CustomText from "../components/CustomText";

// אזור החיסכון — a jar that fills as you feed it.
//
// The point is the feedback loop, not the arithmetic: dropping a coin should
// feel like dropping a coin. Every deposit spawns a physical coin that falls,
// lands, and nudges the water level up.

const JAR_HEIGHT = 260;
const JAR_WIDTH = 190;
const COIN_SIZE = 44;

const DENOMS = [
  { value: 1, label: "1 ₪", tone: "#9CA3AF" },
  { value: 5, label: "5 ₪", tone: "#B08D57" },
  { value: 10, label: "10 ₪", tone: "#C9A227" },
];

// Fall, squash on impact, then settle. Real gravity accelerates, so the drop
// uses an ease-in curve rather than a linear slide — a constant-speed coin
// reads as a sticker being moved, not a coin being dropped.
const FALL_MS = 520;
const SETTLE_MS = 240;

function Coin({ denom, startX, onDone }) {
  const y = useSharedValue(-COIN_SIZE);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const spin = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    y.value = withTiming(JAR_HEIGHT - COIN_SIZE - 16, {
      duration: FALL_MS,
      easing: Easing.in(Easing.quad),
    });
    spin.value = withTiming(360 + Math.random() * 180, { duration: FALL_MS });
    // Squash on landing, then recover: the classic weight cue.
    scaleY.value = withDelay(
      FALL_MS,
      withSequence(
        withTiming(0.62, { duration: 70 }),
        withSpring(1, { damping: 6, stiffness: 300 })
      )
    );
    scaleX.value = withDelay(
      FALL_MS,
      withSequence(
        withTiming(1.3, { duration: 70 }),
        withSpring(1, { damping: 6, stiffness: 300 })
      )
    );
    // Sink into the pile rather than sitting on top of it forever.
    fade.value = withDelay(
      FALL_MS + SETTLE_MS,
      withTiming(0, { duration: 260 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
      { rotate: `${spin.value}deg` },
    ],
    opacity: fade.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.coin, { left: startX, backgroundColor: denom.tone }, style]}
    >
      <CustomText style={s.coinText}>{denom.value}</CustomText>
    </Animated.View>
  );
}

export default function SavingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [balance, setBalance, balanceLoaded] = usePersistentState(STORAGE_KEYS.savingsBalance, 0);
  const [goal, setGoal, goalLoaded] = usePersistentState(STORAGE_KEYS.savingsGoal, 1000);
  const [history, setHistory] = usePersistentState(STORAGE_KEYS.savingsHistory, []);
  const [goalDraft, setGoalDraft] = useState("");
  const [coins, setCoins] = useState([]);
  const coinId = useRef(0);

  useEffect(() => {
    if (goalLoaded) setGoalDraft(String(goal || ""));
  }, [goalLoaded]);

  const target = Math.max(1, parseFloat(goal) || 1);
  const pct = Math.min(100, (balance / target) * 100);
  const reached = balance >= target;

  // The water level. Animating the height rather than re-rendering it means the
  // rise reads as liquid settling instead of the bar teleporting.
  const level = useSharedValue(0);
  useEffect(() => {
    if (!balanceLoaded) return;
    level.value = withSpring(pct, { damping: 15, stiffness: 90 });
  }, [pct, balanceLoaded]);

  const waterStyle = useAnimatedStyle(() => ({ height: `${level.value}%` }));

  const drop = useCallback(
    (denom) => {
      hapticLight();
      const id = coinId.current;
      coinId.current += 1;
      // Scatter the entry point so repeated taps do not stack in one column.
      const startX = 24 + Math.random() * (JAR_WIDTH - COIN_SIZE - 48);
      setCoins((prev) => [...prev, { id, denom, startX }]);

      // The balance updates when the coin lands, not when the button is
      // pressed — otherwise the number moves before the coin does and the
      // animation looks decorative rather than causal.
      setTimeout(() => {
        setBalance((b) => Math.round(((b || 0) + denom.value) * 100) / 100);
        setHistory((h) => [{ at: Date.now(), amount: denom.value }, ...(h || [])].slice(0, 40));
        hapticSuccess();
      }, FALL_MS);
    },
    [setBalance, setHistory]
  );

  const removeCoin = useCallback((id) => {
    setCoins((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveGoal = () => {
    const next = parseFloat(goalDraft);
    if (!Number.isFinite(next) || next <= 0) {
      hapticWarning();
      setGoalDraft(String(goal));
      return;
    }
    hapticSuccess();
    setGoal(next);
  };

  const reset = () => {
    hapticWarning();
    setBalance(0);
    setHistory([]);
  };

  const undo = () => {
    if (!history?.length) return;
    hapticLight();
    const [last, ...rest] = history;
    setBalance((b) => Math.max(0, Math.round(((b || 0) - last.amount) * 100) / 100));
    setHistory(rest);
  };

  const todayTotal = (history || [])
    .filter((h) => Date.now() - h.at < 86400000)
    .reduce((sum, h) => sum + h.amount, 0);

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Bounce style={s.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <CustomText style={s.title}>אזור החיסכון</CustomText>
          <CustomText style={s.subtitle}>כל מטבע נספר ונשמר במכשיר</CustomText>
        </View>
        {balance > 0 && (
          <Bounce style={s.iconBtn} scaleTo={0.9} onPress={reset}>
            <Icon name="rotate-ccw" size={17} color={UI.inkSoft} />
          </Bounce>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The jar */}
        <View style={s.jarStage}>
          <View style={s.jarLid} />
          <View style={s.jar} testID="savings-jar">
            <Animated.View style={[s.water, waterStyle, reached && { backgroundColor: UI.green }]}>
              <View style={s.waterCrest} />
            </Animated.View>

            {/* Falling coins live above the water, inside the jar's clip. */}
            {coins.map((c) => (
              <Coin key={c.id} denom={c.denom} startX={c.startX} onDone={() => removeCoin(c.id)} />
            ))}

            <View style={s.jarReadout} pointerEvents="none">
              <CustomText testID="savings-balance" style={s.balance}>{shekel(balance || 0)}</CustomText>
              <CustomText style={s.ofGoal}>מתוך {shekel(target)}</CustomText>
              <CustomText style={[s.pct, reached && { color: UI.green }]}>{Math.round(pct)}%</CustomText>
            </View>
          </View>
        </View>

        {reached && (
          <Animated.View entering={FadeIn.duration(300)} style={s.reachedCard}>
            <Icon name="award" size={18} color={UI.green} />
            <CustomText style={s.reachedText}>הגעת ליעד. אפשר להעלות אותו ולהמשיך.</CustomText>
          </Animated.View>
        )}

        {/* Coin buttons */}
        <View style={s.coinRow}>
          {DENOMS.map((d) => (
            <Bounce
              key={d.value}
              testID={`add-${d.value}`}
              style={[s.coinBtn, { borderColor: d.tone }]}
              scaleTo={0.9}
              onPress={() => drop(d)}
            >
              <View style={[s.coinBtnFace, { backgroundColor: d.tone }]}>
                <CustomText style={s.coinBtnValue}>{d.value}</CustomText>
              </View>
              <CustomText style={s.coinBtnLabel}>הוסף {d.label}</CustomText>
            </Bounce>
          ))}
        </View>

        {/* Stats */}
        <View style={s.statRow}>
          <Stat label="נחסך היום" value={shekel(todayTotal)} tone={UI.violet} />
          <Stat label="הפקדות" value={(history || []).length} />
          <Stat label="נותר ליעד" value={shekel(Math.max(0, target - (balance || 0)))} tone={reached ? UI.green : UI.ink} />
        </View>

        {/* Goal + undo */}
        <View style={s.card}>
          <CustomText style={s.cardLabel}>יעד החיסכון</CustomText>
          <View style={s.goalRow}>
            <Bounce style={s.goalSave} scaleTo={0.93} onPress={saveGoal}>
              <Icon name="check" size={17} color="#FFFFFF" />
            </Bounce>
            <TextInput
              testID="savings-goal"
              style={s.goalInput}
              value={goalDraft}
              onChangeText={setGoalDraft}
              onBlur={saveGoal}
              placeholder="1000"
              placeholderTextColor={UI.inkMuted}
              keyboardType="numeric"
              textAlign="center"
            />
          </View>

          {!!(history || []).length && (
            <Bounce style={s.undoBtn} scaleTo={0.96} onPress={undo}>
              <Icon name="corner-up-left" size={16} color={UI.inkSoft} />
              <CustomText style={s.undoText}>בטל את ההפקדה האחרונה</CustomText>
            </Bounce>
          )}
        </View>

        <CustomText style={s.hint}>
          הסכום נשמר במכשיר בלבד ואינו מסונכרן לענן. המטבע מתווסף למאזן ברגע הנחיתה, כדי שהמספר
          והאנימציה יספרו את אותו סיפור.
        </CustomText>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, tone = UI.ink }) {
  return (
    <View style={s.stat}>
      <CustomText style={[s.statValue, { color: tone }]}>{value}</CustomText>
      <CustomText style={s.statLabel}>{label}</CustomText>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },

  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },

  jarStage: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  jarLid: {
    width: JAR_WIDTH - 30,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DDE2EC",
    marginBottom: -4,
    zIndex: 2,
  },
  jar: {
    width: JAR_WIDTH,
    height: JAR_HEIGHT,
    borderRadius: 34,
    backgroundColor: UI.surface,
    borderWidth: 3,
    borderColor: "#E4E8F0",
    overflow: "hidden",
    justifyContent: "flex-end",
    ...CARD_SHADOW,
  },
  water: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI.violet,
    opacity: 0.9,
  },
  waterCrest: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  jarReadout: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 2 },
  balance: { fontFamily: FONTS.bold, fontSize: 34, color: UI.ink },
  ofGoal: { fontFamily: FONTS.medium, fontSize: 12.5, color: UI.inkSoft },
  pct: { fontFamily: FONTS.bold, fontSize: 15, color: UI.violet, marginTop: 4 },

  coin: {
    position: "absolute",
    top: 0,
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    zIndex: 3,
  },
  coinText: { fontFamily: FONTS.bold, fontSize: 16, color: "#FFFFFF" },

  reachedCard: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 9,
    backgroundColor: UI.green + "16",
    borderRadius: UI.radius,
    padding: 14,
    marginHorizontal: UI.cardMarginH,
    marginBottom: 12,
  },
  reachedText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.green, textAlign: "right" },

  coinRow: { flexDirection: "row", gap: 10, paddingHorizontal: UI.cardMarginH, marginTop: 8 },
  coinBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: UI.radius,
    backgroundColor: UI.surface,
    borderWidth: 1.5,
    ...CARD_SHADOW,
  },
  coinBtnFace: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  coinBtnValue: { fontFamily: FONTS.bold, fontSize: 17, color: "#FFFFFF" },
  coinBtnLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkSoft },

  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: UI.cardMarginH, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: UI.surface,
    borderRadius: UI.radiusSm,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
    ...CARD_SHADOW,
  },
  statValue: { fontFamily: FONTS.bold, fontSize: 17 },
  statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted },

  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginTop: 14,
    gap: 12,
    ...CARD_SHADOW,
  },
  cardLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft, textAlign: "right" },
  goalRow: { flexDirection: ROW, gap: 10, alignItems: "center" },
  goalInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: UI.ink,
  },
  goalSave: {
    width: 52,
    height: 52,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  undoBtn: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
  },
  undoText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 16,
  },
});
